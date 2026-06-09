// ─────────────────────────────────────────────────────────────────────────
// src/pipeline/evaluate.ts — turn the fetched snapshot + researched knowledge
// into the FeasibilityModel the instrument renders. Every status/readiness is
// derived from an EXPLICIT, WRITTEN rule. Composite = Σ(readiness·weight)/Σweight.
// Bottleneck = earliest non-precursor pathway step gated by a non-cleared gating
// gate.
//   import { buildModel } from './evaluate'   → programmatic (used by the server)
//   npm run evaluate                          → CLI (reads cache, writes model)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from '../adapters/_util.ts'
import type { FeasibilityModel, Gate, PathwayStep, Status } from '../model/types.ts'
import type { Snapshot } from './fetchAll.ts'
import {
  ICPE_RUBRIQUES, ICPE_VERDICT, ICPE_RESEARCHED_AT,
  PLUI, REGLEMENT_RESEARCHED_AT, LANDUSE_UNRESOLVED,
} from '../model/research.ts'
import { PATHWAY_TEMPLATE, GATE_PERMITTING } from '../model/permitting.ts'

// risk weights (risk share, sum = 100). Tuned 2026-06-08 after the ICPE
// verification firmed env-auth as a confirmed Autorisation gate (the slowest,
// discretionary, not-yet-filed route). env-auth+power now hold 65%:
//   env-auth 32→35  verified Autorisation; dominant, discretionary, longest lead
//   power    30      unchanged — co-dominant (Brittany peninsula, 100 MW HTB, study not initiated)
//   brownfield 14→13 minor trim
//   water     9      unchanged
//   land-use  9→8    zoning UI1/UI1j confirms the use; residual is graphic-overlay/OAP detail
//   heat      6→5    explicitly "not a blocker" (a ~2.7 km transport-main cost) → floor
const WEIGHTS: Record<string, number> = {
  'env-auth': 35, power: 30, brownfield: 13, water: 9, 'land-use': 8, heat: 5,
}

const verdictFromComposite = (c: number): FeasibilityModel['verdict'] =>
  c >= 0.7 ? 'CLEAR' : c >= 0.35 ? 'CONDITIONAL' : 'GATING'

export interface BuildOptions {
  /**
   * 'reference' (default) = the canonical La Janais assessment, including the
   * site-specific research (ICPE rubriques, PLUi UI1j règlement).
   * 'screening' = an arbitrary parcel: the fetchable data axes are evaluated
   * live from the snapshot, but the researched/discretionary gates are NOT
   * carried over — they are emitted as "needs per-parcel research" so the tool
   * never asserts La Janais's discretionary findings about a different site.
   */
  mode?: 'reference' | 'screening'
  /** display name for the screened site */
  siteName?: string
}

/** Build the full FeasibilityModel from a fetched snapshot (pure). */
export function buildModel(snap: Snapshot, opts: BuildOptions = {}): FeasibilityModel {
  const mode = opts.mode ?? 'reference'
  // ── GATE 1 · Environmental authorization (the driver) ─────────────────────
  function gateEnvAuth(): Gate {
    const driver = ICPE_RUBRIQUES.find((r) => r.driver)!
    return {
      id: 'env-auth', name: 'Environmental authorization (ICPE)', short: 'Env. auth',
      status: 'gating', weight: WEIGHTS['env-auth'], readiness: 0.2,
      regulation: 'ICPE nomenclature (Code de l’environnement) — IED Directive 2010/75/UE',
      permitting: GATE_PERMITTING['env-auth'],
      rule: 'Triggered rubrique 3110 (Combustion ≥ 50 MW, IED) lands in régime Autorisation ⇒ autorisation environnementale required (étude d’impact + enquête publique + avis MRAe). Classification verified 2026-06-08 (gensets sum as "susceptibles de fonctionner simultanément"; 3110 régime confirmed by the arrêté du 30 jan. 2025). Discretionary; loi Industrie Verte parallelisation puts a complete dossier at ~9–15 months, but none is filed ⇒ gating, readiness 0.20.',
      live: {
        value: `Autorisation track — driver: rubrique ${driver.rubrique} (${driver.title})`,
        source: 'AIDA / Ineris nomenclature ICPE + legal commentary',
        url: driver.source, fetched_at: ICPE_RESEARCHED_AT, confidence: 'high',
        notes: [ICPE_VERDICT.track, ICPE_VERDICT.timeline, ICPE_VERDICT.accelerant, ICPE_VERDICT.note],
      },
      facts: [
        ...ICPE_RUBRIQUES.map((r) => ({
          label: `Rubrique ${r.rubrique} — ${r.title}`,
          value: r.regimeForProject + (r.driver ? ' (DRIVER)' : ''),
          source: 'AIDA / Ineris', url: r.source, fetched_at: ICPE_RESEARCHED_AT, confidence: r.confidence,
        })),
        {
          label: 'Existing site ICPE title (Stellantis Rennes)',
          value: `${snap.georisques?.icpe?.records?.[0]?.regime ?? '—'} · ${snap.georisques?.icpe?.records?.[0]?.etatActivite ?? ''} · priorité nationale`,
          source: 'Géorisques — installations classées',
          url: snap.georisques?.url?.icpe ?? 'https://www.georisques.gouv.fr',
          fetched_at: snap.georisques?.fetched_at, confidence: 'high',
        },
      ],
    }
  }

  // ── GATE 2 · Power ────────────────────────────────────────────────────────
  function gatePower(): Gate {
    const dept = snap.rte?.departmentPostes ?? []
    const topPoste = dept.find((p: any) => p.postesource) ?? dept[0]
    const communePoste = snap.rte?.communePostes?.find((p: any) => p.postesource)?.postesource ?? '—'
    return {
      id: 'power', name: 'Power — grid connection', short: 'Power',
      status: 'conditional', weight: WEIGHTS.power, readiness: 0.4,
      regulation: 'RTE/Enedis raccordement (HTB); S3REnR Bretagne for injection',
      permitting: GATE_PERMITTING.power,
      rule: 'On-site 90 kV poste exists (head-start) but the 100 MW consumption connection study is not done, poste acceptance not public, and Brittany is an electrical peninsula ⇒ conditional, readiness 0.40.',
      live: {
        value: 'On-site 90 kV Poste de La Janais; 100 MW draw needs a separate RTE study (not initiated)',
        source: 'RTE/Enedis registre via ODRÉ + OSM (poste)',
        url: 'https://odre.opendatasoft.com/explore/dataset/registre-national-installation-production-stockage-electricite-agrege/',
        fetched_at: snap.rte?.fetched_at, confidence: 'medium', snapshot: true,
        notes: [snap.rte?.injectionNote, snap.rte?.consumptionNote].filter(Boolean),
      },
      facts: [
        { label: 'Poste source serving the commune (injection register)', value: communePoste, source: 'RTE/Enedis registre (ODRÉ)', url: snap.rte?.url?.commune ?? '', fetched_at: snap.rte?.fetched_at, confidence: 'high', snapshot: true },
        { label: 'Top poste source in dept. 35 by connected injection capacity', value: topPoste ? `${topPoste.postesource ?? 'aggregated'} — ${Math.round((topPoste.connected_kw ?? 0) / 1000)} MW connected` : '—', source: 'RTE/Enedis registre (ODRÉ)', url: snap.rte?.url?.department ?? '', fetched_at: snap.rte?.fetched_at, confidence: 'high', snapshot: true },
        { label: 'On-site substation', value: 'Poste de La Janais — 90 kV RTE (OSM way 182891598, ref:FR:RTE=JANAI)', source: 'OpenStreetMap', url: 'https://www.openstreetmap.org/way/182891598', fetched_at: snap.rte?.fetched_at, confidence: 'high' },
        { label: '100 MW consumption draw', value: 'Separate RTE connection study — non-binding, acceptance not public', source: 'CLAUDE.md hard rule (injection ≠ consumption)', url: 'https://www.rte-france.com/', fetched_at: snap.rte?.fetched_at, confidence: 'low', designTarget: true },
      ],
    }
  }

  // ── GATE 3 · Brownfield & soil ────────────────────────────────────────────
  function gateBrownfield(): Gate {
    const icpe = snap.georisques?.icpe?.count ?? 0
    const casias = snap.georisques?.casias?.count ?? 0
    const sis = snap.georisques?.sis
    return {
      id: 'brownfield', name: 'Brownfield & soil', short: 'Brownfield',
      status: 'conditional', weight: WEIGHTS.brownfield, readiness: 0.55,
      regulation: 'Sites et sols pollués (ICPE cessation, état des sols) + SIS',
      permitting: GATE_PERMITTING.brownfield,
      rule: `Legacy industrial site: ${icpe} ICPE + ${casias} CASIAS/BASIAS within 2 km, active Stellantis title ⇒ remediation needed but reconversion is the public plan ⇒ conditional, readiness 0.55.`,
      live: {
        value: `${icpe} ICPE + ${casias} CASIAS legacy sites within 2 km; remediation scoping required`,
        source: 'Géorisques — installations classées + CASIAS/BASIAS',
        url: snap.georisques?.url?.casias ?? 'https://www.georisques.gouv.fr',
        fetched_at: snap.georisques?.fetched_at, confidence: 'high',
        notes: [sis?.resolved ? `SIS: ${sis.count} sector(s)` : 'SIS: confirm any Secteur d’Information sur les Sols over the parcels (Géorisques).'],
      },
      facts: [
        { label: 'Principal ICPE on site', value: `${snap.georisques?.icpe?.records?.[0]?.raisonSociale ?? '—'} — ${snap.georisques?.icpe?.records?.[0]?.regime ?? ''}, ${snap.georisques?.icpe?.records?.[0]?.etatActivite ?? ''}`, source: 'Géorisques', url: snap.georisques?.url?.icpe ?? '', fetched_at: snap.georisques?.fetched_at, confidence: 'high' },
        { label: 'CASIAS / BASIAS legacy sites (2 km)', value: String(casias), source: 'Géorisques — CASIAS', url: snap.georisques?.url?.casias ?? '', fetched_at: snap.georisques?.fetched_at, confidence: 'high' },
        { label: 'SIS (Secteurs d’Information sur les Sols)', value: sis?.resolved ? String(sis.count) : 'Confirm any sector over the parcels (Géorisques)', source: 'Géorisques — SIS', url: 'https://www.georisques.gouv.fr/risques/sis/donnees', fetched_at: snap.georisques?.fetched_at, confidence: 'high' },
      ],
    }
  }

  // ── GATE 4 · Water ────────────────────────────────────────────────────────
  function gateWater(): Gate {
    const pts = snap.hubeau?.prelevements?.points ?? []
    const captage = pts.find((p: any) => /MARIONNAIS|PAVAIS|FENICAT/i.test(p.nom_point_prelevement ?? ''))
    return {
      id: 'water', name: 'Water — abstraction & discharge', short: 'Water',
      status: 'conditional', weight: WEIGHTS.water, readiness: 0.55,
      regulation: 'Loi sur l’eau (IOTA); SDAGE Loire-Bretagne; SAGE Vilaine',
      permitting: GATE_PERMITTING.water,
      rule: `Drinking-water captage near/under site in a protection perimeter + ${pts.length} historic abstraction points; closed-loop design lowers draw, with the make-up source and IOTA authorisation to be secured ⇒ conditional, readiness 0.55.`,
      live: {
        value: `${pts.length} withdrawal points in commune; drinking-water captage in protection perimeter (constraint)`,
        source: "Hub'Eau — référentiel points de prélèvement",
        url: snap.hubeau?.url?.prelevements ?? 'https://hubeau.eaufrance.fr',
        fetched_at: snap.hubeau?.fetched_at, confidence: 'high',
        notes: [
          'Basin: SDAGE Loire-Bretagne / SAGE Vilaine — low-flow abstraction constraints.',
          'Design make-up (REUT + rainwater) and the closed-loop draw are DESIGN TARGETS, not fetched facts.',
        ],
      },
      facts: [
        { label: 'Drinking-water captage near site', value: captage ? `${captage.nom_point_prelevement} (groundwater, since ${captage.date_exploitation_debut})` : 'La Marionnais / Pavais / Fénicat (protection perimeter)', source: "Hub'Eau / Eau du Bassin Rennais", url: 'https://www.eaudubassinrennais-collectivite.fr/notre-reseau/ressources-eau/captages-de-la-pavais-la-marionnais-fenicat/', fetched_at: snap.hubeau?.fetched_at, confidence: 'high' },
        { label: 'Historic site abstraction', value: pts.filter((p: any) => /STELLANTIS|CITROEN|PEUGEOT|PCA/i.test(p.nom_point_prelevement ?? '')).map((p: any) => p.nom_point_prelevement).join('; ') || '—', source: "Hub'Eau", url: snap.hubeau?.url?.prelevements ?? '', fetched_at: snap.hubeau?.fetched_at, confidence: 'high' },
        { label: 'Closed-loop cooling make-up (design)', value: '~40 m³/day expected; ≤150 m³/day cap — REUT + rainwater, never the drinking-water aquifer', source: 'Design study (website model)', url: 'https://www.ecologie.gouv.fr/actualites/reutilisation-eaux-usees-traitees-publication-deux-nouveaux-arretes', fetched_at: snap.hubeau?.fetched_at, confidence: 'low', designTarget: true },
      ],
    }
  }

  // ── GATE 5 · Land use ─────────────────────────────────────────────────────
  function gateLandUse(): Gate {
    const zones: string[] = (snap.gpu?.zones ?? []).map((z: any) => z.libelle).filter(Boolean)
    const rg = snap.reglement
    const graphicRead = !!(rg && rg.ok)
    return {
      id: 'land-use', name: 'Land use (PLUi)', short: 'Land use',
      status: 'conditional', weight: WEIGHTS['land-use'], readiness: graphicRead ? 0.78 : 0.7,
      regulation: `PLUi Rennes Métropole (${PLUI.partition}) — zone ${PLUI.zone}`,
      permitting: GATE_PERMITTING['land-use'],
      rule: graphicRead
        ? `Zonage UI1/UI1j permits industrial activity. Règlement graphique read at the parcel: height = ${rg.hauteur?.code ?? '—'} and végétalisation = ${rg.biotope?.code ?? '—'} both défer to the règlement littéral (UI1 permissive — gabarit 3,5 m + 45° at limits), parking secteur ${rg.stationnement?.secteur ?? '—'}, OAP sectorielle ${rg.oap ? 'covers the site' : 'not detected'}. Binding numbers resolved to the literal rule ⇒ readiness 0.78; residual = OAP content + PEB.`
        : 'Zonage UI1/UI1j permits industrial activity (confirms reconversion); règlement permissive, but height/emprise/parking/biotope deferred to graphic overlays + OAP ⇒ conditional, readiness 0.70.',
      live: {
        value: graphicRead
          ? `Zoned ${PLUI.zone} — ${PLUI.zoneFamily}; graphic read: height & biotope défer to the literal règlement, parking secteur ${rg.stationnement?.secteur ?? '—'}, OAP ${rg.oap ? 'applies' : '—'}`
          : `Zoned ${PLUI.zone} — ${PLUI.zoneFamily}; use permitted, graphic constraints pending`,
        source: 'GPU API Carto (zone-urba) + Rennes Métropole plans thématiques',
        url: 'https://apicarto.ign.fr/api/doc/gpu', fetched_at: rg?.fetched_at ?? snap.gpu?.fetched_at, confidence: 'high',
        notes: [
          `Document partition ${snap.gpu?.document?.partition ?? PLUI.partition}.`,
          `Site polygon clips zones: ${[...new Set(zones)].join(', ')}.`,
          ...(graphicRead ? [
            `Hauteur (plan thématique): ${rg.hauteur?.label ?? '—'}.`,
            `Coefficient de végétalisation: ${rg.biotope?.label ?? '—'}${rg.oap ? ' — within an OAP sector' : ''}.`,
            `Stationnement: ${rg.stationnement?.label ?? '—'}.`,
          ] : [
            `Prescriptions touching site: ${(snap.gpu?.prescriptions ?? []).map((p: any) => p.libelle).slice(0, 4).join('; ')}.`,
          ]),
        ],
      },
      facts: [
        { label: 'Site zonage (campus core)', value: `${PLUI.zone} (typezone ${PLUI.typezone})`, source: 'GPU API Carto — zone-urba', url: snap.gpu?.url?.zoneUrba ?? 'https://apicarto.ign.fr/api/gpu/zone-urba', fetched_at: snap.gpu?.fetched_at, confidence: 'high' },
        { label: 'Hauteur (plan thématique, lu au parcelle)', value: rg?.hauteur?.label ?? 'To confirm at the parcel', source: 'Rennes Métropole — plan thématique hauteurs', url: rg?.url?.hauteur ?? PLUI.viewer, fetched_at: rg?.fetched_at ?? REGLEMENT_RESEARCHED_AT, confidence: graphicRead ? 'high' : 'low' },
        { label: 'Coefficient de végétalisation (lu au parcelle)', value: rg?.biotope?.label ?? 'To confirm at the parcel', source: 'Rennes Métropole — plan thématique végétalisation', url: rg?.url?.vegetalisation ?? PLUI.viewer, fetched_at: rg?.fetched_at ?? REGLEMENT_RESEARCHED_AT, confidence: graphicRead ? 'high' : 'low' },
        { label: 'Stationnement (lu au parcelle)', value: rg?.stationnement?.label ?? 'To confirm at the parcel', source: 'Rennes Métropole — plan thématique stationnement', url: rg?.url?.stationnement ?? PLUI.viewer, fetched_at: rg?.fetched_at ?? REGLEMENT_RESEARCHED_AT, confidence: graphicRead ? 'high' : 'low' },
        { label: 'OAP sectorielle', value: rg?.oap ? 'Covers the site — content to retrieve and comply with' : 'Not detected at point', source: 'Rennes Métropole — plan thématique végétalisation (étiquette OAP)', url: PLUI.portal, fetched_at: rg?.fetched_at ?? REGLEMENT_RESEARCHED_AT, confidence: graphicRead ? 'high' : 'low' },
      ],
    }
  }

  // ── GATE 6 · Heat offtake ─────────────────────────────────────────────────
  function gateHeat(): Gate {
    const dist = snap.fcu?.nearestMainDistanceM ?? null
    const link = (snap.fcu?.points ?? []).find((p: any) => p.network_id)
    return {
      id: 'heat', name: 'Heat offtake', short: 'Heat',
      status: 'conditional', weight: WEIGHTS.heat, readiness: 0.5,
      regulation: 'Réseau de chaleur urbain (concession); ADEME Fonds Chaleur',
      permitting: GATE_PERMITTING.heat,
      rule: `Campus not on a network; nearest main (Rennes Sud 3506C) ~${dist} m away (≫ 200 m threshold) ⇒ connection is a ~2.7 km transport-main cost, not a blocker; offtake volume is a design target ⇒ conditional, readiness 0.50.`,
      live: {
        value: dist === 0 ? 'On a heat network' : `Nearest réseau de chaleur ~${dist} m away (Rennes Sud) — connectable via trunk`,
        source: 'France Chaleur Urbaine (ADEME)',
        url: 'https://france-chaleur-urbaine.beta.gouv.fr/', fetched_at: snap.fcu?.fetched_at, confidence: 'high',
        notes: [
          'Campus point: not eligible (no existing/future network at the site, distance null).',
          'Threshold: <100 m strongly connectable, 100–200 m feasible; beyond = transport-main cost.',
          'Now an OBLIGATION: Energy Code L.236 (EU 2023/1791) requires waste-heat reuse for any DC ≥1 MW unless infeasible — designing the offtake is compliance + a litigation shield, not just upside.',
        ],
      },
      facts: [
        { label: 'Nearest network', value: link ? `${link.network_name} (${link.network_id}) — ${link.gestionnaire}, ${link.rateENRR}% EnR&R, ${link.rateCO2} kgCO₂/kWh` : '—', source: 'France Chaleur Urbaine', url: 'https://france-chaleur-urbaine.beta.gouv.fr/reseaux/3506C', fetched_at: snap.fcu?.fetched_at, confidence: 'high' },
        { label: 'Straight-line distance campus → nearest main', value: `${dist} m`, source: 'France Chaleur Urbaine + haversine', url: snap.fcu?.url ?? '', fetched_at: snap.fcu?.fetched_at, confidence: 'high' },
        { label: 'Recoverable heat (~65 MW)', value: 'Design target — forward-looking offtake volume', source: 'site.json (website model)', url: 'https://france-chaleur-urbaine.beta.gouv.fr/', fetched_at: snap.fcu?.fetched_at, confidence: 'low', designTarget: true },
      ],
    }
  }

  // ── Screening variants (any-parcel mode) ─────────────────────────────────
  // The data axes (power, brownfield, water, heat) read from the snapshot and
  // generalise as-is. Only the two RESEARCHED gates embed La Janais specifics —
  // these variants replace them with live-zonage / live-ICPE reads plus an
  // explicit "needs per-parcel research" flag, never asserting La Janais's
  // discretionary findings about a different site.
  function gateEnvAuthScreening(): Gate {
    const onSite = snap.georisques?.icpe?.records?.[0]
    return {
      id: 'env-auth', name: 'Environmental authorization (ICPE)', short: 'Env. auth',
      status: 'conditional', weight: WEIGHTS['env-auth'], readiness: 0.3,
      regulation: 'ICPE nomenclature (Code de l’environnement) — IED Directive 2010/75/UE',
      permitting: GATE_PERMITTING['env-auth'],
      rule: 'Screening mode: ICPE rubriques are program- and site-specific and were NOT re-derived for this parcel. Reference (100 MW liquid-cooled DC): the backup genset fleet triggers rubrique 3110 → Autorisation environnementale. Re-classify against the actual program before trusting this gate.',
      live: {
        value: 'ICPE classification not researched for this parcel — re-derive the rubriques for the actual project',
        source: 'Reference: AIDA / Ineris nomenclature ICPE (La Janais case)',
        url: 'https://aida.ineris.fr/liste_documents/1/77495/1',
        fetched_at: ICPE_RESEARCHED_AT, confidence: 'low',
        notes: [
          'Carried from the La Janais reference, not re-researched: a 100 MW DC genset fleet → rubrique 3110 (Autorisation).',
          'The data shown below (on-site ICPE) IS live for this parcel; the régime/timeline is not.',
        ],
      },
      facts: [
        {
          label: 'Existing ICPE on/near this parcel',
          value: onSite ? `${onSite.raisonSociale ?? '—'} · ${onSite.regime ?? ''} · ${onSite.etatActivite ?? ''}` : 'none within 2 km',
          source: 'Géorisques — installations classées',
          url: snap.georisques?.url?.icpe ?? 'https://www.georisques.gouv.fr',
          fetched_at: snap.georisques?.fetched_at, confidence: 'high',
        },
      ],
    }
  }

  function gateLandUseScreening(): Gate {
    const zones: any[] = snap.gpu?.zones ?? []
    const zone = zones.find((z) => z.libelle || z.typezone) ?? {}
    const tz: string = zone.typezone ?? ''
    const libelle: string = zone.libelle ?? zone.typezone ?? '—'
    const partition = snap.gpu?.document?.partition ?? '—'
    // typezone: U = urbain, AU = à urbaniser, A = agricole, N = naturel
    const permitsBuild = tz === 'U' || tz === 'AU'
    const readiness = zones.length === 0 ? 0.3 : tz === 'U' ? 0.6 : tz === 'AU' ? 0.5 : 0.25
    const status: Status = zones.length === 0 ? 'conditional' : permitsBuild ? 'conditional' : 'gating'
    return {
      id: 'land-use', name: 'Land use (PLU/PLUi)', short: 'Land use',
      status, weight: WEIGHTS['land-use'], readiness,
      regulation: `PLU/PLUi (${partition})`,
      permitting: GATE_PERMITTING['land-use'],
      rule: zones.length === 0
        ? 'Screening: no zonage returned at this point from the GPU (commune may not have a dematerialised document). Confirm the PLU/PLUi manually.'
        : `Screening: zonage read live (${libelle}, typezone ${tz || '?'}). ${permitsBuild ? 'An urban/à-urbaniser zone — industrial use is plausibly admissible, subject to the zone règlement.' : 'Not an urban zone — heavy industrial/DC use is likely restricted here.'} The règlement specifics (height, emprise, biotope, permitted uses) require per-parcel research.`,
      live: {
        value: zones.length === 0 ? 'No GPU zonage at this point — confirm the local document' : `Zoned ${libelle} (typezone ${tz || '?'}) — règlement specifics need per-parcel research`,
        source: 'GPU API Carto (zone-urba)',
        url: snap.gpu?.url?.zoneUrba ?? 'https://apicarto.ign.fr/api/doc/gpu',
        fetched_at: snap.gpu?.fetched_at, confidence: zones.length ? 'high' : 'low',
        notes: [
          `Document partition: ${partition}.`,
          `Prescriptions touching the footprint: ${(snap.gpu?.prescriptions ?? []).map((p: any) => p.libelle).filter(Boolean).slice(0, 4).join('; ') || 'none returned'}.`,
        ],
      },
      facts: [
        { label: 'Zonage at footprint', value: `${libelle}${tz ? ` (typezone ${tz})` : ''}`, source: 'GPU API Carto — zone-urba', url: snap.gpu?.url?.zoneUrba ?? '', fetched_at: snap.gpu?.fetched_at, confidence: zones.length ? 'high' : 'low' },
        { label: 'Urbanism document', value: partition, source: 'GPU API Carto — document', url: snap.gpu?.url?.document ?? '', fetched_at: snap.gpu?.fetched_at, confidence: 'high' },
        { label: 'Règlement specifics', value: 'Not researched for this parcel — read the zone règlement + graphique', source: 'per-parcel research required', url: 'https://www.geoportail-urbanisme.gouv.fr/', fetched_at: ICPE_RESEARCHED_AT, confidence: 'low' },
      ],
    }
  }

  const gates: Gate[] = mode === 'screening'
    ? [gateEnvAuthScreening(), gatePower(), gateBrownfield(), gateWater(), gateLandUseScreening(), gateHeat()]
    : [gateEnvAuth(), gatePower(), gateBrownfield(), gateWater(), gateLandUse(), gateHeat()]

  const sumW = gates.reduce((s, g) => s + g.weight, 0)
  const composite = gates.reduce((s, g) => s + g.readiness * g.weight, 0) / sumW

  // Bottleneck = earliest NON-precursor step whose gates include a non-cleared
  // gating gate. A gate is "cleared" when status === 'clear'.
  const gatingIds = new Set(gates.filter((g) => g.status === 'gating').map((g) => g.id))
  const clearIds = new Set(gates.filter((g) => g.status === 'clear').map((g) => g.id))
  const isBlocking = (s: (typeof PATHWAY_TEMPLATE)[number]) =>
    !s.precursor && s.gates.some((gid) => gatingIds.has(gid))
  let bottleneckIdx = PATHWAY_TEMPLATE.findIndex(isBlocking)
  if (bottleneckIdx < 0)
    bottleneckIdx = PATHWAY_TEMPLATE.findIndex((s) => !s.precursor && s.gates.some((gid) => !clearIds.has(gid)))

  const pathway: PathwayStep[] = PATHWAY_TEMPLATE.map((s, i) => ({
    id: s.id, label: s.label, authority: s.authority, gates: s.gates,
    state: i < bottleneckIdx ? 'cleared' : i === bottleneckIdx ? 'active' : 'pending',
    note: s.note,
  }))
  const bottleneck = PATHWAY_TEMPLATE[bottleneckIdx].id

  const unresolved: string[] = mode === 'screening'
    ? [
        '[screening] Data axes (land-use zonage, brownfield, power register, water, heat) are LIVE for this parcel; the discretionary/researched gates below are carried from the La Janais reference and must be re-researched.',
        '[env-auth] ICPE rubriques not re-derived — re-classify the actual program against the current nomenclature (autorisation vs enregistrement vs déclaration).',
        '[land-use] PLU/PLUi règlement specifics (height, emprise, biotope, permitted uses, OAP) not read at this parcel.',
        '[footprint] Geometry is a ~200 m screening square around the geocoded point, not the cadastral parcel — refine with the real boundary for intersects.',
      ]
    : [
        '[env-auth · #1 leverage] Exact genset thermal total — confirms the 2910-vs-3110 boundary (Enregistrement vs Autorisation). Drives the whole env-auth timeline.',
        '[power · #2 leverage] 100 MW HTB consumption connection: RTE study not initiated; Poste de La Janais MVA acceptance not public.',
        '[brownfield · #3 leverage] Obtain the Stellantis ICPE cessation / état des sols (site still in exploitation) and confirm any SIS over the parcels.',
        ...LANDUSE_UNRESOLVED.map((u) => `[land-use] ${u}`),
        '[env-auth] Confirm the total diesel inventory to set the 4734 fuel-storage band (DC/E/A).',
        '[env-auth] Secure PINM eligibility for La Janais (affects timeline, not classification).',
        '[water] Secure the cooling make-up source (REUT/rainwater) and the IOTA abstraction/discharge authorisation.',
        '[water] River-basin abstraction governed by SDAGE Loire-Bretagne and SAGE Vilaine low-flow constraints.',
      ]

  return {
    site: {
      name: opts.siteName ?? (mode === 'screening' ? `Screening — ${snap.site.commune}` : 'Data centre campus — La Janais'),
      commune: snap.site.commune, insee: snap.site.insee,
      centroid: snap.site.centroid, campus_point: snap.site.campus_point,
    },
    mode,
    referenceNote: mode === 'screening'
      ? 'Screening assessment for a 100 MW liquid-cooled data centre. The five data axes are fetched live for this parcel; env-auth classification and the PLU/PLUi règlement specifics are carried from the La Janais reference and flagged for per-parcel research.'
      : undefined,
    generated_at: new Date().toISOString(),
    gates, composite, verdict: verdictFromComposite(composite),
    pathway, bottleneck, unresolved,
  }
}

/** Read the cached normalized snapshot from disk. */
export function loadSnapshot(): Snapshot {
  return JSON.parse(readFileSync(resolve(ROOT, 'cache', 'normalized.json'), 'utf8'))
}

/** Persist the model to src/data/model.json (client import) + cache/model.json. */
export function writeModel(model: FeasibilityModel): void {
  mkdirSync(resolve(ROOT, 'src', 'data'), { recursive: true })
  writeFileSync(resolve(ROOT, 'src', 'data', 'model.json'), JSON.stringify(model, null, 2), 'utf8')
  writeFileSync(resolve(ROOT, 'cache', 'model.json'), JSON.stringify(model, null, 2), 'utf8')
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const model = buildModel(loadSnapshot())
  writeModel(model)
  console.log('✓ model written → src/data/model.json')
  console.log(`  composite readiness: ${(model.composite * 100).toFixed(1)}%  → ${model.verdict}`)
  console.log(`  bottleneck: ${model.bottleneck}`)
  for (const g of model.gates) {
    console.log(`    ${g.short.padEnd(11)} w=${String(g.weight).padStart(2)}  readiness=${(g.readiness * 100).toFixed(0).padStart(3)}%  ${g.status}`)
  }
}
