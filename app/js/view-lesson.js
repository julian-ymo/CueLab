// CueLab lesson screen: Watch → Learn why → Do it → Test, all on one screen.
'use strict';
(function (CL) {
  const h = s => CL.h(s), esc = CL.esc;
  const STAGES = [['watch', '1 Watch'], ['learn', '2 Learn why'], ['do', '3 Do it'], ['test', '4 Test']];

  CL.views.lesson = function (main, params) {
    const lesson = CL.lessonById(params.id) || CL.lessons[0];
    CL.audio.init();
    CL.store.current = lesson.id; CL.save();
    const run = new CL.LessonRun(lesson); CL.currentRun = run;
    let stage = params.stage || (CL.store.stepsDone[lesson.id] ? 'do' : 'learn');
    if (lesson.showList) CL.setBrowseList(CL.tracks.list);

    // ---------- skeleton ----------
    const head = h(`<div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div class="col" style="gap:4px"><span class="crumb">Lessons › ${lesson.tier} › Lesson ${lesson.n}</span><h1>${esc(lesson.title)}</h1></div>
      <div style="display:flex;gap:10px;align-items:center"><div class="tabs">${STAGES.map(([k, t]) => `<button data-stage="${k}">${t}</button>`).join('')}</div>
      <button class="btn slow">Slow mode</button><button class="btn restart">Restart</button></div></div>`);
    main.appendChild(head);
    head.querySelector('.crumb').onclick = () => CL.go('lessons');
    const stepper = h(`<div class="stepper"></div>`); main.appendChild(stepper);
    const body = h(`<div class="row grow"><div class="left" style="width:990px;flex-shrink:0;display:flex;flex-direction:column;gap:16px"><div class="topcard" style="height:270px;flex-shrink:0;display:flex;gap:16px;overflow:hidden"></div><div class="pbox"></div></div><div class="col grow right" style="min-height:0"></div></div>`);
    main.appendChild(body);
    const top = body.querySelector('.topcard'), right = body.querySelector('.right');
    const panel = CL.panelBox(body.querySelector('.pbox'), 0.9);
    let overlay = null;

    head.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => setStage(b.dataset.stage));
    head.querySelector('.restart').onclick = () => setStage(stage);
    head.querySelector('.slow').onclick = () => { CL.audio.setSlow(!CL.audio.slowMode); };

    // ---------- stage switching ----------
    function setStage(s) {
      stage = s; run.begin(s); renderTop(); sig = ''; render();
      head.querySelectorAll('[data-stage]').forEach(b => b.classList.toggle('on', b.dataset.stage === s));
    }

    // ---------- top-left card ----------
    let strips = [];
    function renderTop() {
      top.innerHTML = ''; strips = [];
      if (stage === 'learn') {
        top.appendChild(h(`<div class="card" style="flex:1.3"><h3>Why this lesson</h3><span class="txt" style="font-size:15px">${esc(lesson.why)}</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:auto"><span class="chip">FLX4: ${esc(lesson.uses)}</span><span class="chip">${lesson.mins} min</span><span class="chip">${lesson.steps.length} steps</span></div></div>`));
        top.appendChild(h(`<div class="card" style="flex:1"><h3>Key words</h3>${(lesson.words || []).map(w => `<div class="col" style="gap:2px"><span style="font-size:13px;font-weight:700;color:var(--amber)">${esc(w[0])}</span><span style="font-size:13px;color:var(--dim2);line-height:1.4">${esc(w[1])}</span></div>`).join('') || '<span class="small">—</span>'}</div>`));
      } else if (stage === 'watch') {
        top.appendChild(h(`<div class="card cyan" style="flex:1;padding:20px 22px"><span class="kicker k-cyan wk">THE APP IS DOING IT</span><span class="big wt" style="font-size:28px"></span><span class="txt wx" style="font-size:15px;color:#D6EEF4"></span>
          <div style="display:flex;gap:10px;margin-top:auto"><button class="btn wp">Pause</button><button class="btn wr">Watch again</button><button class="btn primary wd">Now you try: Do it →</button></div></div>`));
        top.querySelector('.wp').onclick = () => { run.demoPaused = !run.demoPaused; top.querySelector('.wp').textContent = run.demoPaused ? 'Resume' : 'Pause'; };
        top.querySelector('.wr').onclick = () => setStage('watch');
        top.querySelector('.wd').onclick = () => setStage('do');
      } else {
        const s1 = CL.deckStrip(1, { h: 44 }), s2 = CL.deckStrip(2, { h: 44 });
        const col = h(`<div class="col" style="flex:1;gap:10px;overflow:hidden"></div>`); col.appendChild(s1.el); col.appendChild(s2.el); top.appendChild(col);
        strips = [s1, s2];
      }
    }

    // ---------- right column + stepper (rebuilt when the step/state changes) ----------
    let sig = '', closeP = null, listW = null;
    function signature() {
      const s = run.step, st = run.st || {};
      return [stage, run.loading, run.done, run.i, st.complete ? 1 : 0, st.wrong ? st.wrong.id + st.wrong.putBack : '', st.wrongWay ? 1 : 0, st.hint, run.options, st.note, st.count, run.demoPhase, run.demoReveal, run.result ? run.result.score : '', st.extra && st.extra.reset].join('|');
    }
    function render() {
      const sg = signature();
      if (sg === sig) return; sig = sg;
      // stepper
      if (stage === 'learn') stepper.innerHTML = '';
      else {
        const n = run.steps.length;
        stepper.style.gridTemplateColumns = `repeat(${Math.max(1, n)}, minmax(0,1fr))`;
        const skipped = CL.store.practiceLater[lesson.id] || [];
        stepper.innerHTML = run.steps.map((s, i) => `<div class="s ${i < run.i || run.done ? 'done' : i === run.i ? 'now' : ''}${skipped.indexOf(i) >= 0 && i < run.i ? ' skip' : ''}"><i></i>${i + 1} · ${esc(s.title)}</div>`).join('');
      }
      right.innerHTML = ''; closeP = null; if (listW) { listW.destroy(); listW = null; }
      if (overlay) { overlay.remove(); overlay = null; }
      if (stage === 'learn') return renderLearnRight();
      if (run.loading) { right.appendChild(h(`<div class="card"><h3>Getting your decks ready…</h3><span class="txt">Loading the practice tracks for this lesson.</span></div>`)); return; }
      if (run.done && stage === 'watch') {
        right.appendChild(h(`<div class="card green"><span class="kicker k-green">DEMO FINISHED</span><span class="big">Now it's your turn</span><span class="txt">Do the same moves on your FLX4. The app guides you step by step and tells you if something's off.</span><div style="display:flex;gap:10px"><button class="btn primary go-do">Do it</button><button class="btn go-learn">Learn why first</button></div></div>`));
        right.querySelector('.go-do').onclick = () => setStage('do'); right.querySelector('.go-learn').onclick = () => setStage('learn');
        return;
      }
      if (run.done && stage === 'do') {
        const pl = (CL.store.practiceLater[lesson.id] || []).length;
        right.appendChild(h(`<div class="card green"><span class="kicker k-green">ALL STEPS DONE</span><span class="big">Nice work!</span><span class="txt">${pl ? 'You skipped ' + pl + ' step(s) — they\'re saved to practise. ' : ''}Ready to take the test? No hints this time: you\'re scored on accuracy, timing and flow.</span><div style="display:flex;gap:10px"><button class="btn primary go-test">Take the test</button><button class="btn again">Do it again</button><button class="btn studio">Free practice</button></div></div>`));
        right.querySelector('.go-test').onclick = () => setStage('test'); right.querySelector('.again').onclick = () => setStage('do'); right.querySelector('.studio').onclick = () => CL.go('studio');
        mistakesCard();
        return;
      }
      if (run.done && stage === 'test') return renderResult();
      const s = run.step; if (!s) return;
      if (stage === 'watch') return renderWatchRight(s);
      renderStepCard(s);
      if (run.st.wrong) renderWrong();
      else if (run.st.wrongWay) right.appendChild(h(`<div class="card orange" style="flex-direction:row;gap:12px;align-items:center"><span style="width:30px;height:30px;border-radius:15px;background:var(--orange);color:#1A1206;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">↺</span><span class="txt" style="color:#F2E6D0">${esc(run.st.wrongWay.text)}</span></div>`));
      if (stage === 'do' && run.st.hint >= 1 && !run.st.complete) renderHint(s);
      if (lesson.showList && /browse|load|compatKey|transitions|setExam/.test(s.c.t)) { const c = h(`<div class="card" style="flex:1 1 0;min-height:160px;padding:10px 14px"><div style="display:flex;justify-content:space-between"><h3>Tracks</h3><span class="small">BROWSE + LOAD</span></div></div>`); listW = CL.trackList({ cols: 'minmax(0,2fr) minmax(0,1fr) 40px 36px 48px 96px' }); c.appendChild(listW.el); right.appendChild(c); }
      else if (!run.st.wrong && !(run.st.hint >= 1)) mistakesCard();
      if (run.options && stage === 'do') renderOptions();
    }
    function mistakesCard() {
      if (!lesson.mistakes || !lesson.mistakes.length) return;
      right.appendChild(h(`<div class="card" style="flex:1 1 0;min-height:0"><h3>Common mistakes</h3>${lesson.mistakes.map(m => `<span style="font-size:13px;color:var(--dim2);line-height:1.45">• ${esc(m)}</span>`).join('')}</div>`));
    }
    function renderLearnRight() {
      const ids = new Set(); lesson.steps.forEach(s => { (s.hl || []).forEach(i => ids.add(i)); if (s.c.id) ids.add(s.c.id); (s.c.parts || []).forEach(p => ids.add(p.id)); Object.keys(s.arrows || {}).forEach(i => ids.add(i)); });
      panel.setGuide({ hl: Array.from(ids).filter(i => CL.controls[i]) });
      right.appendChild(h(`<div class="card"><h3>In this lesson you will</h3>${lesson.steps.map((s, i) => `<div style="display:flex;gap:10px;font-size:14px;line-height:1.45"><span style="color:var(--amber);font-weight:700;width:18px">${i + 1}</span><span>${esc(s.title)}</span></div>`).join('')}</div>`));
      right.appendChild(h(`<div class="card cyan"><span class="txt" style="color:#D6EEF4">The glowing controls on the FLX4 panel are the ones this lesson uses.</span><div style="display:flex;gap:10px"><button class="btn w">Watch the demo</button><button class="btn primary d">Do it</button></div></div>`));
      right.querySelector('.w').onclick = () => setStage('watch'); right.querySelector('.d').onclick = () => setStage('do');
      mistakesCard();
    }
    function renderWatchRight(s) {
      top.querySelector('.wt').textContent = s.title;
      top.querySelector('.wx').textContent = s.text || (s.c.q || '');
      top.querySelector('.wk').textContent = 'STEP ' + (run.i + 1) + ' OF ' + run.steps.length + (run.demoPhase === 'do' ? ' · DOING IT NOW' : ' · WATCH THE GLOW');
      const c = s.c;
      if (c.t === 'quiz') {
        right.appendChild(h(`<div class="card"><h3>${esc(c.q)}</h3>${c.options.map((o, i) => `<div class="check${run.demoReveal && i === c.answer ? ' ok' : ''}">${run.demoReveal && i === c.answer ? '✓' : '○'} ${esc(o)}</div>`).join('')}${run.demoReveal ? `<span class="small">${esc(c.explain || '')}</span>` : ''}</div>`));
      } else {
        right.appendChild(h(`<div class="card pink"><span class="kicker k-pink">ON YOUR FLX4</span><span class="big">${esc(s.title)}</span><span class="txt" style="color:#E2C9D6">Watch the pink glow on the panel: that's the control. ${run.demoPhase === 'do' ? 'The app is moving it now — listen to what changes.' : ''}</span></div>`));
        const tid = c.id || (c.parts && c.parts[0].id) || (s.hl || [])[0];
        if (tid && CL.panelLayout.P[tid]) { const cc = h(`<div class="col" style="gap:6px"><span class="small">Close-up</span></div>`); right.appendChild(cc); closeP = CL.closeup(cc, tid, 230); }
      }
      mistakesCard();
    }

    function liveHtml(s) {
      const c = s.c;
      switch (c.t) {
        case 'knob': return `<div class="lv" style="background:#1A0F15;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>Live from your FLX4</span><span class="lvr" style="font-weight:600;color:var(--pink-text)"></span></div><div style="height:10px;border-radius:5px;background:#3A2030;position:relative"><div class="lvb" style="height:10px;border-radius:5px;background:var(--pink);width:0"></div><span class="lvt" style="position:absolute;top:-4px;width:3px;height:18px;background:#fff"></span></div><div style="display:flex;justify-content:space-between;font-size:11px;color:#C9AAB9"><span>Target: ${esc(CL.clock(c.to))}</span><span>${CL.controls[c.id].kind === 'fader' ? 'Bottom ⟷ Top' : 'Left ⟷ Right'}</span></div></div>`;
        case 'onBar': case 'together': return `<div class="lv" style="background:#1A0F15;border-radius:12px;padding:14px;display:flex;align-items:center;gap:18px"><span class="lvbig big" style="font-size:44px;color:var(--amber);min-width:120px;text-align:center">–</span><div class="col" style="gap:6px;flex:1"><span class="lvr" style="font-size:14px;font-weight:600"></span><div class="dots" style="display:flex;gap:6px">${[1, 2, 3, 4].map(() => '<span style="width:28px;height:10px;border-radius:3px;background:#3A2030"></span>').join('')}</div></div></div>`;
        case 'bpm': return `<div class="lv" style="background:#1A0F15;border-radius:12px;padding:14px;display:flex;justify-content:space-between;align-items:center"><span class="lvr" style="font-size:15px;font-weight:600"></span><span class="lvbig big" style="font-size:30px;color:var(--pink-text)"></span></div>`;
        case 'phase': return `<div class="lv" style="background:#1A0F15;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px"><span class="lvr" style="font-size:14px;font-weight:600"></span><div style="height:12px;border-radius:6px;background:#3A2030;position:relative"><span style="position:absolute;left:50%;top:-4px;width:2px;height:20px;background:#fff"></span><span class="lvdot" style="position:absolute;top:-1px;width:14px;height:14px;border-radius:7px;background:var(--amber);left:50%"></span></div><div style="display:flex;justify-content:space-between;font-size:11px;color:#C9AAB9"><span>Deck ${c.deck} behind</span><span>in time</span><span>Deck ${c.deck} ahead</span></div></div>`;
        case 'ready': return `<div class="col rd" style="gap:6px">${c.list.map(r => `<div class="check" data-r="${r.id}"><span class="ck">○</span><span>${esc(readyText(r))}</span></div>`).join('')}</div>`;
        case 'quiz': return `<div class="col" style="gap:8px">${c.options.map((o, i) => `<button class="btn qo" data-i="${i}" style="justify-content:flex-start;height:46px">${esc(o)}</button>`).join('')}</div>`;
        case 'manual': case 'info': return `<button class="btn primary mn" style="align-self:flex-start">${esc(c.label || 'Next')}</button>`;
        case 'rec': return `<button class="btn pink rb" style="align-self:flex-start">${c.on ? '● Record mix' : '■ Stop recording'}</button>`;
        case 'timer': case 'bothPlaying': case 'scratchTime': case 'setExam': case 'transitions': case 'scratch': case 'scratchCut': case 'beatjump': case 'roll': case 'samples': case 'hotcue': case 'move':
          return `<div class="lv" style="background:#1A0F15;border-radius:12px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center"><span class="lvr" style="font-size:14px;font-weight:600"></span><span class="lvbig big" style="font-size:26px;color:var(--pink-text)"></span></div>`;
        default: return '';
      }
    }
    function readyText(r) {
      const c = CL.controls[r.id];
      if (c.kind === 'fader') return c.name.replace(/^the /, '').replace(/^./, m => m.toUpperCase()) + (r.to >= 0.99 ? ' all the way up' : r.to <= 0.01 ? ' all the way down' : ' halfway');
      if (c.kind === 'xfader') return 'Crossfader ' + (r.to <= 0.01 ? 'fully left' : r.to >= 0.99 ? 'fully right' : 'in the middle');
      if (c.kind === 'tempo') return c.name.replace(/^the /, '').replace(/^./, m => m.toUpperCase()) + ' in the middle (0)';
      return c.name + ' at ' + CL.clock(r.to);
    }
    function renderStepCard(s) {
      const c = s.c, st = run.st, test = stage === 'test';
      const card = h(`<div class="card pink${st.complete ? ' flash-ok' : ''}" style="gap:12px;flex-shrink:0">
        <span class="kicker k-pink">${test ? 'TEST' : 'STEP'} ${run.i + 1} OF ${run.steps.length}${st.complete ? ' · ✓ DONE' : test ? '' : ' · DO THIS NOW'}</span>
        <span class="big">${esc(c.t === 'quiz' ? c.q : s.title)}</span>
        ${s.text && c.t !== 'quiz' && !(test && c.t !== 'ready') ? `<span class="txt" style="color:#E2C9D6">${esc(s.text)}</span>` : test && c.t !== 'quiz' ? `<span class="txt" style="color:#E2C9D6">${esc(s.title)} — no hints this time.</span>` : ''}
        ${liveHtml(s)}
        ${st.note ? `<span class="txt nt" style="color:var(--amber);font-weight:600">${esc(st.note)}</span>` : ''}
        ${(s.closeup && !test) ? '<div class="cu col" style="gap:6px"><span class="small" style="color:#E2C9D6">Close-up</span></div>' : ''}
      </div>`);
      right.appendChild(card);
      if (s.closeup && !test) closeP = CL.closeup(card.querySelector('.cu'), s.closeup, 190);
      card.querySelectorAll('.qo').forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === c.answer) { b.style.background = 'var(--green-bg)'; b.style.borderColor = 'var(--green)'; st.note = c.explain || 'Correct!'; run.ok(); }
        else { b.style.borderColor = 'var(--orange)'; b.disabled = true; st.note = 'Not quite. ' + (c.explain && !test ? c.explain : 'Try again.'); run.addTry('quiz'); sig = ''; render(); }
      });
      const mn = card.querySelector('.mn'); if (mn) mn.onclick = () => run.ok();
      const rb = card.querySelector('.rb'); if (rb) rb.onclick = () => { if (CL.audio.rec) CL.audio.stopRecording(); else CL.audio.startRecording(); };
    }
    function renderWrong() {
      const w = run.st.wrong;
      const card = h(`<div class="card orange" style="gap:10px"><div style="display:flex;align-items:center;gap:12px"><span style="width:34px;height:34px;border-radius:17px;background:var(--orange);color:#1A1206;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center">✕</span><span class="big" style="color:#FFD08A;font-size:22px">Oops, wrong control</span></div>
        <span class="txt" style="color:#F2E6D0;font-size:15px">${esc(w.text)}</span>
        ${w.putBack != null ? `<div style="background:#1E1910;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px"><span style="font-size:14px;font-weight:600;color:#FFD08A">Put it back first: ${esc(CL.controls[w.id].name)} to ${esc(CL.clock(w.putBack))}</span><div style="height:8px;border-radius:4px;background:#3A2E18;position:relative"><div class="pbv" style="height:8px;border-radius:4px;background:var(--orange);width:0"></div><span class="pbt" style="position:absolute;top:-4px;width:3px;height:16px;background:#fff;left:${w.putBack * 100}%"></span></div></div>` : ''}
        ${stage === 'do' ? '<span class="small">Mistakes in practice don\'t cost points. Only the test is scored.</span>' : ''}</div>`);
      right.appendChild(card);
    }
    function renderHint(s) {
      const c = s.c;
      const tid = c.id || (c.parts && c.parts[0].id) || (s.hl || [])[0] || (c.deck ? 'd' + c.deck + (c.t === 'sync' ? 'sync' : 'play') : null);
      const card = h(`<div class="card cyan" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="big" style="font-size:22px">Need a hand?</span><span class="small" style="color:#A9D9E6">No move for ${run.st.hint >= 2 ? 20 : 12} s</span></div>
        <span class="txt" style="color:#D6EEF4">${tid && CL.controls[tid] ? 'You need <b>' + esc(CL.controls[tid].name) + '</b>, glowing pink. Here it is up close:' : esc(s.text)}</span>
        <div class="cu"></div>
        <div style="display:flex;gap:10px">${run.st.hint >= 2 ? '<button class="btn primary sm2">▶ Show me the move</button>' : ''}<button class="btn sm1">I've got it</button></div></div>`);
      right.appendChild(card);
      if (tid && CL.panelLayout.P[tid] && !closeP) closeP = CL.closeup(card.querySelector('.cu'), tid, 200);
      card.querySelector('.sm1').onclick = () => run.dismissHint();
      const sm2 = card.querySelector('.sm2'); if (sm2) sm2.onclick = () => run.showMe();
    }
    function renderOptions() {
      const why = (run.st.why || []).slice(-3);
      overlay = h(`<div class="overlay"><div class="modal"><span class="kicker k-amber">3 TRIES ON THIS STEP</span><span class="big">This one is tricky. How do you want to continue?</span>
        <div style="display:flex;gap:8px">${why.map((w, i) => `<span class="chip" style="background:var(--amber-bg);color:#FFD08A">Try ${i + 1} · ${esc(w)}</span>`).join('')}</div>
        <div class="row">
          <div class="card" style="flex:1;background:var(--card2);border:1px solid var(--cyan)"><span class="big" style="color:var(--cyan)">½×</span><b>Slow mode</b><span class="txt" style="font-size:13px;flex:1">The music slows down (about 90 BPM) and hints stay on.</span><button class="btn primary o1">Try slower</button></div>
          <div class="card" style="flex:1;background:var(--card2)"><span class="big" style="color:var(--pink)">▶</span><b>Show me</b><span class="txt" style="font-size:13px;flex:1">The panel plays the move by itself. Then you copy it.</span><button class="btn o2">Watch the move</button></div>
          <div class="card" style="flex:1;background:var(--card2)"><span class="big" style="color:var(--dim)">⇥</span><b>Skip for now</b><span class="txt" style="font-size:13px;flex:1">Saved to practise later — you'll need it to pass the test.</span><button class="btn o3">Skip step</button></div>
        </div><button class="btn sm o4" style="align-self:flex-end">Keep trying</button></div></div>`);
      main.appendChild(overlay);
      overlay.querySelector('.o1').onclick = () => run.slowMode(true);
      overlay.querySelector('.o2').onclick = () => run.showMe();
      overlay.querySelector('.o3').onclick = () => run.skip();
      overlay.querySelector('.o4').onclick = () => run.closeOptions();
    }
    function renderResult() {
      const r = run.result;
      const nxt = CL.lessons[lesson.n];
      overlay = h(`<div class="overlay"><div class="modal" style="width:1100px">
        <span class="crumb">Lesson ${lesson.n} · Test</span>
        <span class="big" style="font-size:30px">${esc(lesson.title)}: ${r.pass ? 'passed!' : 'not yet'}</span>
        <div class="row">
          <div class="card ${r.pass ? 'green' : 'amber'}" style="flex:0 0 300px;align-items:center;gap:12px">
            <svg width="190" height="190" viewBox="0 0 190 190"><circle cx="95" cy="95" r="80" fill="none" stroke="#2A2D36" stroke-width="14"/><circle cx="95" cy="95" r="80" fill="none" stroke="${r.pass ? '#5BD68A' : '#FFB547'}" stroke-width="14" stroke-linecap="round" transform="rotate(-90 95 95)" stroke-dasharray="502.6" stroke-dashoffset="${502.6 * (1 - r.score / 100)}"/><text x="95" y="105" text-anchor="middle" fill="#F2F3F5" font-size="54" font-weight="700" font-family="Bahnschrift, Segoe UI">${r.score}</text><text x="95" y="132" text-anchor="middle" fill="#A3A8B4" font-size="13" font-family="Segoe UI">out of 100</text></svg>
            <span style="font-weight:600;color:${r.pass ? 'var(--green)' : 'var(--amber)'}">${r.pass ? 'Passed · pass mark 70' : 'Pass mark is 70 — so close'}</span>
            ${r.pass ? '<span class="chip">+40 XP</span>' : ''}
          </div>
          <div class="card grow" style="gap:14px">${[['Accuracy', r.accuracy, r.wrong ? r.wrong + ' wrong control' + (r.wrong > 1 ? 's' : '') + ' or misses' : 'No wrong controls — great.'], ['Timing', r.timing, r.timingList.length ? 'Average ' + (r.timingList.reduce((a, b) => a + b, 0) / r.timingList.length).toFixed(2) + ' beats off the beat' : 'No timed moves in this test.'], ['Flow', r.flow, 'Finished in ' + CL.fmtTime(r.secs) + '.']].map(([k, v, n]) => `<div class="col" style="gap:6px"><div style="display:flex;justify-content:space-between;font-size:15px"><b>${k}</b><b style="color:${v >= 80 ? 'var(--green)' : 'var(--amber)'}">${v}</b></div><div class="bar" style="height:10px"><div style="width:${v}%;background:${v >= 80 ? 'var(--green)' : 'var(--amber)'}"></div></div><span class="small">${esc(n)}</span></div>`).join('')}</div>
        </div>
        <div class="card amber"><b style="color:#FFD08A">${r.score >= 95 ? 'Almost perfect' : 'To score higher'}</b><span class="txt" style="color:#E8D9BC">${r.wrong ? 'Look at the panel before you move: only touch the control the step asks for. ' : ''}${r.timing < 85 ? 'Count the bars out loud and move exactly on "1". ' : ''}${r.flow < 85 ? 'Take the steps at a steady pace — practise it once more in Do it. ' : ''}${r.score >= 95 ? 'Keep it up!' : ''}</span></div>
        <div style="display:flex;justify-content:flex-end;gap:10px"><button class="btn rt">Retry test</button><button class="btn pr">Free practice in Studio</button><button class="btn primary nx">${nxt ? 'Next lesson →' : 'All lessons'}</button></div>
      </div></div>`);
      main.appendChild(overlay);
      overlay.querySelector('.rt').onclick = () => setStage('test');
      overlay.querySelector('.pr').onclick = () => CL.go('studio');
      overlay.querySelector('.nx').onclick = () => nxt ? CL.go('lesson', { id: nxt.id, stage: 'learn' }) : CL.go('lessons');
    }

    // ---------- per-frame live readings ----------
    function live() {
      strips.forEach(s => s.update());
      head.querySelector('.slow').classList.toggle('primary', !!CL.audio.slowMode);
      head.querySelector('.slow').textContent = CL.audio.slowMode ? 'Slow mode ON' : 'Slow mode';
      if (stage === 'learn') return;
      panel.setGuide(Object.assign({}, run.guide || {}, run.ghostPulse ? { arrows: Object.assign({}, (run.guide || {}).arrows, (run.guide || {}).hl ? Object.fromEntries((run.guide.hl || []).map(i => [i, 'press'])) : {}) } : {}));
      if (closeP) closeP.setGuide(panel.guide);
      const s = run.step, st = run.st; if (!s || !st || run.done) return;
      const c = s.c, q = sel => right.querySelector(sel);
      const A = CL.audio;
      if (c.t === 'knob' && q('.lvr')) {
        const v = (run.ghost && run.ghost[c.id] != null) ? run.ghost[c.id] : CL.val[c.id];
        q('.lvr').textContent = CL.controls[c.id].name.replace(/^the /, '') + ' at ' + CL.clock(v);
        q('.lvb').style.width = (v * 100) + '%'; q('.lvt').style.left = (c.to * 100) + '%';
      }
      if ((c.t === 'onBar' || c.t === 'together') && q('.lvr')) {
        const d = A.decks[c.deck];
        if (!d.playing) { q('.lvr').textContent = 'Start Deck ' + c.deck + ' first'; q('.lvbig').textContent = '—'; }
        else if (st.extra.target != null) {
          const bi = d.beatInfo(), to = st.extra.beatsTo != null ? st.extra.beatsTo : 0;
          q('.lvr').textContent = 'Bar ' + Math.max(1, bi.bar) + '.' + bi.beatInBar + ' → ' + (c.t === 'together' ? 'swap' : 'press') + ' on bar ' + (st.extra.target + 1) + (c.count > 1 ? '   (' + st.count + ' / ' + c.count + ')' : '');
          const n = Math.ceil(to);
          q('.lvbig').textContent = to <= 0.5 && to > -0.5 ? 'NOW' : n <= 4 && n > 0 ? String(n) : (Math.ceil(to / 4) + ' bars');
          q('.lvbig').style.color = n <= 1 ? 'var(--pink)' : 'var(--amber)';
          right.querySelectorAll('.dots span').forEach((e, i) => { e.style.background = i < bi.beatInBar ? (to <= 4 ? 'var(--pink)' : 'var(--amber)') : '#3A2030'; });
        }
      }
      if (c.t === 'bpm' && q('.lvr')) {
        const d = A.decks[c.deck], o = A.decks[c.deck === 1 ? 2 : 1], tg = c.target === 'other' ? o.bpm : c.target;
        q('.lvr').textContent = 'Deck ' + c.deck + ': ' + d.bpm.toFixed(1) + ' BPM → target ' + tg.toFixed(1);
        const diff = d.bpm - tg; q('.lvbig').textContent = Math.abs(diff) <= c.tol ? '✓ matched' : (diff > 0 ? '−' : '+') + Math.abs(diff).toFixed(1);
      }
      if (c.t === 'phase' && q('.lvr')) {
        const ph = st.extra.phase || 0, d = A.decks[c.deck];
        const ms = Math.round(ph * 60 / (d.bpm || 120) * 1000);
        q('.lvr').textContent = !d.playing ? 'Play Deck ' + c.deck : Math.abs(ph) <= c.tol ? 'In time — hold it… ' : 'Kicks are ' + Math.abs(ms) + ' ms ' + (ph > 0 ? 'ahead' : 'behind') + '. Nudge the jog ' + (ph > 0 ? 'back (left)' : 'forward (right)') + '.';
        q('.lvdot').style.left = 'calc(' + (50 + CL.clamp(ph, -0.5, 0.5) * 100) + '% - 7px)';
        q('.lvdot').style.background = Math.abs(ph) <= c.tol ? 'var(--green)' : 'var(--amber)';
      }
      if (c.t === 'ready') right.querySelectorAll('[data-r]').forEach(e => { const r = c.list.find(x => x.id === e.dataset.r); const ok = Math.abs(CL.val[r.id] - r.to) <= (r.tol || 0.06) || (r.to <= 0.01 && CL.val[r.id] <= 0.06) || (r.to >= 0.99 && CL.val[r.id] >= 0.94); e.classList.toggle('ok', ok); e.querySelector('.ck').textContent = ok ? '✓' : '○'; });
      const cnt = { scratch: [st.count, c.count, 'moves'], scratchCut: [st.count, c.count, 'cuts'], beatjump: [st.count, c.count, 'jumps'], roll: [st.count, c.count, 'rolls'], samples: [st.count, c.count, 'sounds'], hotcue: [A.decks[c.deck || 1].hot.filter(x => x != null).length, c.count, 'hot cues'], transitions: [run.transitions, c.count, 'transitions'], move: [Math.min(c.amount, st.acc).toFixed(1), c.amount, 'moved'] }[c.t];
      if (cnt && q('.lvr')) { q('.lvr').textContent = cnt[2]; q('.lvbig').textContent = cnt[0] + ' / ' + cnt[1]; }
      if (c.t === 'timer' && q('.lvr')) { q('.lvr').textContent = c.label || 'Time'; q('.lvbig').textContent = Math.max(0, Math.ceil(st.extra.left || 0)) + ' s'; }
      if (c.t === 'bothPlaying' && q('.lvr')) { q('.lvr').textContent = 'Both tracks playing'; q('.lvbig').textContent = Math.floor(st.acc) + ' / ' + Math.round(c.seconds) + ' s'; }
      if (c.t === 'scratchTime' && q('.lvr')) { q('.lvr').textContent = 'Scratching time'; q('.lvbig').textContent = Math.floor(st.acc) + ' / ' + c.seconds + ' s'; }
      if (c.t === 'setExam' && q('.lvr')) { q('.lvr').textContent = run.transitions + ' / ' + c.transitions + ' transitions'; q('.lvbig').textContent = CL.fmtTime(st.extra.played || 0) + ' / ' + c.minutes + ':00'; }
      if (st.wrong && st.wrong.putBack != null && right.querySelector('.pbv')) right.querySelector('.pbv').style.width = (CL.val[st.wrong.id] * 100) + '%';
      render();
    }
    const offs = [CL.on('lesson', () => render())];
    const stop = CL.every(live);
    setStage(stage);
    return { destroy() { stop(); offs.forEach(f => f()); run.destroy(); if (listW) listW.destroy(); CL.guideLit = []; if (CL.audio.slowMode) CL.audio.setSlow(false); } };
  };
})(window.CL);
