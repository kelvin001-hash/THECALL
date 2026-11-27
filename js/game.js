"use strict";
/* =====================================================
   game.js : flow, UI, haunts, archive, saving
   ===================================================== */
const SAVE_KEY = "thecall.save.v2";
const G = {
  name: "OPERATOR", diff: "normal", queue: [], idx: 0, script: null,
  state: "menu",                       // menu | call | between | over
  busy: true, asked: new Set(), score: 0, correct: 0, stats: { asked: 0 },
  timeLeft: 0, timeMax: 0, timerId: null, hauntId: null, run: 0, panic: false, debugOn: false,
  save: { best: 0, survived: 0, plays: 0, name: "", diff: "normal", vol: 0.7, muted: false, fx: true, flashes: true }
};
const arch = { token: 0 };
const transcript = $("transcript");
const show = id => $(id).classList.remove("hidden");
const hide = id => $(id).classList.add("hidden");

/* ---------- saving ---------- */
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) Object.assign(G.save, s); } catch (e) {} }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) {} }

function applySettings() {
  SFX.setVolume(G.save.vol); SFX.setMuted(G.save.muted);
  FX.setOptions({ fx: G.save.fx, flashes: G.save.flashes });
  $("volRange").value = G.save.vol; $("muteChk").checked = G.save.muted;
  $("fxChk").checked = G.save.fx; $("flashChk").checked = G.save.flashes;
}

/* ---------- transcript ---------- */
function addLine(cls, text) {
  const p = document.createElement("p"); p.className = cls; p.textContent = text;
  transcript.appendChild(p); transcript.scrollTop = transcript.scrollHeight; return p;
}
/* types text while the waveform "speaks". Returns false if the game was reset mid-line. */
async function say(text) {
  text = text.replace(/\{name\}/g, G.name);
  const my = G.run, p = addLine("", "CALLER> "), mimic = G.script && G.script.mimic;
  p.classList.add("caret"); Scope.setSpeaking(true);
  for (const c of text) {
    if (my !== G.run) return false;
    p.textContent += c; transcript.scrollTop = transcript.scrollHeight;
    if (Math.random() < (mimic ? 0.015 : 0.008)) {                   // brief signal corruption in the text
      p.textContent += "\u2592"; await sleep(70); p.textContent = p.textContent.slice(0, -1);
    }
    await sleep(/[.,?!]/.test(c) ? 260 : 38);
  }
  p.classList.remove("caret"); Scope.setSpeaking(false); return true;
}
async function typeLines(box, lines, speed, pause) {
  for (const l of lines) {
    const p = document.createElement("p"); box.appendChild(p);
    for (const c of l.replace(/\{name\}/g, G.name)) { p.textContent += c; await sleep(speed || 22); }
    await sleep(pause === undefined ? 380 : pause);
  }
}

/* ---------- HUD & controls ---------- */
function updateHUD() { $("callNo").textContent = `CALL ${G.idx}/5`; $("scoreEl").textContent = G.score; }
const setStatus = s => { $("status").textContent = s; };
function lockControls(lock) {
  document.querySelectorAll(".ask").forEach(b => { b.disabled = lock || G.asked.has(b.dataset.q); });
  $("unlockBtn").disabled = $("alarmBtn").disabled = lock;
}
function showCallUI() { show("callControls"); hide("betweenBar"); $("btnArchive").disabled = true; }
function showBetween() { hide("callControls"); show("betweenBar"); $("btnArchive").disabled = false; }

/* ---------- timer (door patience) ---------- */
function stopTimer() { clearInterval(G.timerId); G.timerId = null; }
function startTimer() {
  stopTimer(); G.panic = false;
  const d =DIFFS[G.diff];
if (!d.time) { $("patBar").style.width = "100%"; $("patTxt").textContent = "NO LIMIT"; Viz.setPatience(null); return; }
  G.timeLeft = G.timeMax = d.time;
  G.timerId = setInterval(() => {
    if (G.busy || G.state !== "call") return;                       // only runs while YOU are deciding
    G.timeLeft -= 0.25;
    $("patBar").style.width = Math.max(0, G.timeLeft / G.timeMax * 100) + "%";
    $("patBar").classList.toggle("low", G.timeLeft < 12);
   $("patTxt").textContent = Math.max(0, Math.ceil(G.timeLeft)) + "s"; Viz.setPatience(G.timeLeft / G.timeMax);
    if (G.timeLeft < 12 && !G.panic) { G.panic = true; SFX.setHeart(120); }
    if (G.timeLeft <= 0) { stopTimer(); G.busy = true; breach("timeout"); }
  }, 250);
}

/* ---------- random haunts during a call ---------- */
function stopHaunts() { clearTimeout(G.hauntId); G.hauntId = null; }
function scheduleHaunt() {
  stopHaunts(); if (G.state !== "call") return;
  G.hauntId = setTimeout(() => { if (G.state === "call") { doHaunt(); scheduleHaunt(); } }, rand(7000, 15000) / (1 + G.idx * 0.12));
}
function doHaunt() {
  const pan = Math.random() < 0.5 ? -0.8 : 0.8, r = Math.random();
  if (r < 0.25) SFX.whisper(rand(1, 2.2), pan);
  else if (r < 0.45) SFX.knock(pan);
  else if (r < 0.60) SFX.creak(pan);
  else if (r < 0.72) SFX.steps(4, pan);
  else if (r < 0.82) FX.ghost(pick(GHOST_WORDS));
  else if (r < 0.90) FX.staticBurst(250);
  else if (r < 0.96) { if (G.idx >= 3) SFX.musicBox(0.05, pan); }
  else if (G.idx >= 2) FX.lightsOut(800);
}

/* ---------- game flow ---------- */
function newGame() {
  hide("end"); hide("login"); FX.redAlert(false);
  G.run++; G.idx = 0; G.score = 0; G.correct = 0; G.stats = { asked: 0 };
  const m = 1 + (Math.random() * 3 | 0);                            // 1-3 mimics per shift
  const hs = shuffle(HUMANS), ms = shuffle(MIMICS);
  G.queue = shuffle([...Array(m).fill(1), ...Array(5 - m).fill(0)]).map(t => t ? ms.pop() : hs.pop());
  $("opName").textContent = G.name; updateHUD(); Viz.newShift(); startNextCall();
}

async function startNextCall() {
  if (G.idx >= 5) return win();
  const my = ++G.run;
  G.script = G.queue[G.idx]; G.idx++; G.asked = new Set(); G.state = "call"; G.busy = true;
  document.querySelectorAll(".ask").forEach(b => b.classList.remove("used"));
  showCallUI(); lockControls(true); transcript.innerHTML = ""; updateHUD();
  $("patBar").style.width = "0"; $("patTxt").textContent = "--";
  Scope.setSpeaker(G.script); SFX.setTension(G.idx / 5); SFX.setHeart(G.idx >= 2 ? 52 + G.idx * 8 : 0);
  setStatus("INCOMING..."); Viz.beginCall(G.idx, G.script); await SFX.ring(); if (my !== G.run) return;
  await sleep(500); if (my !== G.run) return;
  setStatus("ON AIR"); Viz.onAir(); addLine("sys", `-- incoming transmission, channel ${(140 + Math.random() * 10).toFixed(2)} MHz --`);
  if (!(await say(G.script.intro))) return;
  G.busy = false; lockControls(false); startTimer(); scheduleHaunt();
}

async function ask(q) {
  if (G.busy || G.state !== "call" || G.asked.has(q)) return;
  G.busy = true; lockControls(true); SFX.click(); G.asked.add(q); G.stats.asked++; Viz.ping();
  document.querySelector(`.ask[data-q="${q}"]`).classList.add("used");
  const my = G.run;
  addLine("op", "OPERATOR> " + { loc: "Where are you right now?", wea: "What's the weather like out there?", pas: "Give me the passcode." }[q]);
  await sleep(500); if (my !== G.run) return;
  if (!(await say(G.script[q]))) return;
  G.busy = false; lockControls(false);
}

function award() {                                                  // fewer questions + faster = more points
  const a = G.asked.size; let pts = 100 + (a <= 1 ? 50 : a === 2 ? 25 : 0);
  if (DIFFS[G.diff].time) pts += Math.floor(G.timeLeft / 5);
  pts = Math.round(pts * DIFFS[G.diff].mult); G.score += pts; return pts;
}

async function decide(unlock) {
  if (G.busy || G.state !== "call") return;
  G.busy = true; stopTimer(); stopHaunts(); lockControls(true); SFX.click(); Scope.setSpeaking(false); SFX.setHeart(0);
  const my = G.run, isMimic = !!G.script.mimic;
  if (unlock && !isMimic) {
    const pts = award(); G.correct++; G.save.survived++; persist(); updateHUD(); SFX.relief();
    addLine("sys", `-- DOOR OPEN. A shivering stranger stumbles inside. Safe. (+${pts} PTS) --`); setStatus("HUMAN SAVED"); Viz.resolve("saved", pts);
  } else if (!unlock && isMimic) {
    const pts = award(); G.correct++; G.save.survived++; persist(); updateHUD(); SFX.siren(3.2);
    addLine("sys", `-- ALARM! The voice shrieks in your own voice, then retreats into the trees. (+${pts} PTS) --`); setStatus("MIMIC REPELLED"); Viz.resolve("repelled", pts);
  } else return breach(unlock ? "mimicIn" : "humanDied");
  await sleep(2800); if (my !== G.run) return;
  if (G.idx >= 5) return win();
  G.state = "between"; Scope.setSpeaker(null); setStatus("STANDBY"); showBetween();
}

/* ---------- end screens ---------- */
function endReset(cls) {
  const e = $("end"); e.className = "overlay " + cls;
  ["endFace", "endLog", "endStats", "endBtns"].forEach(id => { $(id).textContent = ""; });
}
function addStat(label, val) { const d = document.createElement("div"); d.textContent = `${label}: ${val}`; $("endStats").appendChild(d); }
function addBtn(label, fn) { const b = document.createElement("button"); b.className = "key"; b.textContent = label; b.onclick = () => { SFX.click(); fn(); }; $("endBtns").appendChild(b); }
function toMenu() { hide("end"); FX.redAlert(false); showLogin(); }

async function breach(kind) {
  G.state = "over"; G.run++; stopTimer(); stopHaunts(); SFX.setHeart(0); Scope.setSpeaking(false);
  if (G.score > G.save.best) G.save.best = G.score; persist();
  Viz.resolve("fail", 0, kind); await sleep(3300); endReset("lose"); FX.redAlert(true); SFX.breach(); FX.flash("#f00", 120); FX.shake(1200);
  await sleep(700); await FX.jumpscare();
  $("endFace").textContent = FACES[0];
  await typeLines($("endLog"), BREACH_TEXT[kind], 22, 380);
  addStat("CALLS SURVIVED", `${G.correct}/5`); addStat("SCORE", G.score); addStat("BEST", G.save.best);
  addBtn("REBOOT TERMINAL", newGame); addBtn("LOG ARCHIVE", openArchive); addBtn("MAIN MENU", toMenu);
  setStatus("CONNECTION LOST");
}

async function win() {
  G.state = "over"; G.run++; SFX.setHeart(0); Scope.setSpeaker(null); setStatus("SHIFT OVER");
  if (G.score > G.save.best) G.save.best = G.score; persist();
  endReset("win");
  await typeLines($("endLog"), ["> DAWN BREAKS OVER THE RIDGE.", "> 5 CALLS ANSWERED. YOU LIVED.", "> THE FOG IS LIFTING.", "> ...", "> A 6TH CALL IS INCOMING. CALLER ID: {name}"], 30, 600);
  SFX.tone("sine", 880, 0.25, 0.2); FX.ghost("IT KNOWS YOUR VOICE NOW", 700);
  const rank = G.score >= 650 ? "SENIOR OPERATOR" : G.score >= 500 ? "OPERATOR" : G.score >= 350 ? "TRAINEE" : "LUCKY SURVIVOR";
  addStat("SCORE", G.score); addStat("RANK", rank); addStat("BEST", G.save.best);
  addBtn("START NEW SHIFT", newGame); addBtn("LOG ARCHIVE", openArchive); addBtn("MAIN MENU", toMenu);
}

/* ---------- LOG ARCHIVE (haunted past recordings) ---------- */
function openArchive() {
  if (G.state === "call") return;
  buildArchiveList(); hide("archivePlayer"); show("archive");
}
function closeArchive() { stopArchive(); hide("archive"); }
function buildArchiveList() {
  const box = $("archiveList"); box.innerHTML = "";
  ARCHIVE.forEach((e, i) => {
    const locked = G.save.survived < e.need, b = document.createElement("button");
    b.className = "key entry" + (locked ? " locked" : "");
    b.textContent = locked ? `[ENCRYPTED] SURVIVE ${e.need - G.save.survived} MORE CALL(S) TO DECRYPT` : e.title;
    b.onclick = () => playArchive(i); box.appendChild(b);
  });
  $("archiveInfo").textContent = `CALLS SURVIVED (ALL SHIFTS): ${G.save.survived}`;
}
function stopArchive() {
  arch.token++; SFX.tape(false); SFX.setHeart(0); Scope.setSpeaker(null); Scope.setSpeaking(false); hide("archivePlayer");
}
function runFx(name) {
  const pan = Math.random() < 0.5 ? -0.8 : 0.8;
  if (name === "whisper") SFX.whisper(2, pan); else if (name === "knock") SFX.knock(pan);
  else if (name === "music") SFX.musicBox(0.1, 0); else if (name === "swell") SFX.swell();
  else if (name === "creak") SFX.creak(pan); else if (name === "steps") SFX.steps(5, pan);
  else if (name === "heart") SFX.setHeart(70); else if (name === "dark") FX.lightsOut(900);
  else if (name === "scare") FX.jumpscare();
}
async function playArchive(i) {
  const e = ARCHIVE[i];
  if (G.save.survived < e.need) { SFX.burst(0.2, 0.2, 800, 1); FX.ghost("ENCRYPTED"); return; }
  stopArchive(); SFX.click();
  const my = arch.token, txt = $("archiveText");
  txt.innerHTML = ""; $("archiveTitle").textContent = e.title; show("archivePlayer");
  SFX.tape(true); Scope.setSpeaker({ mimic: true, glitch: "loop" });
  for (const l of e.lines) {
    if (my !== arch.token) return;
    if (l.fx) runFx(l.fx);
    const p = document.createElement("p"); p.className = l.w === "SYS" ? "sys" : l.w === "OP" ? "op" : "";
    txt.appendChild(p);
    const full = (l.w === "SYS" ? "" : l.w + "> ") + l.t.replace(/\{name\}/g, G.name);
    Scope.setSpeaking(l.w !== "SYS");
    for (const c of full) {
      if (my !== arch.token) return;
      p.textContent += c; txt.scrollTop = txt.scrollHeight; await sleep(l.w === "SYS" ? 22 : 42);
    }
    Scope.setSpeaking(false); await sleep(900);
  }
  if (my === arch.token) { SFX.tape(false); SFX.setHeart(0); Scope.setSpeaker(null); }
}

/* ---------- menus ---------- */
function showLogin() {
  G.state = "menu"; $("nameInput").value = G.save.name || ""; setDiff(G.save.diff || "normal");
  $("bestLine").textContent = `BEST SCORE: ${G.save.best}   |   SHIFTS STARTED: ${G.save.plays}   |   CALLS SURVIVED: ${G.save.survived}`;
  show("login"); $("nameInput").focus();
}
function setDiff(d) {
  G.diff = d; G.save.diff = d; $("diffInfo").textContent = DIFFS[d].info;
  document.querySelectorAll(".diff").forEach(b => b.classList.toggle("sel", b.dataset.diff === d));
}

/* ---------- debug panel (F2) ---------- */
function toggleDebug() { G.debugOn = !G.debugOn; $("debug").classList.toggle("hidden", !G.debugOn); }
function updateDebug() {
  const s = G.script;
  $("debug").textContent = ["DEBUG [F2]", "state:     " + G.state, "caller:    " + (s ? s.name : "-"),
    "truth:     " + (s ? (s.mimic ? "MIMIC (" + s.glitch + ")" : "HUMAN") : "-"), "glitching: " + Scope.glitching,
    "integrity: " + Scope.integrity.toFixed(2), "time left: " + G.timeLeft.toFixed(1), "survived:  " + G.save.survived].join("\n");
}

/* ---------- wiring ---------- */
$("powerBtn").onclick = async () => {
  SFX.init(); applySettings(); Scope.start(); SFX.click(); hide("boot"); show("bios");
  const log = $("biosLog"); log.textContent = "";
  for (const line of BIOS) {
    SFX.tone("square", 600 + Math.random() * 300, 0.04, 0.05);
    for (const c of line + "\n") { log.textContent += c; await sleep(c === "\n" ? 160 : 12); }
    if (Math.random() < 0.3) FX.staticBurst(120);
  }
  await sleep(500); hide("bios"); showLogin();
};
document.querySelectorAll(".diff").forEach(b => { b.onclick = () => { SFX.click(); setDiff(b.dataset.diff); persist(); }; });
$("startShift").onclick = () => {
  G.name = ($("nameInput").value.trim().replace(/[^\w \-]/g, "").slice(0, 12)) || "OPERATOR";
  G.save.name = G.name; G.save.plays++; persist(); SFX.click(); hide("login"); newGame();
};
$("openArchiveLogin").onclick = () => { SFX.click(); openArchive(); };
$("openSettingsLogin").onclick = () => { SFX.click(); show("settings"); };
$("btnArchive").onclick = $("btnArchive2").onclick = () => { SFX.click(); openArchive(); };
$("btnSettings").onclick = () => { SFX.click(); show("settings"); };
$("archiveClose").onclick = () => { SFX.click(); closeArchive(); };
$("archiveStop").onclick = () => { SFX.click(); stopArchive(); };
$("settingsClose").onclick = () => { SFX.click(); hide("settings"); persist(); };
$("nextBtn").onclick = () => { if (G.state === "between") { SFX.click(); startNextCall(); } };
document.querySelectorAll(".ask").forEach(b => { b.onclick = () => ask(b.dataset.q); });
$("unlockBtn").onclick = () => decide(true);
$("alarmBtn").onclick = () => decide(false);

$("tabScope").onclick = () => setView("scope");
$("tabSpec").onclick = () => setView("spectrum");
function setView(m) {
  SFX.click(); Scope.setMode(m);
  $("tabScope").classList.toggle("sel", m === "scope"); $("tabSpec").classList.toggle("sel", m === "spectrum");
}

$("volRange").oninput = e => { G.save.vol = +e.target.value; SFX.setVolume(G.save.vol); };
$("muteChk").onchange = e => { G.save.muted = e.target.checked; SFX.setMuted(G.save.muted); persist(); };
$("fxChk").onchange = e => { G.save.fx = e.target.checked; applySettings(); persist(); };
$("flashChk").onchange = e => { G.save.flashes = e.target.checked; applySettings(); persist(); };
$("resetSave").onclick = () => {
  if (confirm("Erase best score, unlocked tapes and settings?")) {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    G.save = { best: 0, survived: 0, plays: 0, name: "", diff: "normal", vol: 0.7, muted: false, fx: true, flashes: true };
    applySettings(); showLogin(); hide("settings");
  }
};

/* ---------- keyboard ---------- */
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" && e.target.type === "text") { if (e.key === "Enter") $("startShift").click(); return; }
  const k = e.key.toLowerCase();
  if (k === "f2") { e.preventDefault(); toggleDebug(); return; }
  if (k === "escape") { if (!$("settings").classList.contains("hidden")) { hide("settings"); persist(); } else if (!$("archive").classList.contains("hidden")) closeArchive(); return; }
  if (k === "m") { G.save.muted = !G.save.muted; applySettings(); persist(); return; }
  if (G.state === "call") {
    if (k === "1") ask("loc"); else if (k === "2") ask("wea"); else if (k === "3") ask("pas");
    else if (k === "u") decide(true); else if (k === "a") decide(false);
    else if (k === "s") setView(Scope.mode === "scope" ? "spectrum" : "scope");
  } else if (G.state === "between" && k === "n") $("nextBtn").click();
});

/* ---------- meters refresh ---------- */
setInterval(() => {
  const i = Math.round(Scope.integrity * 100);
  $("intTxt").textContent = i + "%"; $("intBar").style.width = i + "%"; $("intBar").classList.toggle("low", i < 55);
  const dread = (G.state === "call" || G.state === "between") ? Math.min(100, G.idx / 5 * 80 + (G.panic ? 20 : 0)) : 0;
  $("dreadBar").style.width = dread + "%";
  if (G.debugOn) updateDebug();
}, 100);

/* ---------- start-up ---------- */
loadSave(); G.name = G.save.name || "OPERATOR"; setDiff(G.save.diff || "normal");
$("fPass").textContent = FACTS.pass; $("fWx").textContent = FACTS.weather; $("fLoc").textContent = FACTS.loc;
$("opName").textContent = G.name;
window.THECALL = { G, Scope, SFX, FX, debug: toggleDebug, unlockAll() { G.save.survived = 99; persist(); } };   // console helpers