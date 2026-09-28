'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MOBILE_QUERY = '(max-width: 639px)';
const GAP = 6;

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

/**
 * A dropdown panel rendered in a portal so it is never clipped by scrolling
 * tables, cards or maps. On desktop it is positioned next to the trigger and
 * flips above / shifts left when there is not enough room; on phones it
 * becomes a bottom sheet.
 *
 * `trigger` is a render function receiving { open, toggle, ref }.
 * `children` is a render function receiving { close }.
 */
export default function Popover({ trigger, children, align = 'end', width = 224, title, sheetOnMobile = true }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const isMobile = useIsMobile();
  const asSheet = sheetOnMobile && isMobile;

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback((e) => { e?.stopPropagation?.(); setOpen((o) => !o); }, []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const t = trigger.getBoundingClientRect();
    const panelHeight = panel.offsetHeight;
    const panelWidth = Math.max(width, align === 'stretch' ? t.width : 0);
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = align === 'start' || align === 'stretch' ? t.left : t.right - panelWidth;
    left = Math.min(Math.max(8, left), vw - panelWidth - 8);

    const below = vh - t.bottom;
    const openUp = below < panelHeight + GAP + 8 && t.top > below;
    const top = openUp ? Math.max(8, t.top - panelHeight - GAP) : t.bottom + GAP;
    const maxHeight = openUp ? t.top - GAP - 8 : vh - t.bottom - GAP - 8;

    setPos({ top, left, width: panelWidth, maxHeight, origin: openUp ? 'bottom' : 'top' });
  }, [align, width]);

  useLayoutEffect(() => {
    if (!open || asSheet) return;
    place();
  }, [open, asSheet, place]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (panelRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (!asSheet) place();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, asSheet, place]);

  const panel = open && typeof document !== 'undefined' && createPortal(
    asSheet ? (
      <div className="fixed inset-0 z-[1200] flex items-end" onClick={(e) => e.stopPropagation()}>
        <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={close} />
        <div
          ref={panelRef}
          role="menu"
          className="animate-sheet-up relative max-h-[75dvh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
        >
          <div className="sticky top-0 z-10 bg-surface pb-2 pt-3">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-divider" />
            {title && <p className="mt-3 px-5 text-xs font-bold uppercase tracking-wider text-ink-muted">{title}</p>}
          </div>
          <div className="px-2 pb-2 [&_[role=menuitem]]:py-3 [&_[role=menuitem]]:text-sm">{children({ close })}</div>
        </div>
      </div>
    ) : (
      <div
        ref={panelRef}
        role="menu"
        onClick={(e) => e.stopPropagation()}
        style={pos
          ? { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, transformOrigin: pos.origin }
          : { top: -9999, left: -9999, width }}
        className="animate-pop-in fixed z-[1200] overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
      >
        {title && <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">{title}</p>}
        {children({ close })}
      </div>
    ),
    document.body
  );

  return (
    <>
      {trigger({ open, toggle, ref: triggerRef })}
      {panel}
    </>
  );
}

export function MenuItem({ icon: Icon, children, onClick, active, danger, disabled, hint }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        danger ? 'text-critical hover:bg-critical/10' : active ? 'bg-brand/10 text-brand' : 'text-ink hover:bg-surface-2'
      }`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
    </button>
  );
}
