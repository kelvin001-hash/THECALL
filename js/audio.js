"use strict";
/* =====================================================
   audio.js : every sound is synthesised with the Web
   Audio API. No audio files exist anywhere in this project.
   ===================================================== */
const SFX = (() => {
  let ac = null, master, noiseBuf, staticGain, voiceOsc, voiceGain, analyser;
  let droneGain, droneLP, heartTimer = null, tapeNodes = null, spec = null;
  let voiceType = "sawtooth", volume = 0.7, muted = false;

  /* ---------- start the engine (must be triggered by a click) ---------- */
  function init() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = muted ? 0 : volume;
    const comp = ac.createDynamicsCompressor();       // keeps scares loud but not clipping
    master.connect(comp); comp.connect(ac.destination);

    // shared white-noise buffer
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // looping radio static
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.5;
    staticGain = ac.createGain(); staticGain.gain.value = 0.04;
    s.connect(bp); bp.connect(staticGain); staticGain.connect(master); s.start();

    // the "voice": pitch and volume follow the waveform every frame (see scope.js)
    voiceOsc = ac.createOscillator(); voiceOsc.type = "sawtooth"; voiceOsc.frequency.value = 120;
    const vib = ac.createOscillator(), vg = ac.createGain();   // slight natural vibrato
    vib.frequency.value = 5.5; vg.gain.value = 4; vib.connect(vg); vg.connect(voiceOsc.frequency); vib.start();
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    voiceGain = ac.createGain(); voiceGain.gain.value = 0;
    voiceOsc.connect(lp); lp.connect(voiceGain); voiceGain.connect(master);
    analyser = ac.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.7;
    voiceGain.connect(analyser);                       // feeds the Spectrum view
    voiceOsc.start();

    startDrone();
  }

  /* ---------- low drone + wind (the tower's constant dread) ---------- */
  function startDrone() {
    droneGain = ac.createGain(); droneGain.gain.value = 0.05;
    droneLP = ac.createBiquadFilter(); droneLP.type = "lowpass"; droneLP.frequency.value = 180;
    [55, 55.6, 82.6].forEach((f, i) => {
      const o = ac.createOscillator(); o.type = i === 2 ? "sine" : "sawtooth"; o.frequency.value = f;
      o.connect(droneLP); o.start();
    });
    droneLP.connect(droneGain); droneGain.connect(master);
    const l = ac.createOscillator(), lg = ac.createGain();      // slow breathing swell
    l.frequency.value = 0.07; lg.gain.value = 0.025; l.connect(lg); lg.connect(droneGain.gain); l.start();

    const w = ac.createBufferSource(); w.buffer = noiseBuf; w.loop = true;   // howling wind
    const wf = ac.createBiquadFilter(); wf.type = "lowpass"; wf.frequency.value = 500; wf.Q.value = 4;
    const wg = ac.createGain(); wg.gain.value = 0.05;
    const wl = ac.createOscillator(), wlg = ac.createGain();
    wl.frequency.value = 0.11; wlg.gain.value = 300; wl.connect(wlg); wlg.connect(wf.frequency); wl.start();
    w.connect(wf); wf.connect(wg); wg.connect(master); w.start();
  }
  function setTension(t) {                              // t = 0..1, grows with each call
    if (!ac) return;
    droneGain.gain.setTargetAtTime(0.05 + 0.08 * t, ac.currentTime, 1);
    droneLP.frequency.setTargetAtTime(180 + 220 * t, ac.currentTime, 1);
  }

  /* ---------- low-level helpers ---------- */
  function out(node, pan) {                             // route to master, optionally panned L/R
    if (pan && ac.createStereoPanner) {
      const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(master);
    } else node.connect(master);
  }
  function tone(type, f, dur, vol, f2, pan, delay) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); out(g, pan); o.start(t); o.stop(t + dur + 0.02);
  }
  function burst(dur, vol, freq, q, pan, delay) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = noiseBuf; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let n = s;
    if (freq) { const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q || 1; s.connect(f); n = f; }
    n.connect(g); out(g, pan); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  /* ---------- interface sounds ---------- */
  const click = () => { tone("square", 150, 0.05, 0.15, 60); burst(0.04, 0.12); };
  async function ring() { for (let i = 0; i < 3; i++) { tone("sine", 880, 0.18, 0.2); await sleep(280); } }
  const relief = () => { tone("sine", 523, 0.4, 0.15); tone("sine", 659, 0.5, 0.15, 0, 0, 0.18); };
  const clunk = () => { tone("square", 80, 0.12, 0.3, 40); burst(0.1, 0.3, 1200, 1); };

  /* ---------- big sounds ---------- */
  function siren(sec) {                                 // eerie wailing alarm
    if (!ac) return;
    const o = ac.createOscillator(), l = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain(), t = ac.currentTime;
    o.type = "sawtooth"; o.frequency.value = 650; l.frequency.value = 0.9; lg.gain.value = 320;
    l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.4);
    g.gain.setValueAtTime(0.25, t + sec - 0.6); g.gain.linearRampToValueAtTime(0.0001, t + sec);
    o.connect(g); out(g); o.start(t); l.start(t); o.stop(t + sec); l.stop(t + sec);
  }
  function breach() { burst(1.2, 0.6); tone("sine", 45, 3, 0.6, 25); tone("sawtooth", 200, 2.5, 0.2, 30); }
  function screech() {                                  // distorted jumpscare scream
    if (!ac) return;
    const t = ac.currentTime, ws = ac.createWaveShaper(), g = ac.createGain();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 8);
    ws.curve = curve;
    const o = ac.createOscillator(), o2 = ac.createOscillator();
    o.type = "sawtooth"; o2.type = "square";
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(2600, t + 0.35); o.frequency.exponentialRampToValueAtTime(300, t + 1.1);
    o2.frequency.setValueAtTime(1330, t); o2.frequency.exponentialRampToValueAtTime(3100, t + 0.4); o2.frequency.exponentialRampToValueAtTime(420, t + 1.1);
    g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(ws); o2.connect(ws); ws.connect(g); out(g);
    o.start(t); o2.start(t); o.stop(t + 1.25); o2.stop(t + 1.25);
    burst(1, 0.5, 3000, 0.5); tone("sine", 50, 1.2, 0.5, 28);
  }
  function swell(dur) {                                 // reversed-sound effect: rises then cuts dead
    if (!ac) return; dur = dur || 2.2;
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = "lowpass"; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(5000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.45, t + dur); g.gain.setValueAtTime(0.0001, t + dur + 0.02);
    s.connect(f); f.connect(g); out(g); s.start(t, 0.2); s.stop(t + dur + 0.05);
    tone("sawtooth", 80, dur, 0.1, 400);
    tone("sine", 55, 0.5, 0.6, 30, 0, dur + 0.02);
  }

  /* ---------- haunting ambience ---------- */
  function knock(pan) {                                 // two slow, one fast
    [0, 0.5, 0.8].forEach(d => { tone("sine", 95, 0.12, 0.6, 50, pan, d); burst(0.08, 0.35, 500, 1, pan, d); });
  }
  function steps(n, pan) {
    for (let i = 0; i < n; i++) {
      const p = (pan || 0) * (i % 2 ? 0.6 : 1);
      tone("sine", 62, 0.14, 0.45, 34, p, i * 0.55); burst(0.09, 0.18, 260, 1, p, i * 0.55);
    }
  }
  function creak(pan) {                                 // old wood / metal groan
    if (!ac) return;
    const t = ac.currentTime, d = rand(1, 1.8), o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = "sawtooth"; f.type = "bandpass"; f.frequency.value = rand(300, 700); f.Q.value = 9;
    o.frequency.setValueAtTime(rand(60, 90), t);
    for (let i = 1; i < 8; i++) o.frequency.linearRampToValueAtTime(rand(50, 140), t + d * i / 8);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14, t + d * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + d);
    o.connect(f); f.connect(g); out(g, pan); o.start(t); o.stop(t + d + 0.05);
  }
  function whisper(dur, pan, vol) {                     // formant-filtered noise = breathy speech
    if (!ac) return;
    const t = ac.currentTime, s = ac.createBufferSource(), g = ac.createGain();
    const f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter();
    s.buffer = noiseBuf; s.loop = true;
    f1.type = f2.type = "bandpass"; f1.Q.value = 6; f2.Q.value = 8; f1.frequency.value = 600; f2.frequency.value = 2000;
    s.connect(f1); s.connect(f2); f1.connect(g); f2.connect(g);
    g.gain.setValueAtTime(0, t);
    for (let x = 0; x < dur; x += 0.11) {               // random "syllables"
      g.gain.linearRampToValueAtTime(Math.random() < 0.25 ? 0.01 : rand(1, 3) * (vol || 1), t + x + 0.05);
      f1.frequency.linearRampToValueAtTime(rand(400, 900), t + x + 0.05);
      f2.frequency.linearRampToValueAtTime(rand(1400, 3000), t + x + 0.05);
    }
    g.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    out(g, pan); s.start(t); s.stop(t + dur + 0.2);
  }
  function musicBox(vol, pan, speed) {                  // out-of-tune, slightly flat music box
    const m = [440, 523.25, 659.25, 587.33, 523.25, 493.88, 440, 415.3, 440, 329.63, 392, 440, 493.88, 440];
    m.forEach((f, i) => {
      const d = i * 0.42 / (speed || 1), fl = f * (0.97 + Math.random() * 0.02);
      tone("sine", fl, 1.3, vol || 0.12, 0, pan, d);
      tone("sine", fl * 3.01, 0.6, (vol || 0.12) * 0.25, 0, pan, d);
    });
  }
  function setHeart(bpm) {                              // 0 = stop
    clearInterval(heartTimer); heartTimer = null;
    if (!ac || !bpm) return;
    const thump = () => { tone("sine", 70, 0.18, 0.5, 38); tone("sine", 60, 0.2, 0.35, 34, 0, 0.17); };
    thump(); heartTimer = setInterval(thump, 60000 / bpm);
  }

  /* ---------- old tape playback (used by the Log Archive) ---------- */
  function tape(on) {
    if (!ac) return;
    if (on && !tapeNodes) {
      const l = ac.createOscillator(), lg = ac.createGain();       // wow & flutter on the voice pitch
      l.frequency.value = 0.7; lg.gain.value = 70; l.connect(lg); lg.connect(voiceOsc.detune); l.start();
      const s = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; s.loop = true; hp.type = "highpass"; hp.frequency.value = 4000; g.gain.value = 0.06;
      s.connect(hp); hp.connect(g); g.connect(master); s.start();   // tape hiss
      tapeNodes = { l, lg, s };
    } else if (!on && tapeNodes) {
      tapeNodes.l.stop(); tapeNodes.s.stop();
      try { tapeNodes.lg.disconnect(); } catch (e) {}
      tapeNodes = null;
    }
  }

  /* ---------- voice + spectrum (driven by scope.js) ---------- */
  function setVoice(p) {
    if (!ac) return;
    const t = ac.currentTime;
    if (p.type !== voiceType) { voiceOsc.type = p.type; voiceType = p.type; }
    voiceGain.gain.setTargetAtTime(p.vol, t, 0.02);
    voiceOsc.frequency.setTargetAtTime(p.hz, t, 0.02);
    staticGain.gain.setTargetAtTime(p.noise, t, 0.05);
  }
  function getSpectrum() {
    if (!analyser) return null;
    if (!spec) spec = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(spec);
    return { data: spec, binHz: ac.sampleRate / analyser.fftSize };
  }

  /* ---------- settings ---------- */
  function apply() { if (ac) master.gain.setTargetAtTime(muted ? 0 : volume, ac.currentTime, 0.05); }
  const setVolume = v => { volume = v; apply(); };
  const setMuted = m => { muted = m; apply(); };

  return { init, setVolume, setMuted, tone, burst, click, ring, relief, clunk, siren, breach, screech, swell,
           knock, steps, creak, whisper, musicBox, setHeart, setTension, tape, setVoice, getSpectrum };
})();