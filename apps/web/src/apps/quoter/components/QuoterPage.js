'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import useQuoteStore from '../hooks/useQuoteStore';
import { DISCOUNT_KIND, ENTRY_TYPE, roundCurrency } from '../services/schemas/common.js';
import { QUOTE_STATUS } from '../services/quoteStore.js';
import {
  importCadProjectJson,
  buildCatalogResolver,
  readPendingCadImportFromSession,
  clearPendingCadImportFromSession,
} from '../services/cadImportService.js';
import css from '../styles/quoter.module.css';

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmtCurrency(value) {
  return `$${roundCurrency(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPercent(value, digits = 1) {
  return `${roundCurrency(value * 100, digits)}%`;
}

function fmtDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function fmtDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function statusLabel(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ─── Status badge colors ─────────────────────────────────────────────────────

const STATUS_COLORS = {
  draft: '#6b7280',
  sent: '#3b82f6',
  rejected: '#ef4444',
  closed: '#22c55e',
};

// ─── Inline editable input ───────────────────────────────────────────────────

function InlineField({ label, value, onChange, type = 'text', placeholder = '', readOnly = false, numAlign = false }) {
  return (
    <div className={css.infoField}>
      <span className={css.infoLabel}>{label}</span>
      {readOnly ? (
        <span className={css.infoValue}>{value || '—'}</span>
      ) : (
        <input
          className={`${css.inlineInput}${numAlign ? ' ' + css.inlineInputNum : ''}`}
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

// ─── Array entry row (tax rate / discount / fee) ─────────────────────────────

function EntryRow({ entry, onUpdate, onRemove, showTypeSelect = true, rateMode = false }) {
  return (
    <div className={css.entryRow}>
      <input
        className={css.entryName}
        value={entry.name}
        onChange={(e) => onUpdate(entry.id, { name: e.target.value })}
        placeholder="Name…"
      />
      {showTypeSelect && (
        <select
          className={css.select}
          value={entry.type ?? ENTRY_TYPE.FIXED}
          onChange={(e) => onUpdate(entry.id, { type: e.target.value })}
        >
          <option value={ENTRY_TYPE.PERCENTAGE}>%</option>
          <option value={ENTRY_TYPE.FIXED}>$</option>
        </select>
      )}
      <input
        className={`${css.inlineInput} ${css.inlineInputNum}`}
        type="number"
        min="0"
        step={rateMode ? '0.001' : '0.01'}
        value={rateMode ? roundCurrency(entry.rate * 100, 2) : entry.value}
        onChange={(e) => {
          const raw = parseFloat(e.target.value) || 0;
          onUpdate(entry.id, rateMode ? { rate: raw / 100 } : { value: raw });
        }}
        placeholder="0"
      />
      {rateMode && <span className={css.entryUnit}>%</span>}
      {!rateMode && entry.type === ENTRY_TYPE.FIXED && <span className={css.entryUnit}>$</span>}
      {!rateMode && entry.type === ENTRY_TYPE.PERCENTAGE && <span className={css.entryUnit}>%</span>}
      <button
        className={`${css.btn} ${css.btnDanger} ${css.btnSmall}`}
        onClick={() => onRemove(entry.id)}
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Add Line Item Modal ─────────────────────────────────────────────────────

function AddLineItemModal({ onAdd, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [marginRate, setMarginRate] = useState('20');

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedCost = parseFloat(cost);
    const parsedQty = parseFloat(quantity);
    const parsedMargin = parseFloat(marginRate) / 100;
    if (!name.trim() || Number.isNaN(parsedCost) || parsedCost < 0) return;
    if (Number.isNaN(parsedQty) || parsedQty < 0.001) return;
    onAdd({
      name: name.trim(),
      description: description.trim(),
      cost: parsedCost,
      quantity: parsedQty,
      marginRate: Number.isNaN(parsedMargin) ? 0.2 : parsedMargin,
    });
    onClose();
  };

  return (
    <div className={css.modalOverlay} onClick={onClose} role="presentation">
      <form className={css.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 className={css.modalTitle}>Add Line Item</h3>
        <div className={css.formField}>
          <label className={css.formLabel}>Name *</label>
          <input className={css.formInput} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Frame, Beam, Accessory…" autoFocus required />
        </div>
        <div className={css.formField}>
          <label className={css.formLabel}>Description</label>
          <input className={css.formInput} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="width x height x depth | gauge | load capacity | weight" />
        </div>
        <div className={css.formField}>
          <label className={css.formLabel}>Unit Cost *</label>
          <input className={css.formInput} type="number" min="0" step="0.01" value={cost}
            onChange={(e) => setCost(e.target.value)} required />
        </div>
        <div className={css.formField}>
          <label className={css.formLabel}>Quantity *</label>
          <input className={css.formInput} type="number" min="0.001" step="1" value={quantity}
            onChange={(e) => setQuantity(e.target.value)} required />
        </div>
        <div className={css.formField}>
          <label className={css.formLabel}>Margin (%)</label>
          <input className={css.formInput} type="number" min="0" step="0.1" value={marginRate}
            onChange={(e) => setMarginRate(e.target.value)} />
        </div>
        <div className={css.modalActions}>
          <button type="button" className={css.btn} onClick={onClose}>Cancel</button>
          <button type="submit" className={`${css.btn} ${css.btnPrimary}`}>Add</button>
        </div>
      </form>
    </div>
  );
}

// ─── Version Comparison Modal ────────────────────────────────────────────────

function VersionCompareModal({ versionA, versionB, onClose }) {
  const a = versionA?.data ?? versionA;
  const b = versionB?.data ?? versionB;
  if (!a || !b) return null;

  const rows = [
    { label: 'Order #', va: a.order_number, vb: b.order_number },
    { label: 'Status', va: statusLabel(a.status), vb: statusLabel(b.status) },
    { label: 'Client', va: `${a.client?.organization_name ?? ''} ${a.client?.first_name ?? ''} ${a.client?.last_name ?? ''}`.trim(), vb: `${b.client?.organization_name ?? ''} ${b.client?.first_name ?? ''} ${b.client?.last_name ?? ''}`.trim() },
    { label: 'Shipping', va: fmtCurrency(a.shipping ?? 0), vb: fmtCurrency(b.shipping ?? 0) },
    { label: 'Subtotal', va: fmtCurrency(a.subtotal ?? 0), vb: fmtCurrency(b.subtotal ?? 0) },
    { label: 'Total Discounts', va: fmtCurrency(a.total_discounts ?? 0), vb: fmtCurrency(b.total_discounts ?? 0) },
    { label: 'Total Fees', va: fmtCurrency(a.total_fees ?? 0), vb: fmtCurrency(b.total_fees ?? 0) },
    { label: 'Tax', va: fmtCurrency(a.tax_amount ?? 0), vb: fmtCurrency(b.tax_amount ?? 0) },
    { label: 'Total', va: fmtCurrency(a.total ?? 0), vb: fmtCurrency(b.total ?? 0) },
    { label: 'Line Items', va: a.line_items?.length ?? 0, vb: b.line_items?.length ?? 0 },
  ];

  return (
    <div className={css.modalOverlay} onClick={onClose} role="presentation">
      <div className={css.modal} style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <h3 className={css.modalTitle}>Compare Versions</h3>
        <table className={css.table}>
          <thead>
            <tr>
              <th>Field</th>
              <th>v{versionA?.version}</th>
              <th>v{versionB?.version}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, va, vb }) => (
              <tr key={label} className={String(va) !== String(vb) ? css.diffRow : ''}>
                <td>{label}</td>
                <td>{va}</td>
                <td>{vb}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={css.modalActions}>
          <button className={css.btn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Line Item Row ───────────────────────────────────────────────────────────

function LineItemRow({ item, onUpdate, onRemove }) {
  const discountPct = item.discount?.kind === DISCOUNT_KIND.PERCENTAGE
    ? Number(item.discount.value ?? 0)
    : 0;

  const handleNum = (field, raw) => {
    const value = parseFloat(raw);
    if (Number.isNaN(value) || value < 0) return;
    onUpdate(item.id, { [field]: value });
  };

  const handleText = (field, val) => {
    if (field === 'sku') {
      onUpdate(item.id, { variant: { ...(item.variant ?? {}), sku: val } });
    } else {
      onUpdate(item.id, { [field]: val });
    }
  };

  const skuValue = item.variant?.sku ?? item.traceability?.sku ?? '';

  return (
    <tr>
      <td style={{ fontSize: '0.75rem' }}>
        <input
          className={css.inlineInput}
          value={skuValue}
          onChange={(e) => handleText('sku', e.target.value)}
          placeholder="SKU…"
        />
      </td>
      <td>
        <input
          className={css.inlineInput}
          value={item.name}
          onChange={(e) => handleText('name', e.target.value)}
          placeholder="Name…"
        />
      </td>
      <td className={css.numCell}>
        <div className={css.moneyInputWrap}>
          <span className={css.moneyPrefix}>$</span>
          <input className={`${css.inlineInput} ${css.inlineInputNum}`} type="number"
            min="0" step="0.01" value={item.cost}
            onChange={(e) => handleNum('cost', e.target.value)} />
        </div>
      </td>
      <td className={css.numCell}>
        <input className={`${css.inlineInput} ${css.inlineInputNum}`} type="number"
          min="0" step="1" value={roundCurrency(item.marginRate * 100, 1)}
          onChange={(e) => handleNum('marginRate', (parseFloat(e.target.value) || 0) / 100)} />
      </td>
      <td className={css.numCell}>{fmtCurrency(item.price)}</td>
      <td className={css.numCell}>
        <input className={`${css.inlineInput} ${css.inlineInputNum}`} type="number"
          min="0.001" step="1" value={item.quantity}
          onChange={(e) => handleNum('quantity', e.target.value)} />
      </td>
      <td className={css.numCell}>
        <input className={`${css.inlineInput} ${css.inlineInputNum}`} type="number"
          min="0" step="0.1" value={roundCurrency(discountPct, 1)}
          onChange={(e) => {
            const raw = parseFloat(e.target.value);
            if (Number.isNaN(raw) || raw < 0) return;
            onUpdate(item.id, {
              discount: {
                kind: DISCOUNT_KIND.PERCENTAGE,
                value: Math.min(100, raw),
              },
            });
          }} />
      </td>
      <td className={css.numCell}>{fmtCurrency(item.total)}</td>
      <td>
        <button
          className={css.iconBtnDanger}
          onClick={() => onRemove(item.id)}
          title="Remove"
          aria-label="Remove line item"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function QuoterPage() {
  const { store, version } = useQuoteStore();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [compareVersions, setCompareVersions] = useState(null); // { a, b }
  const [importError, setImportError] = useState(null);
  const [isFormatSettingsCollapsed, setIsFormatSettingsCollapsed] = useState(true);
  const fileInputRef = useRef(null);

  const quote = store.getQuote();
  const cadItems = useMemo(() => store.getCadLineItems(), [store, version]);
  const manualItems = useMemo(() => store.getManualLineItems(), [store, version]);
  const versions = useMemo(() => store.getVersions(), [store, version]);
  const formatDisplay = quote.quote_format_settings?.display_values;
  const formatLineItems = formatDisplay?.line_items;

  // ── Quote field handlers ─────────────────────────────────────────────────

  const setOrderNumber = useCallback(
    (v) => store.updateQuoteFields({ order_number: v }), [store]);

  const setClient = useCallback(
    (field, val) => store.updateQuoteFields({ client: { ...quote.client, [field]: val } }),
    [store, quote.client]);

  const setShipping = useCallback(
    (v) => store.updateQuoteFields({ shipping: parseFloat(v) || 0 }), [store]);

  // ── Line items ───────────────────────────────────────────────────────────

  const handleAddLineItem = useCallback((params) => store.addLineItem(params), [store]);
  const handleRemoveLineItem = useCallback((id) => store.removeLineItem(id), [store]);
  const handleUpdateLineItem = useCallback(
    (id, updates) => store.updateLineItem(id, updates, { allowCadOverrides: true }),
    [store],
  );

  // ── Tax rates ────────────────────────────────────────────────────────────

  const handleAddTaxRate = useCallback(
    () => store.addTaxRate({ name: 'Tax', rate: 0.16 }), [store]);
  const handleRemoveTaxRate = useCallback((id) => store.removeTaxRate(id), [store]);
  const handleUpdateTaxRate = useCallback(
    (id, updates) => store.updateTaxRate(id, updates), [store]);

  // ── Discounts ────────────────────────────────────────────────────────────

  const handleAddDiscount = useCallback(
    () => store.addDiscount({ name: 'Discount', type: ENTRY_TYPE.PERCENTAGE, value: 0 }), [store]);
  const handleRemoveDiscount = useCallback((id) => store.removeDiscount(id), [store]);
  const handleUpdateDiscount = useCallback(
    (id, updates) => store.updateDiscount(id, updates), [store]);

  // ── Fees ─────────────────────────────────────────────────────────────────

  const handleAddFee = useCallback(
    () => store.addFee({ name: 'Fee', type: ENTRY_TYPE.FIXED, value: 0 }), [store]);
  const handleRemoveFee = useCallback((id) => store.removeFee(id), [store]);
  const handleUpdateFee = useCallback(
    (id, updates) => store.updateFee(id, updates), [store]);

  const applyCadImportText = useCallback((rawText, projectFileLabel) => {
    const { bom, error } = importCadProjectJson(rawText);
    if (error || !bom) {
      setImportError(error ?? 'Failed to import CAD project.');
      return false;
    }
    const resolver = buildCatalogResolver(bom.items);
    store.syncFromBom(bom, {
      resolveCatalog: resolver,
      projectFile: projectFileLabel || 'CAD Project',
    });
    return true;
  }, [store]);

  // ── Auto-import from CAD editor (sessionStorage handoff) ────────────────

  useEffect(() => {
    const pending = readPendingCadImportFromSession();
    if (!pending) return;
    try {
      const ok = applyCadImportText(pending.raw, pending.source);
      if (ok) clearPendingCadImportFromSession();
    } catch (err) {
      setImportError(err.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyCadImportText]);

  // ── CAD import ───────────────────────────────────────────────────────────

  const handleCadFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      applyCadImportText(text, file.name);
    } catch (err) {
      setImportError(err.message);
    } finally {
      e.target.value = '';
    }
  }, [applyCadImportText]);

  // ── Versioning ───────────────────────────────────────────────────────────

  const handleSaveVersion = useCallback(() => store.saveVersion(), [store]);
  const handleSwitchToVersion = useCallback(
    (versionId) => store.switchToVersion(versionId), [store]);

  // ─────────────────────────────────────────────────────────────────────────

  const statusColor = STATUS_COLORS[quote.status] ?? '#6b7280';

  return (
    <div className={css.quoterViewport}>
      <div className={css.quoterRoot}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={css.header}>
        <div className={css.headerLeft}>
          <h1 className={css.quoteTitle}>
            {quote.order_number || 'New Quote'}
          </h1>
          <span className={css.statusBadge} style={{ background: statusColor + '22', color: statusColor }}>
            {statusLabel(quote.status)}
          </span>
        </div>
        <div className={css.headerRight}>
          <button className={css.btn} onClick={() => store.undo()} disabled={!store.canUndo()} title="Undo">
            Undo
          </button>
          <select className={css.select} value={quote.status}
            onChange={(e) => store.setStatus(e.target.value)}>
            {Object.values(QUOTE_STATUS).map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          <button className={`${css.btn} ${css.btnPrimary} ${css.btnSmall}`}
            onClick={handleSaveVersion} title="Save current state as a new version">
            Save Version
          </button>
          <button className={css.btn} onClick={() => store.resetQuote({})} title="New empty quote">
            New Quote
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className={css.content}>

        {/* ── Row 1: Quote Details + Client (side by side) ───────────── */}
        <div className={css.gridRow2}>
          <div className={css.section}>
            <div className={css.sectionHeader}>
              <span className={css.sectionTitle}>Quote Details</span>
            </div>
            <div className={css.sectionBody}>
              <div className={css.infoGrid}>
                <InlineField label="Order Number" value={quote.order_number}
                  onChange={setOrderNumber} placeholder="QTE-0001" />
                <InlineField label="Created" value={fmtDate(quote.audit.createdAt)}
                  readOnly />
                <InlineField label="Updated" value={fmtDate(quote.audit.updatedAt)}
                  readOnly />
                <InlineField label="Created By" value={quote.audit.createdBy ?? ''}
                  onChange={(v) => store.updateQuoteFields({ audit: { ...quote.audit, createdBy: v } })}
                  placeholder="Name…" />
              </div>
            </div>
          </div>

          <div className={css.section}>
            <div className={css.sectionHeader}>
              <span className={css.sectionTitle}>Client</span>
            </div>
            <div className={css.sectionBody}>
              <div className={css.infoGrid}>
                <InlineField label="Organization" value={quote.client.organization_name}
                  onChange={(v) => setClient('organization_name', v)} placeholder="Company name…" />
                <InlineField label="First Name" value={quote.client.first_name}
                  onChange={(v) => setClient('first_name', v)} placeholder="First…" />
                <InlineField label="Last Name" value={quote.client.last_name}
                  onChange={(v) => setClient('last_name', v)} placeholder="Last…" />
                <InlineField label="Email" value={quote.client.email}
                  onChange={(v) => setClient('email', v)} type="email" placeholder="email@company.com" />
                <InlineField label="Phone" value={quote.client.phone}
                  onChange={(v) => setClient('phone', v)} type="tel" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
          </div>
        </div>

        {/* ── CAD Design (full width) ───────────────────────────────── */}
        <div className={`${css.section} ${css.sectionExpand}`}>
          <div className={css.sectionHeader}>
            <span className={css.sectionTitle}>CAD Design</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {quote.cad?.project_file && (
                <span className={css.cadFileBadge}>{quote.cad.project_file}</span>
              )}
              <button className={`${css.btn} ${css.btnSmall}`}
                onClick={() => fileInputRef.current?.click()}>
                Import CAD JSON
              </button>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }}
                onChange={handleCadFileChange} />
            </div>
          </div>
          {importError && (
            <div className={css.errorBanner}>{importError}</div>
          )}
          {cadItems.length > 0 && (
            <div className={css.tableWrapFit}>
              <table className={css.table}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Width / Depth</th>
                    <th>Height</th>
                    <th className={css.thRight}>Gauge</th>
                    <th className={css.thRight}>Load Cap.</th>
                    <th className={css.thRight}>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {cadItems.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontSize: '0.75rem' }}>{item.variant?.sku ?? item.traceability?.sku ?? '—'}</td>
                      <td>{item.name}</td>
                      <td>{item.extras?.widthDepth ?? '—'}</td>
                      <td>{item.extras?.height ?? '—'}</td>
                      <td className={css.numCell}>{item.extras?.gauge ?? '—'}</td>
                      <td className={css.numCell}>{item.extras?.loadCapacity ?? '—'}</td>
                      <td className={css.numCell}>{item.extras?.weight ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {cadItems.length === 0 && (
            <div className={css.sectionBody}>
              <span className={css.emptyText}>No CAD design linked. Import a .json project file to generate line items.</span>
            </div>
          )}
        </div>

        {/* ── Line Items (full width) ───────────────────────────────── */}
        <div className={`${css.section} ${css.sectionExpand}`}>
          <div className={css.sectionHeader}>
            <span className={css.sectionTitle}>Line Items ({quote.line_items.length})</span>
            <button className={`${css.btn} ${css.btnPrimary} ${css.btnSmall}`}
              onClick={() => setAddModalOpen(true)}>
              + Add Item
            </button>
          </div>
          {quote.line_items.length === 0 ? (
            <div className={css.lineItemsEmpty}>
              <span className={css.lineItemsEmptyText}>No line items yet. Import a CAD design or add items manually.</span>
            </div>
          ) : (
            <div className={css.tableWrapFit}>
              <table className={css.table}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th className={css.thRight}>Cost</th>
                    <th className={css.thRight}>Margin %</th>
                    <th className={css.thRight}>U. Price</th>
                    <th className={css.thRight}>Qty</th>
                    <th className={css.thRight}>Discount %</th>
                    <th className={css.thRight}>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {quote.line_items.map((item) => (
                    <LineItemRow key={item.id} item={item}
                      onUpdate={handleUpdateLineItem} onRemove={handleRemoveLineItem} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Row 3: Tax / Discounts / Fees (3-col) ─────────────────── */}
        <div className={css.gridRow3}>
          <div className={css.section}>
            <div className={css.sectionHeader}>
              <span className={css.sectionTitle}>Tax Rates</span>
              <button className={`${css.btn} ${css.btnSmall}`} onClick={handleAddTaxRate}>+ Add</button>
            </div>
            <div className={css.sectionBody}>
              {quote.tax_rates.length === 0 ? (
                <span className={css.emptyText}>No tax rates.</span>
              ) : (
                <div className={css.entriesList}>
                  {quote.tax_rates.map((r) => (
                    <EntryRow key={r.id} entry={r}
                      onUpdate={handleUpdateTaxRate} onRemove={handleRemoveTaxRate}
                      showTypeSelect={false} rateMode />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={css.section}>
            <div className={css.sectionHeader}>
              <span className={css.sectionTitle}>Discounts</span>
              <button className={`${css.btn} ${css.btnSmall}`} onClick={handleAddDiscount}>+ Add</button>
            </div>
            <div className={css.sectionBody}>
              {quote.discounts.length === 0 ? (
                <span className={css.emptyText}>No discounts.</span>
              ) : (
                <div className={css.entriesList}>
                  {quote.discounts.map((d) => (
                    <EntryRow key={d.id} entry={d}
                      onUpdate={handleUpdateDiscount} onRemove={handleRemoveDiscount} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={css.section}>
            <div className={css.sectionHeader}>
              <span className={css.sectionTitle}>Fees</span>
              <button className={`${css.btn} ${css.btnSmall}`} onClick={handleAddFee}>+ Add</button>
            </div>
            <div className={css.sectionBody}>
              {quote.fees.length === 0 ? (
                <span className={css.emptyText}>No fees.</span>
              ) : (
                <div className={css.entriesList}>
                  {quote.fees.map((f) => (
                    <EntryRow key={f.id} entry={f}
                      onUpdate={handleUpdateFee} onRemove={handleRemoveFee} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 4: Summary + Template (side by side) ───────────────── */}
        <div className={css.gridRowBottom}>
          <div className={css.section}>
            <div className={css.sectionHeader}>
              <span className={css.sectionTitle}>Quote Summary</span>
            </div>
            <div className={css.sectionBody}>
              <div className={css.infoGrid} style={{ marginBottom: 16 }}>
                <InlineField label="Shipping" value={quote.shipping}
                  onChange={setShipping} type="number" numAlign />
              </div>
              <div className={css.summaryGrid}>
                <span className={css.summaryLabel}>Subtotal</span>
                <span className={css.summaryValue}>{fmtCurrency(quote.subtotal)}</span>

                {quote.total_discounts > 0 && <>
                  <span className={css.summaryLabel}>Discounts</span>
                  <span className={css.summaryValue} style={{ color: '#22c55e' }}>
                    −{fmtCurrency(quote.total_discounts)}
                  </span>
                </>}

                <span className={css.summaryLabel}>Shipping</span>
                <span className={css.summaryValue}>{fmtCurrency(quote.shipping)}</span>

                {quote.total_fees > 0 && <>
                  <span className={css.summaryLabel}>Fees</span>
                  <span className={css.summaryValue}>{fmtCurrency(quote.total_fees)}</span>
                </>}

                <div className={css.summaryDivider} />

                {quote.tax_rates.map((r) => (
                  <React.Fragment key={r.id}>
                    <span className={css.summaryLabel}>{r.name} ({fmtPercent(r.rate)})</span>
                    <span className={css.summaryValue}>
                      {fmtCurrency((quote.subtotal - quote.total_discounts + quote.shipping + quote.total_fees) * r.rate)}
                    </span>
                  </React.Fragment>
                ))}

                {quote.total_tax_rates > 0 && <>
                  <div className={css.summaryDivider} />
                  <span className={css.summaryLabel}>Tax Total ({fmtPercent(quote.total_tax_rates)})</span>
                  <span className={css.summaryValue}>{fmtCurrency(quote.tax_amount)}</span>
                </>}

                <div className={css.summaryDivider} />

                <span className={`${css.summaryLabel} ${css.summaryTotal}`}>Total</span>
                <span className={`${css.summaryValue} ${css.summaryTotal}`}>{fmtCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          <div className={css.sectionSide}>
            <div className={css.section}>
              <div className={css.sectionHeader}>
                <span className={css.sectionTitle}>Template</span>
              </div>
              <div className={css.sectionBody}>
                <InlineField label="Template File" value={quote.quote_template?.template_file ?? ''}
                  onChange={(v) => store.updateQuoteFields({
                    quote_template: { ...(quote.quote_template ?? {}), template_file: v }
                  })} placeholder="template.docx" />
              </div>
            </div>

            <div className={css.section}>
              <div className={css.sectionHeader}>
                <span className={css.sectionTitle}>Quote Format Settings</span>
                <button
                  className={`${css.btn} ${css.btnSmall}`}
                  onClick={() => setIsFormatSettingsCollapsed((prev) => !prev)}
                >
                  {isFormatSettingsCollapsed ? 'Show' : 'Hide'}
                </button>
              </div>
              {!isFormatSettingsCollapsed && (
              <div className={css.sectionBody}>
                <div className={css.formatSettingsList}>
                  <label className={css.formatSettingRow}>
                    <input
                      type="checkbox"
                      checked={Boolean(formatDisplay?.client)}
                      onChange={(e) => store.updateQuoteFields({
                        quote_format_settings: {
                          display_values: {
                            ...formatDisplay,
                            line_items: { ...formatLineItems },
                            client: e.target.checked,
                          },
                        },
                      })}
                    />
                    <span>Client</span>
                  </label>

                  <label className={css.formatSettingRow}>
                    <input
                      type="checkbox"
                      checked={Boolean(formatDisplay?.cad_line_items)}
                      onChange={(e) => store.updateQuoteFields({
                        quote_format_settings: {
                          display_values: {
                            ...formatDisplay,
                            line_items: { ...formatLineItems },
                            cad_line_items: e.target.checked,
                          },
                        },
                      })}
                    />
                    <span>CAD Line Items</span>
                  </label>

                  <div className={css.formatSubGroup}>
                    <span className={css.formatSubTitle}>Line Items</span>

                    <label className={css.formatSettingRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(formatLineItems?.name)}
                        onChange={(e) => store.updateQuoteFields({
                          quote_format_settings: {
                            display_values: {
                              ...formatDisplay,
                              line_items: { ...formatLineItems, name: e.target.checked },
                            },
                          },
                        })}
                      />
                      <span>Name</span>
                    </label>

                    <label className={css.formatSettingRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(formatLineItems?.description)}
                        onChange={(e) => store.updateQuoteFields({
                          quote_format_settings: {
                            display_values: {
                              ...formatDisplay,
                              line_items: { ...formatLineItems, description: e.target.checked },
                            },
                          },
                        })}
                      />
                      <span>Description</span>
                    </label>

                    <label className={css.formatSettingRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(formatLineItems?.cost)}
                        onChange={(e) => store.updateQuoteFields({
                          quote_format_settings: {
                            display_values: {
                              ...formatDisplay,
                              line_items: { ...formatLineItems, cost: e.target.checked },
                            },
                          },
                        })}
                      />
                      <span>Cost</span>
                    </label>

                    <label className={css.formatSettingRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(formatLineItems?.unit_price)}
                        onChange={(e) => store.updateQuoteFields({
                          quote_format_settings: {
                            display_values: {
                              ...formatDisplay,
                              line_items: { ...formatLineItems, unit_price: e.target.checked },
                            },
                          },
                        })}
                      />
                      <span>Unit Price</span>
                    </label>

                    <label className={css.formatSettingRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(formatLineItems?.quantity)}
                        onChange={(e) => store.updateQuoteFields({
                          quote_format_settings: {
                            display_values: {
                              ...formatDisplay,
                              line_items: { ...formatLineItems, quantity: e.target.checked },
                            },
                          },
                        })}
                      />
                      <span>Quantity</span>
                    </label>

                    <label className={css.formatSettingRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(formatLineItems?.discount)}
                        onChange={(e) => store.updateQuoteFields({
                          quote_format_settings: {
                            display_values: {
                              ...formatDisplay,
                              line_items: { ...formatLineItems, discount: e.target.checked },
                            },
                          },
                        })}
                      />
                      <span>Discount</span>
                    </label>

                    <label className={css.formatSettingRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(formatLineItems?.total)}
                        onChange={(e) => store.updateQuoteFields({
                          quote_format_settings: {
                            display_values: {
                              ...formatDisplay,
                              line_items: { ...formatLineItems, total: e.target.checked },
                            },
                          },
                        })}
                      />
                      <span>Total</span>
                    </label>
                  </div>

                  <label className={css.formatSettingRow}>
                    <input
                      type="checkbox"
                      checked={Boolean(formatDisplay?.tax_rates)}
                      onChange={(e) => store.updateQuoteFields({
                        quote_format_settings: {
                          display_values: {
                            ...formatDisplay,
                            line_items: { ...formatLineItems },
                            tax_rates: e.target.checked,
                          },
                        },
                      })}
                    />
                    <span>Tax Rates</span>
                  </label>

                  <label className={css.formatSettingRow}>
                    <input
                      type="checkbox"
                      checked={Boolean(formatDisplay?.discounts)}
                      onChange={(e) => store.updateQuoteFields({
                        quote_format_settings: {
                          display_values: {
                            ...formatDisplay,
                            line_items: { ...formatLineItems },
                            discounts: e.target.checked,
                          },
                        },
                      })}
                    />
                    <span>Discounts</span>
                  </label>

                  <label className={css.formatSettingRow}>
                    <input
                      type="checkbox"
                      checked={Boolean(formatDisplay?.fees)}
                      onChange={(e) => store.updateQuoteFields({
                        quote_format_settings: {
                          display_values: {
                            ...formatDisplay,
                            line_items: { ...formatLineItems },
                            fees: e.target.checked,
                          },
                        },
                      })}
                    />
                    <span>Fees</span>
                  </label>

                  <label className={css.formatSettingRow}>
                    <input
                      type="checkbox"
                      checked={Boolean(formatDisplay?.shipping)}
                      onChange={(e) => store.updateQuoteFields({
                        quote_format_settings: {
                          display_values: {
                            ...formatDisplay,
                            line_items: { ...formatLineItems },
                            shipping: e.target.checked,
                          },
                        },
                      })}
                    />
                    <span>Shipping</span>
                  </label>
                </div>
              </div>
              )}
            </div>
          </div>

          <div className={css.section}>
            <div className={css.sectionHeader}>
              <span className={css.sectionTitle}>Version History ({versions.length})</span>
              <button className={`${css.btn} ${css.btnSmall}`} onClick={handleSaveVersion}>
                Save Version
              </button>
            </div>
            <div className={css.sectionBody}>
              {versions.length === 0 ? (
                <span className={css.emptyText}>No saved versions yet.</span>
              ) : (
                <div className={css.versionList}>
                  {[...versions].reverse().map((v, i) => (
                    <div key={v.id} className={css.versionRow}>
                      <div className={css.versionInfo}>
                        <span className={css.versionNumber}>v{v.version}</span>
                        <span className={css.versionMeta}>
                          {fmtDateTime(v.updated_at)}
                          {v.updated_by ? ` by ${v.updated_by}` : ''}
                        </span>
                        <span className={css.versionTotal}>
                          {fmtCurrency(v.data?.total ?? 0)}
                        </span>
                      </div>
                      <div className={css.versionActions}>
                        {versions.length >= 2 && i < versions.length - 1 && (
                          <button
                            className={`${css.btn} ${css.btnSmall}`}
                            onClick={() => setCompareVersions({
                              a: versions[versions.length - 1 - i],
                              b: versions[versions.length - 2 - i],
                            })}
                          >
                            Compare ↑
                          </button>
                        )}
                        <button
                          className={`${css.btn} ${css.btnSmall}`}
                          onClick={() => handleSwitchToVersion(v.id)}
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

        {/* ── Modals ────────────────────────────────────────────────────────── */}
        {addModalOpen && (
          <AddLineItemModal onAdd={handleAddLineItem} onClose={() => setAddModalOpen(false)} />
        )}
        {compareVersions && (
          <VersionCompareModal
            versionA={compareVersions.a}
            versionB={compareVersions.b}
            onClose={() => setCompareVersions(null)}
          />
        )}
      </div>
    </div>
  );
}
