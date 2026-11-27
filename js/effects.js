"use strict";
/* =====================================================
   effects.js : screen-level scares and visual effects
   ===================================================== */
const FX = (() => {
  const crt = $("crt");
  let flashesOn = true;

  /* apply the CRT / photosensitivity settings */
  function setOptions(o) {
    flashesOn = o.flashes;
    crt.classList.toggle("nofx", !o.fx);
    crt.classList.toggle("noflash", !o.flashes);
  }
  function flash(color, ms) {
    if (!flashesOn) return;
    const f = $("flash"); f.style.background = color || "#fff"; f.style.opacity = 1;
    setTimeout(() => { f.style.opacity = 0; }, ms || 80);
  }
  function shake(ms) {
    if (!flashesOn) return;
    crt.classList.add("shake"); setTimeout(() => crt.classList.remove("shake"), ms || 400);
  }
  function staticBurst(ms) {
    const n = $("noise"); n.classList.add("burst"); SFX.burst(ms / 1000, 0.1);
    setTimeout(() => n.classList.remove("burst"), ms);
  }
  const redAlert = on => crt.classList.toggle("alert", on);

  /* the power cuts out for a moment (skipped when flashes are disabled) */
  async function lightsOut(ms) {
    if (!flashesOn) return;
    crt.classList.add("dark"); SFX.clunk(); await sleep(ms || 900);
    crt.classList.remove("dark"); await sleep(120);
    crt.classList.add("dark"); await sleep(90);
    crt.classList.remove("dark"); SFX.clunk();
  }

  /* subliminal text that appears somewhere random for a split second */
  function ghost(text, ms) {
    const g = $("ghost");
    g.textContent = text.replace(/\{name\}/g, G.name);
    g.style.left = rand(6, 55) + "%"; g.style.top = rand(15, 80) + "%";
    g.classList.add("show");
    setTimeout(() => g.classList.remove("show"), flashesOn ? (ms || 420) : 1500);
  }

  /* full-screen ASCII monster */
  async function jumpscare() {
    SFX.screech();
    if (!flashesOn) return;
    const s = $("scare"); $("scareFace").textContent = FACES[0];
    s.classList.remove("hidden"); flash("#fff", 60); shake(900);
    for (let i = 0; i < 6; i++) {
      s.style.transform = `translate(${rand(-20, 20)}px,${rand(-20, 20)}px) scale(${rand(1, 1.15)})`;
      await sleep(110);
    }
    s.style.transform = ""; s.classList.add("hidden");
  }

  return { setOptions, flash, shake, staticBurst, redAlert, lightsOut, ghost, jumpscare };
})();