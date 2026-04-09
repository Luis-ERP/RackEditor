// ─────────────────────────────────────────────────────────────────────────────
//  PDF Exporter
//
//  Generates a professional PDF document containing the CAD drawing.
//  Uses jsPDF (already a project dependency) and the cadDrawingRenderer
//  primitive to produce the raster image embedded in the PDF.
//
//  The PDF includes:
//    • Cover page with project title and metadata
//    • Full-page CAD drawing (landscape, fitted to page)
//
//  Usage:
//    await downloadDrawingPDF(layoutStore, { title: 'Warehouse A' });
// ─────────────────────────────────────────────────────────────────────────────

import { jsPDF } from 'jspdf';
import { renderCADDrawingBlob } from './cadDrawingRenderer.js';

// ── Page constants (mm) ─────────────────────────────────────────────────────

const MARGIN = 10;

const COLOR = {
  primary: [30, 64, 120],
  dark:    [33, 37, 41],
  medium:  [108, 117, 125],
  border:  [200, 206, 212],
};

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

function formatDate() {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

// ── Cover page renderer ─────────────────────────────────────────────────────

function drawCoverPage(doc, title, entityCount) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header line
  doc.setDrawColor(...COLOR.primary);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, 40, pageW - MARGIN, 40);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...COLOR.primary);
  doc.text(title, MARGIN, 60);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR.medium);
  doc.text('CAD Layout Drawing', MARGIN, 72);

  // Metadata table
  const meta = [
    ['Generated',  formatDate()],
    ['Application', 'RackEditor'],
    ['Units',       'Metres (1 DU = 1 m)'],
    ['Entities',    String(entityCount)],
  ];

  let y = 100;
  doc.setFontSize(10);
  for (const [label, value] of meta) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR.dark);
    doc.text(label, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR.medium);
    doc.text(value, MARGIN + 35, y);
    y += 7;
  }

  // Footer line
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, pageH - 20, pageW - MARGIN, pageH - 20);

  doc.setFontSize(8);
  doc.setTextColor(...COLOR.medium);
  doc.text(
    `RackEditor  ·  ${formatDate()}`,
    MARGIN,
    pageH - 14,
  );
}

// ── Drawing page renderer ───────────────────────────────────────────────────

async function drawLayoutPage(doc, layoutStore, title) {
  // Render the CAD image at high resolution
  const blob = await renderCADDrawingBlob(layoutStore, {
    title,
    format: 'png',
    quality: 1,
    scale: 2,
  });

  const dataURL = await blobToDataURL(blob);

  // Read the intrinsic pixel dimensions from the blob
  const dims = await getImageDimensions(dataURL);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usableW = pageW - MARGIN * 2;
  const usableH = pageH - MARGIN * 2 - 10; // reserve 10mm for footer

  // Fit image proportionally
  const imgAspect = dims.width / dims.height;
  const areaAspect = usableW / usableH;

  let imgW, imgH;
  if (imgAspect > areaAspect) {
    imgW = usableW;
    imgH = usableW / imgAspect;
  } else {
    imgH = usableH;
    imgW = usableH * imgAspect;
  }

  const imgX = MARGIN + (usableW - imgW) / 2;
  const imgY = MARGIN + (usableH - imgH) / 2;

  doc.addImage(dataURL, 'PNG', imgX, imgY, imgW, imgH);

  // Thin border around the image area
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.2);
  doc.rect(imgX, imgY, imgW, imgH);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(...COLOR.medium);
  doc.text(
    `${title}  ·  Scale: Fit to Page  ·  ${formatDate()}`,
    MARGIN,
    pageH - MARGIN + 2,
  );
}

function getImageDimensions(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image for dimension measurement.'));
    img.src = dataURL;
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a PDF document containing the CAD drawing.
 *
 * @param {import('../layout/layoutStore.js').LayoutStore} layoutStore
 * @param {Object}  [options]
 * @param {string}  [options.title='Untitled Layout']  - Drawing/project title
 * @param {boolean} [options.includeCover=true]         - Include a cover page
 * @returns {Promise<jsPDF>} The generated PDF document instance
 */
export async function generateDrawingPDF(layoutStore, options = {}) {
  const {
    title = 'Untitled Layout',
    includeCover = true,
  } = options;

  const entityCount = layoutStore.getAll().filter((e) => e.visible).length;

  // Drawing page is landscape for best layout fit
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: includeCover ? 'portrait' : 'landscape',
  });

  // Cover page (portrait)
  if (includeCover) {
    drawCoverPage(doc, title, entityCount);
    doc.addPage('a4', 'landscape');
  }

  // Drawing page (landscape)
  await drawLayoutPage(doc, layoutStore, title);

  return doc;
}

/**
 * Generate and immediately download the CAD drawing as a PDF.
 *
 * @param {import('../layout/layoutStore.js').LayoutStore} layoutStore
 * @param {Object}  [options]
 * @param {string}  [options.title='Untitled Layout']
 * @param {boolean} [options.includeCover=true]
 * @param {string}  [options.filename]     - Override output filename
 * @returns {Promise<void>}
 */
export async function downloadDrawingPDF(layoutStore, options = {}) {
  const {
    title = 'Untitled Layout',
    includeCover = true,
    filename,
  } = options;

  const doc = await generateDrawingPDF(layoutStore, { title, includeCover });

  const safeName = sanitizeFilename(filename || `${title}.pdf`);
  doc.save(safeName);
}

/**
 * Generate the PDF and return it as a Blob (for embedding or uploading).
 *
 * @param {import('../layout/layoutStore.js').LayoutStore} layoutStore
 * @param {Object}  [options]  - Same as generateDrawingPDF
 * @returns {Promise<Blob>}
 */
export async function getDrawingPDFBlob(layoutStore, options = {}) {
  const doc = await generateDrawingPDF(layoutStore, options);
  return doc.output('blob');
}
