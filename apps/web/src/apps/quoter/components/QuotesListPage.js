'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Calculator,
  Search,
  Plus,
  Trash2,
  Copy,
  Pencil,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { listQuotes, deleteQuote, duplicateQuote, bulkDeleteQuotes } from '@/src/core/api/quoterApi';
import css from '../styles/quotesList.module.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PAGE_SIZE = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mo}-${dy}`;
}

function statusBadgeClass(status) {
  const map = {
    DRAFT: css.badgeDraft,
    SENT: css.badgeSent,
    APPROVED: css.badgeApproved,
    REJECTED: css.badgeRejected,
    CANCELLED: css.badgeCancelled,
  };
  return `${css.badge} ${map[status] ?? css.badgeDraft}`;
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ title, body, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  return (
    <div className={css.overlay} onClick={onCancel} role="presentation">
      <div className={css.modal} onClick={(e) => e.stopPropagation()}>
        <p className={css.modalTitle}>{title}</p>
        <p className={css.modalBody}>{body}</p>
        <div className={css.modalActions}>
          <button className={css.btn} onClick={onCancel}>Cancel</button>
          <button
            className={`${css.btn} ${danger ? css.btnDanger : css.btnPrimary}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Rows ────────────────────────────────────────────────────────────

function SkeletonRows({ count = 8 }) {
  const widths = [60, 120, 80, 60, 70, 90, 60, 80];
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} className={css.skeletonRow}>
      <td className={css.tdCheck}><div className={css.skeletonBar} style={{ width: 15, height: 15, borderRadius: 3 }} /></td>
      {widths.map((w, j) => (
        <td key={j}><div className={css.skeletonBar} style={{ width: `${w}px` }} /></td>
      ))}
      <td className={css.tdActions} />
    </tr>
  ));
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, total, pageSize, onPage }) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages = [];
  const delta = 2;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - delta && p <= page + delta)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <div className={css.pagination}>
      <span>{total === 0 ? 'No results' : `${start}–${end} of ${total}`}</span>
      <div className={css.pageButtons}>
        <button
          className={css.pageBtn}
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className={css.pageBtn} style={{ cursor: 'default', color: 'var(--muted-text)' }}>…</span>
          ) : (
            <button
              key={p}
              className={`${css.pageBtn} ${p === page ? css.pageBtnActive : ''}`}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          className={css.pageBtn}
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuotesListPage() {
  const [quotes, setQuotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [confirm, setConfirm] = useState(null); // { type, ids, label }

  const searchTimer = useRef(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchQuotes = useCallback(async (p, q, s) => {
    setLoading(true);
    try {
      const data = await listQuotes({ search: q, status: s, page: p, pageSize: PAGE_SIZE });
      setQuotes(data.results);
      setTotal(data.count);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Failed to fetch quotes', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes(page, search, statusFilter);
  }, [page, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchQuotes(1, val, statusFilter);
    }, 300);
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
    setSelected(new Set());
  };

  const handlePage = (p) => {
    setPage(p);
    setSelected(new Set());
  };

  // ── Selection ────────────────────────────────────────────────────────────

  const allPageIds = quotes.map((q) => q.id);
  const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selected.has(id));
  const someSelected = allPageIds.some((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allPageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...allPageIds]));
    }
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleDeleteOne = (quote) => {
    setConfirm({
      type: 'delete-one',
      ids: [quote.id],
      title: 'Delete quote',
      body: `Delete "${quote.quoteNumber}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
    });
  };

  const handleBulkDelete = () => {
    const ids = [...selected];
    setConfirm({
      type: 'bulk-delete',
      ids,
      title: `Delete ${ids.length} quote${ids.length > 1 ? 's' : ''}`,
      body: `Permanently delete ${ids.length} selected quote${ids.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete all',
    });
  };

  const handleConfirm = async () => {
    const { type, ids } = confirm;
    setConfirm(null);
    try {
      if (type === 'delete-one') {
        await deleteQuote(ids[0]);
      } else if (type === 'bulk-delete') {
        await bulkDeleteQuotes(ids);
      }
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      fetchQuotes(page, search, statusFilter);
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleDuplicate = async (quote) => {
    try {
      await duplicateQuote(quote.id);
      fetchQuotes(1, search, statusFilter);
      setPage(1);
    } catch (err) {
      console.error('Duplicate failed', err);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const selectedCount = selected.size;

  return (
    <div className={css.root}>

      {/* Header */}
      <header className={css.header}>
        <div className={css.headerLeft}>
          <Calculator size={18} strokeWidth={2.2} style={{ color: 'var(--muted-text)' }} />
          <h1 className={css.headerTitle}>Quotes</h1>
          {!loading && (
            <span className={css.headerCount}>{total}</span>
          )}
        </div>
        <Link href="/quoter/new" className={`${css.btn} ${css.btnPrimary}`}>
          <Plus size={14} strokeWidth={2.5} />
          New Quote
        </Link>
      </header>

      {/* Toolbar */}
      <div className={css.toolbar}>
        <div className={css.searchWrap}>
          <Search size={14} className={css.searchIcon} />
          <input
            type="text"
            className={css.searchInput}
            placeholder="Search by number or client…"
            value={search}
            onChange={handleSearchChange}
          />
        </div>

        <select
          className={css.filterSelect}
          value={statusFilter}
          onChange={handleStatusChange}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className={css.bulkBar}>
          <span className={css.bulkCount}>
            <strong>{selectedCount}</strong> quote{selectedCount > 1 ? 's' : ''} selected
          </span>
          <button className={`${css.btn} ${css.btnDanger}`} onClick={handleBulkDelete}>
            <Trash2 size={13} />
            Delete selected
          </button>
          <button
            className={css.btn}
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className={css.content}>
        <div className={css.tableCard}>
          <div className={css.tableWrap}>
            <table className={css.table}>
              <thead>
                <tr>
                  <th className={css.thCheck}>
                    <input
                      type="checkbox"
                      className={css.checkbox}
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th>Quote #</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th className={css.numCell} style={{ textAlign: 'right' }}>Total</th>
                  <th>Linked Design</th>
                  <th>Created</th>
                  <th className={css.thActions} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows count={8} />
                ) : quotes.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className={css.emptyState}>
                        <FileText size={32} strokeWidth={1.5} style={{ color: 'var(--muted-text)' }} />
                        <p className={css.emptyTitle}>
                          {search || statusFilter ? 'No quotes match your filters' : 'No quotes yet'}
                        </p>
                        <p className={css.emptySubtitle}>
                          {search || statusFilter
                            ? 'Try adjusting your search or status filter.'
                            : 'Create your first quote from a CAD design or manually.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  quotes.map((quote) => {
                    const isSelected = selected.has(quote.id);
                    const designId = quote.linkedDesign?.designId;
                    const clientName = quote.clientRef?.name;
                    const createdAt = quote.audit?.createdAt;

                    return (
                      <tr key={quote.id} className={isSelected ? css.selected : ''}>
                        <td className={css.tdCheck}>
                          <input
                            type="checkbox"
                            className={css.checkbox}
                            checked={isSelected}
                            onChange={() => toggleOne(quote.id)}
                            aria-label={`Select ${quote.quoteNumber}`}
                          />
                        </td>

                        <td>
                          <Link href={`/quoter/${quote.id}`} className={css.quoteLink}>
                            {quote.quoteNumber}
                          </Link>
                        </td>

                        <td>
                          {clientName ? (
                            <span>{clientName}</span>
                          ) : (
                            <span className={css.muted}>—</span>
                          )}
                        </td>

                        <td>
                          <span className={statusBadgeClass(quote.status)}>
                            {quote.status}
                          </span>
                        </td>

                        <td>
                          <span className={css.muted}>{quote.lineItemCount ?? 0}</span>
                        </td>

                        <td className={css.numCell}>
                          {fmtCurrency(quote.total)}
                        </td>

                        <td>
                          {designId ? (
                            <span className={css.muted} title={designId} style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>
                              {designId.length > 20 ? `${designId.slice(0, 20)}…` : designId}
                            </span>
                          ) : (
                            <span className={css.muted}>—</span>
                          )}
                        </td>

                        <td>
                          <span className={css.muted}>{fmtDate(createdAt)}</span>
                        </td>

                        <td className={css.tdActions}>
                          <div className={css.actions}>
                            <Link
                              href={`/quoter/${quote.id}`}
                              className={css.iconBtn}
                              title="Edit quote"
                            >
                              <Pencil size={13} />
                            </Link>
                            <button
                              className={css.iconBtn}
                              title="Duplicate quote"
                              onClick={() => handleDuplicate(quote)}
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              className={`${css.iconBtn} ${css.iconBtnDanger}`}
                              title="Delete quote"
                              onClick={() => handleDeleteOne(quote)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && total > PAGE_SIZE && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onPage={handlePage}
            />
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          danger
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
