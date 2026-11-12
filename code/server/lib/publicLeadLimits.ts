import crypto from "node:crypto";
import type { Response } from "express";
import type { PublicLeadRefusal } from "../../shared/publicLeadLimits";

export type Query = (sql: string, parameters: any[]) => Promise<any>;
export type Quota = { key: string; limit: number; seconds: number; reason: PublicLeadRefusal };
export type Product = "cv" | "linkedin" | "salary" | "riasec";
export function configuredLimit(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

// One short transaction for all windows. Check-only admission protects uploads;
// the paid-work reservation repeats every check and commits all counters or none.
// Serialize per product across replicas, not merely within this process.
export const PUBLIC_LEAD_QUOTA_FUNCTION = `
CREATE OR REPLACE FUNCTION reserve_public_lead_quotas(namespace text, quotas jsonb, spend boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE q jsonb; current_hits integer; expiry timestamptz; instant timestamptz; refusal jsonb; remaining integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('public-lead:' || namespace, 0));
  instant := clock_timestamp();
  FOR q IN SELECT value FROM jsonb_array_elements(quotas) LOOP
    SELECT hits, expires_at INTO current_hits, expiry FROM cv_lead_public_quotas WHERE quota_key = q->>'key';
    IF expiry > instant AND current_hits >= (q->>'limit')::integer THEN
      remaining := greatest(1, ceil(extract(epoch FROM expiry - instant)));
      IF refusal IS NULL OR remaining > (refusal->>'retryAfter')::integer THEN
        refusal := jsonb_build_object('allowed', false, 'reason', q->>'reason',
          'retryAfter', remaining, 'limit', (q->>'limit')::integer, 'windowSeconds', (q->>'seconds')::integer);
      END IF;
    END IF;
  END LOOP;
  IF refusal IS NOT NULL THEN RETURN refusal; END IF;
  IF spend THEN
    FOR q IN SELECT value FROM jsonb_array_elements(quotas) LOOP
      INSERT INTO cv_lead_public_quotas (quota_key, hits, expires_at)
      VALUES (q->>'key', 1, instant + (q->>'seconds')::integer * interval '1 second')
      ON CONFLICT (quota_key) DO UPDATE SET
        hits = CASE WHEN cv_lead_public_quotas.expires_at <= instant THEN 1 ELSE cv_lead_public_quotas.hits + 1 END,
        expires_at = CASE WHEN cv_lead_public_quotas.expires_at <= instant THEN EXCLUDED.expires_at ELSE cv_lead_public_quotas.expires_at END;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('allowed', true);
END $$`;

export const PUBLIC_LEAD_REFUSAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS public_lead_refusals (
  day date NOT NULL,
  product text NOT NULL,
  reason text NOT NULL,
  refusals bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, product, reason)
)`;

export function createLeadRefusals(query: Query, product: Product) {
  // Coalesce bursts by controlled reason: bounded memory, no dropped counts.
  // Retain counts during a storage outage and retry without delaying responses.
  const counts = new Map<string, { day: string; reason: PublicLeadRefusal; count: number }>();
  let flushing = false;
  let scheduled = false;
  const schedule = (delay: number) => {
    if (scheduled) return;
    scheduled = true;
    const timer = setTimeout(() => { scheduled = false; void flush(); }, delay);
    timer.unref?.();
  };
  const flush = async () => {
    if (flushing) return;
    flushing = true;
    try {
      for (const [key, entry] of counts) {
        const count = entry.count;
        await query(`
          INSERT INTO public_lead_refusals (day, product, reason, refusals)
          VALUES ($1::date, $2, $3, $4)
          ON CONFLICT (day, product, reason) DO UPDATE SET refusals = public_lead_refusals.refusals + EXCLUDED.refusals
        `, [entry.day, product, entry.reason, count]);
        entry.count -= count;
        if (!entry.count) counts.delete(key);
      }
    } catch {
      console.warn("[Public Lead Refusal Metric] unavailable", JSON.stringify({ product }));
    } finally {
      flushing = false;
      if (counts.size) schedule(5_000);
    }
  };
  return (res: Response, reason: PublicLeadRefusal, retryAfter = 60, limit: number | null = null, windowSeconds: number | null = null) => {
    const requestId = typeof res.locals?.leadRequestId === "string" ? res.locals.leadRequestId : crypto.randomUUID();
    const status = reason === "capacity" || reason === "quota_unavailable" ? 503 : 429;
    console.warn("[Public Lead Refusal]", JSON.stringify({ product, reason, limit, windowSeconds, retryAfter, requestId, httpStatus: status }));
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const key = `${day}:${reason}`;
    const entry = counts.get(key) ?? { day, reason, count: 0 };
    entry.count++; counts.set(key, entry);
    // Start immediately; only the counter's background promise waits for SQL.
    void flush();
    res.setHeader("Retry-After", String(retryAfter));
    res.status(status).json({ error: reason === "capacity" ? "Le service est très sollicité. Une place devrait se libérer dans une minute environ." : "L’analyse gratuite sans compte est momentanément au maximum.", reason, retryAfter, requestId });
  };
}

export async function reserveQuotas(query: Query, namespace: string, quotas: Quota[], spend: boolean) {
  const result = await query("SELECT reserve_public_lead_quotas($1, $2::jsonb, $3) AS decision", [namespace, JSON.stringify(quotas), spend]);
  const decision = (Array.isArray(result) ? result : result?.rows)?.[0]?.decision;
  if (typeof decision?.allowed !== "boolean") throw new Error("Invalid public lead quota response");
  return decision as { allowed: boolean; reason: PublicLeadRefusal; retryAfter: number; limit: number; windowSeconds: number };
}

/** Bounded FIFO wait; a public waiter must never block a reserved member slot. */
export function createAnalysisCapacity(total: number, publicMax = total, waitMs = 20_000, maxWaiting = 100) {
  let active = 0, publicActive = 0;
  const waiters: { publicWork: boolean; resolve: (release: (() => void) | null) => void; timer: ReturnType<typeof setTimeout> }[] = [];
  const available = (publicWork: boolean) => active < total && (!publicWork || publicActive < publicMax);
  const take = (publicWork: boolean) => {
    active++; if (publicWork) publicActive++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active--; if (publicWork) publicActive--;
      for (let i = 0; i < waiters.length;) {
        const waiter = waiters[i];
        if (!available(waiter.publicWork)) { i++; continue; }
        waiters.splice(i, 1); clearTimeout(waiter.timer);
        waiter.resolve(take(waiter.publicWork));
      }
    };
  };
  return {
    acquire(publicWork: boolean): Promise<(() => void) | null> {
      if (available(publicWork)) return Promise.resolve(take(publicWork));
      if (waiters.length >= maxWaiting) return Promise.resolve(null);
      return new Promise(resolve => {
        const waiter = { publicWork, resolve, timer: setTimeout(() => {
          waiters.splice(waiters.indexOf(waiter), 1); resolve(null);
        }, waitMs) };
        waiters.push(waiter);
      });
    },
  };
}
