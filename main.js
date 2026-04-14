import { EditorEngine } from './EditorEngine.js';


// -------- STATUS --------
function updateStatus(mode) {
  const text = document.getElementById("statusText");
  const hints = document.getElementById("statusHints");
  

  text.innerText = "Mode: " + mode.toUpperCase();

  const map = {
    neutral: "Click to select • Drag to box-select",
    insert: "Click to place points • ESC to finish",
    move: "Drag endpoints • Locked lines won't move",
    delete: "Click line to delete",
  };

  hints.innerText = map[mode] 
  document.getElementById("statusKeys").innerText = "I=Insert  M=Move  D=Delete  N=Neutral";
}

function updateMode(mode) {
  updateStatus(mode);
  highlightActive(mode);
}

// -------- ENGINE --------
const engine = new EditorEngine(
  document.getElementById("canvas"),
  updateMode
);

// -------- BUTTONS --------
const insert = document.getElementById("insert");
const move = document.getElementById("move");
const del = document.getElementById("delete");
const neutral = document.getElementById("neutral");

const refresh = document.getElementById("refresh");
const undo = document.getElementById("undo");
const save = document.getElementById("save");
const load = document.getElementById("load");
const quit = document.getElementById("quit");
const lock = document.getElementById("lock");
const unlock = document.getElementById("unlock");

// -------- MODE --------
insert.onclick = () => engine.setMode("insert");
move.onclick = () => engine.setMode("move");
del.onclick = () => engine.setMode("delete");
engine.setMode("neutral");

// -------- ACTIONS --------
undo.onclick = () => engine.undo();

refresh.onclick = () => {
  engine.forceRedraw();
  flashScreen();
};

save.onclick = () => {
  const data = engine.save();
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "canvas.json";
  a.click();
};

load.onclick = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => engine.load(reader.result);
    reader.readAsText(file);
  };
  input.click();
};

quit.onclick = () => {
  if (confirm("Return to Main Screen?")) {
    window.location.href = "main-screen.html";
  }
};

lock.onclick = () => engine.lockSelected();
unlock.onclick = () => engine.unlockSelected();

// -------- FLASH --------
function flashScreen() {
  const canvas = document.querySelector("canvas");

  canvas.style.transition = "filter 150ms";
  canvas.style.filter = "brightness(1.5)";

  setTimeout(() => {
    canvas.style.filter = "brightness(1)";
  }, 150);
}

// -------- KEYBOARD --------
window.addEventListener("keydown", (e) => {
  if (e.key === 'i') engine.setMode("insert");
  if (e.key === 'm') engine.setMode("move");
  if (e.key === 'd') engine.setMode("delete");
  if (e.key === 'n' || e.key === 'Escape') engine.setMode("neutral");
  if (e.key === 'r') {
    engine.forceRedraw();
    flashScreen();
  }
});

function highlightActive(mode) {
  const buttons = ["insert", "move", "delete", "neutral"];

  buttons.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;

    if (id === mode) {
      btn.style.background = "#e94560"; // red
    } else {
      btn.style.background = "#0f3460"; // default
    }
  });
}