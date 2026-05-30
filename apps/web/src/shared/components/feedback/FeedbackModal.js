'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Bug, Lightbulb, MessageCircle, Send, Check } from 'lucide-react';

const TYPES = [
  { id: 'bug', label: 'Bug Report', Icon: Bug },
  { id: 'feature', label: 'Feature Request', Icon: Lightbulb },
  { id: 'feedback', label: 'Feedback', Icon: MessageCircle },
];

const TELEGRAM_URL = 'https://t.me/+524272293948';

const btn = (extra = {}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  padding: '8px 14px',
  transition: 'opacity 0.15s',
  ...extra,
});

export default function FeedbackModal({ isOpen, onClose }) {
  const [type, setType] = useState('feedback');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSent(false);
      setCopied(false);
      setMessage('');
      setName('');
      setType('feedback');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => textareaRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen, sent]);

  if (!isOpen) return null;

  const formatted = [
    `[${TYPES.find((t) => t.id === type)?.label ?? type}]`,
    name ? `From: ${name}` : null,
    '',
    message.trim(),
  ]
    .filter((l) => l !== null)
    .join('\n');

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
    } catch {}
    window.open(TELEGRAM_URL, '_blank', 'noopener,noreferrer');
    setSent(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send feedback"
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--surface-border)',
          borderRadius: 14,
          padding: 24,
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, color: 'var(--app-text)', fontSize: 15 }}>
            Send Feedback
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={btn({
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: 7,
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--muted-text)',
            })}
          >
            <X size={15} />
          </button>
        </div>

        {sent ? (
          /* ── Success state ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#22c55e22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={24} color="#22c55e" />
            </div>
            <p style={{ textAlign: 'center', color: 'var(--app-text)', fontSize: 14, fontWeight: 500, margin: 0 }}>
              Telegram opened!
            </p>
            <p style={{ textAlign: 'center', color: 'var(--muted-text)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {copied
                ? 'Your message was copied to clipboard — just paste it in the chat.'
                : 'Paste your message in the Telegram chat with Edgar.'}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setSent(false)}
                style={btn({ background: 'var(--accent-soft)', color: 'var(--app-text)' })}
              >
                Send another
              </button>
              <button
                type="button"
                onClick={onClose}
                style={btn({ background: 'var(--accent-soft)', color: 'var(--app-text)' })}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <>
            {/* Type selector */}
            <div style={{ display: 'flex', gap: 6 }}>
              {TYPES.map(({ id, label, Icon }) => {
                const active = type === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setType(id)}
                    style={btn({
                      flex: 1,
                      flexDirection: 'column',
                      gap: 4,
                      padding: '8px 6px',
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      border: `1px solid ${active ? 'var(--surface-border)' : 'var(--surface-border)'}`,
                      color: active ? 'var(--app-text)' : 'var(--muted-text)',
                      fontSize: 12,
                    })}
                  >
                    <Icon size={15} strokeWidth={2} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Message */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the bug, idea, or comment…"
              rows={5}
              style={{
                width: '100%',
                resize: 'vertical',
                background: 'var(--surface-muted)',
                border: '1px solid var(--surface-border)',
                borderRadius: 8,
                padding: '10px 12px',
                color: 'var(--app-text)',
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Name (optional) */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name or email (optional)"
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--surface-border)',
                borderRadius: 8,
                padding: '8px 12px',
                color: 'var(--app-text)',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--muted-text)' }}>
                Opens Telegram · ⌘↵ to send
              </span>
              <button
                type="button"
                onClick={handleSend}
                disabled={!message.trim()}
                style={btn({
                  background: message.trim() ? '#2563eb' : 'var(--accent-soft)',
                  color: message.trim() ? '#fff' : 'var(--muted-text)',
                  opacity: message.trim() ? 1 : 0.6,
                  cursor: message.trim() ? 'pointer' : 'default',
                })}
              >
                <Send size={13} />
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
