// ─────────────────────────────────────────────────────────────────────────────
//  SVG Exporter
//
//  Generates a scalable vector graphic (SVG) of the CAD drawing by
//  rendering the cadDrawingRenderer output into an SVG wrapper.
//  The SVG embeds the raster image so it retains all visual fidelity
//  (dimensions, rulers, labels) while being viewable in any SVG-capable tool.
//
//  For a pure-vector CAD interchange format, use the DXF exporter instead.
//
//  Usage:
//    await downloadDrawingSVG(layoutStore, { title: 'Warehouse A' });
// ─────────────────────────────────────────────────────────────────────────────

import { renderCADDrawingBlob } from './cadDrawingRenderer.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read blob as data URL.'));
    reader.readAsDataURL(blob);
  });
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getImageDimensions(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image for dimension measurement.'));
    img.src = dataURL;
  });
}

// ── SVG builder ─────────────────────────────────────────────────────────────

function buildSVG(dataURL, width, height, title) {
  const escapedTitle = escapeXml(title);
  return [
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    `     xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `     width="${width}" height="${height}"`,
    `     viewBox="0 0 ${width} ${height}">`,
    `  <title>${escapedTitle}</title>`,
    `  <desc>CAD layout drawing exported from RackEditor</desc>`,
    `  <image width="${width}" height="${height}"`,
    `         xlink:href="${dataURL}" />`,
    `</svg>`,
  ].join('\n');
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate the CAD drawing as an SVG string.
 *
 * @param {import('../layout/layoutStore.js').LayoutStore} layoutStore
 * @param {Object}  [options]
 * @param {string}  [options.title='Untitled Layout']
 * @param {number}  [options.scale=2]   - DPI multiplier for embedded raster
 * @returns {Promise<string>} SVG markup
 */
export async function generateDrawingSVG(layoutStore, options = {}) {
  const {
    title = 'Untitled Layout',
    scale = 2,
  } = options;

  const blob = await renderCADDrawingBlob(layoutStore, {
    title,
    format: 'png',
    quality: 1,
    scale,
  });

  const dataURL = await blobToDataURL(blob);
  const dims = await getImageDimensions(dataURL);

  return buildSVG(dataURL, dims.width, dims.height, title);
}

/**
 * Generate and download the CAD drawing as an SVG file.
 *
 * @param {import('../layout/layoutStore.js').LayoutStore} layoutStore
 * @param {Object}  [options]
 * @param {string}  [options.title='Untitled Layout']
 * @param {number}  [options.scale=2]
 * @param {string}  [options.filename]
 * @returns {Promise<void>}
 */
export async function downloadDrawingSVG(layoutStore, options = {}) {
  const {
    title = 'Untitled Layout',
    scale = 2,
    filename,
  } = options;

  const svg = await generateDrawingSVG(layoutStore, { title, scale });
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });

  const safeName = sanitizeFilename(filename || `${title}.svg`);
  triggerDownload(blob, safeName);
}

/**
 * Generate the SVG and return it as a Blob.
 *
 * @param {import('../layout/layoutStore.js').LayoutStore} layoutStore
 * @param {Object}  [options]
 * @returns {Promise<Blob>}
 */
export async function getDrawingSVGBlob(layoutStore, options = {}) {
  const svg = await generateDrawingSVG(layoutStore, options);
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

// ── Internal ────────────────────────────────────────────────────────────────

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
