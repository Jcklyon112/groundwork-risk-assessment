# FINDINGS — La Janais Feasibility Engine

**Run date:** 2026-06-07 · **Site:** Data-centre campus, La Janais, Chartres-de-Bretagne
(INSEE 35066), Rennes Métropole, Ille-et-Vilaine. **Stack:** Vite + React + TS; keyless Node
adapters → computed model → radial Pareto instrument.

**Headline:** composite readiness **40.4% → CONDITIONAL**. Six gates, risk-weighted. The
**autorisation environnementale** is the current bottleneck, driven by ICPE rubrique **3110**
(combustion ≥ 50 MW, IED). Every value below is drillable in the instrument to its source URL
and `fetched_at`. The engine surfaces data, risk and route — it never asserts the permitting
decision (discretionary, out of scope).

---

## § Context (Step 0 — from the website repo)

- **Website repo (read-only reference):** `C:\Users\jackl\Desktop\datacenter-community-app`
  (the La Janais site, live at `lajanais-thermal-commons.vercel.app`). **Not modified.**
- **Canonical geometry:** copied to `src/data/site.geojson`. The repo's `parcels.geojson` is a
  50k-**point** heat-eligibility dataset, **not** cadastral parcels, so the canonical site extent
  is the **OSM-derived brownfield boundary hull** (14-vertex polygon, grid bearing 17.5° from N)
  from `public/data/site_buildings.geojson` (`scripts/process_site.py`). Campus point
  (-1.706889, 48.060095); centroid (-1.706499, 48.058832). **INSEE 35066 resolved via BAN**, not
  hard-coded.
- **Project framing (verbatim from the repo):** "additive not extractive"; "thermal commons";
  former Citroën→PSA→Stellantis car plant (1961; peak ~345,000 cars/yr 2005) being reconverted to
  a "Pôle d'excellence industrielle … riche en emplois et pauvre en carbone"; ~100 MW liquid-cooled
  campus; ~65 MW recoverable heat (design target); Brittany "péninsule électrique" (self-covers
  ~31%, 2024). **Honest note carried over:** a data-centre use of La Janais is currently *opposed*
  by Rennes Métropole — the engine maps feasibility/route, not political alignment.
- **Design tokens:** the website ships a strict-monochrome dark theme. Per CLAUDE.md this tool is
  **light theme, black/white + status colour only** — the dark theme was deliberately not imported.
  See `REFERENCE.md`.

---

## § Per-gate summary

| Gate | Fetched / derived value | Source | Status | Readiness | Confidence | Open gaps |
|------|------------------------|--------|--------|-----------|------------|-----------|
| **Env. authorization** (w 32) | Autorisation track — driver **rubrique 3110** (combustion ≥ 50 MW, IED) | AIDA/Ineris nomenclature + legal commentary | **gating** | 20% | medium | exact genset thermal total (2910-E vs 3110-A boundary); 4734 fuel band; PINM eligibility |
| **Power** (w 30) | On-site 90 kV Poste de La Janais; **100 MW draw needs a separate RTE study (not initiated)** | RTE/Enedis registre (ODRÉ) + OSM | conditional | 40% | medium | connection study not started; poste MVA acceptance not public; Brittany peninsula |
| **Brownfield & soil** (w 14) | **18 ICPE + 24 CASIAS/BASIAS** within 2 km; Stellantis = Autorisation, en exploitation avec titre, priorité nationale | Géorisques | conditional | 55% | high | ICPE cessation/état des sols (site still active); SIS endpoint unresolved |
| **Water** (w 9) | **3 withdrawal points** in commune; drinking-water captage (La Marionnais) in protection perimeter | Hub'Eau | conditional | 55% | high | make-up source (REUT/rainwater); IOTA abstraction/discharge authorisation |
| **Land use (PLUi)** (w 9) | Zoned **UI1j** (zone d'activités industrielles) — use permitted | GPU API Carto (zone-urba) + PLUi règlement | conditional | 70% | high | height/emprise/parking/biotope deferred to graphic plans; OAP; ZAC/PEB overlays |
| **Heat offtake** (w 6) | Campus not on a network; nearest réseau **~2 708 m** (Rennes Sud 3506C) | France Chaleur Urbaine (ADEME) | conditional | 50% | high | offtake agreement; ~2.7 km trunk capex; offtake **volume is a design target** |

**Composite** = Σ(readiness·weight)/Σweight = **40.4% → CONDITIONAL**.
**Bottleneck** = autorisation environnementale (earliest non-precursor step gated by the gating
env-auth gate).

### Status / readiness rules (documented in `src/pipeline/evaluate.ts`)
- **env-auth:** any triggered rubrique in régime *Autorisation* (here 3110, IED) ⇒ autorisation
  environnementale (étude d'impact + enquête publique + avis MRAe) ⇒ gating, readiness 0.20.
- **power:** on-site 90 kV poste exists (head-start) but the 100 MW consumption connection study is
  not done and acceptance is not public, on a structural electrical peninsula ⇒ conditional, 0.40.
- **brownfield:** dense ICPE/CASIAS legacy + active title ⇒ remediation needed but reconversion is
  the public plan ⇒ conditional, 0.55.
- **water:** drinking-water captage in protection perimeter + historic abstraction; closed-loop
  design lowers draw but make-up source + IOTA authorisation unresolved ⇒ conditional, 0.55.
- **land-use:** zonage UI1/UI1j permits the use (confirms reconversion); règlement permissive but
  graphic numbers + OAP pending ⇒ conditional, 0.70.
- **heat:** nearest main ≫ 200 m threshold ⇒ a ~2.7 km transport-main cost, not a blocker; offtake
  volume is a design target ⇒ conditional, 0.50.

---

## § Live data verified per adapter (all keyless)

| Adapter | Endpoint (verified) | Key live result |
|---|---|---|
| **BAN** | `api-adresse.data.gouv.fr/search` | "la Janais 35131 Chartres-de-Bretagne" → citycode **35066** |
| **GPU** (land-use) | `apicarto.ign.fr/api/gpu/{document,zone-urba,prescription-surf}` | partition **DU_243500139**; site polygon clips UI1a/UI1b/UI1f/**UI1j**/UO1/UO4/N/NP/A; prescriptions: Hauteur(39), Patrimoine(07), EBC(01), Mixité(37), Servitude localisation(05) |
| **Géorisques** | `georisques.gouv.fr/api/v1/installations_classees` ; `…/ssp/casias` | **STELLANTIS Rennes** (Autorisation, en exploitation avec titre, priorité nationale) + SARP OUEST (A), ATLANTIC RECYCL AUTO (E); **18 ICPE**, **24 CASIAS**. SIS: no tested endpoint resolved (see gaps). |
| **RTE/Enedis** | ODRÉ `registre-national-installation-production-stockage-electricite-agrege` | commune installations → poste source **NOYA5**; dept-35 top poste **PLELA ~54.6 MW** connected (**injection** capacity). |
| **Hub'Eau** | `hubeau.eaufrance.fr/api/v1/prelevements/referentiel/points_prelevement` | **USINE DE STELLANTIS AUTO SAS** (groundwater, since 1975), **PEUGEOT CITROEN PCA** (1975), **LA MARIONNAIS (FORAGE)** drinking-water captage. qualite_rivieres: 0 in-commune stations. |
| **France Chaleur Urbaine** | `france-chaleur-urbaine.beta.gouv.fr/api/v1/eligibility` | campus **not eligible** (distance null); nearest main = **Rennes Sud 3506C** (ENERSUD/ENGIE, **58.6% EnR&R**, 0.118 kgCO₂/kWh) ~**2 708 m** away. |

Raw responses + ISO `fetched_at` persisted to `cache/raw/` (audit trail); normalized snapshot in
`cache/normalized.json`; computed model in `cache/model.json` and `src/data/model.json`.

---

## § ICPE rubrique findings (Step 4 — highest leverage)

Verified against AIDA/Ineris + Légifrance + legal commentary (Morgan Lewis, Cheuvreux), 2026-06-07.
**No dedicated data-centre rubrique exists** — a DC is classified via its support equipment.

| Rubrique | Title (short) | Régime for this project | Confidence |
|---|---|---|---|
| **3110** | Combustion ≥ 50 MW (IED) — backup genset fleet | **AUTORISATION (A)** — *drives the verdict* | medium (rule high; depends on genset sizing) |
| 2910 | Combustion 1–50 MW | Enregistrement (20–<50 MW) / Déclaration (1–<20 MW) — fallback only | high |
| 4734 | Diesel / fuel-oil storage | Déclaration (≥50 t) → Enregistrement (≥500 t) → A (≥1000 t); depends on inventory | medium |
| 2925 | Battery charging (UPS/BESS Li-ion) | Déclaration (>600 kW) — caps at D | high |
| 1185 | Fluorinated refrigerant gases | Déclaration (≥300 kg) — **never A/E** | high |

**Verdict:** **autorisation environnementale** (the gating, slowest route), driven by **3110** via
the backup diesel genset fleet (a 100 MW IT load implies > 50 MW thermal of gensets). Timeline
~**12–18+ months** (étude d'impact + enquête publique + avis MRAe). PINM status (2025 loi de
simplification, Art. 15) can accelerate the procedural shell but **does not waive** the
étude d'impact / enquête publique substance for an IED installation. All other rubriques are
subordinate (max Déclaration/Enregistrement) and cannot change the verdict.

Sources: <https://aida.ineris.fr/thematiques/3110-combustion-combustibles-installations-dune-puissance-thermique-nominale-totale> ·
<https://aida.ineris.fr/reglementation/2910-combustion-a-lexclusion-installations-visees-rubriques-2770-2771-2971-2931> ·
<https://aida.ineris.fr/reglementation/4734-produits-petroliers-specifiques-carburants-substitution-essences-naphtas> ·
<https://aida.ineris.fr/reglementation/2925-ateliers-charge-daccumulateurs-electriques> ·
<https://www.morganlewis.com/pubs/2025/05/france-attracts-major-data-center-investment-a-legal-framework-overview>

---

## § Règlement extraction (Step 3 — PLUi Rennes Métropole, zone UI1 / secteur UI1j)

**Zonage (GPU API-confirmed):** typezone **U**, libellé **UI1j** (secteur j of zone UI1 — parcs
d'activités industrielles), partition **DU_243500139**, document `243500139_PLUi_20251218`.
Confirms the reconversion thesis (industrial-activity zone).

**Règlement source (in force):** PLUi Rennes Métropole *Règlement littéral* (Modification n°2,
approbation Juin 2025) — `…/3_reglement/d01_rl.zip`. Citation scheme: short **ZONE UI1** chapter
(pp.180–181) + **Titre IV** "règles applicables à toutes les zones" (pp.93–136); most quantitative
values are deferred to the **règlement graphique**.

| Rule | Value | Article cited | Confidence |
|---|---|---|---|
| Hauteur max | No literal cap — graphic label "H"; transition gabarit 3.5 m + 45° at zone limits | ZONE UI1 §3.1 (p.180); typepsc 39 | high (graphic read) |
| Emprise au sol | Not regulated literally for industrie; graphic plan de masse/détail prevails | ZONE UI1 §4 (p.181); Titre IV §3 (p.103) | high (graphic read) |
| Implantation vs voies | Libre (need-based); storage screened from roads | ZONE UI1 §2.1.1 (p.180) | high |
| Implantation vs limites séparatives | Libre, subject to 3.5 m + 45° gabarit | ZONE UI1 §2.2.1 (p.180) | high |
| Stationnement | Need-based (Chartres = Secteur 5); space min 5.00 × 2.30 m | Titre IV §7.1 (pp.119–123); typepsc 44 | high (norm = plan read) |
| Espaces verts | 1 tree / 200 m² pleine terre; parking 1 tree / 4 spaces; removal compensated 2-for-1 | Titre IV §6.1.1.4 a) (pp.111–112) | high |
| Coefficient de végétalisation (biotope) | Applies where graphic sets a minimum — site covered (typepsc 42); V% read off plan | Titre IV §6.1.1.4/§6.1.1.5 (pp.112–113) | high (graphic read) |

---

## § Unresolved — ranked by leverage (explicit gaps, never guessed)

1. **[env-auth · #1]** Exact genset thermal total — sets the **2910-E vs 3110-A** boundary
   (Enregistrement vs Autorisation). Drives the entire env-permitting timeline. Confirm with
   **DREAL Bretagne**.
2. **[power · #2]** 100 MW HTB **consumption** connection: RTE study not initiated; Poste de La
   Janais MVA acceptance not public. (Distinct from injection capacity — never merged.)
3. **[brownfield · #3]** Stellantis **ICPE cessation / état des sols** not yet available (site
   still in exploitation); **SIS endpoint unresolved** among tested Géorisques paths (`/api/v1/sis`,
   `/api/v1/ssp/sis`, `/api/v1/sis/sis` all 404) — confirm SIS on the Géorisques portal.
4. **[land-use]** Height (H), emprise cap, parking norm, végétalisation V% — all deferred to the
   **règlement graphique**; read at the parcel via `mviewer.sig.rennesmetropole.fr/plui`.
5. **[land-use]** **OAP sectorielle** (incl. patrimoniales/architecturales/écologiques) covers the
   site — opposable, must be retrieved and complied with.
6. **[land-use]** **ZAC + Plan d'Exposition au Bruit (PEB aérodrome)** overlays touch the site —
   confirm constructibility limits.
7. **[env-auth]** 4734 fuel-storage band (DC/E/A) depends on the not-yet-fixed total diesel inventory.
8. **[env-auth]** PINM eligibility for La Janais (affects timeline, not classification).
9. **[water]** Cooling make-up source (REUT/rainwater) and IOTA abstraction/discharge authorisation
   not defined; closed-loop draw figures are **design targets**.
10. **[water]** Hub'Eau `qualite_rivieres` returned 0 in-commune stations; basin context taken from
    SDAGE Loire-Bretagne / SAGE Vilaine.

---

## § Honesty boundary (HARD RULES — all observed)

1. No fabricated value, endpoint, rubrique or article — unconfirmed items are listed above.
2. No permitting **decision** asserted — only data, risk and the procedural route.
3. Forward-looking figures (recoverable heat ~65 MW, closed-loop water draw) labelled **design
   target** in the model and UI.
4. Snapshots (RTE capacity register) labelled **non-binding snapshot**.
5. **Injection ≠ consumption** kept as separate recorded facts on the power gate.
6. Provenance (raw response + source URL + ISO `fetched_at`) persisted on every value.
7. Every adapter endpoint verified live before coding; the one endpoint that would not resolve
   (Géorisques SIS) is recorded as a gap rather than invented.
