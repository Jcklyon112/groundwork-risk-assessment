# La Janais Feasibility Engine — Project Brief (CLAUDE.md)

**Standalone tool. Not the website.** A separate Claude Code project that fetches live French
regulatory data for the La Janais site, computes feasibility, maps the permitting route, and
renders the radial Pareto instrument (`FeasibilityInstrument.jsx`).

## What it does

1. **Fetch** the hard data for each of six gates from open French APIs (mostly keyless).
2. **Compute** a per-gate status + readiness, and a risk-weighted composite.
3. **Map** the permitting pathway — the dossiers, order, and authority needed to start the build.
4. **Render** the instrument: wedge size = risk share (Pareto), colour = feasibility, inner
   gauge = readiness, centre = composite.

## The honest boundary (build this in, don't paper over it)

- Data axes return **hard values** → fetchable.
- The permitting **decision** is discretionary → NOT fetchable. Never synthesize a yes/no.
- The permitting **pathway** (steps/order/authority/triggers) → researchable + encodable.
- Mark forward-looking figures (self-generation, heat offtake volumes) as **design targets**.

## Data sources — all open, mostly keyless

| Gate | Source | Auth | Returns |
|------|--------|------|---------|
| Land use | GPU API Carto + WFS; PLUi règlement PDF | none | zonage, emprise, hauteur, reculs |
| Brownfield | Géorisques API | none | ICPE legacy, BASOL, SIS, BASIAS (daily) |
| Env. authorization | ICPE nomenclature (AIDA/Ineris) + Géorisques | none | rubriques → autorisation vs. enregistrement |
| Power | RTE Caparéseau + data.gouv "capacités d'accueil" | none | nearest poste source, reserved capacity |
| Water | Hub'Eau | none | basin / abstraction / discharge constraints |
| Heat offtake | France Chaleur Urbaine API (ADEME) | none | distance to nearest réseau de chaleur |
| (geocode) | Base Adresse Nationale | none | address → point, upstream of intersects |

"Tokens" needed are **model tokens**, not API keys — Claude Code spends them on the one agentic
step: reading the PLUi règlement PDF and extracting the zone rules.

## Fetch pipeline

```
parcel geometry (Etalab cadastre, 4 communes — canonical GeoJSON)
   → BAN geocode (where needed)
   → per-source adapter: point/polygon intersect, normalize, cache
   → règlement extractor (LLM-over-PDF for PLUi UI-zone rules)
   → evaluation: value vs. threshold → status + readiness
   → write into the AXES.live / status / readiness slots
```
- One adapter module per source. Cache server-side; cadences differ (Géorisques daily,
  GPU weekly extract, Caparéseau snapshot).
- Keep raw response + fetched_at on every value (this is the audit trail).

## Feasibility model

Per gate: `{ status, weight (risk share), readiness 0–1, regulation, permitting[], live }`.

- **weight** = assessed risk share (sums to 100). Drives wedge angle. Current cut concentrates
  ~62% in the two gating gates (env. auth 32, power 30) — verify/tune as data lands.
- **readiness** = how far the gate is from clearable (inner gauge).
- **composite** = Σ(readiness·weight)/Σweight. Currently ~42% → CONDITIONAL.
- Status: `clear | conditional | gating`. Colour is reserved for status only.

## Permitting model

Per gate, an ordered `permitting[]` action list (the "what pushes paperwork through").
Plus one global `PATHWAY[]` with the current bottleneck flagged:

```
Site control → ICPE classification → Étude d'impact → [Autorisation environnementale]
→ Enquête publique → Avis AE → Arrêté préfectoral → Permis de construire → Build
```
Bottleneck today = autorisation environnementale.

## Interface

`FeasibilityInstrument.jsx` — light theme, black/white + status colour only, no external deps.
Radial Pareto ring, readiness gauge, composite centre, 80%-risk marker, per-gate permitting
route on select, application-pathway stepper. Self-contained; renders anywhere.

## Stack

Vite + React + TS. Server-side fetch/cache layer (Node) for the adapters; the instrument is a
pure client component that reads the computed model. No browser storage.

## Open dependency (highest leverage)

The **ICPE rubriques** decide autorisation vs. enregistrement, which sets the env-authorization
timeline — the gate that dominates the composite. Verify these against the current nomenclature
before trusting the env-auth status. Everything downstream hangs on it.
