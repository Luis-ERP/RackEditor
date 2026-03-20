'use client';

import { useState, useCallback, useEffect } from 'react';
import useQuoteStore from '../hooks/useQuoteStore';
import { DISCOUNT_KIND, QUOTE_LINE_SOURCE, roundCurrency } from '../services/schemas/common.js';
import { QUOTE_STATUS } from '../services/quoteStore.js';
import { getQuote } from '@/src/core/api/quoterApi';
import { consumeCadToQuoteTransfer } from '@/src/core/quoteTransfer/cadQuoteTransfer';
import css from '../styles/quoter.module.css';

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmtCurrency(value) {
  return `$${roundCurrency(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPercent(value) {
  return `${roundCurrency(value * 100, 1)}%`;
}

function fmtDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${year}-${month}-${day}`;
}

function fmtDiscount(discount) {
  if (!discount || discount.kind === DISCOUNT_KIND.NONE) return '—';
  if (discount.kind === DISCOUNT_KIND.PERCENTAGE) return `${discount.value}%`;
  return fmtCurrency(discount.value);
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
    const parsedQty = parseInt(quantity, 10);
    const parsedMargin = parseFloat(marginRate) / 100;
    if (!name.trim() || Number.isNaN(parsedCost) || parsedCost < 0) return;
    if (Number.isNaN(parsedQty) || parsedQty < 1) return;
    onAdd({
      name: name.trim(),
      description: description.trim(),
      cost: parsedCost,
      quantity: parsedQty,
      marginRate: Number.isNaN(parsedMargin) ? 0.2 : parsedMargin,
      source: QUOTE_LINE_SOURCE.MANUAL,
    });
    onClose();
  };

  return (
    <div className={css.modalOverlay} onClick={onClose} role="presentation">
      <form
        className={css.modal}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className={css.modalTitle}>Add Line Item</h3>

        <div className={css.formField}>
          <label className={css.formLabel}>Name *</label>
          <input
            className={css.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Frame, Beam, Accessory…"
            autoFocus
            required
          />
        </div>

        <div className={css.formField}>
          <label className={css.formLabel}>Description</label>
          <input
            className={css.formInput}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 96in × 42in × 144in"
          />
        </div>

        <div className={css.formField}>
          <label className={css.formLabel}>Unit Cost *</label>
          <input
            className={css.formInput}
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            required
          />
        </div>

        <div className={css.formField}>
          <label className={css.formLabel}>Quantity *</label>
          <input
            className={css.formInput}
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>

        <div className={css.formField}>
          <label className={css.formLabel}>Margin (%)</label>
          <input
            className={css.formInput}
            type="number"
            min="0"
            step="0.1"
            value={marginRate}
            onChange={(e) => setMarginRate(e.target.value)}
          />
        </div>

        <div className={css.modalActions}>
          <button type="button" className={css.btn} onClick={onClose}>Cancel</button>
          <button type="submit" className={`${css.btn} ${css.btnPrimary}`}>Add</button>
        </div>
      </form>
    </div>
  );
}

// ─── Discount Editor Inline ──────────────────────────────────────────────────

function DiscountEditor({ discount, onChange, label }) {
  const kind = discount?.kind ?? DISCOUNT_KIND.NONE;
  const value = discount?.value ?? 0;

  return (
    <span className={css.discountInline}>
      <select
        className={css.select}
        value={kind}
        onChange={(e) => onChange({ kind: e.target.value, value: e.target.value === DISCOUNT_KIND.NONE ? 0 : value })}
        aria-label={`${label} discount type`}
      >
        <option value={DISCOUNT_KIND.NONE}>None</option>
        <option value={DISCOUNT_KIND.PERCENTAGE}>%</option>
        <option value={DISCOUNT_KIND.FIXED_AMOUNT}>$</option>
      </select>
      {kind !== DISCOUNT_KIND.NONE && (
        <input
          className={`${css.inlineInput} ${css.inlineInputNum}`}
          type="number"
          min="0"
          step={kind === DISCOUNT_KIND.PERCENTAGE ? '1' : '0.01'}
          max={kind === DISCOUNT_KIND.PERCENTAGE ? '100' : undefined}
          value={value}
          onChange={(e) => onChange({ kind, value: parseFloat(e.target.value) || 0 })}
          aria-label={`${label} discount value`}
        />
      )}
    </span>
  );
}

// ─── Line Item Row ───────────────────────────────────────────────────────────

function LineItemRow({ item, onUpdate, onRemove }) {
  const isCad = item.isDesignLinked;

  const handleFieldChange = (field, raw) => {
    const value = parseFloat(raw);
    if (Number.isNaN(value) || value < 0) return;
    onUpdate(item.id, { [field]: value });
  };

  return (
    <tr>
      <td>
        {isCad ? (
          <span className={css.cadBadge}>CAD</span>
        ) : (
          <span className={css.manualBadge}>Manual</span>
        )}
      </td>
      <td>{item.name}</td>
      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.description || '—'}
      </td>
      <td className={css.numCell}>
        {isCad ? (
          fmtCurrency(item.cost)
        ) : (
          <input
            className={`${css.inlineInput} ${css.inlineInputNum}`}
            type="number"
            min="0"
            step="0.01"
            value={item.cost}
            onChange={(e) => handleFieldChange('cost', e.target.value)}
            aria-label="Cost"
          />
        )}
      </td>
      <td className={css.numCell}>
        {isCad ? (
          fmtPercent(item.marginRate)
        ) : (
          <input
            className={`${css.inlineInput} ${css.inlineInputNum}`}
            type="number"
            min="0"
            step="1"
            value={roundCurrency(item.marginRate * 100, 1)}
            onChange={(e) => handleFieldChange('marginRate', (parseFloat(e.target.value) || 0) / 100)}
            aria-label="Margin %"
          />
        )}
      </td>
      <td className={css.numCell}>{fmtCurrency(item.price)}</td>
      <td className={css.numCell}>
        {isCad ? (
          item.quantity
        ) : (
          <input
            className={`${css.inlineInput} ${css.inlineInputNum}`}
            type="number"
            min="1"
            step="1"
            value={item.quantity}
            onChange={(e) => handleFieldChange('quantity', e.target.value)}
            aria-label="Quantity"
          />
        )}
      </td>
      <td className={css.numCell}>
        {isCad ? (
          fmtDiscount(item.discount)
        ) : (
          <DiscountEditor
            discount={item.discount}
            onChange={(d) => onUpdate(item.id, { discount: d })}
            label={item.name}
          />
        )}
      </td>
      <td className={css.numCell}>{fmtCurrency(item.total)}</td>
      <td>
        {!isCad && (
          <button
            className={`${css.btn} ${css.btnDanger} ${css.btnSmall}`}
            onClick={() => onRemove(item.id)}
            title="Remove line item"
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function QuoterPage({ quoteId = null }) {
  const { store } = useQuoteStore();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isCancelled = false;

    async function loadInitialQuote() {
      if (quoteId && quoteId !== 'new') {
        setIsLoadingQuote(true);
        setLoadError('');
        setNotFound(false);
        try {
          const persistedQuote = await getQuote(quoteId);
          if (!isCancelled) {
            store.loadQuote(persistedQuote);
          }
        } catch (error) {
          if (!isCancelled) {
            if (error?.response?.status === 404) {
              setNotFound(true);
            } else {
              setLoadError('Unable to load quote. Please try again.');
            }
          }
          console.error('Failed to load quote', error);
        } finally {
          if (!isCancelled) {
            setIsLoadingQuote(false);
          }
        }
        return;
      }

      const transfer = consumeCadToQuoteTransfer();
      if (!transfer) return;

      store.resetQuote({
        quoteNumber: transfer.quoteNumber,
        linkedDesign: {
          source: transfer.source,
          designId: transfer.designId,
          designRevisionId: transfer.designRevisionId,
          exportedAt: transfer.exportedAt,
          projectDocument: transfer.projectDocument,
        },
        extras: {
          cadImport: {
            lineCount: transfer.stats?.lineCount ?? transfer.bomSnapshot.items.length,
            totalQuantity: transfer.stats?.totalQuantity ?? 0,
          },
        },
      });

      store.syncFromBom(transfer.bomSnapshot, {
        designId: transfer.designId,
        designRevisionId: transfer.designRevisionId,
        updatedBy: 'cad-editor',
      });
    }

    loadInitialQuote();

    return () => {
      isCancelled = true;
    };
  }, [quoteId, store]);

  const quote = store.getQuote();

  const handleAddLineItem = useCallback(
    (params) => store.addLineItem(params),
    [store],
  );

  const handleRemoveLineItem = useCallback(
    (id) => store.removeLineItem(id),
    [store],
  );

  const handleUpdateLineItem = useCallback(
    (id, updates) => store.updateLineItem(id, updates),
    [store],
  );

  const handleQuoteFieldChange = useCallback(
    (fields) => store.updateQuoteFields(fields),
    [store],
  );

  if (isLoadingQuote) {
    return (
      <div className={css.quoterRoot}>
        <div className={css.fullPageState}>
          <span className={css.fullPageStateTitle}>Loading quote…</span>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={css.quoterRoot}>
        <div className={css.fullPageState}>
          <span className={css.fullPageStateTitle}>Quote not found</span>
          <p className={css.fullPageStateBody}>
            No quote with ID <strong>{quoteId}</strong> exists.
            It may have been deleted or the link is invalid.
          </p>
          <a href="/quoter" className={`${css.btn} ${css.btnPrimary}`}>
            Back to Quotes
          </a>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={css.quoterRoot}>
        <div className={css.fullPageState}>
          <span className={css.fullPageStateTitle}>Could not load quote</span>
          <p className={css.fullPageStateBody}>{loadError}</p>
          <button
            className={`${css.btn} ${css.btnPrimary}`}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={css.quoterRoot}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={css.header}>
        <div className={css.headerLeft}>
          <h1 className={css.quoteTitle}>
            {quote.quoteNumber || 'New Quote'}
          </h1>
          <span className={css.statusBadge}>{quote.status}</span>
        </div>
        <div className={css.headerRight}>
          <button
            className={css.btn}
            onClick={() => store.undo()}
            disabled={!store.canUndo()}
            title="Undo last action"
          >
            Undo
          </button>
          <select
            className={css.select}
            value={quote.status}
            onChange={(e) => store.setStatus(e.target.value)}
            aria-label="Quote status"
          >
            {Object.values(QUOTE_STATUS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            className={css.btn}
            onClick={() => store.resetQuote({})}
            title="New empty quote"
          >
            New Quote
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className={css.content}>
        {/* ── Quote Info ─────────────────────────────────────────────── */}
        <div className={css.section}>
          <div className={css.sectionHeader}>
            <span className={css.sectionTitle}>Quote Details</span>
          </div>
          <div className={css.sectionBody}>
            <div className={css.infoGrid}>
              <div className={css.infoField}>
                <span className={css.infoLabel}>Quote Number</span>
                <input
                  className={css.inlineInput}
                  value={quote.quoteNumber}
                  onChange={(e) => handleQuoteFieldChange({ quoteNumber: e.target.value })}
                  placeholder="QTE-0001"
                />
              </div>
              <div className={css.infoField}>
                <span className={css.infoLabel}>Client</span>
                <input
                  className={css.inlineInput}
                  value={quote.clientRef?.name ?? ''}
                  onChange={(e) =>
                    handleQuoteFieldChange({
                      clientRef: e.target.value
                        ? { ...(quote.clientRef ?? {}), name: e.target.value }
                        : null,
                    })
                  }
                  placeholder="Link a client (CRM)…"
                />
              </div>
              <div className={css.infoField}>
                <span className={css.infoLabel}>Linked Design</span>
                <span className={css.infoValue}>
                  {quote.linkedDesign?.designId ?? 'No linked design'}
                </span>
              </div>
              <div className={css.infoField}>
                <span className={css.infoLabel}>CAD Import</span>
                <span className={css.infoValue}>
                  {quote.linkedDesign?.source === 'CAD_EDITOR'
                    ? `${quote.extras?.cadImport?.lineCount ?? 0} BOM lines`
                    : 'No CAD import'}
                </span>
              </div>
              <div className={css.infoField}>
                <span className={css.infoLabel}>Created</span>
                <span className={css.infoValue}>
                  {fmtDate(quote.audit.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Line Items Table ───────────────────────────────────────── */}
        <div className={css.section}>
          <div className={css.sectionHeader}>
            <span className={css.sectionTitle}>
              Line Items ({quote.lineItems.length})
            </span>
            <button
              className={`${css.btn} ${css.btnPrimary} ${css.btnSmall}`}
              onClick={() => setAddModalOpen(true)}
            >
              + Add Item
            </button>
          </div>
          <div className={css.tableWrap}>
            <table className={css.table}>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th className={css.thRight}>Cost</th>
                  <th className={css.thRight}>Margin</th>
                  <th className={css.thRight}>Price</th>
                  <th className={css.thRight}>Qty</th>
                  <th className={css.thRight}>Discount</th>
                  <th className={css.thRight}>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.length === 0 ? (
                  <tr className={css.emptyRow}>
                    <td colSpan={10}>
                      No line items yet. Add items manually or sync from a CAD design.
                    </td>
                  </tr>
                ) : (
                  quote.lineItems.map((item) => (
                    <LineItemRow
                      key={item.id}
                      item={item}
                      onUpdate={handleUpdateLineItem}
                      onRemove={handleRemoveLineItem}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Quote Summary ──────────────────────────────────────────── */}
        <div className={css.section}>
          <div className={css.sectionHeader}>
            <span className={css.sectionTitle}>Quote Summary</span>
          </div>
          <div className={css.sectionBody}>
            <div className={css.infoGrid} style={{ marginBottom: 16 }}>
              <div className={css.infoField}>
                <span className={css.infoLabel}>Shipping</span>
                <input
                  className={`${css.inlineInput} ${css.inlineInputNum}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={quote.shipping}
                  onChange={(e) =>
                    handleQuoteFieldChange({ shipping: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className={css.infoField}>
                <span className={css.infoLabel}>Freight</span>
                <input
                  className={`${css.inlineInput} ${css.inlineInputNum}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={quote.freight}
                  onChange={(e) =>
                    handleQuoteFieldChange({ freight: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className={css.infoField}>
                <span className={css.infoLabel}>Tax Rate (%)</span>
                <input
                  className={`${css.inlineInput} ${css.inlineInputNum}`}
                  type="number"
                  min="0"
                  step="1"
                  value={roundCurrency(quote.taxRate * 100, 1)}
                  onChange={(e) =>
                    handleQuoteFieldChange({
                      taxRate: (parseFloat(e.target.value) || 0) / 100,
                    })
                  }
                />
              </div>
              <div className={css.infoField}>
                <span className={css.infoLabel}>Global Discount</span>
                <DiscountEditor
                  discount={quote.discount}
                  onChange={(d) => handleQuoteFieldChange({ discount: d })}
                  label="Quote"
                />
              </div>
            </div>

            <div className={css.summaryGrid}>
              <span className={css.summaryLabel}>Subtotal</span>
              <span className={css.summaryValue}>{fmtCurrency(quote.subtotal)}</span>

              <span className={css.summaryLabel}>Shipping</span>
              <span className={css.summaryValue}>{fmtCurrency(quote.shipping)}</span>

              <span className={css.summaryLabel}>Freight</span>
              <span className={css.summaryValue}>{fmtCurrency(quote.freight)}</span>

              {quote.discountAmount > 0 && (
                <>
                  <span className={css.summaryLabel}>Discount</span>
                  <span className={css.summaryValue}>
                    −{fmtCurrency(quote.discountAmount)}
                  </span>
                </>
              )}

              <div className={css.summaryDivider} />

              <span className={css.summaryLabel}>Tax ({fmtPercent(quote.taxRate)})</span>
              <span className={css.summaryValue}>{fmtCurrency(quote.taxAmount)}</span>

              <div className={css.summaryDivider} />

              <span className={`${css.summaryLabel} ${css.summaryTotal}`}>Total</span>
              <span className={`${css.summaryValue} ${css.summaryTotal}`}>
                {fmtCurrency(quote.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Modal ──────────────────────────────────────────────── */}
      {addModalOpen && (
        <AddLineItemModal
          onAdd={handleAddLineItem}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </div>
  );
}
