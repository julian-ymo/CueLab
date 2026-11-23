// CueLab live DDJ-FLX4 panel: mirrors the real controller, shows lesson guides,
// and can be played with the mouse when no controller is connected.
'use strict';
(function (CL) {
  const OR = '#F28A2E', DK = '#151517', ED = '#3A3A3E';
  const TXT = { left: '↺ TURN LEFT', right: '↻ TURN RIGHT', up: '↑ PUSH UP', down: '↓ PULL DOWN', slideup: '↑ SLIDE UP', slidedown: '↓ SLIDE DOWN', center: '⟲ TO 12 O\'CLOCK', press: '● PRESS', hold: '● HOLD', scratch: '⇄ PUSH & PULL', touch: '✋ TOUCH THE TOP', spin: '↻ SPIN', toleft: '← TO THE LEFT', toright: 'TO THE RIGHT →', middle: '↔ TO THE MIDDLE', tap: '● TAP' };

  // ---- layout (1100 × 610), same as the design ----
  function layout() {
    const L = { boxes: [], knobs: [], jogs: [], labels: [], P: {} };
    const box = (id, x, y, w, h, o) => { o = o || {}; L.boxes.push({ id, x, y, w, h, o }); if (id) L.P[id] = { x, y, w, h, round: o.r === '50%' }; };
    const round = (id, x, y, d, o) => { o = o || {}; o.r = '50%'; box(id, x, y, d, d, o); };
    const knob = (id, x, y, d) => { L.knobs.push({ id, x, y, d }); L.P[id] = { x, y, w: d, h: d, round: true }; };
    const lab = (x, y, t, fs, c) => L.labels.push({ x, y, t, fs: fs || 7, c: c || '#C9C9CE' });
    const deck = (n, off) => {
      const p = 'd' + n, X = x => x + off;
      lab(X(50), 37, 'IN'); lab(X(108), 37, 'OUT'); lab(X(165), 37, '4 BEAT/EXIT'); lab(X(248), 32, 'CUE/LOOP'); lab(X(248), 41, 'CALL'); lab(X(327), 37, '– MASTER');
      round(p + 'in', X(50), 62, 36, { bg: OR, border: '#B5651F', led: true });
      round(p + 'out', X(108), 62, 36, { bg: OR, border: '#B5651F', led: true });
      round(p + 'exit', X(165), 62, 26, { bg: '#1E1E21', led: true });
      round(p + 'callL', X(224), 62, 20, { bg: '#1E1E21', text: '◀', fs: 7 });
      round(p + 'callR', X(272), 62, 20, { bg: '#1E1E21', text: '▶', fs: 7 });
      box(null, X(248), 66, 60, 2, { bg: '#4A4A50', bw: 0, r: '1px' });
      round(p + 'sync', X(327), 62, 34, { bg: '#1E1E21', border: OR, fg: OR, fs: 6, text: 'BEAT SYNC', led: true });
      lab(X(50), 98, 'IN ADJ', 6, '#9A9AA0'); lab(X(108), 98, 'OUT ADJ', 6, '#9A9AA0'); lab(X(165), 92, 'ACTIVE', 6, '#9A9AA0');
      lab(X(224), 92, '1/2X DEL', 6, '#9A9AA0'); lab(X(248), 78, 'LOOP', 6, '#9A9AA0'); lab(X(272), 92, '2X MEMORY', 6, '#9A9AA0'); lab(X(327), 92, 'TEMPO RANGE', 6, '#9A9AA0');
      L.jogs.push({ id: p + 'jog', x: X(189), y: 255, d: 324, n });
      L.P[p + 'jog'] = { x: X(189), y: 255, w: 324, h: 324, round: true };
      lab(X(50), 394, 'SHIFT');
      box(p + 'shift', X(50), 414, 24, 24, { bg: '#1E1E21', r: '3px' });
      round(p + 'cue', X(50), 475, 58, { bg: '#111113', border: '#404046', fg: OR, fs: 12, text: 'CUE', led: true });
      round(p + 'play', X(50), 539, 58, { bg: '#111113', border: '#404046', fg: '#B8E04A', fs: 11, text: '▶/‖', led: true });
      lab(X(50), 578, 'PLAY/PAUSE');
      const modes = [['mHot', 'HOT CUE', 'KEYBOARD'], ['mFx', 'PAD FX1', 'PAD FX2'], ['mJump', 'BEAT JUMP', 'BEAT LOOP'], ['mSamp', 'SAMPLER', 'KEY SHIFT']];
      const px = [113, 163, 214, 265];
      for (let i = 0; i < 4; i++) {
        box(p + modes[i][0], X(px[i]), 448, 46, 16, { bg: '#2A1A0E', border: OR, fg: OR, fs: 6.5, text: modes[i][1], r: '3px', led: true });
        lab(X(px[i]), 464, modes[i][2], 5.5, '#9A9AA0');
        box(p + 'p' + (i + 1), X(px[i]), 500, 42, 42, { bg: '#1A1A1C', border: OR, r: '4px', pad: true });
        box(p + 'p' + (i + 5), X(px[i]), 550, 42, 42, { bg: '#1A1A1C', border: OR, r: '4px', pad: true });
      }
      box(p + 'tempo', X(327), 482, 8, 152, { bg: '#0D0D0E', border: '#2A2A2E', r: '3px', track: 'v' });
      for (let t = 0; t < 9; t++) box(null, X(327), 412 + t * 17.5, 44, 1, { bg: '#55555B', bw: 0, r: '0' });
      lab(X(306), 412, '–', 9); lab(X(308), 482, '0', 7); lab(X(306), 552, '+', 9);
      lab(X(327), 578, 'TEMPO');
    };
    box(null, 547.5, 305, 351, 610, { bg: '#242427', bw: 0, r: '0' });
    deck(1, 0); deck(2, 717);
    lab(473, 24, 'LOAD'); lab(621, 24, 'LOAD');
    box('load1', 473, 40, 36, 14, { bg: '#111113', r: '2px' }); box('load2', 621, 40, 36, 14, { bg: '#111113', r: '2px' });
    knob('browse', 547, 36, 36);
    lab(547, 62, 'BACK', 6, '#9A9AA0'); lab(473, 55, 'TREE', 5.5, '#9A9AA0'); lab(621, 55, 'VIEW', 5.5, '#9A9AA0');
    lab(417, 88, 'PERFORMANCE', 5.5, '#9A9AA0'); lab(417, 96, 'DJ CONTROLLER', 5.5, '#9A9AA0'); lab(417, 112, 'DDJ-FLX4', 10, '#E2E2E6');
    lab(417, 178, 'MIC LEVEL'); knob('mic', 417, 198, 28);
    round('smartcfx', 417, 310, 26, { bg: '#2A1A0E', border: OR, fg: OR, fs: 4.5, text: 'SMART CFX' });
    lab(417, 328, 'FX SELECT', 5.5, '#9A9AA0');
    lab(417, 358, 'HP MIX'); knob('hpmix', 417, 377, 28);
    lab(417, 417, 'HP LEVEL'); knob('hplevel', 417, 436, 28);
    round('smartfader', 417, 502, 26, { bg: '#2A1A0E', border: OR, fg: OR, fs: 4.5, text: 'SMART FADER' });
    const chan = (n, x) => {
      lab(x, 66, 'TRIM'); knob('trim' + n, x, 86, 28);
      lab(x, 121, 'HI'); knob('hi' + n, x, 142, 34);
      lab(x, 177, 'MID'); knob('mid' + n, x, 198, 34);
      lab(x, 234, 'LOW'); knob('low' + n, x, 255, 34);
      lab(x, 289, 'CFX'); knob('cfx' + n, x, 310, 34);
      lab(x - 14, 332, 'LOW', 5.5, '#9A9AA0'); lab(x + 14, 332, 'HI', 5.5, '#9A9AA0');
      box('hcue' + n, x, 366, 32, 14, { bg: '#2A1A0E', border: OR, fg: OR, fs: 7, text: 'CUE', r: '2px', led: true });
      lab(x, 389, String(n), 13, '#E2E2E6');
      box('fader' + n, x, 457, 6, 102, { bg: '#0D0D0E', border: '#2A2A2E', r: '2px', track: 'v' });
      for (let t = 0; t < 11; t++) box(null, x, 407 + t * 10, 52, 1, { bg: '#4A4A50', bw: 0, r: '0' });
    };
    chan(1, 501); chan(2, 593);
    lab(547, 120, 'MIDI', 5.5, '#9A9AA0');
    lab(677, 64, 'MASTER LEVEL'); knob('master', 677, 86, 34);
    box('mcue', 677, 142, 32, 14, { bg: '#2A1A0E', border: OR, fg: OR, fs: 7, text: 'CUE', r: '2px' });
    lab(677, 198, 'BEAT FX', 10, '#E2E2E6');
    lab(677, 235, '1   2   1&2', 7);
    box('fxch', 677, 253, 34, 16, { bg: '#111113', r: '3px' });
    lab(677, 295, 'FX SELECT', 6);
    box('fxsel', 677, 309, 32, 14, { bg: '#111113', text: '▼', fs: 7, r: '2px' });
    lab(677, 350, 'BEAT');
    box('fxbL', 660, 366, 24, 14, { bg: '#111113', text: '◀', fs: 7, r: '2px' });
    box('fxbR', 694, 366, 24, 14, { bg: '#111113', text: '▶', fs: 7, r: '2px' });
    lab(660, 380, 'AUTO', 5.5, '#9A9AA0'); lab(694, 380, 'TAP', 5.5, '#9A9AA0');
    lab(677, 409, 'LEVEL/DEPTH'); knob('fxlevel', 677, 436, 34);
    lab(660, 458, 'MIN', 5.5, '#9A9AA0'); lab(694, 458, 'MAX', 5.5, '#9A9AA0');
    lab(677, 477, 'ON/OFF');
    round('fxon', 677, 502, 30, { bg: OR, border: '#B5651F', led: true });
    lab(677, 529, 'RELEASE FX', 5.5, '#9A9AA0');
    box('xfader', 547, 566, 104, 6, { bg: '#0D0D0E', border: '#2A2A2E', r: '2px', track: 'h' });
    box(null, 496, 566, 1, 40, { bg: '#5A5A60', bw: 0, r: '0' }); box(null, 598, 566, 1, 40, { bg: '#5A5A60', bw: 0, r: '0' });
    return L;
  }
  const LAYOUT = layout();
  CL.panelLayout = LAYOUT;

  function div(cls, style, text) { const e = document.createElement('div'); if (cls) e.className = cls; if (style) e.style.cssText = style; if (text != null) e.textContent = text; return e; }

  class Panel {
    constructor(host, opts) {
      this.opts = Object.assign({ interactive: true }, opts || {});
      this.guide = {};
      this.root = div('flx', 'position:relative;width:1100px;height:610px;');
      this.els = {};
      this.handles = {};
      this.meters = { 1: [], 2: [] };
      const L = LAYOUT;
      L.boxes.forEach(b => {
        const o = b.o;
        const e = div('flx-box' + (b.id ? ' flx-ctl' : '') + (o.pad ? ' flx-pad' : ''),
          `left:${b.x - b.w / 2}px;top:${b.y - b.h / 2}px;width:${b.w}px;height:${b.h}px;border-radius:${o.r || '4px'};background:${o.bg || DK};border:${o.bw != null ? o.bw : 2}px solid ${o.border || ED};color:${o.fg || '#D4D4D8'};font-size:${o.fs || 7}px`,
          o.text || '');
        if (b.id) { e.dataset.id = b.id; e.dataset.border = o.border || ED; e.dataset.bg = o.bg || DK; this.els[b.id] = e; }
        this.root.appendChild(e);
      });
      // fader / slider handles
      const handle = (id, w, h) => { const e = div('flx-handle', `width:${w}px;height:${h}px`); this.root.appendChild(e); this.handles[id] = e; };
      handle('d1tempo', 30, 18); handle('d2tempo', 30, 18); handle('fader1', 34, 14); handle('fader2', 34, 14); handle('xfader', 12, 28);
      // level meters
      [[1, 538], [2, 557]].forEach(([n, x]) => {
        const segs = ['#F28A2E', '#F28A2E', '#F28A2E', '#8BD650', '#8BD650'];
        for (let s = 0; s < 5; s++) { const e = div('flx-seg', `left:${x - 3}px;top:${165 + s * 18 - 6}px;background:${segs[s]}`); this.root.appendChild(e); this.meters[n].push(e); }
      });
      this.midiDot = div('flx-seg', 'left:541px;top:128px;width:12px;height:3px;background:#3A3A3E'); this.root.appendChild(this.midiDot);
      L.jogs.forEach(j => {
        const e = div('flx-jog flx-ctl', `left:${j.x - j.d / 2}px;top:${j.y - j.d / 2}px;width:${j.d}px;height:${j.d}px`);
        e.dataset.id = j.id;
        e.innerHTML = '<div class="flx-jog-rot"><span></span></div><div class="flx-jog-mid"><div class="flx-jog-plat"><div class="flx-jog-ring"></div></div></div>';
        this.els[j.id] = e; this.jogRot = this.jogRot || {}; this.jogRot[j.id] = e.firstChild;
        this.root.appendChild(e);
      });
      L.knobs.forEach(k => {
        const e = div('flx-knob flx-ctl', `left:${k.x - k.d / 2}px;top:${k.y - k.d / 2}px;width:${k.d}px;height:${k.d}px`);
        e.dataset.id = k.id; e.innerHTML = '<span></span>';
        this.els[k.id] = e;
        this.root.appendChild(e);
      });
      L.labels.forEach(t => { this.root.appendChild(div('flx-lab', `left:${t.x}px;top:${t.y}px;font-size:${t.fs}px;color:${t.c}`, t.t)); });
      this.overlay = div('flx-overlay', 'position:absolute;inset:0;pointer-events:none');
      this.root.appendChild(this.overlay);
      host.appendChild(this.root);
      if (this.opts.interactive) this.bindMouse();
      this.updateGuide();
    }

    setGuide(g) { g = g || {}; const sig = JSON.stringify(g); if (sig === this._sig) return; this._sig = sig; this.guide = g; this.updateGuide(); }
    updateGuide() {
      const g = this.guide, P = LAYOUT.P;
      const hl = g.hl || [], ok = g.ok || [], wrong = g.wrong || [], lit = g.lit || [], arrows = g.arrows || {}, order = g.order || {};
      Object.entries(this.els).forEach(([id, e]) => {
        e.classList.toggle('g-hl', hl.indexOf(id) >= 0);
        e.classList.toggle('g-ok', ok.indexOf(id) >= 0 && hl.indexOf(id) < 0);
        e.classList.toggle('g-wrong', wrong.indexOf(id) >= 0);
      });
      const ov = this.overlay; ov.innerHTML = '';
      const place = p => {
        if (p.w > 200) return { l: p.x, t: p.y + 96, tx: '-50%' };
        if (p.x > 760) return { l: p.x - p.w / 2 - 10, t: p.y - 11, tx: '-100%' };
        if (p.x > 470 && p.x < 630) return { l: p.x, t: p.y + p.h / 2 + 5, tx: '-50%' };
        return { l: p.x + p.w / 2 + 10, t: p.y - 11, tx: '0' };
      };
      const ids = {}; Object.keys(arrows).forEach(k => ids[k] = 1); lit.forEach(k => ids[k] = 1);
      Object.keys(ids).forEach(id => {
        const p = P[id]; if (!p) return;
        const a = arrows[id], isLit = lit.indexOf(id) >= 0;
        let text = a ? (TXT[a] || a) : '';
        if (isLit) text = text ? text + ' · LIT ON YOUR FLX4' : '✦ LIT ON YOUR FLX4';
        const pos = place(p);
        ov.appendChild(div('flx-callout', `left:${pos.l}px;top:${pos.t}px;transform:translateX(${pos.tx});background:${a ? '#FF5FA2' : '#FFB547'};color:${a ? '#1A0710' : '#1A1206'}`, text));
        const rad = p.round ? '50%' : '8px';
        if (isLit) ov.appendChild(div('flx-ring', `left:${p.x - p.w / 2 - 6}px;top:${p.y - p.h / 2 - 6}px;width:${p.w + 12}px;height:${p.h + 12}px;border-radius:${rad};border:2px dashed #FFB547`));
        if (a === 'press' || a === 'tap' || a === 'hold') {
          ov.appendChild(div('flx-ring flx-ripple', `left:${p.x - p.w / 2 - 12}px;top:${p.y - p.h / 2 - 12}px;width:${p.w + 24}px;height:${p.h + 24}px;border-radius:${rad};border:2px solid #FF5FA2`));
        }
      });
      wrong.forEach(id => {
        const p = P[id]; if (!p) return;
        let pos = place(p);
        if (p.x > 470 && p.x < 630) pos = p.x < 547 ? { l: p.x - p.w / 2 - 10, t: p.y - 11, tx: '-100%' } : { l: p.x + p.w / 2 + 10, t: p.y - 11, tx: '0' };
        ov.appendChild(div('flx-callout', `left:${pos.l}px;top:${pos.t}px;transform:translateX(${pos.tx});background:#FF9F2E;color:#1A1206`, g.wrongText || '✕ NOT THIS ONE'));
      });
      Object.keys(order).forEach(id => {
        const p = P[id]; if (!p) return;
        const off = p.w > 200 ? 0.35 : 0.5;
        ov.appendChild(div('flx-badge', `left:${p.x - p.w * off - 12}px;top:${p.y - p.h * off - 12}px`, String(order[id])));
      });
      CL.guideLit = lit;
    }

    update() {
      const V = Object.assign({}, CL.val, this.guide.ghost || {}), A = CL.audio;
      const P = LAYOUT.P;
      LAYOUT.knobs.forEach(k => { const e = this.els[k.id]; const v = V[k.id]; e.style.transform = 'rotate(' + (-135 + (typeof v === 'number' ? v : 0.5) * 270) + 'deg)'; });
      const setH = (id, x, y) => { const h = this.handles[id]; h.style.left = (x - h.offsetWidth / 2) + 'px'; h.style.top = (y - h.offsetHeight / 2) + 'px'; };
      [1, 2].forEach(n => {
        const p = P['d' + n + 'tempo']; setH('d' + n + 'tempo', p.x, 412 + V['d' + n + 'tempo'] * 140);
        const f = P['fader' + n]; setH('fader' + n, f.x, 502 - V['fader' + n] * 90);
        const d = A && A.ready ? A.decks[n] : null;
        const jr = this.jogRot['d' + n + 'jog'];
        const spin = d && d.buffer ? d.getPos() * 200 : 0;
        jr.style.transform = 'rotate(' + (spin + V['d' + n + 'jog']) + 'deg)';
        // LEDs
        const led = (id, on, color) => { const e = this.els[id]; if (e) e.classList.toggle('led-on', !!on); };
        led('d' + n + 'play', d && d.playing);
        led('d' + n + 'cue', d && d.buffer && !d.playing);
        led('d' + n + 'sync', d && d.sync);
        led('d' + n + 'exit', d && d.loop.on); led('d' + n + 'in', d && d.loop.on); led('d' + n + 'out', d && d.loop.on);
        led('hcue' + n, CL.val['hcue' + n + 'On']);
        ['mHot', 'mFx', 'mJump', 'mSamp'].forEach(m => led('d' + n + m, d && d.padMode === { mHot: 'hot', mFx: 'fx', mJump: 'jump', mSamp: 'samp' }[m]));
        for (let i = 0; i < 8; i++) {
          const e = this.els['d' + n + 'p' + (i + 1)];
          const lit = d && ((d.padMode === 'hot' && d.hot[i] != null) || d.padMode === 'jump' || (d.padMode === 'samp' && A.samples && A.samples[i]));
          e.classList.toggle('pad-lit', !!lit);
          e.classList.toggle('pad-down', !!V['d' + n + 'p' + (i + 1)]);
        }
        const lv = A && A.ready ? A.levels[n] : 0; const segsOn = Math.min(5, Math.round(lv * 14));
        this.meters[n].forEach((e, s) => { e.style.opacity = (4 - s) < segsOn ? 1 : 0.15; });
        this.els['d' + n + 'shift'].classList.toggle('btn-down', !!V['d' + n + 'shift']);
      });
      const xf = P.xfader; setH('xfader', 496 + V.xfader * 102, xf.y);
      if (A && A.ready) this.els.fxon.classList.toggle('led-on', A.fx.on);
      ['d1play', 'd2play', 'd1cue', 'd2cue', 'd1sync', 'd2sync', 'load1', 'load2', 'fxsel', 'fxbL', 'fxbR', 'fxch', 'd1in', 'd2in', 'd1out', 'd2out', 'd1exit', 'd2exit', 'd1callL', 'd2callL', 'd1callR', 'd2callR', 'hcue1', 'hcue2', 'fxon']
        .forEach(id => { const e = this.els[id]; if (e) e.classList.toggle('btn-down', V[id] === true); });
      const t = CL.midiFlash && performance.now() - CL.midiFlash < 120;
      this.midiDot.style.background = t ? '#8BD650' : (CL.midi && CL.midi.status === 'connected' ? '#3F6B2A' : '#3A3A3E');
    }

    // ---- mouse ----
    bindMouse() {
      const root = this.root;
      root.addEventListener('pointerdown', e => {
        const el = e.target.closest('.flx-ctl'); if (!el) return;
        const id = el.dataset.id, c = CL.controls[id]; if (!c) return;
        e.preventDefault(); root.setPointerCapture(e.pointerId);
        const scale = root.getBoundingClientRect().width / 1100;
        const start = { x: e.clientX, y: e.clientY, v: CL.val[id] };
        let move = null, up = null;
        if (c.kind === 'button' || c.kind === 'pad') {
          CL.input(id, true, 'mouse');
          up = () => CL.input(id, false, 'mouse');
        } else if (c.kind === 'knob' || c.kind === 'encoder') {
          if (e.detail === 2 && c.kind === 'knob') { CL.input(id, c.def != null ? c.def : 0.5, 'mouse'); return; }
          let last = e.clientY;
          move = ev => {
            const dy = (ev.clientY - last) / scale; last = ev.clientY;
            if (c.kind === 'encoder') { if (Math.abs(dy) > 6) CL.emit('browse', { delta: dy > 0 ? 1 : -1 }); return; }
            CL.input(id, CL.clamp(CL.val[id] - dy / 160, 0, 1), 'mouse');
          };
        } else if (c.kind === 'fader' || c.kind === 'tempo' || c.kind === 'xfader') {
          const r = root.getBoundingClientRect(), P = LAYOUT.P[id];
          const set = ev => {
            const lx = (ev.clientX - r.left) / scale, ly = (ev.clientY - r.top) / scale;
            let v;
            if (c.kind === 'fader') v = (502 - ly) / 90;
            else if (c.kind === 'tempo') v = (ly - 412) / 140;
            else v = (lx - 496) / 102;
            CL.input(id, CL.clamp(v, 0, 1), 'mouse');
          };
          set(e); move = set;
        } else if (c.kind === 'jog') {
          const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const rad = Math.hypot(e.clientX - cx, e.clientY - cy) / scale;
          const top = rad < 120;
          if (top) { CL.jogTouch[id] = true; CL.emit('jog-touch', { id, down: true }); }
          let lastA = Math.atan2(e.clientY - cy, e.clientX - cx);
          move = ev => {
            const a = Math.atan2(ev.clientY - cy, ev.clientX - cx); let d = a - lastA; lastA = a;
            if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
            const ticks = Math.round(d / (2 * Math.PI) * 720);
            if (ticks) CL.input(id, ticks, 'mouse', { top, side: !top });
          };
          up = () => { if (top) { CL.jogTouch[id] = false; CL.emit('jog-touch', { id, down: false }); } };
        }
        const mm = ev => move && move(ev);
        const mu = () => { root.removeEventListener('pointermove', mm); root.removeEventListener('pointerup', mu); root.removeEventListener('pointercancel', mu); up && up(); };
        root.addEventListener('pointermove', mm); root.addEventListener('pointerup', mu); root.addEventListener('pointercancel', mu);
      });
    }
  }
  CL.Panel = Panel;

  // one shared animation loop for all panels on screen
  CL.panels = new Set();
  function loop() { requestAnimationFrame(loop); CL.panels.forEach(p => { if (p.root.isConnected) p.update(); else CL.panels.delete(p); }); }
  requestAnimationFrame(loop);
  CL.makePanel = (host, opts) => { const p = new Panel(host, opts); CL.panels.add(p); return p; };
  CL.on('control', ev => { if (ev.src === 'midi') CL.midiFlash = performance.now(); });
})(window.CL);
