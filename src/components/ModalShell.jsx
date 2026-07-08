import { createPortal } from 'react-dom'
import Backdrop from './Backdrop'
import { GLASS_CARD } from '../lib/theme'

// 'none' (default): no surface — the consumer supplies its own (e.g. the
// existing .glass-rim child div used by NewVisitModal/TimelineEditorModal).
// 'solid': ModalShell itself supplies the app's standard nearly-opaque card
// surface (the same recipe used throughout Settings/Analytics/InvoiceModal/
// WelcomeModal, here made a single shared source instead of re-declared
// per consumer) — for modals that need to stay legible over a dark backdrop.
const SURFACE = {
  none: '',
  solid: `${GLASS_CARD} shadow-sm`,
}

export default function ModalShell({
  open = true,
  onClose,
  children,
  className = '',
  maxWidth = 'max-w-md',
  backdropVariant = 'light',
  surface = 'none',
}) {
  // Portal to <body> so `fixed` positioning resolves against the viewport, not
  // a transformed/blurred ancestor (backdrop-blur / transform / filter all
  // establish a containing block that would otherwise capture `fixed inset-0`,
  // pushing the modal off-centre into the content area). z-index sits above the
  // sticky TopHeader (z-[61]) so the modal's top edge is never tucked under it,
  // and below the Toast layer (z-[100]).
  return createPortal(
    <>
      <Backdrop
        onClick={onClose}
        zIndex="z-[89]"
        variant={backdropVariant}
        className={`transition-opacity duration-300 ease-in-out ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />
      <div className={`fixed inset-0 z-[90] flex items-center justify-center p-3 pointer-events-none ${className}`}>
        <div
          className={`w-full ${maxWidth} transition-all duration-300 ease-in-out ${
            open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          } ${SURFACE[surface]}`}
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  )
}
