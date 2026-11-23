// CueLab core: event bus, control registry, saved progress.
'use strict';
window.CL = window.CL || {};
(function (CL) {
  // ---------- tiny event bus ----------
  const handlers = {};
  CL.on = (evt, fn) => { (handlers[evt] = handlers[evt] || []).push(fn); return () => CL.off(evt, fn); };
  CL.off = (evt, fn) => { handlers[evt] = (handlers[evt] || []).filter(f => f !== fn); };
  CL.emit = (evt, data) => { (handlers[evt] || []).slice().forEach(f => { try { f(data); } catch (e) { console.error(e); } }); };

  // ---------- control registry ----------
  // kind: button | knob | fader | tempo | xfader | jog | pad | encoder
  // name: how lessons and messages refer to it
  const C = {};
  const add = (id, kind, name, extra) => { C[id] = Object.assign({ id, kind, name }, extra || {}); };
  [1, 2].forEach(d => {
    const D = 'Deck ' + d, p = 'd' + d;
    add(p + 'play', 'button', 'PLAY/PAUSE on ' + D);
    add(p + 'cue', 'button', 'CUE on ' + D);
    add(p + 'sync', 'button', 'BEAT SYNC on ' + D);
    add(p + 'shift', 'button', 'SHIFT on ' + D, { quiet: true });
    add(p + 'in', 'button', 'loop IN on ' + D);
    add(p + 'out', 'button', 'loop OUT on ' + D);
    add(p + 'exit', 'button', '4 BEAT/EXIT on ' + D);
    add(p + 'callL', 'button', 'CUE/LOOP CALL ◀ on ' + D);
    add(p + 'callR', 'button', 'CUE/LOOP CALL ▶ on ' + D);
    add(p + 'jog', 'jog', 'the jog wheel on ' + D);
    add(p + 'tempo', 'tempo', 'the TEMPO slider on ' + D);
    add(p + 'mHot', 'button', 'HOT CUE mode on ' + D);
    add(p + 'mFx', 'button', 'PAD FX mode on ' + D);
    add(p + 'mJump', 'button', 'BEAT JUMP mode on ' + D);
    add(p + 'mSamp', 'button', 'SAMPLER mode on ' + D);
    for (let i = 1; i <= 8; i++) add(p + 'p' + i, 'pad', 'pad ' + i + ' on ' + D);
    const ch = 'Channel ' + d;
    add('trim' + d, 'knob', 'TRIM on ' + ch, { def: 0.5 });
    add('hi' + d, 'knob', 'HI on ' + ch, { def: 0.5 });
    add('mid' + d, 'knob', 'MID on ' + ch, { def: 0.5 });
    add('low' + d, 'knob', 'LOW on ' + ch, { def: 0.5 });
    add('cfx' + d, 'knob', 'CFX on ' + ch, { def: 0.5 });
    add('hcue' + d, 'button', 'headphone CUE on ' + ch);
    add('fader' + d, 'fader', 'the ' + ch + ' fader', { def: 1 });
  });
  add('xfader', 'xfader', 'the crossfader', { def: 0.5 });
  add('browse', 'encoder', 'the BROWSE knob', { quiet: true });
  add('load1', 'button', 'LOAD 1', { quiet: true });
  add('load2', 'button', 'LOAD 2', { quiet: true });
  add('master', 'knob', 'MASTER LEVEL', { def: 0.7, hardware: true });
  add('mcue', 'button', 'master CUE', { hardware: true });
  add('hpmix', 'knob', 'headphone MIX', { def: 0.5 });
  add('hplevel', 'knob', 'headphone LEVEL', { def: 0.6, hardware: true });
  add('mic', 'knob', 'MIC LEVEL', { def: 0, hardware: true });
  add('smartcfx', 'button', 'SMART CFX', { hardware: true });
  add('smartfader', 'button', 'SMART FADER', { hardware: true });
  add('fxsel', 'button', 'FX SELECT');
  add('fxch', 'button', 'the FX channel switch');
  add('fxbL', 'button', 'BEAT ◀');
  add('fxbR', 'button', 'BEAT ▶');
  add('fxlevel', 'knob', 'LEVEL/DEPTH', { def: 0.5 });
  add('fxon', 'button', 'FX ON/OFF');
  CL.controls = C;

  // live values (0..1 for knobs/faders, true/false for buttons, accumulated angle for jogs)
  CL.val = {};
  Object.values(C).forEach(c => {
    CL.val[c.id] = c.kind === 'button' || c.kind === 'pad' ? false : c.kind === 'jog' ? 0 : (c.def != null ? c.def : 0.5);
  });
  CL.touched = {}; // ids we've received from real hardware at least once
  CL.jogTouch = { d1jog: false, d2jog: false };

  // Every control change from hardware, the on-screen panel, or a demo goes through here.
  // src: 'midi' | 'mouse' | 'demo'
  CL.input = function (id, value, src, extra) {
    const c = C[id];
    if (!c) return;
    const prev = CL.val[id];
    if (c.kind === 'jog') {
      CL.val[id] = prev + value * 1.6; // value = signed ticks, angle in degrees for the panel
    } else {
      CL.val[id] = value;
    }
    if (src === 'midi') CL.touched[id] = true;
    CL.emit('control', Object.assign({ id, value, prev, kind: c.kind, src: src || 'midi', t: performance.now() }, extra || {}));
  };

  // ---------- saved progress ----------
  const KEY = 'cuelab.v1';
  const defaults = {
    done: {},           // lessonId -> best score
    stepsDone: {},      // lessonId -> highest step reached
    practiceLater: {},  // lessonId -> [step indexes skipped]
    current: 'l1',
    minutes: 0,         // practice minutes total
    week: {},           // yyyy-ww -> minutes
    streakDays: [],     // list of yyyy-mm-dd
    xp: 0,
    studySessions: 0,
    settings: { jogFeel: 1, invertTempo: false, sinkId: '', cueToOut34: true, studyFocus: 25, studyBreak: 5, studyVolume: 0.7 },
    learned: {}         // learned MIDI: "status:data1" -> controlId
  };
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s ? Object.assign({}, defaults, s, { settings: Object.assign({}, defaults.settings, s.settings || {}) }) : JSON.parse(JSON.stringify(defaults)); }
    catch (e) { return JSON.parse(JSON.stringify(defaults)); }
  }
  CL.store = load();
  CL.save = () => { try { localStorage.setItem(KEY, JSON.stringify(CL.store)); } catch (e) { /* storage full or unavailable */ } };

  const today = () => new Date().toISOString().slice(0, 10);
  const weekKey = () => { const d = new Date(); const onejan = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-' + Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7); };
  CL.addPractice = function (seconds) {
    const m = seconds / 60;
    CL.store.minutes += m;
    const wk = weekKey(); CL.store.week[wk] = (CL.store.week[wk] || 0) + m;
    const t = today(); if (CL.store.streakDays.indexOf(t) < 0) CL.store.streakDays.push(t);
    CL.save();
  };
  CL.weekMinutes = () => CL.store.week[weekKey()] || 0;
  CL.streak = function () {
    const set = new Set(CL.store.streakDays); let n = 0; const d = new Date();
    if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };
  // count practice time while the app is open and something is playing
  setInterval(() => { if (CL.audio && CL.audio.anyPlaying && CL.audio.anyPlaying()) CL.addPractice(15); }, 15000);

  // ---------- helpers ----------
  CL.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  CL.fmtTime = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); };
  CL.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // describe a knob value like "10 o'clock"
  CL.clock = function (v) {
    const deg = -135 + v * 270; // -135 (7 o'clock) .. +135 (5 o'clock)
    let h = Math.round(deg / 30) + 12; if (h > 12) h -= 12; if (h <= 0) h += 12;
    if (v <= 0.03) return 'fully left'; if (v >= 0.97) return 'fully right'; if (Math.abs(v - 0.5) < 0.04) return '12 o\'clock';
    return h + " o'clock";
  };
})(window.CL);
