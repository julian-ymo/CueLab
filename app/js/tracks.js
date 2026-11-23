// CueLab tracks: the built-in "CueLab Practice Pack" (generated in the app, free to use: CC0),
// plus the user's own imported music (kept in IndexedDB), BPM detection, WAV export, sampler sounds.
'use strict';
(function (CL) {
  const T = CL.tracks = {};
  const SR = 44100;
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const CAM_MINOR = { 9: '8A', 4: '9A', 11: '10A', 6: '11A', 1: '12A', 8: '1A', 3: '2A', 10: '3A', 5: '4A', 0: '5A', 7: '6A', 2: '7A' };
  const CAM_MAJOR = { 0: '8B', 7: '9B', 2: '10B', 9: '11B', 4: '12B', 11: '1B', 6: '2B', 1: '3B', 8: '4B', 3: '5B', 10: '6B', 5: '7B' };
  T.camelot = (pc, minor) => (minor ? CAM_MINOR : CAM_MAJOR)[pc];
  T.keyName = (pc, minor) => NOTE_NAMES[pc] + (minor ? ' minor' : ' major');

  const PACK = 'CueLab Practice Pack';
  // style, bpm, root pitch class, minor?, bars
  const DEFS = [
    ['warm', 'Warm Circuit', 'house', 124, 9, true, 64, 'Beatmatch starter'],
    ['ferry', 'Night Ferry', 'deep', 124, 4, true, 64, 'Beatmatch starter'],
    ['glass', 'Glass Steps', 'house', 124, 4, true, 64, 'Beatmatch starter'],
    ['paper', 'Paper Lights', 'tech', 126, 2, true, 64, 'Harmonic pairs'],
    ['slow', 'Slow Lane', 'house', 118, 9, true, 64, 'Beatmatch starter'],
    ['peak', 'Peak Hour', 'tech', 128, 11, true, 64, 'Harmonic pairs'],
    ['rough', 'Rough Edge', 'house', 124, 5, true, 64, 'Harmonic pairs'],
    ['golden', 'Golden Hour', 'deep', 122, 7, false, 64, 'Harmonic pairs'],
    ['bounce', 'Concrete Bounce', 'hiphop', 92, 0, true, 48, 'Hip-hop'],
    ['corner', 'Corner Store', 'hiphop', 90, 7, true, 48, 'Hip-hop'],
    ['rail', 'Rail Runner', 'dnb', 174, 6, true, 96, 'Drum & bass'],
    ['chirps', 'Vinyl Chirps', 'scratch', 90, 2, true, 32, 'Scratch & sampler kit'],
    ['lowtide', 'Low Tide', 'lofi', 85, 8, false, 48, 'Study lo-fi'],
    ['sunrise', 'Sunrise Desk', 'lofi', 80, 5, false, 48, 'Study lo-fi'],
    ['nightbus', 'Night Bus', 'lofi', 75, 2, true, 40, 'Study lo-fi']
  ];
  const STYLE_NAME = { house: 'House', deep: 'Deep House', tech: 'Tech House', hiphop: 'Hip-hop', dnb: 'Drum & Bass', lofi: 'Lo-fi', scratch: 'Scratch tool' };
  T.list = DEFS.map(([id, title, style, bpm, root, minor, bars, pack]) => ({
    id, title, artist: PACK, style, genre: STYLE_NAME[style], bpm, root, minor, bars, pack,
    key: T.camelot(root, minor), keyName: T.keyName(root, minor), license: 'CC0', source: 'gen',
    firstBeat: 0, length: bars * 4 * 60 / bpm
  }));
  T.byId = id => T.list.find(t => t.id === id);

  // ---------- synthesis ----------
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  let noiseCache = null;
  function noise(ctx) {
    if (noiseCache && noiseCache.sampleRate === ctx.sampleRate && noiseCache._ctx === ctx) return noiseCache;
    const b = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    b._ctx = ctx; noiseCache = b; return b;
  }
  function env(ctx, g, t, a, peak, dec, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * (sus || 0.0001)), t + a + dec);
    if (end) { g.gain.setValueAtTime(Math.max(0.0001, peak * (sus || 0.0001)), end); g.gain.exponentialRampToValueAtTime(0.0001, end + (rel || 0.05)); }
  }
  function kick(ctx, out, t, vol, punch) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(punch || 150, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.45);
  }
  function hat(ctx, out, t, vol, open) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise(ctx); f.type = 'highpass'; f.frequency.value = open ? 6500 : 8000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.22 : 0.05));
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + (open ? 0.25 : 0.07));
  }
  function clap(ctx, out, t, vol) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise(ctx); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    [0, 0.011, 0.023].forEach(o => { g.gain.setValueAtTime(vol, t + o); g.gain.exponentialRampToValueAtTime(vol * 0.2, t + o + 0.009); });
    g.gain.setValueAtTime(vol * 0.8, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + 0.22);
  }
  function snare(ctx, out, t, vol) {
    clap(ctx, out, t, vol * 0.7);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    g.gain.setValueAtTime(vol * 0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.16);
  }
  function bass(ctx, out, t, note, len, vol, type, cutoff) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type || 'sawtooth'; o.frequency.value = mtof(note);
    f.type = 'lowpass'; f.Q.value = 4; f.frequency.setValueAtTime(cutoff || 700, t); f.frequency.exponentialRampToValueAtTime(140, t + Math.min(len, 0.25));
    env(ctx, g, t, 0.005, vol, 0.12, 0.6, 0.04, t + len);
    o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.1);
  }
  function chord(ctx, out, t, notes, len, vol, type, cutoff, attack) {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = cutoff || 2200; f.Q.value = 1;
    env(ctx, g, t, attack || 0.008, vol, attack ? 0.4 : 0.18, attack ? 0.8 : 0.25, attack ? 0.6 : 0.08, t + len);
    notes.forEach((n, i) => {
      [-6, 6].forEach(det => {
        const o = ctx.createOscillator(); o.type = type || 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det + i;
        o.connect(f); o.start(t); o.stop(t + len + (attack ? 0.8 : 0.2));
      });
    });
    f.connect(g); g.connect(out);
  }
  function chirp(ctx, out, t, root, vol) {
    // a short vocal-ish "ahh" — ideal for scratch practice
    const o = ctx.createOscillator(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain(), m = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(root + 12), t); o.frequency.linearRampToValueAtTime(mtof(root + 14), t + 0.35);
    f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 6; f2.type = 'bandpass'; f2.frequency.value = 1200; f2.Q.value = 6;
    env(ctx, g, t, 0.01, vol, 0.08, 0.7, 0.08, t + 0.4);
    o.connect(f1); o.connect(f2); f1.connect(m); f2.connect(m); m.connect(g); g.connect(out); o.start(t); o.stop(t + 0.55);
  }
  function crackle(ctx, out, t0, dur, vol) {
    for (let t = t0; t < t0 + dur; t += 0.05 + Math.random() * 0.25) {
      const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      s.buffer = noise(ctx); f.type = 'highpass'; f.frequency.value = 2000;
      g.gain.setValueAtTime(vol * Math.random(), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.006);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.9); s.stop(t + 0.01);
    }
  }
  // minor: i VI III VII ; major: I V vi IV
  function progression(root, minor) {
    const base = 48 + root;
    const tri = (r, m) => m ? [r, r + 3, r + 7, r + 10] : [r, r + 4, r + 7, r + 11];
    return minor
      ? [{ r: base, c: tri(base + 12, true) }, { r: base + 8, c: tri(base + 8 + 12, false) }, { r: base + 3, c: tri(base + 3 + 12, false) }, { r: base + 10, c: tri(base + 10 + 12, false) }]
      : [{ r: base, c: tri(base + 12, false) }, { r: base + 7, c: tri(base + 7 + 12, false) }, { r: base + 9, c: tri(base + 9 + 12, true) }, { r: base + 5, c: tri(base + 5 + 12, false) }];
  }

  // Fast direct synthesis: render one 8-bar block per section, then tile it into a full song.
  function makeSynth(len) {
    const L = new Float32Array(len), R = new Float32Array(len);
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
    const put = (i, l, r) => { if (i >= 0 && i < len) { L[i] += l; R[i] += r; } };
    const biquadBP = (f, q) => { const w = 2 * Math.PI * f / SR, a = Math.sin(w) / (2 * q), b0 = a, b2 = -a, a0 = 1 + a, a1 = -2 * Math.cos(w), a2 = 1 - a; return { b0: b0 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 }; };
    const bp = (st, x) => { const y = st.b0 * x + st.b2 * st.x2 - st.a1 * st.y1 - st.a2 * st.y2; st.x2 = st.x1; st.x1 = x; st.y2 = st.y1; st.y1 = y; return y; };
    return {
      L, R,
      kick(t, vol, punch) {
        const i0 = Math.round(t * SR), n = Math.round(0.42 * SR); let ph = 0;
        for (let k = 0; k < n; k++) { const tt = k / SR, f = 46 + ((punch || 150) - 46) * Math.exp(-tt / 0.03); ph += 2 * Math.PI * f / SR; const v = Math.sin(ph) * vol * Math.exp(-tt / 0.13) * (k < 40 ? k / 40 : 1); put(i0 + k, v, v); }
      },
      hat(t, vol, open) {
        const i0 = Math.round(t * SR), tau = open ? 0.055 : 0.012, n = Math.round(tau * 6 * SR); let prev = 0;
        for (let k = 0; k < n; k++) { const x = rnd(); const hp = x - prev * 0.95; prev = x; const v = hp * vol * 0.5 * Math.exp(-(k / SR) / tau); put(i0 + k, v * 0.9, v); }
      },
      clap(t, vol) {
        const i0 = Math.round(t * SR), n = Math.round(0.22 * SR), st = biquadBP(1400, 0.9);
        for (let k = 0; k < n; k++) { const tt = k / SR; let e = Math.exp(-tt / 0.06); [0, 0.011, 0.023].forEach(o => { if (tt >= o && tt < o + 0.009) e = Math.max(e, 1 - (tt - o) / 0.009); }); const v = bp(st, rnd()) * vol * 2.2 * e; put(i0 + k, v, v); }
      },
      snare(t, vol) {
        this.clap(t, vol * 0.75);
        const i0 = Math.round(t * SR), n = Math.round(0.15 * SR); let ph = 0;
        for (let k = 0; k < n; k++) { const tt = k / SR, f = 150 + 70 * Math.exp(-tt / 0.03); ph += 2 * Math.PI * f / SR; const v = (Math.abs((ph / Math.PI) % 2 - 1) * 2 - 1) * vol * 0.6 * Math.exp(-tt / 0.05); put(i0 + k, v, v); }
      },
      bass(t, note, dur, vol, wave, cutoff) {
        const i0 = Math.round(t * SR), n = Math.round((dur + 0.06) * SR), f = mtof(note); let ph = 0, y = 0;
        for (let k = 0; k < n; k++) {
          const tt = k / SR; ph += f / SR; ph -= Math.floor(ph);
          const x = wave === 'triangle' ? (Math.abs(ph * 2 - 1) * 2 - 1) : (ph * 2 - 1);
          const fc = 140 + ((cutoff || 700) - 140) * Math.exp(-tt / 0.08), a = 1 - Math.exp(-2 * Math.PI * fc / SR);
          y += a * (x - y);
          const env = (k < 200 ? k / 200 : 1) * (tt < dur ? 1 : Math.max(0, 1 - (tt - dur) / 0.05)) * (0.6 + 0.4 * Math.exp(-tt / 0.12));
          const v = y * vol * env; put(i0 + k, v, v);
        }
      },
      chord(t, notes, dur, vol, wave, cutoff, attack) {
        const i0 = Math.round(t * SR), rel = attack ? 0.5 : 0.08, n = Math.round((dur + rel) * SR), a = 1 - Math.exp(-2 * Math.PI * (cutoff || 2200) / SR);
        const oscs = []; notes.forEach((m, j) => [-0.004, 0.004].forEach((d, q) => oscs.push({ f: mtof(m) * (1 + d), ph: (j * 0.13 + q * 0.37) % 1, pan: q ? 0.8 : 1 })));
        let yl = 0, yr = 0; const att = attack || 0.006;
        for (let k = 0; k < n; k++) {
          const tt = k / SR; let sl = 0, sr = 0;
          for (const o of oscs) { o.ph += o.f / SR; o.ph -= Math.floor(o.ph); const x = wave === 'triangle' ? (Math.abs(o.ph * 2 - 1) * 2 - 1) : (o.ph * 2 - 1); sl += x * o.pan; sr += x * (1.8 - o.pan); }
          yl += a * (sl - yl); yr += a * (sr - yr);
          const env = Math.min(1, tt / att) * (attack ? 0.8 + 0.2 * Math.exp(-tt / 0.4) : 0.25 + 0.75 * Math.exp(-tt / 0.06)) * (tt < dur ? 1 : Math.max(0, 1 - (tt - dur) / rel));
          put(i0 + k, yl * vol * env * 0.5, yr * vol * env * 0.5);
        }
      },
      chirp(t, root, vol) {
        const i0 = Math.round(t * SR), n = Math.round(0.45 * SR), f1 = biquadBP(800, 5), f2 = biquadBP(1200, 5); let ph = 0;
        for (let k = 0; k < n; k++) { const tt = k / SR, f = mtof(root + 12) * (1 + 0.12 * Math.min(1, tt / 0.35)); ph += f / SR; ph -= Math.floor(ph); const x = ph * 2 - 1; const env = Math.min(1, tt / 0.01) * (tt < 0.38 ? 1 : Math.max(0, 1 - (tt - 0.38) / 0.07)); const v = (bp(f1, x) + bp(f2, x)) * vol * 1.6 * env; put(i0 + k, v, v); }
      },
      crackle(t0, dur, vol) { for (let t = t0; t < t0 + dur; t += 0.05 + Math.abs(rnd()) * 0.25) { const i = Math.round(t * SR), v = rnd() * vol; put(i, v, v); put(i + 1, -v * 0.5, -v * 0.5); } }
    };
  }

  // one 8-bar block of a section
  function block(def, sec, bars) {
    const beat = 60 / def.bpm, bar = beat * 4, len = Math.ceil(bars * bar * SR) + Math.round(0.6 * SR);
    const sy = makeSynth(len), prog = progression(def.root, def.minor), s = def.style;
    for (let b = 0; b < bars; b++) {
      const t = b * bar, ch = prog[b % 4], swing = (s === 'lofi' || s === 'hiphop') ? beat * 0.08 : 0;
      if (s === 'house' || s === 'deep' || s === 'tech') {
        for (let q = 0; q < 4; q++) {
          sy.kick(t + q * beat, 0.95, s === 'tech' ? 170 : 150);
          sy.hat(t + q * beat + beat / 2, s === 'deep' ? 0.2 : 0.28, true);
          if (sec !== 'intro' || b >= 4) for (let x = 0; x < 4; x++) sy.hat(t + q * beat + x * beat / 4, 0.06 + (x === 2 ? 0.03 : 0), false);
          if (q === 1 || q === 3) sy.clap(t + q * beat, s === 'deep' ? 0.3 : 0.42);
        }
        if (sec === 'build' || sec === 'full') {
          if (s === 'tech') { for (let x = 0; x < 16; x++) if (x % 4 !== 0) sy.bass(t + x * beat / 4, ch.r - 12 + (x % 8 === 6 ? 7 : 0), beat / 4 * 0.8, 0.34, 'saw', 500); }
          else for (let q = 0; q < 4; q++) sy.bass(t + q * beat + beat / 2, ch.r - 12 + (q === 3 ? 7 : 0), beat * (s === 'deep' ? 0.45 : 0.35), 0.4, s === 'deep' ? 'triangle' : 'saw', s === 'deep' ? 400 : 800);
        }
        if (sec === 'full') {
          if (s === 'deep') sy.chord(t, ch.c, bar * 0.95, 0.1, 'triangle', 1400, 0.25);
          else [0.5, 1.5, 2.75].forEach(o => sy.chord(t + o * beat, ch.c, beat * 0.3, 0.09, 'saw', s === 'tech' ? 1500 : 2600));
        }
        if (b % 8 === 7 && sec !== 'outro') for (let x = 0; x < 4; x++) sy.clap(t + 3 * beat + x * beat / 4, 0.12 + x * 0.05);
      } else if (s === 'hiphop' || s === 'lofi' || s === 'scratch') {
        const kv = s === 'lofi' ? 0.7 : 0.95;
        [0, 1.75, 2.5].forEach(o => sy.kick(t + o * beat, kv, 120));
        [1, 3].forEach(o => sy.snare(t + o * beat, s === 'lofi' ? 0.3 : 0.45));
        for (let x = 0; x < 8; x++) sy.hat(t + x * beat / 2 + (x % 2 ? swing : 0), s === 'lofi' ? 0.07 : 0.11, false);
        if (s === 'scratch') { if (sec !== 'intro' || b >= 2) [0, 2].forEach(o => sy.chirp(t + o * beat, 50 + def.root, 0.5)); }
        else {
          if (sec !== 'intro') [0, 1.75, 2.5].forEach(o => sy.bass(t + o * beat, ch.r - 12, beat * 0.6, 0.36, 'triangle', 300));
          if (sec === 'full' || s === 'lofi') sy.chord(t, ch.c, bar * 0.98, s === 'lofi' ? 0.09 : 0.07, s === 'lofi' ? 'triangle' : 'saw', s === 'lofi' ? 1100 : 1800, 0.15);
        }
        if (s === 'lofi') sy.crackle(t, bar, 0.06);
      } else if (s === 'dnb') {
        [0, 2.5].forEach(o => sy.kick(t + o * beat, 0.9, 160));
        [1, 3].forEach(o => sy.snare(t + o * beat, 0.5));
        for (let x = 0; x < 8; x++) sy.hat(t + x * beat / 2, 0.09, x % 2 === 1);
        if (sec === 'build' || sec === 'full') sy.bass(t, ch.r - 12, bar * 0.95, 0.32, 'saw', 300);
        if (sec === 'full') sy.chord(t, ch.c, bar * 0.95, 0.06, 'triangle', 2000, 0.3);
      }
    }
    return { L: sy.L, R: sy.R, barLen: Math.round(bar * SR) };
  }

  async function render(def) {
    const beat = 60 / def.bpm, bar = beat * 4, B = def.bars, q = B / 4;
    const total = Math.ceil(B * bar * SR) + Math.round(1.5 * SR);
    const L = new Float32Array(total), R = new Float32Array(total);
    const blocks = {};
    const sections = [['intro', 0], ['build', q], ['full', 2 * q], ['outro', 3 * q]];
    for (const [sec, startBar] of sections) {
      const key = sec === 'outro' ? 'intro' : sec;
      if (!blocks[key]) { blocks[key] = block(def, key, 8); await new Promise(r => setTimeout(r, 0)); }
      const bl = blocks[key];
      for (let b = 0; b < q; b++) {
        // copy bar (b % 8) of the block to song bar startBar+b (sample-exact by computing from bar index)
        const srcStart = Math.round((b % 8) * bar * SR), dstStart = Math.round((startBar + b) * bar * SR);
        const n = Math.round(bar * SR) + (b === q - 1 && sec === 'outro' ? Math.round(0.5 * SR) : 0);
        for (let k = 0; k < n; k++) { const si = srcStart + k, di = dstStart + k; if (si >= bl.L.length || di >= total) break; L[di] += bl.L[si]; R[di] += bl.R[si]; }
        if (b % 8 === 0 && startBar + b > 0) { const tail = Math.round(8 * bar * SR); for (let k = 0; tail + k < bl.L.length && dstStart + k < total; k++) { L[dstStart + k] += bl.L[tail + k]; R[dstStart + k] += bl.R[tail + k]; } }
      }
    }
    // tails crossing bar lines are already inside the block bars, so seams are clean. Normalise + soft clip.
    let peak = 0.0001; for (let i = 0; i < total; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; }
    const g = 0.95 / Math.min(peak, 2.5);
    for (let i = 0; i < total; i++) { L[i] = Math.tanh(L[i] * g * 1.1) * 0.9; R[i] = Math.tanh(R[i] * g * 1.1) * 0.9; }
    const buf = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: SR });
    buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
    return buf;
  }

  // ---------- buffers, cache ----------
  const cache = new Map(); // id -> AudioBuffer (keep the last few)
  const pending = new Map();
  T.getBuffer = async function (track) {
    if (cache.has(track.id)) { const b = cache.get(track.id); cache.delete(track.id); cache.set(track.id, b); return b; }
    if (pending.has(track.id)) return pending.get(track.id);
    const p = (async () => {
      let buf;
      if (track.source === 'gen') buf = await render(track);
      else buf = await decodeUser(track);
      cache.set(track.id, buf);
      while (cache.size > 5) cache.delete(cache.keys().next().value);
      if (!track.peaks) track.peaks = peaks(buf);
      pending.delete(track.id);
      CL.emit('track-ready', track);
      return buf;
    })();
    pending.set(track.id, p);
    return p;
  };
  function peaks(buf) {
    const d0 = buf.getChannelData(0), d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0;
    const hop = Math.floor(buf.sampleRate / 100), n = Math.floor(d0.length / hop), out = new Float32Array(n);
    let max = 0.0001;
    for (let i = 0; i < n; i++) { let m = 0; const o = i * hop; for (let j = 0; j < hop; j += 3) { const v = Math.abs(d0[o + j]) + Math.abs(d1[o + j]); if (v > m) m = v; } out[i] = m; if (m > max) max = m; }
    for (let i = 0; i < n; i++) out[i] /= max;
    return out;
  }
  T.peaksFor = track => track.peaks || null;

  // ---------- user music (IndexedDB) ----------
  const DB = 'cuelab-music';
  function db() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('tracks', { keyPath: 'id' });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function dbAll() { const d = await db(); return new Promise(res => { const out = []; const c = d.transaction('tracks').objectStore('tracks').openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out.push(cur.value); cur.continue(); } else res(out); }; c.onerror = () => res(out); }); }
  async function dbPut(rec) { const d = await db(); return new Promise(res => { const tx = d.transaction('tracks', 'readwrite'); tx.objectStore('tracks').put(rec); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
  async function dbGet(id) { const d = await db(); return new Promise(res => { const r = d.transaction('tracks').objectStore('tracks').get(id); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); }
  T.remove = async function (id) {
    const d = await db(); await new Promise(res => { const tx = d.transaction('tracks', 'readwrite'); tx.objectStore('tracks').delete(id); tx.oncomplete = res; tx.onerror = res; });
    T.list = T.list.filter(t => t.id !== id); CL.emit('library', T.list);
  };
  T.updateMeta = async function (track) {
    const rec = await dbGet(track.id); if (!rec) return;
    rec.bpm = track.bpm; rec.title = track.title; rec.firstBeat = track.firstBeat; await dbPut(rec);
  };
  async function decodeUser(track) {
    const rec = await dbGet(track.id);
    const ctx = new OfflineAudioContext(2, SR, SR);
    return ctx.decodeAudioData(rec.data.slice(0));
  }
  T.loadUser = async function () {
    try {
      const all = await dbAll();
      all.forEach(r => {
        if (T.byId(r.id)) return;
        T.list.push({ id: r.id, title: r.title, artist: r.artist || 'Your music', style: 'user', genre: 'Your music', bpm: r.bpm, key: r.key || '—', license: 'Yours', source: 'file', firstBeat: r.firstBeat || 0, length: r.length || 0, pack: 'Your music' });
      });
      CL.emit('library', T.list);
    } catch (e) { console.warn('IndexedDB unavailable', e); }
  };
  T.importFiles = async function (files, onProgress) {
    const added = [];
    for (const f of Array.from(files)) {
      try {
        onProgress && onProgress('Reading ' + f.name);
        const data = await f.arrayBuffer();
        const ctx = new OfflineAudioContext(2, SR, SR);
        const buf = await ctx.decodeAudioData(data.slice(0));
        onProgress && onProgress('Finding the BPM of ' + f.name);
        const det = await detectBpm(buf);
        const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const title = f.name.replace(/\.[^.]+$/, '');
        await dbPut({ id, title, bpm: det.bpm, firstBeat: det.firstBeat, length: buf.duration, data });
        const t = { id, title, artist: 'Your music', style: 'user', genre: 'Your music', bpm: det.bpm, key: '—', license: 'Yours', source: 'file', firstBeat: det.firstBeat, length: buf.duration, pack: 'Your music' };
        T.list.push(t); added.push(t);
      } catch (e) { onProgress && onProgress('Could not read ' + f.name); }
    }
    CL.emit('library', T.list);
    return added;
  };

  // BPM: onset envelope of the low end + autocorrelation, then find where the beats land.
  async function detectBpm(buf) {
    const len = Math.min(buf.duration, 90), r = 11025;
    const ctx = new OfflineAudioContext(1, Math.ceil(len * r), r);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    s.connect(f); f.connect(ctx.destination); s.start(0, Math.min(20, buf.duration / 4));
    const low = (await ctx.startRendering()).getChannelData(0);
    const fps = 200, hop = Math.floor(r / fps), n = Math.floor(low.length / hop), envl = new Float32Array(n);
    for (let i = 0; i < n; i++) { let e = 0; for (let j = 0; j < hop; j++) { const v = low[i * hop + j]; e += v * v; } envl[i] = Math.sqrt(e / hop); }
    const on = new Float32Array(n); for (let i = 1; i < n; i++) on[i] = Math.max(0, envl[i] - envl[i - 1]);
    let best = 120, bestScore = -1;
    for (let bpm = 70; bpm <= 180; bpm += 0.5) {
      const lag = fps * 60 / bpm; let sc = 0;
      for (let i = 0; i + lag * 4 < n; i++) { const a = on[i]; if (!a) continue; sc += a * (interp(on, i + lag) + 0.5 * interp(on, i + lag * 2) + 0.25 * interp(on, i + lag * 4)); }
      const pref = bpm >= 85 && bpm <= 175 ? 1 : 0.9;
      if (sc * pref > bestScore) { bestScore = sc * pref; best = bpm; }
    }
    // phase
    const lag = fps * 60 / best; let bestPh = 0, phScore = -1;
    for (let ph = 0; ph < lag; ph++) { let sc = 0; for (let t = ph; t < n; t += lag) sc += interp(on, t); if (sc > phScore) { phScore = sc; bestPh = ph; } }
    const offset = Math.min(20, buf.duration / 4);
    let firstBeat = (offset + bestPh / fps) % (60 / best);
    return { bpm: Math.round(best * 10) / 10, firstBeat };
  }
  function interp(a, x) { const i = Math.floor(x), f = x - i; return i + 1 < a.length ? a[i] * (1 - f) + a[i + 1] * f : 0; }

  // ---------- WAV export (use the practice tracks in rekordbox / Serato) ----------
  T.exportWav = async function (track) {
    const buf = await T.getBuffer(track);
    const ch = buf.numberOfChannels, len = buf.length, out = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
    out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    w(36, 'data'); out.setUint32(40, len * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let o = 44; for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7FFF, true); o += 2; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'audio/wav' }));
    a.download = track.title + ' (' + track.bpm + ' BPM, ' + track.key + ').wav'; document.body.appendChild(a); a.click(); a.remove();
  };

  // ---------- sampler sounds ----------
  T.sampleNames = ['Kick', 'Snare', 'Clap', 'Open hat', 'Air horn', 'Riser', 'Laser', 'Vox chirp'];
  T.makeSamples = function () {
    const arr = [];
    const make = async (i, dur, fn) => { const ctx = new OfflineAudioContext(2, Math.ceil(dur * SR), SR); const g = ctx.createGain(); g.connect(ctx.destination); fn(ctx, g); arr[i] = await ctx.startRendering(); };
    make(0, 0.5, (c, o) => kick(c, o, 0, 1, 160));
    make(1, 0.4, (c, o) => snare(c, o, 0, 0.8));
    make(2, 0.4, (c, o) => clap(c, o, 0, 0.8));
    make(3, 0.4, (c, o) => hat(c, o, 0, 0.5, true));
    make(4, 1.4, (c, o) => { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2500; f.connect(o); [0, 0.25, 0.5].forEach(t => chord(c, f, t, [58, 62, 65], t === 0.5 ? 0.7 : 0.18, 0.12, 'sawtooth', 3000)); });
    make(5, 2.2, (c, o) => { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise(c); s.loop = true; f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(300, 0); f.frequency.exponentialRampToValueAtTime(9000, 2); g.gain.setValueAtTime(0.05, 0); g.gain.linearRampToValueAtTime(0.6, 2); g.gain.linearRampToValueAtTime(0, 2.15); s.connect(f); f.connect(g); g.connect(o); s.start(0); s.stop(2.2); });
    make(6, 0.5, (c, o) => { const x = c.createOscillator(), g = c.createGain(); x.type = 'square'; x.frequency.setValueAtTime(2400, 0); x.frequency.exponentialRampToValueAtTime(120, 0.35); g.gain.setValueAtTime(0.25, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.45); x.connect(g); g.connect(o); x.start(0); x.stop(0.5); });
    make(7, 0.6, (c, o) => chirp(c, o, 0, 62, 0.7));
    return arr;
  };

  T.init = function () { T.loadUser(); };
})(window.CL);
