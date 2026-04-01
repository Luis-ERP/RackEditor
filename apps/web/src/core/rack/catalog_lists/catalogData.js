// ─────────────────────────────────────────────────────────────────────────────
//  Catalog Data — CSV transformation
//
//  Parses beams.csv and frames.csv (the source of truth) into typed JS arrays.
//  The CSV files are imported as raw strings via the webpack asset/source rule
//  configured in next.config.mjs.
//
//  Consumers should import BEAMS_CSV and FRAMES_CSV from this file rather than
//  reading the CSV files directly.
// ─────────────────────────────────────────────────────────────────────────────

import beamsCsvRaw  from './beams.csv';
import framesCsvRaw from './frames.csv';

// ── Generic CSV parser ────────────────────────────────────────────────────────

function parseCsv(raw) {
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]?.trim() ?? ''; });
    return row;
  });
}

// ── Beams ─────────────────────────────────────────────────────────────────────

/**
 * All rows from beams.csv with numeric fields coerced.
 * Columns used: gauge, width_in, height_in, price, load_capacity_kg, sku
 *
 * @type {{ gauge: number, width_in: number, height_in: number, price: number, load_capacity_kg: number, sku: string }[]}
 */
export const BEAMS_CSV = parseCsv(beamsCsvRaw).map((r) => ({
  gauge:             parseInt(r.gauge, 10),
  width_in:          parseFloat(r.width_in),
  height_in:         parseFloat(r.height_in),
  price:             parseFloat(r.price),
  load_capacity_kg:  parseFloat(r.load_capacity_kg),
  sku:               r.sku,
}));

// ── Frames ────────────────────────────────────────────────────────────────────

/**
 * All rows from frames.csv with numeric fields coerced.
 * Columns used: height_in, depth_in, beam_separation_in, gauge, load_capacity_kg, cost, sku
 *
 * @type {{ height_in: number, depth_in: number, beam_separation_in: number, gauge: number, load_capacity_kg: number, cost: number, sku: string }[]}
 */
export const FRAMES_CSV = parseCsv(framesCsvRaw).map((r) => ({
  height_in:          parseInt(r.height_in, 10),
  depth_in:           parseInt(r.depth_in, 10),
  beam_separation_in: parseInt(r.beam_separation_in, 10),
  gauge:              parseInt(r.gauge, 10),
  load_capacity_kg:   parseFloat(r.load_capacity_kg),
  cost:               parseFloat(r.cost),
  sku:                r.sku,
}));
