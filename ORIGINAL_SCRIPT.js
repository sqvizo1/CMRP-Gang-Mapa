let isAdminLoggedIn = false;
const STORAGE_KEY = "rp_gang_mapa_data_v7_gta_satellite_8192";
const OLD_KEYS = [
  "rp_gang_mapa_data_v5_gta_satellite_8192",
  "rp_gang_mapa_data_v4_gta_satellite_8192"
];

const viewport = document.getElementById("mapViewport");
const world = document.getElementById("mapWorld");
const overlay = document.getElementById("overlay");
const markers = document.getElementById("markers");
const playerList = document.getElementById("playerList");

let scale = 0.12;
let offsetX = 360;
let offsetY = 20;
let isPanning = false;
let isDrawing = false;
let dragStart = { x: 0, y: 0 };
let mode = null;
let territoryPoints = [];
let workshopPoint = null;
let previewShape = null;
let selectedTerritoryIndex = null;
let selectedWorkshopIndex = null;
let draggingTerritory = false;
let draggingWorkshop = false;
let lastWorldMouse = null;
let didDragEdit = false;

function loadData() {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) return JSON.parse(current);
  for (const key of OLD_KEYS) {
    const old = localStorage.getItem(key);
    if (old) {
      localStorage.setItem(STORAGE_KEY, old);
      return JSON.parse(old);
    }
  }
  return { territories: [], workshops: [] };
}
let data = loadData();

data.territories = data.territories.map(t => ({ opacity: 0.45, ...t }));
data.workshops = data.workshops.map(w => ({ ...w }));

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function updateTransform() {
  world.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  updateWorkshopScaling();
}

function getWorkshopScaleFactor() {
  const normalZoom = 0.45;
  const maxScaleFactor = 4;
  if (scale >= normalZoom) return 1;
  return Math.min(maxScaleFactor, normalZoom / Math.max(scale, 0.06));
}

function updateWorkshopScaling() {
  const factor = getWorkshopScaleFactor();
  document.querySelectorAll(".workshop-marker").forEach(marker => {
    marker.style.transform = `translate(-50%, -100%) scale(${factor})`;
    marker.style.transformOrigin = "center bottom";
  });
}
function screenToWorld(clientX, clientY) {
  const rect = viewport.getBoundingClientRect();
  return { x: (clientX - rect.left - offsetX) / scale, y: (clientY - rect.top - offsetY) / scale };
}
function centroid(points) {
  return points.reduce((a, p) => ({ x: a.x + p.x / points.length, y: a.y + p.y / points.length }), { x: 0, y: 0 });
}
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function escapeHtml(str = "") {
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function focusMapOn(x, y, targetScale = null) {
  const rect = viewport.getBoundingClientRect();
  if (targetScale) scale = Math.min(2.8, Math.max(0.06, targetScale));
  offsetX = rect.width / 2 - x * scale;
  offsetY = rect.height / 2 - y * scale;
  updateTransform();
}
function flashPoint(x, y) {
  const pulse = document.createElement("div");
  pulse.className = "map-pulse";
  pulse.style.left = `${x}px`;
  pulse.style.top = `${y}px`;
  markers.appendChild(pulse);
  setTimeout(() => pulse.remove(), 1200);
}
function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 0.000001) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}
function eraseTerritoryAt(clientX, clientY) {
  const p = screenToWorld(clientX, clientY);
  for (let i = data.territories.length - 1; i >= 0; i--) {
    const territory = data.territories[i];
    if (pointInPolygon(p, territory.points)) {
      if (confirm(`Vymazať územie "${territory.text}"?`)) {
        data.territories.splice(i, 1);
        saveData(); render();
      }
      return true;
    }
  }
  return false;
}
function simplifyFreehand(points) {
  if (points.length <= 2) return points;
  const simplified = [points[0]];
  for (const p of points) {
    if (distance(p, simplified[simplified.length - 1]) > 10) simplified.push(p);
  }
  if (simplified.length > 2 && distance(simplified[0], simplified[simplified.length - 1]) < 15) simplified.pop();
  return simplified;
}
function clearTemp() {
  document.querySelectorAll(".temp-shape,.temp-point").forEach(e => e.remove());
  previewShape = null;
}
function setMode(newMode) {
  const adminModes = ["territory", "workshop", "eraser", "editTerritory", "editWorkshop"];
  if (adminModes.includes(newMode) && !isAdminLoggedIn) {
    alert("Najprv sa prihlás ako admin.");
    return;
  }
  mode = newMode;
  territoryPoints = [];
  workshopPoint = null;
  isDrawing = false;
  selectedTerritoryIndex = null;
  selectedWorkshopIndex = null;
  draggingTerritory = false;
  draggingWorkshop = false;
  didDragEdit = false;
  clearTemp();
  viewport.classList.toggle("draw-mode", mode === "territory");
  viewport.classList.toggle("erase-mode", mode === "eraser");
  viewport.classList.toggle("edit-territory-mode", mode === "editTerritory");
  viewport.classList.toggle("edit-workshop-mode", mode === "editWorkshop");
  document.getElementById("territoryForm").classList.toggle("hidden", mode !== "territory");
  document.getElementById("workshopForm").classList.toggle("hidden", mode !== "workshop");
  document.getElementById("eraserForm").classList.toggle("hidden", mode !== "eraser");
  document.getElementById("editTerritoryForm").classList.toggle("hidden", mode !== "editTerritory");
  document.getElementById("editWorkshopForm").classList.toggle("hidden", mode !== "editWorkshop");
  render();
}
function renderPlayerList() {
  playerList.innerHTML = "";
  const entries = [];
  data.territories.forEach((t, index) => {
    const c = centroid(t.points);
    entries.push({ type: "Územie", title: t.text, color: t.color, x: c.x, y: c.y, index });
  });
  data.workshops.forEach((w, index) => {
    entries.push({ type: "Motorcycle Club", title: w.text, color: w.color, x: w.x, y: w.y, index });
  });
  if (!entries.length) {
    playerList.innerHTML = `<div class="list-empty">Zatiaľ nie sú pridané žiadne územia ani Motorcycle Cluby.</div>`;
    return;
  }
  entries.forEach(item => {
    const btn = document.createElement("button");
    btn.className = "map-list-item";
    btn.innerHTML = `<span class="item-color" style="background:${item.color}"></span><span><span class="item-title">${escapeHtml(item.title)}</span><span class="item-type">${item.type}</span></span>`;
    btn.addEventListener("click", () => {
      focusMapOn(item.x, item.y, Math.max(scale, 0.45));
      flashPoint(item.x, item.y);
    });
    playerList.appendChild(btn);
  });
}
function selectTerritory(index) {
  selectedTerritoryIndex = index;
  const t = data.territories[index];
  if (!t) return;
  document.getElementById("editTerritoryText").value = t.text || "";
  document.getElementById("editTerritoryColor").value = t.color || "#ff2b2b";
  document.getElementById("editTerritoryOpacity").value = t.opacity ?? 0.45;
  render();
}
function selectWorkshop(index) {
  selectedWorkshopIndex = index;
  const w = data.workshops[index];
  if (!w) return;
  document.getElementById("editWorkshopText").value = w.text || "";
  document.getElementById("editWorkshopColor").value = w.color || "#00b7ff";
  render();
}
function render() {
  overlay.innerHTML = "";
  markers.innerHTML = "";
  data.territories.forEach((t, index) => {
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", t.points.map(p => `${p.x},${p.y}`).join(" "));
    poly.setAttribute("fill", hexToRgba(t.color, t.opacity ?? 0.45));
    poly.setAttribute("stroke", t.color);
    if (mode === "editTerritory" && selectedTerritoryIndex === index) poly.classList.add("selected-territory");
    poly.addEventListener("click", e => {
      if (mode === "eraser") {
        e.stopPropagation();
        if (confirm(`Vymazať územie "${t.text}"?`)) {
          data.territories.splice(index, 1); saveData(); render();
        }
      } else if (mode === "editTerritory") {
        e.stopPropagation(); selectTerritory(index);
      }
    });
    poly.addEventListener("mousedown", e => {
      if (mode !== "editTerritory") return;
      e.stopPropagation();
      selectTerritory(index);
      draggingTerritory = true;
      didDragEdit = false;
      lastWorldMouse = screenToWorld(e.clientX, e.clientY);
    });
    overlay.appendChild(poly);

    const c = centroid(t.points);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", c.x);
    text.setAttribute("y", c.y);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.textContent = t.text;
    overlay.appendChild(text);
  });
  data.workshops.forEach((w, index) => {
    const marker = document.createElement("div");
    marker.className = "marker workshop-marker" + (mode === "editWorkshop" && selectedWorkshopIndex === index ? " selected-workshop" : "");
    marker.style.left = `${w.x}px`;
    marker.style.top = `${w.y}px`;
    marker.style.setProperty("--marker-color", w.color);
    marker.innerHTML = `<span class="pin"></span><span class="marker-label"><b>Motorcycle Club</b><small>${escapeHtml(w.text)}</small></span>`;
    marker.addEventListener("click", e => {
      if (didDragEdit) { e.stopPropagation(); didDragEdit = false; return; }
      if (mode === "eraser") {
        e.stopPropagation();
        if (confirm(`Vymazať Motorcycle Club "${w.text}"?`)) {
          data.workshops.splice(index, 1); saveData(); render();
        }
      } else if (mode === "editWorkshop") {
        e.stopPropagation(); selectWorkshop(index);
      }
    });
    marker.addEventListener("mousedown", e => {
      if (mode !== "editWorkshop") return;
      e.stopPropagation();
      selectWorkshop(index);
      draggingWorkshop = true;
      didDragEdit = false;
      lastWorldMouse = screenToWorld(e.clientX, e.clientY);
    });
    markers.appendChild(marker);
  });
  renderPlayerList();
  updateWorkshopScaling();
}
function makePreviewPolygon() {
  previewShape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  previewShape.setAttribute("class", "temp-shape");
  overlay.appendChild(previewShape);
}
function updatePreview() {
  if (!previewShape) makePreviewPolygon();
  previewShape.setAttribute("points", territoryPoints.map(p => `${p.x},${p.y}`).join(" "));
  const color = document.getElementById("territoryColor").value;
  previewShape.setAttribute("fill", hexToRgba(color, 0.3));
  previewShape.setAttribute("stroke", color);
}
function addTempPoint(p) {
  clearTemp();
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", p.x);
  circle.setAttribute("cy", p.y);
  circle.setAttribute("r", 13);
  circle.setAttribute("class", "temp-point");
  overlay.appendChild(circle);
}

viewport.addEventListener("mousedown", e => {
  if (e.button !== 0) return;
  if (mode === "territory") {
    isDrawing = true;
    territoryPoints = [screenToWorld(e.clientX, e.clientY)];
    clearTemp(); makePreviewPolygon(); updatePreview(); return;
  }
  if (["workshop", "eraser", "editTerritory", "editWorkshop"].includes(mode)) return;
  isPanning = true;
  viewport.classList.add("dragging");
  dragStart = { x: e.clientX - offsetX, y: e.clientY - offsetY };
});
window.addEventListener("mousemove", e => {
  if (isDrawing && mode === "territory") {
    const p = screenToWorld(e.clientX, e.clientY);
    const last = territoryPoints[territoryPoints.length - 1];
    if (!last || distance(p, last) > 6) { territoryPoints.push(p); updatePreview(); }
    return;
  }
  if (draggingTerritory && selectedTerritoryIndex !== null) {
    const now = screenToWorld(e.clientX, e.clientY);
    const dx = now.x - lastWorldMouse.x;
    const dy = now.y - lastWorldMouse.y;
    if (Math.abs(dx) + Math.abs(dy) > 0.2) didDragEdit = true;
    const t = data.territories[selectedTerritoryIndex];
    if (t) t.points = t.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    lastWorldMouse = now;
    render();
    return;
  }
  if (draggingWorkshop && selectedWorkshopIndex !== null) {
    const now = screenToWorld(e.clientX, e.clientY);
    const w = data.workshops[selectedWorkshopIndex];
    if (w) { w.x = now.x; w.y = now.y; didDragEdit = true; }
    render();
    return;
  }
  if (!isPanning) return;
  offsetX = e.clientX - dragStart.x;
  offsetY = e.clientY - dragStart.y;
  updateTransform();
});
window.addEventListener("mouseup", () => {
  if (isDrawing && mode === "territory") {
    isDrawing = false;
    territoryPoints = simplifyFreehand(territoryPoints);
    updatePreview(); return;
  }
  if (draggingTerritory || draggingWorkshop) saveData();
  draggingTerritory = false;
  draggingWorkshop = false;
  isPanning = false;
  viewport.classList.remove("dragging");
});
viewport.addEventListener("wheel", e => {
  e.preventDefault();
  const before = screenToWorld(e.clientX, e.clientY);
  const zoom = e.deltaY < 0 ? 1.12 : 0.89;
  scale = Math.min(2.8, Math.max(0.06, scale * zoom));
  const rect = viewport.getBoundingClientRect();
  offsetX = e.clientX - rect.left - before.x * scale;
  offsetY = e.clientY - rect.top - before.y * scale;
  updateTransform();
}, { passive: false });
viewport.addEventListener("click", e => {
  if (mode === "eraser") { eraseTerritoryAt(e.clientX, e.clientY); return; }
  if (mode !== "workshop") return;
  const p = screenToWorld(e.clientX, e.clientY);
  workshopPoint = p;
  addTempPoint(p);
});

document.getElementById("adminBtn").onclick = () => {
  if (isAdminLoggedIn) {
    document.getElementById("adminPanel").classList.toggle("hidden");
  } else {
    document.getElementById("loginBox").classList.toggle("hidden");
  }
};

async function checkAdminSession() {
  try {
    const res = await fetch("auth.php", { credentials: "same-origin" });
    const json = await res.json();
    isAdminLoggedIn = !!json.loggedIn;
    document.getElementById("adminPanel").classList.toggle("hidden", !isAdminLoggedIn);
    if (isAdminLoggedIn) document.getElementById("loginBox").classList.add("hidden");
  } catch (err) {
    isAdminLoggedIn = false;
  }
}

document.getElementById("loginBtn").onclick = async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("loginError");
  errorBox.textContent = "Overujem prihlásenie...";

  try {
    const res = await fetch("login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password })
    });
    const json = await res.json();

    if (json.ok) {
      isAdminLoggedIn = true;
      document.getElementById("loginBox").classList.add("hidden");
      document.getElementById("adminPanel").classList.remove("hidden");
      errorBox.textContent = "";
      document.getElementById("password").value = "";
    } else {
      isAdminLoggedIn = false;
      errorBox.textContent = "Nesprávne prihlasovacie údaje.";
    }
  } catch (err) {
    errorBox.textContent = "Login funguje iba na hostingu/serveri s PHP, nie cez file:// otvorenie.";
  }
};
document.getElementById("territoryModeBtn").onclick = () => setMode("territory");
document.getElementById("workshopModeBtn").onclick = () => setMode("workshop");
document.getElementById("editTerritoryModeBtn").onclick = () => setMode("editTerritory");
document.getElementById("editWorkshopModeBtn").onclick = () => setMode("editWorkshop");
document.getElementById("eraserModeBtn").onclick = () => setMode("eraser");
document.getElementById("cancelModeBtn").onclick = () => setMode(null);
document.getElementById("clearBtn").onclick = () => {
  if (!isAdminLoggedIn) return alert("Najprv sa prihlás ako admin.");
  if (confirm("Naozaj chceš vymazať všetky územia a Motorcycle Cluby?")) {
    data = { territories: [], workshops: [] };
    saveData(); setMode(null); render();
  }
};
document.getElementById("territoryColor").addEventListener("input", updatePreview);
document.getElementById("saveTerritoryBtn").onclick = () => {
  if (!isAdminLoggedIn) return alert("Najprv sa prihlás ako admin.");
  const text = document.getElementById("territoryText").value.trim();
  const color = document.getElementById("territoryColor").value;
  if (territoryPoints.length < 3) return alert("Nakresli uzavretý obvod územia na mape.");
  if (!text) return alert("Napíš text územia.");
  data.territories.push({ points: territoryPoints, color, text, opacity: 0.45 });
  saveData(); setMode(null); render();
  document.getElementById("territoryText").value = "";
};
document.getElementById("saveWorkshopBtn").onclick = () => {
  if (!isAdminLoggedIn) return alert("Najprv sa prihlás ako admin.");
  const text = document.getElementById("workshopText").value.trim();
  const color = document.getElementById("workshopColor").value;
  if (!workshopPoint) return alert("Klikni na miesto na mape.");
  if (!text) return alert("Napíš názov Motorcycle Clubu.");
  data.workshops.push({ x: workshopPoint.x, y: workshopPoint.y, color, text });
  saveData(); setMode(null); render();
  document.getElementById("workshopText").value = "";
};
document.getElementById("saveEditTerritoryBtn").onclick = () => {
  if (!isAdminLoggedIn) return alert("Najprv sa prihlás ako admin.");
  if (selectedTerritoryIndex === null || !data.territories[selectedTerritoryIndex]) return alert("Najprv klikni na územie, ktoré chceš upraviť.");
  const text = document.getElementById("editTerritoryText").value.trim();
  if (!text) return alert("Napíš názov územia.");
  const t = data.territories[selectedTerritoryIndex];
  t.text = text;
  t.color = document.getElementById("editTerritoryColor").value;
  t.opacity = Number(document.getElementById("editTerritoryOpacity").value);
  saveData(); render();
};
document.getElementById("editTerritoryColor").addEventListener("input", () => {
  if (selectedTerritoryIndex === null || !data.territories[selectedTerritoryIndex]) return;
  data.territories[selectedTerritoryIndex].color = document.getElementById("editTerritoryColor").value;
  render();
});
document.getElementById("editTerritoryOpacity").addEventListener("input", () => {
  if (selectedTerritoryIndex === null || !data.territories[selectedTerritoryIndex]) return;
  data.territories[selectedTerritoryIndex].opacity = Number(document.getElementById("editTerritoryOpacity").value);
  render();
});
document.getElementById("saveEditWorkshopBtn").onclick = () => {
  if (!isAdminLoggedIn) return alert("Najprv sa prihlás ako admin.");
  if (selectedWorkshopIndex === null || !data.workshops[selectedWorkshopIndex]) return alert("Najprv klikni na Motorcycle Club, ktorý chceš upraviť.");
  const text = document.getElementById("editWorkshopText").value.trim();
  if (!text) return alert("Napíš názov Motorcycle Clubu.");
  const w = data.workshops[selectedWorkshopIndex];
  w.text = text;
  w.color = document.getElementById("editWorkshopColor").value;
  saveData(); render();
};
document.getElementById("editWorkshopColor").addEventListener("input", () => {
  if (selectedWorkshopIndex === null || !data.workshops[selectedWorkshopIndex]) return;
  data.workshops[selectedWorkshopIndex].color = document.getElementById("editWorkshopColor").value;
  render();
});

updateTransform();
render();
