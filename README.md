# THECALL
                      
A 1980s-terminal horror game that runs in your web browser. You are the night operator at Ridge Station 4. Emergency radio calls come in from "lost hikers" begging you to unlock the tower door. Some are human. Some are mimics. You never see the caller, so you have to read the **waveform**, the **transcript**, the **door camera** and the **radar**. Survive 5 calls.

> Contains flashing lights, loud sounds, jump scares and horror themes. There is a photosensitivity option in Settings.

## Requirements

**There is nothing to install.** No Node, no Python, no packages, no internet connection needed after you download it.

| You need | Details |
|---|---|
| A modern browser | Chrome, Edge, Firefox or Safari (a recent version) |
| Speakers or headphones | Strongly recommended. Every sound is synthesised in the browser with the Web Audio API, so there are no audio files |
| A mouse and keyboard | Keyboard shortcuts are listed below |

## How to run it after downloading the ZIP

1. On the GitHub page, click the green **Code** button, then **Download ZIP**.
2. Find the ZIP in your Downloads folder, **right-click it and choose Extract All…** (Mac: double-click it).
   **You must extract it.** Running the game from inside the ZIP will not work.
3. Open the extracted folder. Keep all the files and folders together exactly as they are.
4. **Double-click `index.html`.** It opens in your browser.
5. Click **POWER ON** (browsers only allow sound after a click), enter a name, pick a difficulty and click **START SHIFT**.

### Other ways to run it (all optional)

| Method | Steps |
|---|---|
| **VS Code Live Server** | Install VS Code and the **Live Server** extension by Ritwick Dey, open the folder, right-click `index.html`, choose **Open with Live Server** |
| **Python local server** | Open a terminal in the folder and run `python -m http.server 5500`, then visit `http://localhost:5500` |
| **Node local server** | Open a terminal in the folder and run `npx serve`, then open the address it prints |

The game works fine by double-clicking `index.html`. You only need a local server if your browser blocks something.

## How to play

1. A call comes in. Read the **transcript**, watch the **oscilloscope**, and check the **door camera** and **radar**.
2. Use the three **interrogation buttons** to ask for the caller's location, the weather and the passcode.
3. Compare the answers with **Tonight's Log** at the top of the screen.
4. Decide: **UNLOCK DOOR** (save a human) or **SOUND ALARM** (drive off a mimic).
5. A wrong choice triggers a terminal breach and ends the shift. Survive all 5 calls to win.

### Tells that a caller is a mimic

- **Waveform:** square-wave spikes, a dead flatline (the static drops out too), a slow sub-bass throb, or an exact repeating loop. Humans only get random, messy interference.
- **Facts:** wrong passcode, wrong weather, wrong trail, or repeated phrases.
- **Your name:** one mimic knows your operator name. No real hiker could.
- **Radar:** a mimic's blip sometimes teleports and leaves a faint ghost dot. Humans glide smoothly.
- **Timer:** on Normal and Hard, the radar blip creeps toward the tower as the door patience runs out.

## Controls

| Key | Action |
|---|---|
| `1` `2` `3` | Ask for location, weather, passcode |
| `U` | Unlock door |
| `A` | Sound alarm |
| `S` | Switch oscilloscope / spectrum view |
| `N` | Answer the next call (between calls) |
| `M` | Mute |
| `Esc` | Close menus |
| `F2` | Developer debug panel (shows whether the caller is a mimic) |

On many laptops, function keys need `Fn` held down (`Fn+F2`).

## Settings

Open **SETTINGS** in the top bar for volume, mute, CRT effects, and **scare flashes and screen shake** (turn this off if you are sensitive to flashing). Your best score, unlocked **Log Archive** tapes and settings are saved in your browser's local storage on your own computer. Nothing is uploaded anywhere.

## Project structure

```
THECALL/
├── index.html        page layout
├── README.md
├── css/
│   └── style.css     the 1980s terminal look
└── js/
    ├── data.js       callers, tapes and text
    ├── audio.js      synthesised sound (Web Audio API)
    ├── scope.js      oscilloscope and spectrum
    ├── eye.js        ASCII eye
    ├── effects.js    jump scares and screen effects
    ├── visuals.js    door camera, radar, call tracker
    └── game.js       game flow, UI, saving
```

Script order in `index.html` matters, so do not rearrange the `<script>` lines.

## Troubleshooting

| Problem | Fix |
|---|---|
| Plain text, no colours | You did not extract the ZIP, or `css/style.css` is missing from the `css` folder |
| Blank page | A `.js` file is missing from the `js` folder. Re-download the ZIP and extract it fully |
| **POWER ON** does nothing | One of the JS files failed to load. Open the browser developer tools (see below) and read the red error |
| No sound | Click the page first, check **Mute** is off in Settings, and check your system volume |
| Everything looks cut off | Zoom the browser out with `Ctrl` + `-` or maximise the window |
| Want to reset progress | **Settings → Erase save data** |

### Opening the browser developer tools

Only needed for debugging. If `F12` does nothing, try one of these:

- `Fn` + `F12` (many laptops)
- `Ctrl` + `Shift` + `I` (Chrome, Edge, Firefox) or `Ctrl` + `Shift` + `J` (Chrome, Edge: opens the Console directly)
- Right-click anywhere on the page, then **Inspect**
- Browser menu (three dots) → **More tools** → **Developer tools**
- Mac: `Cmd` + `Option` + `I`

Then click the **Console** tab and look for red errors.

## Tech

Plain HTML, CSS and JavaScript. HTML5 Canvas for the oscilloscope, spectrum, camera and radar. The Web Audio API for all audio. `localStorage` for saves. No frameworks, no build step, no dependencies.

## License

MIT. See the `LICENSE` file, or delete this section if you do not add one.

## Credits

Created by Kelvin. Made with help from Claude.
