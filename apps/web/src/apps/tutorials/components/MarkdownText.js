'use client';

// Renders a tiny subset of inline markdown: **bold**, *italic*, `code`.
// Splits on these tokens and returns React elements — no dangerouslySetInnerHTML.

const TOKEN_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function renderToken(token, i) {
  if (token.startsWith('**') && token.endsWith('**')) {
    return <strong key={i}>{token.slice(2, -2)}</strong>;
  }
  if (token.startsWith('*') && token.endsWith('*')) {
    return <em key={i}>{token.slice(1, -1)}</em>;
  }
  if (token.startsWith('`') && token.endsWith('`')) {
    return <code key={i} className="tutorial-inline-code">{token.slice(1, -1)}</code>;
  }
  return token;
}

export default function MarkdownText({ children }) {
  if (!children) return null;
  const parts = String(children).split(TOKEN_RE);
  return <>{parts.map((part, i) => renderToken(part, i))}</>;
}
