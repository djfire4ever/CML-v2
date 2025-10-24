// ✅ Data store
let quoteData = [];
let productData = [];

// ✅ Utility: Get or create reusable counter elements
function getOrCreateCounter(id, classList, parent, insertAfter = null) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("span");
    el.id = id;
    el.classList.add(...classList);
    insertAfter
      ? insertAfter.insertAdjacentElement("afterend", el)
      : parent.appendChild(el);
  }
  return el;
}

// ✅ Utility: Switch to Edit Tab
function showEditTab() {
  const editTab = document.querySelector('[data-bs-target="#edit-quote"]');
  if (editTab) new bootstrap.Tab(editTab).show();
}

// ✅ Load search data from backend
function setQuoteDataForSearch() {
  fetch(scriptURL + "?action=getQuoteDataForSearch")
    .then(res => res.json())
    .then(data => quoteData = data.slice())
    .catch(err => console.error("❌ Failed to load quote data:", err));
}

// ✅ Perform live search
function search() {
  const inputEl = document.getElementById("searchInput");
  const resultsBox = document.getElementById("searchResults");
  if (!inputEl || !resultsBox) return;

  let counterContainer = document.getElementById("counterContainer");
  if (!counterContainer) {
    counterContainer = document.createElement("div");
    counterContainer.id = "counterContainer";
    counterContainer.classList.add("d-inline-flex", "gap-3", "align-items-center", "ms-3");
    inputEl.parentNode.insertBefore(counterContainer, inputEl.nextSibling);
  }

  const searchCounter = getOrCreateCounter("searchCounter", ["px-2", "py-1", "border", "rounded", "fw-bold", "bg-dark", "text-info"], counterContainer);
  const totalCounter = getOrCreateCounter("totalCounter", ["px-2", "py-1", "border", "rounded", "fw-bold", "bg-dark", "text-info"], counterContainer, searchCounter);

  toggleLoader();

  const input = inputEl.value.toLowerCase().trim();
  const words = input.split(/\s+/);
  const cols = [0, 1, 2, 3, 4, 5];

  const results = input === "" ? [] : quoteData.filter(row =>
    words.every(word => cols.some(i => row[i]?.toString().toLowerCase().includes(word)))
  );

  searchCounter.textContent = input === "" ? "🔍" : `${results.length} Quotes Found`;
  totalCounter.textContent = `Total Quotes: ${quoteData.length}`;
  resultsBox.innerHTML = "";

  const template = document.getElementById("rowTemplate").content;
  results.forEach(r => {
    const row = template.cloneNode(true);
    row.querySelector(".qtID").textContent = r[0];
    row.querySelector(".firstName").textContent = r[3];
    row.querySelector(".lastName").textContent = r[4];
    row.querySelector(".eventDate").textContent = formatDateForUser(r[10]);

    const tr = row.querySelector("tr");
    tr.dataset.quoteid = r[0];

    const deleteBtn = row.querySelector(".delete-button");
    const confirmBtn = row.querySelector(".before-delete-button");
    if (deleteBtn) deleteBtn.dataset.quoteid = r[0];
    if (confirmBtn) confirmBtn.dataset.quoteid = r[0];

    resultsBox.appendChild(row);
  });

  toggleLoader();
}

// ✅ Handle search result interactions
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const searchTabButton = document.querySelector('button[data-bs-target="#search-quote"]');
  const searchResultsBox = document.getElementById("searchResults");
  const searchCounter = document.getElementById("searchCounter");

  // 🔍 Setup search input
  if (searchInput) {
    searchInput.addEventListener("input", search);
  } else {
    console.error("❌ Search input not found!");
  }

  // 🧹 Clear search box when opening tab
  if (searchTabButton) {
    searchTabButton.addEventListener("shown.bs.tab", () => {
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      if (searchResultsBox) searchResultsBox.innerHTML = "";
      if (searchCounter) {
        searchCounter.textContent = "";
        searchCounter.classList.add("text-success", "text-dark", "fw-bold");
      }
    });
  }

  if (searchResultsBox) {
    searchResultsBox.innerHTML = "";

    // 🔎 Handle click inside search results table
    searchResultsBox.addEventListener("click", event => {
      const target = event.target;
      const row = target.closest("tr");

      if (row && row.dataset.quoteid && !target.closest(".btn-group")) {
        const qtID = row.dataset.quoteid.trim();
        console.log("🔍 Selected quote ID:", qtID);
        populateEditForm(qtID);
        showEditTab();
      }
    });
  }

  toggleLoader();
  setQuoteDataForSearch();
  setTimeout(toggleLoader, 500);

  // 🧮 Watch key fields to recalculate totals
  const fieldsToWatch = [
    "edit-deliveryFee", "add-deliveryFee", "edit-setupFee", "add-setupFee", 
    "edit-otherFee", "add-otherFee", "edit-discount", "add-discount", 
    "edit-deposit", "add-deposit", "edit-amountPaid", "add-amountPaid",
    "add-phone", "edit-phone", "add-eventDate", "edit-eventDate"
  ];

  fieldsToWatch.forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      const mode = id.startsWith("add") ? "add" : "edit";
      calculateAllTotals(mode);
    });
  });

  // 🧩 Reattach product row event handlers
  document.querySelectorAll(".product-row").forEach(row => {
    const mode = row.closest("#add-product-rows-container") ? "add" : "edit";
    attachRowEvents(row, mode);
  });

  // 💾 Add/Edit quote save buttons
  ["add", "edit"].forEach(mode => {
    const productBtn = document.getElementById(`${mode}-product-btn`);
    if (productBtn) {
      productBtn.removeEventListener("click", mode === "add" ? handleAddProductClick : handleEditProductClick);
      productBtn.addEventListener("click", mode === "add" ? handleAddProductClick : handleEditProductClick);
    }

    const quoteBtn = document.getElementById(`${mode}-quote-btn`);
    if (quoteBtn) {
      quoteBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`🟢 ${mode === "add" ? "Add" : "Edit"} Quote button clicked`);
        await handleSave(e, mode);
      });
    }
  });

  // ➕ Add tab logic: initialize form, preview/finalize buttons
  const addTabButton = document.querySelector('button[data-bs-target="#add-quote"]');
  if (addTabButton) {
    addTabButton.addEventListener("shown.bs.tab", () => {
      console.log("🟢 [Add Tab] Shown");

      if (typeof productData === "undefined") {
        console.warn("⏳ Skipping form init — productData not ready");
      } else {
        initializeAddForm();
      }

      const previewBtn = document.getElementById("add-previewQuoteBtn");
      if (previewBtn && !previewBtn.dataset.bound) {
        previewBtn.addEventListener("click", previewQuoteBtnHandler);
        previewBtn.dataset.bound = "true";
      }

      const finalizeBtn = document.getElementById("add-finalizeInvoiceBtn");
      if (finalizeBtn && !finalizeBtn.dataset.bound) {
        finalizeBtn.addEventListener("click", finalizeInvoiceBtnHandler);
        finalizeBtn.dataset.bound = "true";
      }

      const addEmailBtn = document.getElementById("add-emailInvoiceBtn");
      if (addEmailBtn && !addEmailBtn.dataset.bound) {
        addEmailBtn.addEventListener("click", () => {
          // Collect Add form fields
          const emailTo = document.getElementById("add-email")?.value || "";
          const invoiceUrl = document.getElementById("add-invoiceUrl")?.value || "";
          const firstName = document.getElementById("add-firstName")?.value || "";
          const lastName = document.getElementById("add-lastName")?.value || "";

          const emailHtml = generateInvoiceEmailHtml(`${firstName} ${lastName}`.trim(), invoiceUrl);

          document.getElementById("invoice-email-to").value = emailTo;
          document.getElementById("invoice-email-subject").value = "Your Final Invoice from Your Company";
          document.getElementById("invoice-email-body").innerHTML = emailHtml;

          const modalEl = document.getElementById("finalInvoiceModal");
          const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
          modal.show();
        });
        addEmailBtn.dataset.bound = "true";
      }
    });
  } else {
    console.warn("❌ Add tab button not found in DOM");
  }
});

async function populateEditForm(qtID) {
  try {
    toggleLoader(true);
    console.log("🔄 Loading quote data for qtID:", qtID);

    await getProdDataForSearch();
    setField("edit-qtID", qtID);
    document.querySelector("#edit-qtID")?.setAttribute("readonly", true);

    const response = await fetch(`${scriptURL}?action=getQuoteById&qtID=${qtID}`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const data = await response.json();
    if (!data || data.error) throw new Error(data.error || "No data returned");

    // ✅ Fill form fields — grouped by card
    ["phone", "firstName", "lastName", "street", "email", "city", "state", "zip"]
      .forEach(id => setField(`edit-${id}`, data[id] || ""));

    setField("edit-eventDate", formatDateForUser(data.eventDate));
    setField("edit-eventLocation", data.eventLocation || "");
    setField("edit-eventNotes", data.eventNotes || "");
    setField("edit-eventTheme", data.eventTheme || "");

    ["deliveryFee", "setupFee", "otherFee", "addonsTotal"]
      .forEach(id => setField(`edit-${id}`, data[id] || 0));

    setField("edit-deposit", data.deposit || "");
    setField("edit-amountPaid", data.amountPaid || "");
    setField("edit-balanceDue", data.balanceDue || "");
    setField("edit-paymentMethod", data.paymentMethod || "");

    setField("edit-depositDate", formatDateForUser(data.depositDate));
    setField("edit-balanceDueDate", formatDateForUser(data.balanceDueDate));
    setField("edit-dueDate", formatDateForUser(data.dueDate));

    ["discount", "subTotal1", "subTotal2", "subTotal3", "discountedTotal", "grandTotal"]
      .forEach(id => setField(`edit-${id}`, data[id] || 0));

    // 🧱 Product Rows
    const container = document.querySelector("#edit-product-rows-container");
    if (container) container.innerHTML = "";

    if (Array.isArray(data.products)) {
      data.products.forEach(product => {
        addProductRow(
          product.name || "",
          product.quantity || "",
          "edit-product-rows-container",
          "edit",
          product.unitPrice || "",
          product.totalRowRetail || ""
        );
      });
    }

    // Hidden/Meta Fields
    [
      "totalProductCost", "totalProductRetail", "productCount", "quoteDate",
      "quoteNotes", "invoiceID", "invoiceDate", "invoiceUrl"
    ].forEach(id => {
      let val = data[id] || "";
      if (id === "quoteDate" || id === "invoiceDate") val = formatDateForUser(val);
      setField(`edit-${id}`, val);
    });

    // 🔢 Recalculate totals and update headers
    calculateAllTotals("edit");
    updateCardHeaders("edit");

    // 👁️ Reveal and scroll to Edit tab
    const tabPane = document.querySelector("#edit-quote");
    if (tabPane) {
      tabPane.classList.remove("d-none");
      tabPane.scrollIntoView({ behavior: "smooth" });
    }

    // 🧷 Bind action buttons (only once)
    const previewBtn = document.getElementById("edit-previewQuoteBtn");
    const finalizeBtn = document.getElementById("edit-finalizeInvoiceBtn");
    const emailBtn = document.getElementById("edit-emailInvoiceBtn");

    if (previewBtn && !previewBtn.dataset.bound) {
      previewBtn.addEventListener("click", previewQuoteBtnHandler);
      previewBtn.dataset.bound = "true";
    }

    if (finalizeBtn && !finalizeBtn.dataset.bound) {
      finalizeBtn.addEventListener("click", finalizeInvoiceBtnHandler);
      finalizeBtn.dataset.bound = "true";
    }

    if (emailBtn && !emailBtn.dataset.bound) {
      emailBtn.addEventListener("click", () => showEmailModal({
        type: "finalInvoice",
        mode: "edit"
      }));
      emailBtn.dataset.bound = "true";
    }

    // ✅ Update invoice-related UI
    updateInvoiceUI(data);

    console.log("✅ Edit form populated and buttons bound");

  } catch (error) {
    console.error("❌ Failed to populate edit form:", error);
    showToast("❌ Error loading quote data!", "error");
  } finally {
    toggleLoader(false);
  }
}

function updateInvoiceUI(data, mode = "edit") {
  const finalized = !!(data?.url || data?.invoiceID);
  const prefix = mode === "add" ? "add" : "edit";

  const finalizeBtn = document.getElementById(`${prefix}-finalizeInvoiceBtn`);
  const emailBtn = document.getElementById(`${prefix}-emailInvoiceBtn`);
  const finalizeAlert = document.getElementById(`${prefix}-finalizeInvoice-alert`);
  const emailAlert = document.getElementById(`${prefix}-emailInvoice-alert`);

  // Finalize Invoice button enabled only if NOT finalized
  if (finalizeBtn) finalizeBtn.disabled = finalized;

  // Email Invoice button enabled only if finalized
  if (emailBtn) emailBtn.disabled = !finalized;

  // Show finalize alert only if finalized (i.e., Finalize button is disabled)
  if (finalizeAlert) finalizeAlert.classList.toggle("d-none", !finalized);

  // Show email alert only if NOT finalized (i.e., Email button is disabled)
  if (emailAlert) emailAlert.classList.toggle("d-none", finalized);
}

async function handleSave(event, mode) {
  try {
    if (!event || !mode) throw new Error("Missing event or mode");

    const btnID = event.target?.id;
    const expectedID = mode === "add" ? "add-quote-btn" : "edit-quote-btn";
    if (btnID !== expectedID) {
      console.warn(`⚠️ Ignoring save triggered by unexpected element: ${btnID}`);
      return;
    }

    toggleLoader(true);
    console.log(`📤 Saving quote in mode: ${mode}`);

    calculateAllTotals(mode);
    const quoteData = collectQuoteFormData(mode);
    console.log("📦 Data sent to backend:", quoteData);

    const response = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "quotes",
        action: mode,
        qtID: mode === "edit" ? getField("edit-qtID") : null,
        quoteInfo: quoteData
      })
    });

    const result = await response.json();
    
    const saveSuccess = mode === "add"
      ? !!(result.data && result.data.qtID)
      : !!(result.data && result.data.success);
    if (saveSuccess) {
      showToast("✅ Quote saved successfully!");
      document.querySelector("#searchInput").value = "";
      document.querySelector("#searchResults").innerHTML = "";
      setQuoteDataForSearch();
      document.querySelector('[data-bs-target="#search-quote"]')?.click();
    } else {
      throw new Error(result.message || "Unknown backend error");
    }
  } catch (error) {
    console.error("❌ Error saving quote:", error);
    showToast("❌ Failed to save quote!", "error");
  } finally {
    toggleLoader(false);
  }
}

// 🔁 1. Collect Quote Form Data (for saving)
function collectQuoteFormData(mode) {
  const get = (id) => getField(`${mode}-${id}`);
  const rawPhone = get("phone").replace(/\D/g, "");

  const formData = {
    phone: rawPhone,
    firstName: get("firstName"),
    lastName: get("lastName"),
    email: get("email"),
    street: get("street"),
    city: get("city"),
    state: get("state"),
    zip: get("zip"),
    eventDate: get("eventDate"),
    eventLocation: get("eventLocation"),
    eventNotes: get("eventNotes"),
    eventTheme: get("eventTheme"),
    deliveryFee: parseCurrency(get("deliveryFee")),
    setupFee: parseCurrency(get("setupFee")),
    otherFee: parseCurrency(get("otherFee")),
    addonsTotal: parseCurrency(get("addonsTotal")),
    deposit: parseCurrency(get("deposit")),
    amountPaid: parseCurrency(get("amountPaid")),
    depositDate: get("depositDate"),
    balanceDue: parseCurrency(get("balanceDue")),
    balanceDueDate: get("balanceDueDate"),
    paymentMethod: get("paymentMethod"),
    dueDate: get("dueDate"),
    discount: parseCurrency(get("discount")),
    subTotal1: parseCurrency(get("subTotal1")),
    subTotal2: parseCurrency(get("subTotal2")),
    subTotal3: parseCurrency(get("subTotal3")),
    discountedTotal: parseCurrency(get("discountedTotal")),
    grandTotal: parseCurrency(get("grandTotal")),
    totalProductCost: parseCurrency(get("totalProductCost")),
    totalProductRetail: parseCurrency(get("totalProductRetail")),
    quoteNotes: get("quoteNotes"),
    invoiceID: "",
    invoiceDate: "",
    invoiceUrl: ""
  };

  const rows = document.querySelectorAll(`#${mode}-product-rows-container .product-row`);
  const products = [];

  // ...inside collectQuoteFormData()...
  rows.forEach(row => {
    const name = row.querySelector(".product-name")?.value.trim();
    const qty = parseFloat(row.querySelector(".product-quantity")?.value.trim() || 0);
    const unitPrice = parseCurrency(row.querySelector(".totalRowCost")?.value || 0);
    const totalRowRetail = parseCurrency(row.querySelector(".totalRowRetail")?.value || 0);
  
    if (name && qty > 0) {
      products.push({
        name,
        quantity: qty,
        unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
        totalRowRetail: isNaN(totalRowRetail) ? 0 : totalRowRetail
      });
    }
  });

  formData.productCount = products.length;
  formData.prodJSON = JSON.stringify(products);
  
  for (let i = 1; i <= 15; i++) {
    const p = products[i - 1] || {};
    formData[`part${i}`] = p.name || "";
    formData[`qty${i}`] = p.quantity || "";
    formData[`unitPrice${i}`] = p.unitPrice || "";
    formData[`totalRowRetail${i}`] = p.totalRowRetail || "";
  }

  return formData;
}

async function initializeAddForm() {
  try {
    toggleLoader(true);
    console.log("📋 Initializing Add Quote form");

    // ✅ Ensure product data is available
    if (!Array.isArray(productData) || productData.length === 0) {
      console.warn("⚠️ productData not ready, fetching...");
      await getProdDataForSearch(true);
    }

    // 🧼 Clear all Add form fields
    const fieldsToClear = [
      "phone", "firstName", "lastName", "email", "street", "city", "state", "zip",
      "eventDate", "eventLocation", "eventNotes", "eventTheme",
      "deliveryFee", "setupFee", "otherFee", "addonsTotal",
      "deposit", "depositDate", "balanceDue", "balanceDueDate",
      "paymentMethod", "quoteNotes", "discount",
      "grandTotal", "totalProductCost", "totalProductRetail"
    ];

    fieldsToClear.forEach(id => setField(`add-${id}`, ""));
    resetProductRows("add-product-rows-container");

    // 📦 Load supporting data
    await Promise.all([
      setQuoteDataForSearch(),
      loadDropdowns()
    ]);

    calculateAllTotals("add");
    updateCardHeaders("add");

    console.log("✅ Add Quote form initialized");

    // 🧷 Bind buttons (one-time)
    const previewBtn = document.getElementById("add-previewQuoteBtn");
    const finalizeBtn = document.getElementById("add-finalizeInvoiceBtn");
    const emailBtn = document.getElementById("add-emailInvoiceBtn");

    if (previewBtn && !previewBtn.dataset.bound) {
      previewBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("👁️ Preview button clicked (add)");
        await previewQuote("add");
      });
      previewBtn.dataset.bound = "true";
      console.log("🔗 Bound add-previewQuoteBtn");
    }

    if (finalizeBtn && !finalizeBtn.dataset.bound) {
      finalizeBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("✅ Finalize button clicked (add)");
        await finalizeInvoice("add");
      });
      finalizeBtn.dataset.bound = "true";
      console.log("🔗 Bound add-finalizeInvoiceBtn");
    }

    if (emailBtn && !emailBtn.dataset.bound) {
      emailBtn.addEventListener("click", () => {
        showEmailModal({ type: "finalInvoice", mode: "add" });
      });
      emailBtn.dataset.bound = "true";
      console.log("🔗 Bound add-emailInvoiceBtn");
    }

    // ✅ Update invoice-related UI
    updateInvoiceUI({}, "add");

  } catch (err) {
    console.error("❌ Error initializing Add Quote form:", err);
    showToast("❌ Could not initialize form", "error");
  } finally {
    toggleLoader(false);
  }
}

// 🔁 4. Client autofill on phone change
document.querySelector("#add-phone")?.addEventListener("change", async (e) => {
  e.stopPropagation();
  const clientID = getField("add-phone");

  if (!clientID) return;

  try {
    const res = await fetch(`${scriptURL}?action=getClientById&clientID=${encodeURIComponent(clientID)}`);
    const client = await res.json();

    if (!client.error) {
      setField("add-firstName", client.firstName);
      setField("add-lastName", client.lastName);
      setField("add-email", client.email);
      setField("add-street", client.street);
      setField("add-city", client.city);
      setField("add-state", client.state);
      setField("add-zip", client.zip);
    } else {
      ["firstName", "lastName", "email", "street", "city", "state", "zip"]
        .forEach(field => setField(`add-${field}`, ""));
      showToast(client.error, "warning");
    }

    updateCardHeaders("add");

  } catch (err) {
    console.error("❌ Error fetching client data:", err);
    showToast("❌ Failed to load client info", "error");
  }
});

// 🔁 5. Load product data from backend (used globally)
async function getProdDataForSearch(forceRefresh = false) {
  try {
    if (!forceRefresh) {
      const cached = localStorage.getItem("productData");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            productData = parsed.slice();  // Create a copy
            console.log("💾 Loaded productData from localStorage");
            return;
          }
        } catch (e) {
          console.warn("⚠️ Failed to parse productData from localStorage:", e);
        }
      }
    }

    // Fetch from server if no cache or forceRefresh is true
    const response = await fetch(`${scriptURL}?action=getProdDataForSearch`);
    if (!response.ok) throw new Error(`Status: ${response.status}`);

    const rawData = await response.json();
    productData = [];

    rawData.forEach(row => {
      const id = String(row[0] || "").trim();            // prodID
      const name = String(row[1] || "").trim();          // productName
      const cost = parseFloat(row[6]) || 0;              // cost is column 7
      const retail = parseFloat(row[7]) || 0;            // retail is column 8

      if (id && name) {
        productData.push({
          prodID: id,
          name,
          cost,
          retail
        });
      }
    });

    localStorage.setItem("productData", JSON.stringify(productData));
    console.log("✅ Product data loaded from server and cached");

  } catch (err) {
    console.error("❌ Failed to load product data:", err);
    throw err;
  }
}

// 🔁 6. Add Product Row Handler
function handleAddProductClick() {
  console.log("➕ Add Product clicked");
  addProductRow("", 1, "add-product-rows-container", "add");
}

// 🔁 7. Prevent propagation from dropdown/collapse elements
document.querySelectorAll(".product-name")?.forEach((el) =>
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    console.log("🟢 Product dropdown clicked");
  })
);

function addProductRow(
  name = "",
  qty = 1,
  containerId = "add-product-rows-container",
  mode = "add",
  unitRetail = 0,
  totalRetail = 0
) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const row = document.createElement("div");
  row.classList.add("row", "g-2", "align-items-center", "mb-1", "product-row");

  const optionsHTML = Object.values(productData || {}).map(p => {
    const selected = p.name === name ? " selected" : "";
    return `<option value="${p.name.replace(/"/g, '&quot;')}"${selected}>${p.name}</option>`;
  }).join("");

  const formattedUnitRetail = `$${parseFloat(unitRetail || 0).toFixed(2)}`;
  const formattedTotalRetail = `$${parseFloat(totalRetail || 0).toFixed(2)}`;

  row.innerHTML = `
    <div class="col-md-6">
      <select class="form-select product-name">
        <option value="">Choose a product...</option>
        ${optionsHTML}
      </select>
    </div>
    <div class="col-md-1">
      <input type="number" class="form-control text-start product-quantity" value="${qty}">
    </div>
    <div class="col-md-2">
      <input type="text" class="form-control text-end totalRowCost" value="${formattedUnitRetail}" readonly>
    </div>
    <div class="col-md-2">
      <input type="text" class="form-control text-end totalRowRetail" value="${formattedTotalRetail}" readonly>
    </div>
    <div class="col-md-1">
      <button type="button" class="btn btn-danger btn-sm remove-part">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  attachRowEvents(row, mode);
  calculateAllTotals(mode);
}

function handleEditProductClick() {
  addProductRow("", 1, "edit-product-rows-container", "edit");
}

function resetProductRows(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  const mode = containerId.startsWith("add") ? "add" : "edit";
  addProductRow("", 1, containerId, mode);
}

function attachRowEvents(row, mode = "edit") {
  const nameInput = row.querySelector(".product-name");
  const qtyInput = row.querySelector(".product-quantity");
  const costOutput = row.querySelector(".totalRowCost");
  const retailOutput = row.querySelector(".totalRowRetail");
  const deleteBtn = row.querySelector(".remove-part");

  function updateTotals() {
    const name = nameInput.value.trim();
    const qty = parseInt(qtyInput.value) || 0;
    const prod = productData?.[name] || Object.values(productData).find(p => p.name === name);

    if (prod && qty > 0) {
      // Round unit price up to next $0.10
      const roundedUnitPrice = Math.ceil((parseFloat(prod.cost || 0)) * 10) / 10;
      const rowCost = roundedUnitPrice * qty;
      const rowRetail = rowCost * 2;
      costOutput.value = `$${rowCost.toFixed(2)}`;
      retailOutput.value = `$${rowRetail.toFixed(2)}`;
    } else {
      costOutput.value = "$0.00";
      retailOutput.value = "$0.00";
    }

    calculateAllTotals(mode);
  }

  nameInput.addEventListener("change", updateTotals);
  qtyInput.addEventListener("change", updateTotals);
  deleteBtn.addEventListener("click", () => {
    row.remove();
    calculateAllTotals(mode);
  });

  updateTotals();
}

function calculateAllTotals(mode = "edit") {
  const prefix = mode === "add" ? "add-" : "edit-";

  let totalProductCost = 0;
  let totalProductRetail = 0;

  const parseCurrency = val => parseFloat(String(val || "0").replace(/[^0-9.-]+/g, "")) || 0;

  document.querySelectorAll(`#${prefix}product-rows-container .product-row`).forEach(row => {
    const name = row.querySelector(".product-name")?.value.trim() || "";
    const qty = parseFloat(row.querySelector(".product-quantity")?.value) || 0;
    const prod = productData?.[name] || Object.values(productData).find(p => p.name === name);
    if (prod && qty > 0) {
      // Use rounded unit price for cost and retail
      const roundedUnitPrice = Math.ceil((parseFloat(prod.cost || 0)) * 10) / 10;
      const rowCost = roundedUnitPrice * qty;
      const rowRetail = rowCost * 2;
      totalProductCost += rowCost;
      totalProductRetail += rowRetail;
    }
  });

  const productCount = document.querySelectorAll(`#${prefix}product-rows-container .product-row`).length;
  const countEl = document.getElementById(`${prefix}productCount`);
  if (countEl) countEl.value = productCount;

  const deliveryFee = parseCurrency(document.getElementById(`${prefix}deliveryFee`)?.value);
  const setupFee = parseCurrency(document.getElementById(`${prefix}setupFee`)?.value);
  const otherFee = parseCurrency(document.getElementById(`${prefix}otherFee`)?.value);
  const discount = parseCurrency(document.getElementById(`${prefix}discount`)?.value);
  const deposit = parseCurrency(document.getElementById(`${prefix}deposit`)?.value);
  const amountPaidEl = document.getElementById(`${prefix}amountPaid`);
  const amountPaid = parseCurrency(amountPaidEl?.value);

  const hasAmountPaid = amountPaidEl && amountPaid > 0;

  const addonsTotal = deliveryFee + setupFee + otherFee;
  const subTotal1 = totalProductRetail * 0.08875; // tax
  const subTotal2 = totalProductRetail + subTotal1;
  const subTotal3 = totalProductRetail * (discount / 100);
  const discountedTotal = subTotal2 - subTotal3;
  const grandTotal = discountedTotal + addonsTotal;
  const balanceDue = grandTotal - (hasAmountPaid ? amountPaid : deposit);

  const updateField = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });
    if (el.tagName === "INPUT") {
      el.value = formatter.format(value);
    } else {
      el.textContent = formatter.format(value);
    }
  };

  // Update totals in DOM
  updateField(`${prefix}addonsTotal`, addonsTotal);
  updateField(`${prefix}addonsTotal-totals`, addonsTotal);
  updateField(`${prefix}grandTotal`, grandTotal);
  updateField(`${prefix}grandTotal-Addons`, grandTotal);
  updateField(`${prefix}grandTotal-Summary`, grandTotal);
  updateField(`${prefix}balanceDue`, balanceDue);
  updateField(`${prefix}totalProductCost`, totalProductCost);
  updateField(`${prefix}totalProductRetail`, totalProductRetail);
  updateField(`${prefix}subTotal1`, subTotal1);
  updateField(`${prefix}subTotal2`, subTotal2);
  updateField(`${prefix}subTotal3`, subTotal3);
  updateField(`${prefix}discountedTotal`, discountedTotal);
  // updateField(`${prefix}amountPaid`, amountPaid); // ✅ Format & show amountPaid

  // Update Card 7 header
  const productCountEl = document.getElementById(`${prefix}product-count`);
  const productTotalEl = document.getElementById(`${prefix}product-total`);

  if (productCountEl && productTotalEl) {
    const retailFormatted = totalProductRetail.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });

    productCountEl.textContent = productCount;
    productTotalEl.textContent = retailFormatted.replace("$", ""); // strip $ if you already have it in HTML
  }

  updateCardHeaders(mode);
}

function updateCardHeaders(mode = "edit") {
  const prefix = mode === "add" ? "add-" : "edit-";

  const formatCurrency = val => {
    const parsed = parseFloat(val.replace(/[^0-9.-]+/g, "")) || 0;
    return parsed.toLocaleString("en-US", { style: "currency", currency: "USD" });
  };

  updateDisplayText(`${prefix}card1-header-display`, `${getField(`${prefix}firstName`)} ${getField(`${prefix}lastName`)}`.trim(), "Add Client");
  updateDisplayText(`${prefix}card2-header-display`, getField(`${prefix}eventDate`) || "Add Event Info");
  updateDisplayText(`${prefix}card3-header-display`, formatCurrency(getField(`${prefix}grandTotal`)));
  updateDisplayText(`${prefix}card4-header-display`, formatCurrency(getField(`${prefix}addonsTotal`)));
  updateDisplayText(`${prefix}card5-header-display`, formatCurrency(getField(`${prefix}balanceDue`)));
  updateDisplayText(`${prefix}card6-header-display`, formatCurrency(getField(`${prefix}grandTotal`)));

  updateDisplayText(`${prefix}totalProductCost`, formatCurrency(getField(`${prefix}totalProductCost`)));
  updateDisplayText(`${prefix}totalProductRetail`, formatCurrency(getField(`${prefix}totalProductRetail`)));
}

function updateDisplayText(id, value, fallback = "") {
  const el = document.getElementById(id);
  if (el) el.textContent = value || fallback;
}

function getField(id) {
  const el = document.getElementById(id);
  if (!el) return "0";
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" ? el.value : el.textContent;
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  // Handle input or textarea fields
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    el.value = value;
  } else {
    // Fallback for <span>, <div>, etc.
    el.textContent = value;
  }
}

function recalculateAndUpdateHeaders(mode = "edit") {
  calculateAllTotals(mode);
  updateCardHeaders(mode);
}

function formatPhoneNumber(number) { // This function is in
  const digits = number.replace(/\D/g, "");
  if (digits.length !== 10) return number;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
}

function parseCurrency(val) {
  return parseFloat(String(val || "0").replace(/[^0-9.-]+/g, "")) || 0;
}

// === Preview Quote Handler ===
function previewQuoteBtnHandler(e) {
  e.preventDefault();
  e.stopPropagation();

  const btnID = e.target.id;
  const mode = btnID.startsWith("edit") ? "edit" : "add";
  console.log("🔍 previewQuoteBtnHandler triggered for mode:", mode);

  toggleLoader(true);
  const newTab = window.open("", "_blank");

  try {
    calculateAllTotals(mode);
    const quoteInfo = collectQuoteFormData(mode);
    console.log("📦 Preview data being sent to backend:", quoteInfo);

    fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "invoice",
        action: "preview",
        qtID: mode === "edit" ? getField("edit-qtID") : null,
        quoteInfo
      })
    })
    .then(response => response.json())
    .then(result => {
      console.log("✅ Backend preview response:", result);

      if (result.success && result.data?.url) {
        newTab.location.href = result.data.url;
      } else {
        newTab.document.write("<p>❌ Failed to generate preview.</p>");
        showToast("❌ Preview failed: " + (result.data?.message || "No URL returned"), "error");
        setTimeout(() => newTab.close(), 5000);
      }
    })
    .catch(err => {
      newTab.document.write("<p>❌ Error generating preview.</p>");
      console.error("❌ Fetch error:", err);
      showToast("❌ Error during preview request. Check console.", "error");
    })
    .finally(() => toggleLoader(false));
  } catch (err) {
    newTab.document.write("<p>❌ Error generating preview.</p>");
    console.error("❌ Unexpected error:", err);
    showToast("❌ Unexpected error. Check console.", "error");
    toggleLoader(false);
  }
}

// === Finalize Quote Handler ===
document.body.addEventListener("click", (e) => {
  if (e.target.matches("#add-finalizeInvoiceBtn, #edit-finalizeInvoiceBtn")) {
    e.preventDefault();
    finalizeInvoiceBtnHandler(e);
  }
});

async function finalizeInvoiceBtnHandler(e) {
  e.preventDefault();
  e.stopPropagation();

  const btnID = e.target.id;
  const mode = btnID.startsWith("edit") ? "edit" : "add";
  const qtID = mode === "edit" ? getField("edit-qtID") : null;

  console.log("🧾 Finalizing invoice, mode:", mode);
  toggleLoader(true);

  try {
    // Step 1: Gather quote data
    calculateAllTotals(mode);
    const quoteInfo = collectQuoteFormData(mode);

    if (!quoteInfo || typeof quoteInfo !== "object") {
      throw new Error("❌ Invalid quote data.");
    }

    // Step 2: Save the quote
    const quoteSaveRes = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "quotes",
        action: mode,
        qtID,
        quoteInfo
      })
    });

    const quoteSaveRaw = await quoteSaveRes.json();
    const quoteSaveData = quoteSaveRaw?.data?.data || quoteSaveRaw?.data || {};
    const savedQtID = quoteSaveData.qtID;

    if (!savedQtID) {
      throw new Error("❌ No qtID returned after saving.");
    }

    console.log("✅ Quote saved:", quoteSaveRaw);

    // Step 3: Finalize the invoice
    const finalizeRes = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "invoice",
        action: "finalize",
        qtID: savedQtID,
        quoteInfo
      })
    });

    const finalizeRaw = await finalizeRes.json();
    const invoiceData = finalizeRaw?.data?.data || finalizeRaw?.data || {};
    const invoiceURL = invoiceData.url;

    if (!invoiceURL) {
      throw new Error("❌ Invoice URL not returned.");
    }

    console.log("🧪 Invoice finalized:", invoiceData);

    // Step 4: Auto-create calendar event
    const eventInfo = {
      title: `Event: ${quoteInfo.firstName || ""} ${quoteInfo.lastName || ""}`.trim(),
      start: quoteInfo.eventDate,
      end: quoteInfo.eventDate,
      allDay: true,
      status: quoteInfo.deposit > 0 ? "confirmed" : "scheduled",
      category: "Quote",
      description: quoteInfo.eventNotes || "",
      color: "" // Optional: use default or add a color key
    };

    const calRes = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "calendar",
        action: "addEvent",
        eventInfo
      })
    });

    const calData = await calRes.json();
    console.log("📅 Calendar event created:", calData);

    // Step 5: Update form fields & UI with invoice info
    setField("edit-invoiceID", invoiceData.invoiceID || "");
    setField("edit-invoiceDate", formatDateForUser(invoiceData.invoiceDate) || "");
    setField("edit-invoiceUrl", invoiceURL);

    updateInvoiceUI(invoiceData);

    // *** Removed email modal step here ***

    showToast("📄 Invoice finalized and calendar event created.", "success");

  } catch (err) {
    console.error("❌ Finalization failed:", err);
    showToast("❌ Error finalizing invoice. See console.", "error");
  } finally {
    toggleLoader(false);
  }
}

// Email send button handler (assumes you have this button in the modal)
document.getElementById("send-invoice-email").addEventListener("click", async function (e) {
  e.preventDefault();

  const to = document.getElementById("invoice-email-to")?.value?.trim();
  const subject = document.getElementById("invoice-email-subject")?.value?.trim();
  const body = document.getElementById("invoice-email-body")?.innerHTML?.trim();
  const qtID = document.getElementById("edit-qtID")?.value?.trim();

  if (!to || !subject || !body) {
    showToast("⚠️ Please complete the email fields before sending.", "warning");
    return;
  }

  toggleLoader(true);

  try {
    const res = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "invoice",
        action: "sendInvoiceEmail",
        to,
        subject,
        body,
        qtID
      })
    });

    const result = await res.json();
    console.log("📬 Email send response:", result);

    if (result.success) {
      showToast("✅ Email sent successfully");
      bootstrap.Modal.getInstance(document.getElementById("finalInvoiceModal"))?.hide();
    } else {
      showToast(`❌ ${result.data?.error || "Email failed to send."}`, "error");
    }
  } catch (err) {
    console.error("❌ Send email request failed:", err);
    showToast("❌ Failed to send email. Check console.", "error");
  } finally {
    toggleLoader(false);
  }
});

// Shopping list
document.getElementById("btn-show-shopping-list").addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const qtID = document.querySelector("#edit-qtID")?.value;
  if (!qtID) {
    showToast("❌ Missing quote ID — cannot generate shopping list.", "error");
    return;
  }

  toggleLoader(true);

  try {
    const res = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "quotes",
        action: "getShoppingList",
        qtID: qtID
      })
    });

    if (!res.ok) throw new Error(`Server responded with status ${res.status}`);

    const data = await res.json();
    console.log("✅ Shopping list data:", data);

    if (!data.success) {
      showToast("❌ " + (data.message || "Failed to generate shopping list"), "error");
      return;
    }

    renderShoppingListModal(data.materials);

  } catch (err) {
    console.error("❌ Error generating shopping list:", err);
    showToast("❌ Failed to load shopping list", "error");
  } finally {
    toggleLoader(false);
  }
});

function renderShoppingListModal(materials) {
  const tbody = document.getElementById("shopping-list-body");
  tbody.innerHTML = "";

  materials.forEach(mat => {
    const totalNeeded = parseFloat(mat.totalNeeded) || 0;
    const onHand = parseFloat(mat.onHand) || 0;
    const incoming = parseFloat(mat.incoming || 0);
    const outgoing = parseFloat(mat.outgoing || 0);
    const reorderLevel = parseFloat(mat.reorderLevel || 0);
    const unitType = mat.unitType || "unit(s)";
    const netAvailable = onHand + incoming - outgoing;
    const shortfall = totalNeeded > netAvailable;
    const needsReorder = netAvailable < reorderLevel;

    const row = document.createElement("tr");

    if (mat.supplierUrl) {
      row.style.cursor = "pointer";
      row.title = "Click to open supplier page";
      row.addEventListener("click", () => {
        window.open(mat.supplierUrl, "_blank");
      });
    }

    row.innerHTML = `
      <td>${mat.matName || "❓ Unknown"}</td>
      <td>${totalNeeded.toFixed(0)} ${unitType}</td>
      <td>${onHand.toFixed(0)} ${unitType}</td>
      <td>
        ${shortfall 
          ? `<span class="text-danger fw-bold">Shortfall</span>` 
          : `<span class="text-success">OK</span>`}
      </td>
      <td>${mat.supplier || "—"}</td>
      <td>
        ${needsReorder 
          ? `<span class="text-warning fw-bold">⚠️ Reorder Needed</span>` 
          : `<span class="text-muted">—</span>`}
      </td>
    `;

    tbody.appendChild(row);
  });

  new bootstrap.Modal(document.getElementById("shoppingListModal")).show();
}

window.getProdDataForSearch = getProdDataForSearch;

