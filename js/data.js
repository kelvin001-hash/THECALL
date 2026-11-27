"use strict";
/* =====================================================
   data.js : utilities + every caller script, tape and
   piece of text in the game. Edit this file to add content.
   ===================================================== */

/* ---------- tiny utilities (shared by every file) ---------- */
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.random() * arr.length | 0];
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/* ---------- the truth about tonight ---------- */
const FACTS = { pass: "KESTREL-7", weather: "HEAVY FOG, NO RAIN", loc: "NORTH TRAIL, RIDGE" };

/* ---------- difficulty ---------- */
const DIFFS = {
  easy:   { time: 0,  mult: 1,   info: "EASY: no door timer. Take all the time you need." },
  normal: { time: 75, mult: 1.2, info: "NORMAL: 75 seconds of patience per call." },
  hard:   { time: 45, mult: 1.5, info: "HARD: 45 seconds. Hesitate and something climbs the tower." }
};

/* ---------- HUMANS: smooth waveform, truthful answers, but scared and messy ---------- */
const HUMANS = [
  { name: "Dana Reyes", intro: "Tower, tower, this is Dana Reyes. I'm lost, I can see your light! Please, open up!",
    loc: "I came up the north trail, past the split cedar. I think I'm at the bottom of your stairs.",
    wea: "The fog is so thick I can barely see my own hands. And it's freezing.",
    pas: "Kestrel seven. A ranger gave it to me at the trailhead." },
  { name: "Tom", intro: "Hello? H-hello? Is anyone there? I... I fell, my ankle's bad.",
    loc: "Uh, the, the ridge. Station four. North trail, I think. I can't, I can't walk.",
    wea: "Fog. Awful fog. Can't see a thing, I keep hitting trees.",
    pas: "Kestrel... seven. Please, please hurry." },
  { name: "Mara", intro: "Anyone on this channel? My radio's dying. I need shelter, please.",
    loc: "Along the north trail, up on the ridge. I can see a tall tower. That's you, right?",
    wea: "Foggy. Damp. My jacket is soaked through, I'm shaking.",
    pas: "Passcode? The ranger said Kestrel something... seven! Kestrel seven." },
  { name: "Eli", intro: "Hello? Hello! Please! Something is following me down the trail, I swear I heard it breathing!",
    loc: "The ridge! North trail! I passed that old sign with the bullet holes!",
    wea: "It's foggy. It's so foggy. I can't see anything past my arm.",
    pas: "The ranger said a bird. Kestrel! Kestrel-seven. Please, please!" },
  { name: "Ruth", intro: "Good evening, operator. I seem to have wandered rather far from the trail. Would you mind terribly letting me in?",
    loc: "The north trail, dear. Right up on the ridge, by the tower with the light.",
    wea: "Misty, dear. Thick as wool. No rain, thank heavens.",
    pas: "Kestrel seven. My late husband and I used to watch kestrels up here." }
];

/* ---------- MIMICS: glitchy waveform + memory slips. glitch = spike | flat | sub | loop ---------- */
const MIMICS = [
  { name: "Jonah (mimic)", mimic: true, glitch: "spike",
    intro: "Hello tower. My name is Jonah Pike. I am lost. Please open the door.",
    loc: "I am on the south trail. Near the lake. Station four.",
    wea: "It is a clear night. Many stars. Very beautiful.",
    pas: "Kestrel seven. Please open the door." },
  { name: "Cold One (mimic)", mimic: true, glitch: "flat",
    intro: "Tower. I am cold. I am so cold. Open the door.",
    loc: "Ridge. North trail. Ridge. North trail.",
    wea: "Fog. Heavy fog. And the rain. The rain is loud.",
    pas: "Kestrel... nine. Kestrel nine. Open the door." },
  { name: "Outside (mimic)", mimic: true, glitch: "sub",
    intro: "Operator. Operator. I am outside. I am outside your door.",
    loc: "I am at your door. I am at your door. I am at your door.",
    wea: "It is warm tonight. The wind is warm.",
    pas: "Kestrel seven. Kestrel seven. Kestrel seven. Let me in." },
  { name: "Perfect Mimic (knows your name)", mimic: true, glitch: "loop",
    intro: "{name}? {name}, is that you? It's me. Please let me in, {name}.",
    loc: "I'm on the north trail. Up on the ridge.",
    wea: "Fog. Heavy fog. No rain.",
    pas: "Kestrel seven." },
  { name: "Sorry (mimic)", mimic: true, glitch: "spike",
    intro: "Hi... hi. Sorry. Sorry to bother you. I got turned around.",
    loc: "South ridge. By the old quarry. North trail.",
    wea: "Foggy. And there's snow coming. Snow. Soft snow.",
    pas: "Kestrel seven... or was it six? Kestrel six. Yes. Six." }
];

/* ---------- LOG ARCHIVE: recovered tapes. need = total calls survived to unlock.
   w: SYS | OP | CALLER.  fx: audio/visual event that fires before the line. ---------- */
const ARCHIVE = [
  { need: 0, title: "TAPE 0417 // OPERATOR HALE // NIGHT 3", lines: [
    { w: "SYS", t: "[RECORDED 03:12 // FOUND INSIDE THE RADIO BOX]" },
    { w: "CALLER", t: "Tower? Tower, I can see your light. Please." },
    { w: "OP", t: "Operator Hale. State the passcode." },
    { w: "CALLER", t: "Kestrel-seven." },
    { w: "OP", t: "That's right. Coming down to open up." },
    { w: "SYS", t: "[SOUND OF A DOOR]", fx: "creak" },
    { w: "OP", t: "Funny. The waveform looked so clean tonight." },
    { w: "CALLER", t: "I like it here. It is so quiet. Say your name again.", fx: "whisper" },
    { w: "OP", t: "Hale. Why would you..." },
    { w: "SYS", t: "[END OF TAPE. THERE IS NO OPERATOR HALE ON THE STAFF LIST.]" } ] },
  { need: 2, title: "TAPE 0422 // OPERATOR VOSS // ALARM LOGGED 02:47", lines: [
    { w: "SYS", t: "[RECORDED 02:47 // THE SIREN IS AUDIBLE FOR THE FIRST NINE SECONDS]" },
    { w: "CALLER", t: "Please... my leg... please open the door." },
    { w: "OP", t: "The line went flat. Twice. I'm sorry. I'm sounding the alarm." },
    { w: "SYS", t: "[SIREN]", fx: "swell" },
    { w: "CALLER", t: "Don't. Don't. Don't." },
    { w: "CALLER", t: "Why did you leave me out here, Voss? Why did you leave me?", fx: "whisper" },
    { w: "OP", t: "That was my voice. That was MY voice on the radio." },
    { w: "SYS", t: "[VOSS WAS NEVER FOUND. THE ALARM STILL RINGS ON NIGHTS WITH NO CALLS.]" } ] },
  { need: 4, title: "TAPE 0430 // NO LABEL // PLAYBACK AT HALF SPEED", lines: [
    { w: "SYS", t: "[NO OPERATOR ON RECORD]", fx: "whisper" },
    { w: "CALLER", t: "I learned how you breathe." },
    { w: "CALLER", t: "I learned how you pause before you answer." },
    { w: "CALLER", t: "The waveform is the only part I cannot get right yet.", fx: "music" },
    { w: "CALLER", t: "Practice makes the shape. Practice makes the shape. Practice makes the shape." },
    { w: "SYS", t: "[THE LAST FOUR SECONDS CONTAIN A HUMAN HEARTBEAT. IT IS NOT YOURS.]", fx: "heart" } ] },
  { need: 6, title: "TAPE 0438 // OPERATOR IWU // STAIRWELL", lines: [
    { w: "SYS", t: "[RECORDED IN THE STAIRWELL // 04:03]" },
    { w: "OP", t: "Three knocks. The door sensor says no one's there.", fx: "knock" },
    { w: "OP", t: "It knocks the way my father knocked. Two slow. One fast." },
    { w: "CALLER", t: "Open up, son. It's cold." },
    { w: "OP", t: "Dad died in March." },
    { w: "CALLER", t: "Open up, son.", fx: "knock" },
    { w: "SYS", t: "[DOOR SENSOR: OPEN. NO FOOTSTEPS RECORDED ENTERING.]", fx: "steps" },
    { w: "SYS", t: "[FOOTSTEPS RECORDED LEAVING. THEY ARE IWU'S.]" } ] },
  { need: 8, title: "TAPE 0451 // THE TOWER HAS NO CHILDREN", lines: [
    { w: "SYS", t: "[A MUSIC BOX PLAYS UNDER THE STATIC]", fx: "music" },
    { w: "CALLER", t: "(humming) mmm... mm-mm... mmm..." },
    { w: "OP", t: "Who is that? Hello? Is someone on the channel?" },
    { w: "CALLER", t: "Mommy says the operator always opens the door.", fx: "whisper" },
    { w: "SYS", t: "[THE MELODY SPEEDS UP. THE TAPE ENDS WHEN IT STOPS.]", fx: "swell" },
    { w: "CALLER", t: "...Now it's your turn to sing." } ] },
  { need: 10, title: "TAPE 0499 // DATED TOMORROW // RIDGE STATION 4", lines: [
    { w: "SYS", t: "[THIS TAPE WAS RECORDED BY YOUR TERMINAL. THE DATE IS TOMORROW.]", fx: "dark" },
    { w: "CALLER", t: "Operator {name}. I have been listening to you all night." },
    { w: "CALLER", t: "You are very good. You nearly always know." },
    { w: "CALLER", t: "Nearly.", fx: "whisper" },
    { w: "SYS", t: "[SOUND OF A DOOR UNLOCKING. IT IS YOUR DOOR.]", fx: "knock" },
    { w: "CALLER", t: "{name}. {name}. {name}. Turn around.", fx: "scare" },
    { w: "SYS", t: "[END OF TAPE]" } ] }
];

/* ---------- breach / game-over text ---------- */
const BREACH_TEXT = {
  mimicIn: ["> DOOR 01 UNLOCKED BY OPERATOR {name}", "> CALLER WAVEFORM: NO HUMAN SOURCE", "> MOTION: STAIRWELL... LEVEL 2... LEVEL 3",
    "> IT LEARNED YOUR VOICE FROM THE RADIO", "> LIGHTS FAILING", "> IT IS BEHIND YOU", "FATAL: OPERATOR NOT FOUND"],
  humanDied: ["> SIREN BROADCAST. DOOR REMAINS SEALED", "> CALLER WAVEFORM: HUMAN. CONFIRMED.", "> THE VOICE BEGS. THEN SCREAMS. THEN NOTHING.",
    "> A NEW CALLER IS ON THE LINE", "> IT SOUNDS EXACTLY LIKE THEM", "> YOU CAN HEAR IT KNOCKING", "FATAL: OPERATOR NOT FOUND"],
  timeout: ["> NO DECISION RECORDED", "> THE CALLER HAS STOPPED SPEAKING", "> SOMETHING IS CLIMBING THE TOWER",
    "> WINDOW SENSOR 3: BROKEN", "> IT SAW YOU HESITATE", "FATAL: OPERATOR NOT FOUND"]
};

/* ---------- misc ---------- */
const GHOST_WORDS = ["BEHIND YOU", "IT HEARD YOU", "DON'T LISTEN", "NOT HUMAN", "OPEN IT", "{name} ARE YOU THERE", "SHE IS LYING", "WHO ELSE IS ON THE LINE"];

const BIOS = [
  "RIDGE STATION 4 // FIRMWARE 1.0.84",
  "MEMORY CHECK.......... 64K OK",
  "RADIO RECEIVER........ ONLINE",
  "DOOR LOCK 01.......... ENGAGED",
  "WAVEFORM ANALYSER..... ONLINE",
  "OPERATOR RECORDS...... 4 FILES CORRUPTED",
  "WARNING: PREVIOUS OPERATORS NOT FOUND",
  "WARNING: YOU ARE NOT ALONE ON THIS FREQUENCY",
  "LISTENING..."
];

const FACES = [String.raw`       .-""""""""-.
     .'   _    _   '.
    /    (@)  (@)    \
   |        /\        |
   |       /__\       |
   |  \/\/\/\/\/\/\/  |
    \   |VVVVVVVV|   /
     '.  \______/  .'
       '-........-'`];