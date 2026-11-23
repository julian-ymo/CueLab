// CueLab lessons: 38 lessons in 4 levels. Every step has a check the app watches for on your DDJ-FLX4.
// Check types are handled in lesson-engine.js.
'use strict';
(function (CL) {
  const S = (title, text, c, more) => Object.assign({ title, text, c }, more || {});
  const press = (id, more) => Object.assign({ t: 'press', id }, more || {});
  const knob = (id, to, more) => Object.assign({ t: 'knob', id, to }, more || {});
  const quiz = (q, options, answer, explain) => ({ t: 'quiz', q, options, answer, explain });
  const manual = label => ({ t: 'manual', label: label || 'I did it' });
  const info = label => ({ t: 'info', label: label || 'Next' });
  const timer = (seconds, more) => Object.assign({ t: 'timer', seconds }, more || {});
  const UP = { fader1: 1, fader2: 1 }; // common start positions
  const READY_STD = [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 0 }, { id: 'low1', to: 0.5 }, { id: 'low2', to: 0.5 }, { id: 'xfader', to: 0.5 }];
  const READY_EQ = [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 0 }, { id: 'hi1', to: 0.5 }, { id: 'mid1', to: 0.5 }, { id: 'low1', to: 0.5 }, { id: 'hi2', to: 0.5 }, { id: 'mid2', to: 0.5 }, { id: 'low2', to: 0.5 }, { id: 'xfader', to: 0.5 }];

  const L = [];
  const add = (tier, id, title, uses, mins, o) => L.push(Object.assign({ tier, id, title, uses, mins }, o));

  // ================= BASIC =================
  add('Basic', 'l1', 'Meet your DDJ-FLX4', 'every section', 6, {
    why: 'Your FLX4 has two decks (left = Deck 1, right = Deck 2) and a mixer in the middle. Each deck plays one track. The mixer decides what the crowd hears. Five minutes here makes every other lesson easier.',
    words: [['Deck', 'One side of the controller that plays one track.'], ['Mixer', 'The middle section: EQs, filters, faders, crossfader.'], ['Jog wheel', 'The big round platter. Touch the top to scratch, turn the edge to nudge.']],
    setup: { d1: 'warm' },
    steps: [
      S('Find the two decks', 'Deck 1 is on the left, Deck 2 on the right. Each has a jog wheel, PLAY/PAUSE, CUE and 8 pads.', info(), { hl: ['d1jog', 'd2jog'] }),
      S('Start the music', 'Press PLAY/PAUSE on Deck 1. "Warm Circuit" is already loaded.', press('d1play'), { arrows: { d1play: 'press' }, lit: ['d1play'] }),
      S('Move a channel fader', 'Pull the Channel 1 fader down, then push it back up. Hear the volume change.', { t: 'move', id: 'fader1', amount: 0.9 }, { arrows: { fader1: 'down' } }),
      S('Try an EQ knob', 'Turn LOW on Channel 1 left, then back to 12 o\'clock. The bass disappears and comes back.', { t: 'move', id: 'low1', amount: 0.5 }, { arrows: { low1: 'left' } }),
      S('Touch the jog wheel', 'Rest your hand on top of the Deck 1 jog wheel. The music stops like a record under your hand. Let go to continue.', { t: 'jogTouch', deck: 1 }, { arrows: { d1jog: 'touch' } }),
      S('Pause', 'Press PLAY/PAUSE on Deck 1 again to stop.', { t: 'paused', deck: 1 }, { hl: ['d1play'], arrows: { d1play: 'press' }, lit: ['d1play'] }),
      S('Quick check', 'Which side is Deck 2?', quiz('Which side is Deck 2?', ['Left', 'Right', 'In the middle'], 1, 'Deck 2 is on the right. The mixer is in the middle.'))
    ],
    mistakes: ['Pressing CUE instead of PLAY: CUE jumps back to the start point.', 'Gripping the jog wheel too hard: rest your hand lightly on top.']
  });
  add('Basic', 'l2', 'Speakers & headphones setup', 'MASTER LEVEL, HP LEVEL', 5, {
    why: 'Speakers (or the MASTER output) are what the crowd hears. Headphones let you listen to the next track before anyone else hears it. On the FLX4, MASTER LEVEL and HP LEVEL work directly on the hardware.',
    words: [['Master', 'The main output the crowd hears.'], ['Cue (PFL)', 'Sending a channel to your headphones only.'], ['HP MIX', 'Blend between cue (left) and master (right) in your headphones.']],
    setup: { d1: 'warm', d2: 'ferry', play: [1, 2] },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 0 }],
    steps: [
      S('Plug in', 'Speakers go into MASTER on the back (RCA). Headphones go into the 3.5 mm jack on the front.', manual('Done')),
      S('Set a safe volume', 'Turn MASTER LEVEL and HP LEVEL to about 10 o\'clock. These knobs change the volume on the FLX4 itself.', manual('Done'), { hl: ['master', 'hplevel'] }),
      S('Cue Channel 2', 'Press the orange CUE button on Channel 2. Deck 2 now plays in your headphones only.', { t: 'cueToggle', ch: 2, on: true }, { arrows: { hcue2: 'press' }, lit: ['hcue2'] }),
      S('Listen to cue only', 'Turn HP MIX fully left. You now hear only Deck 2 in your headphones.', knob('hpmix', 0)),
      S('Blend', 'Turn HP MIX back to the middle to hear both.', knob('hpmix', 0.5)),
      S('Quick check', 'Channel 2\'s fader is down. Can the crowd hear Deck 2?', quiz('Channel 2\'s fader is down and its CUE is on. Can the crowd hear Deck 2?', ['Yes', 'No, only I can in my headphones'], 1, 'The CUE button only sends it to your headphones.'))
    ],
    mistakes: ['HP LEVEL too loud: protect your ears, start low.', 'Forgetting to turn CUE off later.']
  });
  add('Basic', 'l3', 'Browsing & loading tracks', 'BROWSE, LOAD 1 / 2', 5, {
    why: 'The BROWSE knob scrolls through your music. LOAD 1 and LOAD 2 put the highlighted track on a deck. You never need the mouse to pick music.',
    words: [['BROWSE', 'Turn to move up/down the track list.'], ['LOAD', 'Puts the highlighted track onto that deck.']],
    setup: {},
    showList: true,
    steps: [
      S('Scroll the list', 'Turn the BROWSE knob. Watch the highlight move in the track list.', { t: 'browse' }, { arrows: { browse: 'spin' } }),
      S('Load Deck 1', 'Highlight any house track, then press LOAD 1.', { t: 'load', deck: 1 }, { arrows: { load1: 'press' } }),
      S('Load Deck 2', 'Highlight another track and press LOAD 2.', { t: 'load', deck: 2 }, { arrows: { load2: 'press' } }),
      S('Play it', 'Press PLAY/PAUSE on Deck 1 to hear what you loaded.', press('d1play'), { arrows: { d1play: 'press' }, lit: ['d1play'] })
    ],
    mistakes: ['Loading onto the deck that is playing: it stops the music.']
  });
  add('Basic', 'l4', 'Beats, bars & phrases', 'PLAY/PAUSE, CUE', 8, {
    why: 'Dance music counts in 4s: 4 beats make a bar, and bars come in phrases (here 16 bars). Things change at the start of a phrase. If you start the next track there, your mix sounds right.',
    words: [['Beat', 'One kick drum hit.'], ['Bar', '4 beats.'], ['Phrase', 'A group of bars (16 in these tracks) where the music changes.']],
    setup: { d1: 'warm', play: [1] },
    ready: [{ id: 'fader1', to: 1 }],
    steps: [
      S('Count along', 'Listen to the kick drum and watch the bar counter: 1-2-3-4, 1-2-3-4.', timer(12, { label: 'Listening' })),
      S('Tap every bar', 'Press SHIFT on Deck 1 on beat 1 of 4 bars in a row (watch the counter).', { t: 'onBar', id: 'd1shift', deck: 1, every: 1, count: 4, tol: 0.4 }, { arrows: { d1shift: 'tap' } }),
      S('How long is a phrase?', 'In these practice tracks, the music changes every…', quiz('In these tracks, the music changes every…', ['4 bars', '16 bars', '100 bars'], 1, 'Every 16 bars something new comes in: bass at bar 17, chords at bar 33.')),
      S('Catch the phrase', 'Press SHIFT exactly on beat 1 of the next phrase (bar 17, 33 or 49).', { t: 'onBar', id: 'd1shift', deck: 1, every: 16, count: 1, tol: 0.5 }, { arrows: { d1shift: 'tap' } })
    ],
    mistakes: ['Counting the hi-hats instead of the kick drum.']
  });
  add('Basic', 'l5', 'BPM & tempo', 'TEMPO slider, BEAT SYNC', 7, {
    why: 'BPM (beats per minute) is how fast a track is. To mix two tracks they need the same BPM. The TEMPO slider speeds a track up or slows it down; BEAT SYNC does it for you.',
    words: [['BPM', 'Beats per minute: how fast a track is. House is usually 120–128.'], ['TEMPO slider', 'Speeds a track up or down. On the FLX4, – is at the top.'], ['TEMPO RANGE', 'SHIFT + BEAT SYNC sets how far the slider goes: ±6, 10, 16 or 100%.']],
    setup: { d1: 'warm', d2: 'slow', play: [1] },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 0 }, { id: 'd2tempo', to: 0.5 }],
    steps: [
      S('Read the BPM', 'Look at Deck 1 on screen. What\'s its BPM?', quiz('What is the BPM of Deck 1 ("Warm Circuit")?', ['118', '124', '174'], 1, 'Deck 1 is 124 BPM. Deck 2 ("Slow Lane") is 118.')),
      S('Start Deck 2', 'Press PLAY/PAUSE on Deck 2. It\'s slower (118 BPM). Its fader is down, so cue it in your headphones if you like.', press('d2play'), { arrows: { d2play: 'press' }, lit: ['d2play'] }),
      S('Match by hand', 'Slide the TEMPO slider on Deck 2 down (toward +) until it shows 124.0 BPM.', { t: 'bpm', deck: 2, target: 'other', tol: 0.25, noSync: true }, { hl: ['d2tempo'], arrows: { d2tempo: 'slidedown' }, live: 'bpm2' }),
      S('Let SYNC do it', 'Now press BEAT SYNC on Deck 2. It matches BPM (and lines up the beats) instantly.', { t: 'sync', deck: 2 }, { arrows: { d2sync: 'press' }, lit: ['d2sync'] })
    ],
    mistakes: ['Sliding the wrong way: on the FLX4 the top is minus (slower).', 'Moving Deck 1\'s slider instead of Deck 2\'s.']
  });
  add('Basic', 'l6', 'Cueing in headphones', 'channel CUE, HP MIX', 9, {
    why: 'Before the crowd hears the next track you check it in your headphones: right track, right place, in time.',
    words: [['Cue', 'Pre-listen to a channel in headphones.'], ['Pre-fader', 'CUE works even when the channel fader is down.']],
    setup: { d1: 'warm', d2: 'glass', play: [1] },
    ready: READY_STD,
    steps: [
      S('Cue Deck 2', 'Press the CUE button on Channel 2.', { t: 'cueToggle', ch: 2, on: true }, { arrows: { hcue2: 'press' }, lit: ['hcue2'] }),
      S('Play it in your headphones', 'Press PLAY/PAUSE on Deck 2. The crowd can\'t hear it: its fader is down.', press('d2play'), { arrows: { d2play: 'press' }, lit: ['d2play'] }),
      S('Hear only the cue', 'Turn HP MIX fully left.', knob('hpmix', 0)),
      S('Sync it', 'Press BEAT SYNC on Deck 2 so it\'s in time with Deck 1.', { t: 'sync', deck: 2 }, { arrows: { d2sync: 'press' }, lit: ['d2sync'] }),
      S('Back to normal', 'Turn HP MIX to the middle and press CUE on Channel 2 again to turn it off.', { t: 'cueToggle', ch: 2, on: false }, { hl: ['hpmix', 'hcue2'] })
    ],
    mistakes: ['Raising the Channel 2 fader instead of using CUE: then the crowd hears it too.']
  });
  add('Basic', 'l7', 'Channel faders & crossfader', 'faders, crossfader', 6, {
    why: 'Channel faders set each deck\'s volume. The crossfader slides between Deck 1 (left) and Deck 2 (right). Many club DJs leave the crossfader in the middle and mix with the channel faders.',
    words: [['Channel fader', 'Up/down volume for one deck.'], ['Crossfader', 'Left = Deck 1, right = Deck 2, middle = both.']],
    setup: { d1: 'warm', d2: 'glass', play: [1, 2], sync: 2 },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 1 }],
    steps: [
      S('Crossfader left', 'Slide the crossfader fully left: only Deck 1.', knob('xfader', 0)),
      S('Crossfader right', 'Now fully right: only Deck 2.', knob('xfader', 1)),
      S('Back to the middle', 'Put the crossfader in the middle.', knob('xfader', 0.5)),
      S('Channel 1 down', 'Pull the Channel 1 fader all the way down.', knob('fader1', 0)),
      S('Channel 1 up', 'Push it back up to the top.', knob('fader1', 1))
    ],
    mistakes: ['Moving the crossfader while a channel fader is down: you hear nothing change.']
  });
  add('Basic', 'l8', 'Your first blend', 'faders, BEAT SYNC', 10, {
    why: 'A blend is when the next track slowly comes in while the first one slowly goes out. Start it on a phrase, keep it in sync, move the faders smoothly.',
    words: [['Blend', 'A smooth, slow change from one track to the next.'], ['Phrase', 'Start the new track on bar 1 of a phrase.']],
    setup: { d1: 'warm', d2: 'glass', play: [1] },
    ready: READY_STD,
    steps: [
      S('Sync Deck 2', 'Press BEAT SYNC on Deck 2.', { t: 'sync', deck: 2 }, { arrows: { d2sync: 'press' }, lit: ['d2sync'] }),
      S('Start on the phrase', 'Press PLAY/PAUSE on Deck 2 exactly on beat 1 of the next phrase. The app counts you in.', { t: 'onBar', id: 'd2play', deck: 1, every: 16, count: 1, tol: 0.5, retryPause: 2 }, { arrows: { d2play: 'press' }, lit: ['d2play'] }),
      S('Bring Deck 2 in', 'Slowly push the Channel 2 fader up to the top (take about 8 bars).', knob('fader2', 1), { arrows: { fader2: 'up' } }),
      S('Take Deck 1 out', 'Slowly pull the Channel 1 fader down.', knob('fader1', 0), { arrows: { fader1: 'down' } })
    ],
    mistakes: ['Starting Deck 2 in the middle of a phrase.', 'Moving the faders too fast: it sounds like a jump, not a blend.']
  });
  add('Basic', 'l9', 'Smart Fader for beginners', 'SMART FADER', 6, {
    why: 'SMART FADER is a beginner helper inside the FLX4: when it\'s on, moving the crossfader or a channel fader also changes the BPM and adds EQ/filter moves automatically. It works on the hardware, so the app can\'t see it, but you can hear it.',
    words: [['Smart Fader', 'An automatic blend helper built into the FLX4.']],
    setup: { d1: 'warm', d2: 'paper', play: [1, 2] },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 1 }, { id: 'xfader', to: 0 }],
    steps: [
      S('Turn it on', 'Press SMART FADER (left of the mixer, bottom). Its light turns on.', manual('It\'s on'), { hl: ['smartfader'], arrows: { smartfader: 'press' } }),
      S('Slide across', 'Slowly slide the crossfader from left to right. Listen to how it blends by itself.', knob('xfader', 1)),
      S('Turn it off', 'Press SMART FADER again. For the next lessons, keep it off: you\'ll learn to do this yourself.', manual('It\'s off'), { hl: ['smartfader'] })
    ],
    mistakes: ['Leaving Smart Fader on during later lessons: it changes your tempo.']
  });
  add('Basic', 'l10', 'Basic mix: 15 minutes', 'everything so far', 15, {
    why: 'Put it together: load, sync, start on the phrase and blend. Do as many clean transitions as you can.',
    words: [['Transition', 'Going from one track to the next.']],
    setup: { d1: 'warm', d2: 'glass', play: [1] },
    ready: READY_STD,
    showList: true,
    steps: [
      S('Mix freely', 'Load the next track on the free deck, sync it, start it on a phrase and blend. Aim for 2 clean transitions.', { t: 'transitions', count: 2 }, { hl: ['load1', 'load2', 'd1sync', 'd2sync', 'fader1', 'fader2'] })
    ],
    mistakes: ['Loading a track onto the deck the crowd is hearing.']
  });

  // ================= INTERMEDIATE =================
  add('Intermediate', 'l11', 'Beatmatching by ear', 'TEMPO, JOG wheel', 12, {
    why: 'SYNC is great, but real DJs can match by ear: set the tempo, then nudge the jog wheel until the kick drums hit together. This also saves you when SYNC can\'t (records, live drummers, odd tracks).',
    words: [['Nudge', 'Turning the side of the jog to briefly speed up or slow down.'], ['Flam', 'Two kicks slightly apart: "ba-boom" instead of "boom".']],
    setup: { d1: 'warm', d2: 'slow', play: [1] },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 0 }, { id: 'd2tempo', to: 0.5 }],
    steps: [
      S('Cue and play Deck 2', 'Press CUE on Channel 2, then PLAY on Deck 2.', press('d2play'), { hl: ['hcue2', 'd2play'], order: { hcue2: 1, d2play: 2 } }),
      S('Match the tempo', 'Use the TEMPO slider on Deck 2 until both show the same BPM (within 0.2). No SYNC!', { t: 'bpm', deck: 2, target: 'other', tol: 0.2, noSync: true }, { hl: ['d2tempo'], arrows: { d2tempo: 'slidedown' }, live: 'bpm2' }),
      S('Line up the kicks', 'Turn the SIDE of the Deck 2 jog wheel to push it forward or hold it back until the kicks hit together.', { t: 'phase', deck: 2, tol: 0.06, hold: 4 }, { hl: ['d2jog'], arrows: { d2jog: 'spin' }, live: 'phase' })
    ],
    mistakes: ['Touching the top of the jog: that stops it (scratch). Use the side to nudge.', 'Big tempo moves: small moves near the middle.']
  });
  add('Intermediate', 'l12', 'Gain staging & levels', 'TRIM, level meters', 8, {
    why: 'Tracks come at different loudness. TRIM sets each channel\'s level so both peak at the same height on the meters. Keep out of the red.',
    words: [['TRIM', 'The input level of one channel.'], ['Clipping', 'Too loud: the meter goes red and the sound distorts.']],
    setup: { d1: 'warm', d2: 'ferry', play: [1, 2], sync: 2 },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 1 }],
    steps: [
      S('Watch the meters', 'Look at the two level meters in the middle of the panel.', timer(8, { label: 'Watching' })),
      S('Turn Channel 2 down', 'Turn TRIM on Channel 2 to about 10 o\'clock.', knob('trim2', 0.33, { tol: 0.08 })),
      S('Match them', 'Turn TRIM on Channel 2 back to 12 o\'clock so both meters match.', knob('trim2', 0.5)),
      S('Red means?', '', quiz('The meter is hitting the top orange/red lights. What do you do?', ['Turn the TRIM down a little', 'Turn the master up', 'Nothing'], 0, 'Turn TRIM down so it stays out of the red.'))
    ],
    mistakes: ['Using the channel fader to fix loudness: use TRIM, keep faders at the top.']
  });
  add('Intermediate', 'l13', 'EQ mixing: the bass swap', 'LOW, MID, HI', 10, {
    why: 'Two kick drums and two bass lines together sound muddy and too loud. Cut the LOW on the incoming track, bring it in cleanly, then swap the bass at the start of a phrase.',
    words: [['LOW / MID / HI', 'Three EQ knobs: bass, middle, treble.'], ['Bass swap', 'LOW of the old track down and LOW of the new track up, at the same moment.']],
    setup: { d1: 'warm', d2: 'ferry', play: [1] },
    ready: READY_EQ,
    steps: [
      S('Play Deck 1', 'Press PLAY/PAUSE on Deck 1.', { t: 'playing', deck: 1 }, { hl: ['d1play'], arrows: { d1play: 'press' }, lit: ['d1play'] }),
      S('Load & sync Deck 2', 'Press BEAT SYNC on Deck 2 ("Night Ferry" is loaded).', { t: 'sync', deck: 2 }, { arrows: { d2sync: 'press' }, lit: ['d2sync'] }),
      S('Cut LOW on CH 2', 'Turn LOW on Channel 2 fully left. It\'s the 4th knob down on the right-hand channel strip.', knob('low2', 0), { closeup: 'low2' }),
      S('Start Deck 2 on the phrase', 'Press PLAY/PAUSE on Deck 2 on beat 1 of the next phrase. The app counts you in.', { t: 'onBar', id: 'd2play', deck: 1, every: 16, count: 1, tol: 0.5, retryPause: 2 }, { arrows: { d2play: 'press' }, lit: ['d2play'] }),
      S('Raise CH 2 fader', 'Slowly push the Channel 2 fader up. You hear its drums and top end, but no bass yet.', knob('fader2', 1), { arrows: { fader2: 'up' } }),
      S('Swap the bass', 'On beat 1 of the next phrase: turn LOW 1 fully left and LOW 2 back to 12 o\'clock, at the same time.', { t: 'together', parts: [{ id: 'low1', to: 0 }, { id: 'low2', to: 0.5 }], deck: 1, every: 16, tol: 2 }, { order: { low1: 1, low2: 2 }, arrows: { low1: 'left', low2: 'right' } }),
      S('Fade out CH 1', 'Slowly pull the Channel 1 fader down. Deck 2 is now the main track.', knob('fader1', 0), { arrows: { fader1: 'down' } })
    ],
    mistakes: ['Turning LOW on Channel 1 instead: check the pink glow is on the right strip.', 'Raising the CH 2 fader before the bass is cut: two kicks clash.', 'Swapping in the middle of a phrase instead of on beat 1.']
  });
  add('Intermediate', 'l14', 'Hot cues', 'HOT CUE pads', 9, {
    why: 'Hot cues are bookmarks in a track. Press an empty pad to save the spot, press it again to jump there instantly. Great for starting a track on the drop.',
    words: [['Hot cue', 'A saved position on a pad.'], ['SHIFT + pad', 'Deletes that hot cue.']],
    setup: { d1: 'warm', play: [1] },
    ready: [{ id: 'fader1', to: 1 }],
    steps: [
      S('HOT CUE mode', 'Press HOT CUE above the Deck 1 pads.', press('d1mHot'), { arrows: { d1mHot: 'press' }, lit: ['d1mHot'] }),
      S('Save a hot cue', 'Press pad 1 while the music plays. It lights up: the spot is saved.', { t: 'hotcue', deck: 1, count: 1 }, { arrows: { d1p1: 'press' }, lit: ['d1p1'] }),
      S('Save another', 'A few bars later, press pad 2.', { t: 'hotcue', deck: 1, count: 2 }, { arrows: { d1p2: 'press' } }),
      S('Jump!', 'Press pad 1 again: the track jumps back to your first hot cue.', { t: 'hotcueJump', deck: 1 }, { arrows: { d1p1: 'press' } }),
      S('Delete one', 'Hold SHIFT and press pad 2 to delete it.', { t: 'hotcueDel', deck: 1 }, { hl: ['d1shift', 'd1p2'], order: { d1shift: 1, d1p2: 2 } })
    ],
    mistakes: ['Being in BEAT JUMP or SAMPLER mode: press HOT CUE first.']
  });
  add('Intermediate', 'l15', 'Loops: IN, OUT & 4 BEAT', 'IN, OUT, 4 BEAT/EXIT', 9, {
    why: 'A loop repeats part of a track. Use it to make an intro longer, or to buy time for your next mix.',
    words: [['IN / OUT', 'Set the start and the end of a loop.'], ['4 BEAT/EXIT', 'Makes a 4-beat loop instantly, or exits the loop.']],
    setup: { d1: 'warm', play: [1] },
    ready: [{ id: 'fader1', to: 1 }],
    steps: [
      S('Set loop IN', 'Press IN on Deck 1 on a beat.', press('d1in'), { arrows: { d1in: 'press' }, lit: ['d1in'] }),
      S('Set loop OUT', 'One bar later, press OUT. The loop starts.', { t: 'loop', deck: 1, on: true }, { hl: ['d1out'], arrows: { d1out: 'press' }, lit: ['d1out'] }),
      S('Exit', 'Press 4 BEAT/EXIT to leave the loop.', { t: 'loop', deck: 1, on: false }, { hl: ['d1exit'], arrows: { d1exit: 'press' } }),
      S('Instant 4-beat loop', 'Press 4 BEAT/EXIT again: instant 4-beat loop.', { t: 'loop', deck: 1, on: true }, { hl: ['d1exit'], arrows: { d1exit: 'press' } }),
      S('Exit again', 'Press 4 BEAT/EXIT to leave it.', { t: 'loop', deck: 1, on: false }, { hl: ['d1exit'], arrows: { d1exit: 'press' } })
    ],
    mistakes: ['Pressing OUT before IN.']
  });
  add('Intermediate', 'l16', 'Loop size & loop call', 'CUE/LOOP CALL ◀ ▶', 7, {
    why: 'While a loop plays, CUE/LOOP CALL ◀ halves it and ▶ doubles it. Halving again and again makes a classic build-up.',
    words: [['Loop call ◀ ▶', 'Half / double the loop size while looping.']],
    setup: { d1: 'warm', play: [1] },
    ready: [{ id: 'fader1', to: 1 }],
    steps: [
      S('Start a 4-beat loop', 'Press 4 BEAT/EXIT on Deck 1.', { t: 'loop', deck: 1, on: true }, { hl: ['d1exit'], arrows: { d1exit: 'press' } }),
      S('Halve it', 'Press CUE/LOOP CALL ◀ twice: 2 beats, then 1 beat.', { t: 'loopLen', deck: 1, beats: 1 }, { hl: ['d1callL'], arrows: { d1callL: 'press' } }),
      S('Double it back', 'Press ▶ twice to go back to 4 beats.', { t: 'loopLen', deck: 1, beats: 4 }, { hl: ['d1callR'], arrows: { d1callR: 'press' } }),
      S('Exit', 'Press 4 BEAT/EXIT to leave the loop.', { t: 'loop', deck: 1, on: false }, { hl: ['d1exit'] })
    ],
    mistakes: ['Pressing ◀ when no loop is on: it jumps to a cue instead.']
  });
  add('Intermediate', 'l17', 'Filter transitions', 'CFX knobs', 8, {
    why: 'The CFX knob is a filter: turn left to remove the highs (muffled), right to remove the lows (thin). Filtering the outgoing track is a smooth, easy transition.',
    words: [['Low-pass', 'CFX left: muffled, only bass.'], ['High-pass', 'CFX right: thin, no bass.']],
    setup: { d1: 'warm', d2: 'glass', play: [1, 2], sync: 2 },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 0 }, { id: 'cfx1', to: 0.5 }, { id: 'cfx2', to: 0.5 }],
    steps: [
      S('Muffle Deck 1', 'Turn CFX on Channel 1 left to about 9 o\'clock.', knob('cfx1', 0.25, { tol: 0.08 })),
      S('Back to normal', 'Turn it back to 12 o\'clock.', knob('cfx1', 0.5)),
      S('Thin out Deck 1', 'Turn CFX on Channel 1 right.', knob('cfx1', 0.8, { tol: 0.12 })),
      S('Bring in Deck 2', 'Push the Channel 2 fader up while Channel 1 is filtered.', knob('fader2', 1)),
      S('Take Deck 1 out', 'Pull the Channel 1 fader down, then set CFX 1 back to 12 o\'clock.', knob('fader1', 0))
    ],
    mistakes: ['Leaving the filter on after the mix.']
  });
  add('Intermediate', 'l18', 'Smart CFX', 'SMART CFX', 7, {
    why: 'SMART CFX turns the CFX knobs into big combined effects (filter + echo + more). It\'s built into the FLX4 hardware, so the app hears it but can\'t see the button.',
    words: [['Smart CFX', 'One-knob combined effects inside the FLX4.']],
    setup: { d1: 'warm', play: [1] },
    ready: [{ id: 'fader1', to: 1 }],
    steps: [
      S('Turn it on', 'Press SMART CFX (left side of the mixer). Its light turns on.', manual('It\'s on'), { hl: ['smartcfx'], arrows: { smartcfx: 'press' } }),
      S('Turn CFX 1', 'Turn CFX on Channel 1 slowly right, then left. Hear the effect.', { t: 'move', id: 'cfx1', amount: 0.8 }),
      S('Back to plain filter', 'Set CFX 1 to 12 o\'clock and press SMART CFX again to turn it off.', knob('cfx1', 0.5), { hl: ['cfx1', 'smartcfx'] })
    ],
    mistakes: ['Forgetting Smart CFX is on: the filter lesson will sound different.']
  });
  add('Intermediate', 'l19', 'Echo-out & cut transitions', 'BEAT FX, faders', 10, {
    why: 'An echo-out ends a track with an echo tail while you start the next one. It\'s the classic way to change between very different tracks.',
    words: [['Beat FX', 'Effects in time with the BPM: echo, reverb…'], ['Echo-out', 'Echo on, then fader down: only the echo tail remains.']],
    setup: { d1: 'warm', d2: 'bounce', play: [1] },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 0 }, { id: 'fxlevel', to: 0.5 }],
    steps: [
      S('Pick Echo', 'Press FX SELECT until the screen says Echo. Set the FX channel switch to 1.', { t: 'fxType', type: 0 }, { hl: ['fxsel', 'fxch'] }),
      S('Echo on, on the phrase', 'Press ON/OFF (BEAT FX) on beat 1 of the next phrase.', { t: 'fx', on: true }, { hl: ['fxon'], arrows: { fxon: 'press' }, lit: ['fxon'] }),
      S('Fader down fast', 'Pull the Channel 1 fader down within one bar. The echo tail keeps going.', knob('fader1', 0), { arrows: { fader1: 'down' } }),
      S('Start the new track', 'Push the Channel 2 fader up and press PLAY on Deck 2.', { t: 'playing', deck: 2 }, { hl: ['fader2', 'd2play'], order: { fader2: 1, d2play: 2 } }),
      S('Echo off', 'Press ON/OFF again to turn the echo off.', { t: 'fx', on: false }, { hl: ['fxon'] })
    ],
    mistakes: ['Echo on the wrong channel: check the 1 / 2 / 1&2 switch.']
  });
  add('Intermediate', 'l20', 'Intermediate mix challenge', 'everything so far', 20, {
    why: 'Mix three tracks using what you learned: EQ swaps, filters and an echo-out.',
    words: [['Set', 'A sequence of tracks played as one mix.']],
    setup: { d1: 'warm', d2: 'ferry', play: [1] },
    ready: READY_EQ, showList: true,
    steps: [S('Mix 3 tracks', 'Make 3 clean transitions. Use a bass swap at least once.', { t: 'transitions', count: 3 }, { hl: ['low1', 'low2', 'fader1', 'fader2'] })],
    mistakes: []
  });

  // ================= ADVANCED =================
  add('Advanced', 'l21', 'Harmonic mixing & keys', 'BROWSE, key display', 12, {
    why: 'Tracks are in musical keys. The Camelot wheel makes it easy: mix to the same number, ±1, or the same number with the other letter (8A → 8A, 7A, 9A, 8B).',
    words: [['Key', 'The musical scale a track uses.'], ['Camelot', 'Keys as numbers 1–12 and A (minor) / B (major).'], ['Clash', 'Keys that don\'t fit: sounds out of tune.']],
    setup: { d1: 'warm', play: [1] },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 0 }],
    showList: true,
    steps: [
      S('Which keys fit 8A?', '', quiz('Deck 1 is 8A. Which key mixes best?', ['9A', '3B', '1A'], 0, '8A goes well with 8A, 7A, 9A and 8B.')),
      S('Load a matching key', 'Browse to a track in 7A, 8A, 9A or 8B and press LOAD 2.', { t: 'compatKey', deck: 2 }, { hl: ['browse', 'load2'] }),
      S('Mix it', 'Sync Deck 2, start it on the phrase and blend it in. Listen: no clashing notes.', { t: 'transitions', count: 1 }, { hl: ['d2sync', 'd2play', 'fader2'] })
    ],
    mistakes: ['Only looking at BPM: a key clash sounds wrong even when the beats match.']
  });
  add('Advanced', 'l22', 'Beat FX in depth', 'BEAT FX, LEVEL/DEPTH', 11, {
    why: 'BEAT FX are in time with the music. BEAT ◀ ▶ changes the timing, LEVEL/DEPTH how strong. Short, well-timed effects sound pro; long ones get tiring.',
    words: [['Beat ◀ ▶', 'Effect timing: 1/4, 1/2, 1, 2 beats…'], ['Level/Depth', 'How much effect you hear.']],
    setup: { d1: 'warm', play: [1] },
    ready: [{ id: 'fader1', to: 1 }],
    steps: [
      S('Choose Reverb', 'Press FX SELECT until it says Reverb.', { t: 'fxType', type: 1 }, { hl: ['fxsel'], arrows: { fxsel: 'press' } }),
      S('Effect on', 'Press ON/OFF.', { t: 'fx', on: true }, { hl: ['fxon'], arrows: { fxon: 'press' }, lit: ['fxon'] }),
      S('More depth', 'Turn LEVEL/DEPTH to the right.', knob('fxlevel', 0.85, { tol: 0.15 })),
      S('Change the timing', 'Press BEAT ▶ to make it longer.', { t: 'fxBeat' }, { hl: ['fxbR'], arrows: { fxbR: 'press' } }),
      S('Effect off', 'Press ON/OFF to turn it off.', { t: 'fx', on: false }, { hl: ['fxon'] })
    ],
    mistakes: ['Leaving effects on for too long.']
  });
  add('Advanced', 'l23', 'Pad FX', 'PAD FX1 / PAD FX2', 9, {
    why: 'In PAD FX mode, holding a pad repeats a tiny slice of the beat (a "roll"). Let go and the track carries on as if nothing happened.',
    words: [['Roll', 'A short repeating slice while you hold the pad.']],
    setup: { d1: 'warm', play: [1] },
    ready: [{ id: 'fader1', to: 1 }],
    steps: [
      S('PAD FX mode', 'Press PAD FX1 above the Deck 1 pads.', press('d1mFx'), { arrows: { d1mFx: 'press' } }),
      S('Hold a pad', 'Hold pad 3 for one bar, then let go.', { t: 'roll', deck: 1, count: 1 }, { hl: ['d1p3'], arrows: { d1p3: 'hold' } }),
      S('Build-up', 'Hold pads 4, 3, 2, 1 one after another (big to small).', { t: 'roll', deck: 1, count: 4 }, { hl: ['d1p4', 'd1p3', 'd1p2', 'd1p1'], order: { d1p4: 1, d1p3: 2, d1p2: 3, d1p1: 4 } })
    ],
    mistakes: ['Holding too long: keep rolls short.']
  });
  add('Advanced', 'l24', 'Beat jump & beat loop', 'BEAT JUMP pads', 9, {
    why: 'BEAT JUMP pads skip forward or back by whole beats, staying in time. Use them to fix phrasing or skip a boring part.',
    words: [['Beat jump', 'Skip by 1, 2, 4 or 8 beats.']],
    setup: { d1: 'warm', play: [1] },
    ready: [{ id: 'fader1', to: 1 }],
    steps: [
      S('BEAT JUMP mode', 'Press BEAT JUMP above the Deck 1 pads.', press('d1mJump'), { arrows: { d1mJump: 'press' } }),
      S('Jump back 1 beat', 'Press pad 1 (back 1 beat).', { t: 'beatjump', deck: 1, count: 1 }, { hl: ['d1p1'], arrows: { d1p1: 'press' } }),
      S('Jump around', 'Try pads 2–8: forward and back 2, 4 and 8 beats. Do 4 jumps.', { t: 'beatjump', deck: 1, count: 5 }, { hl: ['d1p2', 'd1p4', 'd1p6', 'd1p8'] })
    ],
    mistakes: ['Jumping by odd amounts in a mix: stick to 4 or 8 beats to stay on the phrase.']
  });
  add('Advanced', 'l25', 'Scratching: baby scratch', 'JOG top', 12, {
    why: 'The baby scratch is the first scratch: push the record forward and pull it back, in time with the beat. On the FLX4 you scratch by touching the TOP of the jog wheel.',
    words: [['Baby scratch', 'Forward and back movement with no fader work.'], ['Cue point', 'Where the sound starts: you scratch from here.']],
    setup: { d1: 'chirps', d2: 'bounce', play: [2] },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 1 }, { id: 'xfader', to: 0.5 }],
    steps: [
      S('Set the cue point', 'Press CUE on Deck 1 to jump to the sample start.', press('d1cue'), { arrows: { d1cue: 'press' }, lit: ['d1cue'] }),
      S('Push forward', 'Hand flat on top of the Deck 1 jog: push it forward a little.', { t: 'scratch', deck: 1, count: 1 }, { arrows: { d1jog: 'scratch' } }),
      S('Push and pull', 'Now push and pull, back and forth. Do 8 moves.', { t: 'scratch', deck: 1, count: 8 }, { arrows: { d1jog: 'scratch' } }),
      S('On the beat', 'Scratch along with the drum loop on Deck 2 for 20 seconds.', { t: 'scratchTime', deck: 1, seconds: 20 }, { arrows: { d1jog: 'scratch' } })
    ],
    mistakes: ['Touching the side of the jog: only the top scratches.', 'Pushing too far: small moves sound cleaner.']
  });
  add('Advanced', 'l26', 'Scratching: chirps & transforms', 'JOG, crossfader', 14, {
    why: 'Add the crossfader: cut the sound in and out while you scratch. Chirps and transforms are built from this.',
    words: [['Chirp', 'Fader closes as the record moves back.'], ['Transform', 'Fast fader taps during a long push.']],
    setup: { d1: 'chirps', d2: 'bounce', play: [2] },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 1 }],
    steps: [
      S('Crossfader to Deck 1', 'Move the crossfader to the left.', knob('xfader', 0)),
      S('Cut while scratching', 'Scratch with your left hand and flick the crossfader with your right. Do 6 cuts while scratching.', { t: 'scratchCut', deck: 1, count: 6 }, { hl: ['d1jog', 'xfader'], order: { d1jog: 1, xfader: 2 } })
    ],
    mistakes: ['Moving the fader too far: a small flick is enough.']
  });
  add('Advanced', 'l27', 'Sampler & pad drumming', 'SAMPLER pads', 10, {
    why: 'SAMPLER mode turns the pads into a drum machine and sound board: kick, snare, clap, horn, riser…',
    words: [['Sampler', 'Short sounds on the pads.']],
    setup: { d1: 'warm', play: [1] },
    ready: [{ id: 'fader1', to: 1 }],
    steps: [
      S('SAMPLER mode', 'Press SAMPLER above the Deck 1 pads.', press('d1mSamp'), { arrows: { d1mSamp: 'press' } }),
      S('Play some sounds', 'Press the pads to hear the sounds: kick, snare, clap, hat, horn, riser, laser, vox.', { t: 'samples', count: 6 }, { hl: ['d1p1', 'd1p2', 'd1p3', 'd1p4', 'd1p5', 'd1p6', 'd1p7', 'd1p8'] }),
      S('Clap on the beat', 'Tap pad 3 (clap) on beat 1 of 4 bars.', { t: 'onBar', id: 'd1p3', deck: 1, every: 1, count: 4, tol: 0.4 }, { arrows: { d1p3: 'tap' } })
    ],
    mistakes: ['Too many samples: less is more.']
  });
  add('Advanced', 'l28', 'Tempo range & big changes', 'SHIFT + BEAT SYNC', 9, {
    why: 'The TEMPO slider normally moves ±10%. Hold SHIFT and press BEAT SYNC to change the range (6, 10, 16 or 100%). Small range = fine control; big range = big changes.',
    words: [['Tempo range', 'How far the slider can change the BPM.']],
    setup: { d1: 'warm', d2: 'bounce', play: [1] },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 0 }],
    steps: [
      S('Change the range', 'Hold SHIFT on Deck 2 and press BEAT SYNC.', { t: 'tempoRange', deck: 2 }, { hl: ['d2shift', 'd2sync'], order: { d2shift: 1, d2sync: 2 } }),
      S('Which range for 92 → 124 BPM?', '', quiz('To play a 92 BPM track at 124 BPM you need…', ['±6%', '±10%', '±100% (or SYNC)'], 2, '124 is 35% faster than 92, so you need a wide range.'))
    ],
    mistakes: ['Wide range = touchy slider: go back to ±10% for normal mixing.']
  });
  add('Advanced', 'l29', 'Double drops', 'both decks, LOW EQ', 11, {
    why: 'A double drop plays two drops at the same moment. They must be synced and phrased perfectly, and only one bass line can play.',
    words: [['Drop', 'Where the full beat and bass come in.'], ['Double drop', 'Two tracks dropping together.']],
    setup: { d1: 'warm', d2: 'glass', play: [1] },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 0 }, { id: 'low1', to: 0.5 }, { id: 'low2', to: 0 }],
    steps: [
      S('Sync Deck 2', 'Press BEAT SYNC on Deck 2.', { t: 'sync', deck: 2 }, { arrows: { d2sync: 'press' } }),
      S('Start on the phrase', 'Start Deck 2 on beat 1 of the next phrase.', { t: 'onBar', id: 'd2play', deck: 1, every: 16, count: 1, tol: 0.5 }, { arrows: { d2play: 'press' } }),
      S('Drop both', 'At the next phrase, push the Channel 2 fader up fast. LOW 2 stays cut.', { t: 'together', parts: [{ id: 'fader2', to: 1 }], deck: 1, every: 16, tol: 2 }, { arrows: { fader2: 'up' } })
    ],
    mistakes: ['Two bass lines at once: keep one LOW cut.']
  });
  add('Advanced', 'l30', 'Advanced mix challenge', 'everything so far', 25, {
    why: 'A full mix with loops, effects and key changes. Four transitions, at least one harmonic.',
    words: [],
    setup: { d1: 'paper', d2: 'peak', play: [1] },
    ready: READY_EQ, showList: true,
    steps: [S('Mix 4 tracks', 'Make 4 clean transitions using any skills you like.', { t: 'transitions', count: 4 })],
    mistakes: []
  });

  // ================= PRO =================
  add('Pro', 'l31', 'House & tech house sets', 'long blends, EQ', 12, {
    why: 'House DJs blend for a long time: 16 or 32 bars with both tracks playing, slowly trading HI, MID and LOW.',
    words: [['Long blend', 'Both tracks playing together for 16–32 bars.']],
    setup: { d1: 'warm', d2: 'paper', play: [1] },
    ready: READY_EQ,
    steps: [
      S('Sync and start on the phrase', 'Sync Deck 2 and start it on beat 1 of the next phrase.', { t: 'onBar', id: 'd2play', deck: 1, every: 16, count: 1, tol: 0.5 }, { hl: ['d2sync', 'd2play'], order: { d2sync: 1, d2play: 2 } }),
      S('Bring in the highs', 'Turn HI 2 and MID 2 down, raise fader 2, then bring HI 2 up first.', knob('hi2', 0.5), { hl: ['hi2', 'mid2', 'fader2'] }),
      S('Hold the blend', 'Keep both tracks playing together for 16 bars.', { t: 'bothPlaying', seconds: 16 * 4 * 60 / 124 }),
      S('Swap the bass', 'Swap LOW 1 and LOW 2 on the next phrase.', { t: 'together', parts: [{ id: 'low1', to: 0 }, { id: 'low2', to: 0.5 }], deck: 1, every: 16, tol: 2 }, { order: { low1: 1, low2: 2 } })
    ],
    mistakes: []
  });
  add('Pro', 'l32', 'Hip-hop: quick cuts', 'CUE, crossfader', 11, {
    why: 'Hip-hop DJs change tracks fast: a quick crossfader cut on beat 1 instead of a long blend.',
    words: [['Cut', 'Switching instantly from one deck to the other.']],
    setup: { d1: 'bounce', d2: 'corner', play: [1] },
    ready: [{ id: 'fader1', to: 1 }, { id: 'fader2', to: 1 }, { id: 'xfader', to: 0 }],
    steps: [
      S('Sync and play Deck 2', 'Press BEAT SYNC then PLAY on Deck 2 (crossfader is left, so nobody hears it yet).', { t: 'playing', deck: 2 }, { hl: ['d2sync', 'd2play'], order: { d2sync: 1, d2play: 2 } }),
      S('Cut on beat 1', 'Flick the crossfader fully right exactly on beat 1 of a bar.', { t: 'cut', to: 1, deck: 1, tol: 0.5 }, { arrows: { xfader: 'toright' } }),
      S('Cut back', 'Now cut back to the left on beat 1.', { t: 'cut', to: 0, deck: 2, tol: 0.5 }, { arrows: { xfader: 'toleft' } })
    ],
    mistakes: []
  });
  add('Pro', 'l33', 'Drum & bass at 174 BPM', 'TEMPO, JOG', 11, {
    why: 'Drum & bass is fast (170–176 BPM) and its phrases are often 32 bars. Mixing is the same idea, just quicker hands.',
    words: [['Half-time', '174 BPM feels like 87: count every other kick.']],
    setup: { d1: 'rail', play: [1] },
    ready: [{ id: 'fader1', to: 1 }],
    steps: [
      S('How fast?', '', quiz('Rail Runner is 174 BPM. How does it feel to dance to?', ['Like 87 BPM (half-time)', 'Like 348 BPM'], 0, 'DnB is often felt at half the speed.')),
      S('Catch the phrase', 'Press SHIFT on beat 1 of the next 16-bar phrase.', { t: 'onBar', id: 'd1shift', deck: 1, every: 16, count: 1, tol: 0.6 }, { arrows: { d1shift: 'tap' } })
    ],
    mistakes: []
  });
  add('Pro', 'l34', 'Building a set & energy flow', 'library crates', 13, {
    why: 'A good set has a shape: warm up, build, peak, cool down. Order tracks by energy and BPM, and keep keys compatible.',
    words: [['Energy', 'How intense a track feels.']],
    setup: {}, showList: true,
    steps: [
      S('Opening track', '', quiz('Which track opens a house set best?', ['Peak Hour (128, tech)', 'Night Ferry (124, deep)', 'Rail Runner (174, DnB)'], 1, 'Start deep and warm; save the peak for later.')),
      S('Peak time', '', quiz('Which track is best for the peak?', ['Peak Hour (128 BPM)', 'Low Tide (85 lo-fi)'], 0, 'Faster and harder for the peak.')),
      S('Raising the BPM', '', quiz('How do you raise the BPM across a set?', ['A few BPM at a time', 'Jump from 118 to 128 at once'], 0, 'Small steps keep the dance floor with you.'))
    ],
    mistakes: []
  });
  add('Pro', 'l35', 'Reading the crowd', 'track choices', 10, {
    why: 'Watch the dance floor. Full and happy: keep the energy. Emptying: change direction (genre, BPM, a well-known track).',
    words: [['Reading the room', 'Choosing tracks based on how people react.']],
    setup: {},
    steps: [
      S('The floor empties', '', quiz('Half the floor leaves after your new track. What now?', ['Play the same style louder', 'Mix out soon into something more familiar', 'Stop the music'], 1, 'Change direction smoothly.')),
      S('Everyone is dancing', '', quiz('Everyone is dancing hard. What now?', ['Keep the energy going', 'Drop to slow lo-fi'], 0, 'Don\'t break a good moment.'))
    ],
    mistakes: []
  });
  add('Pro', 'l36', 'Using a microphone', 'MIC LEVEL', 7, {
    why: 'The FLX4 has a mic input on the back (1/4" jack). MIC LEVEL sets its volume on the hardware. Keep announcements short, over the intro or outro.',
    words: [['MIC LEVEL', 'Microphone volume on the FLX4.']],
    setup: { d1: 'warm', play: [1] },
    ready: [{ id: 'fader1', to: 1 }],
    steps: [
      S('Plug in a mic', 'Plug a microphone into MIC on the back of the FLX4.', manual('Done')),
      S('Set the level', 'Turn MIC LEVEL up slowly while you talk, until your voice is clear over the music.', manual('Sounds good'), { hl: ['mic'] }),
      S('When to talk?', '', quiz('When is the best moment to talk on the mic?', ['Over the drop', 'Over an intro or a quiet part'], 1, 'Talk where the music leaves space.'))
    ],
    mistakes: ['Talking over vocals.']
  });
  add('Pro', 'l37', 'Recording your mix', 'app recorder, MASTER', 8, {
    why: 'Record your mixes to listen back. You\'ll hear mistakes you missed while playing. CueLab records the master output to a file.',
    words: [['Recording', 'Saving your mix as an audio file.']],
    setup: { d1: 'warm', d2: 'glass', play: [1] },
    ready: READY_STD,
    steps: [
      S('Start recording', 'Click "Record mix" at the top of this screen.', { t: 'rec', on: true }),
      S('Mix for a minute', 'Do one transition while recording.', { t: 'transitions', count: 1 }),
      S('Stop recording', 'Click "Stop recording". The file is saved to your Downloads.', { t: 'rec', on: false })
    ],
    mistakes: []
  });
  add('Pro', 'l38', 'Final exam: 30-minute set', 'everything', 35, {
    why: 'Your final exam: a 30-minute set with at least 6 transitions. Use everything: phrasing, EQ, filters, effects, loops, keys.',
    words: [],
    setup: { d1: 'ferry', play: [1] },
    ready: READY_EQ, showList: true,
    steps: [
      S('Play a 30-minute set', 'Mix for 30 minutes with at least 6 transitions.', { t: 'setExam', minutes: 30, transitions: 6 })
    ],
    mistakes: []
  });

  // numbering + defaults
  L.forEach((l, i) => { l.n = i + 1; });
  CL.lessons = L;
  CL.lessonById = id => L.find(l => l.id === id);
  CL.tiers = ['Basic', 'Intermediate', 'Advanced', 'Pro'];
})(window.CL);
