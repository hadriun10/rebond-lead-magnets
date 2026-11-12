import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, MapPin, Search, X } from "lucide-react";
import type { SearchOptions } from "@shared/jobSearchOptions";
import { appPath } from "@shared/appPaths";

/*
  « Voir les offres » des lead magnets (salaire, RIASEC).
  Réservé aux membres : sans compte, le bouton renvoie vers l'encart de déblocage.
  Connecté, le bloc s'agrandit : on tape sa ville (3 caractères au moins), puis
  la recherche d'offres s'ouvre dans un nouvel onglet et se lance toute seule
  (`/app/job-recommendations?query=…&locations=…&run=1`, lu par JobRecommendations).
*/

type SearchLocation = Exclude<SearchOptions["locations"][number], { kind: "free" }>;

interface LeadJobSearchProps {
  jobTitle: string;
  signedIn: boolean;
  /** Sans compte : faire défiler jusqu'à l'encart de déblocage. */
  onLocked: () => void;
  /** Appelé au lancement de la recherche, pour l'analytics. */
  onSearch?: (withCity: boolean) => void;
  label?: string;
  className?: string;
}

export function jobSearchUrl(jobTitle: string, location: SearchLocation | null) {
  const params = new URLSearchParams({ query: jobTitle, run: "1" });
  if (location) params.set("locations", JSON.stringify([location]));
  return appPath(`/job-recommendations?${params}`);
}

export function LeadJobSearch({ jobTitle, signedIn, onLocked, onSearch, label, className }: LeadJobSearchProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<SearchLocation | null>(null);
  const [suggestions, setSuggestions] = useState<SearchLocation[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Même source que les filtres de la recherche d'offres : seules les communes,
  // départements et régions officiels passent la validation du serveur.
  useEffect(() => {
    const query = text.trim();
    if (!open || picked || query.length < 2) { setSuggestions([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/public/job-search-locations?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const payload = response.ok ? await response.json() as { locations?: SearchLocation[] } : {};
        setSuggestions((payload.locations ?? []).filter((row) => row && row.kind !== "free" && row.code && row.label).slice(0, 6));
      } catch { /* Requête annulée ou réseau coupé : la recherche part sans ville. */ }
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [text, open, picked]);

  const ready = Boolean(picked) || text.trim().length >= 3;
  const launch = () => {
    if (!ready) return;
    // Texte tapé sans choisir dans la liste : on prend la première ville proposée.
    const location = picked ?? suggestions[0] ?? null;
    onSearch?.(Boolean(location));
    window.open(jobSearchUrl(jobTitle, location), "_blank", "noopener");
  };
  const expanded = signedIn && open;

  return (
    <div className={`ljs${expanded ? " ljs-open" : ""}${className ? ` ${className}` : ""}`}>
      <style>{`
        .ljs{width:100%;max-width:560px;border-radius:14px;background:var(--green,#2e8b27);border:2px solid var(--green,#2e8b27);transition:background-color .2s}
        .ljs-open{background:#fff}
        .ljs-head{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;padding:12px 18px;border:0;border-radius:12px;background:var(--green,#2e8b27);color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer;text-align:center}
        .ljs-head:hover{background:#247a1f}
        .ljs-open .ljs-head{border-radius:12px 12px 0 0}
        .ljs-head svg:last-child{transition:transform .2s}
        .ljs-open .ljs-head svg:last-child{transform:rotate(90deg)}
        .ljs-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .22s ease}
        .ljs-open .ljs-body{grid-template-rows:1fr}
        .ljs-inner{overflow:hidden}
        .ljs-open .ljs-inner{overflow:visible}
        .ljs-form{display:flex;flex-direction:column;gap:10px;padding:14px}
        .ljs-field{position:relative}
        .ljs-input{display:flex;align-items:center;gap:8px;border:1px solid var(--line,#dfe7da);border-radius:10px;padding:0 12px;min-height:46px;background:#fbfdf9}
        .ljs-input:focus-within{border-color:var(--green,#2e8b27)}
        .ljs-input input{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-size:15px;outline:none;color:var(--ink,#1d2b1f)}
        .ljs-input button{border:0;background:none;padding:4px;cursor:pointer;color:#53664f;display:flex}
        .ljs-list{position:absolute;z-index:20;left:0;right:0;top:calc(100% + 4px);margin:0;padding:4px;list-style:none;background:#fff;border:1px solid var(--line,#dfe7da);border-radius:10px;box-shadow:0 8px 24px rgba(10,52,0,.12)}
        .ljs-list button{width:100%;text-align:left;border:0;background:none;padding:9px 10px;border-radius:8px;font:inherit;font-size:15px;cursor:pointer;color:var(--ink,#1d2b1f)}
        .ljs-list button:hover{background:#eef5ea}
        .ljs-go{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;border:0;border-radius:10px;background:var(--green,#2e8b27);color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer}
        .ljs-go:hover:not(:disabled){background:#247a1f}
        .ljs-go:disabled{background:#d9e2d5;color:#7b8a77;cursor:not-allowed}
      `}</style>
      <button
        type="button"
        className="ljs-head"
        aria-expanded={signedIn ? open : undefined}
        onClick={() => (signedIn ? setOpen((value) => !value) : onLocked())}
      >
        <Search size={16} /> {label ?? `Voir les offres de ${jobTitle}`} <ArrowRight size={16} />
      </button>
      {signedIn && (
        <div className="ljs-body" aria-hidden={!open}>
          <div className="ljs-inner">
            <div className="ljs-form" role="search">
              <div className="ljs-field">
                <label className="ljs-input">
                  <MapPin size={16} aria-hidden="true" />
                  <input
                    ref={inputRef}
                    tabIndex={open ? 0 : -1}
                    value={picked ? picked.label : text}
                    onChange={(event) => { setPicked(null); setText(event.target.value); }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") { event.preventDefault(); if (suggestions[0] && !picked) setPicked(suggestions[0]); else launch(); }
                      if (event.key === "Escape") setOpen(false);
                    }}
                    placeholder="Dans quelle ville cherchez-vous ?"
                    aria-label="Ville de recherche"
                    aria-controls={listId}
                    autoComplete="off"
                  />
                  {(picked || text) && (
                    <button type="button" aria-label="Effacer la ville" onClick={() => { setPicked(null); setText(""); inputRef.current?.focus(); }}><X size={14} /></button>
                  )}
                </label>
                {suggestions.length > 0 && !picked && (
                  <ul className="ljs-list" id={listId} role="listbox">
                    {suggestions.map((item) => (
                      <li key={`${item.kind}:${item.code}`} role="option" aria-selected={false}>
                        <button type="button" onClick={() => { setPicked(item); setSuggestions([]); }}>{item.label}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="button" className="ljs-go" onClick={launch} disabled={!ready} tabIndex={open ? 0 : -1}>
                <Search size={16} /> Lancer la recherche
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
