import { useEffect, useRef } from 'react';

export default function Sheet({ open, onClose, title, children, height = 'auto' }) {
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-enter"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`relative bg-white rounded-t-[20px] sheet-enter flex flex-col ${heightClass}`}
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-warm-300 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
            <h2 className="text-lg font-medium text-warm-800">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-warm-100 text-warm-500 press-scale"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
