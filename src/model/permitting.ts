// ─────────────────────────────────────────────────────────────────────────
// src/model/permitting.ts — the permitting PATHWAY template and per-gate
// action lists. Encodes the PROCEDURE only (steps / order / authority /
// triggers) — never an outcome (HARD RULE 2). The bottleneck is COMPUTED in
// evaluate.ts as the earliest step gated by a non-cleared gating gate.
// ─────────────────────────────────────────────────────────────────────────

export interface PathwayTemplateStep {
  id: string
  label: string
  authority: string
  gates: string[]
  note: string
  /**
   * precursor = an action the project itself controls or has already resolved
   * (site assembly, classification, producing studies) — not the binding
   * external decision. The COMPUTED bottleneck is the earliest NON-precursor
   * step gated by a non-cleared gating gate (here: autorisation environnementale).
   */
  precursor?: boolean
}

/**
 * Site control → ICPE classification → Étude d'impact → Autorisation
 * environnementale → Enquête publique → Avis AE → Arrêté préfectoral →
 * Permis de construire → Build. (CLAUDE.md)
 */
export const PATHWAY_TEMPLATE: PathwayTemplateStep[] = [
  {
    id: 'site-control',
    label: 'Site control (land assembly)',
    authority: 'Rennes Métropole (development agency)',
    gates: ['land-use', 'brownfield'],
    precursor: true,
    note: 'ZAC du secteur de La Janais exists (confirmed via GPU info-surf); ~a third of the 100 ha publicly acquired (Région + Département + Rennes Métropole). DC end-use is not secured — Rennes Métropole currently steers the site to other uses.',
  },
  {
    id: 'icpe-classification',
    label: 'ICPE classification',
    authority: 'DREAL Bretagne',
    gates: ['env-auth'],
    precursor: true,
    note: 'Régime determined by research: rubrique 3110 (Combustion ≥ 50 MW, IED) → Autorisation. Classification established; the dossier remains to be produced. To be confirmed with DREAL on final genset sizing.',
  },
  {
    id: 'etude-impact',
    label: 'Environmental impact assessment',
    authority: 'Developer + engineering consultancy',
    gates: ['env-auth', 'water', 'brownfield'],
    precursor: true,
    note: 'Mandatory for an IED installation (rubrique 3110). The first deliverable feeding the autorisation environnementale; scoped and ready to produce.',
  },
  {
    id: 'auth-env',
    label: 'Environmental authorisation',
    authority: 'Préfet of Ille-et-Vilaine (DREAL review)',
    gates: ['env-auth'],
    note: 'The single binding environmental procedure (procédure unique). Discretionary decision — the engine maps the route, never the outcome. ~12–18+ months; PINM status (2025 law) may accelerate the procedural shell.',
  },
  {
    id: 'enquete-publique',
    label: 'Public inquiry (enquête publique)',
    authority: 'Appointed inquiry commissioner (administrative court)',
    gates: ['env-auth'],
    note: 'Public inquiry within the autorisation environnementale. Required for the IED track.',
  },
  {
    id: 'avis-ae',
    label: 'Environmental-authority opinion (MRAe)',
    authority: 'MRAe Bretagne (environmental authority)',
    gates: ['env-auth', 'water'],
    note: 'Independent environmental-authority opinion on the étude d’impact. The MRAe previously commented on the La Janais ZAC (e.g. rainwater-harvesting recommendation).',
  },
  {
    id: 'arrete-prefectoral',
    label: 'Prefectural order (arrêté préfectoral)',
    authority: 'Préfet of Ille-et-Vilaine',
    gates: ['env-auth'],
    note: 'The prefectural order concluding the autorisation environnementale (with prescriptions). Outcome out of scope.',
  },
  {
    id: 'permis-construire',
    label: 'Building permit (permis de construire)',
    authority: 'Mayor / Rennes Métropole (State-led under PINM)',
    gates: ['land-use'],
    note: 'Building permit under the PLUi (zone UI1/UI1j). Conditional on the règlement graphique reads (height, emprise, biotope) and OAP compliance.',
  },
  {
    id: 'build',
    label: 'Build',
    authority: '—',
    gates: [],
    note: 'Construction start once the environmental authorisation and the building permit are both in hand.',
  },
]

/** Ordered per-gate action lists — what pushes the paperwork through each gate. */
export const GATE_PERMITTING: Record<string, string[]> = {
  'env-auth': [
    'Confirm ICPE rubriques with DREAL Bretagne (genset thermal total vs 3110 threshold)',
    "Produce the étude d'impact (IED scope)",
    'File the dossier de demande d’autorisation environnementale (procédure unique)',
    'Enquête publique + avis MRAe',
    'Arrêté préfectoral d’autorisation',
  ],
  power: [
    'Request an RTE connection study (raccordement HTB) for the ~100 MW consumption draw',
    'Confirm the Poste de La Janais (90 kV) acceptance / MVA rating',
    'Separately, register any on-site generation for injection (S3REnR / Caparéseau)',
    'Convention de raccordement + reinforcement programme',
  ],
  brownfield: [
    'Obtain the Stellantis ICPE cessation d’activité / état des sols (when the title is released)',
    'Diagnostic de pollution (études historiques + investigations)',
    'Plan de gestion + remediation to the build-ready usage',
    'Confirm any SIS overlapping the parcels (construction constraints)',
  ],
  water: [
    'Define the cooling make-up source (REUT / rainwater) — avoid the drinking-water captages',
    'Loi sur l’eau / IOTA declaration or authorisation (abstraction + discharge), under SAGE Vilaine',
    'Coordinate with the SDAGE Loire-Bretagne low-flow constraints',
  ],
  'land-use': [
    'Read the règlement graphique at the parcel (height H, emprise, biotope V%, parking)',
    'Retrieve and comply with the OAP sectorielle',
    'Confirm ZAC + PEB overlay constraints',
    'File the permis de construire',
  ],
  heat: [
    'Negotiate a heat-offtake agreement with ENERSUD / ENGIE Solutions (Rennes Sud, 3506C)',
    'Design the ~2.7 km primary trunk + heat-pump interface station',
    'Apply for ADEME Fonds Chaleur co-funding for the chaleur fatale recovery',
  ],
}
