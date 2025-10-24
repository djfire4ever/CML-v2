// ✅ Global invoice storage
let invoicedata = [];

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const searchResultsBox = document.getElementById("searchResults");

  if (searchInput) {
    searchInput.addEventListener("input", search);
  } else {
    console.error("❌ Search input not found!");
  }

  const searchTabButton = document.querySelector('button[data-bs-target="#tab-search"]');
  if (searchTabButton) {
    searchTabButton.addEventListener("shown.bs.tab", () => {
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      if (searchResultsBox) searchResultsBox.innerHTML = "";

      const searchCounter = document.getElementById("searchCounter");
      if (searchCounter) {
        searchCounter.textContent = "";
        searchCounter.classList.add("text-success", "text-dark", "fw-bold");
      }
    });
  } else {
    console.error("❌ Search tab not found!");
  }

  if (searchResultsBox) searchResultsBox.innerHTML = "";
  toggleLoader(true);
  setDataForSearch().finally(() => toggleLoader(false));
});

function setDataForSearch() {
  return fetch(scriptURL + "?action=getInvDataForSearch")
    .then(res => res.json())
    .then(data => {
      invoicedata = Array.isArray(data) ? data : [];
    })
    .catch(err => console.error("❌ Error loading invoice data:", err));
}

function search() {
  const inputEl = document.getElementById("searchInput");
  const box = document.getElementById("searchResults");
  if (!inputEl || !box) return;

  let counterContainer = document.getElementById("counterContainer");
  if (!counterContainer) {
    counterContainer = document.createElement("div");
    counterContainer.id = "counterContainer";
    counterContainer.className = "d-inline-flex gap-3 align-items-center ms-3";
    inputEl.parentNode.insertBefore(counterContainer, inputEl.nextSibling);
  }

  let searchCounter = document.getElementById("searchCounter");
  if (!searchCounter) {
    searchCounter = document.createElement("span");
    searchCounter.id = "searchCounter";
    searchCounter.className = "px-2 py-1 border rounded fw-bold bg-dark text-info";
    counterContainer.appendChild(searchCounter);
  }

  let totalCounter = document.getElementById("totalCounter");
  if (!totalCounter) {
    totalCounter = document.createElement("span");
    totalCounter.id = "totalCounter";
    totalCounter.className = "px-2 py-1 border rounded fw-bold bg-dark text-info";
    searchCounter.insertAdjacentElement("afterend", totalCounter);
  }

  toggleLoader(true);

  const terms = inputEl.value.toLowerCase().trim().split(/\s+/);
  const filtered = terms[0] === ""
    ? []
    : invoicedata.filter(row =>
        terms.every(word =>
          [0, 1, 2, 3, 4, 12].some(i => row[i]?.toString().toLowerCase().includes(word))
        )
      );

  searchCounter.textContent = terms[0] === "" ? "🔍" : `${filtered.length} Invoices Found`;
  totalCounter.textContent = `Total Invoices: ${invoicedata.length}`;
  box.innerHTML = "";

  const template = document.getElementById("rowTemplate").content;
  filtered.forEach(r => {
    const row = template.cloneNode(true);
    const tr = row.querySelector("tr");

    tr.querySelector(".invoiceID").textContent = r[1];
    tr.querySelector(".invoiceDate").textContent = formatDateForUser(r[7]);
    tr.querySelector(".firstName").textContent = r[3];
    tr.querySelector(".lastName").textContent = r[4];
    tr.querySelector(".balanceDue").textContent = formatCurrency(r[11]);
    const statusCell = tr.querySelector(".status");
      statusCell.innerHTML = "";

      const badge = document.createElement("span");
      badge.textContent = r[12];
      badge.classList.add("badge", "fw-bold", "fs-6");

      switch (r[12]) {
        case "Paid":
          badge.classList.add("bg-success", "text-dark");
          break;
        case "Unpaid":
          badge.classList.add("bg-danger", "text-dark");
          break;
        case "Partial":
          badge.classList.add("bg-warning", "text-dark");
          break;
        default:
          badge.classList.add("bg-secondary", "text-dark");
          break;
      }

      statusCell.appendChild(badge);


    tr.dataset.logid = r[0];
    box.appendChild(row);
  });

  toggleLoader(false);
}

// ✅ Handle clicks on any row (delegated handler)
document.getElementById("searchResults").addEventListener("click", async function (event) {
  const tr = event.target.closest("tr");
  if (!tr || !tr.dataset.logid) return; // Use logid here

  const logID = tr.dataset.logid;
  toggleLoader(true);

  try {
    await populateViewForm(logID); // Pass logID to load full details
    const viewTab = document.querySelector('[data-bs-target="#tab-view"]');
    if (viewTab) new bootstrap.Tab(viewTab).show();
  } catch (err) {
    console.error("❌ Failed to load invoice:", err);
  } finally {
    toggleLoader(false);
  }
});

// ✅ Fetch and populate form using logID (unique key)
async function populateViewForm(logID) {
  if (!logID) return console.error("❌ Missing logID parameter");

  const invoiceIDField = document.getElementById("invoiceID");
  if (!invoiceIDField) return console.error("❌ invoiceID input field not found");

  invoiceIDField.removeAttribute("readonly");
  toggleLoader(true);

  try {
    const response = await fetch(`${scriptURL}?action=getInvoiceById&logID=${encodeURIComponent(logID)}`);
    const text = await response.text();
    const invoiceInfo = JSON.parse(text);

    if (!invoiceInfo || typeof invoiceInfo !== "object" || invoiceInfo.error) {
      throw new Error(invoiceInfo?.error || "Invalid or missing invoice data");
    }

    window.currentInvoiceData = invoiceInfo;

    const fieldMap = [
      "logID", "invoiceID", "qtID", "firstName", "lastName", "email",
      "invoiceDate", "dueDate", "grandTotal", "amountPaid", "balanceDue",
      "status", "paymentHistory", "sendDate", "sendMethod", "invoiceLogNotes"
    ];

    fieldMap.forEach(key => {
      const el = document.getElementById(key);
      if (!el) return;

      if (["grandTotal", "amountPaid", "balanceDue"].includes(key)) {
        el.value = formatCurrency(invoiceInfo[key]);
      } else if (["invoiceDate", "dueDate", "sendDate", "paymentHistory"].includes(key)) {
        el.value = formatDateForUser(invoiceInfo[key]);
      } else {
        el.value = invoiceInfo[key] || "";
      }
    });

    // Alerts
      const paymentPendingEl = document.getElementById("paymentPendingAlert");
      const paidInFullEl = document.getElementById("paidInFullAlert");

      if (paymentPendingEl && paidInFullEl) {
        const balance = parseFloat(invoiceInfo.balanceDue) || 0;

        paymentPendingEl.classList.add("d-none");
        paidInFullEl.classList.add("d-none");

        if (balance > 0) {
          paymentPendingEl.classList.remove("d-none");
        } else {
          paidInFullEl.classList.remove("d-none");
        }
      }

    // View button
    const viewBtn = document.getElementById("view-Button");
    if (viewBtn) {
      if (invoiceInfo.invoiceUrl) {
        viewBtn.disabled = false;
        viewBtn.dataset.pdfLink = invoiceInfo.invoiceUrl;
        viewBtn.removeEventListener("click", openPDFfromInput);
        viewBtn.addEventListener("click", openPDFfromInput);
      } else {
        viewBtn.disabled = true;
        delete viewBtn.dataset.pdfLink;
      }
    }

    // Email button
    const sendBtn = document.getElementById("send-Button");
    if (sendBtn) {
      sendBtn.removeEventListener("click", openEmailModal);
      sendBtn.addEventListener("click", openEmailModal);
    }

    // Open quote button
    const openQuoteBtn = document.getElementById("openQuoteBtn");
    if (openQuoteBtn && invoiceInfo.qtID) {
      openQuoteBtn.disabled = false;
      openQuoteBtn.onclick = () => {
        const iframe = window.parent.document.querySelector("iframe");
        if (iframe) {
          iframe.src = `quotemanager.html?qtID=${encodeURIComponent(invoiceInfo.qtID)}`;
        } else {
          console.warn("❌ Could not find iframe in admin.html");
        }
      };
    }

  } catch (error) {
    console.error("❌ Error fetching invoice data:", error);
    showToast("❌ Failed to load invoice data.", "error");
  } finally {
    setupPaymentModalIfNeeded();
    toggleLoader(false);
  }
}
   
function setupPaymentModalIfNeeded() {
  const makePaymentBtn = document.getElementById("makePaymentBtn");
  const modalEl = document.getElementById("paymentModal");
  const paymentForm = document.getElementById("paymentForm");

  if (!makePaymentBtn || !modalEl || !paymentForm) {
    console.warn("❌ Payment modal elements not found yet");
    return;
  }

  const bootstrapModal = new bootstrap.Modal(modalEl);
  const balanceStr = window.currentInvoiceData?.balanceDue;
  const rawBalance = parseFloat(balanceStr || 0);

  console.log("BalanceDue (raw):", rawBalance);
  makePaymentBtn.classList.toggle("d-none", rawBalance <= 0);

  makePaymentBtn.onclick = () => {
    const today = new Date().toISOString().split("T")[0];

    document.getElementById("paymentLogID").value = document.getElementById("logID").value;

    // ✅ Use formatCurrency for display
    const displayBalanceEl = document.getElementById("displayBalanceDue");
    if (displayBalanceEl) {
      displayBalanceEl.innerHTML = `Total Amount Due - <strong>${formatCurrency(rawBalance)}</strong>`;
    }

    // ✅ Optional: formatted preview, only if element exists
    const formattedAmountEl = document.getElementById("formattedAmount");
    if (formattedAmountEl) {
      formattedAmountEl.textContent = `Formatted: ${formatCurrency(rawBalance)}`;
    }

    // ✅ Set today’s date (ISO for input type="date")
    document.getElementById("paymentDate").value = today;

    document.getElementById("paymentMethod").value = "";
    document.getElementById("paymentNotes").value = "";

    bootstrapModal.show();
  };
}

// Handle Payment Modal Submission
document.getElementById("submitPaymentBtn").addEventListener("click", async () => {
  const logID = document.getElementById("paymentLogID").value;
  const amount = parseFloat(document.getElementById("paymentAmount").value);
  const method = document.getElementById("paymentMethod").value;
  const notes = document.getElementById("paymentNotes").value;

  // ✅ Validation
  if (!logID || isNaN(amount) || amount <= 0 || !method) {
    showToast("⚠️ Please complete all required fields.", "warning");
    return;
  }

  try {
    toggleLoader(true);

    const response = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "invoice", 
        action: "logPayment",
        logID,
        amount,
        method,
        notes
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast("✅ Payment logged successfully!");
      bootstrap.Modal.getInstance(document.getElementById("paymentModal")).hide();

      // ✅ Refresh with updated logID
      await populateViewForm(logID);
    } else {
      throw new Error(result.message || "Unknown error occurred");
    }
  } catch (error) {
    console.error("❌ Error logging payment:", error);
    showToast("❌ Failed to log payment", "error");
  } finally {
    toggleLoader(false);
  }
});

