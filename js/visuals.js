"use strict";
/* =====================================================
   visuals.js : door CCTV, proximity radar, call tracker,
   status lamps and event pop-ups for THECALL.
   Needs data.js ($, rand) and audio.js (SFX) loaded first.
   ===================================================== */
const Viz = (() => {
  const TAU = Math.PI * 2;
  const cc = $("cctv"), cx = cc.getContext("2d"), rc = $("radar"), rx = rc.getContext("2d");
  const CW = cc.width, CH = cc.height, GY = 112;            // camera size and ground line
  const RS = rc.width, RC = RS / 2, RR = RS / 2 - 10;       // radar size, centre, radius

  /* ---------- state ---------- */
  let f = 0, cur = 0, script = null, tok = 0;
  let mode = "idle", mf = 0, kind = "", door = 0, strobe = 0, statics = 0, fig = null;
  let rMode = "none", theta = 0, wob = 0, dist = 1, patience = 1, waitF = 0, sweep = 0;
  let jx = 0, jy = 0, jumpT = 150, ghost = null, pings = [], bx = RC, by = RC;

  /* ---------- scenery (generated once) ---------- */
  const mkTrees = (n, a, b) => Array.from({ length: n }, (_, i) => ({
    x: i / (n - 1) * CW + (Math.random() - 0.5) * 14, h: a + Math.random() * (b - a), w: 10 + Math.random() * 8 }));
  const far = mkTrees(22, 22, 38), near = mkTrees(12, 36, 62);
  const fog = Array.from({ length: 7 }, () => ({ x: Math.random() * CW, y: 70 + Math.random() * 50, r: 40 + Math.random() * 50, s: 0.1 + Math.random() * 0.25 }));
  const tri = (c, t) => { c.beginPath(); c.moveTo(t.x - t.w, GY); c.lineTo(t.x, GY - t.h); c.lineTo(t.x + t.w, GY); c.fill(); };

  /* ---------- HTML helpers: pips, lamps, phone, pop-ups ---------- */
  const pipEls = [];
  for (let i = 0; i < 5; i++) { const s = document.createElement("span"); s.title = "Call " + (i + 1); $("pips").appendChild(s); pipEls.push(s); }
  function setPip(i, cls, txt) { const p = pipEls[i]; if (!p) return; p.className = "pip " + (cls || ""); p.textContent = txt || String(i + 1); }
  const resetPips = () => pipEls.forEach((_, i) => setPip(i, ""));
  function lamp(id, cls, txt) { const l = $(id); l.className = "lamp " + (cls || ""); if (txt) l.textContent = txt; }
  function phone(cls, txt) { const p = $("phone"); p.className = cls || ""; p.textContent = txt; }
  function toast(big, cls, small) {
    const t = $("toast"); t.className = ""; t.textContent = big;
    if (small) { const s = document.createElement("small"); s.textContent = small; t.appendChild(s); }
    void t.offsetWidth; t.className = "show " + cls;        // the reflow restarts the animation
  }
  function pulse(cls) { const p = $("pulse"); p.className = ""; void p.offsetWidth; p.className = cls; }

  function clock() {
    const s = 2 * 3600 + 10 * 60 + cur * 22 * 60 + Math.floor(f / 60), p = n => String(n).padStart(2, "0");
    return p(Math.floor(s / 3600) % 24) + ":" + p(Math.floor(s / 60) % 60) + ":" + p(s % 60);
  }

  /* ---------- a stick-figure "thermal" silhouette. Mimics have wrong proportions. ---------- */
  function figure(c, o) {
    const m = o.kind === "mimic", s = o.s, x = o.x + (o.shake ? (Math.random() - 0.5) * 3 : 0);
    const leg = (m ? 24 : 15) * s, tor = (m ? 24 : 14) * s, arm = (m ? 30 : 13) * s, hr = (m ? 3.2 : 4) * s;
    const sw = Math.sin(o.w * 0.3) * (m ? 0.35 : 0.6);
    c.save(); c.translate(x, GY); c.globalAlpha = o.a;
    if (o.fall) c.rotate(o.fall * Math.PI / 2);
    c.strokeStyle = c.fillStyle = m ? "#ff7a6a" : "#7dffa0";
    c.lineCap = "round"; c.lineWidth = 3 * s; c.shadowColor = c.strokeStyle; c.shadowBlur = 8;
    const hy = -leg, sy = hy - tor;
    c.beginPath();
    c.moveTo(0, hy); c.lineTo(Math.sin(sw) * leg, 0);
    c.moveTo(0, hy); c.lineTo(-Math.sin(sw) * leg, 0);
    c.moveTo(0, hy); c.lineTo(0, sy);
    c.moveTo(0, sy + 3 * s); c.lineTo(-Math.sin(sw) * arm * 0.8, sy + 3 * s + arm * 0.85);
    c.moveTo(0, sy + 3 * s); c.lineTo(Math.sin(sw) * arm * 0.8, sy + 3 * s + arm * 0.85);
    c.stroke();
    c.beginPath(); c.ellipse(m ? 2 * s : 0, sy - hr - s, hr * (m ? 0.8 : 1), hr * (m ? 1.5 : 1), m ? 0.3 : 0, 0, TAU); c.fill();
    c.restore();
  }

  /* ---------- the outcome animations (mf counts frames since the decision) ---------- */
  function seq() {
    fig = null; strobe = 0;
    if (mode === "saved") {                                   // door opens, human walks in, door closes
      door = mf < 30 ? mf / 30 : mf < 140 ? 1 : Math.max(0, 1 - (mf - 140) / 30);
      if (mf > 10 && mf < 135) fig = { x: Math.min(40 + (mf - 10) * 0.95, 156), s: 1, kind: "human", a: mf > 115 ? Math.max(0, 1 - (mf - 115) / 20) : 1, w: mf };
      if (mf > 175) mode = "idle";
    } else if (mode === "repelled") {                         // red strobe, a tall thing backs into the fog
      door += (0 - door) * 0.2; strobe = Math.sin(mf * 0.5) > 0 ? 1 : 0.3;
      fig = { x: mf < 45 ? 215 : 215 + (mf - 45) * 1.4, s: 1.1, kind: "mimic", a: mf < 45 ? 1 : Math.max(0, 1 - (mf - 45) / 100), w: mf < 45 ? 0 : mf, shake: mf < 45 };
      if (mf > 160) mode = "idle";
    } else if (mode === "fail") {
      if (kind === "humanDied") {                             // the human collapses, then something replaces them
        door += (0 - door) * 0.2; strobe = Math.sin(mf * 0.5) > 0 ? 1 : 0.3;
        if (mf < 110) fig = { x: 40 + Math.min(mf, 55) * 1.1, s: 1, kind: "human", a: mf > 80 ? Math.max(0, 1 - (mf - 80) / 30) : 1, w: mf < 55 ? mf : 0, fall: mf > 55 ? Math.min(1, (mf - 55) / 20) : 0 };
        else fig = { x: 100 + (mf - 110) * 0.9, s: 1.15, kind: "mimic", a: 1, w: mf };
      } else {                                                // the mimic is let in, or you hesitated
        door = Math.min(1, mf / 20);
        if (mf > 14) fig = { x: 160, s: 0.6 + (mf - 14) * 0.0085, kind: "mimic", a: 1, w: 0, shake: true };
        if (mf > 60) strobe = Math.random() < 0.5 ? 0.8 : 0;
      }
      if (mf > 230) mode = "idle";
    } else door += (0 - door) * 0.2;                          // normal: door stays shut
  }

  /* ---------- draw the CCTV camera ---------- */
  function drawScene() {
    const c = cx; mf++; seq();
    const g = c.createLinearGradient(0, 0, 0, GY); g.addColorStop(0, "#07260f"); g.addColorStop(1, "#021208");
    c.fillStyle = g; c.fillRect(0, 0, CW, GY);
    c.fillStyle = "rgba(190,255,205,.12)"; c.beginPath(); c.arc(262, 22, 20, 0, TAU); c.fill();          // moon glow
    c.fillStyle = "rgba(190,255,205,.6)"; c.beginPath(); c.arc(262, 22, 8, 0, TAU); c.fill();            // moon
    c.fillStyle = "#04200e"; far.forEach(t => tri(c, t));
    c.fillStyle = "#031409"; c.fillRect(0, GY, CW, CH - GY);                                              // ground
    c.fillStyle = "#020d06"; near.forEach(t => { if (t.x < 95 || t.x > 225) tri(c, t); });

    const lc = (mode === "fail" && kind !== "humanDied") ? "255,40,30" : "255,214,140";                   // light colour from the door
    if (door > 0.05) {
      c.fillStyle = "rgba(" + lc + "," + (0.22 * door) + ")";
      c.beginPath(); c.moveTo(146, GY); c.lineTo(174, GY); c.lineTo(215, CH); c.lineTo(105, CH); c.fill();
    }

    // tower body and lamp room
    c.fillStyle = "#051a0c"; c.strokeStyle = "#1d7a3a"; c.lineWidth = 1;
    c.fillRect(122, 28, 76, GY - 28); c.strokeRect(122.5, 28.5, 75, GY - 28);
    c.fillStyle = "#072612"; c.fillRect(130, 14, 60, 14); c.strokeRect(130.5, 14.5, 59, 14);
    c.fillStyle = strobe > 0.5 ? "#ff3030" : "#b6ffc9"; c.beginPath(); c.arc(160, 21, 3, 0, TAU); c.fill();
    c.save(); c.translate(160, 21); c.rotate(Math.sin(f * 0.012) * 0.85);                                // sweeping searchlight
    c.fillStyle = strobe > 0 ? "rgba(255,60,60,.10)" : "rgba(200,255,210,.07)";
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-30, 160); c.lineTo(30, 160); c.fill(); c.restore();
    c.fillStyle = strobe > 0.5 ? "#a02020" : "#1d7a3a";
    [[132, 42], [172, 42], [132, 58], [172, 58]].forEach(w => c.fillRect(w[0], w[1], 12, 8));

    // door: opening, then the swinging panel on top
    const dw = 28, pw = dw * (1 - door * 0.85);
    c.fillStyle = door > 0.02 ? "rgba(" + lc + "," + (0.2 + 0.75 * door) + ")" : "#020a05"; c.fillRect(146, 72, dw, GY - 72);
    c.fillStyle = "#0b2c16"; c.strokeStyle = "#2bd061"; c.fillRect(146, 72, pw, GY - 72); c.strokeRect(146.5, 72.5, pw - 1, GY - 73);
    c.fillStyle = door > 0.5 ? "#ffb000" : "#ff4040"; c.fillRect(146 + pw - 6, 94, 3, 3);               // lock light

    if (fig) figure(c, fig);

    // drifting fog
    fog.forEach(b => {
      const x = (b.x + f * b.s) % (CW + 160) - 80, gr = c.createRadialGradient(x, b.y, 0, x, b.y, b.r);
      gr.addColorStop(0, "rgba(170,230,190,.10)"); gr.addColorStop(1, "rgba(170,230,190,0)");
      c.fillStyle = gr; c.fillRect(x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    });

    // alarm strobe, static, scanlines
    if (strobe > 0) { c.fillStyle = "rgba(255,30,30," + (0.16 * strobe) + ")"; c.fillRect(0, 0, CW, CH); }
    statics = (mode === "fail") ? Math.min(0.9, 0.3 + mf / 260) : statics * 0.97;
    if (Math.random() < statics * 0.35) { const y = Math.random() * CH | 0, h = 3 + (Math.random() * 10 | 0); c.drawImage(cc, 0, y, CW, h, (Math.random() - 0.5) * 24, y, CW, h); }
    c.fillStyle = "rgba(180,255,200,.5)";
    for (let i = 0, n = 25 + statics * 260; i < n; i++) c.fillRect(Math.random() * CW, Math.random() * CH, 1, 1);
    c.fillStyle = "rgba(0,0,0,.16)"; for (let y = 0; y < CH; y += 3) c.fillRect(0, y, CW, 1);
    if (mode === "fail" && kind !== "humanDied" && Math.random() < 0.15) { c.fillStyle = "rgba(0,0,0,.75)"; c.fillRect(0, 0, CW, CH); }

    // on-screen text
    c.font = "10px Courier New"; c.fillStyle = "rgba(182,255,201,.9)";
    c.fillText("CAM 01  " + clock(), 6, 12);
    c.fillText(door > 0.3 ? "DOOR 01: OPEN" : "DOOR 01: LOCKED", 6, CH - 6);
    if (Math.floor(f / 30) % 2) { c.fillStyle = "#ff3c3c"; c.beginPath(); c.arc(CW - 40, 9, 3, 0, TAU); c.fill(); c.fillText("REC", CW - 32, 12); }
    if (strobe > 0 && Math.floor(f / 8) % 2) { c.fillStyle = "#ff4040"; c.font = "bold 14px Courier New"; c.fillText("ALARM", CW / 2 - 24, 28); }
  }

  /* ---------- draw the radar ---------- */
  function drawRadar() {
    const c = rx; sweep = (sweep + 0.05) % TAU;
    // move the blip
    if (rMode === "approach") {
      waitF++;
      const target = patience == null ? 1 - 0.5 * Math.min(1, waitF / 7200) : 0.28 + 0.72 * patience;
      dist += (target - dist) * 0.02;
    } else if (rMode === "enter") dist += (0 - dist) * 0.04;
    else if (rMode === "flee") { dist += 0.025; if (dist > 1.25) rMode = "none"; }
    wob += (Math.random() - 0.5) * 0.015;
    if (script && script.mimic && rMode === "approach" && --jumpT <= 0) {   // MIMIC TELL: the blip teleports
      jumpT = 120 + (Math.random() * 140 | 0); ghost = { x: bx, y: by, t: 30 };
      jx = (Math.random() - 0.5) * 24; jy = (Math.random() - 0.5) * 24;
    }
    jx *= 0.995; jy *= 0.995;
    const r = dist * RR;
    bx = RC + Math.cos(theta + wob) * r + jx; by = RC + Math.sin(theta + wob) * r + jy;

    // draw
    c.fillStyle = "rgba(0,10,3,.22)"; c.fillRect(0, 0, RS, RS);             // phosphor persistence
    c.strokeStyle = "rgba(51,255,102,.28)"; c.lineWidth = 1;
    [RR / 3, RR * 2 / 3, RR].forEach(rad => { c.beginPath(); c.arc(RC, RC, rad, 0, TAU); c.stroke(); });
    c.beginPath(); c.moveTo(RC - RR, RC); c.lineTo(RC + RR, RC); c.moveTo(RC, RC - RR); c.lineTo(RC, RC + RR); c.stroke();
    c.strokeStyle = "rgba(51,255,102,.9)"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(RC, RC); c.lineTo(RC + Math.cos(sweep) * RR, RC + Math.sin(sweep) * RR); c.stroke();
    c.fillStyle = "#33ff66"; c.fillRect(RC - 3, RC - 3, 6, 6);               // the tower
    pings = pings.filter(p => p.a > 0.02);
    pings.forEach(p => { p.r += 1.8; p.a *= 0.965; c.strokeStyle = "rgba(51,255,102," + p.a + ")"; c.lineWidth = 1; c.beginPath(); c.arc(RC, RC, p.r, 0, TAU); c.stroke(); });
    if (rMode !== "none") {
      const br = 1 - ((((sweep - Math.atan2(by - RC, bx - RC)) % TAU) + TAU) % TAU) / TAU;   // brightest just after the sweep passes
      c.fillStyle = "rgba(150,255,170," + (0.2 + 0.8 * br) + ")"; c.shadowColor = "#33ff66"; c.shadowBlur = 10;
      c.beginPath(); c.arc(bx, by, 3, 0, TAU); c.fill();
      if (ghost && ghost.t-- > 0) { c.fillStyle = "rgba(150,255,170,.35)"; c.beginPath(); c.arc(ghost.x, ghost.y, 2.5, 0, TAU); c.fill(); }
      c.shadowBlur = 0;
    }
    c.fillStyle = "#000"; c.fillRect(0, 0, RS, 14); c.fillRect(0, RS - 14, RS, 14);
    c.fillStyle = "rgba(51,255,102,.85)"; c.font = "10px Courier New";
    c.fillText(rMode === "none" ? "NO CONTACT" : "CONTACT", 4, 10);
    c.fillText("RNG " + (rMode === "none" ? "---" : Math.max(0, Math.round(dist * 400)) + "m"), 4, RS - 4);
  }

  function loop() {
    f++;
    if (cc.offsetParent) { drawScene(); drawRadar(); }                      // skip drawing while hidden
    requestAnimationFrame(loop);
  }
  phone("", "STANDBY"); loop();

  /* ---------- the functions game.js calls ---------- */
  return {
    /* a new shift starts: clear everything */
    newShift() {
      tok++; mode = "idle"; rMode = "none"; door = 0; strobe = 0; cur = 0; script = null;
      resetPips(); phone("", "STANDBY"); lamp("lampLine", "", "LINE"); lamp("lampDoor", "", "DOOR"); lamp("lampAlarm", "", "ALARM");
    },
    /* the phone starts ringing for call n (1-5) */
    beginCall(n, s) {
      tok++; cur = n; script = s; mode = "idle"; door = 0; strobe = 0; statics = 0; pings = []; ghost = null;
      rMode = "approach"; waitF = 0; dist = 1; patience = 1; theta = Math.random() * TAU; wob = 0; jx = jy = 0; jumpT = 150;
      setPip(n - 1, "on"); phone("ring", "INCOMING CALL");
      lamp("lampLine", ""); lamp("lampDoor", "", "DOOR"); lamp("lampAlarm", "", "ALARM");
      toast("INCOMING CALL", "info", n + " OF 5");
    },
    onAir() { phone("air", "ON AIR"); lamp("lampLine", "on", "LINE"); },
    setPatience(p) { patience = p; },                                       // 1..0, or null for no timer
    ping() { pings.push({ r: 4, a: 1 }); },                                 // radar ring when you ask a question
    /* the decision is made. res = saved | repelled | fail */
    resolve(res, pts, k) {
      const my = ++tok; mf = 0; kind = k || ""; phone("", "STANDBY"); lamp("lampLine", "", "LINE");
      if (res === "saved") {
        mode = "saved"; rMode = "enter"; setPip(cur - 1, "ok", "H"); lamp("lampDoor", "amber", "OPEN");
        toast("HUMAN SAVED", "good", "+" + pts + " PTS"); pulse("good"); SFX.creak(0);
      } else if (res === "repelled") {
        mode = "repelled"; rMode = "flee"; setPip(cur - 1, "rep", "M"); lamp("lampAlarm", "red");
        toast("MIMIC REPELLED", "good", "+" + pts + " PTS"); pulse("good");
      } else {
        mode = "fail"; rMode = "enter"; setPip(cur - 1, "bad", "X"); lamp("lampDoor", "red", "BREACH");
        if (kind === "humanDied") { lamp("lampAlarm", "red"); SFX.siren(2.6); toast("HE DIED OUTSIDE", "bad"); }
        else { SFX.steps(5, 0.3); SFX.creak(-0.5); toast(kind === "timeout" ? "YOU HESITATED" : "IT GOT IN", "bad"); }
        pulse("bad");
      }
      if (res !== "fail") setTimeout(() => { if (my === tok) { lamp("lampDoor", "", "DOOR"); lamp("lampAlarm", "", "ALARM"); } }, 2900);
    },
    toast
  };
})();