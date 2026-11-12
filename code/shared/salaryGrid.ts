/**
 * Grille salariale du lead magnet « Quel salaire puis-je prétendre ? ».
 *
 * Unité : k€ brut annuel, CDI, salaire FIXE (hors variable, primes, intéressement).
 * Base : moyenne des régions françaises hors Île-de-France. Le coefficient régional
 * (SALARY_REGIONS) s'applique ensuite.
 *
 * Origine des chiffres (v1, à recaler avant mise en ligne) :
 *  - métiers industriels, techniques et support : grille Alteris TT 2.1 (CCN Métallurgie
 *    2026, baromètres Hays / Michael Page / Page Personnel 2026, SMIC 2026), relevée de
 *    Franche-Comté à la moyenne des régions (+4 %) ;
 *  - métiers tertiaires, tech et cadres : repères Rebond (`SALARY_BENCHMARKS`) déclinés
 *    par niveau d'expérience.
 * Prochaine étape : comparer chaque ligne aux salaires affichés dans les offres
 * d'emploi Rebond (`global_job_pool`) et corriger les écarts.
 */

export const SALARY_GRID_VERSION = "rebond-1.0-2026";

export type SalaryTier = "execution" | "technicien" | "cadre" | "manager" | "direction" | "c_level";
export type SalaryLevel = "junior" | "confirme" | "senior" | "expert";
export type SalaryBand = { min: number; max: number };

export interface SalaryMetier {
  label: string;
  family: string;
  /** Niveau de poste minimum que le parcours doit prouver pour être payé sur cette ligne. */
  tierMin: SalaryTier;
  levels: Partial<Record<SalaryLevel, SalaryBand>>;
  /** Métier où les primes (équipe, nuit, astreinte, dimanche) pèsent lourd. */
  frequentBonuses?: boolean;
}

const b = (min: number, max: number): SalaryBand => ({ min, max });

export const SALARY_METIERS: Record<string, SalaryMetier> = {
  // ── Tech et data ───────────────────────────────────────────────────────────
  developpeur: { label: "Développeur / Ingénieur logiciel", family: "Tech et data", tierMin: "cadre",
    levels: { junior: b(33, 39), confirme: b(39, 48), senior: b(47, 58), expert: b(54, 68) } },
  devops_cloud: { label: "Ingénieur DevOps / Cloud / SRE", family: "Tech et data", tierMin: "cadre",
    levels: { junior: b(37, 44), confirme: b(44, 55), senior: b(53, 66), expert: b(61, 76) } },
  data_scientist: { label: "Data scientist / Ingénieur IA", family: "Tech et data", tierMin: "cadre",
    levels: { junior: b(37, 44), confirme: b(44, 54), senior: b(52, 65), expert: b(60, 76) } },
  data_engineer: { label: "Data engineer", family: "Tech et data", tierMin: "cadre",
    levels: { junior: b(37, 44), confirme: b(44, 55), senior: b(53, 66), expert: b(61, 76) } },
  data_analyst: { label: "Data analyst / Analyste BI", family: "Tech et data", tierMin: "cadre",
    levels: { junior: b(32, 38), confirme: b(37, 45), senior: b(44, 54), expert: b(51, 63) } },
  cybersecurite: { label: "Ingénieur cybersécurité", family: "Tech et data", tierMin: "cadre",
    levels: { junior: b(38, 45), confirme: b(45, 56), senior: b(54, 68), expert: b(63, 82) } },
  architecte_si: { label: "Architecte logiciel / SI / solutions", family: "Tech et data", tierMin: "cadre",
    levels: { confirme: b(50, 60), senior: b(58, 73), expert: b(68, 88) } },
  chef_projet_it: { label: "Chef de projet informatique / digital", family: "Tech et data", tierMin: "cadre",
    levels: { junior: b(35, 41), confirme: b(41, 51), senior: b(49, 61), expert: b(57, 71) } },
  product_manager: { label: "Product manager", family: "Tech et data", tierMin: "cadre",
    levels: { junior: b(37, 44), confirme: b(44, 55), senior: b(53, 67), expert: b(61, 78) } },
  product_owner: { label: "Product owner", family: "Tech et data", tierMin: "cadre",
    levels: { junior: b(35, 41), confirme: b(41, 49), senior: b(47, 58), expert: b(54, 66) } },
  ux_ui_designer: { label: "UX / UI designer", family: "Tech et data", tierMin: "technicien",
    levels: { junior: b(30, 36), confirme: b(35, 43), senior: b(41, 51), expert: b(47, 59) } },
  technicien_informatique: { label: "Technicien informatique / support", family: "Tech et data", tierMin: "technicien",
    levels: { junior: b(26, 30), confirme: b(30, 35), senior: b(34, 41), expert: b(38, 47) } },
  ingenieur_embarque: { label: "Ingénieur systèmes embarqués / électronique", family: "Tech et data", tierMin: "cadre",
    levels: { junior: b(34, 43), confirme: b(43, 53), senior: b(52, 66), expert: b(59, 75) } },
  directeur_technique: { label: "Directeur technique / DSI / CTO", family: "Tech et data", tierMin: "direction",
    levels: { confirme: b(56, 72), senior: b(70, 90), expert: b(84, 112) } },

  // ── Commerce et marketing ──────────────────────────────────────────────────
  commercial_b2b: { label: "Commercial B2B / Business developer", family: "Commerce et marketing", tierMin: "technicien",
    levels: { junior: b(29, 35), confirme: b(34, 43), senior: b(41, 53), expert: b(49, 63) } },
  key_account_manager: { label: "Key account manager / Responsable grands comptes", family: "Commerce et marketing", tierMin: "cadre",
    levels: { junior: b(35, 41), confirme: b(41, 51), senior: b(49, 61), expert: b(57, 71) } },
  technico_commercial: { label: "Technico-commercial B2B", family: "Commerce et marketing", tierMin: "cadre",
    levels: { junior: b(27, 33), confirme: b(33, 44), senior: b(42, 54), expert: b(50, 64) } },
  customer_success: { label: "Customer success / Chargé de clientèle", family: "Commerce et marketing", tierMin: "technicien",
    levels: { junior: b(27, 32), confirme: b(31, 38), senior: b(37, 45), expert: b(42, 52) } },
  vendeur_conseiller: { label: "Vendeur / Conseiller de vente / Assistant commercial", family: "Commerce et marketing", tierMin: "execution",
    levels: { junior: b(23, 26), confirme: b(25, 29), senior: b(28, 33), expert: b(31, 36) } },
  responsable_magasin: { label: "Responsable de magasin / Manager retail", family: "Commerce et marketing", tierMin: "manager",
    levels: { junior: b(28, 33), confirme: b(32, 39), senior: b(37, 46), expert: b(43, 54) } },
  marketing_digital: { label: "Chargé de marketing / Marketing digital / Growth", family: "Commerce et marketing", tierMin: "technicien",
    levels: { junior: b(30, 35), confirme: b(34, 42), senior: b(40, 50), expert: b(46, 58) } },
  chef_de_produit: { label: "Chef de produit / Brand manager", family: "Commerce et marketing", tierMin: "cadre",
    levels: { junior: b(35, 41), confirme: b(41, 51), senior: b(49, 61), expert: b(57, 71) } },
  communication: { label: "Chargé de communication", family: "Commerce et marketing", tierMin: "technicien",
    levels: { junior: b(28, 33), confirme: b(32, 39), senior: b(38, 46), expert: b(43, 54) } },
  responsable_marketing: { label: "Responsable marketing / communication", family: "Commerce et marketing", tierMin: "manager",
    levels: { confirme: b(42, 52), senior: b(50, 63), expert: b(58, 75) } },
  directeur_commercial: { label: "Directeur commercial / marketing", family: "Commerce et marketing", tierMin: "direction",
    levels: { confirme: b(52, 68), senior: b(64, 85), expert: b(78, 104) } },

  // ── Finance, gestion, juridique ────────────────────────────────────────────
  comptable_paie: { label: "Comptable / Gestionnaire de paie", family: "Finance, gestion, juridique", tierMin: "technicien",
    levels: { junior: b(25, 29), confirme: b(29, 35), senior: b(34, 42), expert: b(40, 48) } },
  responsable_comptable: { label: "Responsable comptable", family: "Finance, gestion, juridique", tierMin: "manager",
    levels: { confirme: b(38, 47), senior: b(44, 57), expert: b(52, 65) } },
  controleur_gestion: { label: "Contrôleur de gestion", family: "Finance, gestion, juridique", tierMin: "cadre",
    levels: { junior: b(35, 41), confirme: b(41, 50), senior: b(48, 60), expert: b(56, 70) } },
  auditeur_finance: { label: "Auditeur / Analyste financier", family: "Finance, gestion, juridique", tierMin: "cadre",
    levels: { junior: b(36, 42), confirme: b(42, 51), senior: b(50, 62), expert: b(58, 75) } },
  daf_raf: { label: "DAF / Responsable administratif et financier", family: "Finance, gestion, juridique", tierMin: "direction",
    levels: { confirme: b(48, 63), senior: b(58, 78), expert: b(71, 94) } },
  juriste: { label: "Juriste", family: "Finance, gestion, juridique", tierMin: "cadre",
    levels: { junior: b(33, 40), confirme: b(40, 50), senior: b(48, 62), expert: b(58, 75) } },
  assistante_administrative: { label: "Assistant(e) de direction / administratif(ve)", family: "Finance, gestion, juridique", tierMin: "technicien",
    levels: { junior: b(24, 27), confirme: b(26, 30), senior: b(29, 34), expert: b(32, 38) } },

  // ── Ressources humaines ────────────────────────────────────────────────────
  charge_rh: { label: "Chargé RH / Chargé de recrutement", family: "Ressources humaines", tierMin: "technicien",
    levels: { junior: b(30, 35), confirme: b(34, 41), senior: b(40, 48), expert: b(45, 55) } },
  responsable_rh: { label: "Responsable RH / RRH", family: "Ressources humaines", tierMin: "manager",
    levels: { junior: b(35, 41), confirme: b(40, 50), senior: b(48, 62), expert: b(57, 76) } },
  drh: { label: "DRH / Directeur des ressources humaines", family: "Ressources humaines", tierMin: "direction",
    levels: { confirme: b(58, 74), senior: b(70, 90), expert: b(84, 112) } },
  formateur: { label: "Formateur / Conseiller formation", family: "Ressources humaines", tierMin: "technicien",
    levels: { junior: b(28, 35), confirme: b(32, 44), senior: b(37, 50), expert: b(43, 55) } },

  // ── Conseil et gestion de projet ──────────────────────────────────────────
  consultant: { label: "Consultant", family: "Conseil et projet", tierMin: "cadre",
    levels: { junior: b(36, 42), confirme: b(42, 52), senior: b(50, 65), expert: b(60, 80) } },
  chef_projet: { label: "Chef de projet / PMO", family: "Conseil et projet", tierMin: "cadre",
    levels: { junior: b(33, 40), confirme: b(40, 51), senior: b(48, 63), expert: b(56, 74) } },
  charge_affaires: { label: "Chargé d'affaires", family: "Conseil et projet", tierMin: "cadre",
    levels: { junior: b(30, 37), confirme: b(36, 47), senior: b(44, 60), expert: b(50, 69) } },

  // ── Industrie, qualité, maintenance ───────────────────────────────────────
  ingenieur_methodes: { label: "Ingénieur méthodes / industrialisation", family: "Industrie", tierMin: "cadre",
    levels: { junior: b(32, 40), confirme: b(40, 49), senior: b(49, 60), expert: b(56, 69) } },
  ingenieur_qhse: { label: "Ingénieur qualité / QHSE", family: "Industrie", tierMin: "cadre",
    levels: { junior: b(33, 40), confirme: b(40, 50), senior: b(49, 61), expert: b(56, 70) } },
  ingenieur_production: { label: "Ingénieur / Responsable de production", family: "Industrie", tierMin: "cadre",
    levels: { junior: b(34, 42), confirme: b(42, 52), senior: b(52, 66), expert: b(60, 75) } },
  ingenieur_rd: { label: "Ingénieur R&D / conception mécanique", family: "Industrie", tierMin: "cadre",
    levels: { junior: b(33, 41), confirme: b(41, 51), senior: b(50, 62), expert: b(57, 73) } },
  ingenieur_automatisme: { label: "Ingénieur automatisme / électrotechnique", family: "Industrie", tierMin: "cadre",
    levels: { junior: b(32, 41), confirme: b(38, 52), senior: b(47, 64), expert: b(54, 73) } },
  responsable_maintenance: { label: "Responsable maintenance", family: "Industrie", tierMin: "cadre",
    levels: { junior: b(34, 42), confirme: b(42, 51), senior: b(50, 64), expert: b(57, 73) } },
  responsable_achats: { label: "Acheteur / Responsable achats", family: "Industrie", tierMin: "cadre",
    levels: { junior: b(32, 40), confirme: b(40, 51), senior: b(49, 64), expert: b(58, 78) } },
  supply_chain: { label: "Supply chain / Logistique (cadre)", family: "Industrie", tierMin: "cadre",
    levels: { junior: b(30, 36), confirme: b(36, 47), senior: b(45, 58), expert: b(54, 71) } },
  directeur_supply_chain: { label: "Directeur supply chain / logistique", family: "Industrie", tierMin: "direction",
    levels: { confirme: b(47, 60), senior: b(57, 75), expert: b(71, 92) } },
  directeur_usine: { label: "Directeur d'usine / de site", family: "Industrie", tierMin: "direction",
    levels: { confirme: b(57, 75), senior: b(71, 94), expert: b(85, 114) } },
  responsable_atelier: { label: "Responsable d'atelier / Superviseur", family: "Industrie", tierMin: "manager",
    levels: { junior: b(30, 37), confirme: b(35, 46), senior: b(42, 56), expert: b(48, 62) }, frequentBonuses: true },
  chef_equipe_production: { label: "Chef d'équipe production", family: "Industrie", tierMin: "technicien",
    levels: { junior: b(28, 34), confirme: b(33, 41), senior: b(38, 47), expert: b(43, 52) }, frequentBonuses: true },
  technicien_maintenance: { label: "Technicien de maintenance / SAV", family: "Industrie", tierMin: "technicien",
    levels: { junior: b(26, 30), confirme: b(30, 37), senior: b(35, 45), expert: b(42, 50) }, frequentBonuses: true },
  technicien_qualite: { label: "Technicien qualité / HSE / Contrôleur", family: "Industrie", tierMin: "technicien",
    levels: { junior: b(25, 30), confirme: b(29, 36), senior: b(34, 42), expert: b(39, 48) } },
  technicien_methodes: { label: "Technicien méthodes / Dessinateur-projeteur", family: "Industrie", tierMin: "technicien",
    levels: { junior: b(26, 31), confirme: b(31, 38), senior: b(36, 45), expert: b(41, 50) } },
  automaticien: { label: "Automaticien / Électricien industriel", family: "Industrie", tierMin: "technicien",
    levels: { junior: b(28, 34), confirme: b(33, 43), senior: b(40, 51), expert: b(45, 58) }, frequentBonuses: true },
  operateur_production: { label: "Opérateur de production / Ouvrier qualifié", family: "Industrie", tierMin: "execution",
    levels: { junior: b(23, 26), confirme: b(25, 30), senior: b(28, 34), expert: b(31, 37) }, frequentBonuses: true },
  usineur_soudeur: { label: "Usineur / Soudeur / Chaudronnier", family: "Industrie", tierMin: "execution",
    levels: { junior: b(25, 29), confirme: b(29, 36), senior: b(34, 43), expert: b(38, 47) }, frequentBonuses: true },

  // ── Logistique et transport ───────────────────────────────────────────────
  logistique_exploitation: { label: "Technicien logistique / Exploitant transport", family: "Logistique et transport", tierMin: "execution",
    levels: { junior: b(24, 28), confirme: b(28, 34), senior: b(33, 41), expert: b(37, 47) } },
  magasinier_cariste: { label: "Magasinier / Cariste / Préparateur de commandes", family: "Logistique et transport", tierMin: "execution",
    levels: { junior: b(23, 26), confirme: b(25, 28), senior: b(27, 31), expert: b(29, 34) }, frequentBonuses: true },
  chauffeur_livreur: { label: "Chauffeur livreur / Conducteur routier", family: "Logistique et transport", tierMin: "execution",
    levels: { junior: b(23, 27), confirme: b(26, 29), senior: b(28, 32), expert: b(30, 35) }, frequentBonuses: true },

  // ── Bâtiment et travaux publics ───────────────────────────────────────────
  conducteur_travaux: { label: "Conducteur de travaux", family: "BTP", tierMin: "technicien",
    levels: { junior: b(31, 38), confirme: b(37, 49), senior: b(46, 58), expert: b(53, 68) } },
  ingenieur_btp: { label: "Ingénieur travaux / études BTP", family: "BTP", tierMin: "cadre",
    levels: { junior: b(35, 41), confirme: b(41, 51), senior: b(49, 62), expert: b(57, 71) } },
  architecte_batiment: { label: "Architecte (bâtiment)", family: "BTP", tierMin: "cadre",
    levels: { junior: b(30, 36), confirme: b(35, 44), senior: b(42, 54), expert: b(49, 64) } },

  // ── Santé, social, éducation ──────────────────────────────────────────────
  infirmier: { label: "Infirmier(ère)", family: "Santé et social", tierMin: "technicien",
    levels: { junior: b(29, 33), confirme: b(33, 38), senior: b(37, 44), expert: b(42, 49) }, frequentBonuses: true },
  aide_soignant: { label: "Aide-soignant(e) / Auxiliaire", family: "Santé et social", tierMin: "execution",
    levels: { junior: b(23, 25), confirme: b(24, 27), senior: b(26, 29), expert: b(28, 31) }, frequentBonuses: true },
  secretaire_medicale: { label: "Secrétaire / Assistant(e) médical(e)", family: "Santé et social", tierMin: "technicien",
    levels: { junior: b(23, 26), confirme: b(25, 28), senior: b(27, 31), expert: b(29, 34) } },
  pharmacien: { label: "Pharmacien", family: "Santé et social", tierMin: "cadre",
    levels: { junior: b(42, 48), confirme: b(46, 54), senior: b(52, 62), expert: b(58, 70) } },
  travailleur_social: { label: "Éducateur / Travailleur social", family: "Santé et social", tierMin: "technicien",
    levels: { junior: b(24, 27), confirme: b(26, 30), senior: b(29, 33), expert: b(32, 37) } },

  // ── Hôtellerie et restauration ────────────────────────────────────────────
  employe_restauration: { label: "Cuisinier / Serveur / Employé d'hôtellerie", family: "Hôtellerie et restauration", tierMin: "execution",
    levels: { junior: b(23, 25), confirme: b(24, 27), senior: b(26, 30), expert: b(28, 33) }, frequentBonuses: true },
  responsable_restauration: { label: "Responsable de restaurant / d'hôtel", family: "Hôtellerie et restauration", tierMin: "manager",
    levels: { junior: b(29, 35), confirme: b(34, 41), senior: b(39, 49), expert: b(45, 57) } },

  // ── Direction générale ────────────────────────────────────────────────────
  direction_generale: { label: "Directeur général / Dirigeant", family: "Direction générale", tierMin: "c_level",
    levels: { confirme: b(57, 78), senior: b(73, 99), expert: b(88, 125) } },
};

export type SalaryMetierKey = keyof typeof SALARY_METIERS;

/**
 * Sans métier identifiable : fourchette prudente selon le seul niveau de poste prouvé
 * (grille Alteris de repli, relevée de 4 %). Mieux vaut sous-estimer que promettre.
 */
export const SALARY_FALLBACK: Record<SalaryTier, Record<SalaryLevel, SalaryBand>> = {
  execution:  { junior: b(23, 26), confirme: b(25, 29), senior: b(28, 32), expert: b(30, 35) },
  technicien: { junior: b(26, 30), confirme: b(29, 35), senior: b(34, 42), expert: b(40, 48) },
  cadre:      { junior: b(31, 38), confirme: b(37, 48), senior: b(46, 58), expert: b(54, 69) },
  manager:    { junior: b(33, 42), confirme: b(42, 52), senior: b(50, 64), expert: b(58, 75) },
  direction:  { junior: b(47, 60), confirme: b(52, 68), senior: b(64, 85), expert: b(78, 104) },
  c_level:    { junior: b(52, 68), confirme: b(57, 78), senior: b(73, 99), expert: b(88, 125) },
};

export type SalaryRegionKey = "idf" | "metropole" | "region";

export const SALARY_REGIONS: Record<SalaryRegionKey, { label: string; inLabel: string; coefficient: number }> = {
  idf: { label: "Île-de-France", inLabel: "en Île-de-France", coefficient: 1.15 },
  metropole: { label: "Grande métropole", inLabel: "dans une grande métropole régionale", coefficient: 1.05 },
  region: { label: "Région", inLabel: "en région", coefficient: 1 },
};

/** Métropoles où les salaires cadres dépassent nettement la moyenne régionale. */
const METROPOLES = /\b(lyon|villeurbanne|toulouse|bordeaux|nantes|lille|marseille|aix[- ]en[- ]provence|nice|sophia[- ]antipolis|grenoble|strasbourg|rennes|montpellier)\b/;

function normalizePlace(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function salaryRegionOf(location: string | null | undefined): SalaryRegionKey {
  const place = normalizePlace(location ?? "");
  if (!place.trim()) return "region";
  if (/ile[- ]de[- ]france|grand paris|\bparis\b|la defense|\b(?:75|77|78|91|92|93|94|95)\d{3}\b|boulogne[- ]billancourt|issy[- ]les[- ]moulineaux|neuilly|levallois|saint[- ]denis|nanterre|versailles|courbevoie|puteaux|massy|saclay/.test(place)) return "idf";
  if (METROPOLES.test(place)) return "metropole";
  return "region";
}

export const SALARY_LEVEL_LABELS: Record<SalaryLevel, string> = {
  junior: "Junior",
  confirme: "Confirmé",
  senior: "Senior",
  expert: "Expert",
};

export const SALARY_TIER_LABELS: Record<SalaryTier, string> = {
  execution: "Employé / opérateur",
  technicien: "Technicien / employé qualifié",
  cadre: "Cadre / ingénieur",
  manager: "Manager / responsable d'équipe",
  direction: "Direction",
  c_level: "Direction générale",
};
