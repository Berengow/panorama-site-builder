// Panorama Site Builder Pro - Enhanced Application Logic
class PanoramaBuilder {
  constructor() {
    this.project = {
      name: "Новый тур",
      scenes: [],
      settings: {
        theme: "dark",
        primaryColor: "#6366f1",
        bgColor: "#0f172a",
        fontFamily: "Inter",
        showCarousel: true,
        carouselPosition: "bottom",
        showLogo: true,
        logoText: "Моя компания",
        showAbout: false,
        showInfoCards: false,
        showMinimap: false,
        autoRotate: false,
        showProgress: true,
        exportQuality: "medium",
        audioUrl: "",
        uiOpacity: 0.9
      }
    };

    this.currentSceneId = null;
    this.viewer = null;
    this.hotspotMode = false;
    this.nextHotspotId = 1;
    this.editingHotspotId = null;
    this.saveTimeout = null;

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadFromLocalStorage();
    this.renderScenes();
    this.applyTheme();
    this.updateSceneCount();
    this.setupModal();
  }

  bindEvents() {
    document.getElementById("projectName").addEventListener("input", (e) => {
      this.project.name = e.target.value;
      this.debouncedSave();
    });

    document.getElementById("btnAddScenes").addEventListener("click", () => {
      document.getElementById("fileInput").click();
    });

    document.getElementById("fileInput").addEventListener("change", (e) => {
      this.handleFileUpload(e.target.files);
      e.target.value = "";
    });

    document.getElementById("btnExport").addEventListener("click", () => this.exportSite());
    document.getElementById("btnSave").addEventListener("click", () => this.saveProject());
    document.getElementById("btnLoad").addEventListener("click", () => this.loadProject());

    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });

    this.bindSettings();

    document.getElementById("btnAddHotspot").addEventListener("click", () => this.toggleHotspotMode());
    document.getElementById("btnResetView").addEventListener("click", () => this.resetView());

    const opacitySlider = document.getElementById("uiOpacity");
    opacitySlider.addEventListener("input", () => {
      document.getElementById("opacityValue").textContent = parseFloat(opacitySlider.value).toFixed(2);
    });
  }

  bindSettings() {
    const settings = [
      "autoRotate", "showProgress", "themePreset", "primaryColor", "bgColor",
      "fontFamily", "uiOpacity", "showCarousel", "carouselPosition", "showLogo",
      "logoText", "showAbout", "showInfoCards", "showMinimap", "exportQuality", "audioUrl"
    ];

    settings.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const event = (el.type === "checkbox" || el.tagName === "SELECT") ? "change" : "input";
      el.addEventListener(event, () => {
        const value = el.type === "checkbox" ? el.checked : el.value;
        this.updateSetting(id, value);
      });
    });
  }

  updateSetting(key, value) {
    if (key === "themePreset") {
      this.applyThemePreset(value);
    } else if (key === "primaryColor") {
      this.project.settings.primaryColor = value;
      document.documentElement.style.setProperty("--primary", value);
    } else if (key === "bgColor") {
      this.project.settings.bgColor = value;
      document.documentElement.style.setProperty("--bg", value);
    } else {
      this.project.settings[key] = value;
    }
    this.debouncedSave();
    if (this.viewer) this.updatePreview();
  }

  applyThemePreset(preset) {
    const presets = {
      dark: { primary: "#6366f1", bg: "#0f172a" },
      light: { primary: "#4f46e5", bg: "#f8fafc" },
      modern: { primary: "#8b5cf6", bg: "#1e1b4b" },
      minimal: { primary: "#0ea5e9", bg: "#ffffff" },
      luxury: { primary: "#d4af37", bg: "#1a1a1a" }
    };
    const p = presets[preset] || presets.dark;
    this.project.settings.primaryColor = p.primary;
    this.project.settings.bgColor = p.bg;
    this.project.settings.theme = preset;
    document.getElementById("primaryColor").value = p.primary;
    document.getElementById("bgColor").value = p.bg;
    this.applyTheme();
  }

  applyTheme() {
    document.documentElement.style.setProperty("--primary", this.project.settings.primaryColor);
    document.documentElement.style.setProperty("--bg", this.project.settings.bgColor);
  }

  async handleFileUpload(files) {
    const sorted = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
    for (const file of sorted) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await this.readFileAsDataURL(file);
      const scene = {
        id: "scene_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        name: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
        imageData: dataUrl,
        hotspots: [],
        initialPitch: 0,
        initialYaw: 0,
        initialHfov: 100
      };
      this.project.scenes.push(scene);
    }
    this.renderScenes();
    this.updateSceneCount();
    if (this.project.scenes.length > 0 && !this.currentSceneId) {
      this.selectScene(this.project.scenes[0].id);
    }
    this.debouncedSave();
  }

  readFileAsDataURL(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  updateSceneCount() {
    document.getElementById("sceneCount").textContent = this.project.scenes.length;
  }

  renderScenes() {
    const list = document.getElementById("scenesList");
    if (this.project.scenes.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🖼️</div><p>Загрузите equirectangular панорамы</p><small>JPEG, PNG, WebP</small></div>`;
      return;
    }

    list.innerHTML = this.project.scenes.map((scene, index) => `
      <div class="scene-item ${scene.id === this.currentSceneId ? 'active' : ''}" data-id="${scene.id}" draggable="true">
        <span class="scene-order">${index + 1}</span>
        <img class="scene-thumb" src="${scene.imageData}" alt="">
        <div class="scene-info">
          <div class="scene-name" contenteditable="true" data-id="${scene.id}">${scene.name}</div>
        </div>
        <div class="scene-actions">
          <button class="btn-delete" data-id="${scene.id}" title="Удалить">✕</button>
        </div>
      </div>
    `).join("");

    list.querySelectorAll(".scene-item").forEach(item => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".scene-actions") || e.target.contentEditable === "true") return;
        this.selectScene(item.dataset.id);
      });
      item.querySelector(".btn-delete").addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteScene(item.dataset.id);
      });
      const nameEl = item.querySelector(".scene-name");
      nameEl.addEventListener("blur", () => {
        const scene = this.project.scenes.find(s => s.id === nameEl.dataset.id);
        if (scene) scene.name = nameEl.textContent.trim() || "Без названия";
        this.debouncedSave();
      });
    });

    this.initDragDrop();
  }

  initDragDrop() {
    const items = document.querySelectorAll(".scene-item");
    let dragged = null;
    items.forEach(item => {
      item.addEventListener("dragstart", () => { dragged = item; item.style.opacity = "0.4"; });
      item.addEventListener("dragend", () => { item.style.opacity = "1"; dragged = null; });
      item.addEventListener("dragover", (e) => e.preventDefault());
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        if (dragged && dragged !== item) {
          const fromId = dragged.dataset.id;
          const toId = item.dataset.id;
          const fromIndex = this.project.scenes.findIndex(s => s.id === fromId);
          const toIndex = this.project.scenes.findIndex(s => s.id === toId);
          const [moved] = this.project.scenes.splice(fromIndex, 1);
          this.project.scenes.splice(toIndex, 0, moved);
          this.renderScenes();
          this.debouncedSave();
        }
      });
    });
  }

  selectScene(id) {
    this.currentSceneId = id;
    this.renderScenes();
    this.loadPreview();
    this.renderHotspotsList();
  }

  deleteScene(id) {
    if (!confirm("Удалить эту сцену?")) return;
    this.project.scenes = this.project.scenes.filter(s => s.id !== id);
    if (this.currentSceneId === id) this.currentSceneId = this.project.scenes[0]?.id || null;
    this.renderScenes();
    this.updateSceneCount();
    this.loadPreview();
    this.debouncedSave();
  }

  loadPreview() {
    const container = document.getElementById("pannellumContainer");
    const placeholder = document.querySelector(".preview-placeholder");

    if (!this.currentSceneId) {
      container.style.display = "none";
      placeholder.style.display = "flex";
      if (this.viewer) { this.viewer.destroy(); this.viewer = null; }
      return;
    }

    placeholder.style.display = "none";
    container.style.display = "block";

    const scene = this.project.scenes.find(s => s.id === this.currentSceneId);
    if (!scene) return;

    if (this.viewer) this.viewer.destroy();

    this.viewer = pannellum.viewer("pannellumContainer", {
      type: "equirectangular",
      panorama: scene.imageData,
      autoLoad: true,
      pitch: scene.initialPitch || 0,
      yaw: scene.initialYaw || 0,
      hfov: scene.initialHfov || 100,
      hotSpots: scene.hotspots.map(h => this.hotspotToPannellum(h)),
      autoRotate: this.project.settings.autoRotate ? -2 : 0,
      showControls: true
    });

    this.viewer.on("mousedown", (event) => {
      if (!this.hotspotMode) return;
      const coords = this.viewer.mouseEventToCoords(event);
      if (coords) {
        this.addHotspot(coords[0], coords[1]);
        this.hotspotMode = false;
        document.getElementById("hotspotModeIndicator").style.display = "none";
        document.getElementById("btnAddHotspot").textContent = "📍 Добавить хотспот";
      }
    });

    this.viewer.on("animatefinished", () => {
      const s = this.project.scenes.find(sc => sc.id === this.currentSceneId);
      if (s && this.viewer) {
        s.initialPitch = this.viewer.getPitch();
        s.initialYaw = this.viewer.getYaw();
        s.initialHfov = this.viewer.getHfov();
        this.updateViewInfo();
        this.debouncedSave();
      }
    });

    this.updateViewInfo();
  }

  updateViewInfo() {
    if (!this.viewer) return;
    const pitch = Math.round(this.viewer.getPitch());
    const yaw = Math.round(this.viewer.getYaw());
    document.getElementById("viewInfo").textContent = `pitch: ${pitch}° yaw: ${yaw}°`;
  }

  hotspotToPannellum(h) {
    return {
      pitch: h.pitch,
      yaw: h.yaw,
      type: h.type === "scene" ? "scene" : "info",
      text: h.text || "Хотспот",
      sceneId: h.type === "scene" ? h.targetScene : undefined,
      URL: h.type === "info" && h.url ? h.url : undefined
    };
  }

  toggleHotspotMode() {
    if (!this.currentSceneId) { alert("Сначала выберите сцену"); return; }
    this.hotspotMode = !this.hotspotMode;
    const indicator = document.getElementById("hotspotModeIndicator");
    const btn = document.getElementById("btnAddHotspot");
    if (this.hotspotMode) {
      indicator.style.display = "inline";
      btn.textContent = "Отмена";
    } else {
      indicator.style.display = "none";
      btn.textContent = "📍 Добавить хотспот";
    }
  }

  addHotspot(pitch, yaw) {
    const scene = this.project.scenes.find(s => s.id === this.currentSceneId);
    if (!scene) return;
    const hotspot = {
      id: "hs_" + this.nextHotspotId++,
      pitch: Math.round(pitch * 10) / 10,
      yaw: Math.round(yaw * 10) / 10,
      type: "info",
      text: "Новый хотспот",
      url: "",
      targetScene: ""
    };
    scene.hotspots.push(hotspot);
    this.loadPreview();
    this.renderHotspotsList();
    this.debouncedSave();
    setTimeout(() => this.editHotspot(hotspot.id), 300);
  }

  renderHotspotsList() {
    const list = document.getElementById("hotspotsList");
    const scene = this.project.scenes.find(s => s.id === this.currentSceneId);
    if (!scene || scene.hotspots.length === 0) {
      list.innerHTML = `<p class="hint">Выберите сцену → нажмите «Добавить хотспот» → кликните на панораму</p>`;
      return;
    }
    list.innerHTML = scene.hotspots.map(h => `
      <div class="hotspot-item" data-id="${h.id}">
        <strong>${h.text}</strong> <span style="color:var(--text-muted)">(${h.type})</span><br>
        <small>pitch: ${h.pitch}° · yaw: ${h.yaw}°</small>
        <div class="actions">
          <button class="btn btn-small btn-secondary edit-hs" data-id="${h.id}">Редактировать</button>
          <button class="btn btn-small del-hs" style="color:var(--danger)" data-id="${h.id}">Удалить</button>
        </div>
      </div>
    `).join("");

    list.querySelectorAll(".edit-hs").forEach(btn => {
      btn.addEventListener("click", () => this.editHotspot(btn.dataset.id));
    });
    list.querySelectorAll(".del-hs").forEach(btn => {
      btn.addEventListener("click", () => this.deleteHotspot(btn.dataset.id));
    });
  }

  setupModal() {
    const modal = document.getElementById("hotspotModal");
    document.getElementById("modalCancel").addEventListener("click", () => modal.style.display = "none");
    document.getElementById("modalSave").addEventListener("click", () => this.saveHotspotFromModal());
    document.getElementById("modalType").addEventListener("change", (e) => {
      document.getElementById("modalUrlGroup").style.display = e.target.value === "info" ? "block" : "none";
      document.getElementById("modalSceneGroup").style.display = e.target.value === "scene" ? "block" : "none";
    });
  }

  editHotspot(id) {
    const scene = this.project.scenes.find(s => s.id === this.currentSceneId);
    const h = scene.hotspots.find(hs => hs.id === id);
    if (!h) return;
    this.editingHotspotId = id;

    document.getElementById("modalText").value = h.text;
    document.getElementById("modalType").value = h.type;
    document.getElementById("modalUrl").value = h.url || "";

    const targetSelect = document.getElementById("modalTargetScene");
    targetSelect.innerHTML = this.project.scenes
      .filter(s => s.id !== this.currentSceneId)
      .map(s => `<option value="${s.id}" ${s.id === h.targetScene ? "selected" : ""}>${s.name}</option>`)
      .join("");

    document.getElementById("modalUrlGroup").style.display = h.type === "info" ? "block" : "none";
    document.getElementById("modalSceneGroup").style.display = h.type === "scene" ? "block" : "none";
    document.getElementById("hotspotModal").style.display = "flex";
  }

  saveHotspotFromModal() {
    const scene = this.project.scenes.find(s => s.id === this.currentSceneId);
    const h = scene.hotspots.find(hs => hs.id === this.editingHotspotId);
    if (!h) return;

    h.text = document.getElementById("modalText").value.trim() || "Хотспот";
    h.type = document.getElementById("modalType").value;
    h.url = document.getElementById("modalUrl").value;
    h.targetScene = document.getElementById("modalTargetScene").value;

    document.getElementById("hotspotModal").style.display = "none";
    this.loadPreview();
    this.renderHotspotsList();
    this.debouncedSave();
  }

  deleteHotspot(id) {
    const scene = this.project.scenes.find(s => s.id === this.currentSceneId);
    scene.hotspots = scene.hotspots.filter(h => h.id !== id);
    this.loadPreview();
    this.renderHotspotsList();
    this.debouncedSave();
  }

  resetView() {
    if (this.viewer) {
      this.viewer.setPitch(0);
      this.viewer.setYaw(0);
      this.viewer.setHfov(100);
    }
  }

  updatePreview() { if (this.viewer) this.loadPreview(); }

  switchTab(tab) {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add("active");
    document.getElementById(`tab-${tab}`).classList.add("active");
  }

  debouncedSave() {
    clearTimeout(this.saveTimeout);
    document.getElementById("saveStatus").textContent = "Сохранение...";
    document.getElementById("saveStatus").style.color = "var(--text-muted)";
    this.saveTimeout = setTimeout(() => {
      this.saveToLocalStorage();
      document.getElementById("saveStatus").textContent = "Сохранено";
      document.getElementById("saveStatus").style.color = "var(--success)";
    }, 600);
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem("panoramaBuilderProjectPro", JSON.stringify(this.project));
    } catch (e) {
      console.warn("localStorage full");
    }
  }

  loadFromLocalStorage() {
    const saved = localStorage.getItem("panoramaBuilderProjectPro") || localStorage.getItem("panoramaBuilderProject");
    if (saved) {
      try {
        this.project = JSON.parse(saved);
        document.getElementById("projectName").value = this.project.name;
        Object.keys(this.project.settings).forEach(key => {
          const el = document.getElementById(key);
          if (el) {
            if (el.type === "checkbox") el.checked = !!this.project.settings[key];
            else if (el.type !== "range" || key !== "uiOpacity") el.value = this.project.settings[key];
          }
        });
        if (this.project.settings.uiOpacity) {
          document.getElementById("uiOpacity").value = this.project.settings.uiOpacity;
          document.getElementById("opacityValue").textContent = parseFloat(this.project.settings.uiOpacity).toFixed(2);
        }
        this.applyTheme();
      } catch (e) {}
    }
  }

  saveProject() {
    const blob = new Blob([JSON.stringify(this.project, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (this.project.name || "tour") + ".panorama.json";
    a.click();
  }

  loadProject() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        this.project = JSON.parse(text);
        document.getElementById("projectName").value = this.project.name;
        this.renderScenes();
        this.updateSceneCount();
        if (this.project.scenes.length) this.selectScene(this.project.scenes[0].id);
        this.debouncedSave();
        alert("Проект загружен");
      } catch (err) { alert("Ошибка загрузки"); }
    };
    input.click();
  }

  async exportSite() {
    if (this.project.scenes.length === 0) { alert("Добавьте хотя бы одну сцену"); return; }
    const zip = new JSZip();
    const quality = this.project.settings.exportQuality;
    const panoramasFolder = zip.folder("panoramas");
    const sceneMap = {};

    for (const scene of this.project.scenes) {
      const optimized = await this.optimizeImage(scene.imageData, quality);
      const filename = scene.id + ".jpg";
      panoramasFolder.file(filename, optimized, { base64: true });
      sceneMap[scene.id] = "panoramas/" + filename;
    }

    const html = this.generateExportHTML(sceneMap);
    zip.file("index.html", html);

    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = (this.project.name || "panorama-tour") + ".zip";
    a.click();
  }

  async optimizeImage(dataUrl, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width, height = img.height, q = 0.92;
        if (quality === "medium") { width = Math.min(width, 4096); height = Math.round(height * (width / img.width)); q = 0.78; }
        else if (quality === "low") { width = Math.min(width, 2048); height = Math.round(height * (width / img.width)); q = 0.65; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", q).split(",")[1]);
      };
      img.src = dataUrl;
    });
  }

  generateExportHTML(sceneMap) {
    const settings = this.project.settings;
    const scenesConfig = {};
    this.project.scenes.forEach((scene) => {
      scenesConfig[scene.id] = {
        type: "equirectangular",
        panorama: sceneMap[scene.id],
        pitch: scene.initialPitch || 0,
        yaw: scene.initialYaw || 0,
        hfov: scene.initialHfov || 100,
        hotSpots: scene.hotspots.map(h => ({
          pitch: h.pitch, yaw: h.yaw,
          type: h.type === "scene" ? "scene" : "info",
          text: h.text,
          sceneId: h.type === "scene" ? h.targetScene : undefined,
          URL: h.type === "info" && h.url ? h.url : undefined
        })).filter(h => h.type === "info" || h.sceneId)
      };
    });
    const firstScene = this.project.scenes[0]?.id || "";

    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.project.name || "Virtual Tour"}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.7/build/pannellum.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${settings.fontFamily}, system-ui, sans-serif; background: #000; overflow: hidden; }
    #panorama { width: 100vw; height: 100vh; }
    .logo { position: absolute; top: 20px; left: 20px; background: rgba(0,0,0,${settings.uiOpacity || 0.7}); color: white; padding: 12px 22px; border-radius: 14px; font-weight: 700; backdrop-filter: blur(12px); font-size: 15px; }
    .carousel { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; background: rgba(0,0,0,${settings.uiOpacity || 0.7}); padding: 12px 16px; border-radius: 18px; backdrop-filter: blur(12px); max-width: 92vw; overflow-x: auto; }
    .carousel.side { bottom: auto; top: 50%; left: 20px; transform: translateY(-50%); flex-direction: column; }
    .carousel-item { width: 86px; height: 54px; border-radius: 10px; cursor: pointer; border: 2px solid transparent; object-fit: cover; transition: all 0.2s; }
    .carousel-item.active, .carousel-item:hover { border-color: ${settings.primaryColor}; transform: scale(1.06); }
    .about-btn { position: absolute; top: 20px; right: 20px; background: ${settings.primaryColor}; color: white; border: none; padding: 11px 18px; border-radius: 10px; cursor: pointer; font-weight: 600; }
    .progress-bar { position: absolute; top: 0; left: 0; height: 4px; background: ${settings.primaryColor}; width: 0%; transition: width 0.4s; z-index: 200; }
  </style>
</head>
<body>
  ${settings.showProgress ? '<div class="progress-bar" id="progress"></div>' : ''}
  <div id="panorama"></div>
  ${settings.showLogo ? `<div class="logo">${settings.logoText || this.project.name}</div>` : ''}
  ${settings.showAbout ? `<button class="about-btn" onclick="alert('Информация о туре')">Об аудитории</button>` : ''}
  ${settings.showCarousel ? `<div class="carousel ${settings.carouselPosition === 'side' ? 'side' : ''}" id="carousel"></div>` : ''}
  ${settings.audioUrl ? `<audio id="bgAudio" src="${settings.audioUrl}" loop autoplay muted></audio>` : ''}

  <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.7/build/pannellum.js"></script>
  <script>
    const config = {
      default: { firstScene: "${firstScene}", sceneFadeDuration: 1000, autoLoad: true, autoRotate: ${settings.autoRotate ? -2 : 0}, showControls: true },
      scenes: ${JSON.stringify(scenesConfig, null, 2)}
    };
    const viewer = pannellum.viewer("panorama", config);

    ${settings.showProgress ? `
    viewer.on("load", () => {
      const p = document.getElementById("progress");
      if (p) { p.style.width = "100%"; setTimeout(() => p.style.opacity = "0", 600); }
    });` : ''}

    ${settings.showCarousel ? `
    const carousel = document.getElementById("carousel");
    const scenes = ${JSON.stringify(this.project.scenes.map(s => ({ id: s.id, name: s.name })))};
    scenes.forEach(scene => {
      const img = document.createElement("img");
      img.src = "panoramas/" + scene.id + ".jpg";
      img.className = "carousel-item";
      img.title = scene.name;
      img.onclick = () => viewer.loadScene(scene.id);
      carousel.appendChild(img);
    });
    viewer.on("scenechange", (sceneId) => {
      document.querySelectorAll(".carousel-item").forEach((el, i) => {
        el.classList.toggle("active", scenes[i].id === sceneId);
      });
    });` : ''}

    ${settings.audioUrl ? `
    const audio = document.getElementById("bgAudio");
    if (audio) { audio.muted = false; document.body.addEventListener("click", () => audio.play(), { once: true }); }` : ''}
  </script>
</body>
</html>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.builder = new PanoramaBuilder();
});