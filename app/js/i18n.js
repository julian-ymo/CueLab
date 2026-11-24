// CueLab languages: English and Burmese (မြန်မာ).
// The app is written in English. In Burmese mode every piece of text that appears on screen
// is swapped for its translation as it is drawn (exact phrases first, then patterns for text with numbers or names).
// Labels printed on the FLX4 itself (PLAY/PAUSE, CUE, LOW, BEAT SYNC…) stay in English so they match the hardware.
'use strict';
(function (CL) {
  const I = CL.i18n = { dict: new Map(), pats: [], keep: new Set(), missing: new Set(), cache: new Map(), outs: new Set() };
  CL.lang = () => (CL.store && CL.store.settings && CL.store.settings.lang) || 'en';
  I.add = obj => { for (const k in obj) { I.dict.set(k, obj[k]); I.outs.add(obj[k]); } };
  I.pat = (re, fn) => I.pats.push([re, fn]);
  I.keepAll = list => list.forEach(s => I.keep.add(s));

  // translate one piece of text; returns the original when there is no translation
  function core(k) {
    if (I.keep.has(k)) return k;
    let r = I.dict.get(k);
    if (r != null) return r;
    for (const [re, fn] of I.pats) { const m = k.match(re); if (m) { r = fn(m, sub); if (r != null) return r; } }
    // several sentences in one piece of text: translate each one
    const parts = k.split(/(?<=[.!?…])\s+/);
    if (parts.length > 1) {
      const p0 = parts[0], rest = parts.slice(1).join(' ');
      let t = core(p0);
      if (t == null && /\.$/.test(p0)) { t = core(p0.slice(0, -1)); if (t != null) t += '။'; }
      const t2 = t != null ? core(rest) : null;
      if (t != null && t2 != null) return t + ' ' + t2;
    }
    return null;
  }
  // translate a captured part (used by patterns): never fails, falls back to the English
  function sub(s) { if (s == null) return ''; const t = String(s).trim(); if (!t || !/[A-Za-z]/.test(t)) return s; const r = core(t); if (r == null) { I.missing.add(t); return t; } return r; }
  I.sub = sub;
  I.t = function (s) {
    if (CL.lang() !== 'my' || s == null) return s;
    s = String(s);
    if (!/[A-Za-z]/.test(s)) return s;
    if (I.cache.has(s)) return I.cache.get(s);
    if (I.outs.has(s.trim())) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], k = s.trim();
    let r = core(k);
    if (r == null) { I.missing.add(k); r = k; }
    const out = lead + r + trail;
    I.outs.add(r);
    if (I.cache.size > 4000) I.cache.clear();
    I.cache.set(s, out);
    return out;
  };
  CL.t = I.t;

  // ---------- live translation of everything drawn on screen ----------
  const done = new WeakMap(); // text node -> the Burmese we put there
  function skip(el) { return !el || (el.closest('.flx') && !el.closest('.flx-callout')) || el.closest('script,style,.notr'); }
  function doText(n) {
    const v = n.nodeValue;
    if (done.get(n) === v) return;
    if (!/[A-Za-z]/.test(v) || skip(n.parentElement)) return;
    const t = I.t(v);
    done.set(n, t);
    if (t !== v) n.nodeValue = t;
  }
  function doAttrs(el) {
    if (skip(el)) return;
    for (const a of ['placeholder', 'title']) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && /[A-Za-z]/.test(v)) { const t = I.t(v); if (t !== v) el.setAttribute(a, t); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    if (root.matches('.flx') ) { root.querySelectorAll('.flx-callout').forEach(walk); return; }
    doAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  I.walk = walk;
  I.start = function () {
    document.documentElement.lang = CL.lang() === 'my' ? 'my' : 'en';
    if (CL.lang() !== 'my') return;
    const stage = document.getElementById('stage');
    walk(stage);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(stage, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title'] });
  };
  // switching language reloads the window and comes back to Settings
  CL.setLang = function (lang) {
    const view = CL.currentView ? CL.currentView() : 'settings';
    const run = CL.currentRun, busy = (view === 'lesson' && run && !run.done && run.i > 0) ||
      (CL.audio && CL.audio.decks && [1, 2].some(n => CL.audio.decks[n] && CL.audio.decks[n].playing));
    if (busy && !window.confirm(CL.lang() === 'my'
      ? 'ဘာသာ ပြောင်းရင် app ပြန်စပြီး သီချင်းနဲ့ လက်ရှိ သင်ခန်းစာ အဆင့် ရပ်သွားပါမယ်။ ဆက်လုပ်မလား။\n\nChanging language restarts the app and stops the music and this lesson step. Continue?'
      : 'Changing language restarts the app and stops the music and this lesson step. Continue?')) return;
    CL.store.settings.lang = lang; CL.save();
    try { sessionStorage.setItem('cuelab.after', view === 'lesson' ? 'lessons' : (view || 'settings')); } catch (e) { }
    location.reload();
  };
})(window.CL);
