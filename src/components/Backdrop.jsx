const VARIANT_BACKGROUND = {
  light: 'rgba(0, 30, 80, 0.18)',
  dark: 'rgba(2, 6, 23, 0.6)',
}

export default function Backdrop({ onClick, zIndex = 'z-[59]', className = '', variant = 'light', blur = true }) {
  // `blur` can be disabled for overlays that mount/unmount during a transform
  // animation (e.g. the mobile sidebar): on iOS WebKit a full-screen
  // backdrop-filter toggled mid-animation leaves a stale repaint strip
  // (typically at the top safe-area). A plain tinted overlay avoids that.
  return (
    <div
      className={['fixed inset-0', zIndex, className].filter(Boolean).join(' ')}
      style={{
        background: VARIANT_BACKGROUND[variant],
        ...(blur ? { backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' } : null),
      }}
      onClick={onClick}
    />
  )
}
