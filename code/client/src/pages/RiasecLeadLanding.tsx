import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import SEO from "@/components/SEO";
import MarketingNavbar from "@/components/MarketingNavbar";
import { MarketingPageHero } from "@/components/MarketingPageHero";
import MarketingFooter from "@/components/MarketingFooter";
import { RiasecHexagon } from "@/components/RiasecHexagon";
import { capture } from "@/lib/posthog";
import { RIASEC_DIMENSIONS, RIASEC_ORDER } from "@shared/riasec";
import {
  RIASEC_TEST_CANONICAL,
  RIASEC_TEST_DESCRIPTION,
  RIASEC_TEST_FAQ_SCHEMA,
  RIASEC_TEST_FAQS,
  RIASEC_TEST_TITLE,
  RIASEC_TEST_WEB_APPLICATION_SCHEMA,
} from "@shared/riasecTestSeo";
import { readRiasecProgress, RIASEC_LEAD_QUIZ_PATH } from "@/lib/riasecLeadJourney";

type Props = { onOpenLogin?: () => void; onOpenRegister?: () => void };

/** Profil d'exemple affiché sur la landing (code SEC). */
const EXAMPLE = { realistic: 34, investigative: 52, artistic: 41, social: 86, enterprising: 71, conventional: 64 };

const GAINS = [
  "Votre code à 3 lettres, et ce qu'il dit de votre façon de travailler",
  "8 métiers expliqués, avec les offres qui recrutent sur Rebond",
  "Les environnements où vous serez bien, et ceux à éviter",
  "Vos points forts et les mots-clés à mettre dans votre CV",
  "Ce qui vous épuise au travail, pour ne plus vous tromper de poste",
];

export default function RiasecLeadLanding({ onOpenLogin, onOpenRegister }: Props) {
  const [, setLocation] = useLocation();
  const progress = readRiasecProgress();
  const resumable = progress && Object.keys(progress.answers).length > 0;

  useEffect(() => { capture("riasec_lead_viewed", { resumable: Boolean(resumable) }); }, []);

  const start = () => {
    capture("riasec_lead_started", { resumed: Boolean(resumable) });
    setLocation(RIASEC_LEAD_QUIZ_PATH);
  };

  return (
    <div className="rll-page">
      <SEO
        title={RIASEC_TEST_TITLE}
        description={RIASEC_TEST_DESCRIPTION}
        canonical={RIASEC_TEST_CANONICAL}
        schema={[RIASEC_TEST_FAQ_SCHEMA, RIASEC_TEST_WEB_APPLICATION_SCHEMA]}
        suppressKeywords
        languageOverride="fr"
        omitOgLocaleAlternate
      />
      <style>{`
        .rll-page{--ink:#123d28;--deep:#082b1b;--green:#2d9326;--paper:#fbf8f1;--line:#dbe3d5;background:var(--paper);color:var(--ink);min-height:100dvh;font-family:Figtree,sans-serif}
        .rll-page *{box-sizing:border-box}
        .rll-checks{display:flex;flex-wrap:wrap;gap:6px 20px;margin-top:12px;font-size:15px;font-weight:600;color:#fff}
        .rll-checks span{display:inline-flex;align-items:center;gap:7px}.rll-checks svg{color:#9be07a}
        .rll-card{grid-area:card;position:relative;width:100%;max-width:560px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:26px;padding:26px 26px 30px;text-align:center;box-shadow:0 24px 60px rgba(8,43,27,.16)}
        .rll-card svg{display:block;margin:0 auto}
        .rll-code{display:flex;justify-content:center;gap:10px;margin:2px 0 0}
        .rll-code span{width:54px;height:62px;display:grid;place-items:center;border-radius:14px;background:var(--deep);color:#fff;font-size:32px;font-weight:700;animation:rll-pop .5s cubic-bezier(.2,.8,.2,1) both}
        .rll-code span:nth-child(2){animation-delay:.5s}.rll-code span:nth-child(3){animation-delay:.8s}
        @keyframes rll-pop{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
        .rll-code--blur span{color:transparent;text-shadow:0 0 12px rgba(255,255,255,.95);user-select:none}
        .rll-card-caption{margin:8px 0 0;font-size:14px;color:#526a59}
        .rll-cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;margin:0;height:60px;border:0;border-radius:16px;background:var(--green);color:#fff;font:inherit;font-size:19px;font-weight:700;cursor:pointer;box-shadow:0 10px 24px rgba(45,147,38,.28);transition:transform .15s}
        .rll-cta:hover{transform:translateY(-2px)}
        .rll-main{max-width:1120px;margin:0 auto;padding:0 24px 100px}
        .rll-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-areas:"gain card" "start card";grid-template-rows:auto 1fr;gap:28px 48px;margin-top:40px;align-items:start}
        .rll-gain{grid-area:gain;padding-top:8px}
        .rll-gain h2{margin:0 0 20px;font-size:clamp(26px,3vw,34px);line-height:1.1;letter-spacing:-.04em;color:var(--deep)}
        .rll-gain ul{list-style:none;margin:0;padding:0;display:grid;gap:0;border-top:1px solid var(--line)}
        .rll-gain li{display:grid;grid-template-columns:22px 1fr;gap:12px;padding:15px 0;border-bottom:1px solid var(--line);font-size:17px;line-height:1.45;color:var(--ink)}
        .rll-gain li svg{margin-top:2px;color:var(--green)}
        .rll-start{grid-area:start}
        .rll-start p{margin:12px 0 0;font-size:14px;color:#526a59}
        .rll-section{max-width:900px;padding-top:90px;text-align:left}
        .rll-section h2{font-size:clamp(28px,3.6vw,40px);line-height:1.08;letter-spacing:-.045em;margin:0 0 26px;color:var(--deep)}
        .rll-types{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 44px}
        .rll-types div{display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:start}
        .rll-types b{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#e3f2d8;color:var(--deep);font-size:20px}
        .rll-types strong{display:block;font-size:17px;color:var(--deep);margin-bottom:4px}
        .rll-types p{margin:0;font-size:15px;line-height:1.55;color:#5d6f60}
        .rll-faq{border-top:1px solid var(--line)}
        .rll-faq article{padding:20px 0;border-bottom:1px solid var(--line)}
        .rll-faq h3{margin:0 0 8px;font-size:17px}.rll-faq p{margin:0;line-height:1.65;color:#5d6f60}
        .rll-link{color:var(--ink);text-decoration:underline;text-underline-offset:3px;display:inline-flex;align-items:center;gap:6px;font-size:15px}
        @media(max-width:900px){.rll-hero{grid-template-columns:1fr;grid-template-areas:"card" "start" "gain";grid-template-rows:auto;gap:26px}.rll-start{max-width:560px;width:100%;margin:0 auto;text-align:center}.rll-gain{padding-top:24px}}
        @media(max-width:700px){.rll-types{grid-template-columns:1fr}.rll-section{padding-top:64px}}
        @media(max-width:520px){.rll-main{padding:0 16px 60px}.rll-card{padding:18px 14px 22px}.rll-code span{width:46px;height:54px;font-size:28px}}
        @media(prefers-reduced-motion:reduce){.rll-code span{animation:none}.rll-cta{transition:none}}
      `}</style>

      <MarketingNavbar onOpenRegister={onOpenRegister} onOpenLogin={onOpenLogin} />
      <MarketingPageHero
        maxWidth={1120}
        dense
        title="Test RIASEC : trouvez les métiers qui sont faits pour vous"
        titleTestId="title-riasec"
        subtitle={<>
          Le test d'orientation de référence : votre code à 3 lettres et les postes où vous serez bien.
          <span className="rll-checks">
            {["10 minutes", "48 questions", "Gratuit"].map((fact) => <span key={fact}><Check size={16} aria-hidden="true" />{fact}</span>)}
          </span>
        </>}
      />

      <main id="main-content" className="rll-main">
        <div className="rll-hero">
          <section className="rll-gain" aria-labelledby="rll-gain-title">
            <h2 id="rll-gain-title">Ce que vous saurez dans 10 minutes</h2>
            <ul>
              {GAINS.map((gain) => <li key={gain}><Check size={18} aria-hidden="true" />{gain}</li>)}
            </ul>
          </section>

          <section className="rll-card" aria-label="Exemple de résultat">
            <RiasecHexagon scores={EXAMPLE} animate size={300} />
            <div className="rll-code rll-code--blur" aria-label="Votre code à 3 lettres, révélé à la fin du test"><span aria-hidden="true">S</span><span aria-hidden="true">E</span><span aria-hidden="true">C</span></div>
            <p className="rll-card-caption">Votre code à 3 lettres s'affiche ici à la fin du test.</p>
          </section>

          <div className="rll-start">
            <button type="button" className="rll-cta" onClick={start} data-testid="riasec-start">
              {resumable ? `Reprendre le test (${Object.keys(progress!.answers).length}/48)` : "Commencer le test"} <ArrowRight size={20} />
            </button>
            <p>Vous découvrez votre profil dès la dernière question. Créez ensuite votre compte pour débloquer vos métiers et vos scores détaillés.</p>
          </div>
        </div>

        <section className="rll-section" aria-labelledby="rll-types-title">
          <h2 id="rll-types-title">Les 6 profils RIASEC : lequel est le vôtre ?</h2>
          <div className="rll-types">
            {RIASEC_ORDER.map((dim) => (
              <div key={dim}>
                <b aria-hidden="true">{RIASEC_DIMENSIONS[dim].letter}</b>
                <span><strong>{RIASEC_DIMENSIONS[dim].label}</strong><p>{RIASEC_DIMENSIONS[dim].drive}</p></span>
              </div>
            ))}
          </div>
        </section>

        <section className="rll-section" aria-labelledby="rll-faq-title">
          <h2 id="rll-faq-title">Questions fréquentes sur le test RIASEC</h2>
          <div className="rll-faq">
            {RIASEC_TEST_FAQS.map(({ question, answer }) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}
          </div>
          <p style={{ marginTop: 28 }}><Link className="rll-link" href="/estimation-salaire">Estimer aussi mon salaire <ArrowRight size={14} /></Link></p>
        </section>
      </main>
      <MarketingFooter onOpenRegister={onOpenRegister} />
    </div>
  );
}
