// ─────────────────────────────────────────────────────────────────────────────
//  Image Exporter
//
//  Downloads the CAD drawing as a raster image (PNG, JPEG, or WebP).
//  Delegates rendering to the cadDrawingRenderer primitive.
//
//  Usage:
//    await downloadDrawingImage(layoutStore, { title: 'My Layout', format: 'png' });
// ─────────────────────────────────────────────────────────────────────────────

import { renderCADDrawingBlob } from './cadDrawingRenderer.js';

const MIME_TYPES = {
  png:  'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const EXTENSIONS = {
  png:  '.png',
  jpeg: '.jpg',
  webp: '.webp',
};

/**
 * Download the CAD drawing as a raster image file.
 *
 * @param {import('../layout/layoutStore.js').LayoutStore} layoutStore
 * @param {Object}  [options]
 * @param {string}  [options.title='Untitled Layout']  - Title shown in drawing title block
 * @param {string}  [options.format='png']              - 'png' | 'jpeg' | 'webp'
 * @param {number}  [options.quality=0.92]              - Compression quality (lossy formats)
 * @param {number}  [options.scale=2]                   - DPI multiplier
 * @param {string}  [options.filename]                  - Override output filename
 * @returns {Promise<void>}
 */
export async function downloadDrawingImage(layoutStore, options = {}) {
  const {
    title = 'Untitled Layout',
    format = 'png',
    quality = 0.92,
    scale = 2,
    filename,
  } = options;

  const normalizedFormat = format.toLowerCase();
  if (!MIME_TYPES[normalizedFormat]) {
    throw new Error(`Unsupported image format: "${format}". Use png, jpeg, or webp.`);
  }

  const blob = await renderCADDrawingBlob(layoutStore, {
    title,
    format: normalizedFormat,
    quality,
    scale,
  });

  const ext = EXTENSIONS[normalizedFormat];
  const safeName = sanitizeFilename(filename || `${title}${ext}`);

  triggerDownload(blob, safeName);
}

/**
 * Get the CAD drawing as a data URL string (for embedding in other documents).
 *
 * @param {import('../layout/layoutStore.js').LayoutStore} layoutStore
 * @param {Object}  [options]  - Same options as downloadDrawingImage
 * @returns {Promise<string>}  data:image/…;base64,… URL
 */
export async function getDrawingDataURL(layoutStore, options = {}) {
  const {
    title = 'Untitled Layout',
    format = 'png',
    quality = 0.92,
    scale = 2,
  } = options;

  const blob = await renderCADDrawingBlob(layoutStore, {
    title,
    format,
    quality,
    scale,
  });

  return blobToDataURL(blob);
}

// ── Internal helpers ────────────────────────────────────────────────────────

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
