import { Lock, X } from "lucide-react";

/**
 * Encart « débloquer » des lead magnets. Posé en tête de la zone floutée : au chargement il
 * se trouve juste sous l'en-tête, puis il se cale vers le milieu de l'écran pendant le défilement.
 * La croix de test n'existe que dans l'aperçu local (VITE_SALARY_PREVIEW_TOOLS).
 */
export function LeadUnlockOverlay({
  title,
  detail,
  onLinkedin,
  onEmail,
  onTestUnblur,
}: {
  title: string;
  detail: string;
  onLinkedin: () => void;
  onEmail?: () => void;
  onTestUnblur?: () => void;
}) {
  return (
    <div className="luo-overlay" id="lead-unlock">
      <style>{`
        .luo-overlay{position:sticky;top:calc(50vh - 200px);height:0;z-index:40;display:flex;justify-content:center;align-items:flex-start}
        .luo-card{position:relative;top:40px;width:min(460px,100%);display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;background:#fff;border:1px solid #dbe3d5;border-radius:20px;padding:24px 22px;box-shadow:0 22px 50px rgba(8,43,27,.18);font-family:Figtree,sans-serif}
        .luo-icon{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#e9f4e1;color:#2d9326}
        .luo-card strong{font-size:18px;color:#082b1b;line-height:1.3}
        .luo-card p{margin:0;font-size:13px;line-height:1.5;color:#5d6f60}
        .luo-main{margin-top:6px;width:100%;height:48px;border:0;border-radius:12px;background:#2d9326;color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 7px 16px rgba(45,147,38,.2)}
        .luo-alt{background:none;border:0;padding:4px;font:inherit;font-size:13px;color:#123d28;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
        .luo-close{position:absolute;top:-14px;right:-14px;width:34px;height:34px;border-radius:50%;border:1px solid #dbe3d5;background:#fff;color:#082b1b;display:grid;place-items:center;cursor:pointer;box-shadow:0 6px 14px rgba(8,43,27,.15)}
        .luo-main:focus-visible,.luo-alt:focus-visible,.luo-close:focus-visible{outline:3px solid #9fc792;outline-offset:2px}
        @media(max-width:520px){.luo-overlay{top:calc(50vh - 220px)}.luo-close{right:-6px}}
      `}</style>
      <div className="luo-card" role="group" aria-label="Débloquer le résultat complet">
        {onTestUnblur && (
          <button type="button" className="luo-close" onClick={onTestUnblur} aria-label="Retirer le flou (mode test)" title="Retirer le flou (mode test)">
            <X size={18} />
          </button>
        )}
        <span className="luo-icon" aria-hidden="true"><Lock size={18} /></span>
        <strong>{title}</strong>
        <p>{detail}</p>
        <button type="button" className="luo-main" onClick={onLinkedin} data-testid="lead-unlock-linkedin">Débloquer gratuitement avec LinkedIn</button>
        {onEmail && <button type="button" className="luo-alt" onClick={onEmail}>Ou créer un compte avec mon e-mail</button>}
      </div>
    </div>
  );
}
