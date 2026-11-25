import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Bottom sheet.
 *
 * Two things here are load-bearing and easy to break again:
 *
 * 1. It renders in a portal on <body>. Rendered inline it is a descendant of
 *    the scrolling page, and any ancestor with a transform, filter or
 *    backdrop-filter turns `position: fixed` into "fixed to that ancestor",
 *    which clips the sheet. The bottom nav uses backdrop-filter, so this was
 *    not hypothetical.
 *
 * 2. z-index sits above the nav (z-50) and the sidebar (z-60). A modal that
 *    the navigation paints on top of is not just ugly — the nav stays tappable
 *    underneath a dialog that claims aria-modal.
 *
 * `footer` renders outside the scroll area, so primary actions stay on screen
 * no matter how long the content is. Put Save there, not at the end of
 * children, or it scrolls out of reach on a small phone.
 */
export default function Sheet({ open, onClose, title, children, footer, height = 'auto' }) {
  const sheetRef = useRef(null);
  const startY = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function handleTouchStart(e) {
    startY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e) {
    if (startY.current === null) return;
    const diff = e.changedTouches[0].clientY - startY.current;
    if (diff > 80) onClose();
    startY.current = null;
  }

  if (!open) return null;

  const heightClass = height === 'full'
    ? 'max-h-[92vh]'
    : height === 'tall'
    ? 'max-h-[80vh]'
    : 'max-h-[70vh]';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40 backdrop-enter"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`relative bg-card rounded-t-[20px] sheet-enter flex flex-col ${heightClass}`}
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-tx-3 rounded-full opacity-40" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
            <h2 className="text-lg font-semibold text-tx">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-card-2 text-tx-3 press-scale"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
        {footer && (
          <div className="flex-shrink-0 px-4 pt-3 border-t border-hair bg-card">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
