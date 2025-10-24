// ----- Global config -----
const SELECTORS = {
  searchInput: "searchInput",
  resultsContainer: "materialsSearchResults",
  rowTemplate: "rowTemplate",
};

let materialData = [];

// ----- DOMContentLoaded -----
document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById(SELECTORS.searchInput);
  const resultsContainer = document.getElementById(SELECTORS.resultsContainer);

  if (!searchInput || !resultsContainer) return;

  await loadMaterials(); // load data in memory only
  resultsContainer.innerHTML = ""; // ensure empty results

  searchInput.addEventListener("input", renderResults); // only render when typing
});

// ----- Load all materials -----
async function loadMaterials() {
  toggleLoader(true);
  try {
    const res = await fetch(`${scriptURL}?action=getMatDataForSearch`);
    const data = await res.json();
    materialData = Array.isArray(data) ? data.slice() : [];
    renderResults();
  } catch (err) {
    console.error("❌ Error loading materials:", err);
    showToast("❌ Failed to load materials", "error");
    materialData = [];
  } finally {
    toggleLoader(false);
  }
}

// ----- Render results -----
function renderResults() {
  const searchInput = document.getElementById(SELECTORS.searchInput);
  const resultsContainer = document.getElementById(SELECTORS.resultsContainer);
  const template = document.getElementById(SELECTORS.rowTemplate)?.content;

  if (!resultsContainer || !template) {
    console.error("❌ Missing results container or template");
    return;
  }

  const query = (searchInput?.value || "").toLowerCase().trim();
  const words = query.split(/\s+/).filter(Boolean);

  const filtered = query
    ? materialData.filter(row => words.every(w => row.some(cell => cell?.toString().toLowerCase().includes(w))))
    : []; // ← empty until user types

  resultsContainer.innerHTML = "";

  const fieldMap = {
    matID: 0,
    matName: 1,
    matPrice: 2,
    unitType: 3,
    unitQty: 4,
    supplier: 5,
    supplierUrl: 6,
    unitPrice: 7,
    onHand: 8,
    incomingPkg: 9,
    outgoing: 10,
    lastUpdated: 11,
    reorderLevel: 12
  };

  const fields = Object.keys(fieldMap);

  filtered.forEach(r => {
    const rowClone = template.cloneNode(true);
    const item = rowClone.querySelector(".accordion-item");
    if (!item) return; // safety
    const matID = r[fieldMap.matID];
    const headerBtn = item.querySelector(".accordion-button");
    const collapseEl = item.querySelector(".accordion-collapse");
    const headerEl = item.querySelector(".accordion-header");
    const body = item.querySelector(".accordion-body");

    if (!headerBtn || !collapseEl || !headerEl || !body) return; // safety

    // Collapse wiring
    headerBtn.setAttribute("data-bs-target", `#collapse-${matID}`);
    headerBtn.setAttribute("aria-controls", `collapse-${matID}`);
    collapseEl.id = `collapse-${matID}`;
    headerEl.id = `heading-${matID}`;

    collapseEl.addEventListener?.("shown.bs.collapse", () => {
      item.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    // ---- Compute low stock ----
    const onHandVal = parseSafeNumber(r[fieldMap.onHand]);
    const reorderVal = parseSafeNumber(r[fieldMap.reorderLevel]);
    const showLowStock = onHandVal < reorderVal;

    // ---- Card Header ----
    headerBtn.innerHTML = `
      <div class="row w-100 gx-2 text-truncate align-items-center">
        <div class="col-4 text-truncate fw-bold matName">${r[fieldMap.matName] ?? ""}</div>
        <div class="col-3 text-truncate supplier">${r[fieldMap.supplier] ?? ""}</div>
        <div class="col-3 matPrice">${r[fieldMap.matPrice] ?? ""}</div>
        <div class="col-2 onHand d-flex align-items-center">
          <span>OnHand: ${onHandVal}</span>
          ${showLowStock ? '<span class="low-stock-icon text-warning ms-1">⚠️</span>' : ""}
        </div>
      </div>
    `;

    // ===== BODY ONLY: populate spans/inputs =====
    fields.forEach(f => {
      const idx = fieldMap[f];
      const rawVal = idx !== undefined ? (r[idx] ?? "") : "";
      const span = body.querySelector?.(`.${f}`);
      const input = body.querySelector?.(`.${f}-input`);

      if (f === "matID") {
        const matIDSpan = body.querySelector(".matID");
        if (matIDSpan) matIDSpan.textContent = `ID # ${rawVal}`;
        if (input) input.classList.add("d-none");
      } else if (f === "lastUpdated") {
        const lastUpdatedSpan = body.querySelector(".lastUpdated");
        let displayVal = rawVal;
        try {
          const d = new Date(rawVal);
          if (!isNaN(d)) displayVal = d.toLocaleDateString();
        } catch {}
        if (lastUpdatedSpan) lastUpdatedSpan.textContent = `Last Updated: ${displayVal}`;
        if (input) {
          input.value = rawVal;
          input.disabled = true;
        }
      } else if (f === "supplierUrl") {
        // preserve your working supplierUrl logic
        let displayUrl = "No URL provided";
        let href = "";
        if (rawVal) {
          try {
            const urlObj = new URL(rawVal);
            displayUrl = urlObj.hostname;
            href = rawVal;
          } catch {
            displayUrl = rawVal;
            href = rawVal;
          }
        }
        if (span) {
          span.innerHTML = href
            ? `<a href="${href}" target="_blank" rel="noopener noreferrer" 
                 class="d-inline-block text-truncate" style="max-width:250px;" title="${href}">${displayUrl}</a>`
            : `<span class="text-muted">${displayUrl}</span>`;
        }
        if (input) input.value = rawVal;
      } else {
        if (span) span.textContent = rawVal;
        if (input) input.value = rawVal;
      }
    });

    // Reorder alert
    const alertEl = body.querySelector(".reorder-alert");
    if (alertEl) alertEl.classList.toggle("d-none", !showLowStock);

    // ----- Buttons & Edit Mode -----
    const editBtn = item.querySelector(".edit-button");
    const saveBtn = item.querySelector(".save-button");
    const cancelBtn = item.querySelector(".cancel-button");
    const deleteBtn = item.querySelector(".delete-button");
    const beforeDeleteBtn = item.querySelector(".before-delete-button");

    const toggleEditMode = (editing) => {
      fields.forEach(f => {
        const span = body.querySelector(`.${f}`);
        const input = body.querySelector(`.${f}-input`);

        if (f === "matID") {
          if (span) span.classList.remove("d-none");
          if (input) input.classList.add("d-none");
        } else if (f === "lastUpdated") {
          if (span) span.classList.remove("d-none");
          if (input) input.classList.remove("d-none");
        } else {
          if (span) span.classList.toggle("d-none", editing);
          if (input) input.classList.toggle("d-none", !editing);
        }
      });

      if (editing && saveBtn) saveBtn.disabled = true;
      [editBtn, saveBtn, cancelBtn].forEach(el => {
        if (!el) return;
        el.classList.toggle("d-none", el !== editBtn ? !editing : editing);
      });
    };

    const resetValues = () => {
      fields.forEach(f => {
        const idx = fieldMap[f];
        const rawVal = idx !== undefined ? (r[idx] ?? "") : "";
        const span = body.querySelector(`.${f}`);
        const input = body.querySelector(`.${f}-input`);

        if (f === "matID") {
          const matIDSpan = body.querySelector(".matID");
          if (matIDSpan) matIDSpan.textContent = `ID # ${rawVal}`;
          if (input) input.classList.add("d-none");
        } else if (f === "lastUpdated") {
          const lastUpdatedSpan = body.querySelector(".lastUpdated");
          if (lastUpdatedSpan) lastUpdatedSpan.textContent = `Last Updated: ${rawVal}`;
          if (input) input.value = rawVal;
        } else if (f === "supplierUrl") {
          let displayUrl = "No URL provided";
          let href = "";
          if (rawVal) {
            try {
              const urlObj = new URL(rawVal);
              displayUrl = urlObj.hostname;
              href = rawVal;
            } catch {
              displayUrl = rawVal;
              href = rawVal;
            }
          }
          if (span) {
            span.innerHTML = href
              ? `<a href="${href}" target="_blank" rel="noopener noreferrer" 
                   class="d-inline-block text-truncate" style="max-width:250px;" title="${href}">${displayUrl}</a>`
              : `<span class="text-muted">${displayUrl}</span>`;
          }
          if (input) input.value = rawVal;
        } else {
          if (span) span.textContent = rawVal;
          if (input) input.value = rawVal;
        }
      });
    };

    // Force ID in legend
    const matIDSpan = body.querySelector(".matID");
    if (matIDSpan) matIDSpan.textContent = `ID # ${matID}`;

    // Edit / Cancel
    if (editBtn) editBtn.addEventListener("click", () => toggleEditMode(true));
    if (cancelBtn) cancelBtn.addEventListener("click", () => { resetValues(); toggleEditMode(false); });

    // Enable Save on any input change
    body.querySelectorAll("input.form-control").forEach(inp => {
      inp.addEventListener("input", () => { if (saveBtn) saveBtn.disabled = false; });
    });

    // Save
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const updated = {};
        fields.forEach(f => {
          const input = body.querySelector(`.${f}-input`);
          if (input && f !== "matID") updated[f] = input.value.trim();
        });

        toggleLoader(true);
        try {
          const res = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ system: "materials", action: "edit", matID, materialInfo: updated })
          });
          const result = await res.json();
          showToast(result.success ? "✅ Material updated!" : "⚠️ Update failed", result.success ? "success" : "error");
          await loadMaterials();
        } catch (e) {
          console.error(e);
          showToast("⚠️ Failed to update material", "error");
        } finally {
          toggleLoader(false);
        }
      });
    }

    // Delete toggle
    if (beforeDeleteBtn) {
      beforeDeleteBtn.addEventListener("click", () => {
        const isDelete = beforeDeleteBtn.dataset.buttonState === "delete";
        if (deleteBtn) deleteBtn.classList.toggle("d-none", !isDelete);
        beforeDeleteBtn.textContent = isDelete ? "Cancel" : "Delete";
        beforeDeleteBtn.dataset.buttonState = isDelete ? "cancel" : "delete";
      });
    }

    // Delete
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        toggleLoader(true);
        try {
          const res = await fetch(scriptURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ system: "materials", action: "delete", matID })
          });
          const result = await res.json();
          showToast(result.success ? "✅ Material deleted!" : "⚠️ Delete failed", result.success ? "success" : "error");
          await loadMaterials();
        } catch (e) {
          console.error(e);
          showToast("⚠️ Failed to delete material", "error");
        } finally {
          toggleLoader(false);
        }
      });
    }

    resultsContainer.appendChild(item);

    // --- Autocalculate (watch inputs) ---
    calculateAllForCard(body);
    body.querySelectorAll(".matPrice-input, .unitQty-input, .onHand-input, .incomingPkg-input").forEach(input => {
      input.addEventListener("input", () => calculateAllForCard(body));
    });

    // --- Initialize Receive Delivery ---
    initializeReceiveDelivery(body, r[fieldMap["matID"]]);
  });

  const totalCounter = document.getElementById("totalCounter");
  if (totalCounter) totalCounter.textContent = String(materialData.length);
  const searchCounter = document.getElementById("searchCounter");
  if (searchCounter) searchCounter.textContent = String(filtered.length);
}

// ----- Add material -----
async function addMaterial(e) {
  e.preventDefault();

  const FIELDS = ["matName","supplier","supplierUrl","unitType","matPrice","unitQty","unitPrice","onHand","lastUpdated","reorderLevel"];
  const materialInfo = Object.fromEntries(FIELDS.map(f => [f, document.getElementById(f)?.value.trim() || ""]));

  if (!materialInfo.matName || !materialInfo.matPrice) {
    return showToast("❌ Name and Price are required!", "error");
  }

  // Format today's date as MM/DD/YYYY
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const yyyy = today.getFullYear();
  materialInfo.lastUpdated = `${mm}/${dd}/${yyyy}`;

  toggleLoader(true);
  try {
    const res = await fetch(`${scriptURL}?action=add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: "materials", action: "add", materialInfo })
    });
    const result = await res.json();

    showToast(result.success ? "✅ Material added!" : "❌ Add failed", result.success ? "success" : "error");

    if (result.success) {
      const form = document.getElementById("addMaterialFormAccordion");
      if (form) form.reset();

      const collapseEl = document.getElementById("collapse-addMaterial");
      if (collapseEl) {
        bootstrap.Collapse.getOrCreateInstance(collapseEl).hide();
      }

      // Hook autocalculate on the inputs after reset
      const addCardRow = document.getElementById("collapse-addMaterial");
      if (addCardRow) {
        ["matPrice","unitQty","onHand"].forEach(id => {
          const inp = document.getElementById(id);
          if (inp) {
            inp.addEventListener("input", () => calculateAllForCard(addCardRow));
          }
        });
      }
    }

    await loadMaterials();
  } catch (err) {
    console.error("Error in addMaterial:", err);
    showToast("⚠️ Failed to add material", "error");
  } finally {
    toggleLoader(false);
  }
}

// ----- Initialize Receive Delivery -----
function initializeReceiveDelivery(row, matID) {
  if (!row) return;

  const receiveBtn = row.querySelector(".receive-delivery-btn");
  const qtyInput = row.querySelector(".incomingPkg-qty-input");
  const confirmBtn = row.querySelector(".confirm-delivery-btn");

  if (!receiveBtn || !qtyInput || !confirmBtn) return;

  const showReceiveUI = show => {
    if (show) {
      qtyInput.classList.remove("d-none");
      confirmBtn.classList.remove("d-none");
      receiveBtn.textContent = "Cancel";
      qtyInput.focus();
    } else {
      qtyInput.classList.add("d-none");
      confirmBtn.classList.add("d-none");
      receiveBtn.textContent = "Receive Delivery";
      qtyInput.value = "";
    }
  };

  receiveBtn.addEventListener("click", () => {
    const active = !qtyInput.classList.contains("d-none");
    showReceiveUI(!active);
  });

  confirmBtn.addEventListener("click", async () => {
    const incomingPackages = parseSafeNumber(qtyInput.value);
    if (incomingPackages <= 0) {
      showToast("⚠️ Enter a valid quantity", "warning");
      return;
    }

    const unitQty = parseSafeNumber(row.querySelector(".unitQty")?.textContent);
    const onHand = parseSafeNumber(row.querySelector(".onHand-input")?.value || row.querySelector(".onHand")?.textContent);
    const totalReceived = incomingPackages * unitQty;
    const newOnHand = onHand + totalReceived;

    // Build payload for backend
    const payload = {
      system: "materials",
      action: "receiveDelivery",
      materialArray: [{
        matID,
        onHand: newOnHand,
        incomingPkg: incomingPackages,
        lastUpdated: new Date().toISOString()
      }]
    };

    toggleLoader(true);
    try {
      const res = await fetch(scriptURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (!result || !result.success) {
        showToast("❌ Failed to update inventory", "error");
        return;
      }

      showToast(`✅ Received ${incomingPackages} package(s) = ${totalReceived} units`, "success");

      // --- Update BODY (numeric only, no labels) ---
      const onHandInput = row.querySelector(".onHand-input");
      if (onHandInput) onHandInput.value = String(newOnHand);
      const onHandSpan = row.querySelector(".onHand");
      if (onHandSpan) onHandSpan.textContent = String(newOnHand);

      const incomingPkgInput = row.querySelector(".incomingPkg-input");
      if (incomingPkgInput) incomingPkgInput.value = String(incomingPackages);
      const incomingPkgSpan = row.querySelector(".incomingPkg");
      if (incomingPkgSpan) incomingPkgSpan.textContent = String(incomingPackages);

      // --- Update HEADER (with "OnHand: X") ---
      const headerOnHandDiv = row.querySelector(".accordion-button .onHand");
      if (headerOnHandDiv) {
        const span = headerOnHandDiv.querySelector("span");
        if (span) span.textContent = `OnHand: ${newOnHand}`;
        else headerOnHandDiv.textContent = `OnHand: ${newOnHand}`;

        // Update low-stock icon
        const reorder = parseSafeNumber(row.querySelector(".reorderLevel-input")?.value);
        let icon = headerOnHandDiv.querySelector(".low-stock-icon");
        if (newOnHand < reorder) {
          if (!icon) {
            icon = document.createElement("span");
            icon.className = "low-stock-icon text-warning ms-1";
            icon.textContent = "⚠️";
            if (span) span.after(icon);
            else headerOnHandDiv.appendChild(icon);
          }
        } else {
          if (icon) icon.remove();
        }
      }

      // Recalculate dependent fields
      if (typeof calculateAllForCard === "function") calculateAllForCard(row);

      showReceiveUI(false);
    } catch (err) {
      console.error(err);
      showToast("❌ Error updating inventory", "error");
    } finally {
      toggleLoader(false);
    }
  });
}

// ----- Calculate & Low-stock -----
function calculateAllForCard(row) {
  if (!row) return;

  const parseSafe = val => parseSafeNumber(val);
  const formatSafe = val => Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const getInputVal = cls => {
    const el = row.querySelector(`.${cls}-input`);
    return el ? parseSafe(el.value) : 0;
  };

  const setInputVal = (cls, val) => {
    const el = row.querySelector(`.${cls}-input`);
    if (el) el.value = formatSafe(val);
  };

  const matPrice = getInputVal("matPrice");
  const unitQty = getInputVal("unitQty");
  const onHand = getInputVal("onHand");
  const incomingPkg = getInputVal("incomingPkg");

  const unitPrice = unitQty !== 0 ? matPrice / unitQty : 0;
  const totalStock = onHand + (unitQty * incomingPkg);

  setInputVal("unitPrice", unitPrice);
  setInputVal("totalStock", totalStock);

  // Sync header matPrice correctly
  const headerMatPrice = row.querySelector(".accordion-button .matPrice");
  if (headerMatPrice) headerMatPrice.textContent = formatSafe(matPrice);

  // Update header onHand
  const headerOnHandDiv = row.closest(".accordion-item")?.querySelector(".accordion-button .onHand");
  const reorder = getInputVal("reorderLevel");
  if (headerOnHandDiv) {
    const span = headerOnHandDiv.querySelector("span");
    if (span) span.textContent = `OnHand: ${onHand}`;
    else headerOnHandDiv.textContent = `OnHand: ${onHand}`;

    const existingIcon = headerOnHandDiv.querySelector(".low-stock-icon");
    if (totalStock < reorder) {
      if (!existingIcon) {
        const icon = document.createElement("span");
        icon.className = "low-stock-icon text-warning ms-1";
        icon.textContent = "⚠️";
        span ? span.after(icon) : headerOnHandDiv.appendChild(icon);
      }
    } else {
      existingIcon?.remove();
    }
  }

  // Low-stock alert in body
  const alert = row.querySelector(".reorder-alert");
  if (alert) alert.classList.toggle("d-none", totalStock >= reorder);
}

// Optional: keep function for compatibility
function checkLowStockForCard(row, totalStock) {
  const reorder = parseSafeNumber(row.querySelector(".reorderLevel-input")?.value);
  const alert = row.querySelector(".reorder-alert");
  if (alert) alert.classList.toggle("d-none", totalStock >= reorder);
}

// Initialize Add Card
function initializeAddCard() {
  // Set today's date in US format (MM/DD/YYYY)
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const yyyy = today.getFullYear();
  const addDateSpan = document.getElementById("addMaterialDate");
  if (addDateSpan) addDateSpan.textContent = `${mm}/${dd}/${yyyy}`;

  // Hook autocalculations (matPrice, unitQty, onHand → unitPrice, totals, etc.)
  const addCardBody = document.querySelector("#collapse-addMaterial .accordion-body");
  if (addCardBody) {
    ["matPrice", "unitQty", "onHand"].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", () => calculateAllForCard(addCardBody));
      }
    });
  }

  // Hook form submit
  const addForm = document.getElementById("addMaterialFormAccordion");
  if (addForm) {
    addForm.addEventListener("submit", addMaterial);
  }

  // Hook cancel button
  const addCancelBtn = document.getElementById("addCancelBtn");
  if (addCancelBtn) {
    addCancelBtn.addEventListener("click", () => {
      const form = document.getElementById("addMaterialFormAccordion");
      if (form) form.reset();
    });
  }
}

// Master initializer
function initializePage() {
  initializeReceiveDelivery();
  initializeAddCard();
  // (call other initializers here as needed)
}

// Run initializer when DOM is ready
document.addEventListener("DOMContentLoaded", initializePage);

