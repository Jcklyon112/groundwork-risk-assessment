# REFERENCE — website continuity notes (this tool is NOT the website)

The La Janais website repo (`datacenter-community-app`, read-only reference) ships a **strict
monochrome dark theme**. Per `CLAUDE.md`, this standalone feasibility engine deliberately uses a
**light theme, black/white + status colour only** — the dark theme was *not* imported. These notes
exist only for continuity if a future maintainer wants to align typography.

## Website design tokens (for reference only — not used here)
- Palette (dark map): ink `#141414`, paper `#ffffff`, compute mid-grey `#9a9a9a`; per-ring
  greyscale `#f5f5f5 / #bdbdbd / #828282 / #4a4a4a` (lightness encodes distance — no colour).
- Map flow encoding: give `[238,238,238]` (bright), take `[122,122,122]` (dim grey).
- Font: system UI sans (`ui-sans-serif, system-ui, 'Segoe UI', Roboto, …`).

## This tool's tokens (`src/index.css`)
- ink `#141414`, paper `#ffffff`, muted `#6b6b6b`, lines `#e2e2e2 / #c9c9c9`.
- **Status colour is the only colour** (reserved for status, per CLAUDE.md):
  clear `#1f8a4c` (green), conditional `#b8860b` (amber), gating `#b42318` (red).

## Reused facts from the website model (carried as cited/provenanced values)
- Campus thermal facts (`site.json`): 100 MW IT load, ~65 MW recoverable heat (**design target**),
  liquid/direct-to-chip cooling; network link ~2 708 m to the Rennes Sud main.
- Grid topology (`docs/SITE_ENERGY_BRIEF.md`): on-site **Poste de La Janais 90 kV**
  (OSM way 182891598, `ref:FR:RTE=JANAI`); Rennes on 225/90 kV (no 400 kV); Brittany peninsula.
- Heat network: **Rennes Sud FCU 3506C** (ENERSUD / ENGIE Solutions SEMOP).
- Water: Pavais–Marionnais–Fénicat drinking-water captages (protected); SAGE Vilaine / SDAGE
  Loire-Bretagne; REUT (Beaurade / Saint-Erblon) as design make-up.

All of these are re-verified or re-sourced in this tool's own adapters/research; nothing is taken
on trust from the website without provenance.
