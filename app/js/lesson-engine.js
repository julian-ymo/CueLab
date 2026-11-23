// CueLab lesson engine: runs a lesson's steps against the live controller.
'use strict';
(function (CL) {
  const A = () => CL.audio;
  const deck = n => CL.audio.decks[n];
  const IGNORE_WRONG = new Set(['d1shift', 'd2shift', 'browse', 'load1', 'load2', 'd1jog', 'd2jog', 'master', 'hplevel', 'mic', 'mcue', 'smartcfx', 'smartfader']);
  const FREE = new Set(['info', 'manual', 'quiz', 'timer', 'transitions', 'setExam', 'bothPlaying', 'scratchTime', 'rec']);

  function reached(v, to, tol) {
    tol = tol != null ? tol : 0.05;
    if (to <= 0.001) return v <= Math.max(tol, 0.05);
    if (to >= 0.999) return v >= 1 - Math.max(tol, 0.05);
    return Math.abs(v - to) <= tol;
  }
  function dirWord(id, from, to) {
    const k = CL.controls[id].kind;
    if (k === 'fader') return to > from ? 'up' : 'down';
    if (k === 'tempo') return to > from ? 'slidedown' : 'slideup';
    if (k === 'xfader') return to > from ? 'toright' : 'toleft';
    if (Math.abs(to - 0.5) < 0.01 && Math.abs(from - 0.5) > 0.06) return to > from ? 'right' : 'left';
    return to > from ? 'right' : 'left';
  }
  function camOk(a, b) {
    const pa = /^(\d+)([AB])$/.exec(a || ''), pb = /^(\d+)([AB])$/.exec(b || ''); if (!pa || !pb) return false;
    const na = +pa[1], nb = +pb[1];
    if (pa[2] === pb[2]) { const d = Math.min((na - nb + 12) % 12, (nb - na + 12) % 12); return d <= 1; }
    return na === nb;
  }
  CL.camOk = camOk;

  class Run {
    constructor(lesson) {
      this.lesson = lesson; this.stage = 'learn'; this.steps = []; this.i = 0; this.st = null;
      this.done = false; this.result = null; this.msg = null; this.offs = [];
      this.stats = { wrong: 0, timing: [], hints: 0, t0: 0 };
      this.transitions = 0; this.liveDeck = 0; this.liveTrack = null;
    }
    emit() { CL.emit('lesson', this); }
    destroy() { this.offs.forEach(f => f()); this.offs = []; this.stopDemo(); clearInterval(this.idleT); }

    // ---------- stages ----------
    async begin(stage) {
      this.destroy();
      this.stage = stage; this.done = false; this.result = null; this.msg = null; this.ghost = null; this.options = false;
      this.stats = { wrong: 0, timing: [], hints: 0, t0: performance.now() };
      this.transitions = 0;
      if (stage === 'learn') { this.emit(); return; }
      this.loading = true; this.emit();
      await this.setup();
      this.loading = false;
      const base = this.lesson.steps.slice();
      this.steps = [];
      if (this.lesson.ready && stage !== 'watch') this.steps.push({ title: 'Get ready', text: 'Set your FLX4 like this before we start. Each line turns green when it\'s right.', c: { t: 'ready', list: this.lesson.ready } });
      base.forEach(s => { if (stage === 'test' && (s.c.t === 'info')) return; this.steps.push(s); });
      this.i = 0;
      this.offs.push(CL.on('control', e => this.onControl(e)));
      this.offs.push(CL.on('frame', () => this.onFrame()));
      this.offs.push(CL.on('midi-unknown', d => this.onUnknown(d)));
      ['beat', 'loop', 'hotcue', 'fx', 'roll', 'beatjump', 'jog-touch', 'browse', 'deck-loaded', 'cue-toggle', 'tempo-range', 'rec', 'sample', 'sync', 'cue-set'].forEach(ev => this.offs.push(CL.on(ev, d => this.onEvent(ev, d))));
      if (stage === 'watch') { this.enter(0); return; }
      this.enter(0);
      this.idleT = setInterval(() => this.idleTick(), 500);
    }
    async setup() {
      const s = this.lesson.setup || {};
      A().init(); A().resume();
      if (A().slowMode) A().setSlow(false);
      const jobs = [];
      [1, 2].forEach(n => { const id = s['d' + n]; if (id) { const t = CL.tracks.byId(id); const d = deck(n); if (t && (!d.track || d.track.id !== id || !d.buffer)) jobs.push(A().load(n, t)); else if (t) { d.pause(); d.seek(d.cuePoint); d.exitLoop(); d.hot.fill(null); d.sync = false; } } });
      await Promise.all(jobs);
      [1, 2].forEach(n => { const d = deck(n); d.pitch = 0; d.sync = false; d.setRate(); });
      (s.play || []).forEach(n => { if (deck(n).buffer) deck(n).play(); });
      if (s.sync) { const d = deck(s.sync); A().matchTempo(d); d.sync = true; if (d.playing) A().matchPhase(d); }
      if (A().fx.on) { A().fx.on = false; CL.input('fxlevel', CL.val.fxlevel, 'demo'); }
    }

    get step() { return this.steps[this.i]; }
    enter(i) {
      this.i = i; const s = this.steps[i];
      if (!s) { this.finish(); return; }
      const c = s.c;
      this.st = { t0: performance.now(), lastProgress: performance.now(), start: Object.assign({}, CL.val), wrong: null, wrongWay: null, tries: 0, count: 0, acc: 0, hint: 0, note: null, extra: {} };
      this.ghost = null; this.options = false; this.msg = null;
      const st = this.st;
      // per-type init
      if (c.t === 'hotcue' || c.t === 'hotcueDel') st.extra.hot = deck(c.deck).hot.filter(h => h != null).length;
      if (c.t === 'onBar' || c.t === 'together') st.extra.target = null;
      if (c.t === 'timer') st.extra.left = c.seconds;
      if (c.t === 'compatKey' || c.t === 'load') st.extra.loadsAt = deck(c.deck).track;
      if (c.t === 'transitions' || c.t === 'setExam') { this.transitions = 0; this.transList = []; this.liveDeck = 0; this.liveTrack = null; this.candDeck = 0; st.extra.played = 0; }
      this.updateGuide();
      this.emit();
    }
    next() {
      const s = this.step;
      if (s) CL.emit('step-done', { run: this, i: this.i });
      if (this.stage === 'do') { CL.store.stepsDone[this.lesson.id] = Math.max(CL.store.stepsDone[this.lesson.id] || 0, this.i + 1); CL.save(); }
      this.enter(this.i + 1);
    }
    skip() {
      const pl = CL.store.practiceLater[this.lesson.id] = CL.store.practiceLater[this.lesson.id] || [];
      if (pl.indexOf(this.i) < 0) pl.push(this.i); CL.save();
      this.next();
    }
    finish() {
      this.done = true; clearInterval(this.idleT); CL.guideLit = []; this.guide = {};
      if (this.stage === 'test') this.result = this.score();
      if (this.stage === 'do') { CL.store.current = this.lesson.id; CL.save(); }
      if (this.stage === 'test') {
        const prev = CL.store.done[this.lesson.id] || 0;
        if (this.result.pass) { CL.store.done[this.lesson.id] = Math.max(prev, this.result.score); CL.store.xp += this.result.pass ? 40 : 0; const nxt = CL.lessons[this.lesson.n]; if (nxt) CL.store.current = nxt.id; }
        CL.save();
      }
      this.emit();
    }
    score() {
      const s = this.stats;
      const accuracy = Math.max(0, 100 - s.wrong * 10);
      const timing = s.timing.length ? Math.max(0, Math.round(100 - (s.timing.reduce((a, b) => a + b, 0) / s.timing.length) * 45)) : 100;
      const secs = (performance.now() - s.t0) / 1000, expected = this.steps.length * 18;
      const flow = Math.round(CL.clamp(100 * Math.min(1, expected / Math.max(1, secs) * 1.4), 40, 100));
      const score = Math.round(accuracy * 0.45 + timing * 0.35 + flow * 0.2);
      return { score, pass: score >= 70, accuracy, timing, flow, wrong: s.wrong, timingList: s.timing.slice(), secs };
    }

    // ---------- guide shown on the panel ----------
    updateGuide() {
      const s = this.step; if (!s) { this.guide = {}; return; }
      const c = s.c, st = this.st, test = this.stage === 'test';
      const g = { hl: [], arrows: {}, order: Object.assign({}, s.order || {}), lit: (s.lit || []).slice(), ok: [] };
      const ids = new Set(s.hl || []);
      if (c.id) ids.add(c.id);
      if (c.parts) c.parts.forEach(p => ids.add(p.id));
      if (c.t === 'sync') ids.add('d' + c.deck + 'sync');
      if (c.t === 'playing' || c.t === 'paused') ids.add('d' + c.deck + 'play');
      if (c.t === 'cueToggle') ids.add('hcue' + c.ch);
      if (c.t === 'jogTouch' || c.t === 'scratch' || c.t === 'scratchTime') ids.add('d' + c.deck + 'jog');
      if (c.t === 'loopLen') ids.add('d' + c.deck + 'exit');
      if (c.t === 'cut') ids.add('xfader');
      if (c.t === 'fx') ids.add('fxon');
      if (c.t === 'tempoRange') { ids.add('d' + c.deck + 'shift'); ids.add('d' + c.deck + 'sync'); }
      if (c.t === 'load') ids.add('load' + c.deck);
      if (c.t === 'browse') ids.add('browse');
      if (c.t === 'ready') {
        c.list.forEach(r => { const v = CL.val[r.id]; if (reached(v, r.to, r.tol || 0.06)) g.ok.push(r.id); else { ids.add(r.id); g.arrows[r.id] = dirWord(r.id, v, r.to); } });
      }
      g.hl = Array.from(ids);
      Object.assign(g.arrows, s.arrows || {});
      // knob/fader arrow from where it is now
      const kn = c.t === 'knob' ? [{ id: c.id, to: c.to }] : (c.parts || []);
      kn.forEach(p => { if (!(s.arrows && s.arrows[p.id])) g.arrows[p.id] = dirWord(p.id, CL.val[p.id], p.to); });
      if (st && st.wrong) { g.wrong = [st.wrong.id]; g.wrongText = st.wrong.label; }
      if (this.ghost) g.ghost = this.ghost;
      if (test) { g.hl = []; g.arrows = {}; g.order = {}; g.lit = []; }
      this.guide = g;
    }

    // ---------- input ----------
    onControl(e) {
      if (this.done || !this.step || this.stage === 'learn') return;
      if (this.stage === 'watch') return;
      const s = this.step, c = s.c, st = this.st;
      const targets = new Set((s.hl || []).concat(c.id ? [c.id] : [], (c.parts || []).map(p => p.id), Object.keys(s.order || {}), s.allow || []));
      if (c.t === 'ready') c.list.forEach(r => targets.add(r.id));
      if (c.t === 'sync' || c.t === 'tempoRange') targets.add('d' + c.deck + 'sync');
      if (c.t === 'playing' || c.t === 'paused') targets.add('d' + c.deck + 'play');
      if (c.t === 'cueToggle') targets.add('hcue' + c.ch);
      if (c.t === 'cut') targets.add('xfader');
      if (c.t === 'fx' || c.t === 'fxType') { targets.add('fxon'); targets.add('fxsel'); }
      if (c.t === 'fxBeat') { targets.add('fxbL'); targets.add('fxbR'); }
      if (c.t === 'loop' || c.t === 'loopLen') ['in', 'out', 'exit', 'callL', 'callR'].forEach(x => targets.add('d' + c.deck + x));
      if (c.t === 'hotcue' || c.t === 'hotcueJump' || c.t === 'hotcueDel' || c.t === 'beatjump' || c.t === 'roll' || c.t === 'samples') for (let i = 1; i <= 8; i++) targets.add('d' + (c.deck || 1) + 'p' + i);
      if (c.t === 'scratchCut') targets.add('xfader');
      if (c.t === 'bpm' || c.t === 'phase') { targets.add('d' + c.deck + 'tempo'); targets.add('d' + c.deck + 'jog'); }
      const isTarget = targets.has(e.id);
      if (isTarget) st.lastProgress = performance.now();

      // ---- event checks ----
      const kind = e.kind, down = e.value === true;
      if (c.t === 'press' && e.id === c.id && down) return this.ok();
      if (c.t === 'move' && e.id === c.id && typeof e.prev === 'number') { st.acc += Math.abs(e.value - e.prev); if (st.acc >= c.amount) return this.ok(); }
      if (c.t === 'onBar' && e.id === c.id && down) return this.onBarPress();
      if (c.t === 'hotcueJump' && /p[1-8]$/.test(e.id) && down) { /* handled via hotcue event */ }
      if (c.t === 'fxBeat' && (e.id === 'fxbL' || e.id === 'fxbR') && down) return this.ok();
      if (c.t === 'cut' && e.id === 'xfader') this.cutCheck(e);
      if (c.t === 'scratchCut' && e.id === 'xfader' && CL.jogTouch['d' + c.deck + 'jog'] && (e.prev < 0.5) !== (e.value < 0.5)) { st.count++; st.lastProgress = performance.now(); if (st.count >= c.count) return this.ok(); this.emit(); }
      if ((c.t === 'scratch' || c.t === 'scratchTime') && e.id === 'd' + c.deck + 'jog' && CL.jogTouch[e.id]) this.scratchMove(e);
      if (c.t === 'scratchCut' && e.id === 'd' + c.deck + 'jog') st.lastProgress = performance.now();

      // ---- wrong control / wrong way ----
      if (FREE.has(c.t) || e.src === 'demo' || IGNORE_WRONG.has(e.id) || c.t === 'ready') { this.refresh(); return; }
      if (!isTarget) {
        const k = CL.controls[e.id];
        if (kind === 'button' || kind === 'pad') {
          if (down) this.wrong(e.id, null);
        } else if (typeof e.value === 'number' && kind !== 'jog') {
          const from = st.start[e.id];
          if (Math.abs(e.value - from) > 0.12) this.wrong(e.id, from);
          else if (st.wrong && st.wrong.id === e.id && st.wrong.putBack != null && Math.abs(e.value - st.wrong.putBack) < 0.06) { st.wrong = null; this.updateGuide(); }
        }
      } else if (c.t === 'knob' && e.id === c.id) {
        const v = e.value, d0 = Math.abs(st.start[c.id] - c.to), d1 = Math.abs(v - c.to);
        if (d1 > d0 + 0.12 && !st.wrongWay) {
          st.wrongWay = { id: c.id, text: 'You went the wrong way. ' + (dirWord(c.id, v, c.to) === 'left' ? 'Turn it left instead ↺.' : dirWord(c.id, v, c.to) === 'right' ? 'Turn it right instead ↻.' : 'Go the other way.') };
          this.addTry('wrong way');
        } else if (st.wrongWay && d1 < d0) st.wrongWay = null;
      }
      this.refresh();
    }
    refresh() { this.updateGuide(); this.emit(); }
    wrong(id, putBack) {
      const st = this.st, name = CL.controls[id].name;
      const same = st.wrong && st.wrong.id === id;
      const target = this.targetName();
      st.wrong = { id, putBack, name, t: performance.now(), label: putBack != null ? '✕ NOT THIS ONE · PUT IT BACK' : '✕ NOT THIS ONE', text: 'That\'s ' + name + '.' + (target ? ' This step needs ' + target + '.' : '') };
      if (!same) this.addTry('wrong control');
      if (putBack == null) setTimeout(() => { if (this.st === st && st.wrong && st.wrong.id === id && st.wrong.putBack == null) { st.wrong = null; this.refresh(); } }, 3500);
      this.updateGuide();
    }
    targetName() {
      const s = this.step, c = s.c;
      const id = c.id || (c.parts && c.parts[0].id) || (c.t === 'sync' ? 'd' + c.deck + 'sync' : c.t === 'playing' ? 'd' + c.deck + 'play' : (s.hl || [])[0]);
      return id && CL.controls[id] ? CL.controls[id].name : '';
    }
    addTry(why) {
      const st = this.st; st.tries++; this.stats.wrong++;
      (st.why = st.why || []).push(why);
      if (st.tries >= 3 && this.stage === 'do' && !st.optionsShown) { st.optionsShown = true; this.options = true; }
    }
    ok() {
      const st = this.st;
      CL.emit('step-ok', this);
      if (this.stage === 'watch') return;
      // a short "done" beat so the green tick is visible
      const i = this.i;
      this.flash = performance.now();
      setTimeout(() => { if (this.i === i && this.st === st) this.next(); }, 450);
      st.complete = true; this.emit();
    }

    // ---------- unknown MIDI: ask "was that the control?" ----------
    onUnknown(d) {
      if (this.done || !this.step || this.stage === 'watch' || this.stage === 'learn') return;
      if (!d.cc && !d.down) return;
      const s = this.step, c = s.c;
      const cand = [c.id].concat((c.parts || []).map(p => p.id), s.hl || [], Object.keys(s.order || {}),
        c.t === 'sync' || c.t === 'tempoRange' ? ['d' + c.deck + 'sync'] : [], c.t === 'playing' || c.t === 'paused' ? ['d' + c.deck + 'play'] : [],
        c.t === 'fx' ? ['fxon'] : [], c.t === 'fxType' ? ['fxsel'] : [], c.t === 'fxBeat' ? ['fxbR', 'fxbL'] : [], c.t === 'cueToggle' ? ['hcue' + c.ch] : [])
        .filter(id => id && CL.controls[id] && !CL.controls[id].hardware && !CL.touched[id]);
      const want = cand.find(id => { const k = CL.controls[id].kind; return d.cc ? (k !== 'button' && k !== 'pad') : (k === 'button' || k === 'pad'); });
      if (!want) return;
      this.st.learnOffer = { key: d.key, id: want, cc: d.cc };
      this.emit();
    }
    acceptLearn(yes) {
      const o = this.st.learnOffer; this.st.learnOffer = null;
      if (yes && o) {
        CL.store.learned[o.key] = o.id; CL.save();
        if (!o.cc) { CL.input(o.id, true, 'midi'); CL.input(o.id, false, 'midi'); }
        CL.toast('Learned: ' + CL.controls[o.id].name);
      }
      this.emit();
    }

    // ---------- events from the engine ----------
    onEvent(ev, d) {
      if (this.done || !this.step || this.stage === 'learn' || this.stage === 'watch') return;
      const c = this.step.c, st = this.st;
      if (st.complete) return;
      if (ev === 'browse' && c.t === 'browse') return this.ok();
      if (ev === 'deck-loaded' && c.t === 'load' && d.n === c.deck && d.track !== st.extra.loadsAt) return this.ok();
      if (ev === 'deck-loaded' && c.t === 'compatKey' && d.n === c.deck) {
        if (camOk(deck(1).track && deck(1).track.key, d.track.key)) return this.ok();
        st.note = d.track.key + ' doesn\'t fit ' + (deck(1).track ? deck(1).track.key : '') + '. Try 7A, 8A, 9A or 8B.'; this.addTry('key clash'); this.emit();
      }
      if (ev === 'deck-loaded' && (c.t === 'transitions' || c.t === 'setExam')) { /* counted in frame */ }
      if (ev === 'hotcue' && c.t === 'hotcueJump' && d.d.n === c.deck && d.jump) return this.ok();
      if (ev === 'beatjump' && c.t === 'beatjump' && d.d.n === c.deck) { st.count++; if (st.count >= c.count) return this.ok(); this.emit(); }
      if (ev === 'roll' && c.t === 'roll' && d.d.n === c.deck && !d.on) { st.count++; if (st.count >= c.count) return this.ok(); this.emit(); }
      if (ev === 'sample' && c.t === 'samples') { st.extra.seen = st.extra.seen || new Set(); st.extra.seen.add(d); st.count = st.extra.seen.size; if (st.count >= c.count) return this.ok(); this.emit(); }
      if (ev === 'tempo-range' && c.t === 'tempoRange' && d.n === c.deck) return this.ok();
      if (ev === 'beat') this.emit();
    }
    // ---------- state checks every frame ----------
    onFrame() {
      if (this.done || !this.step || this.stage === 'learn' || this.stage === 'watch' || this.loading) return;
      const c = this.step.c, st = this.st; if (st.complete) return;
      const V = CL.val, au = A();
      let pass = false;
      switch (c.t) {
        case 'knob': pass = reached(V[c.id], c.to, c.tol); break;
        case 'ready': pass = c.list.every(r => reached(V[r.id], r.to, r.tol || 0.06)); if (!pass && (performance.now() - (st.lastG || 0) > 200)) { st.lastG = performance.now(); this.updateGuide(); } break;
        case 'playing': pass = deck(c.deck).playing; break;
        case 'paused': pass = !deck(c.deck).playing; break;
        case 'sync': pass = deck(c.deck).sync; break;
        case 'bpm': {
          const d = deck(c.deck), o = deck(c.deck === 1 ? 2 : 1), target = c.target === 'other' ? o.bpm : c.target;
          st.extra.diff = d.bpm - target;
          if (c.noSync && d.sync) { d.sync = false; CL.input('d' + c.deck + 'tempo', CL.val['d' + c.deck + 'tempo'], 'demo'); st.note = 'No SYNC this time — match it with the TEMPO slider.'; }
          pass = Math.abs(st.extra.diff) <= c.tol && performance.now() - st.t0 > 600; break;
        }
        case 'phase': {
          const d = deck(c.deck), o = deck(c.deck === 1 ? 2 : 1);
          if (d.playing && o.playing && d.track && o.track) {
            let ph = d.beatInfo().phase - o.beatInfo().phase; if (ph > 0.5) ph -= 1; if (ph < -0.5) ph += 1;
            st.extra.phase = ph;
            const bpmOk = Math.abs(d.bpm - o.bpm) < 0.3;
            if (Math.abs(ph) <= c.tol && bpmOk) { st.extra.holdT = st.extra.holdT || performance.now(); if (performance.now() - st.extra.holdT > (c.hold || 2) * 1000) pass = true; }
            else st.extra.holdT = null;
          }
          break;
        }
        case 'loop': pass = deck(c.deck).loop.on === c.on; break;
        case 'loopLen': { const d = deck(c.deck); pass = d.loop.on && Math.abs((d.loop.end - d.loop.start) / d.beatLen - c.beats) < 0.05; break; }
        case 'hotcue': pass = deck(c.deck).hot.filter(h => h != null).length >= c.count; break;
        case 'hotcueDel': pass = deck(c.deck).hot.filter(h => h != null).length < st.extra.hot; break;
        case 'fx': pass = au.fx.on === c.on; break;
        case 'fxType': pass = au.fx.type === c.type; break;
        case 'cueToggle': pass = !!V['hcue' + c.ch + 'On'] === c.on; break;
        case 'rec': pass = !!au.rec === c.on; break;
        case 'timer': { st.extra.left = c.seconds - (performance.now() - st.t0) / 1000; pass = st.extra.left <= 0; break; }
        case 'bothPlaying': {
          const ok = deck(1).playing && deck(2).playing && V.fader1 > 0.3 && V.fader2 > 0.3;
          const now = performance.now(); if (ok) st.acc += (now - (st.lastF || now)) / 1000; st.lastF = now;
          pass = st.acc >= c.seconds; break;
        }
        case 'together': this.togetherFrame(); break;
        case 'onBar': this.onBarFrame(); break;
        case 'transitions': case 'setExam': {
          this.trackLive();
          if (c.t === 'transitions') pass = this.transitions >= c.count;
          else { const now = performance.now(); if (au.anyPlaying()) st.extra.played += (now - (st.lastF || now)) / 1000; st.lastF = now; pass = this.transitions >= c.transitions && st.extra.played >= c.minutes * 60; }
          break;
        }
        case 'scratchTime': pass = st.acc >= c.seconds; break;
      }
      if (pass) this.ok();
    }
    trackLive() {
      // a deck is "live" when it's clearly the one the crowd hears, for at least 2 seconds
      const V = CL.val, now = performance.now();
      const aud = n => { const d = deck(n); if (!d.playing || !d.track) return 0; const xf = n === 1 ? Math.min(1, 2 * (1 - V.xfader)) : Math.min(1, 2 * V.xfader); return V['fader' + n] * V['fader' + n] * xf; };
      const a1 = aud(1), a2 = aud(2);
      const cand = a1 > 0.4 && a2 < 0.25 ? 1 : a2 > 0.4 && a1 < 0.25 ? 2 : 0;
      if (cand !== this.candDeck) { this.candDeck = cand; this.candT = now; return; }
      if (!cand || now - this.candT < 2000 || cand === this.liveDeck) return;
      const t = deck(cand).track;
      if (this.liveDeck && t && this.liveTrack && t !== this.liveTrack) {
        this.transitions++;
        (this.transList = this.transList || []).push(this.liveTrack.title + ' → ' + t.title);
        this.emit();
      }
      this.liveDeck = cand; this.liveTrack = t;
    }
    // ---------- timing: press on a bar ----------
    nextTarget(d, every) {
      const bi = d.beatIndexAt(d.getPos()), barF = bi / 4;
      let k = Math.ceil((barF + 0.15) / every) * every;
      return k; // 0-based bar index of the target beat 1
    }
    onBarFrame() {
      const c = this.step.c, st = this.st, d = deck(c.deck);
      if (!d.playing) { st.extra.waiting = 'Start Deck ' + c.deck + ' first'; return; }
      st.extra.waiting = null;
      const bi = d.beatIndexAt(d.getPos());
      if (st.extra.target == null) st.extra.target = this.nextTarget(d, c.every);
      const diff = bi - st.extra.target * 4;
      if (diff > c.tol + 0.05) {
        st.extra.target = this.nextTarget(d, c.every);
        if (c.every > 1) { st.note = 'Missed it. Next try: bar ' + (st.extra.target + 1) + '.'; this.emit(); }
      }
      st.extra.beatsTo = st.extra.target * 4 - bi;
    }
    onBarPress() {
      const c = this.step.c, st = this.st, d = deck(c.deck);
      if (!d.playing || !d.track) { st.note = 'Start Deck ' + c.deck + ' first.'; this.emit(); return; }
      if (st.extra.target == null) st.extra.target = this.nextTarget(d, c.every);
      const bi = d.beatIndexAt(d.getPos());
      // the press may be just after the target (counts) or just before
      let diff = bi - st.extra.target * 4;
      if (diff < -2 && c.every === 1) { st.extra.target -= 1; diff = bi - st.extra.target * 4; }
      if (Math.abs(diff) <= c.tol) {
        this.stats.timing.push(Math.abs(diff));
        st.count++;
        st.note = Math.abs(diff) < 0.12 ? 'Perfect timing!' : (diff < 0 ? 'Good — a touch early.' : 'Good — a touch late.');
        st.extra.target = st.extra.target + c.every;
        if (st.count >= (c.count || 1)) return this.ok();
        this.emit(); return;
      }
      const beats = Math.abs(diff).toFixed(1);
      st.note = diff < 0 ? beats + ' beats early. Wait for bar ' + (st.extra.target + 1) + '.' : beats + ' beats late. Next try: bar ' + (this.nextTarget(d, c.every) + 1) + '.';
      this.stats.timing.push(Math.min(2, Math.abs(diff)));
      this.addTry('timing');
      if (diff > 0) st.extra.target = this.nextTarget(d, c.every);
      // started the other deck at the wrong time: put it back so they can try again
      if (c.retryPause) { const rd = deck(c.retryPause); setTimeout(() => { rd.pause(); rd.seek(rd.cuePoint); }, 60); }
      this.emit();
    }
    togetherFrame() {
      const c = this.step.c, st = this.st, d = deck(c.deck);
      if (!d.playing) return;
      const bi = d.beatIndexAt(d.getPos());
      if (st.extra.target == null) st.extra.target = this.nextTarget(d, c.every);
      if (st.extra.reset) {
        const back = c.parts.every(p => Math.abs(CL.val[p.id] - st.start[p.id]) < 0.08);
        if (back) { st.extra.reset = false; st.extra.target = this.nextTarget(d, c.every); st.note = 'Ready. Try again on bar ' + (st.extra.target + 1) + '.'; this.emit(); }
        return;
      }
      const all = c.parts.every(p => reached(CL.val[p.id], p.to, p.tol));
      const diff = bi - st.extra.target * 4;
      if (!all && diff > c.tol + 0.5) { st.extra.target = this.nextTarget(d, c.every); st.note = 'Missed that phrase. Next: bar ' + (st.extra.target + 1) + '.'; this.emit(); }
      st.extra.beatsTo = st.extra.target * 4 - bi;
      if (all) {
        if (Math.abs(diff) <= c.tol) { this.stats.timing.push(Math.abs(diff) / 2); st.note = Math.abs(diff) < 0.5 ? 'Right on the phrase!' : 'Done — ' + Math.abs(diff).toFixed(1) + ' beats ' + (diff < 0 ? 'early' : 'late') + '.'; this.ok(); }
        else {
          st.note = Math.abs(diff).toFixed(1) + ' beats ' + (diff < 0 ? 'early' : 'late') + '. Put the knobs back and try on the next phrase.';
          this.stats.timing.push(Math.min(2, Math.abs(diff) / 2)); this.addTry('timing');
          st.extra.reset = true; this.emit();
        }
      }
    }
    cutCheck(e) {
      const c = this.step.c, st = this.st, d = deck(c.deck);
      if (!d.playing) return;
      const crossed = c.to === 1 ? (e.prev < 0.85 && e.value >= 0.85) : (e.prev > 0.15 && e.value <= 0.15);
      if (!crossed) return;
      const bi = d.beatIndexAt(d.getPos()), near = Math.round(bi / 4) * 4, diff = bi - near;
      if (Math.abs(diff) <= c.tol) { this.stats.timing.push(Math.abs(diff)); this.st.note = 'Clean cut!'; this.ok(); }
      else { st.note = Math.abs(diff).toFixed(1) + ' beats ' + (diff < 0 ? 'early' : 'late') + '. Slide back and try again on beat 1.'; this.addTry('timing'); this.emit(); }
    }
    scratchMove(e) {
      const st = this.st, c = this.step.c;
      const dir = Math.sign(e.value); if (!dir) return;
      st.lastProgress = performance.now();
      if (c.t === 'scratchTime') { const now = performance.now(); if (st.lastS && now - st.lastS < 300) st.acc += (now - st.lastS) / 1000; st.lastS = now; this.emit(); return; }
      st.extra.run = (st.extra.dir === dir ? (st.extra.run || 0) : 0) + Math.abs(e.value);
      if (st.extra.dir !== dir && st.extra.run >= 4) { /* new direction */ }
      if (st.extra.dir !== dir) { st.extra.dir = dir; st.extra.pend = true; }
      if (st.extra.pend && st.extra.run >= 6) { st.extra.pend = false; st.count++; if (st.count >= c.count) return this.ok(); this.emit(); }
    }

    // ---------- idle hints ----------
    idleTick() {
      if (this.done || !this.step || this.stage !== 'do') return;
      const c = this.step.c, st = this.st;
      if (FREE.has(c.t) || c.t === 'ready' || st.complete) return;
      const idle = (performance.now() - st.lastProgress) / 1000;
      const h = idle > 20 ? 2 : idle > 12 ? 1 : 0;
      if (h !== st.hint) { st.hint = h; if (h) this.stats.hints++; this.emit(); }
    }
    dismissHint() { this.st.hint = 0; this.st.lastProgress = performance.now(); this.emit(); }

    // ---------- Show me (panel plays the move) ----------
    showMe() {
      const s = this.step, c = s.c; this.options = false;
      const parts = c.t === 'knob' ? [{ id: c.id, to: c.to }] : c.parts ? c.parts : null;
      const t0 = performance.now(), dur = 1600;
      clearInterval(this.ghostT);
      if (parts) {
        const from = {}; parts.forEach(p => from[p.id] = CL.val[p.id]);
        this.ghostT = setInterval(() => {
          const k = Math.min(1, (performance.now() - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          this.ghost = {}; parts.forEach(p => this.ghost[p.id] = from[p.id] + (p.to - from[p.id]) * e);
          this.updateGuide(); this.emit();
          if (performance.now() - t0 > dur + 1200) { clearInterval(this.ghostT); this.ghost = null; this.updateGuide(); this.emit(); }
        }, 30);
      } else {
        // buttons: blink the ripple a few times
        this.ghostPulse = true; this.emit(); setTimeout(() => { this.ghostPulse = false; this.emit(); }, 2500);
      }
      this.st.lastProgress = performance.now();
    }
    slowMode(on) { A().setSlow(on); this.options = false; this.st.lastProgress = performance.now(); this.emit(); }
    closeOptions() { this.options = false; this.emit(); }

    stopDemo() { if (this.video) this.video.stop(); }
  }
  CL.LessonRun = Run;
})(window.CL);
