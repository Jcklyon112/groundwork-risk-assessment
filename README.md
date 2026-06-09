# La Janais — Feasibility Engine

Standalone tool (separate from the website) that fetches **live French regulatory data** for the
La Janais site, computes a **risk-weighted feasibility composite**, maps the **permitting route**,
and renders a **radial Pareto instrument**. All data sources are open and **keyless** — the only
"tokens" spent are model tokens, on the agentic steps (ICPE nomenclature + PLUi règlement).

See `CLAUDE.md` for the full brief, `FINDINGS.md` for the data report, `REFERENCE.md` for design
continuity.

## Quick start (full stack, local)

```bash
npm install
npm run pipeline   # one-time: fetch live data → cache/, compute → src/data/model.json
npm run dev:all    # run BOTH the backend API (:8787) and the frontend (:5173)
```

Then open **http://localhost:5173**. The frontend fetches the model from the backend over
`/api/*` (Vite proxies to the API). Use the **Refresh data** button in the app to re-run the
live adapters server-side and recompute the model.

Run the two sides separately if you prefer:

```bash
npm run server     # backend API only  → http://localhost:8787
npm run dev        # frontend only      → http://localhost:5173 (needs the API for data)
```

Other scripts:

```bash
npm run fetch      # run all keyless adapters against the site geometry (persists raw + fetched_at)
npm run evaluate   # recompute the model from the cached snapshot
npm run build      # type-check (tsc -b) + production build (vite)
npm run verify     # server-render the instrument and assert it renders correctly (no browser)
```

## Backend API (Express, `server/index.ts`)

| Method | Route | Returns |
|---|---|---|
| GET | `/api/health` | service status + last refresh |
| GET | `/api/summary` | site, composite, verdict, bottleneck |
| GET | `/api/model` | full `FeasibilityModel` |
| GET | `/api/gates` · `/api/gates/:id` | all gates / one gate |
| GET | `/api/pathway` | permitting pathway + bottleneck |
| GET | `/api/unresolved` | the unresolved ledger |
| GET | `/api/site` | canonical site GeoJSON |
| GET | `/api/sources` · `/api/sources/:name` | raw API audit trail (list / one raw response) |
| POST | `/api/refresh` | re-run the keyless adapters live, recompute, return the new model |
| GET | `/api/agent` | whether the agent is configured + which model |
| POST | `/api/ask` | **tool-using agent** — orchestrates the live data tools + web search, returns answer + the full step trace |

The pipeline is reusable: `runFetch()` (`src/pipeline/fetchAll.ts`) and `buildModel()`
(`src/pipeline/evaluate.ts`) are imported by both the CLI and the server.

## The agent (model in the runtime loop)

`POST /api/ask` (`server/agent.ts`) runs a real tool-use loop on **claude-opus-4-8**: the model
decides which live tools to call (BAN, GPU, Géorisques, RTE, Hub'Eau, FCU), reads the computed
model and raw audit trail, and uses the **server-side `web_search` tool** to re-derive the
discretionary/researchable parts (ICPE classification, current règlement, timelines) against
*current* sources at runtime — rather than replaying frozen knowledge. The response includes the
full step trace (every tool call and search), surfaced in the **Ask the engine** tab.

This is the one layer that isn't keyless. To enable it:

```bash
cp .env.example .env        # then put your key in .env:  ANTHROPIC_API_KEY=sk-ant-...
npm run server              # restart so the key is loaded
```

Without a key, the platform still works fully — the Ask tab just shows a "set ANTHROPIC_API_KEY"
notice. The key is read from `.env` (gitignored) via Node's built-in env-file loader.

## Frontend platform (`src/App.tsx`)

A platform shell with a live API-status indicator and **Refresh data** action, plus four views:
**Instrument** (the radial Pareto `FeasibilityInstrument`), **Ask the engine** (the tool-using
agent with a visible step trace), **Data sources** (the raw-source audit-trail explorer), and
**Raw model** (the served JSON). Build the user platform out from here.

## How it works

```
src/data/site.geojson         canonical brownfield geometry (from the website repo, INSEE via BAN)
src/adapters/*.ts             one keyless adapter per source (BAN, GPU, Géorisques, RTE, Hub'Eau, FCU)
src/pipeline/fetchAll.ts      runs every adapter → cache/raw/*.json (audit trail) + cache/normalized.json
src/model/research.ts         researched, cited knowledge: ICPE rubriques + PLUi règlement rules
src/model/permitting.ts       the application PATHWAY template + per-gate action lists
src/pipeline/evaluate.ts      explicit status/readiness rules → composite → src/data/model.json
src/components/FeasibilityInstrument.tsx   pure-SVG radial Pareto instrument (light theme)
```

- **Wedge angle = risk share** (Pareto, sums to 100). **Colour = status** (clear/conditional/gating —
  the only colour). **Radial fill = readiness.** **Centre = composite.** A dashed tick marks the
  **80% cumulative-risk** boundary. Select a gate for its live value (full provenance drill-down),
  supporting facts and permitting route. The pathway stepper flags the computed bottleneck.

## The honest boundary

Data axes return hard, fetchable values. The permitting **decision** is discretionary and **out of
scope** — the engine maps the route, never the outcome. Forward-looking figures are labelled
**design targets**; capacity registers are labelled **non-binding snapshots**; grid **injection**
capacity is never merged with the 100 MW **consumption** draw. Every displayed value carries its
source URL and ISO `fetched_at`.

## Current result

Composite **40.4% → CONDITIONAL**. Bottleneck: **autorisation environnementale** (ICPE rubrique
3110, IED). Top unresolved items (by leverage): genset thermal total (ICPE classification), the
100 MW RTE consumption-connection study, and the Stellantis ICPE cessation / SIS. See `FINDINGS.md`.
```
