// CueLab lesson videos: a narrated, animated video of each lesson, made on the fly from the lesson steps.
// Works fully offline: the picture is drawn by the app, the music comes from the decks,
// and the voice uses the speech voices built into Windows.
'use strict';
(function (CL) {
  // ---------- offline narration ----------
  const V = CL.voice = { voice: null, ready: false };
  function pickVoice() {
    if (!window.speechSynthesis) return;
    const all = speechSynthesis.getVoices().filter(v => v.localService !== false);
    if (CL.lang() === 'my') { V.voice = all.find(v => /^my/i.test(v.lang) || /burmese|myanmar/i.test(v.name)) || null; V.ready = true; return; }
    const vs = all.filter(v => /^en/i.test(v.lang));
    V.voice = vs.find(v => /aria|jenny|zira|natural/i.test(v.name)) || vs.find(v => /david|mark|guy/i.test(v.name)) || vs[0] || null;
    V.ready = true;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  V.available = () => !!(window.speechSynthesis && V.voice);
  V.say = function (text, rate, enabled) {
    text = CL.t(text);
    // reading time: about 2.7 words a second in English; Burmese has few spaces, so count letters instead
    const est = Math.max(1200, (CL.lang() === 'my' ? text.length / 11 : text.split(/\s+/).length / 2.7) * 1000 / (rate || 1));
    if (!enabled || !V.available()) return { done: new Promise(r => setTimeout(r, est)), est };
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = V.voice; u.lang = V.voice.lang; u.rate = 0.98 * (rate || 1); u.pitch = 1; u.volume = 1;
    const done = new Promise(r => { let ok = false; const fin = () => { if (!ok) { ok = true; r(); } }; u.onend = fin; u.onerror = fin; setTimeout(fin, est * 2.5 + 3000); });
    speechSynthesis.speak(u);
    return { done, est };
  };
  V.stop = () => { if (window.speechSynthesis) speechSynthesis.cancel(); };

  const HAND = '<svg viewBox="0 0 64 64" width="64" height="64"><path d="M24 6c3 0 5 2 5 5v17l2-1c1-5 9-5 10 0v2c2-3 8-2 9 2v3c2-2 7-1 7 3v12c0 9-7 15-16 15h-6c-6 0-10-3-13-8L12 41c-2-3 1-7 5-5l2 2V11c0-3 2-5 5-5z" fill="#F6E3D3" stroke="#1A1B20" stroke-width="2.5" stroke-linejoin="round"/></svg>';

  class VideoPlayer {
    // opts: real (drive the real decks + audio), only (index: play just this step), onEnd, autoplay
    constructor(host, run, opts) {
      this.run = run; this.opts = Object.assign({ real: true, autoplay: true }, opts || {});
      this.steps = run.steps.filter(s => true);
      this.speed = 1; this.cc = true; this.voiceOn = true; this.paused = false; this.token = 0; this.i = -1; this.ghost = {};
      const W = this.W = 990, H = this.H = 557;
      this.el = CL.h(`<div class="vid" style="width:${W}px;display:flex;flex-direction:column;gap:0;flex-shrink:0">
        <div class="vstage" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;border-radius:16px 16px 0 0;background:#0A0B0E">
          <div class="vcam" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;transition:transform .9s cubic-bezier(.4,.1,.2,1)"><div class="vpan" style="position:absolute;left:0;top:4px;width:990px;height:549px"></div></div>
          <div class="vhand" style="position:absolute;left:0;top:0;width:64px;height:64px;pointer-events:none;transition:left .55s ease, top .55s ease, opacity .3s;opacity:0;filter:drop-shadow(0 6px 10px rgba(0,0,0,.6))">${HAND}</div>
          <div class="vbadge" style="position:absolute;left:16px;top:14px;font-size:12px;font-weight:700;letter-spacing:.08em;background:rgba(0,0,0,.6);color:#fff;padding:6px 10px;border-radius:7px">LESSON ${run.lesson.n} · VIDEO</div>
          <div class="vstep" style="position:absolute;right:16px;top:14px;font-size:12px;font-weight:600;background:rgba(0,0,0,.6);color:#C9CCD3;padding:6px 10px;border-radius:7px"></div>
          <div class="vquiz" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:620px;display:none;background:rgba(14,15,19,.95);border:1px solid #3A3E4A;border-radius:16px;padding:22px;flex-direction:column;gap:10px"></div>
          <div class="vcap" style="position:absolute;left:50%;bottom:18px;transform:translateX(-50%);max-width:860px;text-align:center;font-size:19px;line-height:1.4;background:rgba(0,0,0,.78);color:#fff;padding:9px 16px;border-radius:9px;display:none"></div>
          <div class="vtitle" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:radial-gradient(circle at 50% 40%,#16323B,#0A0B0E 70%);transition:opacity .6s">
            <span style="font-size:14px;font-weight:700;letter-spacing:.12em;color:var(--cyan)">CUELAB · ${esc(run.lesson.tier.toUpperCase())} · LESSON ${run.lesson.n}</span>
            <span style="font-family:var(--display);font-size:44px;font-weight:700;color:#fff;text-align:center;max-width:820px">${esc(run.lesson.title)}</span>
            <span class="vtsub" style="font-size:15px;color:#A3A8B4">Watch the glow and listen — then you'll do it on your DDJ-FLX4</span>
            <button class="btn primary vbig" style="margin-top:14px;height:56px;padding:0 30px;font-size:17px">▶ Play video</button>
          </div>
        </div>
        <div class="vbar" style="display:flex;align-items:center;gap:12px;background:#16181E;padding:10px 14px;border-radius:0 0 16px 16px">
          <button class="btn sm vplay" style="width:44px" aria-label="Play or pause">▶</button>
          <span class="small vtime" style="min-width:74px;color:#C9CCD3">0 / ${this.steps.length}</span>
          <div class="vprog" style="flex:1;height:22px;position:relative;cursor:pointer;display:flex;align-items:center"><div style="position:absolute;left:0;right:0;height:6px;border-radius:3px;background:#2A2D36"></div><div class="vfill" style="position:absolute;left:0;height:6px;border-radius:3px;background:var(--cyan);width:0"></div>${this.steps.map((s, i) => `<span title="${esc(s.title)}" style="position:absolute;left:${i / this.steps.length * 100}%;width:3px;height:14px;background:#F2F3F5;opacity:.7"></span>`).join('')}</div>
          <button class="btn sm vspd">1×</button><button class="btn sm vcc">CC</button><button class="btn sm vvo">Voice on</button>
        </div>
      </div>`);
      host.appendChild(this.el);
      const q = s => this.el.querySelector(s); this.q = q;
      this.panel = CL.makePanel(q('.vpan'), { interactive: false });
      this.panel.root.style.transform = 'scale(0.9)'; this.panel.root.style.transformOrigin = '0 0';
      q('.vbig').onclick = () => this.start(this.opts.only != null ? this.opts.only : 0);
      q('.vplay').onclick = () => { if (this.i < 0) this.start(this.opts.only != null ? this.opts.only : 0); else this.togglePause(); };
      q('.vspd').onclick = () => { this.speed = this.speed === 1 ? 1.25 : this.speed === 1.25 ? 0.75 : 1; q('.vspd').textContent = this.speed + '×'; };
      q('.vcc').onclick = () => { this.cc = !this.cc; q('.vcc').classList.toggle('primary', this.cc); q('.vcap').style.display = this.cc && this.capText ? 'block' : 'none'; };
      q('.vcc').classList.add('primary');
      q('.vvo').onclick = () => { this.voiceOn = !this.voiceOn; q('.vvo').textContent = this.voiceOn ? 'Voice on' : 'Voice off'; if (!this.voiceOn) V.stop(); };
      if (!V.available()) { q('.vvo').textContent = 'Captions'; q('.vvo').disabled = true; q('.vvo').title = 'No Windows voice found — captions only'; }
      q('.vprog').onclick = e => { const r = q('.vprog').getBoundingClientRect(); const i = Math.floor((e.clientX - r.left) / r.width * this.steps.length); this.start(CL.clamp(i, 0, this.steps.length - 1)); };
      this.loopStop = CL.every(() => this.frame());
      if (this.opts.only != null) { q('.vtsub').textContent = 'Step ' + (this.opts.only + 1) + ': ' + this.steps[this.opts.only].title; }
      if (this.opts.autoplay && this.opts.only != null) setTimeout(() => this.start(this.opts.only), 300);
    }

    // ---------- playback control ----------
    togglePause() {
      this.paused = !this.paused;
      this.q('.vplay').textContent = this.paused ? '▶' : '❚❚';
      if (window.speechSynthesis) { if (this.paused) speechSynthesis.pause(); else speechSynthesis.resume(); }
    }
    stop() { this.token++; V.stop(); this.i = -1; }
    destroy() { this.stop(); this.loopStop(); CL.guideLit = []; }
    wait(ms) {
      const tok = this.token;
      return new Promise((res, rej) => {
        let left = ms / this.speed, last = performance.now();
        const tick = () => {
          if (tok !== this.token) return rej('stopped');
          const now = performance.now(); if (!this.paused) left -= now - last; last = now;
          if (left <= 0) res(); else setTimeout(tick, 30);
        };
        tick();
      });
    }
    async start(from) {
      this.token++; const tok = this.token; V.stop();
      this.paused = false; this.q('.vplay').textContent = '❚❚';
      this.q('.vtitle').style.opacity = 0; this.q('.vtitle').style.pointerEvents = 'none';
      try {
        if (this.opts.real && from === 0 && this.opts.only == null) { await this.intro(); }
        const end = this.opts.only != null ? this.opts.only + 1 : this.steps.length;
        for (let i = from; i < end; i++) { if (tok !== this.token) return; await this.playStep(i); }
        if (tok !== this.token) return;
        await this.outro();
      } catch (e) { if (e !== 'stopped') console.warn(e); }
    }
    async intro() {
      this.camera(null); this.caption(this.run.lesson.why);
      const sp = V.say(this.run.lesson.why, this.speed, this.voiceOn);
      await Promise.all([sp.done, this.wait(2500)]);
    }
    async outro() {
      this.camera(null); this.hand(null); this.panel.setGuide({});
      const t = this.opts.only != null ? 'That\'s the move. Now try it on your FLX4.' : 'That\'s the whole lesson. Now it\'s your turn: press "Do it" and follow the glow on your FLX4.';
      this.caption(t); const sp = V.say(t, this.speed, this.voiceOn); await sp.done;
      this.i = -1; this.q('.vplay').textContent = '▶';
      this.q('.vtitle').style.opacity = 1; this.q('.vtitle').style.pointerEvents = 'auto'; this.q('.vbig').textContent = '↻ Watch again';
      if (this.opts.onEnd) this.opts.onEnd();
    }

    // ---------- camera, hand, captions ----------
    targets(s) {
      const c = s.c, ids = [];
      if (c.id) ids.push(c.id);
      (c.parts || []).forEach(p => ids.push(p.id));
      if (c.t === 'sync' || c.t === 'tempoRange') ids.push('d' + c.deck + 'sync');
      if (c.t === 'playing' || c.t === 'paused') ids.push('d' + c.deck + 'play');
      if (c.t === 'cueToggle') ids.push('hcue' + c.ch);
      if (/scratch|jogTouch/.test(c.t)) ids.push('d' + c.deck + 'jog');
      if (c.t === 'loop' || c.t === 'loopLen') ids.push('d' + c.deck + 'exit');
      if (c.t === 'fx') ids.push('fxon'); if (c.t === 'fxType') ids.push('fxsel'); if (c.t === 'fxBeat') ids.push('fxbR');
      if (c.t === 'cut') ids.push('xfader'); if (c.t === 'load') ids.push('load' + c.deck); if (c.t === 'browse') ids.push('browse');
      if (c.t === 'ready') c.list.forEach(r => ids.push(r.id));
      if (!ids.length) (s.hl || []).concat(Object.keys(s.order || {}), Object.keys(s.arrows || {})).forEach(i => ids.push(i));
      return Array.from(new Set(ids)).filter(i => CL.panelLayout.P[i]);
    }
    camera(ids) {
      const cam = this.q('.vcam'), P = CL.panelLayout.P;
      if (!ids || !ids.length) { this.z = 1; this.tx = 0; this.ty = 0; cam.style.transform = 'none'; return; }
      let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
      ids.forEach(id => { const p = P[id]; x1 = Math.min(x1, p.x - p.w / 2); x2 = Math.max(x2, p.x + p.w / 2); y1 = Math.min(y1, p.y - p.h / 2); y2 = Math.max(y2, p.y + p.h / 2); });
      const bw = (x2 - x1) * 0.9 + 260, bh = (y2 - y1) * 0.9 + 200;
      const z = CL.clamp(Math.min(this.W / bw, this.H / bh), 1, 2.3);
      const cx = (x1 + x2) / 2 * 0.9, cy = (y1 + y2) / 2 * 0.9 + 4;
      let tx = this.W / 2 - cx * z, ty = this.H / 2 - cy * z;
      tx = CL.clamp(tx, this.W - this.W * z, 0); ty = CL.clamp(ty, this.H - this.H * z, 0);
      this.z = z; this.tx = tx; this.ty = ty;
      cam.style.transform = `translate(${tx}px,${ty}px) scale(${z})`;
    }
    screenOf(x, y) { return { x: x * 0.9 * this.z + this.tx, y: (y * 0.9 + 4) * this.z + this.ty }; }
    hand(id, gesture) {
      const h = this.q('.vhand');
      if (!id) { h.style.opacity = 0; this.handId = null; return; }
      const p = CL.panelLayout.P[id];
      const s = this.screenOf(p.x, p.y);
      this.handId = id; this.handFollow = null;
      h.style.opacity = 1; h.style.left = (s.x - 20) + 'px'; h.style.top = (s.y - 6) + 'px';
      h.style.animation = gesture === 'tap' ? 'vtap .5s ease-in-out 2' : gesture === 'turn' ? 'vturn 1s ease-in-out 2' : gesture === 'circle' ? 'vcircle 1.2s linear 2' : 'none';
    }
    caption(t) { this.capText = t; const c = this.q('.vcap'); c.textContent = t; c.style.display = this.cc && t ? 'block' : 'none'; }

    // the hand follows a moving fader/knob
    followHandle(id, v) {
      const P = CL.panelLayout.P[id], k = CL.controls[id].kind; let x = P.x, y = P.y;
      if (k === 'fader') y = 502 - v * 90; else if (k === 'tempo') y = 412 + v * 140; else if (k === 'xfader') x = 496 + v * 102;
      const s = this.screenOf(x, y), h = this.q('.vhand');
      h.style.transition = 'opacity .3s'; h.style.left = (s.x - 20) + 'px'; h.style.top = (s.y - 6) + 'px';
      clearTimeout(this.htT); this.htT = setTimeout(() => { h.style.transition = 'left .55s ease, top .55s ease, opacity .3s'; }, 120);
    }

    // ---------- doing things (real decks, or just on the picture) ----------
    setVal(id, v) { if (this.opts.real) CL.input(id, v, 'demo'); else { this.ghost[id] = v; } }
    async tween(id, to, ms) {
      const from = this.opts.real ? CL.val[id] : (this.ghost[id] != null ? this.ghost[id] : CL.val[id]);
      const t0 = performance.now(), dur = ms / this.speed, tok = this.token;
      while (true) {
        if (tok !== this.token) throw 'stopped';
        if (this.paused) { await new Promise(r => setTimeout(r, 50)); continue; }
        const k = Math.min(1, (performance.now() - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const v = from + (to - from) * e; this.setVal(id, v);
        if (['fader', 'tempo', 'xfader'].indexOf(CL.controls[id].kind) >= 0) this.followHandle(id, v);
        if (k >= 1) break;
        await new Promise(r => setTimeout(r, 30));
      }
    }
    async press(id, ext) {
      this.hand(id, 'tap'); await this.wait(350);
      if (this.opts.real) { CL.input(id, true, 'demo', ext); await this.wait(150); CL.input(id, false, 'demo', ext); }
      else { this.ghost[id] = true; await this.wait(200); this.ghost[id] = false; }
    }
    deck(n) { return CL.audio.decks[n]; }
    async nextBar(dn, every) {
      const d = this.deck(dn); if (!this.opts.real || !d.playing || !d.track) { await this.wait(900); return; }
      const ev = Math.min(every || 1, 4);
      const bi = d.beatIndexAt(d.getPos()); const target = Math.ceil((bi / 4 + 0.05) / ev) * ev * 4;
      const ms = (target - bi) * 60 / d.bpm * 1000;
      this.caption((this.capText || '') + '  (counting in…)');
      const tok = this.token; await new Promise(r => setTimeout(r, Math.max(0, ms - 25))); if (tok !== this.token) throw 'stopped';
    }

    async playStep(i) {
      const s = this.steps[i], c = s.c, tok = this.token;
      this.i = i; this.ghost = {};
      if (this.opts.real) this.run.enter(i);
      const ids = this.targets(s);
      this.hand(null);
      this.camera(ids.length ? ids : null);
      const guide = { hl: ids.slice(0, 6), arrows: Object.assign({}, s.arrows || {}), order: Object.assign({}, s.order || {}), lit: s.lit || [] };
      this.baseGuide = guide;
      this.q('.vstep').textContent = 'Step ' + (i + 1) + ' of ' + this.steps.length + ' · ' + s.title;
      this.q('.vquiz').style.display = 'none';
      const say = c.t === 'quiz' ? c.q : (s.title + '. ' + (s.text || ''));
      this.caption(c.t === 'quiz' ? '' : (s.text || s.title));
      await this.wait(700);
      if (ids.length) this.hand(ids[0], 'point');
      if (c.t === 'quiz') {
        const qz = this.q('.vquiz'); qz.style.display = 'flex';
        qz.innerHTML = `<span class="kicker k-amber">QUICK CHECK</span><span class="big" style="font-size:22px">${esc(c.q)}</span>` + c.options.map((o, k) => `<div class="check" data-k="${k}">○ ${esc(o)}</div>`).join('');
      }
      const sp = V.say(say, this.speed, this.voiceOn);
      await Promise.race([sp.done, this.wait(Math.min(sp.est, 5000))]);
      if (tok !== this.token) return;
      await this.act(s);
      if (c.t === 'quiz') {
        const el = this.q(`.vquiz [data-k="${c.answer}"]`); if (el) { el.classList.add('ok'); el.textContent = '✓ ' + c.options[c.answer]; }
        if (c.explain) { this.caption(c.explain); const e2 = V.say(c.explain, this.speed, this.voiceOn); await e2.done; }
      }
      await sp.done;
      await this.wait(900);
    }

    async act(s) {
      const c = s.c, real = this.opts.real, d = n => this.deck(n);
      switch (c.t) {
        case 'knob': this.hand(c.id, 'turn'); await this.tween(c.id, c.to, 1500); break;
        case 'move': { this.hand(c.id, 'turn'); const v0 = real ? CL.val[c.id] : 0.5; await this.tween(c.id, v0 > 0.5 ? 0.05 : 0.95, 900); await this.tween(c.id, v0, 900); break; }
        case 'ready': for (const r of c.list.slice(0, 6)) { this.hand(r.id, 'point'); await this.tween(r.id, r.to, 500); } break;
        case 'press': await this.press(c.id); break;
        case 'playing': if (!real || !d(c.deck).playing) await this.press('d' + c.deck + 'play'); break;
        case 'paused': if (!real || d(c.deck).playing) await this.press('d' + c.deck + 'play'); break;
        case 'sync': if (!real || !d(c.deck).sync) await this.press('d' + c.deck + 'sync'); break;
        case 'cueToggle': if (!real || !!CL.val['hcue' + c.ch + 'On'] !== c.on) await this.press('hcue' + c.ch); break;
        case 'onBar': for (let k = 0; k < Math.min(c.count || 1, 2); k++) { this.hand(c.id, 'point'); await this.nextBar(c.deck, c.every); await this.press(c.id); } break;
        case 'together': await this.nextBar(c.deck, 1); await Promise.all(c.parts.map(p => { this.hand(p.id, 'turn'); return this.tween(p.id, p.to, 600); })); break;
        case 'bpm': {
          const id = 'd' + c.deck + 'tempo'; this.hand(id, 'point');
          if (!real) { await this.tween(id, 0.68, 1600); break; }
          const dk = d(c.deck), o = d(c.deck === 1 ? 2 : 1); if (!dk.track || !o.track) break;
          let v = 0.5 + (o.bpm / (dk.track.bpm * dk.slow) - 1) / (2 * dk.range); if (CL.store.settings.invertTempo) v = 1 - v;
          await this.tween(id, CL.clamp(v, 0, 1), 1800); break;
        }
        case 'phase': this.hand('d' + c.deck + 'jog', 'circle'); await this.wait(1200); if (real) CL.audio.matchPhase(d(c.deck)); await this.wait(800); break;
        case 'jogTouch': this.hand('d' + c.deck + 'jog', 'tap'); if (real) { CL.emit('jog-touch', { id: 'd' + c.deck + 'jog', down: true }); await this.wait(1000); CL.emit('jog-touch', { id: 'd' + c.deck + 'jog', down: false }); } else await this.wait(1000); break;
        case 'scratch': case 'scratchTime': case 'scratchCut': {
          const id = 'd' + c.deck + 'jog'; this.hand(id, 'circle');
          if (real) { CL.jogTouch[id] = true; CL.emit('jog-touch', { id, down: true }); }
          for (let k = 0; k < 8; k++) {
            for (let j = 0; j < 6; j++) { if (real) CL.input(id, (k % 2 ? -1 : 1) * 12, 'demo', { top: true }); else this.ghost[id] = (this.ghost[id] || 0) + (k % 2 ? -18 : 18); await this.wait(25); }
            if (c.t === 'scratchCut') this.setVal('xfader', k % 2 ? 0 : 0.6);
          }
          if (real) { CL.jogTouch[id] = false; CL.emit('jog-touch', { id, down: false }); }
          break;
        }
        case 'loop': { const dk = d(c.deck); await this.press(c.on ? (dk.loopIn != null && !dk.loop.on ? 'd' + c.deck + 'out' : 'd' + c.deck + 'exit') : 'd' + c.deck + 'exit'); break; }
        case 'loopLen': { const dk = d(c.deck); const cur = real && dk.loop.on ? (dk.loop.end - dk.loop.start) / dk.beatLen : 4; const id = c.beats < cur ? 'callL' : 'callR'; let n = Math.max(1, Math.round(Math.abs(Math.log2(c.beats / cur)))); while (n-- > 0) await this.press('d' + c.deck + id); break; }
        case 'hotcue': { const dk = d(c.deck); const free = real ? dk.hot.indexOf(null) : 0; await this.press('d' + c.deck + 'p' + ((free < 0 ? 0 : free) + 1)); break; }
        case 'hotcueJump': await this.press('d' + c.deck + 'p1'); break;
        case 'hotcueDel': this.hand('d' + c.deck + 'shift', 'tap'); await this.wait(400); await this.press('d' + c.deck + 'p2', { shift: true }); break;
        case 'beatjump': for (let k = 0; k < Math.min(c.count, 3); k++) await this.press('d' + c.deck + 'p' + (k + 1)); break;
        case 'roll': { const id = 'd' + c.deck + 'p3'; this.hand(id, 'tap'); if (real) { CL.input(id, true, 'demo'); await this.wait(900); CL.input(id, false, 'demo'); } else await this.wait(900); break; }
        case 'samples': for (let k = 1; k <= 4; k++) await this.press('d1p' + k); break;
        case 'fx': if (!real || CL.audio.fx.on !== c.on) await this.press('fxon'); break;
        case 'fxType': for (let k = 0; k < 3 && (!real || CL.audio.fx.type !== c.type); k++) { await this.press('fxsel'); if (!real) break; } break;
        case 'fxBeat': await this.press('fxbR'); break;
        case 'tempoRange': this.hand('d' + c.deck + 'shift', 'tap'); await this.wait(400); await this.press('d' + c.deck + 'sync', { tempoRange: true }); break;
        case 'cut': await this.nextBar(c.deck, 1); this.hand('xfader', 'point'); await this.tween('xfader', c.to, 150); break;
        case 'browse': this.hand('browse', 'turn'); for (let k = 0; k < 3; k++) { CL.emit('browse', { delta: 1 }); await this.wait(300); } break;
        case 'load': await this.press('load' + c.deck); break;
        case 'compatKey': await this.press('load' + c.deck); break;
        case 'manual': case 'info': for (const id of this.targets(s).slice(0, 4)) { this.hand(id, 'point'); await this.wait(900); } break;
        default: await this.wait(1600);
      }
    }

    frame() {
      // keep the hand on its control while the camera moves, and show the guide on the video's panel
      const g = Object.assign({}, this.baseGuide || {});
      if (!this.opts.real) g.ghost = this.ghost;
      this.panel.setGuide(this.i >= 0 ? g : {});
      const pct = this.i < 0 ? 0 : (this.i + 0.5) / this.steps.length * 100;
      this.q('.vfill').style.width = pct + '%';
      this.q('.vtime').textContent = (this.i < 0 ? 0 : this.i + 1) + ' / ' + this.steps.length;
      if (this.onFrame) this.onFrame(this.i);
    }
  }
  const esc = s => CL.esc(s);
  CL.VideoPlayer = VideoPlayer;
})(window.CL);
