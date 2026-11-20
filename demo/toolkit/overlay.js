// Installs window.__demo once per page load (idempotent): the caption bar, title card, pointer and ring,
// shown as manual popovers so they sit in the top layer, above modal dialogs.
// Copied from Demo.java (OVERLAY_JS) in the Selenium reference toolkit, with two changes worth porting back:
// the caption is `width: max-content` (anchored at left: 50% it could only grow to half the screen, so it wrapped),
// and it moves to the top while the pointer is on something near the bottom (e.g. a toast), so it doesn't cover it.
if (!window.__demo) {
  const css = document.createElement('style');
  css.textContent = `
    .__demo-layer { position: fixed; margin: 0; padding: 0; border: 0; background: transparent;
      overflow: visible; font-family: Inter, system-ui, sans-serif; pointer-events: none; }
    #__demo-caption { inset: auto auto 32px 50%; transform: translateX(-50%); max-width: 80vw;
      background: rgba(20,20,20,.92); color: #fff; border-radius: 14px; padding: 14px 22px;
      box-shadow: 0 12px 32px rgba(0,0,0,.25); gap: 14px; align-items: baseline; }
    #__demo-caption { width: max-content; }
    #__demo-caption.top { inset: 32px auto auto 50%; }
    #__demo-caption:popover-open { display: flex; }
    #__demo-caption .id { font-size: 14px; font-weight: 700; background: #fff; color: #141414;
      border-radius: 6px; padding: 3px 8px; white-space: nowrap; }
    #__demo-caption .title { font-size: 18px; font-weight: 600; white-space: nowrap; }
    #__demo-caption .step { font-size: 18px; color: #d9d9d9; }
    #__demo-caption .step:not(:empty)::before { content: '—'; margin-right: 10px; color: #8a8a8a; }
    #__demo-card { inset: 0; width: 100vw; height: 100vh; max-width: none; max-height: none;
      background: rgba(20,20,20,.94); color: #fff; flex-direction: column;
      align-items: center; justify-content: center; gap: 16px; text-align: center; }
    /* Only while open: an author display value would override the hidden popover's display: none. */
    #__demo-card:popover-open { display: flex; }
    #__demo-card h1 { margin: 0; font-size: 56px; font-weight: 600; letter-spacing: -0.02em; }
    #__demo-card p { margin: 0; font-size: 24px; color: #cfcfcf; max-width: 60vw; }
    #__demo-pointer { width: 22px; height: 22px; border-radius: 50%; background: rgba(217,59,46,.85);
      border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35); inset: auto;
      transition: left .45s ease, top .45s ease; }
    #__demo-ring { inset: auto; border: 3px solid rgba(217,59,46,.9); border-radius: 10px;
      animation: __demo-pulse .9s ease-out 1 forwards; }
    @keyframes __demo-pulse { from { opacity: 1; transform: scale(1.12); } to { opacity: 0; transform: scale(1); } }`;
  document.head.appendChild(css);
  const layer = (id) => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = '__demo-layer';
      el.setAttribute('popover', 'manual');
      document.body.appendChild(el);
    }
    return el;
  };
  // Re-showing a popover moves it to the top of the top layer (above any open dialog).
  const raise = (el) => { if (el.matches(':popover-open')) el.hidePopover(); el.showPopover(); };
  window.__demo = {
    caption(id, title, step) {
      const el = layer('__demo-caption');
      el.innerHTML = '';
      for (const [cls, text] of [['id', id], ['title', title], ['step', step]]) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        el.appendChild(span);
      }
      raise(el);
    },
    card(title, subtitle) {
      const el = layer('__demo-card');
      el.innerHTML = '';
      const h = document.createElement('h1'); h.textContent = title; el.appendChild(h);
      if (subtitle) { const p = document.createElement('p'); p.textContent = subtitle; el.appendChild(p); }
      raise(el);
    },
    hideCard() {
      const el = document.getElementById('__demo-card');
      if (el && el.matches(':popover-open')) el.hidePopover();
    },
    point(target) {
      const r = target.getBoundingClientRect();
      const pointer = layer('__demo-pointer');
      if (!pointer.matches(':popover-open')) {
        pointer.style.left = (innerWidth / 2) + 'px';
        pointer.style.top = (innerHeight / 2) + 'px';
      }
      raise(pointer);
      requestAnimationFrame(() => {
        pointer.style.left = (r.left + r.width / 2 - 11) + 'px';
        pointer.style.top = (r.top + r.height / 2 - 11) + 'px';
      });
      const ring = layer('__demo-ring');
      ring.style.left = (r.left - 6) + 'px';
      ring.style.top = (r.top - 6) + 'px';
      ring.style.width = (r.width + 12) + 'px';
      ring.style.height = (r.height + 12) + 'px';
      ring.style.animation = 'none';
      void ring.offsetWidth;
      ring.style.animation = '';
      raise(ring);
      const cap = document.getElementById('__demo-caption');
      if (cap) { cap.classList.toggle('top', r.bottom > innerHeight - 180); raise(cap); }
    },
  };
}
