// CueLab audio engine: 2 decks + DDJ-FLX4-style mixer, beat FX, sampler, recorder.
'use strict';
(function (CL) {
  const A = CL.audio = { ready: false, decks: {}, fx: { type: 0, ch: 2, beatIdx: 3, on: false }, rec: null };
  const FX_TYPES = ['Echo', 'Reverb', 'Spiral'];
  const BEATS = [0.25, 0.5, 0.75, 1, 2, 4];
  const RANGES = [0.06, 0.10, 0.16, 1.0];
  const SEC_PER_TICK_BASE = 1.8 / 720; // FLX4 jog: ~720 ticks per turn at 33⅓ rpm
  const tickSec = () => SEC_PER_TICK_BASE * (CL.store.settings.jogFeel || 1);

  const dbToGain = db => Math.pow(10, db / 20);

  // ----- knob curves (match the FLX4 markings) -----
  function eqDb(v) { if (v < 0.04) return -60; if (v <= 0.5) return (v / 0.5 - 1) * 26; return (v - 0.5) / 0.5 * 6; }
  function trimGain(v) { if (v < 0.02) return 0; if (v <= 0.5) return Math.pow(v / 0.5, 2); return dbToGain((v - 0.5) / 0.5 * 9); }
  const faderGain = v => v * v;

  class Deck {
    constructor(n) {
      this.n = n; this.track = null; this.buffer = null; this.rev = null;
      this.pos = 0; this.playing = false; this.src = null; this.t0 = 0; this.p0 = 0;
      this.cuePoint = 0; this.cueHeld = false; this.cuePreview = false;
      this.hot = new Array(8).fill(null);
      this.loop = { on: false, start: null, end: null };
      this.rangeIdx = 1; this.pitch = 0; this.bend = 0; this.slow = 1; this.sync = false;
      this.padMode = 'hot'; this.roll = null; this.scratch = null;
      this.loading = false;
    }
    get range() { return RANGES[this.rangeIdx]; }
    get rate() { return (1 + this.pitch) * this.slow * (1 + this.bend); }
    get steadyRate() { return (1 + this.pitch) * this.slow; }
    get bpm() { return this.track ? this.track.bpm * this.steadyRate : 0; }
    get beatLen() { return this.track ? 60 / this.track.bpm : 0.5; } // in track seconds
    get duration() { return this.buffer ? this.buffer.duration : 0; }

    build(ctx) {
      this.gate = ctx.createGain();
      this.trim = ctx.createGain();
      this.low = ctx.createBiquadFilter(); this.low.type = 'lowshelf'; this.low.frequency.value = 200;
      this.mid = ctx.createBiquadFilter(); this.mid.type = 'peaking'; this.mid.frequency.value = 1000; this.mid.Q.value = 0.7;
      this.high = ctx.createBiquadFilter(); this.high.type = 'highshelf'; this.high.frequency.value = 3500;
      this.filt = ctx.createBiquadFilter(); this.filt.type = 'lowpass'; this.filt.frequency.value = 22000; this.filt.Q.value = 0.9;
      this.cue = ctx.createGain(); this.cue.gain.value = 0;
      this.fader = ctx.createGain();
      this.xf = ctx.createGain();
      this.fxSend = ctx.createGain(); this.fxSend.gain.value = 0;
      this.meter = ctx.createAnalyser(); this.meter.fftSize = 1024;
      this.gate.connect(this.trim); this.trim.connect(this.low); this.low.connect(this.mid); this.mid.connect(this.high); this.high.connect(this.filt);
      this.filt.connect(this.cue); this.filt.connect(this.fader);
      this.fader.connect(this.xf); this.xf.connect(A.masterBus);
      this.fader.connect(this.fxSend); this.fxSend.connect(A.fxIn);
      this.fader.connect(this.meter);
      this.cue.connect(A.cueBus);
    }

    getPos() {
      if (!this.buffer) return 0;
      if (!this.playing || !this.src) return this.pos;
      let p = this.p0 + (A.ctx.currentTime - this.t0) * this.rate;
      if (this.loop.on && this.loop.end > this.loop.start && p >= this.loop.end) {
        const len = this.loop.end - this.loop.start;
        p = this.loop.start + ((p - this.loop.start) % len);
      }
      return Math.min(p, this.duration);
    }
    commit() { this.pos = this.getPos(); this.p0 = this.pos; this.t0 = A.ctx.currentTime; }

    startSource() {
      const ctx = A.ctx;
      this.stopSource();
      if (!this.buffer) return;
      const s = ctx.createBufferSource();
      s.buffer = this.buffer;
      s.playbackRate.value = this.rate;
      if (this.loop.on) { s.loop = true; s.loopStart = this.loop.start; s.loopEnd = this.loop.end; }
      s.connect(this.gate);
      const now = ctx.currentTime;
      this.gate.gain.cancelScheduledValues(now); this.gate.gain.setValueAtTime(0, now); this.gate.gain.linearRampToValueAtTime(1, now + 0.006);
      s.start(now, CL.clamp(this.pos, 0, Math.max(0, this.duration - 0.01)));
      s.onended = () => { if (this.src === s && this.playing && !this.loop.on) { this.commit(); this.playing = false; this.src = null; CL.emit('deck', this); } };
      this.src = s; this.p0 = this.pos; this.t0 = now;
    }
    stopSource() {
      if (this.src) { try { this.src.onended = null; this.src.stop(); } catch (e) { } this.src.disconnect(); this.src = null; }
    }
    setRate() {
      if (this.playing && this.src) { this.commit(); this.src.playbackRate.setValueAtTime(this.rate, A.ctx.currentTime); }
      CL.emit('deck', this);
    }
    play() { if (!this.buffer || this.playing) return; if (this.pos >= this.duration - 0.05) this.pos = 0; this.playing = true; this.startSource(); CL.emit('deck', this); CL.emit('deck-play', this); }
    pause() { if (!this.playing) return; this.commit(); this.playing = false; this.stopSource(); CL.emit('deck', this); }
    seek(p) {
      this.pos = CL.clamp(p, 0, Math.max(0, this.duration - 0.01));
      if (this.playing) this.startSource(); else this.p0 = this.pos;
      CL.emit('deck', this);
    }
    beatIndexAt(p) { return this.track ? (p - (this.track.firstBeat || 0)) / this.beatLen : 0; }
    nearestBeat(p) { const b = Math.round(this.beatIndexAt(p)); return (this.track.firstBeat || 0) + b * this.beatLen; }
    beatInfo() {
      const bi = this.beatIndexAt(this.getPos());
      const beat = Math.floor(bi);
      return { beatIndex: bi, bar: Math.floor(beat / 4) + 1, beatInBar: ((beat % 4) + 4) % 4 + 1, phase: bi - Math.floor(bi) };
    }
    // ----- loops -----
    setLoop(start, end) {
      this.loop = { on: true, start, end };
      if (this.playing && this.src) {
        const p = this.getPos();
        this.src.loop = true; this.src.loopStart = start; this.src.loopEnd = end;
        if (p >= end || p < start - 0.01) { this.pos = start; this.startSource(); }
      }
      CL.emit('deck', this); CL.emit('loop', this);
    }
    exitLoop() {
      if (!this.loop.on) return;
      this.commit();
      this.loop.on = false;
      if (this.src) this.src.loop = false;
      CL.emit('deck', this); CL.emit('loop', this);
    }
  }

  // ---------- setup ----------
  A.init = function () {
    if (A.ready) return;
    const ctx = A.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    A.masterBus = ctx.createGain();
    A.cueBus = ctx.createGain();
    A.fxIn = ctx.createGain();
    A.masterMeter = ctx.createAnalyser(); A.masterMeter.fftSize = 1024;
    A.limiter = ctx.createDynamicsCompressor(); A.limiter.threshold.value = -3; A.limiter.ratio.value = 12; A.limiter.attack.value = 0.003; A.limiter.release.value = 0.15;
    A.out = ctx.createGain(); A.out.gain.value = 0.9;
    A.masterBus.connect(A.limiter); A.limiter.connect(A.out); A.out.connect(A.masterMeter);
    // beat FX
    A.fxDelay = ctx.createDelay(4); A.fxFb = ctx.createGain(); A.fxFb.gain.value = 0.45;
    A.fxVerb = ctx.createConvolver(); A.fxVerb.buffer = makeImpulse(ctx, 2.6);
    A.fxSpiral = ctx.createDelay(4); A.fxSpiralFb = ctx.createGain(); A.fxSpiralFb.gain.value = 0.7;
    A.fxSpiralFilt = ctx.createBiquadFilter(); A.fxSpiralFilt.type = 'bandpass'; A.fxSpiralFilt.frequency.value = 1200;
    A.fxWet = ctx.createGain(); A.fxWet.gain.value = 0;
    A.fxIn.connect(A.fxDelay); A.fxDelay.connect(A.fxFb); A.fxFb.connect(A.fxDelay);
    A.fxEchoOut = ctx.createGain(); A.fxDelay.connect(A.fxEchoOut);
    A.fxVerbOut = ctx.createGain(); A.fxIn.connect(A.fxVerb); A.fxVerb.connect(A.fxVerbOut);
    A.fxSpOut = ctx.createGain(); A.fxIn.connect(A.fxSpiral); A.fxSpiral.connect(A.fxSpiralFilt); A.fxSpiralFilt.connect(A.fxSpiralFb); A.fxSpiralFb.connect(A.fxSpiral); A.fxSpiralFilt.connect(A.fxSpOut);
    [A.fxEchoOut, A.fxVerbOut, A.fxSpOut].forEach(n => n.connect(A.fxWet));
    A.fxWet.connect(A.masterBus);
    // sampler
    A.sampGain = ctx.createGain(); A.sampGain.gain.value = 0.8; A.sampGain.connect(A.masterBus);
    // headphones = mix of cue bus and master
    A.hpCue = ctx.createGain(); A.hpMaster = ctx.createGain(); A.hp = ctx.createGain();
    A.cueBus.connect(A.hpCue); A.out.connect(A.hpMaster); A.hpCue.connect(A.hp); A.hpMaster.connect(A.hp);
    // recorder tap
    A.recDest = ctx.createMediaStreamDestination(); A.out.connect(A.recDest);

    A.decks[1] = new Deck(1); A.decks[2] = new Deck(2);
    A.decks[1].build(ctx); A.decks[2].build(ctx);
    A.route();
    applyMixer();
    applyFx();
    A.samples = CL.tracks ? CL.tracks.makeSamples(ctx) : [];
    A.ready = true;
    if (CL.store.settings.sinkId) A.setOutput(CL.store.settings.sinkId);
    tick();
  };

  // master on outputs 1-2, headphones on 3-4 when the device has 4 channels (DDJ-FLX4 does)
  A.route = function () {
    const ctx = A.ctx, dest = ctx.destination;
    if (!A.final) { A.final = ctx.createGain(); A.out.connect(A.final); }
    A.final.disconnect(); A.hp.disconnect();
    if (A.merger) { A.merger.disconnect(); A.merger = null; }
    const four = dest.maxChannelCount >= 4 && CL.store.settings.cueToOut34;
    A.fourCh = four;
    if (four) {
      dest.channelCount = 4; dest.channelCountMode = 'explicit'; dest.channelInterpretation = 'discrete';
      A.merger = ctx.createChannelMerger(4);
      const sm = ctx.createChannelSplitter(2), sh = ctx.createChannelSplitter(2);
      A.final.connect(sm); A.hp.connect(sh);
      sm.connect(A.merger, 0, 0); sm.connect(A.merger, 1, 1);
      sh.connect(A.merger, 0, 2); sh.connect(A.merger, 1, 3);
      A.merger.connect(dest);
    } else {
      dest.channelCount = 2; dest.channelCountMode = 'explicit'; dest.channelInterpretation = 'speakers';
      A.final.connect(dest);
    }
    CL.emit('audio-route', { four });
  };
  A.outputs = async function () {
    try { const devs = await navigator.mediaDevices.enumerateDevices(); return devs.filter(d => d.kind === 'audiooutput'); } catch (e) { return []; }
  };
  A.setOutput = async function (sinkId) {
    CL.store.settings.sinkId = sinkId; CL.save();
    if (A.ctx && A.ctx.setSinkId) {
      try { await A.ctx.setSinkId(sinkId || ''); } catch (e) { console.warn('setSinkId failed', e); }
      A.route();
    }
  };
  A.resume = () => { if (A.ctx && A.ctx.state !== 'running') A.ctx.resume(); };

  function makeImpulse(ctx, secs) {
    const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    return b;
  }

  // ---------- mixer from control values ----------
  function setP(param, v, t) { param.setTargetAtTime(v, A.ctx.currentTime, t || 0.012); }
  function applyMixer() {
    const V = CL.val;
    [1, 2].forEach(n => {
      const d = A.decks[n];
      setP(d.trim.gain, trimGain(V['trim' + n]));
      setP(d.low.gain, eqDb(V['low' + n])); setP(d.mid.gain, eqDb(V['mid' + n])); setP(d.high.gain, eqDb(V['hi' + n]));
      const c = V['cfx' + n];
      if (c < 0.47) { d.filt.type = 'lowpass'; setP(d.filt.frequency, 100 * Math.pow(220, c / 0.47)); }
      else if (c > 0.53) { d.filt.type = 'highpass'; setP(d.filt.frequency, 20 * Math.pow(300, (c - 0.53) / 0.47)); }
      else { d.filt.type = 'lowpass'; setP(d.filt.frequency, 22000); }
      setP(d.fader.gain, faderGain(V['fader' + n]));
      setP(d.cue.gain, V['hcue' + n + 'On'] ? 1 : 0);
    });
    const x = V.xfader;
    setP(A.decks[1].xf.gain, Math.min(1, 2 * (1 - x)));
    setP(A.decks[2].xf.gain, Math.min(1, 2 * x));
    const m = V.hpmix;
    setP(A.hpCue.gain, Math.min(1, 2 * (1 - m))); setP(A.hpMaster.gain, Math.min(1, 2 * m));
  }
  function applyFx() {
    const f = A.fx, d = A.decks[1].track ? A.decks[1] : A.decks[2];
    const beat = (d && d.track ? 60 / d.bpm : 0.5) * BEATS[f.beatIdx];
    A.fxDelay.delayTime.setTargetAtTime(Math.min(3.9, beat), A.ctx.currentTime, 0.05);
    A.fxSpiral.delayTime.setTargetAtTime(Math.min(3.9, beat / 4), A.ctx.currentTime, 0.05);
    const lvl = CL.val.fxlevel;
    setP(A.fxFb.gain, 0.25 + lvl * 0.5);
    setP(A.fxEchoOut.gain, f.type === 0 ? 1 : 0); setP(A.fxVerbOut.gain, f.type === 1 ? 0.6 : 0); setP(A.fxSpOut.gain, f.type === 2 ? 0.8 : 0);
    setP(A.fxWet.gain, f.on ? 0.3 + lvl * 0.9 : 0, 0.05);
    [1, 2].forEach(n => setP(A.decks[n].fxSend.gain, f.on && (f.ch === n || f.ch === 3) ? 1 : 0, 0.02));
    CL.emit('fx', f);
  }
  A.fxName = () => FX_TYPES[A.fx.type];
  A.fxBeats = () => BEATS[A.fx.beatIdx];
  A.fxChName = () => (A.fx.ch === 3 ? '1&2' : String(A.fx.ch));

  // ---------- loading ----------
  A.load = async function (n, track) {
    A.init(); A.resume();
    const d = A.decks[n];
    d.pause(); d.loading = true; d.track = track; CL.emit('deck', d);
    const buf = await CL.tracks.getBuffer(track);
    if (d.track !== track) return; // another load won
    d.buffer = buf; d.rev = null; d.pos = 0; d.p0 = 0; d.cuePoint = track.firstBeat || 0; d.pos = d.cuePoint;
    d.hot = new Array(8).fill(null); d.loop = { on: false, start: null, end: null };
    d.sync = false; d.loading = false; d.bend = 0;
    CL.emit('deck', d); CL.emit('deck-loaded', d);
    applyFx();
    return d;
  };

  // short beeps to check where sound comes out
  A.testTone = function (where) {
    A.init(); A.resume();
    const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = where === 'hp' ? 660 : 440;
    g.gain.setValueAtTime(0, ctx.currentTime);
    [0, 0.25, 0.5].forEach(t => { g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.setValueAtTime(0, ctx.currentTime + t + 0.15); });
    o.connect(g); g.connect(where === 'hp' ? A.hp : A.out);
    o.start(); o.stop(ctx.currentTime + 0.8);
  };
  A.anyPlaying = () => A.ready && (A.decks[1].playing || A.decks[2].playing);

  // tempo
  function setPitchFromSlider(d) {
    let v = CL.val['d' + d.n + 'tempo'];
    if (CL.store.settings.invertTempo) v = 1 - v;
    d.pitch = (v - 0.5) * 2 * d.range;
    d.setRate();
  }
  A.matchTempo = function (d) {
    const o = A.decks[d.n === 1 ? 2 : 1];
    if (!d.track || !o.track || !o.bpm) return false;
    d.pitch = o.bpm / (d.track.bpm * d.slow) - 1;
    d.setRate();
    return true;
  };
  A.matchPhase = function (d) {
    const o = A.decks[d.n === 1 ? 2 : 1];
    if (!d.track || !o.track) return;
    const op = o.beatInfo().phase, mp = d.beatInfo().phase;
    let diff = op - mp; if (diff > 0.5) diff -= 1; if (diff < -0.5) diff += 1;
    d.commit(); d.seek(d.getPos() + diff * d.beatLen);
  };
  A.setSlow = function (on) { [1, 2].forEach(n => { const d = A.decks[n]; d.slow = on ? 0.74 : 1; d.setRate(); }); A.slowMode = on; CL.emit('slow', on); };

  // ---------- scratch ----------
  function scratchStep(d) {
    const sc = d.scratch; if (!sc) return;
    const dt = sc.acc * tickSec(); sc.acc = 0;
    if (Math.abs(dt) < 0.0005 || !d.buffer) return;
    const ctx = A.ctx, grain = 0.03;
    const src = ctx.createBufferSource();
    let off;
    if (dt > 0) { src.buffer = d.buffer; off = d.pos; }
    else { if (!d.rev) d.rev = reverseBuffer(ctx, d.buffer); src.buffer = d.rev; off = d.duration - d.pos; }
    src.playbackRate.value = CL.clamp(Math.abs(dt) / grain, 0.05, 6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.004); g.gain.setValueAtTime(1, ctx.currentTime + grain - 0.004); g.gain.linearRampToValueAtTime(0, ctx.currentTime + grain);
    src.connect(g); g.connect(d.gate);
    src.start(ctx.currentTime, CL.clamp(off, 0, d.duration - 0.01), Math.abs(dt) + 0.002);
    src.stop(ctx.currentTime + grain + 0.01);
    d.pos = CL.clamp(d.pos + dt, 0, d.duration - 0.01);
    sc.moves++;
  }
  function reverseBuffer(ctx, b) {
    const r = ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
    for (let c = 0; c < b.numberOfChannels; c++) { const s = b.getChannelData(c), t = r.getChannelData(c), L = s.length; for (let i = 0; i < L; i++) t[i] = s[L - 1 - i]; }
    return r;
  }
  CL.on('jog-touch', ({ id, down }) => {
    if (!A.ready) return;
    const d = A.decks[id === 'd1jog' ? 1 : 2];
    if (down) {
      if (!d.buffer) return;
      d.commit(); const was = d.playing;
      if (d.playing) { d.stopSource(); d.playing = false; }
      d.scratch = { acc: 0, was, moves: 0, timer: setInterval(() => scratchStep(d), 25) };
      d.gate.gain.setValueAtTime(1, A.ctx.currentTime);
    } else if (d.scratch) {
      clearInterval(d.scratch.timer); scratchStep(d);
      const was = d.scratch.was; d.scratch = null;
      if (was) { d.playing = true; d.startSource(); }
      CL.emit('deck', d);
    }
  });

  // ---------- pads ----------
  const padJump = [-1, 1, -2, 2, -4, 4, -8, 8];
  const rollSizes = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8];
  function pad(d, i, down, mode, shift) {
    mode = mode || d.padMode;
    if (mode === 'hot') {
      if (!down) { if (d.hotPreview) { d.hotPreview = false; if (!d.cueHeldPlay) { d.pause(); d.seek(d.hot[i]); } } return; }
      if (shift) { d.hot[i] = null; CL.emit('hotcue', { d, i }); CL.emit('deck', d); return; }
      if (d.hot[i] == null) {
        d.hot[i] = d.track ? d.nearestBeat(d.getPos()) : d.getPos();
        CL.emit('hotcue', { d, i, set: true });
      } else {
        d.commit(); d.seek(d.hot[i]);
        if (!d.playing) { d.play(); }
        CL.emit('hotcue', { d, i, jump: true });
      }
      CL.emit('deck', d);
    } else if (mode === 'jump') {
      if (!down || !d.track) return;
      d.commit(); d.seek(d.getPos() + padJump[i] * d.beatLen);
      CL.emit('beatjump', { d, beats: padJump[i] });
    } else if (mode === 'samp' || mode === 'keys') {
      if (!down) return;
      A.playSample(i);
    } else if (mode === 'loop') {
      if (!down || !d.track) return;
      const beats = [0.25, 0.5, 1, 2, 4, 8, 16, 32][i], len = beats * d.beatLen;
      if (d.loop.on && Math.abs((d.loop.end - d.loop.start) - len) < 0.001) { d.exitLoop(); return; }
      const p = d.getPos(); let st = d.nearestBeat(p); if (st > p + 0.02) st -= d.beatLen;
      d.setLoop(st, st + len);
    } else if (mode === 'fx' || mode === 'fx2') {
      if (!d.track) return;
      if (down) {
        d.commit();
        const p = d.getPos(), size = rollSizes[i] * d.beatLen, start = d.nearestBeat(p) <= p ? d.nearestBeat(p) : d.nearestBeat(p) - d.beatLen;
        d.roll = { at: A.ctx.currentTime, from: p, rate: d.rate, prevLoop: Object.assign({}, d.loop) };
        d.setLoop(start, start + size);
        CL.emit('roll', { d, on: true });
      } else if (d.roll) {
        const r = d.roll; d.roll = null;
        d.exitLoop();
        d.seek(r.from + (A.ctx.currentTime - r.at) * r.rate);
        CL.emit('roll', { d, on: false });
      }
    }
  }
  A.playSample = function (i) {
    A.init(); A.resume();
    const b = A.samples[i]; if (!b) return;
    const s = A.ctx.createBufferSource(); s.buffer = b; s.connect(A.sampGain); s.start();
    CL.emit('sample', i);
  };

  // ---------- control handling ----------
  CL.on('control', ev => {
    if (!A.ready) A.init();
    A.resume();
    const id = ev.id, V = CL.val;
    const dm = /^d([12])(.+)$/.exec(id);
    if (dm) {
      const d = A.decks[+dm[1]], what = dm[2], down = ev.value === true;
      if (what === 'play' && down) {
        if (d.cueHeld) { d.cueHeldPlay = true; return; }
        d.playing ? d.pause() : d.play();
      } else if (what === 'cue') {
        if (down) {
          d.cueHeld = true; d.cueHeldPlay = false;
          if (d.playing) { d.pause(); d.seek(d.cuePoint); d.cueHeld = false; }
          else {
            const p = d.getPos();
            if (Math.abs(p - d.cuePoint) > 0.02) { d.cuePoint = p; CL.emit('cue-set', d); }
            d.cuePreview = true; d.play();
          }
        } else {
          if (d.cuePreview && !d.cueHeldPlay) { d.pause(); d.seek(d.cuePoint); }
          d.cuePreview = false; d.cueHeld = false;
        }
      } else if (what === 'sync' && down) {
        if (ev.tempoRange) { d.rangeIdx = (d.rangeIdx + 1) % RANGES.length; setPitchFromSlider(d); CL.emit('tempo-range', d); return; }
        if (d.sync) { d.sync = false; }
        else if (A.matchTempo(d)) { d.sync = true; const o = A.decks[d.n === 1 ? 2 : 1]; if (o.playing && d.playing) A.matchPhase(d); }
        CL.emit('deck', d); CL.emit('sync', d);
      } else if (what === 'tempo') {
        d.sync = false; setPitchFromSlider(d);
      } else if (what === 'jog') {
        if (!d.buffer) return;
        if (d.scratch && ev.top) { d.scratch.acc += ev.value; return; }
        if (ev.shift) { d.commit(); d.seek(d.getPos() + ev.value * 0.04); return; }
        if (!d.playing) { d.pos = CL.clamp(d.pos + ev.value * tickSec() * 2, 0, d.duration); d.p0 = d.pos; CL.emit('deck', d); return; }
        d.bend = CL.clamp(ev.value * 0.006 * (CL.store.settings.jogFeel || 1), -0.12, 0.12); d.setRate();
        clearTimeout(d.bendT); d.bendT = setTimeout(() => { d.bend = 0; d.setRate(); }, 110);
      } else if (what === 'in' && down) {
        if (!d.track) return;
        d.loopIn = d.nearestBeat(d.getPos()); CL.emit('loop-in', d); CL.emit('deck', d);
      } else if (what === 'out' && down) {
        if (!d.track) return;
        let out = d.nearestBeat(d.getPos());
        const st = d.loopIn != null ? d.loopIn : out - 4 * d.beatLen;
        if (out <= st) out = st + d.beatLen;
        d.setLoop(st, out);
      } else if (what === 'exit' && down) {
        if (!d.track) return;
        if (d.loop.on) d.exitLoop();
        else { const p = d.getPos(); let st = d.nearestBeat(p); if (st > p + 0.02) st -= d.beatLen; d.setLoop(st, st + 4 * d.beatLen); }
      } else if ((what === 'callL' || what === 'callR') && down) {
        if (d.loop.on) {
          const len = d.loop.end - d.loop.start, nl = what === 'callL' ? len / 2 : len * 2;
          if (nl > 0.02 && nl < 64) d.setLoop(d.loop.start, d.loop.start + nl);
        } else {
          const p = d.getPos(), cues = d.hot.filter(h => h != null).concat([d.cuePoint]).sort((a, b) => a - b);
          const target = what === 'callL' ? cues.filter(c => c < p - 0.05).pop() : cues.find(c => c > p + 0.05);
          if (target != null) d.seek(target);
        }
      } else if (/^p[1-8]$/.test(what)) {
        pad(d, +what[1] - 1, down, ev.mode, ev.shift);
      } else if (/^m(Hot|Fx|Jump|Samp)$/.test(what) && down) {
        d.padMode = { mHot: 'hot', mFx: 'fx', mJump: 'jump', mSamp: 'samp' }[what];
        CL.emit('pad-mode', d);
      }
      return;
    }
    if (/^hcue[12]$/.test(id)) { if (ev.value === true) { V[id + 'On'] = !V[id + 'On']; applyMixer(); CL.emit('cue-toggle', id); } return; }
    if (/^(trim|hi|mid|low|cfx|fader)[12]$/.test(id) || id === 'xfader' || id === 'hpmix') { applyMixer(); return; }
    if (id === 'fxon' && ev.value === true) { if (ev.ch) A.fx.ch = ev.ch; A.fx.on = !A.fx.on; applyFx(); return; }
    if (id === 'fxsel' && ev.value === true) { A.fx.type = (A.fx.type + 1) % FX_TYPES.length; applyFx(); return; }
    if (id === 'fxbL' && ev.value === true) { A.fx.beatIdx = Math.max(0, A.fx.beatIdx - 1); applyFx(); return; }
    if (id === 'fxbR' && ev.value === true) { A.fx.beatIdx = Math.min(BEATS.length - 1, A.fx.beatIdx + 1); applyFx(); return; }
    if (id === 'fxch') {
      if (ev.chSet) { A.fx.ch = ev.value === true ? ev.chSet : 3; applyFx(); return; } // hardware switch position
      if (ev.value === true) { A.fx.ch = A.fx.ch === 1 ? 2 : A.fx.ch === 2 ? 3 : 1; applyFx(); }
      return;
    }
    if (id === 'fxlevel') { applyFx(); return; }
    if ((id === 'load1' || id === 'load2') && ev.value === true) { CL.emit('load-request', id === 'load1' ? 1 : 2); }
  });

  // ---------- per-frame: beats, LEDs, levels ----------
  const lastBeat = { 1: null, 2: null };
  function level(an) {
    const a = A._lvlBuf || (A._lvlBuf = new Float32Array(1024));
    an.getFloatTimeDomainData(a); let s = 0; for (let i = 0; i < a.length; i += 4) s += a[i] * a[i];
    return Math.sqrt(s / (a.length / 4));
  }
  A.levels = { 1: 0, 2: 0, master: 0 };
  let blink = false, blinkT = 0;
  function tick() {
    requestAnimationFrame(tick);
    if (!A.ready) return;
    const now = performance.now();
    if (now - blinkT > 260) { blink = !blink; blinkT = now; }
    [1, 2].forEach(n => {
      const d = A.decks[n];
      if (d.playing && d.track) {
        const bi = Math.floor(d.beatIndexAt(d.getPos()));
        if (bi !== lastBeat[n]) { lastBeat[n] = bi; CL.emit('beat', { d, beatIndex: bi, bar: Math.floor(bi / 4) + 1, beatInBar: ((bi % 4) + 4) % 4 + 1 }); }
      }
      A.levels[n] = A.levels[n] * 0.7 + level(d.meter) * 0.3;
      // LEDs on the real controller
      const M = CL.midi;
      if (M && M.output) {
        const p = 'd' + n, guideLit = CL.guideLit || [];
        const flash = id => guideLit.indexOf(id) >= 0 ? blink : null;
        M.led(p + 'play', flash(p + 'play') != null ? flash(p + 'play') : (d.playing ? true : (d.buffer ? blink : false)));
        M.led(p + 'cue', flash(p + 'cue') != null ? flash(p + 'cue') : (!d.playing && d.buffer ? true : false));
        M.led(p + 'sync', flash(p + 'sync') != null ? flash(p + 'sync') : d.sync);
        M.led(p + 'exit', d.loop.on);
        M.led(p + 'in', flash(p + 'in') != null ? flash(p + 'in') : d.loop.on); M.led(p + 'out', flash(p + 'out') != null ? flash(p + 'out') : d.loop.on);
        M.led('hcue' + n, flash('hcue' + n) != null ? flash('hcue' + n) : !!CL.val['hcue' + n + 'On']);
        M.led(p + 'mHot', d.padMode === 'hot'); M.led(p + 'mFx', d.padMode === 'fx'); M.led(p + 'mJump', d.padMode === 'jump'); M.led(p + 'mSamp', d.padMode === 'samp');
        for (let i = 0; i < 8; i++) {
          const pid = p + 'p' + (i + 1), f = flash(pid);
          M.padLed(n, i, 'hot', f != null ? f : d.hot[i] != null);
          M.padLed(n, i, 'jump', f != null ? f : true);
          M.padLed(n, i, 'samp', f != null ? f : !!A.samples[i]);
          M.padLed(n, i, 'fx', f != null ? f : false);
        }
      }
    });
    if (CL.midi && CL.midi.output) CL.midi.led('fxon', A.fx.on ? blink : false);
    A.levels.master = A.levels.master * 0.7 + level(A.masterMeter) * 0.3;
    CL.emit('frame', now);
  }

  // ---------- recording ----------
  A.startRecording = function () {
    A.init();
    const chunks = [];
    const mr = new MediaRecorder(A.recDest.stream, { mimeType: 'audio/webm;codecs=opus' });
    mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'CueLab-mix-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.webm';
      document.body.appendChild(a); a.click(); a.remove();
    };
    mr.start(1000); A.rec = { mr, t0: Date.now() };
    CL.emit('rec', true);
  };
  A.stopRecording = function () { if (A.rec) { A.rec.mr.stop(); A.rec = null; CL.emit('rec', false); } };
})(window.CL);
