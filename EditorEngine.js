import * as THREE from 'three';
import { generateId } from './utils.js';

const SNAP = 15;

export class EditorEngine {
  constructor(container, onModeChange) {
    this.container = container;
    this.onModeChange = onModeChange;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.OrthographicCamera(
      container.clientWidth / -2,
      container.clientWidth / 2,
      container.clientHeight / 2,
      container.clientHeight / -2,
      1, 1000
    );
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.lines = new Map();
    this.endpoints = new Map();

    this.mode = "neutral";
    this.selectedLine = null;

    this.insertStart = null;
    this.mouse = { x: 0, y: 0 };

    this.dragging = null;

    this.objects = [];
    
    this.history = [];
    this.historyIndex = -1;

    this.selectedLines = new Set();
    this.lockedLines = new Set();

    this.isSelecting = false;
    this.selectionStart = null;
    this.selectionEnd = null;
    
    this.grid = new THREE.GridHelper(1000, 50, 0x222244, 0x222244);
    this.grid.rotation.x = Math.PI / 2;
    this.scene.add(this.grid);

    this.setupEvents();
    this.animate();
  }

  setMode(m) {
    this.mode = m;
    this.insertStart = null;
    this.onModeChange(m);
  }

  // -------- INPUT --------
  getMouse(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - rect.width / 2,
      y: -(e.clientY - rect.top - rect.height / 2)
    };
  }

  findEndpoint(pos) {
    let res = null;
    this.endpoints.forEach((ep, id) => {
      if (Math.hypot(ep.x - pos.x, ep.y - pos.y) < 10) res = id;
    });
    return res;
  }

  findSnap(pos) {
    let best = null;
    this.endpoints.forEach((ep, id) => {
      const d = Math.hypot(ep.x - pos.x, ep.y - pos.y);
      if (d < SNAP) best = id;
    });
    return best;
  }

  // -------- EVENTS --------
  setupEvents() {
    const c = this.renderer.domElement;

      c.addEventListener("mousemove", e => {
    const pos = this.getMouse(e);
    this.mouse = pos;

    if (this.isSelecting) {
      this.selectionEnd = pos;
    }

    if (this.dragging) {

  // 🚫 check if endpoint belongs to locked line
  const isLocked = [...this.lines.values()].some(l =>
    this.lockedLines.has(l.id) &&
    (l.a === this.dragging || l.b === this.dragging)
  );

  if (isLocked) return;

  const ep = this.endpoints.get(this.dragging);
  ep.x = pos.x;
  ep.y = pos.y;
}
  });

    c.addEventListener("mousedown", e => {
      const pos = this.getMouse(e);

      if (this.mode === "neutral") {
      this.isSelecting = true;
      this.selectionStart = pos;
      this.selectionEnd = pos;
    }

      if (this.mode === "move") {
        const id = this.findEndpoint(pos);
        if (id) this.dragging = id;
      }
    });

    c.addEventListener("mouseup", () => {

    if (this.isSelecting) {
      this.isSelecting = false;

      this.selectedLines.clear();

      this.lines.forEach((line, id) => {
        const a = this.endpoints.get(line.a);
        const b = this.endpoints.get(line.b);

        if (this.lineInSelection(a, b)) {
          this.selectedLines.add(id);
        }
      });
    }

    this.dragging = null;
  });

    c.addEventListener("click", e => {
      const pos = this.getMouse(e);

      if (this.mode === "insert") {
        if (!this.insertStart) {
          this.insertStart = pos;
        } else {
          this.createLine(this.insertStart, pos);
          this.insertStart = pos;
        }
      }

      if (this.mode === "delete") {
        this.deleteLine(pos);
      }

      if (this.mode === "neutral") {
        this.selectedLine = null;
      }
    });
  }

  createLine(a, b) {
    this.saveHistory();
    const idA = this.snapOrCreate(a);
    const idB = this.snapOrCreate(b);

    if (idA === idB) return;

    const id = generateId();
    this.lines.set(id, { id, a: idA, b: idB });
  }

  snapOrCreate(p) {
    const snap = this.findSnap(p);
    if (snap) return snap;

    const id = generateId();
    this.endpoints.set(id, { id, x: p.x, y: p.y });
    return id;
  }

  deleteLine(pos) {
  //this.saveHistory();
  let target = null;

  this.lines.forEach((l, id) => {
    const a = this.endpoints.get(l.a);
    const b = this.endpoints.get(l.b);

    if (this.distToSegment(pos, a, b) < 10) target = id;
  });

  if (!target) return;

  this.saveHistory();

  const line = this.lines.get(target);
  this.lines.delete(target);

    // check if endpoints are still used
  const stillUsesA = [...this.lines.values()].some(l => l.a === line.a || l.b === line.a);
  const stillUsesB = [...this.lines.values()].some(l => l.a === line.b || l.b === line.b);

  if (!stillUsesA) this.endpoints.delete(line.a);
  if (!stillUsesB) this.endpoints.delete(line.b);

  const epA = this.endpoints.get(line.a);
  const epB = this.endpoints.get(line.b);

  // find connected lines
  const connectedA = [];
  const connectedB = [];

  this.lines.forEach((l, id) => {
    if (l.a === line.a || l.b === line.a) connectedA.push(id);
    if (l.a === line.b || l.b === line.b) connectedB.push(id);
  });

  // merge endpoints if both still used
  if (connectedA.length && connectedB.length) {
    const mid = {
      x: (epA.x + epB.x) / 2,
      y: (epA.y + epB.y) / 2
    };

    epA.x = mid.x;
    epA.y = mid.y;

    connectedB.forEach(id => {
      const l = this.lines.get(id);
      if (l.a === line.b) l.a = line.a;
      if (l.b === line.b) l.b = line.a;
    });

    this.endpoints.delete(line.b);
  }
}

  distToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = ((p.x - a.x)*dx + (p.y - a.y)*dy)/(dx*dx+dy*dy);
    const tt = Math.max(0, Math.min(1, t));
    const x = a.x + tt*dx;
    const y = a.y + tt*dy;
    return Math.hypot(p.x-x, p.y-y);
  }

  // -------- DRAW --------
  render() {
  this.objects.forEach(o => this.scene.remove(o));
  this.objects = [];

  // -------- LINES --------
  this.lines.forEach(l => {

    const isSelected = this.selectedLines.has(l.id);
    const isLocked = this.lockedLines.has(l.id);

    let color = 0x4a90e2;
    if (isLocked) color = 0xff5555;
    else if (isSelected) color = 0xffff00;

    const a = this.endpoints.get(l.a);
    const b = this.endpoints.get(l.b);

    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x, a.y, 0),
      new THREE.Vector3(b.x, b.y, 0)
    ]);

    const mat = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geo, mat);

    this.scene.add(line);
    this.objects.push(line);
  });

  // -------- ENDPOINTS --------
  this.endpoints.forEach((ep, id) => {

    let color = 0xffffff;

    if (id === this.dragging) {
      color = 0xffaa00;
    }

    const circle = new THREE.Mesh(
      new THREE.CircleGeometry(5, 20),
      new THREE.MeshBasicMaterial({ color })
    );

    circle.position.set(ep.x, ep.y, 0);
    this.scene.add(circle);
    this.objects.push(circle);
  });

  // -------- RUBBER BAND --------
  if (this.mode === "insert" && this.insertStart) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(this.insertStart.x, this.insertStart.y, 0),
      new THREE.Vector3(this.mouse.x, this.mouse.y, 0)
    ]);

    const mat = new THREE.LineDashedMaterial({
      color: 0x7ed321,
      dashSize: 5,
      gapSize: 5
    });

    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();

    this.scene.add(line);
    this.objects.push(line);
  }

  // -------- SELECTION BOX --------
  if (this.isSelecting && this.selectionStart && this.selectionEnd) {

    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(this.selectionStart.x, this.selectionStart.y, 0),
      new THREE.Vector3(this.selectionEnd.x, this.selectionStart.y, 0),
      new THREE.Vector3(this.selectionEnd.x, this.selectionEnd.y, 0),
      new THREE.Vector3(this.selectionStart.x, this.selectionEnd.y, 0),
      new THREE.Vector3(this.selectionStart.x, this.selectionStart.y, 0),
    ]);

    const mat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const box = new THREE.Line(geo, mat);

    this.scene.add(box);
    this.objects.push(box);
  }
}

  animate() {
    requestAnimationFrame(() => this.animate());
    this.render();
    this.renderer.render(this.scene, this.camera);
  }

  forceRedraw() {
  // do nothing — render loop handles redraw
}

  save() {
    return JSON.stringify({
      lines: [...this.lines.values()],
      endpoints: [...this.endpoints.values()]
    });
  }

  load(data) {
    const d = JSON.parse(data);
    this.lines = new Map(d.lines.map(l => [l.id, l]));
    this.endpoints = new Map(d.endpoints.map(e => [e.id, e]));
  }
  
  saveHistory() {
  const snapshot = {
    lines: JSON.parse(JSON.stringify([...this.lines])),
    endpoints: JSON.parse(JSON.stringify([...this.endpoints]))
  };

  this.history = this.history.slice(0, this.historyIndex + 1);
  this.history.push(snapshot);

  if (this.history.length > 20) this.history.shift();

  this.historyIndex = this.history.length - 1;
}

undo() {
  if (this.historyIndex <= 0) return;

  this.historyIndex--;
  const state = this.history[this.historyIndex];

  this.lines = new Map(state.lines);
  this.endpoints = new Map(state.endpoints);
}

lineInSelection(a, b) {
  const minX = Math.min(this.selectionStart.x, this.selectionEnd.x);
  const maxX = Math.max(this.selectionStart.x, this.selectionEnd.x);
  const minY = Math.min(this.selectionStart.y, this.selectionEnd.y);
  const maxY = Math.max(this.selectionStart.y, this.selectionEnd.y);

  return (
    (a.x >= minX && a.x <= maxX && a.y >= minY && a.y <= maxY) ||
    (b.x >= minX && b.x <= maxX && b.y >= minY && b.y <= maxY)
  );
}

lockSelected() {
  this.selectedLines.forEach(id => this.lockedLines.add(id));
}

unlockSelected() {
  this.selectedLines.forEach(id => this.lockedLines.delete(id));
}
}

