// Restore Point 9/28/2025 6:30 PM

// ====== Global Config & State ======

const SELECTORS = {
  searchInput: "searchInput",
  resultsContainer: "productSearchResults",
  rowTemplate: "rowTemplate",
  totalCostField: "totalCost",
  totalRetailField: "totalRetail",
  partBadge: "partrow-header-display",
  addProductForm: "addProductForm",
  addPartContainer: "part-rows",
  addProductPartsAccordion: "addProductPartsAccordion"
};

let productData = [];
let materialData = {};   // matID -> { matID, name, unitPrice, ... }
let materialByName = {}; // name -> material object
const maxParts = 15;

function roundUpToStep(value, step = 0.05) {
  return Math.ceil(value / step) * step;
}

// ====== Attach autogrow to textarea ======
function attachAutogrow(textarea) {
  if (!textarea || textarea.tagName !== 'TEXTAREA') return;

  const BUFFER_PX = 3;
  const initialRows = parseInt(textarea.getAttribute('rows'), 10) || 1;

  const autoGrow = () => {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight + BUFFER_PX) + 'px';
  };

  textarea.addEventListener('input', autoGrow);
  textarea.addEventListener('focus', autoGrow);

  const ensureVisibleAndGrow = () => {
    const visible = textarea.offsetParent !== null && getComputedStyle(textarea).display !== 'none';
    if (visible) {
      autoGrow();
      return;
    }
    const mo = new MutationObserver(() => {
      if (textarea.offsetParent !== null && getComputedStyle(textarea).display !== 'none') {
        autoGrow();
        mo.disconnect();
      }
    });
    mo.observe(textarea, { attributes: true, attributeFilter: ['class', 'style'] });
    const fallbackId = setInterval(() => {
      if (textarea.offsetParent !== null && getComputedStyle(textarea).display !== 'none') {
        autoGrow();
        clearInterval(fallbackId);
        mo.disconnect();
      }
    }, 50);
    setTimeout(() => clearInterval(fallbackId), 3000);
  };

  requestAnimationFrame(ensureVisibleAndGrow);

  const form = textarea.closest('form');
  if (form) {
    const origReset = form.reset.bind(form);
    form.reset = function () {
      origReset();
      textarea.rows = initialRows;
      textarea.style.height = '';
      setTimeout(() => autoGrow(), 0);
    };
  }

  return autoGrow;
}

// ----- Load Products -----
async function loadProducts() {
  toggleLoader(true);
  try {
    const res = await fetch(`${scriptURL}?action=getProdDataForSearch`);
    const json = await res.json();

    const data = Array.isArray(json) ? json : json.data || [];
    
    productData = data.map(product => {
      let parts = [];
      try {
        if (product[4]) {
          parts = JSON.parse(product[4]);
          // If the stored value was stringified twice (escaped quotes), JSON.parse
          // may return a string containing JSON. Try parsing again in that case.
          if (typeof parts === 'string') {
            try { parts = JSON.parse(parts); } catch (e2) { /* leave as-is */ }
          }
        } else {
          parts = [];
        }
      } catch (e) {
        parts = [];
      }
      // Ensure we always have an array
      if (!Array.isArray(parts)) parts = [];
      return {
        prodID: product[0],
        productName: product[1],
        productType: product[2],
        thumbnailURL: product[3] || "",  // <-- changed from compTime
        parts,
        description: product[5],
        cost: parseFloat(product[6]) || 0,
        retail: parseFloat(product[7]) || 0,
        lastUpdated: product[8] || "",
        raw: product
      };
    });
  } catch (err) {
    console.error("❌ Error loading product data:", err);
    productData = [];
  } finally { toggleLoader(false); }
}

// ----- Load Material Data -----
async function loadMaterialData() {
  toggleLoader(true);
  try {
    const res = await fetch(`${scriptURL}?action=getMatDataForSearch`);
    const raw = await res.json();
    materialData = {};
    materialByName = {};

    raw.forEach(row => {
      const id = row[0]?.trim();
      const name = row[1]?.trim();
      const supplierUrl = row[6]?.trim() || ""; // column G/7
      const unitPrice = parseFloat(row[7]?.replace(/[^0-9.]/g, "")) || 0; // column H/8
      const onHand = parseFloat(row[8]?.replace(/[^0-9.]/g, "")) || 0; // column I/9

      if (id && name) {
        const mat = { matID: id, name, supplierUrl, unitPrice, onHand };
        materialData[id] = mat;
        materialByName[name] = mat;
      }
    });

    const datalist = document.getElementById("row-parts-selector");
    if (datalist) {
      datalist.innerHTML = "";
      Object.values(materialData).forEach(mat => {
        const opt = document.createElement("option");
        opt.value = mat.name;
        datalist.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("❌ Error loading materials:", err);
    showToast("❌ Failed to load materials", "error");
  } finally { 
    toggleLoader(false); 
  }
}

// ====== DOM Ready (Unified Product Card Approach) ======
document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById(SELECTORS.searchInput);
  const resultsContainer = document.getElementById(SELECTORS.resultsContainer);
  if (!searchInput || !resultsContainer) return;

  // --- Load data ---
  await loadMaterialData();
  await loadProducts();
  // loadDropdowns(); // optional if already loaded globally

  // --- Render only the Add card initially ---
  renderProductCard(null);

  // --- Initialize counters ---
  const totalCounter = document.getElementById("totalCounter");
  const searchCounter = document.getElementById("searchCounter");
  if (totalCounter) totalCounter.textContent = String(productData.length);
  if (searchCounter) searchCounter.textContent = "0"; // no results yet

  // --- Live search filtering ---
  searchInput.addEventListener("input", () => {
    const query = (searchInput.value || "").toLowerCase().trim();
    const words = query.split(/\s+/).filter(Boolean);

    resultsContainer.innerHTML = "";
    renderProductCard(null); // always render Add card first

    if (query) {
      const filtered = productData.filter(prod =>
        words.every(w =>
          Object.values(prod).some(val => (val?.toString() || "").toLowerCase().includes(w))
        )
      );

      filtered.forEach(p => renderProductCard(p));

      if (searchCounter) searchCounter.textContent = String(filtered.length);
    } else {
      if (searchCounter) searchCounter.textContent = "0";
    }

    if (totalCounter) totalCounter.textContent = String(productData.length);
  });

  // Scroll card into center when accordion finishes expanding
  document.addEventListener("shown.bs.collapse", (e) => {
    const card = e.target.closest(".accordion-item.product-accordion");
    if (!card) return;

    card.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ===== Delegated Click Handling =====
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const card = btn.closest(".accordion-item.product-accordion");
    if (!card) return;

    const partsContainer = card.querySelector(".part-rows");
    const beforeDeleteBtn = card.querySelector(".before-delete-button");
    const deleteBtn = card.querySelector(".delete-button");
    const saveBtn = card.querySelector(".save-button");

    const isAddCard = !card.dataset.prodId; // Add card detection

    // --- Edit / Cancel ---
    if (btn.classList.contains("edit-button")) enableEditToggle(card, true, isAddCard);
    if (btn.classList.contains("cancel-button")) enableEditToggle(card, false, isAddCard);

    // --- +Part ---
    if (btn.classList.contains("addPartBtn") && partsContainer) {
      if (partsContainer.querySelectorAll(".part-row").length >= maxParts) {
        return showToast("⚠️ Max parts reached", "warning");
      }
      addPartRow(partsContainer, "", 0, 0, 0, true);
      recalculateTotals(partsContainer);
      if (saveBtn) saveBtn.disabled = false;
    }

    // --- Remove Part ---
    if (btn.classList.contains("remove-part") && partsContainer) {
      const row = btn.closest(".part-row");
      if (row) {
        row.remove();
        recalculateTotals(partsContainer);
        if (saveBtn) saveBtn.disabled = false;
      }
    }

    // --- Save (Add / Edit) ---
    if (btn.classList.contains("save-button")) {
      const prodID = card.dataset.prodId;
      const isNew = !prodID;

      const partsArray = Array.from(card.querySelectorAll(".part-row")).map(row => ({
        matName: row.querySelector(".part-input")?.value || "",
        qty: parseFloat(row.querySelector(".qty-input")?.value) || 0,
        cost: parseFloat(row.querySelector(".totalRowCost")?.dataset.raw) || 0,
        retail: parseFloat(row.querySelector(".totalRowRetail")?.dataset.raw) || 0
      }));

      const totalCostNumeric = partsArray.reduce((sum, p) => sum + p.cost, 0);
      const totalRetailNumeric = partsArray.reduce((sum, p) => sum + p.retail, 0);

      const productInfo = {
        productName: card.querySelector(".productName-input")?.value.trim(),
        productType: card.querySelector(".productType-input")?.value.trim(),
        description: card.querySelector(".description-input")?.value.trim(),
        parts: partsArray,
        partsJSON: isNew ? partsArray : JSON.stringify(partsArray),
        cost: totalCostNumeric,
        retail: totalRetailNumeric
      };

      try {
        toggleLoader(true);
        const res = await fetch(scriptURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: "products",
            action: isNew ? "add" : "edit",
            ...(isNew ? { productInfo } : { prodID, productInfo })
          })
        });

        const result = await res.json();

        if (result.success) {
          showToast(isNew ? "✅ Product added!" : "✅ Product updated!", "success");
          if (isNew) card.dataset.prodId = result.prodID;
          enableEditToggle(card, false, isAddCard);

          await loadProducts();
          refreshSearchResults(result.prodID);

        } else {
          showToast(result.message || "❌ Error saving product", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("❌ Network error saving product", "error");
      } finally {
        toggleLoader(false);
      }
    }

    // --- Delete Confirm ---
    if (btn === beforeDeleteBtn) {
      const isDelete = beforeDeleteBtn.dataset.buttonState === "delete";
      beforeDeleteBtn.textContent = isDelete ? "Cancel" : "Delete";
      beforeDeleteBtn.dataset.buttonState = isDelete ? "cancel" : "delete";
      if (deleteBtn) deleteBtn.classList.toggle("d-none", !isDelete);
    }

    // --- Delete Action ---
    if (btn === deleteBtn) {
      const prodID = card.dataset.prodId;
      if (!prodID) return showToast("⚠️ Product ID missing", "error");

      toggleLoader(true);
      try {
        const res = await fetch(scriptURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ system: "products", action: "delete", prodID })
        });
        const result = await res.json();
        if (result.success) {
          showToast("✅ Product deleted!", "success");
          card.remove();

          await loadProducts();
          refreshSearchResults();

        } else {
          showToast("⚠️ Could not delete product.", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("⚠️ Error deleting product.", "error");
      } finally {
        toggleLoader(false);
      }
    }
  });
});

// ====== Render Product Card ======
async function renderProductCard(product = null) {
  const container = document.getElementById(SELECTORS.resultsContainer);
  if (!container) return;

  const template = document.getElementById(SELECTORS.rowTemplate);
  if (!template) return;

  const clone = template.content.cloneNode(true);
  const wrapper = clone.querySelector(".accordion-item");
  if (!wrapper) return;

  const prodID = product?.prodID?.toString() ?? "";
  if (prodID) wrapper.dataset.prodId = prodID;

  // Wire collapse IDs
  [["h2.accordion-header", ".accordion-button", ".accordion-collapse", ""],
   [".parts-accordion h2.accordion-header", ".parts-accordion .accordion-button", ".parts-accordion .accordion-collapse", "parts-"]]
    .forEach(([headerSel, btnSel, collapseSel, prefix]) => {
      const h = wrapper.querySelector(headerSel);
      const c = wrapper.querySelector(collapseSel);
      if (!h || !c) return;
      const hId = `${prefix}heading-${prodID || "add"}`;
      const cId = `${prefix}collapse-${prodID || "add"}`;
      h.id = hId;
      const btn = h.querySelector(".accordion-button");
      if (btn) {
        btn.setAttribute("data-bs-target", `#${cId}`);
        btn.setAttribute("aria-controls", cId);
      }
      c.id = cId;
      c.setAttribute("aria-labelledby", hId);
      if (!prefix) c.setAttribute("data-bs-parent", `#${SELECTORS.resultsContainer}`);
    });

  const partsContainer = wrapper.querySelector(".part-rows");
  const isAddCard = !product;

  if (product) {
    // Existing product
    wrapper.querySelector(".productName-header").textContent = product.productName ?? "";
    wrapper.querySelector(".productName-body").textContent = product.productName ?? "";
    wrapper.querySelector(".productName-input").value = product.productName ?? "";
    wrapper.querySelector(".description-body").textContent = product.description ?? "";
    wrapper.querySelector(".description-input").value = product.description ?? "";
    wrapper.querySelector(".productType-body").textContent = product.productType ?? "";
    wrapper.querySelector(".productType-input").value = product.productType ?? "";
    wrapper.querySelector(".totalRetail-header").textContent = formatCurrency(product.retail ?? 0);
    wrapper.querySelector(".totalRetail-body").textContent = formatCurrency(product.retail ?? 0);
    wrapper.querySelector(".inStockValue-header").textContent = calculateInStock(product);
    wrapper.querySelector(".inStockValue-body").textContent = calculateInStock(product);

    const inStockSpan = wrapper.querySelector(".inStockValue-body");
    if (inStockSpan) {
      inStockSpan.dataset.prodIndex = productData.indexOf(product); // or i if in a loop
      inStockSpan.onclick = () => renderInStockModal(product);
    }

    const iconElem = wrapper.querySelector(".productType-icon");
    if (iconElem) {
      iconElem.innerHTML =
        product.productType === "Product" ? '<i class="fa-solid fa-tag text-success"></i>' :
        product.productType === "Rental"  ? '<i class="fa-solid fa-key text-primary"></i>' :
                                            '<i class="fa-solid fa-box-open"></i>';
    }

    const lastUpdated = wrapper.querySelector(".lastUpdated");
    if (lastUpdated) lastUpdated.textContent = formatDateForUser(product.lastUpdated);

    // Populate parts
    if (partsContainer && Array.isArray(product.parts)) {
      partsContainer.innerHTML = "";
      product.parts.forEach(p => 
        addPartRow(partsContainer,
                   p.matName ?? "",
                   parseFloat(p.qty) || 0,
                   parseFloat(p.cost) || 0,
                   parseFloat(p.retail) || 0,
                   false) // read-only
      );
    }

    enableEditToggle(wrapper, false, isAddCard);

  } else {
    // Add card
    wrapper.querySelector(".productName-header").textContent = "➕ Add New Product";
    wrapper.querySelector(".totalRetail-header").textContent = formatCurrency(0);
    wrapper.querySelector(".totalRetail-body").textContent = formatCurrency(0);
    wrapper.querySelector(".inStockValue-header").textContent = "0";
    wrapper.querySelector(".inStockValue-body").textContent = "0";
    wrapper.querySelector(".productType-icon").innerHTML = '<i class="fa-solid fa-box-open"></i>';
    wrapper.querySelector(".lastUpdated").textContent = formatDateForUser(new Date());

    if (partsContainer) addPartRow(partsContainer, "", 0, 0, 0, true);

    // Hide Delete/Cancel buttons explicitly
    ["before-delete-button", "delete-button", "cancel-button"].forEach(cls => {
      const btn = wrapper.querySelector(`.${cls}`);
      if (btn) btn.classList.add("d-none");
    });

    enableEditToggle(wrapper, true, isAddCard);
  }

  // ===== Thumbnail Handling =====
  const imgElem = wrapper.querySelector(".productThumbnail");
  if (product?.thumbnailURL) {
    imgElem.src = convertGoogleDriveLink(product.thumbnailURL);
  } else {
    imgElem.src = "/images/No_image_available.svg";
  }
  imgElem.style.display = "block";

  attachAutogrow(wrapper.querySelector(".productName-input"));
  attachAutogrow(wrapper.querySelector(".description-input"));

// ===== Product Type Datalist + Icon + Datalist population =====
const typeInput = wrapper.querySelector(".productType-input");
const iconElem  = wrapper.querySelector(".productType-icon");
const typeDatalist = document.getElementById("product-type-selector");

if (typeInput && iconElem && typeDatalist) {
  // Populate datalist with unique product types
  const uniqueProductTypes = [...new Set(productData.map(p => p.productType).filter(Boolean))];
  typeDatalist.innerHTML = "";
  uniqueProductTypes.forEach(type => {
    const option = document.createElement("option");
    option.value = type;
    typeDatalist.appendChild(option);
  });

  // Update icon whenever value changes
  typeInput.addEventListener("input", () => {
    const val = typeInput.value;
    iconElem.innerHTML =
      val === "Product" ? '<i class="fa-solid fa-tag text-success"></i>' :
      val === "Rental"  ? '<i class="fa-solid fa-key text-primary"></i>' :
                          '<i class="fa-solid fa-box-open"></i>';
  });

  // Show all options on click/focus (but keep current value visible)
  ['mousedown', 'focus'].forEach(evt => {
    typeInput.addEventListener(evt, e => {
      const currentValue = typeInput.value;
      setTimeout(() => { typeInput.value = currentValue; }, 0);
    });
  });
}

  // ===== Product Name header listener =====
  const nameInput = wrapper.querySelector(".productName-input");
  const nameHeader = wrapper.querySelector(".productName-header");
  const nameBody   = wrapper.querySelector(".productName-body"); // optional if you also want body sync
  if (nameInput && nameHeader && nameBody) {
    nameInput.addEventListener("input", () => {
      nameHeader.textContent = nameInput.value;
      nameBody.textContent   = nameInput.value;
    });
  }

  container.appendChild(clone);
}

// ====== Enable/Disable Edit Mode ======
function enableEditToggle(wrapper, isEditing, isAddCard = false) {
  const editBtn         = wrapper.querySelector(".edit-button");
  const saveBtn         = wrapper.querySelector(".save-button");
  const cancelBtn       = wrapper.querySelector(".cancel-button");
  const addPartBtn      = wrapper.querySelector(".addPartBtn");
  const beforeDeleteBtn = wrapper.querySelector(".before-delete-button");
  const deleteBtn       = wrapper.querySelector(".delete-button");

  // --- Top buttons ---
  if (editBtn) editBtn.classList.toggle("d-none", isEditing || isAddCard);
  if (saveBtn) saveBtn.classList.toggle("d-none", !isEditing);
  if (saveBtn) saveBtn.disabled = true; // always start disabled
  if (cancelBtn) cancelBtn.classList.toggle("d-none", !isEditing || isAddCard);

  if (addPartBtn) addPartBtn.style.display = isEditing ? "inline-block" : "none";
  if (beforeDeleteBtn) beforeDeleteBtn.style.display = isAddCard ? "none" : "inline-block";
  if (deleteBtn) deleteBtn.classList.toggle("d-none", true); // Always hidden until delete confirmation

  // --- Main fields ---
  [
    [".productName-body", ".productName-input"],
    [".description-body", ".description-input"],
    [".productType-body", ".productType-input"]
  ].forEach(([bodySel, inputSel]) => {
    const body = wrapper.querySelector(bodySel);
    const input = wrapper.querySelector(inputSel);
    if (body && input) {
      body.classList.toggle("d-none", isEditing);
      input.classList.toggle("d-none", !isEditing);
    }
  });

  // --- Parts ---
  const partsContainer = wrapper.querySelector(".part-rows");
  if (partsContainer) {
    partsContainer.querySelectorAll(".part-row").forEach(row => {
      const nameInput = row.querySelector(".part-input");
      const qtyInput  = row.querySelector(".qty-input");
      const nameSpan  = row.querySelector(".part-name-span");
      const qtySpan   = row.querySelector(".part-qty-span");
      const removeBtn = row.querySelector(".remove-part");

      // Toggle name/qty visibility
      if (nameInput && nameSpan) {
        nameInput.classList.toggle("d-none", !isEditing);
        nameSpan.classList.toggle("d-none", isEditing);
      }
      if (qtyInput && qtySpan) {
        qtyInput.classList.toggle("d-none", !isEditing);
        qtySpan.classList.toggle("d-none", isEditing);
      }

      // Remove button only visible for existing products in edit mode
      if (removeBtn) removeBtn.style.display = (isEditing && !isAddCard) ? "inline-block" : "none";

      // Cost/retail always visible
      row.querySelectorAll(".part-cost-span, .part-retail-span")
         .forEach(span => span.classList.remove("d-none"));
    });
  }

  // --- Enable Save Button When Any Field Changes ---
  if (isEditing && saveBtn) {
    const editableFields = wrapper.querySelectorAll(
      ".productName-input, .description-input, .productType-input, .part-input, .qty-input"
    );
    editableFields.forEach(input => {
      // Avoid attaching multiple listeners
      if (!input.dataset.listenerAttached) {
        input.addEventListener("input", () => {
          saveBtn.disabled = false;
        });
        input.dataset.listenerAttached = "1";
      }
    });
  }
}

// ===== Add Part Row =====
function addPartRow(partsContainer, name = "", qty = 0, cost = 0, retail = 0, wrapperIsEditing = true) {
  const template = document.getElementById("partRowTemplate");
  if (!template || !partsContainer) return;

  const clone = template.content.cloneNode(true);
  const row = clone.querySelector(".part-row");
  if (!row) return;

  const nameInput  = row.querySelector(".part-input");
  const qtyInput   = row.querySelector(".qty-input");
  const nameSpan   = row.querySelector(".part-name-span");
  const qtySpan    = row.querySelector(".part-qty-span");
  const costSpan   = row.querySelector(".part-cost-span");
  const retailSpan = row.querySelector(".part-retail-span");
  const removeBtn  = row.querySelector(".remove-part");
  const selectorInput = row.querySelector('input[list="row-parts-selector"]');

  // Fill values
  if (nameInput) nameInput.value = name;
  if (qtyInput) qtyInput.value = qty;
  if (nameSpan) nameSpan.textContent = name;
  if (qtySpan) qtySpan.textContent = qty;
  if (costSpan) costSpan.textContent = formatCurrency(cost);
  if (retailSpan) retailSpan.textContent = formatCurrency(retail);

  // ===== Live updates =====
  if (nameInput) {
    nameInput.oninput = () => {
      if (nameSpan) nameSpan.textContent = nameInput.value;
      recalculateTotals(partsContainer);
    };
  }
  if (qtyInput) {
    qtyInput.oninput = () => recalculateTotals(partsContainer);
  }

  // ===== Selector datalist behavior =====
  if (selectorInput) {
    ['mousedown', 'focus'].forEach(evt =>
      selectorInput.addEventListener(evt, () => selectorInput.value = '')
    );

    selectorInput.addEventListener('input', () => {
      if (nameSpan) nameSpan.textContent = selectorInput.value;
      recalculateTotals(partsContainer);
    });
  }

  // Mode visibility
  if (wrapperIsEditing) {
    nameInput?.classList.remove("d-none");
    qtyInput?.classList.remove("d-none");
    nameSpan?.classList.add("d-none");
    qtySpan?.classList.add("d-none");
    if (removeBtn) removeBtn.style.display = "inline-block";
  } else {
    nameInput?.classList.add("d-none");
    qtyInput?.classList.add("d-none");
    nameSpan?.classList.remove("d-none");
    qtySpan?.classList.remove("d-none");
    if (removeBtn) removeBtn.style.display = "none";
  }

  // Always keep cost/retail visible
  costSpan?.classList.remove("d-none");
  retailSpan?.classList.remove("d-none");

  // Remove handler
  if (removeBtn && !row.dataset.removeAttached) {
    removeBtn.addEventListener("click", () => {
      row.remove();
      recalculateTotals(partsContainer);
    });
    row.dataset.removeAttached = "1";
  }

  partsContainer.appendChild(row);
  recalculateTotals(partsContainer);
}

// ----- Recalculate Totals (updated: also updates header total retail and in-stock) -----
function recalculateTotals(partsContainer) {
  if (!partsContainer) return;

  let totalCost = 0;
  let totalRetail = 0;

  partsContainer.querySelectorAll(".part-row").forEach(row => {
    const name = (row.querySelector(".part-input")?.value || "").trim();
    const qty = parseFloat(row.querySelector(".qty-input")?.value) || 0;
    const mat = materialByName[name];
    const unitPrice = mat ? roundUpToStep(mat.unitPrice, 0.05) : 0;
    const cost = unitPrice * qty;
    const retail = cost * 2;

    totalCost += cost;
    totalRetail += retail;

    const costSpan = row.querySelector(".part-cost-span");
    const retailSpan = row.querySelector(".part-retail-span");
    const costInput = row.querySelector(".totalRowCost");
    const retailInput = row.querySelector(".totalRowRetail");

    if (costSpan) costSpan.textContent = formatCurrency(cost);
    if (retailSpan) retailSpan.textContent = formatCurrency(retail);
    if (costInput) {
      costInput.dataset.raw = String(cost || 0);
      if (!costInput.classList.contains("d-none")) {
        costInput.value = formatCurrency(cost || 0);
      }
    }
    if (retailInput) {
      retailInput.dataset.raw = String(retail || 0);
      if (!retailInput.classList.contains("d-none")) {
        retailInput.value = formatCurrency(retail || 0);
      }
    }
  });

  const wrapper = partsContainer.closest(".accordion-item.product-accordion");
  if (wrapper) {
    const costSpan = wrapper.querySelector(".totalCost-body");
    const retailSpan = wrapper.querySelector(".totalRetail-body");
    const retailHeader = wrapper.querySelector(".totalRetail-header");

    if (costSpan) costSpan.textContent = formatCurrency(totalCost);
    if (retailSpan) retailSpan.textContent = formatCurrency(totalRetail);
    if (retailHeader) retailHeader.textContent = formatCurrency(totalRetail);

    const badge = wrapper.querySelector(".partrow-header-display");
    if (badge) {
      badge.textContent = `Parts • ${partsContainer.querySelectorAll(".part-row").length}`;
    }

    const parts = Array.from(partsContainer.querySelectorAll(".part-row")).map(row => ({
      matName: row.querySelector(".part-input")?.value || "",
      qty: parseFloat(row.querySelector(".qty-input")?.value) || 0
    }));
    const stock = calculateInStock({ parts });

    const inStockBody = wrapper.querySelector(".inStockValue-body");
    const inStockHeader = wrapper.querySelector(".inStockValue-header");
    if (inStockBody) inStockBody.textContent = String(stock);
    if (inStockHeader) inStockHeader.textContent = String(stock);
  }

  const addForm = partsContainer.closest("#addProductForm");
  if (addForm) {
    const totalCostSpan = addForm.querySelector(".totalCost-input");
    const totalRetailSpan = addForm.querySelector(".totalRetail-input");

    if (totalCostSpan) totalCostSpan.textContent = formatCurrency(totalCost);
    if (totalRetailSpan) totalRetailSpan.textContent = formatCurrency(totalRetail);
  }
}

function calculateInStock(product) {
  if (!product?.parts?.length) return 0;

  // Step 1: sum up quantities per material
  const totalsByMaterial = {};

  product.parts.forEach(part => {
    const matName = part.matName;
    const qty = parseFloat(part.qty) || 0;
    if (!totalsByMaterial[matName]) totalsByMaterial[matName] = 0;
    totalsByMaterial[matName] += qty;
  });

  // Step 2: find max number of products we can make
  let minStock = Infinity;

  for (const [matName, totalQty] of Object.entries(totalsByMaterial)) {
    const material = materialByName[matName]; // look up by material name
    if (!material || totalQty <= 0) {
      minStock = 0; // missing material → cannot make product
      break;
    }

    const maxByPart = Math.floor((material.onHand || 0) / totalQty);
    if (maxByPart < minStock) minStock = maxByPart;
  }

  return minStock === Infinity ? 0 : minStock;
}

function refreshSearchResults(focusProdID = null) {
  const searchInput = document.getElementById(SELECTORS.searchInput);
  const resultsContainer = document.getElementById(SELECTORS.resultsContainer);
  if (!searchInput || !resultsContainer) return;

  const query = (searchInput.value || "").toLowerCase().trim();
  const words = query.split(/\s+/).filter(Boolean);

  resultsContainer.innerHTML = "";
  renderProductCard(null); // always render Add card first

  const filtered = query
    ? productData.filter(prod =>
        words.every(w =>
          Object.values(prod).some(val => (val?.toString() || "").toLowerCase().includes(w))
        )
      )
    : productData.slice();

  filtered.forEach(p => renderProductCard(p));

  const totalCounter = document.getElementById("totalCounter");
  const searchCounter = document.getElementById("searchCounter");
  if (totalCounter) totalCounter.textContent = String(productData.length);
  if (searchCounter) searchCounter.textContent = String(filtered.length);

  // Scroll the focused product into view
  if (focusProdID) {
    const el = resultsContainer.querySelector(`.accordion-item[data-prod-id="${focusProdID}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function convertGoogleDriveLink(url) {
  if (!url) return url;

  // If it's already a direct image URL, don't touch it
  if (url.match(/\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i)) {
    return url;
  }

  // Try to match Google Drive "file/d/FILE_ID" or "open?id=FILE_ID"
  const driveMatch = url.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]{20,})/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return `https://drive.google.com/thumbnail?id=${fileId}`;
  }

  // Return unchanged if not recognized
  return url;
}
