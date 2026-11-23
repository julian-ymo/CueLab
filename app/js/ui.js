// CueLab UI shell: fit-to-screen stage, sidebar, router, shared widgets.
'use strict';
(function (CL) {
  const $ = (sel, root) => (root || document).querySelector(sel);
  CL.$ = $;
  CL.h = function (html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  // ---------- scale the 1920×1080 stage to any window ----------
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / 1920, vh / 1080);
    const st = $('#stage');
    st.style.transform = 'scale(' + s + ')';
    st.style.left = Math.round((vw - 1920 * s) / 2) + 'px';
    st.style.top = Math.round((vh - 1080 * s) / 2) + 'px';
    CL.stageScale = s;
  }
  window.addEventListener('resize', fit);
  CL.fit = fit;

  // ---------- router ----------
  CL.views = {};
  let current = null, currentName = '';
  CL.go = function (name, params) {
    if (name !== 'study' && CL.study && CL.study.running && CL.study.stopAll) { CL.study.stopAll(); CL.toast('Study music paused — you left Study mode.'); }
    if (current && current.destroy) current.destroy();
    const main = $('#main'); main.innerHTML = '';
    currentName = name;
    const v = CL.views[name];
    current = v ? v(main, params || {}) : null;
    renderSide();
  };
  CL.currentView = () => currentName;

  const NAV = [['home', 'Home'], ['lessons', 'Lessons'], ['studio', 'Practice Studio'], ['library', 'Music Library'], ['flx4', 'DDJ-FLX4'], ['study', 'Study Mode'], ['settings', 'Settings']];
  function renderSide() {
    const side = $('#side');
    const M = CL.midi || {};
    const ok = M.status === 'connected';
    const active = currentName === 'lesson' ? 'lessons' : currentName;
    side.innerHTML = `<div class="logo"><div class="logo-mark"><span></span></div><b>CueLab</b></div>` +
      NAV.map(([id, label]) => `<button class="nav${active === id ? ' on' : ''}" data-go="${id}">${label}</button>`).join('') +
      `<div class="langsw notr">${[['en', 'English'], ['my', 'မြန်မာ']].map(([k, n]) => `<button class="${CL.lang() === k ? 'on' : ''}" data-lang="${k}">${n}</button>`).join('')}</div>
      <div class="side-status${ok ? ' ok' : ''}" data-go="flx4">
        <span style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600"><span class="dot ${ok ? 'ok' : M.status === 'searching' ? 'warn' : 'bad'}"></span>${ok ? CL.esc(M.isFlx4 ? 'DDJ-FLX4 connected' : M.name) : 'No controller'}</span>
        <span class="small">${ok ? 'USB MIDI' + (CL.audio && CL.audio.fourCh ? ' + audio' : '') : 'Plug in your DDJ-FLX4 by USB'}</span>
      </div>`;
    side.querySelectorAll('[data-go]').forEach(b => b.onclick = () => CL.go(b.dataset.go));
    side.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { if (b.dataset.lang !== CL.lang()) CL.setLang(b.dataset.lang); });
  }
  CL.renderSide = renderSide;
  CL.on('midi-status', renderSide);
  CL.on('audio-route', renderSide);

  // ---------- toast ----------
  let toastT;
  CL.toast = function (text, ms) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; $('#stage').appendChild(t); }
    t.textContent = text; t.style.opacity = 1;
    clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = 0; }, ms || 2600);
  };

  // ---------- panel wrapper (scaled live FLX4) ----------
  CL.panelBox = function (host, scale, opts) {
    const w = CL.h(`<div class="panel-wrap" style="width:${Math.round(1100 * scale)}px;height:${Math.round(610 * scale)}px"></div>`);
    host.appendChild(w);
    const p = CL.makePanel(w, opts);
    p.root.style.transform = 'scale(' + scale + ')';
    return p;
  };
  // close-up: a 2× view centred on one control
  CL.closeup = function (host, id, h) {
    const P = CL.panelLayout.P[id] || { x: 550, y: 300 };
    const w = CL.h(`<div style="height:${h}px;flex-shrink:0;border-radius:12px;overflow:hidden;position:relative;border:1px solid var(--pink-line);background:#242427"></div>`);
    host.appendChild(w);
    const p = CL.makePanel(w, { interactive: true });
    p.root.style.position = 'absolute';
    p.root.style.left = `calc(50% - ${P.x * 2}px)`;
    p.root.style.top = (h / 2 - P.y * 2) + 'px';
    p.root.style.transform = 'scale(2)'; p.root.style.transformOrigin = '0 0';
    return p;
  };

  // ---------- deck strip (title, BPM, waveform, bar counter) ----------
  CL.deckStrip = function (n, opts) {
    opts = opts || {};
    const el = CL.h(`<div class="deckbox${n === 2 ? ' d2' : ''}">
      <div class="top">
        <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0">
          <span class="kicker" style="color:${n === 1 ? 'var(--cyan)' : 'var(--amber)'}">DECK ${n} <span class="ds-badges" style="margin-left:6px;font-weight:600;letter-spacing:0"></span></span>
          <span class="ds-title" style="font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">—</span>
          <span class="ds-meta small"></span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end">
          <span class="bpm ds-bpm">—</span>
          <span class="small ds-bar"></span>
        </div>
      </div>
      <canvas width="900" height="108" style="height:${opts.h || 54}px"></canvas>
    </div>`);
    const cv = el.querySelector('canvas'), g = cv.getContext('2d');
    const q = s => el.querySelector(s);
    function update() {
      const A = CL.audio; if (!A || !A.ready) return;
      const d = A.decks[n], t = d.track;
      q('.ds-title').textContent = t ? t.title : (d.loading ? 'Loading…' : 'Empty — load a track');
      q('.ds-meta').textContent = t ? `${t.genre} · Key ${t.key} · ${CL.fmtTime((d.duration || t.length) - d.getPos())} left` : '';
      q('.ds-bpm').textContent = t ? d.bpm.toFixed(1) : '—';
      const bi = t ? d.beatInfo() : null;
      q('.ds-bar').textContent = bi && d.buffer ? 'Bar ' + Math.max(1, bi.bar) + '.' + bi.beatInBar + ' · phrase ' + (Math.floor((Math.max(1, bi.bar) - 1) / 16) + 1) : '';
      const badges = []; if (d.playing) badges.push('▶ PLAYING'); if (d.sync) badges.push('SYNC'); if (d.loop.on) badges.push('LOOP ' + +((d.loop.end - d.loop.start) / d.beatLen).toFixed(2)); if (d.slow !== 1) badges.push('SLOW');
      q('.ds-badges').textContent = badges.join(' · ');
      // waveform around the playhead
      const W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
      g.fillStyle = '#101116'; g.fillRect(0, 0, W, H);
      if (!t || !t.peaks) return;
      const pos = d.getPos(), span = opts.span || 8, px = W / (span * 100); // 100 peaks per second
      const startS = pos - span / 2;
      g.fillStyle = n === 1 ? '#3DD6F5' : '#FFB547';
      for (let x = 0; x < W; x += 2) {
        const i = Math.floor((startS + x / W * span) * 100);
        if (i < 0 || i >= t.peaks.length) continue;
        const v = t.peaks[i] * (H / 2 - 4);
        g.globalAlpha = x < W / 2 ? 0.45 : 1;
        g.fillRect(x, H / 2 - v, 2, v * 2);
      }
      g.globalAlpha = 1;
      // beat grid
      const bl = d.beatLen, fb = t.firstBeat || 0;
      let b = Math.ceil((startS - fb) / bl);
      for (; fb + b * bl < startS + span; b++) {
        const x = ((fb + b * bl) - startS) / span * W;
        const bar1 = ((b % 4) + 4) % 4 === 0, phrase = ((b % 64) + 64) % 64 === 0;
        g.fillStyle = phrase ? '#FF5FA2' : bar1 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.32)';
        g.fillRect(x - 1, 0, phrase ? 5 : bar1 ? 4 : 2, H);
        if (phrase) { g.font = 'bold 20px Segoe UI'; g.fillText(String(b / 4 + 1), x + 6, 22); }
      }
      if (d.loop.on) { g.fillStyle = 'rgba(91,214,138,0.18)'; const x1 = (d.loop.start - startS) / span * W, x2 = (d.loop.end - startS) / span * W; g.fillRect(x1, 0, x2 - x1, H); }
      d.hot.forEach((h, i) => { if (h == null) return; const x = (h - startS) / span * W; if (x < 0 || x > W) return; g.fillStyle = '#F28A2E'; g.fillRect(x, 0, 3, H); g.fillText(String(i + 1), x + 5, H - 8); });
      g.fillStyle = '#fff'; g.fillRect(W / 2 - 1, 0, 3, H);
    }
    return { el, update };
  };

  // ---------- track list with BROWSE selection ----------
  CL.browse = { list: [], idx: 0, listeners: new Set() };
  CL.setBrowseList = function (list) { CL.browse.list = list; CL.browse.idx = CL.clamp(CL.browse.idx, 0, Math.max(0, list.length - 1)); CL.browse.listeners.forEach(f => f()); };
  CL.on('browse', d => {
    const B = CL.browse; if (!B.list.length) return;
    B.idx = CL.clamp(B.idx + (d.delta > 0 ? 1 : -1), 0, B.list.length - 1);
    B.listeners.forEach(f => f());
  });
  let loadConfirm = null;
  CL.loadToDeck = function (n, track) {
    const A = CL.audio; A.init();
    const d = A.decks[n];
    const audible = d.playing && CL.val['fader' + n] > 0.3 && (n === 1 ? CL.val.xfader < 0.8 : CL.val.xfader > 0.2);
    if (audible && !(loadConfirm && loadConfirm.n === n && performance.now() - loadConfirm.t < 2500)) {
      loadConfirm = { n, t: performance.now() };
      CL.toast('Deck ' + n + ' is playing on the speakers. Press LOAD ' + n + ' again to replace it.');
      return;
    }
    loadConfirm = null;
    A.load(n, track).then(() => CL.toast('Loaded "' + track.title + '" on Deck ' + n));
  };
  CL.on('load-request', n => { const t = CL.browse.list[CL.browse.idx]; if (t) CL.loadToDeck(n, t); });

  CL.trackList = function (opts) {
    opts = opts || {};
    const el = CL.h(`<div class="scroll" style="display:flex;flex-direction:column;${opts.h ? 'height:' + opts.h + 'px' : 'flex:1 1 0;min-height:0'}"></div>`);
    const cols = opts.cols || 'minmax(0,2fr) minmax(0,1.2fr) 70px 60px 70px 120px';
    function render() {
      const B = CL.browse;
      el.innerHTML = B.list.map((t, i) => `<div class="trow${i === B.idx ? ' sel' : ''}" data-i="${i}" style="grid-template-columns:${cols}">
        <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${CL.esc(t.title)}</span>
        <span style="color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${CL.esc(t.genre)}</span>
        <span>${t.bpm}</span><span>${CL.esc(t.key)}</span><span><span class="lic">${CL.esc(t.license)}</span></span>
        <span style="display:flex;gap:6px"><button class="btn sm" data-load="1" style="color:var(--cyan)">1</button><button class="btn sm" data-load="2" style="color:var(--amber)">2</button></span>
      </div>`).join('');
      el.querySelectorAll('.trow').forEach(r => {
        r.onclick = e => {
          const i = +r.dataset.i; CL.browse.idx = i;
          const b = e.target.closest('[data-load]');
          if (b) CL.loadToDeck(+b.dataset.load, CL.browse.list[i]);
          render();
        };
      });
      const sel = el.querySelector('.trow.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
    }
    CL.browse.listeners.add(render);
    render();
    return { el, render, destroy: () => CL.browse.listeners.delete(render) };
  };
})(window.CL);
