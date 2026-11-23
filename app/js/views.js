// CueLab screens: Home, Lessons, Practice Studio, Music Library, DDJ-FLX4, Study Mode.
'use strict';
(function (CL) {
  const h = s => CL.h(s), esc = CL.esc;
  CL.every = function (fn) { let on = true; const f = () => { if (!on) return; try { fn(); } catch (e) { console.error(e); } requestAnimationFrame(f); }; requestAnimationFrame(f); return () => { on = false; }; };
  const levelName = () => { const done = Object.keys(CL.store.done).length; return done < 10 ? 'Basic' : done < 20 ? 'Intermediate' : done < 30 ? 'Advanced' : 'Pro'; };

  // ======================= HOME =======================
  CL.views.home = function (main) {
    const cur = CL.lessonById(CL.store.current) || CL.lessons[0];
    const doneN = Object.keys(CL.store.done).length;
    const ok = CL.midi.status === 'connected';
    const sugg = ((cur.setup && [cur.setup.d1, cur.setup.d2]) || []).filter(Boolean).map(CL.tracks.byId).concat(CL.tracks.list.filter(t => t.source === 'gen').slice(0, 4)).filter((t, i, a) => a.indexOf(t) === i).slice(0, 4);
    const prog = Math.round((CL.store.stepsDone[cur.id] || 0) / (cur.steps.length + (cur.ready ? 1 : 0)) * 100);
    main.appendChild(h(`<div style="display:flex;justify-content:space-between;align-items:flex-end">
      <div class="col" style="gap:4px"><span class="sub">Welcome back</span><h1>${ok ? 'Your FLX4 is ready. Let\'s mix.' : 'Let\'s mix.'}</h1></div>
      <button class="btn primary" data-go="studio" style="height:48px;font-size:15px">Open Practice Studio</button></div>`));
    if (!ok) main.appendChild(h(`<div class="card amber" style="flex-direction:row;align-items:center;gap:14px"><span class="dot warn"></span><span class="txt" style="color:#F2E6D0;flex:1">Plug your DDJ-FLX4 into a USB port. No driver needed. You can also click and drag the controls on screen to try things without it.</span><button class="btn sm" data-go="flx4">Set up controller</button></div>`));
    main.appendChild(h(`<div class="row">${[['Current level', levelName()], ['Lessons done', doneN + ' / ' + CL.lessons.length], ['Practice this week', Math.floor(CL.weekMinutes() / 60) + 'h ' + Math.round(CL.weekMinutes() % 60) + 'm'], ['Day streak', CL.streak()]].map(([k, v]) => `<div class="card grow" style="gap:6px"><span class="small">${k}</span><span class="big" style="font-size:28px">${v}</span></div>`).join('')}</div>`));
    main.appendChild(h(`<div class="row" style="height:330px">
      <div class="card cyan" style="flex:2;background:linear-gradient(135deg,#12323B,#16181E);padding:26px;gap:14px">
        <span class="kicker k-cyan">CONTINUE · ${cur.tier.toUpperCase()} · LESSON ${cur.n}</span>
        <span class="big" style="font-size:32px">${esc(cur.title)}</span>
        <span class="txt" style="font-size:15px;max-width:820px">${esc(cur.why)}</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="chip">FLX4: ${esc(cur.uses)}</span><span class="chip">${cur.mins} min</span><span class="chip">${cur.steps.length} steps</span></div>
        <div class="bar" style="margin-top:auto"><div style="width:${prog}%"></div></div>
        <div style="display:flex;gap:10px"><button class="btn primary" data-lesson="${cur.id}">${prog ? 'Resume lesson' : 'Start lesson'}</button><button class="btn" data-go="lessons">All lessons</button></div>
      </div>
      <div class="card" style="flex:1;align-items:center;justify-content:center;gap:14px">
        <div style="align-self:stretch;display:flex;justify-content:space-between"><h3>Study mode</h3><span class="small" style="color:var(--amber)">Focus mix</span></div>
        <div style="width:150px;height:150px;border-radius:75px;border:9px solid #2A2D36;border-top-color:var(--amber);border-right-color:var(--amber);display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="big" style="font-size:32px">${CL.store.settings.studyFocus}:00</span><span class="small">Pomodoro</span></div>
        <span class="small" style="text-align:center">Free lo-fi tracks, auto-mixed on your decks while you study</span>
        <button class="btn" data-go="study" style="align-self:stretch;background:var(--amber-bg);color:var(--amber);border-color:var(--amber-line)">Start focus session</button>
      </div></div>`));
    main.appendChild(h(`<div class="col" style="gap:12px"><div style="display:flex;justify-content:space-between"><h3 style="margin:0;font-size:16px">Free practice tracks for this lesson</h3><a href="#" data-go="library" style="font-size:13px">Open library</a></div>
      <div class="row">${sugg.map((t, i) => `<div class="card grow" style="gap:8px"><div style="height:56px;border-radius:10px;background:linear-gradient(135deg,${['#3DD6F5,#12323B', '#FFB547,#3A2A10', '#8C7CF5,#1E1A3A', '#5BD68A,#14281D'][i % 4]})"></div>
        <b style="font-size:15px">${esc(t.title)}</b><span class="small">${esc(t.genre)} · ${t.bpm} BPM · ${t.key}</span>
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="lic">${t.license}</span><span style="display:flex;gap:6px"><button class="btn sm" data-load1="${t.id}" style="color:var(--cyan)">Deck 1</button><button class="btn sm" data-load2="${t.id}" style="color:var(--amber)">Deck 2</button></span></div></div>`).join('')}</div></div>`));
    main.querySelectorAll('[data-go]').forEach(b => b.onclick = e => { e.preventDefault(); CL.go(b.dataset.go); });
    main.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => CL.go('lesson', { id: b.dataset.lesson }));
    main.querySelectorAll('[data-load1],[data-load2]').forEach(b => b.onclick = () => { const n = b.dataset.load1 ? 1 : 2; CL.loadToDeck(n, CL.tracks.byId(b.dataset.load1 || b.dataset.load2)); });
    return {};
  };

  // ======================= LESSONS =======================
  CL.views.lessons = function (main) {
    const cur = CL.store.current;
    main.appendChild(h(`<div class="col" style="gap:6px"><h1>Lessons</h1><span class="sub">${CL.lessons.length} lessons in 4 levels, from switching on your FLX4 to a full 30-minute set. Each one: watch the app do it, learn why, do it yourself on your FLX4, then take the test.</span></div>`));
    const grid = h(`<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;flex:1;min-height:0"></div>`);
    const colors = { Basic: 'var(--amber)', Intermediate: 'var(--cyan)', Advanced: 'var(--violet)', Pro: 'var(--pink)' };
    CL.tiers.forEach(tier => {
      const ls = CL.lessons.filter(l => l.tier === tier), done = ls.filter(l => CL.store.done[l.id]).length;
      const col = h(`<div class="card" style="border-top:4px solid ${colors[tier]};gap:7px;padding:14px"><div style="display:flex;flex-direction:column;gap:2px;padding-bottom:4px"><span class="big" style="font-size:20px">${tier}</span><span class="small">${ls.length} lessons · ${done} passed</span></div></div>`);
      ls.forEach(l => {
        const sc = CL.store.done[l.id];
        const b = h(`<button class="lesson${sc ? ' done' : ''}${l.id === cur ? ' now' : ''}"><span class="n">${l.n}</span><span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:13px;font-weight:600">${esc(l.title)}</span><span class="small" style="font-size:11px">FLX4: ${esc(l.uses)}</span></span><span class="small" style="font-size:11px;flex-shrink:0">${sc ? '★ ' + sc : l.mins + 'm'}</span></button>`);
        b.onclick = () => CL.go('lesson', { id: l.id });
        col.appendChild(b);
      });
      grid.appendChild(col);
    });
    main.appendChild(grid);
    return {};
  };

  // ======================= PRACTICE STUDIO =======================
  CL.views.studio = function (main) {
    CL.audio.init();
    if (!CL.audio.decks[1].track) CL.audio.load(1, CL.tracks.byId('warm'));
    if (!CL.audio.decks[2].track) CL.audio.load(2, CL.tracks.byId('ferry'));
    CL.setBrowseList(CL.tracks.list);
    const head = h(`<div style="display:flex;justify-content:space-between;align-items:center"><h1>Practice Studio</h1>
      <div style="display:flex;gap:10px;align-items:center"><span class="small fxs" style="font-size:13px"></span><span class="small mid" style="font-size:14px"></span><button class="btn pink rec">● Record mix</button></div></div>`);
    main.appendChild(head);
    const s1 = CL.deckStrip(1, { h: 70, span: 10 }), s2 = CL.deckStrip(2, { h: 70, span: 10 });
    const strips = h(`<div class="row"></div>`); strips.appendChild(s1.el); strips.appendChild(s2.el); main.appendChild(strips);
    const body = h(`<div class="row grow"><div class="left" style="width:990px;flex-shrink:0;display:flex;flex-direction:column;gap:12px"></div><div class="col grow right"></div></div>`);
    main.appendChild(body);
    const panel = CL.panelBox(body.querySelector('.left'), 0.9);
    body.querySelector('.left').appendChild(h(`<span class="small">Tip: no controller? Click buttons, drag knobs up/down, drag faders, and drag the jog wheels on screen. Double-click a knob to reset it.</span>`));
    const right = body.querySelector('.right');
    const coach = h(`<div class="card pink"><span class="kicker k-pink">PHRASE COACH</span><span class="big coach-t">Load two tracks to start</span><span class="txt coach-s" style="color:#E2C9D6"></span></div>`);
    right.appendChild(coach);
    const lib = h(`<div class="card" style="flex:1 1 0;min-height:0;padding:12px 14px"><div style="display:flex;justify-content:space-between"><h3>Tracks</h3><span class="small">Turn BROWSE, press LOAD 1 / LOAD 2</span></div></div>`);
    const tl = CL.trackList({ cols: 'minmax(0,2fr) minmax(0,1fr) 40px 36px 48px 96px' }); lib.appendChild(tl.el); right.appendChild(lib);
    const health = h(`<div class="card"><h3>Mix health</h3><div class="hl col" style="gap:6px"></div></div>`); right.appendChild(health);
    const rec = head.querySelector('.rec');
    rec.onclick = () => { if (CL.audio.rec) CL.audio.stopRecording(); else CL.audio.startRecording(); };
    const stop = CL.every(() => {
      s1.update(); s2.update();
      const A = CL.audio; if (!A.ready) return;
      const d1 = A.decks[1], d2 = A.decks[2];
      rec.textContent = A.rec ? '■ Stop recording ' + CL.fmtTime((Date.now() - A.rec.t0) / 1000) : '● Record mix';
      head.querySelector('.fxs').textContent = 'BEAT FX: ' + A.fxName() + ' · ' + A.fxBeats() + ' beat · CH ' + A.fxChName() + (A.fx.on ? ' · ON' : '');
      head.querySelector('.mid').innerHTML = CL.midi.status === 'connected' ? '<span style="color:var(--green)">● DDJ-FLX4 live</span>' : '<span style="color:var(--amber)">● Mouse mode</span>';
      const ref = d1.playing ? d1 : d2.playing ? d2 : null;
      if (ref && ref.track) {
        const bi = ref.beatInfo(), bar = Math.max(1, bi.bar), next = Math.ceil(bar / 16) * 16 + 1, beatsTo = (next - 1) * 4 - Math.floor(bi.beatIndex);
        coach.querySelector('.coach-t').textContent = 'Deck ' + ref.n + ' · bar ' + bar + '.' + bi.beatInBar;
        coach.querySelector('.coach-s').textContent = 'Next phrase starts at bar ' + next + ' (in ' + beatsTo + ' beats) — the best moment to start or swap.' + (beatsTo <= 4 ? '   ' + ['', '1…', '2…', '3…', '4…'][beatsTo] : '');
      } else { coach.querySelector('.coach-t').textContent = 'Press PLAY on a deck'; coach.querySelector('.coach-s').textContent = 'The coach counts bars and tells you when the next phrase starts.'; }
      const rows = [];
      if (d1.track && d2.track) {
        const bd = Math.abs(d1.bpm - d2.bpm);
        rows.push(['BPM match', bd < 0.1 ? 'Matched' : bd.toFixed(1) + ' apart', bd < 0.1 ? 'var(--green)' : bd < 1 ? 'var(--amber)' : '#FF6B6B']);
        if (d1.playing && d2.playing) { let ph = d1.beatInfo().phase - d2.beatInfo().phase; if (ph > 0.5) ph -= 1; if (ph < -0.5) ph += 1; const ms = Math.abs(ph) * 60 / d1.bpm * 1000; rows.push(['Beats in phase', '±' + Math.round(ms) + ' ms', ms < 15 ? 'var(--green)' : ms < 40 ? 'var(--amber)' : '#FF6B6B']); }
        rows.push(['Keys', d1.track.key + ' → ' + d2.track.key + (CL.camOk(d1.track.key, d2.track.key) ? ' · fits' : ' · may clash'), CL.camOk(d1.track.key, d2.track.key) ? 'var(--green)' : 'var(--amber)']);
      }
      const lv = A.levels.master; rows.push(['Master level', lv > 0.5 ? 'Too hot — turn TRIM down' : lv > 0.05 ? 'Good' : 'Quiet', lv > 0.5 ? '#FF6B6B' : 'var(--green)']);
      const html = rows.map(r => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span>${r[0]}</span><span style="color:${r[2]};font-weight:600">${r[1]}</span></div>`).join('');
      if (health.querySelector('.hl').innerHTML !== html) health.querySelector('.hl').innerHTML = html;
    });
    return { destroy() { stop(); tl.destroy(); } };
  };

  // ======================= LIBRARY =======================
  CL.views.library = function (main) {
    let filter = 'All', q = '';
    const head = h(`<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px">
      <div class="col" style="gap:6px"><h1>Free music library</h1><span class="sub">The CueLab Practice Pack is made by the app and free to use (CC0). Add your own music too — it stays on this PC.</span></div>
      <div style="display:flex;gap:10px;align-items:flex-end">
        <label class="col" style="gap:6px;font-size:12px;color:var(--dim)">Search<input class="inp q" placeholder="Title, genre, BPM, key…" style="width:280px"></label>
        <button class="btn primary imp">+ Add your music</button><input type="file" class="file" accept="audio/*" multiple style="display:none"></div></div>`);
    main.appendChild(head);
    main.appendChild(h(`<div class="card cyan" style="flex-direction:row;align-items:center;gap:12px;padding:12px 16px"><span class="dot ok"></span><span class="txt" style="color:var(--dim2)">On your FLX4: turn <b>BROWSE</b> to move through this list, then press <b>LOAD 1</b> or <b>LOAD 2</b>. Export any practice track as a WAV file to use it in rekordbox or Serato too.</span></div>`));
    const chips = h(`<div style="display:flex;gap:8px;flex-wrap:wrap"></div>`); main.appendChild(chips);
    const box = h(`<div class="card" style="flex:1 1 0;min-height:0;padding:8px 18px 12px"><div class="trow" style="grid-template-columns:minmax(0,2fr) minmax(0,1.4fr) minmax(0,1fr) 70px 60px 70px 90px 220px;border-top:none;color:var(--dim);font-size:12px"><span>Title</span><span>Artist / source</span><span>Genre</span><span>BPM</span><span>Key</span><span>Length</span><span>License</span><span>Load / export</span></div><div class="rows scroll" style="flex:1 1 0;min-height:0;display:flex;flex-direction:column"></div></div>`);
    main.appendChild(box);
    const status = h(`<span class="small"></span>`); main.appendChild(status);
    const cats = ['All', 'House', 'Deep House', 'Tech House', 'Hip-hop', 'Drum & Bass', 'Lo-fi', 'Scratch tool', 'Your music'];
    function list() {
      return CL.tracks.list.filter(t => (filter === 'All' || t.genre === filter) && (!q || (t.title + ' ' + t.genre + ' ' + t.bpm + ' ' + t.key).toLowerCase().indexOf(q) >= 0));
    }
    function render() {
      chips.innerHTML = cats.map(c => `<button class="pill${c === filter ? ' on' : ''}" data-c="${c}">${c}</button>`).join('');
      chips.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { filter = b.dataset.c; CL.browse.idx = 0; render(); });
      CL.setBrowseList(list());
    }
    function rows() {
      const B = CL.browse;
      box.querySelector('.rows').innerHTML = B.list.map((t, i) => `<div class="trow${i === B.idx ? ' sel' : ''}" data-i="${i}" style="grid-template-columns:minmax(0,2fr) minmax(0,1.4fr) minmax(0,1fr) 70px 60px 70px 90px 220px">
        <span style="font-weight:600">${esc(t.title)}</span><span style="color:var(--dim2)">${esc(t.artist)}</span><span style="color:var(--dim)">${esc(t.genre)}</span>
        <span>${t.bpm}</span><span>${esc(t.key)}</span><span style="color:var(--dim)">${CL.fmtTime(t.length)}</span><span><span class="lic">${esc(t.license)}</span></span>
        <span style="display:flex;gap:6px"><button class="btn sm" data-l="1" style="color:var(--cyan)">Deck 1</button><button class="btn sm" data-l="2" style="color:var(--amber)">Deck 2</button>${t.source === 'gen' ? '<button class="btn sm" data-x title="Export WAV">WAV</button>' : '<button class="btn sm" data-del title="Remove">✕</button>'}</span></div>`).join('') || '<div class="txt" style="padding:20px">No tracks here yet.</div>';
      box.querySelectorAll('.trow[data-i]').forEach(r => r.onclick = async e => {
        const i = +r.dataset.i, t = CL.browse.list[i]; CL.browse.idx = i;
        const l = e.target.closest('[data-l]'), x = e.target.closest('[data-x]'), del = e.target.closest('[data-del]');
        if (l) CL.loadToDeck(+l.dataset.l, t);
        if (x) { status.textContent = 'Exporting ' + t.title + '…'; await CL.tracks.exportWav(t); status.textContent = 'Saved "' + t.title + '" as a WAV file in your Downloads.'; }
        if (del) { await CL.tracks.remove(t.id); render(); }
        rows();
      });
      const sel = box.querySelector('.trow.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
    }
    CL.browse.listeners.add(rows);
    head.querySelector('.q').oninput = e => { q = e.target.value.toLowerCase(); CL.browse.idx = 0; render(); };
    const fi = head.querySelector('.file');
    head.querySelector('.imp').onclick = () => fi.click();
    fi.onchange = async () => { const added = await CL.tracks.importFiles(fi.files, s => status.textContent = s); status.textContent = added.length ? 'Added ' + added.length + ' track(s). BPM found automatically — you can change it in Practice Studio.' : status.textContent; filter = 'Your music'; render(); fi.value = ''; };
    const off = CL.on('library', () => render());
    render();
    return { destroy() { CL.browse.listeners.delete(rows); off(); } };
  };

  // ======================= DDJ-FLX4 =======================
  CL.views.flx4 = function (main) {
    CL.audio.init();
    const TEST = ['d1play', 'd1cue', 'd1sync', 'd1tempo', 'd1jog', 'd1in', 'd1out', 'd1exit', 'd1mHot', 'd1p1', 'trim1', 'hi1', 'mid1', 'low1', 'cfx1', 'hcue1', 'fader1', 'xfader', 'browse', 'load1', 'load2', 'fader2', 'hcue2', 'cfx2', 'low2', 'mid2', 'hi2', 'trim2', 'd2play', 'd2cue', 'd2sync', 'd2tempo', 'd2jog', 'd2in', 'd2out', 'd2exit', 'd2mHot', 'd2p1', 'hpmix', 'fxsel', 'fxbL', 'fxbR', 'fxlevel', 'fxon'];
    let ti = -1; const tested = new Set();
    const head = h(`<div style="display:flex;justify-content:space-between;align-items:center"><div class="col" style="gap:4px"><h1>Pioneer DJ DDJ-FLX4</h1><span class="sub">Plug-and-play on Windows — no driver needed. Every control below mirrors your real controller.</span></div><div class="chips" style="display:flex;gap:8px"></div></div>`);
    main.appendChild(head);
    const test = h(`<div class="card pink" style="flex-direction:row;align-items:center;gap:16px;padding:14px 18px"><span class="kicker k-pink">CONTROL TEST</span><span class="tt" style="font-size:17px;font-weight:600;flex:1">Check every control works</span><span class="small tc" style="font-size:13px"></span><div class="bar" style="width:200px;background:#3A2030"><div class="tb" style="width:0;background:var(--pink)"></div></div><button class="btn pink tbtn">Start test</button><button class="btn pink tskip" style="display:none">Skip</button></div>`);
    main.appendChild(test);
    const body = h(`<div class="row grow"><div class="left" style="width:990px;flex-shrink:0"></div><div class="col grow right"></div></div>`); main.appendChild(body);
    const panel = CL.panelBox(body.querySelector('.left'), 0.9);
    const right = body.querySelector('.right');
    const log = h(`<div class="card" style="flex:1 1 0;min-height:0"><h3>Live signal log</h3><div class="lg scroll mono" style="flex:1 1 0;min-height:0;font-size:12px;color:var(--dim2);display:flex;flex-direction:column;gap:4px"></div></div>`);
    right.appendChild(log);
    const audio = h(`<div class="card"><h3>Audio</h3>
      <label class="col" style="gap:6px;font-size:13px;color:var(--dim2)">Output device (choose your DDJ-FLX4 for speakers + headphones)<select class="inp out"></select></label>
      <label style="display:flex;gap:10px;align-items:center;font-size:13px"><input type="checkbox" class="c34"> Headphone cue on outputs 3–4 (FLX4 headphones jack)</label>
      <label style="display:flex;gap:10px;align-items:center;font-size:13px"><input type="checkbox" class="inv"> Reverse the TEMPO sliders</label>
      <span class="small rt"></span></div>`);
    right.appendChild(audio);
    const tools = h(`<div class="card"><h3>Also use with your DJ software</h3><span class="txt" style="font-size:13px">Export practice tracks as WAV files from the Music Library and add them to rekordbox or Serato. Close CueLab before opening another DJ app, so the FLX4 isn't shared by two apps.</span><div style="display:flex;gap:8px"><button class="btn sm rescan">Rescan USB</button><button class="btn sm forget">Forget learned controls</button></div></div>`);
    right.appendChild(tools);
    async function fillOutputs() {
      const outs = await CL.audio.outputs(), sel = audio.querySelector('.out'), cur = CL.store.settings.sinkId;
      sel.innerHTML = `<option value="">Windows default output</option>` + outs.filter(o => o.deviceId !== 'default').map(o => `<option value="${esc(o.deviceId)}"${o.deviceId === cur ? ' selected' : ''}>${esc(o.label || 'Audio output')}</option>`).join('');
      if (!cur) { const flx = outs.find(o => /flx4|ddj/i.test(o.label)); if (flx) { sel.value = flx.deviceId; CL.audio.setOutput(flx.deviceId); } }
    }
    fillOutputs();
    audio.querySelector('.out').onchange = e => CL.audio.setOutput(e.target.value);
    const c34 = audio.querySelector('.c34'), inv = audio.querySelector('.inv');
    c34.checked = CL.store.settings.cueToOut34; inv.checked = CL.store.settings.invertTempo;
    c34.onchange = () => { CL.store.settings.cueToOut34 = c34.checked; CL.save(); CL.audio.route(); };
    inv.onchange = () => { CL.store.settings.invertTempo = inv.checked; CL.save(); };
    tools.querySelector('.rescan').onclick = () => { CL.midi.start(); CL.toast('Looking for your controller…'); };
    tools.querySelector('.forget').onclick = () => { CL.store.learned = {}; CL.save(); CL.toast('Learned controls cleared'); };
    function setTarget(i) {
      ti = i; const id = TEST[i];
      CL.midi.learnTarget = id || null;
      if (!id) { panel.setGuide({ ok: Array.from(tested) }); test.querySelector('.tt').textContent = 'Test finished — ' + tested.size + ' of ' + TEST.length + ' controls OK'; test.querySelector('.tbtn').textContent = 'Test again'; test.querySelector('.tskip').style.display = 'none'; return; }
      const c = CL.controls[id], verb = c.kind === 'button' || c.kind === 'pad' ? 'Press' : c.kind === 'jog' ? 'Turn' : c.kind === 'encoder' ? 'Turn' : c.kind === 'knob' ? 'Turn' : 'Move';
      test.querySelector('.tt').textContent = verb + ' ' + c.name;
      test.querySelector('.tskip').style.display = '';
      panel.setGuide({ hl: [id], ok: Array.from(tested), arrows: { [id]: c.kind === 'button' || c.kind === 'pad' ? 'press' : c.kind === 'jog' || c.kind === 'encoder' ? 'spin' : c.kind === 'knob' ? 'right' : 'up' } });
    }
    test.querySelector('.tbtn').onclick = () => { tested.clear(); setTarget(0); };
    test.querySelector('.tskip').onclick = () => setTarget(ti + 1);
    const offs = [
      CL.on('control', e => { if (ti >= 0 && TEST[ti] === e.id && e.src !== 'demo') { tested.add(e.id); setTarget(ti + 1); } }),
      CL.on('jog-touch', e => { if (ti >= 0 && TEST[ti] === e.id) { tested.add(e.id); setTarget(ti + 1); } }),
      CL.on('browse', () => { if (ti >= 0 && TEST[ti] === 'browse') { tested.add('browse'); setTarget(ti + 1); } })
    ];
    const stop = CL.every(() => {
      const M = CL.midi, ok = M.status === 'connected';
      const chips = [[ok ? 'USB MIDI connected' : M.status === 'searching' ? 'Searching…' : M.status === 'unsupported' ? 'MIDI not available' : 'Controller not found', ok], [CL.audio.fourCh ? 'Headphone cue on out 3–4' : 'Stereo output only', CL.audio.fourCh], [M.output ? 'Lights OK' : 'Lights off', !!M.output]];
      const ch = chips.map(([t, g]) => `<span style="display:flex;align-items:center;gap:6px;font-size:13px;padding:8px 12px;border-radius:999px;background:${g ? 'var(--green-bg)' : 'var(--amber-bg)'};color:${g ? 'var(--green)' : 'var(--amber)'};font-weight:600"><span class="dot ${g ? 'ok' : 'warn'}"></span>${t}</span>`).join('');
      const he = head.querySelector('.chips'); if (he.innerHTML !== ch) he.innerHTML = ch;
      test.querySelector('.tc').textContent = ti >= 0 ? tested.size + ' of ' + TEST.length + ' tested' : (ok ? 'Device: ' + M.name : 'Connect the FLX4 by USB');
      test.querySelector('.tb').style.width = (tested.size / TEST.length * 100) + '%';
      const lg = M.log.slice(0, 14).map(l => `<div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:4px"><span>${esc(l.text)}</span><span style="color:var(--dim)">${new Date(l.t).toLocaleTimeString()}</span></div>`).join('') || '<span class="small">Move anything on your FLX4 — it shows up here.</span>';
      const le = log.querySelector('.lg'); if (le.innerHTML !== lg) le.innerHTML = lg;
      audio.querySelector('.rt').textContent = CL.audio.fourCh ? 'Speakers: outputs 1–2 · Headphones: outputs 3–4' : 'This output has 2 channels: headphone cue needs the FLX4 selected above.';
    });
    return { destroy() { stop(); offs.forEach(f => f()); CL.midi.learnTarget = null; } };
  };

  // ======================= STUDY MODE =======================
  const study = CL.study = { running: false, phase: 'focus', left: 0, auto: false, timer: null };
  CL.views.study = function (main) {
    CL.audio.init();
    const S = CL.store.settings;
    if (!study.running && !study.left) study.left = S.studyFocus * 60;
    main.appendChild(h(`<div style="display:flex;justify-content:space-between;align-items:center"><div class="col" style="gap:4px"><h1>Study mode</h1><span class="sub">A focus timer with free lo-fi tracks mixed on your decks. Take a DJ break between sessions.</span></div></div>`));
    const body = h(`<div class="row grow">
      <div class="card" style="flex:1.2;align-items:center;justify-content:center;gap:22px">
        <span class="kicker ph k-amber">FOCUS</span>
        <svg width="380" height="380" viewBox="0 0 380 380"><circle cx="190" cy="190" r="170" fill="none" stroke="#2A2D36" stroke-width="18"/><circle class="arc" cx="190" cy="190" r="170" fill="none" stroke="#FFB547" stroke-width="18" stroke-linecap="round" transform="rotate(-90 190 190)" stroke-dasharray="1068" stroke-dashoffset="0"/><text class="tm" x="190" y="205" text-anchor="middle" fill="#F2F3F5" font-size="80" font-family="Bahnschrift, Segoe UI" font-weight="700">25:00</text><text class="tl" x="190" y="250" text-anchor="middle" fill="#A3A8B4" font-size="18" font-family="Segoe UI">session 1</text></svg>
        <div style="display:flex;gap:10px"><button class="btn primary go" style="height:52px;padding:0 30px;font-size:16px">Start</button><button class="btn rs" style="height:52px">Reset</button><button class="btn sk" style="height:52px">Skip to break</button></div>
        <div style="display:flex;gap:14px;align-items:center;font-size:13px;color:var(--dim2)">Focus <select class="inp f">${[15, 20, 25, 30, 45, 50].map(m => `<option${m === S.studyFocus ? ' selected' : ''}>${m}</option>`).join('')}</select> min · Break <select class="inp b">${[5, 10, 15].map(m => `<option${m === S.studyBreak ? ' selected' : ''}>${m}</option>`).join('')}</select> min</div>
      </div>
      <div class="col" style="flex:1">
        <div class="card"><h3>Lo-fi auto mix</h3><span class="txt np">Press Start to begin the music.</span>
          <label style="display:flex;gap:10px;align-items:center;font-size:13px">Volume <input type="range" class="vol" min="0" max="1" step="0.01" value="${S.studyVolume}" style="flex:1"></label>
          <label style="display:flex;gap:10px;align-items:center;font-size:13px"><input type="checkbox" class="am" checked> Mix tracks automatically (the decks move by themselves)</label></div>
        <div class="card"><h3>Sessions</h3><span class="big ss">${CL.store.studySessions}</span><span class="small">focus sessions finished</span></div>
        <div class="card cyan"><h3>Break idea</h3><span class="txt">On your break, try one quick drill: Practice Studio → start Deck 2 on the next phrase.</span><button class="btn sm" data-go="studio" style="align-self:flex-start">Open Practice Studio</button></div>
      </div></div>`);
    main.appendChild(body);
    const q = s => body.querySelector(s);
    q('.f').onchange = e => { S.studyFocus = +e.target.value; CL.save(); if (!study.running && study.phase === 'focus') study.left = S.studyFocus * 60; };
    q('.b').onchange = e => { S.studyBreak = +e.target.value; CL.save(); };
    q('.vol').oninput = e => { S.studyVolume = +e.target.value; CL.save(); if (study.running) CL.audio.out.gain.value = 0.9 * S.studyVolume; };
    q('.go').onclick = () => { study.running ? pause() : start(); };
    q('.rs').onclick = () => { pause(); study.phase = 'focus'; study.left = S.studyFocus * 60; };
    q('.sk').onclick = () => { study.left = 0; };
    q('[data-go]').onclick = () => CL.go('studio');
    function start() {
      study.running = true; CL.audio.resume(); CL.audio.out.gain.value = 0.9 * S.studyVolume;
      study.auto = q('.am').checked;
      if (study.auto) autoMix.start();
      clearInterval(study.timer);
      study.timer = setInterval(() => {
        study.left -= 1;
        if (study.left <= 0) {
          if (study.phase === 'focus') { CL.store.studySessions++; CL.save(); study.phase = 'break'; study.left = S.studyBreak * 60; CL.toast('Break time! Stretch, drink water, or try a quick DJ drill.'); }
          else { study.phase = 'focus'; study.left = S.studyFocus * 60; CL.toast('Back to focus.'); }
        }
      }, 1000);
    }
    function pause() { study.running = false; clearInterval(study.timer); autoMix.stop(); CL.audio.out.gain.value = 0.9; }
    const stop = CL.every(() => {
      const total = (study.phase === 'focus' ? S.studyFocus : S.studyBreak) * 60;
      q('.tm').textContent = CL.fmtTime(study.left);
      q('.arc').setAttribute('stroke-dashoffset', String(1068 * (1 - study.left / total)));
      q('.arc').setAttribute('stroke', study.phase === 'focus' ? '#FFB547' : '#5BD68A');
      q('.ph').textContent = study.phase === 'focus' ? 'FOCUS' : 'BREAK';
      q('.tl').textContent = 'session ' + (CL.store.studySessions + 1);
      q('.go').textContent = study.running ? 'Pause' : 'Start';
      q('.ss').textContent = CL.store.studySessions;
      const A = CL.audio, live = A.decks[autoMix.live];
      q('.np').textContent = study.running && live && live.track ? 'Now playing: ' + live.track.title + ' · ' + Math.round(live.bpm) + ' BPM · Deck ' + autoMix.live : study.running ? 'Starting the music…' : 'Press Start to begin the music.';
    });
    return { destroy() { stop(); } };
  };

  // simple auto-DJ for study mode: plays lo-fi tracks, blends 8 bars before the end
  const autoMix = {
    live: 1, busy: false, t: null, idx: 0,
    pool() { return CL.tracks.list.filter(t => t.style === 'lofi'); },
    async start() {
      const A = CL.audio; this.stopFlag = false;
      if (!A.decks[1].playing && !A.decks[2].playing) {
        const t = this.pool()[this.idx++ % this.pool().length];
        await A.load(1, t); this.live = 1;
        CL.input('fader1', 1, 'demo'); CL.input('xfader', 0, 'demo'); CL.input('fader2', 1, 'demo');
        A.decks[1].play();
      }
      clearInterval(this.t);
      this.t = setInterval(() => this.check(), 500);
    },
    stop() { clearInterval(this.t); this.stopFlag = true; [1, 2].forEach(n => CL.audio.decks[n].pause()); },
    async check() {
      const A = CL.audio, d = A.decks[this.live];
      if (this.busy || !d.track || !d.playing) return;
      const left = d.duration - d.getPos(), barSec = 4 * 60 / d.bpm;
      if (left > barSec * 9) return;
      this.busy = true;
      const other = this.live === 1 ? 2 : 1, t = this.pool()[this.idx++ % this.pool().length];
      await A.load(other, t);
      A.matchTempo(A.decks[other]);
      A.decks[other].play();
      const from = this.live === 1 ? 0 : 1, to = 1 - from, t0 = performance.now(), dur = barSec * 8 * 1000;
      const step = () => { if (this.stopFlag) return; const k = Math.min(1, (performance.now() - t0) / dur); CL.input('xfader', from + (to - from) * k, 'demo'); if (k < 1) setTimeout(step, 60); else { d.pause(); const nd = A.decks[other]; nd.pitch = 0; nd.setRate(); this.live = other; this.busy = false; } };
      step();
    }
  };
  CL.autoMix = autoMix;
})(window.CL);
