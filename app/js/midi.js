// CueLab MIDI: talks to the Pioneer DJ DDJ-FLX4 over USB MIDI (Web MIDI API).
// Message map cross-checked against the open-source Mixxx DDJ-FLX4 mapping.
// Anything the app can't recognise can be taught in the DDJ-FLX4 > Control test screen ("learn").
'use strict';
(function (CL) {
  const M = CL.midi = { access: null, input: null, output: null, status: 'searching', name: '', log: [], learnTarget: null, unknownCount: 0 };

  // key = status byte (hex) + ':' + data1 (hex)  ->  { id, type, part }
  // type: btn (note on/off), cc14 (14-bit knob: part msb|lsb), rel (relative encoder/jog), pad
  const MAP = {};
  const k = (st, d1) => st.toString(16) + ':' + d1.toString(16);
  const btn = (st, d1, id, opt) => { MAP[k(st, d1)] = Object.assign({ id, type: 'btn' }, opt || {}); };
  const cc14 = (st, msb, id) => { MAP[k(st, msb)] = { id, type: 'cc14', part: 'msb' }; MAP[k(st, msb + 0x20)] = { id, type: 'cc14', part: 'lsb' }; };
  const rel = (st, d1, id, opt) => { MAP[k(st, d1)] = Object.assign({ id, type: 'rel' }, opt || {}); };

  [1, 2].forEach(d => {
    const n = 0x90 + d - 1, c = 0xB0 + d - 1, p = 'd' + d;
    btn(n, 0x0B, p + 'play'); btn(n, 0x0E, p + 'play', { shift: true });
    btn(n, 0x0C, p + 'cue'); btn(n, 0x48, p + 'cue', { shift: true });
    btn(n, 0x58, p + 'sync'); btn(n, 0x5C, p + 'sync', { long: true }); btn(n, 0x60, p + 'sync', { shift: true, tempoRange: true });
    btn(n, 0x3F, p + 'shift');
    btn(n, 0x10, p + 'in'); btn(n, 0x4C, p + 'in', { shift: true });
    btn(n, 0x11, p + 'out'); btn(n, 0x4E, p + 'out', { shift: true });
    btn(n, 0x4D, p + 'exit'); btn(n, 0x50, p + 'exit', { shift: true });
    btn(n, 0x51, p + 'callL'); btn(n, 0x3E, p + 'callL', { shift: true });
    btn(n, 0x53, p + 'callR'); btn(n, 0x3D, p + 'callR', { shift: true });
    btn(n, 0x36, p + 'jog', { touch: true }); btn(n, 0x67, p + 'jog', { touch: true, shift: true });
    btn(n, 0x54, 'hcue' + d);
    // pad mode buttons (same layout as Pioneer's other DDJ controllers)
    btn(n, 0x1B, p + 'mHot'); btn(n, 0x1E, p + 'mFx'); btn(n, 0x20, p + 'mJump'); btn(n, 0x22, p + 'mSamp');
    btn(n, 0x69, p + 'mHot', { shift: true }); btn(n, 0x6B, p + 'mFx', { shift: true }); btn(n, 0x6D, p + 'mJump', { shift: true }); btn(n, 0x6F, p + 'mSamp', { shift: true });
    cc14(c, 0x00, p + 'tempo');
    rel(c, 0x22, p + 'jog', { top: true }); rel(c, 0x23, p + 'jog', { top: true }); rel(c, 0x21, p + 'jog', { side: true }); rel(c, 0x29, p + 'jog', { side: true, shift: true });
    cc14(c, 0x04, 'trim' + d); cc14(c, 0x07, 'hi' + d); cc14(c, 0x0B, 'mid' + d); cc14(c, 0x0F, 'low' + d); cc14(c, 0x13, 'fader' + d);
    // pads: Deck 1 on MIDI channel 8 (0x97), Deck 2 on channel 10 (0x99); +1 channel when SHIFT is held
    [[d === 1 ? 0x97 : 0x99, false], [d === 1 ? 0x98 : 0x9A, true]].forEach(([st, sh]) => {
      [['hot', 0x00], ['fx', 0x10], ['jump', 0x20], ['samp', 0x30], ['fx2', 0x18], ['loop', 0x60], ['keys', 0x40], ['kshift', 0x70]].forEach(([mode, base]) => {
        for (let i = 0; i < 8; i++) MAP[k(st, base + i)] = { id: p + 'p' + (i + 1), type: 'btn', pad: true, mode, shift: sh };
      });
    });
  });
  cc14(0xB6, 0x1F, 'xfader');
  cc14(0xB6, 0x0C, 'hpmix');
  cc14(0xB6, 0x17, 'cfx1');
  cc14(0xB6, 0x18, 'cfx2');
  rel(0xB6, 0x40, 'browse'); rel(0xB6, 0x64, 'browse', { shift: true });
  btn(0x96, 0x46, 'load1'); btn(0x96, 0x47, 'load2');
  btn(0x96, 0x41, 'browse', { press: true }); btn(0x96, 0x42, 'browse', { press: true });
  btn(0x94, 0x63, 'fxsel'); btn(0x94, 0x64, 'fxsel', { shift: true });
  btn(0x94, 0x4A, 'fxbL'); btn(0x94, 0x4B, 'fxbR');
  btn(0x94, 0x47, 'fxon');
  cc14(0xB4, 0x02, 'fxlevel');
  M.MAP = MAP;

  // LED notes we drive: id -> [status, note]
  const LED = {};
  [1, 2].forEach(d => {
    const n = 0x90 + d - 1, p = 'd' + d;
    LED[p + 'play'] = [n, 0x0B]; LED[p + 'cue'] = [n, 0x0C]; LED[p + 'sync'] = [n, 0x58];
    LED[p + 'in'] = [n, 0x10]; LED[p + 'out'] = [n, 0x11]; LED[p + 'exit'] = [n, 0x4D];
    LED['hcue' + d] = [n, 0x54];
    LED[p + 'mHot'] = [n, 0x1B]; LED[p + 'mFx'] = [n, 0x1E]; LED[p + 'mJump'] = [n, 0x20]; LED[p + 'mSamp'] = [n, 0x22];
    for (let i = 0; i < 8; i++) LED[p + 'p' + (i + 1)] = [d === 1 ? 0x97 : 0x99, i]; // hot cue pad notes
  });
  LED.fxon = [0x94, 0x47];
  M.LED = LED;

  const ledState = {};
  M.led = function (id, on) {
    const v = on ? 0x7F : 0x00;
    if (ledState[id] === v) return;
    ledState[id] = v;
    const l = LED[id];
    if (!l || !M.output) return;
    try { M.output.send([l[0], l[1], v]); } catch (e) { /* device unplugged */ }
  };
  M.padLed = function (deck, i, mode, on) {
    const base = { hot: 0x00, fx: 0x10, jump: 0x20, samp: 0x30 }[mode] || 0;
    const st = deck === 1 ? 0x97 : 0x99;
    if (!M.output) return;
    const key = 'pad' + deck + mode + i, v = on ? 0x7F : 0;
    if (ledState[key] === v) return; ledState[key] = v;
    try { M.output.send([st, base + i, v]); } catch (e) { }
  };

  const msb = {}, lsb = {};
  M.shift = { 1: false, 2: false };

  function addLog(text) {
    M.log.unshift({ text, t: Date.now() });
    if (M.log.length > 40) M.log.length = 40;
  }

  function onMessage(e) {
    const [st, d1, d2] = e.data;
    if (st === undefined) return;
    const type = st & 0xF0;
    if (type !== 0x90 && type !== 0x80 && type !== 0xB0) return; // ignore clock/sysex
    const key = k(type === 0x80 ? (st | 0x10) : st, d1);
    const learned = CL.store.learned[key];
    let m = MAP[key];
    if (learned) m = { id: learned, type: type === 0xB0 ? 'cc7' : 'btn' };

    // learn mode: the control test is waiting for a specific control
    if (M.learnTarget && !m) {
      CL.store.learned[key] = M.learnTarget; CL.save();
      addLog('Learned ' + CL.controls[M.learnTarget].name + ' = ' + key.toUpperCase());
      m = { id: M.learnTarget, type: type === 0xB0 ? 'cc7' : 'btn' };
    }
    if (!m) {
      M.unknownCount++;
      addLog('Unknown message ' + key.toUpperCase() + ' (' + d2 + ')');
      CL.emit('midi-unknown', { key, value: d2 });
      return;
    }
    const id = m.id;
    if (m.type === 'btn') {
      const down = type === 0x90 && d2 > 0;
      if (id === 'd1shift' || id === 'd2shift') { M.shift[id === 'd1shift' ? 1 : 2] = down; }
      if (m.touch) { CL.jogTouch[id] = down; CL.emit('jog-touch', { id, down }); addLog((down ? 'Touch ' : 'Release ') + CL.controls[id].name); return; }
      if (m.press) { if (down) CL.emit('browse-press', {}); return; }
      CL.input(id, down, 'midi', { shift: !!m.shift, mode: m.mode, pad: !!m.pad, long: !!m.long, tempoRange: !!m.tempoRange });
      if (down) addLog((m.shift ? 'SHIFT + ' : '') + CL.controls[id].name + ' pressed');
    } else if (m.type === 'cc14') {
      if (m.part === 'msb') {
        msb[id] = d2;
        const v = ((d2 << 7) | (lsb[id] || 0)) / 16383;
        CL.input(id, v, 'midi');
      } else {
        lsb[id] = d2;
        if (msb[id] != null) CL.input(id, ((msb[id] << 7) | d2) / 16383, 'midi');
      }
      logThrottled(id);
    } else if (m.type === 'cc7') {
      CL.input(id, d2 / 127, 'midi'); logThrottled(id);
    } else if (m.type === 'rel') {
      const delta = d2 - 64;
      if (id === 'browse') { CL.emit('browse', { delta: d2 > 64 ? d2 - 128 : d2, shift: !!m.shift }); addLog('BROWSE ' + (d2 > 64 ? 'up' : 'down')); return; }
      CL.input(id, delta, 'midi', { top: !!m.top, side: !!m.side, shift: !!m.shift });
      logThrottled(id);
    }
  }
  const lastLog = {};
  function logThrottled(id) {
    const now = Date.now();
    if (lastLog[id] && now - lastLog[id] < 400) return;
    lastLog[id] = now;
    const c = CL.controls[id]; const v = CL.val[id];
    addLog(c.name + (typeof v === 'number' && c.kind !== 'jog' ? ' → ' + Math.round(v * 127) : ' moved'));
  }

  function pick(list) {
    const all = Array.from(list.values());
    return all.find(p => /flx4/i.test(p.name)) || all.find(p => /ddj/i.test(p.name)) || all.find(p => /pioneer/i.test(p.name)) || all[0] || null;
  }
  function connect() {
    const a = M.access;
    const inp = pick(a.inputs), out = pick(a.outputs);
    if (M.input && M.input !== inp) M.input.onmidimessage = null;
    M.input = inp; M.output = out;
    if (inp) {
      inp.onmidimessage = onMessage;
      M.status = 'connected'; M.name = inp.name;
      M.isFlx4 = /flx4/i.test(inp.name);
      Object.keys(ledState).forEach(k2 => delete ledState[k2]);
      addLog('Connected: ' + inp.name);
    } else {
      M.status = 'none'; M.name = ''; M.isFlx4 = false;
    }
    CL.emit('midi-status', M);
  }
  M.devices = () => M.access ? Array.from(M.access.inputs.values()).map(i => i.name) : [];

  M.start = async function () {
    if (!navigator.requestMIDIAccess) { M.status = 'unsupported'; CL.emit('midi-status', M); return; }
    try {
      M.access = await Promise.race([
        navigator.requestMIDIAccess({ sysex: false }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
      ]);
      M.access.onstatechange = () => connect();
      connect();
    } catch (e) {
      M.status = 'error'; M.error = String(e && e.message || e);
      CL.emit('midi-status', M);
    }
  };
})(window.CL);
