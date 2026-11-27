"use strict";
/* =====================================================
   scope.js : live oscilloscope + spectrum analyser.
   The same numbers that draw the wave also drive the
   speakers, so what you SEE is what you HEAR.
   ===================================================== */
const Scope = (() => {
  const cvs = [$("scope"), $("archScope")];
  const ctxs = cvs.map(c => c.getContext("2d"));
  const N = 400, trace = new Array(N).fill(0);
  const loopPat = Array.from({ length: 36 }, () => (Math.random() - 0.5) * 1.2);  // the "looped" mimic pattern
  let amp = 0, target = 0, tick = 0, speaking = false, script = null;
  let glitchT = 0, glitchMode = null, jitterT = 0, integrity = 0.96, mode = "scope", running = false;

  /* One sample of the waveform. Humans: smooth syllables. Mimics: sometimes glitch. */
  function sample() {
    tick++;
    if (speaking) { if (tick % 5 === 0) target = Math.random() < 0.2 ? 0.08 : 0.3 + Math.random() * 0.6; amp += (target - amp) * 0.25; }
    else amp += (0.02 - amp) * 0.1;
    let v = Math.sin(tick * 0.9) * amp * (0.7 + 0.3 * Math.sin(tick * 0.23)) + (Math.random() - 0.5) * 0.04;
    let hz = 120 + amp * 90, type = "sawtooth", vol = Math.min(amp, 1) * 0.12, noise = 0.04;
    let goal = 0.96 - Math.random() * 0.04;

    // DECOY: random radio interference hits humans too (messy and random, never geometric)
    if (speaking && jitterT <= 0 && Math.random() < 0.01) jitterT = 8 + (Math.random() * 10 | 0);
    if (jitterT > 0) { jitterT--; v += (Math.random() - 0.5) * 0.6; noise = 0.12; goal = 0.6 + Math.random() * 0.2; }

    // MIMIC: unnatural geometric glitches
    if (speaking && script && script.mimic) {
      if (glitchT <= 0 && Math.random() < 0.014) { glitchT = 18 + (Math.random() * 25 | 0); glitchMode = script.glitch; }
      if (glitchT > 0) {
        glitchT--; goal = 0.2 + Math.random() * 0.25;
        if (glitchMode === "spike") { v = (tick % 6 < 3 ? 1 : -1) * (0.5 + 0.4 * ((tick >> 2) & 1)); type = "square"; hz = 310; vol = 0.1; }
        else if (glitchMode === "flat") { v = 0; vol = 0; noise = 0.003; }                          // dead flatline
        else if (glitchMode === "loop") { v = loopPat[tick % loopPat.length]; type = "triangle"; hz = 160; vol = 0.1; }  // exact repeat
        else { v = Math.sin(tick * 0.08) * 0.85; type = "sine"; hz = 38; vol = 0.4; }               // sub-bass throb
      }
    }
    integrity += (goal - integrity) * 0.15;
    SFX.setVoice({ type, hz, vol, noise });
    return v;
  }

  function grid(cx, w, h) {
    cx.strokeStyle = "rgba(51,255,102,0.12)"; cx.lineWidth = 1; cx.beginPath();
    for (let x = 0; x <= w; x += w / 10) { cx.moveTo(x, 0); cx.lineTo(x, h); }
    for (let y = 0; y <= h; y += h / 6) { cx.moveTo(0, y); cx.lineTo(w, y); }
    cx.stroke();
  }

  function drawSpectrum(cx, w, h) {
    const s = SFX.getSpectrum(), bars = 64, bw = w / bars;
    cx.fillStyle = "#33ff66"; cx.shadowColor = "#33ff66"; cx.shadowBlur = 8;
    for (let i = 0; i < bars; i++) {
      let v = 0;
      if (s) {
        const a = Math.floor(Math.pow(250, i / bars)), b = Math.max(a + 1, Math.floor(Math.pow(250, (i + 1) / bars)));
        for (let k = a; k < b && k < s.data.length; k++) v = Math.max(v, s.data[k]);
      }
      const bh = v / 255 * (h - 34);
      cx.fillRect(i * bw + 1, h - 20 - bh, bw - 2, bh);
    }
    cx.shadowBlur = 0; cx.fillStyle = "rgba(51,255,102,.7)"; cx.font = "12px Courier New";
    if (s) [50, 200, 1000, 4000].forEach(f => {
      const idx = f / s.binHz; if (idx < 1) return;
      cx.fillText(f >= 1000 ? f / 1000 + "k" : f + "Hz", Math.log(idx) / Math.log(250) * w, h - 5);
    });
    cx.fillText("FFT // VOICE BAND", 8, 14);
  }

  function drawOne(cv, cx) {
    const w = cv.width, h = cv.height;
    cx.fillStyle = "rgba(0,8,2,0.28)"; cx.fillRect(0, 0, w, h);          // phosphor persistence
    grid(cx, w, h);
    if (mode === "spectrum" && cv.id === "scope") { drawSpectrum(cx, w, h); return; }
    cx.strokeStyle = "#33ff66"; cx.lineWidth = 2.2; cx.shadowColor = "#33ff66"; cx.shadowBlur = 12; cx.beginPath();
    trace.forEach((v, i) => { const x = i / (N - 1) * w, y = h / 2 - v * h * 0.42; i ? cx.lineTo(x, y) : cx.moveTo(x, y); });
    cx.stroke(); cx.shadowBlur = 0;
    cx.fillStyle = "rgba(51,255,102,.7)"; cx.font = "12px Courier New"; cx.fillText("CH-1 // VOICE", 8, 14);
  }

  function frame() {
    trace.push(sample()); trace.shift();
    cvs.forEach((cv, i) => { if (cv.offsetParent) drawOne(cv, ctxs[i]); });   // skip hidden canvases
    requestAnimationFrame(frame);
  }

  return {
    start() { if (!running) { running = true; frame(); } },
    setSpeaker(s) { script = s; glitchT = 0; jitterT = 0; },
    setSpeaking(b) { speaking = b; },
    setMode(m) { mode = m; },
    get mode() { return mode; },
    get integrity() { return integrity; },
    get glitching() { return glitchT > 0; }
  };
})();