// ─────────────────────────────────────────────────────────────────────────────
//  PDF Quote Generator
//
//  Generates a professional PDF quote document using jsPDF.
//  Respects quote_format_settings.display_values to show/hide sections.
// ─────────────────────────────────────────────────────────────────────────────

import { jsPDF } from 'jspdf';
import { ENTRY_TYPE } from './schemas/common.js';
import { roundCurrency } from './schemas/common.js';

// ── Brand & Layout Constants ─────────────────────────────────────────────────

const PAGE = {
  marginLeft: 20,
  marginRight: 20,
  marginTop: 20,
  marginBottom: 25,
  width: 210,   // A4 mm
  height: 297,
};

const COLOR = {
  primary:    [30, 64, 120],    // deep navy
  accent:     [41, 98, 180],    // steel blue
  dark:       [33, 37, 41],     // near-black text
  medium:     [108, 117, 125],  // secondary text
  light:      [248, 249, 250],  // table stripe
  border:     [222, 226, 230],  // subtle borders
  white:      [255, 255, 255],
  green:      [25, 135, 84],
  red:        [220, 53, 69],
};

const FONT = { normal: 'helvetica', bold: 'helvetica' };

// ── Formatting Helpers ───────────────────────────────────────────────────────

function fmtCurrency(value) {
  return `$${roundCurrency(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPercent(value, digits = 1) {
  return `${roundCurrency(value * 100, digits)}%`;
}

function fmtDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

function fmtShortDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

// ── PDF Drawing Utilities ────────────────────────────────────────────────────

function contentWidth() {
  return PAGE.width - PAGE.marginLeft - PAGE.marginRight;
}

function setColor(doc, rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function setFillColor(doc, rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setDrawColor(doc, rgb) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

/**
 * Check if we need a new page and add one if so.
 * Returns the new Y position.
 */
function ensureSpace(doc, y, needed) {
  if (y + needed > PAGE.height - PAGE.marginBottom) {
    doc.addPage();
    return PAGE.marginTop;
  }
  return y;
}

/**
 * Draw a horizontal rule.
 */
function drawHR(doc, y, color = COLOR.border) {
  setDrawColor(doc, color);
  doc.setLineWidth(0.3);
  doc.line(PAGE.marginLeft, y, PAGE.width - PAGE.marginRight, y);
  return y + 2;
}

/**
 * Draw a filled rectangle.
 */
function drawRect(doc, x, y, w, h, color) {
  setFillColor(doc, color);
  doc.rect(x, y, w, h, 'F');
}

/**
 * Print text with word-wrap and return the new Y.
 */
function printWrapped(doc, text, x, y, maxWidth, lineHeight = 4.5) {
  const lines = doc.splitTextToSize(String(text ?? ''), maxWidth);
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight + 2);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

// ── Section Renderers ────────────────────────────────────────────────────────

function renderHeader(doc, quote) {
  let y = PAGE.marginTop;

  // Top accent bar
  drawRect(doc, 0, 0, PAGE.width, 8, COLOR.primary);

  y = 18;

  // Company / Quote title area
  doc.setFont(FONT.bold, 'bold');
  doc.setFontSize(22);
  setColor(doc, COLOR.primary);
  doc.text('QUOTE', PAGE.marginLeft, y);

  // Quote number and date on the right
  doc.setFont(FONT.normal, 'normal');
  doc.setFontSize(9);
  setColor(doc, COLOR.medium);
  const rightX = PAGE.width - PAGE.marginRight;

  if (quote.order_number) {
    doc.text(quote.order_number, rightX, y - 6, { align: 'right' });
  }
  doc.text(`Date: ${fmtDate(quote.audit?.createdAt)}`, rightX, y, { align: 'right' });

  // Status badge
  const statusText = (quote.status ?? 'draft').toUpperCase();
  y += 4;
  doc.setFontSize(8);
  doc.setFont(FONT.bold, 'bold');
  setColor(doc, COLOR.accent);
  doc.text(statusText, PAGE.marginLeft, y);

  y += 4;
  y = drawHR(doc, y, COLOR.primary);

  return y + 2;
}

function renderClientSection(doc, quote, y) {
  const client = quote.client;
  if (!client) return y;

  y = ensureSpace(doc, y, 38);

  doc.setFont(FONT.bold, 'bold');
  doc.setFontSize(10);
  setColor(doc, COLOR.primary);
  doc.text('PREPARED FOR', PAGE.marginLeft, y);
  y += 6;

  doc.setFont(FONT.normal, 'normal');
  doc.setFontSize(9);
  setColor(doc, COLOR.dark);

  const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ');
  if (client.organization_name) {
    doc.setFont(FONT.bold, 'bold');
    doc.text(client.organization_name, PAGE.marginLeft, y);
    doc.setFont(FONT.normal, 'normal');
    y += 5;
  }
  if (clientName) {
    doc.text(clientName, PAGE.marginLeft, y);
    y += 5;
  }
  if (client.email) {
    doc.text(client.email, PAGE.marginLeft, y);
    y += 5;
  }
  if (client.phone) {
    doc.text(client.phone, PAGE.marginLeft, y);
    y += 5;
  }

  y += 4;
  return y;
}

function renderQuoteDetails(doc, quote, y) {
  y = ensureSpace(doc, y, 24);

  const colLeft = PAGE.marginLeft;
  const colRight = PAGE.width / 2 + 10;

  doc.setFont(FONT.bold, 'bold');
  doc.setFontSize(10);
  setColor(doc, COLOR.primary);
  doc.text('QUOTE DETAILS', colLeft, y);
  y += 7;

  doc.setFontSize(8.5);
  const details = [
    ['Quote Number', quote.order_number || '—'],
    ['Date Issued', fmtShortDate(quote.audit?.createdAt)],
    ['Valid Until', '30 days from issue date'],
    ['Prepared By', quote.audit?.createdBy || '—'],
  ];

  for (const [label, value] of details) {
    y = ensureSpace(doc, y, 6);
    doc.setFont(FONT.normal, 'normal');
    setColor(doc, COLOR.medium);
    doc.text(label, colLeft, y);
    setColor(doc, COLOR.dark);
    doc.setFont(FONT.bold, 'bold');
    doc.text(value, colLeft + 42, y);
    y += 5;
  }

  y += 4;
  return y;
}

/**
 * Build the visible columns array from format settings.
 */
function buildLineItemColumns(formatLineItems) {
  const cols = [];
  // SKU is always shown when name is shown (combined column)
  if (formatLineItems?.name !== false)       cols.push({ key: 'name',       label: 'Description',  align: 'left', flex: 3 });
  if (formatLineItems?.description !== false) cols.push({ key: 'description', label: 'Details',     align: 'left', flex: 2 });
  if (formatLineItems?.cost !== false)       cols.push({ key: 'cost',       label: 'Cost',         align: 'right', flex: 1 });
  if (formatLineItems?.unit_price !== false) cols.push({ key: 'unit_price', label: 'Unit Price',   align: 'right', flex: 1 });
  if (formatLineItems?.quantity !== false)   cols.push({ key: 'quantity',   label: 'Qty',          align: 'right', flex: 0.7 });
  if (formatLineItems?.discount !== false)   cols.push({ key: 'discount',   label: 'Discount',     align: 'right', flex: 1 });
  if (formatLineItems?.total !== false)      cols.push({ key: 'total',      label: 'Amount',       align: 'right', flex: 1.2 });
  return cols;
}

function getColumnWidths(columns, totalWidth) {
  const totalFlex = columns.reduce((s, c) => s + c.flex, 0);
  return columns.map((c) => (c.flex / totalFlex) * totalWidth);
}

function getCellValue(item, key) {
  switch (key) {
    case 'name': {
      const sku = item.variant?.sku ?? item.traceability?.sku ?? '';
      return sku ? `${item.name}\n${sku}` : item.name;
    }
    case 'description':
      return item.description || '—';
    case 'cost':
      return fmtCurrency(item.cost);
    case 'unit_price':
      return fmtCurrency(item.price);
    case 'quantity':
      return String(item.quantity);
    case 'discount': {
      if (!item.discount || item.discount.kind === 'NONE' || item.discount.value === 0) return '—';
      if (item.discount.kind === 'PERCENTAGE') return `${roundCurrency(item.discount.value, 1)}%`;
      return fmtCurrency(item.discount.value);
    }
    case 'total':
      return fmtCurrency(item.total);
    default:
      return '';
  }
}

function renderLineItemsTable(doc, quote, y, formatLineItems) {
  const items = quote.line_items ?? [];
  if (items.length === 0) return y;

  y = ensureSpace(doc, y, 20);

  doc.setFont(FONT.bold, 'bold');
  doc.setFontSize(10);
  setColor(doc, COLOR.primary);
  doc.text('LINE ITEMS', PAGE.marginLeft, y);
  y += 7;

  const columns = buildLineItemColumns(formatLineItems);
  if (columns.length === 0) return y;

  const tableWidth = contentWidth();
  const colWidths = getColumnWidths(columns, tableWidth);
  const rowHeight = 7;
  const headerHeight = 8;
  const cellPadding = 2;

  // ── Table Header ──
  y = ensureSpace(doc, y, headerHeight + 4);
  drawRect(doc, PAGE.marginLeft, y - 1, tableWidth, headerHeight, COLOR.primary);
  doc.setFont(FONT.bold, 'bold');
  doc.setFontSize(7.5);
  setColor(doc, COLOR.white);

  let xPos = PAGE.marginLeft;
  for (let c = 0; c < columns.length; c++) {
    const col = columns[c];
    const cellX = col.align === 'right' ? xPos + colWidths[c] - cellPadding : xPos + cellPadding;
    doc.text(col.label.toUpperCase(), cellX, y + 4.5, { align: col.align === 'right' ? 'right' : 'left' });
    xPos += colWidths[c];
  }
  y += headerHeight + 1;

  // ── Table Rows ──
  doc.setFontSize(8);
  for (let r = 0; r < items.length; r++) {
    const item = items[r];
    const isStripe = r % 2 === 0;

    // Estimate row height (multiline support)
    const nameVal = getCellValue(item, 'name');
    const nameLines = doc.splitTextToSize(nameVal, colWidths[0] - cellPadding * 2);
    const thisRowHeight = Math.max(rowHeight, nameLines.length * 4 + 3);

    y = ensureSpace(doc, y, thisRowHeight + 2);

    if (isStripe) {
      drawRect(doc, PAGE.marginLeft, y - 1, tableWidth, thisRowHeight, COLOR.light);
    }

    xPos = PAGE.marginLeft;
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const value = getCellValue(item, col.key);

      doc.setFont(col.key === 'name' ? FONT.bold : FONT.normal, col.key === 'name' ? 'bold' : 'normal');
      setColor(doc, col.key === 'total' ? COLOR.primary : COLOR.dark);

      if (col.key === 'name') {
        // Name column: multiline
        const lines = doc.splitTextToSize(value, colWidths[c] - cellPadding * 2);
        let lineY = y + 3;
        for (let l = 0; l < lines.length; l++) {
          doc.setFontSize(l === 0 ? 8 : 7);
          if (l > 0) setColor(doc, COLOR.medium);
          doc.text(lines[l], xPos + cellPadding, lineY);
          lineY += 4;
        }
        doc.setFontSize(8);
      } else {
        const cellX = col.align === 'right' ? xPos + colWidths[c] - cellPadding : xPos + cellPadding;
        doc.text(value, cellX, y + 3.5, { align: col.align === 'right' ? 'right' : 'left' });
      }

      xPos += colWidths[c];
    }

    // Row separator
    setDrawColor(doc, COLOR.border);
    doc.setLineWidth(0.15);
    doc.line(PAGE.marginLeft, y + thisRowHeight - 1, PAGE.marginLeft + tableWidth, y + thisRowHeight - 1);

    y += thisRowHeight;
  }

  y += 4;
  return y;
}

function renderSummarySection(doc, quote, y, displaySettings) {
  y = ensureSpace(doc, y, 60);

  // Summary box on the right side
  const boxWidth = 85;
  const boxX = PAGE.width - PAGE.marginRight - boxWidth;
  const labelX = boxX + 4;
  const valueX = boxX + boxWidth - 4;
  const rowH = 5.5;

  doc.setFont(FONT.bold, 'bold');
  doc.setFontSize(10);
  setColor(doc, COLOR.primary);
  doc.text('SUMMARY', boxX, y);
  y += 7;

  const startY = y;
  doc.setFontSize(8.5);

  // Subtotal
  doc.setFont(FONT.normal, 'normal');
  setColor(doc, COLOR.dark);
  doc.text('Subtotal', labelX, y);
  doc.text(fmtCurrency(quote.subtotal), valueX, y, { align: 'right' });
  y += rowH;

  // Discounts
  if (displaySettings?.discounts !== false && quote.total_discounts > 0) {
    setColor(doc, COLOR.green);
    doc.text('Discounts', labelX, y);
    doc.text(`−${fmtCurrency(quote.total_discounts)}`, valueX, y, { align: 'right' });
    y += rowH;

    // Individual discounts
    if (quote.discounts?.length > 0) {
      doc.setFontSize(7.5);
      setColor(doc, COLOR.medium);
      for (const d of quote.discounts) {
        const suffix = d.type === ENTRY_TYPE.PERCENTAGE ? ` (${d.value}%)` : '';
        doc.text(`  ${d.name}${suffix}`, labelX, y);
        y += 4;
      }
      doc.setFontSize(8.5);
    }
  }

  // Shipping
  if (displaySettings?.shipping !== false && quote.shipping > 0) {
    setColor(doc, COLOR.dark);
    doc.text('Shipping', labelX, y);
    doc.text(fmtCurrency(quote.shipping), valueX, y, { align: 'right' });
    y += rowH;
  }

  // Fees
  if (displaySettings?.fees !== false && quote.total_fees > 0) {
    setColor(doc, COLOR.dark);
    doc.text('Fees', labelX, y);
    doc.text(fmtCurrency(quote.total_fees), valueX, y, { align: 'right' });
    y += rowH;

    if (quote.fees?.length > 0) {
      doc.setFontSize(7.5);
      setColor(doc, COLOR.medium);
      for (const f of quote.fees) {
        const suffix = f.type === ENTRY_TYPE.PERCENTAGE ? ` (${f.value}%)` : '';
        doc.text(`  ${f.name}${suffix}`, labelX, y);
        y += 4;
      }
      doc.setFontSize(8.5);
    }
  }

  // Tax
  if (displaySettings?.tax_rates !== false && quote.total_tax_rates > 0) {
    y += 1;
    setDrawColor(doc, COLOR.border);
    doc.setLineWidth(0.2);
    doc.line(labelX, y, valueX, y);
    y += 4;

    setColor(doc, COLOR.dark);
    doc.text(`Tax (${fmtPercent(quote.total_tax_rates)})`, labelX, y);
    doc.text(fmtCurrency(quote.tax_amount), valueX, y, { align: 'right' });
    y += rowH;

    // Individual tax rates
    if (quote.tax_rates?.length > 0) {
      doc.setFontSize(7.5);
      setColor(doc, COLOR.medium);
      for (const r of quote.tax_rates) {
        doc.text(`  ${r.name} (${fmtPercent(r.rate)})`, labelX, y);
        const taxBase = quote.subtotal - quote.total_discounts + quote.shipping + quote.total_fees;
        doc.text(fmtCurrency(taxBase * r.rate), valueX, y, { align: 'right' });
        y += 4;
      }
      doc.setFontSize(8.5);
    }
  }

  // ── Total ──
  y += 2;
  drawRect(doc, boxX, y - 1, boxWidth, 10, COLOR.primary);
  doc.setFont(FONT.bold, 'bold');
  doc.setFontSize(10);
  setColor(doc, COLOR.white);
  doc.text('TOTAL', labelX, y + 5.5);
  doc.text(fmtCurrency(quote.total), valueX, y + 5.5, { align: 'right' });
  y += 14;

  return y;
}

function renderTermsAndConditions(doc, y) {
  y = ensureSpace(doc, y, 45);

  y += 6;
  y = drawHR(doc, y, COLOR.border);
  y += 4;

  doc.setFont(FONT.bold, 'bold');
  doc.setFontSize(9);
  setColor(doc, COLOR.primary);
  doc.text('TERMS & CONDITIONS', PAGE.marginLeft, y);
  y += 6;

  doc.setFont(FONT.normal, 'normal');
  doc.setFontSize(7.5);
  setColor(doc, COLOR.medium);

  const terms = [
    '1. This quote is valid for 30 days from the date of issue unless otherwise stated.',
    '2. Prices are quoted in USD and are subject to applicable taxes as indicated above.',
    '3. Payment terms: Net 30 days from the date of invoice unless otherwise agreed in writing.',
    '4. Delivery timelines will be confirmed upon order placement and are subject to material availability.',
    '5. All specifications and quantities are based on the information provided at the time of quoting.',
    '6. Any modifications to the scope of work may result in adjustments to the quoted pricing.',
  ];

  for (const line of terms) {
    y = printWrapped(doc, line, PAGE.marginLeft, y, contentWidth(), 3.8);
    y += 1.5;
  }

  return y;
}

function renderSignatureBlock(doc, y) {
  y = ensureSpace(doc, y, 40);
  y += 8;

  const halfWidth = contentWidth() / 2 - 10;
  const rightCol = PAGE.marginLeft + halfWidth + 20;

  doc.setFont(FONT.bold, 'bold');
  doc.setFontSize(8.5);
  setColor(doc, COLOR.primary);
  doc.text('AUTHORIZED BY', PAGE.marginLeft, y);
  doc.text('ACCEPTED BY', rightCol, y);
  y += 18;

  setDrawColor(doc, COLOR.dark);
  doc.setLineWidth(0.4);
  doc.line(PAGE.marginLeft, y, PAGE.marginLeft + halfWidth, y);
  doc.line(rightCol, y, rightCol + halfWidth, y);
  y += 4;

  doc.setFont(FONT.normal, 'normal');
  doc.setFontSize(7.5);
  setColor(doc, COLOR.medium);
  doc.text('Signature / Date', PAGE.marginLeft, y);
  doc.text('Signature / Date', rightCol, y);
  y += 5;

  doc.line(PAGE.marginLeft, y + 10, PAGE.marginLeft + halfWidth, y + 10);
  doc.line(rightCol, y + 10, rightCol + halfWidth, y + 10);
  y += 14;
  doc.text('Printed Name', PAGE.marginLeft, y);
  doc.text('Printed Name', rightCol, y);

  return y + 8;
}

function renderFooter(doc) {
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Bottom accent line
    setDrawColor(doc, COLOR.primary);
    doc.setLineWidth(0.5);
    doc.line(PAGE.marginLeft, PAGE.height - 14, PAGE.width - PAGE.marginRight, PAGE.height - 14);

    doc.setFont(FONT.normal, 'normal');
    doc.setFontSize(7);
    setColor(doc, COLOR.medium);
    doc.text(
      'This document is computer-generated and constitutes a formal business quotation.',
      PAGE.marginLeft,
      PAGE.height - 9,
    );
    doc.text(
      `Page ${p} of ${totalPages}`,
      PAGE.width - PAGE.marginRight,
      PAGE.height - 9,
      { align: 'right' },
    );
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a professional PDF quote from a quote object.
 *
 * @param {Object} quote - The quote aggregate (from createQuote / quoteStore)
 * @returns {jsPDF} The generated PDF document
 */
export function generateQuotePdf(quote) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const display = quote.quote_format_settings?.display_values ?? {};
  const formatLineItems = display?.line_items ?? {};

  let y = renderHeader(doc, quote);

  // Client information
  if (display.client !== false) {
    y = renderClientSection(doc, quote, y);
  }

  // Quote details
  y = renderQuoteDetails(doc, quote, y);

  // Line items table
  y = renderLineItemsTable(doc, quote, y, formatLineItems);

  // Summary / totals
  y = renderSummarySection(doc, quote, y, display);

  // Terms & conditions
  y = renderTermsAndConditions(doc, y);

  // Signature block
  y = renderSignatureBlock(doc, y);

  // Footer on all pages
  renderFooter(doc);

  return doc;
}

/**
 * Generate and immediately download the PDF.
 *
 * @param {Object} quote - The quote aggregate
 * @param {string} [filename] - Optional filename override
 */
export function downloadQuotePdf(quote, filename) {
  const doc = generateQuotePdf(quote);
  const slug = (quote.order_number || 'quote').replace(/[^a-zA-Z0-9_-]/g, '_');
  const name = filename || `${slug}_quote.pdf`;
  doc.save(name);
}
