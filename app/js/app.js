// CueLab boot
'use strict';
(function (CL) {
  CL.fit();
  CL.tracks.init();
  CL.midi.start();
  // Start audio on first interaction (Chromium autoplay rule), and when the controller is used.
  const wake = () => { CL.audio.init(); CL.audio.resume(); };
  window.addEventListener('pointerdown', wake, { once: false });
  window.addEventListener('keydown', wake);
  CL.on('control', () => CL.audio.resume());
  // keyboard helpers
  window.addEventListener('keydown', e => {
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); CL.input('d1play', true, 'mouse'); CL.input('d1play', false, 'mouse'); }
  });
  CL.i18n.start();
  let after = null; try { after = sessionStorage.getItem('cuelab.after'); sessionStorage.removeItem('cuelab.after'); } catch (e) { }
  CL.go(after && CL.views[after] ? after : 'home');
  window.CueLab = CL; // handy for testing in dev tools
})(window.CL);
