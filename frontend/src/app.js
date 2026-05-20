const providers = [
  {
    id: "opensource",
    name: "OPEN SOURCE VTON",
    description: "Free Hugging Face / Gradio open-source try-on"
  },
  {
    id: "fashn",
    name: "FASHN",
    description: "Primary try-on model"
  },
  {
    id: "replicate",
    name: "IDM-VTON",
    description: "Benchmark model"
  },
  {
    id: "openai",
    name: "OPENAI BEAUTY",
    description: "Beauty and editorial pass"
  }
];

const state = {
  persons: [],
  activePersonId: "",
  items: [],
  activeItemId: "",
  replacingItemId: "",
  selectedProviders: new Set(["opensource"]),
  results: [],
  isGenerating: false,
  remoteEnabled: true,
  consentAccepted: true,
  config: {
    keys: {
      opensource: false,
      fashn: false,
      replicate: false,
      openai: false
    }
  }
};

const elements = {
  studioInput: document.querySelector("#studioInput"),
  studioDropzone: document.querySelector("#studioDropzone"),
  studioMeta: document.querySelector("#studioMeta"),
  studioError: document.querySelector("#studioError"),
  personInput: document.querySelector("#personInput"),
  garmentInput: document.querySelector("#garmentInput"),
  personPreview: document.querySelector("#personPreview"),
  garmentPreview: document.querySelector("#garmentPreview"),
  personMeta: document.querySelector("#personMeta"),
  garmentMeta: document.querySelector("#garmentMeta"),
  personDropzone: document.querySelector("#personDropzone"),
  garmentDropzone: document.querySelector("#garmentDropzone"),
  personError: document.querySelector("#personError"),
  garmentError: document.querySelector("#garmentError"),
  providerGroup: document.querySelector("#providerGroup"),
  navStatus: document.querySelector("#navStatus"),
  privacyNote: document.querySelector("#privacyNote"),
  remoteToggle: document.querySelector("#remoteToggle"),
  remoteCopy: document.querySelector("#remoteCopy"),
  consentCheckbox: document.querySelector("#consentCheckbox"),
  keyStatus: document.querySelector("#keyStatus"),
  autoTitle: document.querySelector("#autoTitle"),
  autoSummary: document.querySelector("#autoSummary"),
  itemTypeSelect: document.querySelector("#itemTypeSelect"),
  itemShelf: document.querySelector("#itemShelf"),
  personStrip: document.querySelector("#personStrip"),
  moodBoard: document.querySelector("#moodBoard"),
  normalizeToggle: document.querySelector("#normalizeToggle"),
  qualityPanel: document.querySelector("#qualityPanel"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  settingsCloseButton: document.querySelector("#settingsCloseButton"),
  settingsDoneButton: document.querySelector("#settingsDoneButton"),
  formError: document.querySelector("#formError"),
  generateButton: document.querySelector("#generateButton"),
  resetButton: document.querySelector("#resetButton"),
  saveButton: document.querySelector("#saveButton"),
  clearSavedButton: document.querySelector("#clearSavedButton"),
  caseSection: document.querySelector("#caseSection"),
  resultsSection: document.querySelector("#resultsSection"),
  resultGrid: document.querySelector("#resultGrid"),
  savedSection: document.querySelector(".saved-section"),
  savedList: document.querySelector("#savedList"),
  toast: document.querySelector("#toast")
};

async function init() {
  await loadConfig();
  elements.remoteToggle.checked = state.remoteEnabled;
  elements.consentCheckbox.checked = state.consentAccepted;
  renderProviders();
  bindUpload(elements.studioInput, "auto");
  bindUpload(elements.personInput, "person");
  bindUpload(elements.garmentInput, "garment");
  bindDropzone(elements.studioDropzone, "auto");
  bindDropzone(elements.personDropzone, "person");
  bindDropzone(elements.garmentDropzone, "garment");
  bindRemoteControls();
  bindSettingsModal();
  bindBoardUploadPrompts();
  elements.generateButton.addEventListener("click", generateResults);
  elements.resetButton.addEventListener("click", resetRun);
  elements.saveButton.addEventListener("click", saveRun);
  elements.clearSavedButton.addEventListener("click", clearSavedRuns);
  elements.itemTypeSelect.addEventListener("change", () => {
    updateActiveItemFromControls();
    renderAutoSummary();
  });
  document.querySelectorAll("input[name='mode'], input[name='garmentSource']").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.name === "garmentSource") {
        updateActiveItemFromControls();
      }
      renderAutoSummary();
    });
  });
  renderRemoteState();
  renderPersonStrip();
  renderItemShelf();
  renderMoodBoard();
  renderAutoSummary();
  renderSavedRuns();
}

function bindBoardUploadPrompts() {
  elements.moodBoard.addEventListener("click", (event) => {
    const studioPrompt = event.target.closest("[data-upload-studio]");
    const personPrompt = event.target.closest("[data-upload-person]");
    const itemPrompt = event.target.closest("[data-upload-item]");
    if (studioPrompt) {
      elements.studioInput.click();
    } else if (personPrompt) {
      elements.personInput.click();
    } else if (itemPrompt) {
      elements.garmentInput.click();
    }
  });

  elements.moodBoard.addEventListener("dragenter", handleBoardDrag);
  elements.moodBoard.addEventListener("dragover", handleBoardDrag);
  elements.moodBoard.addEventListener("dragleave", () => {
    elements.moodBoard.classList.remove("dragging");
  });
  elements.moodBoard.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.moodBoard.classList.remove("dragging");
    setAutoImages(Array.from(event.dataTransfer.files || []));
  });
  document.querySelectorAll("[data-add-person]").forEach((button) => {
    button.addEventListener("click", () => elements.personInput.click());
  });
  document.querySelectorAll("[data-add-item]").forEach((button) => {
    button.addEventListener("click", () => elements.garmentInput.click());
  });
}

function handleBoardDrag(event) {
  event.preventDefault();
  elements.moodBoard.classList.add("dragging");
}

function bindSettingsModal() {
  elements.settingsButton.addEventListener("click", openSettings);
  elements.settingsCloseButton.addEventListener("click", closeSettings);
  elements.settingsDoneButton.addEventListener("click", closeSettings);
  elements.settingsPanel.addEventListener("click", (event) => {
    if (event.target === elements.settingsPanel) {
      closeSettings();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.settingsPanel.hidden) {
      closeSettings();
    }
  });
}

function openSettings() {
  renderRemoteState();
  elements.settingsPanel.hidden = false;
  document.body.classList.add("modal-open");
  elements.settingsCloseButton.focus();
}

function closeSettings() {
  elements.settingsPanel.hidden = true;
  document.body.classList.remove("modal-open");
  elements.settingsButton.focus();
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) {
      throw new Error("Config unavailable");
    }
    state.config = await response.json();
  } catch {
    state.config = {
      keys: {
        opensource: true,
        fashn: false,
        replicate: false,
        openai: false
      }
    };
  }
}

function bindRemoteControls() {
  elements.remoteToggle.addEventListener("change", () => {
    state.remoteEnabled = elements.remoteToggle.checked;
    if (!state.remoteEnabled) {
      state.consentAccepted = false;
      elements.consentCheckbox.checked = false;
    }
    renderRemoteState();
    renderProviders();
  });

  elements.consentCheckbox.addEventListener("change", () => {
    state.consentAccepted = elements.consentCheckbox.checked;
    renderRemoteState();
  });
}

function renderProviders() {
  const available = getAvailableProviders();
  state.selectedProviders = new Set(chooseDefaultProviders(available).map((provider) => provider.id));
  elements.providerGroup.innerHTML = available
    .map(
      (provider) => `
        <label title="${provider.description}">
          <input type="checkbox" value="${provider.id}" ${state.selectedProviders.has(provider.id) ? "checked" : ""} />
          ${provider.name}
        </label>
      `
    )
    .join("");

  elements.providerGroup.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.selectedProviders.add(input.value);
      } else {
        state.selectedProviders.delete(input.value);
      }
      renderRemoteState();
    });
  });
}

function renderRemoteState() {
  elements.remoteToggle.checked = state.remoteEnabled;
  elements.consentCheckbox.checked = state.consentAccepted;
  if (elements.navStatus) {
    elements.navStatus.textContent = state.remoteEnabled ? "REMOTE TEST" : "LOCAL MODE";
  }
  elements.privacyNote.textContent = state.remoteEnabled
    ? "Remote test mode is on. Selected images will be uploaded only after consent and Generate real try-on."
    : "Local mode is active. Images stay in this browser; real try-on is disabled until remote consent is enabled.";
  elements.remoteCopy.textContent = state.remoteEnabled
    ? "On: selected non-private images can be uploaded to enabled providers."
    : "Off: local mock only. No uploads.";
  elements.consentCheckbox.disabled = !state.remoteEnabled;
  const selected = providers.filter((provider) => state.selectedProviders.has(provider.id));
  elements.keyStatus.innerHTML = [
    ...selected.map((provider) => {
      const ready = Boolean(state.config.keys?.[provider.id]);
      return `<span class="${ready ? "key-ready" : "key-missing"}">${provider.name}: ${ready ? "ready" : "local mock only"}</span>`;
    })
  ].join("");
}

function getAvailableProviders() {
  return providers.filter((provider) => provider.id === "opensource" || state.config.keys?.[provider.id]);
}

function chooseDefaultProviders(available) {
  const activeItem = getActiveItem();
  if (state.remoteEnabled && ["shoes", "bag", "hat"].includes(activeItem?.itemType) && state.config.keys?.openai) {
    return available.filter((provider) => provider.id === "openai");
  }
  const openSource = available.find((provider) => provider.id === "opensource");
  return openSource ? [openSource] : available.slice(0, 1);
}

function bindUpload(input, type) {
  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    if (type === "auto") {
      setAutoImages(files);
    } else if (type === "garment") {
      if (state.replacingItemId && files[0]) {
        replaceItemImage(state.replacingItemId, files[0]);
      } else {
        setItemImages(files);
      }
    } else {
      setPersonImages(files);
    }
    state.replacingItemId = "";
    input.value = "";
  });
}

function bindDropzone(dropzone, type) {
  if (!dropzone) {
    return;
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    const files = Array.from(event.dataTransfer.files || []);
    if (type === "auto") {
      setAutoImages(files);
    } else if (type === "garment") {
      setItemImages(files);
    } else {
      setPersonImages(files);
    }
  });
}

async function setAutoImages(files) {
  elements.studioError.textContent = "";
  for (const file of files) {
    await setImage("auto", file);
  }
}

async function setPersonImages(files) {
  for (const file of files) {
    await setImage("person", file);
  }
}

async function setItemImages(files) {
  for (const file of files) {
    await setImage("garment", file);
  }
}

async function replaceItemImage(itemId, file) {
  const originalIndex = state.items.findIndex((item) => item.id === itemId);
  if (originalIndex === -1) {
    return;
  }

  const previousActiveId = state.activeItemId;
  await setImage("garment", file);
  const replacement = state.items.pop();
  if (!replacement) {
    return;
  }

  replacement.id = itemId;
  state.items[originalIndex] = replacement;
  state.activeItemId = previousActiveId === itemId ? itemId : previousActiveId;
  if (state.activeItemId === itemId) {
    syncControlsFromItem(replacement);
  }
  renderItemShelf();
  renderMoodBoard();
  renderAutoSummary();
}

function setImage(type, file) {
  const errorElement = type === "person"
    ? elements.personError
    : type === "garment"
      ? elements.garmentError
      : elements.studioError;

  errorElement.textContent = "";

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    errorElement.textContent = "Use jpg, png, or webp.";
    return Promise.resolve();
  }

  if (file.size > 18 * 1024 * 1024) {
    errorElement.textContent = "Image must be under 18MB.";
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = await prepareImageDataUrl(reader.result);
        const analysis = await analyzeImage(dataUrl);
        const image = {
          name: file.name,
          size: file.size,
          dataUrl,
          analysis
        };

        const resolvedType = type === "auto" ? inferUploadRole(image) : type;

        if (resolvedType === "garment") {
          const item = createItemFromImage(image);
          state.items.push(item);
          selectFitModeForNewItem();
          setActiveItem(item.id);
        } else {
          const person = createPersonFromImage(image);
          state.persons.push(person);
          setActivePerson(person.id);
        }

        elements.formError.textContent = "";
        renderQualityPanel();
        renderAutoSummary();
      } catch {
        errorElement.textContent = "Could not read this image.";
      }
      resolve();
    };
    reader.onerror = () => {
      errorElement.textContent = "Could not read this image.";
      resolve();
    };
    reader.readAsDataURL(file);
  });
}

function renderUploadMeta(type, image) {
  const meta = type === "person" ? elements.personMeta : elements.garmentMeta;
  if (type === "person") {
    if (meta) {
      meta.textContent = state.persons.length > 1 ? `${state.persons.length} people uploaded` : "Person ready";
    }
    elements.studioMeta.textContent = sessionMetaText();
    return;
  }

  if (meta) {
    meta.textContent = state.items.length > 1 ? `${state.items.length} items uploaded` : "1 item uploaded";
  }
  elements.studioMeta.textContent = sessionMetaText();
}

function sessionMetaText() {
  const people = state.persons.length;
  const items = state.items.length;
  if (!people && !items) {
    return "Person + outfit pieces";
  }
  return `${people} ${people === 1 ? "person" : "people"} · ${items} ${items === 1 ? "item" : "items"}`;
}

function createPersonFromImage(image) {
  return {
    ...image,
    id: crypto.randomUUID(),
    label: inferPersonLabel(image)
  };
}

function createItemFromImage(image) {
  const itemType = inferItemType(image);
  const color = inferDominantColor(image.analysis);
  const detail = inferItemDetail(image.name, itemType);
  return {
    ...image,
    id: crypto.randomUUID(),
    itemType,
    color,
    detail,
    source: inferGarmentSource(image.name),
    aiLabel: buildItemLabel(color, detail, itemType)
  };
}

function inferUploadRole(image) {
  const name = image.name.toLowerCase();
  const personWords = ["person", "people", "body", "fullbody", "full-body", "self", "me", "model", "人像", "本人", "全身", "身体", "模特"];
  const itemWords = ["shirt", "tee", "pants", "jeans", "skirt", "dress", "shoe", "bag", "hat", "coat", "jacket", "上衣", "裤", "裙", "鞋", "包", "帽", "外套", "商品"];
  if (itemWords.some((word) => name.includes(word))) {
    return "garment";
  }
  if (personWords.some((word) => name.includes(word))) {
    return "person";
  }

  const ratio = image.analysis.height / image.analysis.width;
  const likelyPerson = ratio >= 1.35 && image.analysis.width > 420 && image.analysis.height > 760;
  return likelyPerson && state.persons.length === 0 ? "person" : "garment";
}

function getActivePerson() {
  return state.persons.find((person) => person.id === state.activePersonId) || null;
}

function setActivePerson(personId) {
  const person = state.persons.find((candidate) => candidate.id === personId);
  if (!person) {
    return;
  }

  state.activePersonId = person.id;
  elements.personPreview.src = person.dataUrl;
  elements.personPreview.hidden = false;
  elements.personDropzone?.classList.add("has-image");
  renderUploadMeta("person", person);
  renderPersonStrip();
  renderMoodBoard();
}

function renderPersonStrip() {
  if (state.persons.length === 0) {
    elements.personStrip.innerHTML = `<p class="empty-shelf">No people yet</p>`;
    if (elements.personMeta) {
      elements.personMeta.textContent = "No person yet";
    }
    elements.studioMeta.textContent = sessionMetaText();
    return;
  }

  elements.personStrip.innerHTML = state.persons
    .map((person, index) => `
      <article class="person-card ${person.id === state.activePersonId ? "active" : ""}">
        <button class="person-card-main" data-person-id="${person.id}" type="button">
          <img src="${person.dataUrl}" alt="" />
          <span>${person.id === state.activePersonId ? "Main person" : person.label || `Person ${index + 1}`}</span>
        </button>
        <button class="person-remove-button" data-person-remove="${person.id}" type="button" aria-label="Remove ${person.label || `Person ${index + 1}`}">×</button>
      </article>
    `)
    .join("");

  elements.personStrip.querySelectorAll("[data-person-id]").forEach((button) => {
    button.addEventListener("click", () => {
      setActivePerson(button.dataset.personId);
      renderQualityPanel();
      renderAutoSummary();
    });
  });
  elements.personStrip.querySelectorAll("[data-person-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      removePerson(button.dataset.personRemove);
    });
  });

  const active = getActivePerson();
  if (active) {
    renderUploadMeta("person", active);
  }
}

function removePerson(personId) {
  const index = state.persons.findIndex((person) => person.id === personId);
  if (index === -1) {
    return;
  }

  state.persons.splice(index, 1);
  if (state.activePersonId === personId) {
    state.activePersonId = state.persons[Math.max(0, index - 1)]?.id || state.persons[0]?.id || "";
    const activePerson = getActivePerson();
    if (activePerson) {
      elements.personPreview.src = activePerson.dataUrl;
      elements.personPreview.hidden = false;
    } else {
      elements.personPreview.hidden = true;
      elements.personPreview.removeAttribute("src");
      elements.personDropzone?.classList.remove("has-image");
    }
  }

  renderPersonStrip();
  renderMoodBoard();
  renderQualityPanel();
  renderAutoSummary();
}

function getActiveItem() {
  return state.items.find((item) => item.id === state.activeItemId) || null;
}

function setActiveItem(itemId) {
  const item = state.items.find((candidate) => candidate.id === itemId);
  if (!item) {
    return;
  }

  state.activeItemId = item.id;
  elements.garmentPreview.src = item.dataUrl;
  elements.garmentPreview.hidden = false;
  elements.garmentDropzone?.classList.add("has-image");
  renderUploadMeta("garment", item);
  syncControlsFromItem(item);
  renderProviders();
  renderItemShelf();
  renderMoodBoard();
}

function syncControlsFromItem(item) {
  elements.itemTypeSelect.value = item.itemType;
  const sourceInput = document.querySelector(`input[name='garmentSource'][value='${item.source}']`);
  if (sourceInput) {
    sourceInput.checked = true;
  }
}

function updateActiveItemFromControls() {
  const item = getActiveItem();
  if (!item) {
    return;
  }
  item.itemType = elements.itemTypeSelect.value;
  item.source = getGarmentSource();
  item.aiLabel = buildItemLabel(item.color, item.detail, item.itemType);
  renderItemShelf();
  renderMoodBoard();
}

function renderItemShelf() {
  if (state.items.length === 0) {
    elements.itemShelf.innerHTML = `<p class="empty-shelf">No items yet</p>`;
    if (elements.garmentMeta) {
      elements.garmentMeta.textContent = "No items yet";
    }
    elements.studioMeta.textContent = sessionMetaText();
    return;
  }

  elements.itemShelf.innerHTML = state.items
    .map((item, index) => `
      <article class="item-card ${item.id === state.activeItemId ? "active" : ""}" data-item-id="${item.id}">
        <button class="item-card-main" data-item-select="${item.id}" type="button">
          <span class="item-card-index">${String(index + 1).padStart(2, "0")}</span>
          <img src="${item.dataUrl}" alt="" />
          <span class="item-card-copy">
            <strong>${item.aiLabel}</strong>
            <small>${labelForItem(item.itemType)} · ${item.source === "model" ? "On model" : "Flat-lay"}</small>
            <em>${item.name}</em>
          </span>
        </button>
        <div class="item-actions">
          <button data-item-edit="${item.id}" type="button">${item.itemType === "unknown" ? "Set type" : "Type"}</button>
          <button data-item-replace="${item.id}" type="button">Replace</button>
          <button class="item-remove-button" data-item-remove="${item.id}" type="button" aria-label="Remove ${item.aiLabel}">×</button>
        </div>
      </article>
    `)
    .join("");

  elements.itemShelf.querySelectorAll("[data-item-select]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveItem(button.dataset.itemSelect);
      renderQualityPanel();
      renderAutoSummary();
    });
  });
  elements.itemShelf.querySelectorAll("[data-item-replace]").forEach((button) => {
    button.addEventListener("click", () => {
      state.replacingItemId = button.dataset.itemReplace;
      elements.garmentInput.click();
    });
  });
  elements.itemShelf.querySelectorAll("[data-item-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveItem(button.dataset.itemEdit);
      openSettings();
    });
  });
  elements.itemShelf.querySelectorAll("[data-item-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      removeItem(button.dataset.itemRemove);
    });
  });

  const active = getActiveItem();
  if (active) {
    renderUploadMeta("garment", active);
  }
}

function removeItem(itemId) {
  const index = state.items.findIndex((item) => item.id === itemId);
  if (index === -1) {
    return;
  }

  state.items.splice(index, 1);
  if (state.activeItemId === itemId) {
    state.activeItemId = state.items[Math.max(0, index - 1)]?.id || state.items[0]?.id || "";
    if (state.activeItemId) {
      syncControlsFromItem(getActiveItem());
    }
  }

  if (state.items.length === 0) {
    elements.garmentPreview.hidden = true;
    elements.garmentPreview.removeAttribute("src");
    elements.garmentDropzone?.classList.remove("has-image");
  } else if (state.activeItemId) {
    const activeItem = getActiveItem();
    elements.garmentPreview.src = activeItem.dataUrl;
    elements.garmentPreview.hidden = false;
    renderUploadMeta("garment", activeItem);
  }

  renderItemShelf();
  renderMoodBoard();
  renderQualityPanel();
  renderAutoSummary();
}

function renderMoodBoard() {
  const activePerson = getActivePerson();
  const hasOutfitContext = Boolean(activePerson);
  elements.moodBoard.classList.toggle("is-empty", !hasOutfitContext);
  elements.moodBoard.classList.toggle("has-images", hasOutfitContext);
  applyBoardPalette(activePerson, getActiveItem());
  if (!activePerson) {
    elements.moodBoard.innerHTML = `
      <button class="empty-board-image-button" data-upload-studio type="button" aria-label="Upload person and outfit pieces">
        <img class="empty-board-image" src="./assets/empty-board-reference.jpg" alt="Drop a person and outfit pieces" fetchpriority="high" decoding="async" />
      </button>
    `;
    return;
  }

  const personMarkup = activePerson
    ? `
      <button class="paper-person" data-person-id="${activePerson.id}" type="button">
        <span class="paper-cutout"></span>
        <img src="${activePerson.dataUrl}" alt="" />
        <span>${activePerson.label}</span>
      </button>
    `
    : `<div class="paper-person placeholder">Add person</div>`;

  const itemMarkup = state.items
    .map((item, index) => `
      <button class="paper-item paper-item-${(index % 5) + 1} ${item.id === state.activeItemId ? "active" : ""}" data-item-id="${item.id}" type="button">
        <span class="item-number">${String(index + 1).padStart(2, "0")}</span>
        <img src="${item.dataUrl}" alt="" />
        <span class="pin-dot"></span>
        <span class="paper-label">${item.aiLabel}</span>
      </button>
    `)
    .join("");

  elements.moodBoard.innerHTML = `
    <div class="board-masthead">
      <strong>${activePerson ? "Selected person" : "Upload a person"}</strong>
    </div>
    ${personMarkup}
    <div class="paper-item-layer">${itemMarkup}</div>
  `;

  elements.moodBoard.querySelectorAll("[data-item-id]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveItem(button.dataset.itemId);
      renderQualityPanel();
      renderAutoSummary();
    });
  });

  elements.moodBoard.querySelectorAll("[data-person-id]").forEach((button) => {
    button.addEventListener("click", () => {
      setActivePerson(button.dataset.personId);
      renderQualityPanel();
      renderAutoSummary();
    });
  });
}

function applyBoardPalette(person, item) {
  const base = person?.analysis || item?.analysis;
  if (!base) {
    elements.moodBoard.style.removeProperty("--board-bg");
    elements.moodBoard.style.removeProperty("--board-line");
    return;
  }

  const lightness = Math.max(88, Math.min(98, Math.round(100 - Math.abs(base.brightness - 148) / 8)));
  const warmth = Math.max(-4, Math.min(4, Math.round(base.temperature / 20)));
  const hue = warmth >= 0 ? 42 : 210;
  elements.moodBoard.style.setProperty("--board-bg", `hsl(${hue} 8% ${lightness}%)`);
  elements.moodBoard.style.setProperty("--board-line", `hsl(${hue} 5% ${Math.max(76, lightness - 13)}%)`);
}

function selectFitModeForNewItem() {
  const modeInput = document.querySelector(`input[name='mode'][value='fit']`);
  if (modeInput) {
    modeInput.checked = true;
  }
}

function inferItemType(image) {
  const name = image.name.toLowerCase();
  const rules = [
    ["dress", ["dress", "gown", "连衣裙", "裙"]],
    ["pants", ["pants", "trouser", "jeans", "牛仔", "裤"]],
    ["skirt", ["skirt", "半裙"]],
    ["outerwear", ["coat", "jacket", "blazer", "outer", "外套", "大衣", "西装"]],
    ["shoes", ["shoe", "sneaker", "boot", "heel", "鞋", "靴"]],
    ["bag", ["bag", "purse", "tote", "包"]],
    ["hat", ["hat", "cap", "帽"]],
    ["top", ["shirt", "tee", "tshirt", "sweater", "top", "blouse", "上衣", "衬衫", "毛衣"]]
  ];

  const fileNameMatch = rules.find(([, words]) => words.some((word) => name.includes(word)))?.[0];
  if (fileNameMatch) {
    return fileNameMatch;
  }

  const ratio = image.analysis.width / image.analysis.height;
  if (ratio >= 1.7) {
    return "shoes";
  }
  if (ratio <= 0.62) {
    return "pants";
  }

  return "unknown";
}

function inferGarmentSource(fileName) {
  const name = fileName.toLowerCase();
  return ["flat", "lay", "product", "hanger", "平铺", "商品图"].some((word) => name.includes(word)) ? "flat-lay" : "model";
}

function inferPersonLabel(image) {
  const portrait = image.analysis.height >= image.analysis.width * 1.18;
  const clear = image.analysis.clarity > 7 ? "clear" : "soft";
  return `${portrait ? "Full body" : "Person"} · ${clear}`;
}

function inferDominantColor(analysis) {
  const brightness = analysis.brightness;
  const temperature = analysis.temperature;
  if (brightness < 62) {
    return "black";
  }
  if (brightness > 205) {
    return "white";
  }
  if (temperature > 18) {
    return brightness > 138 ? "warm beige" : "brown";
  }
  if (temperature < -18) {
    return brightness > 132 ? "pale blue" : "blue";
  }
  if (brightness < 112) {
    return "charcoal";
  }
  return "neutral";
}

function inferItemDetail(fileName, itemType) {
  const name = fileName.toLowerCase();
  const detailRules = [
    ["short", ["short", "cropped", "mini", "短"]],
    ["long", ["long", "maxi", "长"]],
    ["oversized", ["oversize", "oversized", "loose", "宽松"]],
    ["structured", ["blazer", "tailored", "西装"]],
    ["knit", ["knit", "sweater", "毛衣", "针织"]],
    ["denim", ["denim", "jeans", "牛仔"]],
    ["leather", ["leather", "皮"]]
  ];
  const detected = detailRules.find(([, words]) => words.some((word) => name.includes(word)))?.[0];
  if (detected) {
    return detected;
  }
  if (itemType === "unknown") {
    return "check";
  }
  if (["bag", "shoes", "hat"].includes(itemType)) {
    return "statement";
  }
  return "clean";
}

function buildItemLabel(color, detail, itemType) {
  if (itemType === "unknown") {
    return "check item type";
  }
  return `${color} ${detail} ${labelForItem(itemType).toLowerCase()}`;
}

function renderAutoSummary() {
  const activePerson = getActivePerson();
  const activeItem = getActiveItem();
  const hasBoth = Boolean(activePerson && activeItem);
  elements.settingsButton.hidden = !activeItem;
  elements.generateButton.hidden = !hasBoth;
  elements.itemShelf.hidden = state.items.length === 0;
  elements.autoTitle.hidden = false;
  elements.autoSummary.hidden = false;
  elements.caseSection.hidden = true;

  if (activePerson && activeItem?.itemType === "unknown") {
    elements.autoTitle.textContent = "CHECK ITEM TYPE";
    elements.autoSummary.innerHTML = `
      <p>Choose whether this piece is a top, pants, skirt, shoes, bag, or hat before generating.</p>
    `;
    return;
  }

  if (!activePerson && state.items.length > 0) {
    elements.autoTitle.textContent = "UPLOAD A PERSON";
    elements.autoSummary.innerHTML = `
      <p>${state.items.length} ${state.items.length === 1 ? "item is" : "items are"} ready. Add a full-body person photo to continue.</p>
    `;
    return;
  }

  if (activePerson && !activeItem) {
    elements.autoTitle.textContent = "ADD OUTFIT PIECES";
    elements.autoSummary.innerHTML = `
      <p>Person is ready. Upload clothing, shoes, bags, hats, or other pieces.</p>
    `;
    return;
  }

  if (!activePerson && !activeItem) {
    elements.autoTitle.textContent = "START WITH PHOTOS";
    elements.autoSummary.innerHTML = `
      <div class="empty-sidebar-icon" aria-hidden="true">
        <svg viewBox="0 0 48 48"><path d="M11 22h26l-5 16H16Z"></path><path d="M16 22l4-8h12l5 8"></path><path d="M18 29h12"></path></svg>
      </div>
      <p>Upload a full-body person photo and outfit pieces. They will appear here.</p>
    `;
    return;
  }

  const warnings = buildQualityChecks().filter((check) => check.status !== "Good").map((check) => check.label);
  elements.autoTitle.textContent = activeItem.aiLabel;
  elements.autoSummary.innerHTML = `
    <p>${warnings.length ? `${warnings.slice(0, 2).join(" / ")}.` : "Ready to generate with the selected cutout."}</p>
  `;
}

function labelForItem(value) {
  return {
    unknown: "Item",
    top: "Top",
    outerwear: "Outerwear",
    dress: "Dress",
    skirt: "Skirt",
    pants: "Pants",
    shoes: "Shoes",
    bag: "Bag",
    hat: "Hat"
  }[value] || "Item";
}

async function prepareImageDataUrl(dataUrl) {
  const image = await loadImage(dataUrl);
  const maxSide = 1536;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  if (scale === 1 && dataUrl.length < 5 * 1024 * 1024) {
    return dataUrl;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

async function analyzeImage(dataUrl) {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  const maxSide = 256;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let luminanceSum = 0;
  let warmCoolSum = 0;
  let edgeSum = 0;
  let previousLum = 0;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const lum = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    luminanceSum += lum;
    warmCoolSum += red - blue;
    edgeSum += Math.abs(lum - previousLum);
    previousLum = lum;
  }

  const pixels = data.length / 4;
  return {
    width: image.width,
    height: image.height,
    brightness: luminanceSum / pixels,
    temperature: warmCoolSum / pixels,
    clarity: edgeSum / pixels
  };
}

function renderQualityPanel() {
  if (!getActivePerson() || !getActiveItem()) {
    elements.qualityPanel.innerHTML = `<p>Upload a person and an item to check image clarity.</p>`;
    return;
  }

  const checks = buildQualityChecks();
  elements.qualityPanel.innerHTML = checks
    .map((check) => `
      <div class="quality-row">
        <span>${check.label}</span>
        <strong class="${check.status === "Good" ? "quality-good" : "quality-warn"}">${check.status}</strong>
      </div>
      ${check.note ? `<p>${check.note}</p>` : ""}
    `)
    .join("");
}

function buildQualityChecks() {
  const person = getActivePerson().analysis;
  const garment = getActiveItem().analysis;
  const brightnessGap = Math.abs(person.brightness - garment.brightness);
  const temperatureGap = Math.abs(person.temperature - garment.temperature);
  const personLongEnough = Math.max(person.width, person.height) >= 900;
  const garmentLongEnough = Math.max(garment.width, garment.height) >= 700;

  return [
    {
      label: "Person resolution",
      status: personLongEnough ? "Good" : "Weak",
      note: personLongEnough ? "" : "Use a larger full-body photo for better body proportions."
    },
    {
      label: "Garment resolution",
      status: garmentLongEnough ? "Good" : "Weak",
      note: garmentLongEnough ? "" : "Use a sharper product image for better texture."
    },
    {
      label: "Lighting match",
      status: brightnessGap < 55 && temperatureGap < 32 ? "Good" : "Weak",
      note: brightnessGap < 55 && temperatureGap < 32 ? "" : "Lighting differs strongly; the result may look pasted."
    },
    {
      label: "Garment clarity",
      status: garment.clarity > 7 ? "Good" : "Weak",
      note: garment.clarity > 7 ? "" : "Flat, blurry, or low-contrast garment images reduce realism."
    }
  ];
}

async function normalizeForGeneration(image, role) {
  if (!elements.normalizeToggle.checked || !image?.analysis) {
    return image.dataUrl;
  }

  const source = await loadImage(image.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  const targetBrightness = role === "garment" && getActivePerson()?.analysis ? getActivePerson().analysis.brightness : 145;
  const delta = Math.max(-24, Math.min(24, targetBrightness - image.analysis.brightness));
  ctx.filter = `brightness(${Math.max(0.82, Math.min(1.18, 1 + delta / 180))}) contrast(1.03)`;
  ctx.drawImage(source, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function getMode() {
  return document.querySelector("input[name='mode']:checked").value;
}

function getGarmentSource() {
  return document.querySelector("input[name='garmentSource']:checked").value;
}

function getItemType() {
  return getActiveItem()?.itemType || elements.itemTypeSelect.value;
}

async function generateResults() {
  elements.formError.textContent = "";
  const activePerson = getActivePerson();
  const activeItem = getActiveItem();
  state.selectedProviders = new Set(chooseDefaultProviders(getAvailableProviders()).map((provider) => provider.id));

  if (!activePerson || !activeItem) {
    elements.formError.textContent = "Add a person image and at least one item image first.";
    return;
  }

  if (activeItem.itemType === "unknown") {
    elements.formError.textContent = "Choose the item type in Correction before generating.";
    openSettings();
    return;
  }

  if (state.selectedProviders.size === 0) {
    elements.formError.textContent = "Select at least one model.";
    return;
  }

  if (!state.remoteEnabled) {
    elements.formError.textContent = "True try-on needs a remote model. Open Remote & correction, turn on Remote Test, then confirm consent.";
    openSettings();
    return;
  }

  if (!state.consentAccepted) {
    elements.formError.textContent = "Confirm that you are using non-private test images before uploading to the model.";
    openSettings();
    return;
  }

  state.isGenerating = true;
  state.results = providers
    .filter((provider) => state.selectedProviders.has(provider.id))
    .map((provider) => ({
      provider,
      status: "loading",
      imageUrl: null,
      error: "",
      ratings: {
        identity: 0,
        garment: 0,
        beauty: 0
      },
      item: {
        name: activeItem.name,
        itemType: activeItem.itemType,
        source: activeItem.source,
        aiLabel: activeItem.aiLabel
      },
      note: ""
    }));

  renderResults();
  elements.generateButton.disabled = true;
  elements.generateButton.textContent = "Rendering";
  elements.saveButton.disabled = true;

  await Promise.all(state.results.map((result) => runProvider(result)));

  state.isGenerating = false;
  elements.generateButton.disabled = false;
  elements.generateButton.textContent = "Generate real try-on";
  elements.saveButton.disabled = !state.results.some((result) => result.status === "success");
  renderResults();
}

async function runProvider(result) {
  renderResults();
  try {
    const imageUrl = await remoteTryOn(result.provider.id);
    result.status = "success";
    result.imageUrl = imageUrl;
  } catch (error) {
    result.status = "error";
    result.error = error.message || "Generation failed";
  }
  renderResults();
}

async function remoteTryOn(providerId) {
  const activePerson = getActivePerson();
  const activeItem = getActiveItem();
  if (!state.config.keys?.[providerId]) {
    throw new Error("API key missing");
  }

  const [personImage, garmentImage] = await Promise.all([
    normalizeForGeneration(activePerson, "person"),
    normalizeForGeneration(activeItem, "garment")
  ]);

  const response = await fetch("/api/tryon", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      providerId,
      mode: getMode(),
      itemType: activeItem.itemType,
      garmentSource: activeItem.source,
      autoNormalize: elements.normalizeToggle.checked,
      remoteEnabled: state.remoteEnabled,
      consentAccepted: state.consentAccepted,
      personImage,
      garmentImage
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Remote generation failed");
  }

  if (!data.imageUrl) {
    throw new Error("Remote provider returned no image");
  }

  return data.imageUrl;
}

function mockTryOn(providerId, mode) {
  const delay = {
    opensource: 1400,
    fashn: 1600,
    replicate: 2300,
    openai: 2900
  }[providerId];

  return new Promise((resolve, reject) => {
    window.setTimeout(async () => {
      try {
        resolve(await createMockResultImage(providerId, mode));
      } catch (error) {
        reject(error);
      }
    }, delay);
  });
}

async function createMockResultImage(providerId, mode) {
  const activePerson = getActivePerson();
  const activeItem = getActiveItem();
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  const palette = ["#f7f7f5", "#111111"];

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const [personImage, garmentImage] = await Promise.all([
    loadImage(activePerson.dataUrl),
    loadImage(activeItem.dataUrl)
  ]);

  drawImageCover(ctx, personImage, 130, 70, 640, 980, 1);
  drawTryOnOverlay(ctx, garmentImage, activeItem.itemType);

  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillRect(0, 1000, canvas.width, 200);
  ctx.fillStyle = palette[1];
  ctx.font = "700 38px system-ui";
  ctx.fillText("Generated try-on", 70, 1078);
  ctx.font = "400 24px system-ui";
  ctx.fillText(`${providerLabel(providerId)} · ${modeLabel(mode)} · ${activeItem.aiLabel}`, 70, 1132);

  return canvas.toDataURL("image/png");
}

function loadImage(src) {
  const image = new Image();
  image.onload = () => {};
  image.src = src;
  return image.decode().then(() => image);
}

function drawImageCover(ctx, image, x, y, width, height, opacity) {
  ctx.globalAlpha = opacity;
  ctx.drawImage(image, x, y, width, height);
  ctx.globalAlpha = 1;
}

function drawImageContain(ctx, image, x, y, width, height) {
  const ratio = Math.min(width / image.width || 1, height / image.height || 1);
  const drawWidth = (image.width || width) * ratio;
  const drawHeight = (image.height || height) * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 18;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(31,36,35,0.15)";
  ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
}

function drawTryOnOverlay(ctx, image, itemType) {
  const placement = {
    top: [270, 240, 360, 350],
    outerwear: [235, 205, 430, 500],
    dress: [255, 230, 390, 620],
    skirt: [285, 520, 330, 320],
    pants: [265, 520, 370, 470],
    shoes: [265, 880, 360, 150],
    bag: [520, 430, 190, 230],
    hat: [335, 70, 230, 150]
  }[itemType] || [270, 270, 360, 360];

  ctx.save();
  ctx.globalAlpha = 0.84;
  ctx.filter = "grayscale(1) contrast(1.04)";
  drawImageContain(ctx, image, placement[0], placement[1], placement[2], placement[3]);
  ctx.restore();
}

function providerLabel(providerId) {
  return providers.find((provider) => provider.id === providerId)?.name || providerId;
}

function modeLabel(mode) {
  return {
    fit: "Fit check mock",
    styled: "Styled look mock"
  }[mode];
}

function renderResults() {
  const hasResults = state.results.length > 0;
  elements.caseSection.hidden = true;
  elements.resultsSection.hidden = !hasResults;
  elements.resultGrid.hidden = !hasResults;

  if (!hasResults) {
    elements.resultGrid.innerHTML = "";
    return;
  }

  elements.resultGrid.innerHTML = state.results.map(renderResultCard).join("");
  bindRatingButtons();
  bindNotes();
  bindRetryButtons();
  bindResultImages();
}

function renderResultCard(result, index) {
  const imageContent =
    result.status === "loading"
      ? `<div class="result-image loading">Rendering...</div>`
      : result.status === "error"
        ? `<div class="result-image error">${result.error}<br /><button class="secondary-button retry-button" data-index="${index}" type="button">Retry</button></div>`
        : `<div class="result-image"><img src="${result.imageUrl}" alt="${result.provider.name} result" data-result-index="${index}" /></div>`;

  return `
    <article class="result-card">
      ${imageContent}
      <div class="result-body">
        <div class="result-title">
          <strong>${result.provider.name}</strong>
          <span class="status-chip">${statusLabel(result.status)}</span>
        </div>
        <div class="result-item-chip">${result.item.aiLabel || labelForItem(result.item.itemType)} · ${result.item.source === "model" ? "On model" : "Flat-lay"}</div>
        ${renderRatingRow(index, "identity", "Identity")}
        ${renderRatingRow(index, "garment", "Garment")}
        ${renderRatingRow(index, "beauty", "Beauty")}
        <textarea data-note-index="${index}" placeholder="Note: what feels true, false, or worth keeping">${result.note}</textarea>
      </div>
    </article>
  `;
}

function renderRatingRow(index, key, label) {
  const value = state.results[index].ratings[key];
  const stars = Array.from({ length: 5 }, (_, starIndex) => {
    const score = starIndex + 1;
    return `<button class="star ${score <= value ? "active" : ""}" data-rating-index="${index}" data-rating-key="${key}" data-rating-value="${score}" type="button">★</button>`;
  }).join("");

  return `
    <div class="rating-row">
      <span>${label}</span>
      <div class="stars">${stars}</div>
    </div>
  `;
}

function statusLabel(status) {
  return {
    loading: "Rendering",
    success: "Ready",
    error: "Failed"
  }[status];
}

function bindRatingButtons() {
  elements.resultGrid.querySelectorAll("[data-rating-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.ratingIndex);
      const key = button.dataset.ratingKey;
      state.results[index].ratings[key] = Number(button.dataset.ratingValue);
      renderResults();
    });
  });
}

function bindNotes() {
  elements.resultGrid.querySelectorAll("[data-note-index]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      state.results[Number(textarea.dataset.noteIndex)].note = textarea.value;
    });
  });
}

function bindRetryButtons() {
  elements.resultGrid.querySelectorAll(".retry-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.index);
      state.results[index].status = "loading";
      state.results[index].error = "";
      renderResults();
      await runProvider(state.results[index]);
      elements.saveButton.disabled = !state.results.some((result) => result.status === "success");
    });
  });
}

function bindResultImages() {
  elements.resultGrid.querySelectorAll("[data-result-index]").forEach((image) => {
    image.addEventListener("error", () => {
      const index = Number(image.dataset.resultIndex);
      state.results[index].status = "error";
      state.results[index].error = `Image failed to load: ${String(state.results[index].imageUrl || "").slice(0, 80)}`;
      renderResults();
    }, { once: true });
  });
}

function saveRun() {
  const savedRuns = getSavedRuns();
  const run = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    mode: getMode(),
    personName: getActivePerson()?.name,
    garmentName: getActiveItem()?.name,
    itemCount: state.items.length,
    activeItemType: getActiveItem()?.itemType,
    results: state.results
      .filter((result) => result.status === "success")
      .map((result) => ({
        provider: result.provider.name,
        ratings: result.ratings,
        note: result.note
      }))
  };

  localStorage.setItem("tryon.savedRuns", JSON.stringify([run, ...savedRuns].slice(0, 20)));
  renderSavedRuns();
  showToast("Saved locally");
}

function getSavedRuns() {
  try {
    return JSON.parse(localStorage.getItem("tryon.savedRuns") || "[]");
  } catch {
    return [];
  }
}

function renderSavedRuns() {
  const savedRuns = getSavedRuns();
  elements.savedSection.hidden = savedRuns.length === 0;
  if (savedRuns.length === 0) {
    elements.savedList.innerHTML = `<div class="saved-item">No saved studies</div>`;
    return;
  }

  elements.savedList.innerHTML = savedRuns
    .map((run) => {
      const average = averageScore(run.results);
      return `
        <div class="saved-item">
          <span>${new Date(run.date).toLocaleString()} · ${modeLabel(run.mode).replace(" mock", "")}</span>
          <strong>${average ? `${average}/5` : "Unrated"}</strong>
        </div>
      `;
    })
    .join("");
}

function averageScore(results) {
  const scores = results.flatMap((result) => Object.values(result.ratings)).filter(Boolean);
  if (scores.length === 0) {
    return "";
  }
  return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1);
}

function clearSavedRuns() {
  localStorage.removeItem("tryon.savedRuns");
  renderSavedRuns();
  showToast("Cleared");
}

function resetRun() {
  state.persons = [];
  state.activePersonId = "";
  state.items = [];
  state.activeItemId = "";
  state.results = [];
  elements.studioInput.value = "";
  elements.personInput.value = "";
  elements.garmentInput.value = "";
  elements.studioMeta.textContent = sessionMetaText();
  if (elements.personMeta) {
    elements.personMeta.textContent = "No people yet";
  }
  if (elements.garmentMeta) {
    elements.garmentMeta.textContent = "No items yet";
  }
  [elements.personPreview, elements.garmentPreview].forEach((preview) => {
    preview.hidden = true;
    preview.removeAttribute("src");
  });
  [elements.personDropzone, elements.garmentDropzone].forEach((dropzone) => dropzone?.classList.remove("has-image"));
  elements.formError.textContent = "";
  elements.saveButton.disabled = true;
  renderPersonStrip();
  renderItemShelf();
  renderMoodBoard();
  renderQualityPanel();
  renderAutoSummary();
  renderResults();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

init();
