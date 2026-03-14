export default function ModulePlaceholder({ title, description }) {
  return (
    <section
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f9fb',
        color: '#0f172a',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{title}</h1>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.55, opacity: 0.8 }}>{description}</p>
      </div>
    </section>
  );
}
