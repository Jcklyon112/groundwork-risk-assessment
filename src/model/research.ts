// ─────────────────────────────────────────────────────────────────────────
// src/model/research.ts — the RESEARCHABLE (not fetchable) knowledge, encoded
// with citations and confidence. Two blocks:
//   1. ICPE rubriques for a 100 MW liquid-cooled DC (Step 4) — verified against
//      AIDA/Ineris + Légifrance + legal commentary (research pass 2026-06-07).
//   2. PLUi Rennes Métropole règlement rules for zone UI1/UI1j (Step 3) —
//      verified against the in-force règlement littéral (Modif. n°2, Juin 2025).
// Every item carries a source URL and a confidence tag. Nothing is fabricated;
// unresolved items are listed explicitly and never given a guessed value.
// ─────────────────────────────────────────────────────────────────────────
import type { Confidence } from './types'

export interface Rubrique {
  rubrique: string
  title: string
  regimeForProject: 'Autorisation' | 'Enregistrement' | 'Déclaration' | 'Non classé' | 'Unresolved'
  driver: boolean
  rationale: string
  source: string
  confidence: Confidence
}

export const ICPE_RESEARCHED_AT = '2026-06-08'

export const ICPE_RUBRIQUES: Rubrique[] = [
  {
    rubrique: '3110',
    title: 'Combustion ≥ 50 MW (IED) — backup diesel genset fleet',
    regimeForProject: 'Autorisation',
    driver: true,
    rationale:
      'A 100 MW IT load with N+1/2N redundancy implies a backup genset fleet whose puissance thermique nominale totale exceeds 50 MW → IED régime A. The classification mechanism: the nomenclature sums all combustion appareils "susceptibles de fonctionner simultanément" on the site. A DC fleet is sized to carry the full IT load during a grid outage, i.e. simultaneously — so it sums, and emergency/backup-only operation does NOT exempt it (DREAL doctrine; Morgan Lewis: gensets make the project subject to authorization under heading 3110). For a 100 MW IT load the genset thermal input (~2.5× electrical) is on the order of hundreds of MW ≫ 50, so the Autorisation line is cleared with margin; the residual unknown is the exact total (sets arrêté terms, not the A-vs-E boundary). Régime confirmed current by the arrêté du 30 janvier 2025 (intègre les BAT LCP-BREF, décision UE 2021/2326) modifying the 3110 arrêté du 3 août 2018.',
    source: 'https://aida.ineris.fr/thematiques/3110-combustion-combustibles-installations-dune-puissance-thermique-nominale-totale',
    confidence: 'high', // regime (Autorisation) verified 2026-06-08; only the exact genset total is open, and it cannot drop below 50 MW for a 100 MW DC
  },
  {
    rubrique: '2910',
    title: 'Combustion 1–50 MW',
    regimeForProject: 'Enregistrement',
    driver: false,
    rationale:
      'Fallback only: if (atypically) total genset thermal power stayed 20–<50 MW it would be Enregistrement; 1–<20 MW Déclaration. The realistic case for 100 MW is 3110-A, not 2910.',
    source: 'https://aida.ineris.fr/reglementation/2910-combustion-a-lexclusion-installations-visees-rubriques-2770-2771-2971-2931',
    confidence: 'high',
  },
  {
    rubrique: '4734',
    title: 'Diesel / fuel-oil storage for the gensets',
    regimeForProject: 'Déclaration',
    driver: false,
    rationale:
      'Bands: ≥1000 t → A; ≥500 t → E; ≥50 t → DC. Backup diesel for a 100 MW DC (day-tanks + reserve) is plausibly low-hundreds of tonnes → Déclaration, possibly Enregistrement if bulk reserve ≥500 t. Depends on the not-yet-fixed total diesel inventory.',
    source: 'https://aida.ineris.fr/reglementation/4734-produits-petroliers-specifiques-carburants-substitution-essences-naphtas',
    confidence: 'medium',
  },
  {
    rubrique: '2925',
    title: 'Battery charging (UPS / BESS, Li-ion)',
    regimeForProject: 'Déclaration',
    driver: false,
    rationale:
      'Li-ion charging power >600 kW → Déclaration (2925-2; 50 kW only if H₂-emitting). All UPS/BESS/charging on the site by one operator is cumulated. A 100 MW DC far exceeds 600 kW, but the régime caps at Déclaration — immaterial to the verdict. Watch: a lithium-specific nomenclature revision for 2925 was in consultation and is expected to land in 2026; it refines sub-bands but does not introduce an Autorisation tier that would let batteries gate.',
    source: 'https://aida.ineris.fr/reglementation/2925-ateliers-charge-daccumulateurs-electriques',
    confidence: 'high',
  },
  {
    rubrique: '1185',
    title: 'Fluorinated refrigerant gases (ex-4802)',
    regimeForProject: 'Déclaration',
    driver: false,
    rationale:
      'Heat-pump / chiller refrigerant charge ≥300 kg → Déclaration. Direct-to-chip loops use water/glycol (not ICPE refrigerant). There is NO autorisation/enregistrement régime under 1185, so refrigerant can never be the gating factor.',
    source: 'https://conseils.xpair.com/actualite_experts/fluides-frigorigenes-evolution-icpe1185.htm',
    confidence: 'high',
  },
]

export const ICPE_VERDICT = {
  track: 'Autorisation environnementale (the gating, slowest route)',
  driver: '3110 — Combustion ≥ 50 MW (IED), via the backup diesel genset fleet',
  timeline:
    'Autorisation environnementale for an IED combustion installation requires étude d’impact + enquête publique + avis MRAe. The loi Industrie Verte (in force Oct 2024) parallelised the procedure — ~17→9 months for COMPLETE dossiers; plan ~9–15 months from a complete file to arrêté préfectoral. Incomplete or contested files revert toward the old ~17+ months.',
  accelerant:
    'PINM status (Projet d’Intérêt National Majeur, 2025 loi de simplification, Art. 15) accelerates the procedural shell (state-led permis de construire, expedited grid, facilitated protected-species derogation) but does NOT waive the étude d’impact / enquête publique substance. Early DREAL pre-application + a complete dossier is the single biggest schedule lever.',
  note: 'No dedicated data-centre ICPE rubrique exists; a DC is classified via its support equipment (combustion, fuel, batteries, refrigerants).',
  source: 'https://www.morganlewis.com/pubs/2025/05/france-attracts-major-data-center-investment-a-legal-framework-overview',
}

// ── Land-use: PLUi Rennes Métropole zone UI1 / secteur UI1j ─────────────────
export const REGLEMENT_RESEARCHED_AT = '2026-06-07'

export interface ReglementRule {
  rule: string
  value: string
  cite: string
  confidence: Confidence
  graphic?: boolean // value deferred to the règlement graphique
}

export const PLUI = {
  partition: 'DU_243500139',
  document: '243500139_PLUi_20251218',
  zone: 'UI1j',
  zoneFamily: 'UI1 (zone d’activités — parcs d’activités industrielles)',
  typezone: 'U',
  reglementSource:
    'https://public.sig.rennesmetropole.fr/ressources/donnees/urbanisme/plui/envigueur/3_reglement/d01_rl.zip',
  portal: 'https://logement.metropole.rennes.fr/documents-du-plui/',
  viewer: 'https://mviewer.sig.rennesmetropole.fr/plui',
}

export const REGLEMENT_RULES: ReglementRule[] = [
  { rule: 'Hauteur maximale', value: 'No literal cap — set by graphic label "H"; transition gabarit 3.5 m + 45° at limits with another zone', cite: 'ZONE UI1 §3.1 (p.180); typepsc 39', confidence: 'high', graphic: true },
  { rule: 'Emprise au sol', value: 'Not regulated by the literal règlement for industrie in UI1; graphic plan de masse/détail prevails if set', cite: 'ZONE UI1 §4 (p.181); Titre IV §3 (p.103)', confidence: 'high', graphic: true },
  { rule: 'Implantation vs voies', value: 'Libre (need-based); storage organised to limit visual impact from roads', cite: 'ZONE UI1 §2.1.1 (p.180)', confidence: 'high' },
  { rule: 'Implantation vs limites séparatives', value: 'Libre, subject to 3.5 m + 45° gabarit at limits with another zone', cite: 'ZONE UI1 §2.2.1 (p.180)', confidence: 'high' },
  { rule: 'Stationnement', value: 'Need-based for Industrie/Entrepôt via plan thématique (Chartres-de-Bretagne = Secteur 5); space min 5.00 × 2.30 m', cite: 'Titre IV §7.1 (pp.119–123); typepsc 44', confidence: 'high', graphic: true },
  { rule: 'Espaces verts', value: '1 tree / 200 m² pleine terre; aerial parking 1 tree / 4 spaces; removal compensated 2-for-1', cite: 'Titre IV §6.1.1.4 a) (pp.111–112)', confidence: 'high' },
  { rule: 'Coefficient de végétalisation (biotope)', value: 'Applies where the graphic plan sets a minimum — site IS covered (typepsc 42); value V%/PT% read off the plan', cite: 'Titre IV §6.1.1.4/§6.1.1.5 (pp.112–113)', confidence: 'high', graphic: true },
]

export const LANDUSE_UNRESOLVED = [
  'Règlement graphique read at the parcel (Rennes plans thématiques): height and végétalisation défer to the règlement littéral (UI1 permissive); parking secteur S4. The binding numbers now follow the literal rule, not a graphic cap — resolved.',
  'OAP sectorielle covers the site (confirmed via the végétalisation plan étiquette) — opposable; retrieve and comply with its content.',
  'ZAC + Plan d’Exposition au Bruit (PEB aérodrome) overlays touch the site — confirm constructibility limits.',
]
