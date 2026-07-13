const VARIANT_BACKGROUND = {
  light: 'rgba(0, 30, 80, 0.18)',
  dark: 'rgba(2, 6, 23, 0.6)',
}

export default function Backdrop({ onClick, zIndex = 'z-[59]', className = '', variant = 'light' }) {
  return (
    <div
      className={['fixed inset-0', zIndex, className].filter(Boolean).join(' ')}
      style={{ background: VARIANT_BACKGROUND[variant], backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      onClick={onClick}
    />
  )
}
