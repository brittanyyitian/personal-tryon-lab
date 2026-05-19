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
  person: null,
  garment: null,
  selectedProviders: new Set(providers.map((provider) => provider.id)),
  results: [],
  isGenerating: false,
  remoteEnabled: false,
  consentAccepted: false,
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
  personInput: document.querySelector("#personInput"),
  garmentInput: document.querySelector("#garmentInput"),
  personPreview: document.querySelector("#personPreview"),
  garmentPreview: document.querySelector("#garmentPreview"),
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
  formError: document.querySelector("#formError"),
  generateButton: document.querySelector("#generateButton"),
  resetButton: document.querySelector("#resetButton"),
  saveButton: document.querySelector("#saveButton"),
  clearSavedButton: document.querySelector("#clearSavedButton"),
  caseSection: document.querySelector("#caseSection"),
  resultsSection: document.querySelector("#resultsSection"),
  resultGrid: document.querySelector("#resultGrid"),
  savedList: document.querySelector("#savedList"),
  toast: document.querySelector("#toast")
};

async function init() {
  await loadConfig();
  renderProviders();
  bindUpload(elements.personInput, "person");
  bindUpload(elements.garmentInput, "garment");
  bindDropzone(elements.personDropzone, "person");
  bindDropzone(elements.garmentDropzone, "garment");
  bindRemoteControls();
  elements.generateButton.addEventListener("click", generateResults);
  elements.resetButton.addEventListener("click", resetRun);
  elements.saveButton.addEventListener("click", saveRun);
  elements.clearSavedButton.addEventListener("click", clearSavedRuns);
  renderRemoteState();
  renderSavedRuns();
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
  });

  elements.consentCheckbox.addEventListener("change", () => {
    state.consentAccepted = elements.consentCheckbox.checked;
    renderRemoteState();
  });
}

function renderProviders() {
  elements.providerGroup.innerHTML = providers
    .map(
      (provider) => `
        <label title="${provider.description}">
          <input type="checkbox" value="${provider.id}" checked />
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
    });
  });
}

function renderRemoteState() {
  elements.navStatus.textContent = state.remoteEnabled ? "REMOTE TEST" : "LOCAL MODE";
  elements.privacyNote.textContent = state.remoteEnabled
    ? "Remote test mode is on. Selected images will be uploaded only after consent and Generate Study."
    : "Local mode is active. Images stay in this browser unless remote test mode is enabled.";
  elements.remoteCopy.textContent = state.remoteEnabled
    ? "On: selected non-private images can be uploaded to enabled providers."
    : "Off: local mock only. No uploads.";
  elements.consentCheckbox.disabled = !state.remoteEnabled;
  elements.keyStatus.innerHTML = providers
    .map((provider) => {
      const ready = Boolean(state.config.keys?.[provider.id]);
      return `<span class="${ready ? "key-ready" : "key-missing"}">${provider.name}: ${ready ? "configured" : "missing"}</span>`;
    })
    .join("");
}

function bindUpload(input, type) {
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) {
      setImage(type, file);
    }
  });
}

function bindDropzone(dropzone, type) {
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
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setImage(type, file);
    }
  });
}

function setImage(type, file) {
  const errorElement = type === "person" ? elements.personError : elements.garmentError;
  const previewElement = type === "person" ? elements.personPreview : elements.garmentPreview;
  const dropzoneElement = type === "person" ? elements.personDropzone : elements.garmentDropzone;

  errorElement.textContent = "";

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    errorElement.textContent = "Use jpg, png, or webp.";
    return;
  }

  if (file.size > 18 * 1024 * 1024) {
    errorElement.textContent = "Image must be under 18MB.";
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = await prepareImageDataUrl(reader.result);
    const image = {
      name: file.name,
      size: file.size,
      dataUrl
    };
    state[type] = image;
    previewElement.src = image.dataUrl;
    previewElement.hidden = false;
    dropzoneElement.classList.add("has-image");
    elements.formError.textContent = "";
  };
  reader.readAsDataURL(file);
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

function getMode() {
  return document.querySelector("input[name='mode']:checked").value;
}

async function generateResults() {
  elements.formError.textContent = "";

  if (!state.person || !state.garment) {
    elements.formError.textContent = "Add person and garment images first.";
    return;
  }

  if (state.selectedProviders.size === 0) {
    elements.formError.textContent = "Select at least one model.";
    return;
  }

  if (state.remoteEnabled && !state.consentAccepted) {
    elements.formError.textContent = "Confirm that you are using non-private test images.";
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
      note: ""
    }));

  renderResults();
  elements.generateButton.disabled = true;
  elements.generateButton.textContent = "Rendering";
  elements.saveButton.disabled = true;

  await Promise.all(state.results.map((result) => runProvider(result)));

  state.isGenerating = false;
  elements.generateButton.disabled = false;
  elements.generateButton.textContent = "Generate Study";
  elements.saveButton.disabled = !state.results.some((result) => result.status === "success");
  renderResults();
}

async function runProvider(result) {
  renderResults();
  try {
    const imageUrl = state.remoteEnabled ? await remoteTryOn(result.provider.id) : await mockTryOn(result.provider.id, getMode());
    result.status = "success";
    result.imageUrl = imageUrl;
  } catch (error) {
    result.status = "error";
    result.error = error.message || "Generation failed";
  }
  renderResults();
}

async function remoteTryOn(providerId) {
  if (!state.config.keys?.[providerId]) {
    throw new Error("API key missing");
  }

  const response = await fetch("/api/tryon", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      providerId,
      mode: getMode(),
      remoteEnabled: state.remoteEnabled,
      consentAccepted: state.consentAccepted,
      personImage: state.person.dataUrl,
      garmentImage: state.garment.dataUrl
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
    fashn: 1600,
    idm: 2300,
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
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  const palette = {
    opensource: ["#f2f2ef", "#111111"],
    fashn: ["#f7f2ea", "#365b52"],
    replicate: ["#eef2ef", "#4f5f76"],
    openai: ["#f5ece8", "#8a5149"]
  }[providerId];

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const [personImage, garmentImage] = await Promise.all([
    loadImage(state.person.dataUrl),
    loadImage(state.garment.dataUrl)
  ]);

  drawImageCover(ctx, personImage, 80, 80, 740, 1040, 0.22);
  drawImageContain(ctx, garmentImage, 245, 300, 410, 470);

  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.fillRect(0, 1010, canvas.width, 190);
  ctx.fillStyle = palette[1];
  ctx.font = "700 42px system-ui";
  ctx.fillText(providerLabel(providerId), 70, 1088);
  ctx.font = "400 26px system-ui";
  ctx.fillText(modeLabel(mode), 70, 1138);

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

function providerLabel(providerId) {
  return providers.find((provider) => provider.id === providerId)?.name || providerId;
}

function modeLabel(mode) {
  return {
    real: "Real try-on mock",
    soft: "Soft polish mock",
    editorial: "Editorial mock"
  }[mode];
}

function renderResults() {
  const hasResults = state.results.length > 0;
  elements.caseSection.hidden = hasResults;
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
}

function renderResultCard(result, index) {
  const imageContent =
    result.status === "loading"
      ? `<div class="result-image loading">Rendering...</div>`
      : result.status === "error"
        ? `<div class="result-image error">${result.error}<br /><button class="secondary-button retry-button" data-index="${index}" type="button">Retry</button></div>`
        : `<div class="result-image"><img src="${result.imageUrl}" alt="${result.provider.name} result" /></div>`;

  return `
    <article class="result-card">
      ${imageContent}
      <div class="result-body">
        <div class="result-title">
          <strong>${result.provider.name}</strong>
          <span class="status-chip">${statusLabel(result.status)}</span>
        </div>
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

function saveRun() {
  const savedRuns = getSavedRuns();
  const run = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    mode: getMode(),
    personName: state.person?.name,
    garmentName: state.garment?.name,
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
  state.person = null;
  state.garment = null;
  state.results = [];
  elements.personInput.value = "";
  elements.garmentInput.value = "";
  [elements.personPreview, elements.garmentPreview].forEach((preview) => {
    preview.hidden = true;
    preview.removeAttribute("src");
  });
  [elements.personDropzone, elements.garmentDropzone].forEach((dropzone) => dropzone.classList.remove("has-image"));
  elements.formError.textContent = "";
  elements.saveButton.disabled = true;
  renderResults();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

init();
