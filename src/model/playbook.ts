// ─────────────────────────────────────────────────────────────────────────
// src/model/playbook.ts — the PARTNER-LEVEL layer. Where the instrument shows
// the state, this encodes the JUDGEMENT a top-tier feasibility/risk deliverable
// carries: the answer (recommendation), the value at stake, the few moves that
// matter, a risk register with de-risking levers (what to HIT to reduce risk),
// a sequenced roadmap, and the regulatory tailwinds to exploit.
//
// Researched + cited (research pass 2026-06-08). Nothing asserts a discretionary
// OUTCOME — it maps the route and the levers, per the project's honesty rule.
// All claims trace to SOURCES[]; reference items by their `src` key.
// ─────────────────────────────────────────────────────────────────────────

export interface Source { key: string; label: string; url: string }

export const SOURCES: Source[] = [
  { key: 'bracewell', label: 'Bracewell — Building Data Centers in France (2025)', url: 'https://www.bracewell.com/resources/building-data-centers-in-france-navigating-regulatory-hurdles-and-unlocking-growth/' },
  { key: 'cms', label: 'CMS — Data Centre Consenting in France', url: 'https://cms.law/en/int/expert-guides/cms-expert-guide-on-real-estate-data-centre-consenting/france' },
  { key: 'ag', label: 'Addleshaw Goddard — Future of Data Centres in France (2025)', url: 'https://www.addleshawgoddard.com/en/insights/insights-briefings/2025/real-estate/the-future-of-data-centres-in-france/' },
  { key: 'iv', label: 'Loi Industrie Verte — autorisation environnementale (≈17→9 mo)', url: 'https://www.entreprises.gouv.fr/la-loi-industrie-verte' },
  { key: 'cre120', label: 'CRE délibération n°2025-120 (7 May 2025) — hyperscale grid fast-track', url: 'https://www.cre.fr/' },
  { key: 'rte', label: 'RTE — raccordement consommation & capacités d’accueil', url: 'https://www.services-rte.com/en/learn-more-about-our-services/connect-your-consumption-facilities.html' },
  { key: 'l236', label: 'Code de l’énergie L.236-1/L.236-2 (EU 2023/1791) — chaleur fatale ≥1 MW', url: 'https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000023983208/' },
  { key: 'pinm', label: 'Loi simplification de la vie économique, Art. 15 — PINM (2025)', url: 'https://www.vie-publique.fr/loi/293129-loi-simplification-de-la-vie-economique' },
  { key: 'l411', label: 'Code de l’environnement L.411-2 — dérogation espèces protégées (RIIPM)', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043024720/' },
  { key: 'ce500384', label: 'Conseil d’État, 6 fév. 2026, n°500384 — PINM & RIIPM', url: 'https://www.gossement-avocats.com/blog/derogation-especes-protegees-un-projet-dinteret-national-majeur-est-un-grand-projet-conseil-detat-6-fevrier-2026-n500384/' },
  { key: 'jll', label: 'JLL — 2026 Global Data Center Outlook ($11.3M/MW, speed-to-power)', url: 'https://www.jll.com/en-us/insights/market-outlook/data-center-outlook' },
  { key: 'tt', label: 'Turner & Townsend — Data Centre Construction Cost Index 2025 ($10.7→11.3M/MW)', url: 'https://www.turnerandtownsend.com/en/perspectives/data-centre-cost-index/' },
  { key: 'mck', label: 'McKinsey — AI data-centre capacity & capital to 2030', url: 'https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights' },
  { key: 'ecoae', label: 'Ministère de la Transition écologique — réforme autorisation environnementale (17→9 mois)', url: 'https://www.ecologie.gouv.fr/presse/autorisation-environnementale-reforme-reduire-delais-donner-plus-place-participation-du' },
  { key: 'instr2024', label: 'Instruction du 28/10/2024 — procédure parallélisée (AIDA / Ineris)', url: 'https://aida.ineris.fr/reglementation/instruction-281024-relative-a-procedure-dautorisation-environnementale' },
  { key: 's3renr', label: 'RTE — S3REnR Bretagne (en vigueur 25 juin 2025)', url: 'https://www.rte-france.com/projets/s3renr/le-schema-regional-de-raccordement-au-reseau-des-energies-renouvelables-de-bretagne-s3renr' },
  { key: 'rtedc', label: 'RTE — Data centers : 10 chiffres clés sur leur essor (2025)', url: 'https://assets.rte-france.com/prod/public/2025-01/2025-01-09-transition-numero-11.pdf' },
  { key: 'data4', label: 'DCD — Data4 Escaudain (€5bn; commissioning 36→18 months)', url: 'https://www.datacenterdynamics.com/en/analysis/france-ai-data-center-build-out-emmanuel-macron/' },
  { key: 'site', label: 'Rennes Métropole / Wikipédia — La Janais (240 ha; ~100 ha reconversion pole)', url: 'https://fr.wikipedia.org/wiki/Usine_Stellantis_de_Rennes' },
  { key: 'msft', label: 'DCD — Microsoft considers a data center in Rennes (La Janais)', url: 'https://www.datacenterdynamics.com/en/news/microsoft-considers-data-center-in-rennes-france/' },
]

export const RECOMMENDATION = {
  stance: 'Conditional Go',
  oneLiner:
    'No fatal flaw. Two long-lead, discretionary items govern feasibility: the environmental authorisation and the 100 MW grid connection. Both are de-riskable by acting now. The schedule, not consentability, is the constraint.',
  rationale: [
    'Zoned for industry on a public-reconversion brownfield. No gate is a hard stop.',
    'Time-to-power binds the schedule. The HTB connection and the IED authorisation set first revenue.',
    'Recent reforms shorten both, but only for complete dossiers filed early.',
  ],
}

export interface ValueStat { label: string; value: string; sub: string; src?: string }
export const VALUE_AT_STAKE: ValueStat[] = [
  { label: 'Capital at stake', value: '≈ $1.13bn (€1.05bn)', sub: '100 MW × $11.3M/MW build cost (2026; $10.7M in 2025). AI-optimised facilities run ≥$20M/MW → ≥$2.0bn.', src: 'tt' },
  { label: 'Binding constraint', value: 'Time-to-power', sub: 'Speed-to-power is the primary site-selection criterion (JLL 2026). Grid and the IED authorisation set first revenue.', src: 'jll' },
  { label: 'Cost of delay', value: 'On the critical path', sub: 'Construction commissions in 18–24 months (Data4 Escaudain compressed 36→18); the regulatory chain, not the build, governs first revenue.', src: 'data4' },
]

export interface Move { n: number; title: string; gate: string; why: string; horizon: string; src?: string }
export const MOVES: Move[] = [
  {
    n: 1, title: 'File the RTE connection study (PTF)', gate: 'power', horizon: '0–3 months', src: 'rte',
    why: 'Grid is the long pole: three to four years even fast-tracked. Since August 2025 capacity is reserved, not first-come. An early queue position and capacity reservation protect the first-power date. Structure the ramp-up to avoid UIOLI clawback.',
  },
  {
    n: 2, title: 'Open DREAL pre-application; start four-season ecology', gate: 'env-auth', horizon: '0–6 months', src: 'iv',
    why: 'The Green Industry Law parallelised the authorisation, from roughly 17 to 9 months, but only for complete dossiers aligned early with the authority. Four-season ecological surveys are seasonal and gate any protected-species derogation. Time lost cannot be recovered.',
  },
  {
    n: 3, title: 'Build the PINM designation case', gate: 'env-auth', horizon: '0–6 months', src: 'pinm',
    why: 'PINM status addresses three discretionary risks together: state-led building permit, expedited grid connection, and a facilitated protected-species derogation. It can establish the overriding public-interest justification (RIIPM) the CNPN test requires.',
  },
  {
    n: 4, title: 'Settle the heat-offtake and REUT water design', gate: 'heat', horizon: '3–9 months', src: 'l236',
    why: 'Waste-heat reuse is mandatory for any data centre ≥1 MW (Energy Code L.236). A heat trunk to Rennes Sud and a REUT/rainwater make-up loop satisfy two obligations and reduce third-party litigation risk (recours des tiers).',
  },
]

export interface RiskLever {
  gate: string
  severity: 'gating' | 'conditional' | 'clear'
  risk: string
  driver: string
  lever: string      // what to HIT to reduce the risk
  owner: string
  horizon: string
  effect: string     // the de-risking payoff
  src?: string
}
export const RISK_REGISTER: RiskLever[] = [
  {
    gate: 'env-auth', severity: 'gating',
    risk: 'IED authorisation: discretionary, long-lead',
    driver: 'Rubrique 3110 (genset fleet ≥50 MW), régime Autorisation',
    lever: 'DREAL pre-application; file a complete étude d’impact to capture the Green Industry Law parallelisation',
    owner: 'MOA + bureau d’études environnement', horizon: '0–6 mo',
    effect: 'Cuts roughly 8 months; lowers refusal and condition risk', src: 'iv',
  },
  {
    gate: 'power', severity: 'conditional',
    risk: '100 MW HTB connection: the schedule long pole',
    driver: 'Brittany electrical peninsula; RTE study not initiated; queue regime changed Aug 2025',
    lever: 'File the PTF; secure a capacity reservation; structure ramp-up to avoid UIOLI clawback',
    owner: 'MOA + RTE', horizon: '0–3 mo',
    effect: 'Firm capacity; protects the first-power date', src: 'rte',
  },
  {
    gate: 'biodiversity', severity: 'conditional',
    risk: 'Protected-species derogation (CNPN): strict, litigation-prone',
    driver: 'L.411-2 requires RIIPM, no satisfactory alternative, favourable conservation status',
    lever: 'Launch four-season surveys; run the éviter-réduire-compenser sequence; establish RIIPM via PINM',
    owner: 'MOA + écologue', horizon: '0–12 mo',
    effect: 'Removes a common late-stage blocker and litigation vector', src: 'l411',
  },
  {
    gate: 'brownfield', severity: 'conditional',
    risk: 'Legacy Stellantis soils: remediation scope unknown',
    driver: 'ICPE cessation / état des sols not yet released (site in exploitation)',
    lever: 'Obtain the cessation dossier; phase remediation to the build-ready usage; confirm any SIS',
    owner: 'MOA + bureau sols', horizon: '3–9 mo',
    effect: 'Bounds remediation cost and schedule',
  },
  {
    gate: 'water', severity: 'conditional',
    risk: 'Make-up source against the drinking-water captage; IOTA authorisation',
    driver: 'Captage protection perimeter near site; SDAGE/SAGE low-flow constraints',
    lever: 'Secure a REUT and rainwater make-up loop off the potable aquifer; pre-file the IOTA dossier',
    owner: 'MOA + hydrogéologue', horizon: '3–9 mo',
    effect: 'Removes the captage conflict; strengthens the dossier', src: 'l236',
  },
  {
    gate: 'land-use', severity: 'conditional',
    risk: 'PLUi graphic limits and OAP may constrain the programme',
    driver: 'Height H, emprise, biotope deferred to the règlement graphique; OAP sectorielle',
    lever: 'Read the graphic at the parcel; align the OAP; route the building permit state-led via PINM',
    owner: 'MOA + urbaniste', horizon: '0–6 mo',
    effect: 'Confirms the envelope; bypasses local permit discretion', src: 'pinm',
  },
  {
    gate: 'heat', severity: 'conditional',
    risk: 'Waste-heat reuse now mandatory (≥1 MW); a litigation flashpoint',
    driver: 'Energy Code L.236; nearest network (Rennes Sud) ~2.7 km',
    lever: 'Sign a heat-offtake LOI with the network operator; design the trunk; apply for ADEME Fonds Chaleur',
    owner: 'MOA + énergéticien', horizon: '3–9 mo',
    effect: 'Converts an obligation into a community benefit', src: 'l236',
  },
]

export interface RoadmapPhase { window: string; title: string; actions: string[] }
export const ROADMAP: RoadmapPhase[] = [
  {
    window: '0–3 months', title: 'Secure the long-lead options',
    actions: [
      'File the RTE connection study (PTF) — secure queue position + capacity reservation',
      'Request the pre-application meeting with DREAL Bretagne',
      'Commission the 4-season ecological baseline (start immediately — seasonal)',
      'Read the PLUi règlement graphique at the parcel',
    ],
  },
  {
    window: '3–6 months', title: 'Build the dossiers & the case',
    actions: [
      'Scope and launch the étude d’impact (IED)',
      'Assemble the PINM designation case (RIIPM narrative)',
      'Obtain the Stellantis ICPE cessation / état des sols',
      'Sign the heat-offtake LOI + REUT make-up agreement',
    ],
  },
  {
    window: '6–12 months', title: 'File & de-risk the decision',
    actions: [
      'File the autorisation environnementale (procédure unique)',
      'Lodge the permis de construire (state-led if PINM)',
      'Finalise the raccordement convention + ramp-up schedule',
      'Prepare the enquête publique communications (litigation de-risk)',
    ],
  },
]

// Per-gate headline shown when a wedge is tapped on the instrument: the biggest
// issue stated plainly, and the concrete next action for THIS site.
export interface GateHeadline { issue: string; action: string }
export const GATE_HEADLINE: Record<string, GateHeadline> = {
  'env-auth': {
    issue: 'The IED environmental authorisation is the binding constraint: discretionary, roughly 9–15 months once a complete dossier is filed, and nothing is filed yet.',
    action: 'Open a pre-application with DREAL Bretagne and start the étude d’impact now, to capture the 9-month parallelised track under the Green Industry Law.',
  },
  power: {
    issue: 'A 100 MW HTB connection on the Brittany electrical peninsula is the schedule long pole, and the RTE study has not started.',
    action: 'File the RTE connection study (PTF) immediately to take a queue position and reserve capacity before construction is fixed.',
  },
  brownfield: {
    issue: 'The Stellantis ICPE cessation and état des sols are not released, so the remediation scope, cost and build-start date are unknown.',
    action: 'Obtain the cessation dossier and phase remediation to the build-ready usage; confirm any SIS over the parcels.',
  },
  water: {
    issue: 'Cooling make-up risks conflict with the drinking-water captage protection perimeter, and the IOTA abstraction/discharge authorisation is undefined.',
    action: 'Secure a REUT and rainwater make-up loop off the potable aquifer, and pre-file the IOTA dossier under SAGE Vilaine.',
  },
  'land-use': {
    issue: 'Zoning (UI1/UI1j) permits industrial use. The graphic plans were read at the parcel: height and végétalisation défer to the literal règlement (UI1 permissive — gabarit 3,5 m + 45° at limits), parking secteur S4. The binding residual is the OAP sectorielle content and the PEB aérodrome overlay.',
    action: 'Retrieve the OAP sectorielle and comply with it; confirm the PEB constructibility limits; route the building permit state-led via PINM.',
  },
  heat: {
    issue: 'Waste-heat reuse is now mandatory for a data centre ≥1 MW (Energy Code L.236), and the nearest network is ~2.7 km away.',
    action: 'Sign a heat-offtake LOI with the Rennes Sud operator, design the trunk, and apply for ADEME Fonds Chaleur.',
  },
}

export interface Tailwind { title: string; detail: string; src: string }
export const TAILWINDS: Tailwind[] = [
  { title: 'Loi Industrie Verte (in force Oct 2024)', detail: 'Parallelised the examination and public-consultation phases for files submitted from 22 October 2024 (Instruction 28/10/2024). Government objective: halve new-site authorisation from 17 to 9 months; the parallelised public consultation runs 3 months. Available only to complete files.', src: 'ecoae' },
  { title: 'Grid capacity reservation (Aug 2025)', detail: 'Energy Code L.342-22 to L.342-24 and CRE 2024-229 replaced first-come-first-served with reserved capacity and a use-it-or-lose-it rule. Rewards early movers; penalises over-booking.', src: 'rte' },
  { title: 'Hyperscale grid fast-track (CRE 2025-120)', detail: 'Three-to-four-year connection for State-designated HTB3 (400 kV) sites. La Janais is on 90 kV HTB; confirm whether the fast-track or the ordinary regime applies.', src: 'cre120' },
  { title: 'PINM — Projet d’Intérêt National Majeur (2025)', detail: 'State-led building permit, expedited grid, facilitated protected-species derogation. The Conseil d’État (6 Feb 2026) confirmed its scope. Implementing decrees pending.', src: 'pinm' },
  { title: 'Mandatory heat reuse (Energy Code L.236)', detail: 'Data centres ≥1 MW must reuse waste heat unless infeasible. Makes the Rennes Sud offtake a compliance item and a community-benefit point for the enquête publique.', src: 'l236' },
]

// Evidence base for the schedule durations — each band traced to a source or case study.
export interface Evidence { item: string; basis: string; src: string }
export const TIMELINE_EVIDENCE: Evidence[] = [
  { item: 'Environmental authorisation — 9–15 months', basis: 'Government objective is to halve new-site authorisation from 17 to 9 months under the parallelised procedure (in force for files from 22 Oct 2024). 9 months applies to complete files; contested or incomplete files revert toward 17+.', src: 'ecoae' },
  { item: 'HTB grid connection — 24–36 months', basis: 'For State-identified 400 kV sites, connection targets 3–4 years (CRE 2025-120). The building permit must be transmitted ≤16 months after the connection agreement (RTE CART). La Janais (90 kV HTB) follows the ordinary regime.', src: 'cre120' },
  { item: 'Construction — 18–24 months', basis: 'Hyperscale facilities commission in 12–24 months with parallel workstreams; Data4’s €5bn Escaudain campus compressed commissioning from 36 to 18 months via turnkey shells.', src: 'data4' },
  { item: 'Total to energisation — 38–66 months', basis: 'Full development runs 18–30 months in favourable markets and 4–7 years in constrained jurisdictions; a 100 MW IED site in France, gated by the environmental authorisation and HTB connection, sits in the upper band.', src: 'rtedc' },
]
