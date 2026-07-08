export default function MockSectionPanel({ accentColor, className = '', children }) {
  return (
    <section
      className={`rounded-3xl border border-white/50 ${className}`}
      style={{ backgroundColor: accentColor + '20', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      {children}
    </section>
  )
}
