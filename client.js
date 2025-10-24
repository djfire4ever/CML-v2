// client.js
// Import global (ES module loader will fetch it). Use type="module" when including client.js in HTML.
import './global.js';

window.pageMeta = window.pageMeta || {};
window.pageMeta.loadedFrom = window.pageMeta.loadedFrom || "global.js";
window.pageMeta.pageType = "client";
// console.log("✅ client.js loaded");

// Client font (Roboto)
(function loadClientFont() {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Roboto&display=swap';
  link.rel = 'stylesheet';
  link.type = 'text/css';
  document.head.appendChild(link);
})();

// Client-specific toggleLoader (simple show/hide)
window.toggleLoader = (show) => {
  const loader = document.getElementById("loadingOverlay");
  if (!loader) return;
  if (typeof show === 'undefined') {
    // toggle behavior (backwards compatible)
    loader.classList.toggle('show');
    if (loader.classList.contains('show')) loader.classList.remove('d-none');
    else loader.classList.add('d-none');
    return;
  }
  if (show) {
    loader.classList.add('show');
    loader.classList.remove('d-none');
  } else {
    loader.classList.remove('show');
    loader.classList.add('d-none');
  }
};

// Client-specific showToast (lead form styles by default)
window.showToast = (message, type = "success", forLeadForm = true) => {
  const toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) return;
  let bgColor, headerText;
  if (forLeadForm) {
    if (type === "success") { bgColor = "bg-info"; headerText = "Thank You!"; message = message || "We will contact you shortly."; }
    else if (type === "warning") { bgColor = "bg-warning"; headerText = "Attention!"; }
    else { bgColor = "bg-danger"; headerText = "❌ Error!"; }
  } else {
    bgColor = type === "success" ? "bg-black" : "bg-danger";
    headerText = type === "success" ? "✅ Success" : "❌ Error";
  }

  const toast = document.createElement("div");
  toast.classList.add("toast","show",bgColor,"text-info","fade");
  toast.setAttribute("role","alert");
  toast.innerHTML = `
    <div class="toast-header bg-info text-black">
      <strong class="me-auto">${headerText}</strong>
      <button type="button" class="btn-close btn-close-info" data-bs-dismiss="toast"></button>
    </div>
    <div class="toast-body">${message}</div>
  `;
  toastContainer.appendChild(toast);
  setTimeout(()=>{ toast.classList.remove('show'); setTimeout(()=>toast.remove(),5000); }, 5000);
};

window.convertGoogleDriveLink = (url) => {
  if (!url) return url;
  if (url.match(/\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i)) return url;
  const driveMatch = url.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]{20,})/);
  if (driveMatch) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}`;
  return url;
};

// Client dropdown loader - auto-run if selects exist (keeps your original behavior)
function loadDropdowns() {
  fetch(`${window.scriptURL}?action=dropdownLists`)
    .then(response => {
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      return response.json();
    })
    .then(data => {
      const dropdowns = {
        productTypeDropdown: "product-type-options",
        partsDropdown: "parts-options",
        phoneDropdown: "phone-options",
        unitTypeDropdown: "unit-type-options",
        paymentMethodDropdown: "payment-method-options",
        productDropdown: "product-options"
      };

      for (const [key, selectId] of Object.entries(dropdowns)) {
        const selectElement = document.getElementById(selectId);
        if (selectElement) {
          selectElement.innerHTML = "";
          const defaultOption = document.createElement("option");
          defaultOption.value = "";
          defaultOption.textContent = "Select an option";
          selectElement.appendChild(defaultOption);

          let values = [];
          if (key === "productTypeDropdown") values = data.productTypes || [];
          else if (key === "partsDropdown") values = data.parts || [];
          else if (key === "phoneDropdown") values = data.phoneList || [];
          else if (key === "unitTypeDropdown") values = data.unitTypes || [];
          else if (key === "paymentMethodDropdown") values = data.paymentMethods || [];
          else if (key === "productDropdown") values = data.products || [];

          values.forEach(val => {
            const option = document.createElement("option");
            option.value = val;
            option.textContent = val;
            selectElement.appendChild(option);
          });
        }
      }
      console.log("✅ Dropdowns loaded successfully (client)");
    })
    .catch(error => {
      if (error.name !== "AbortError") console.warn("⚠️ Dropdown fetch skipped or failed silently:", error.message);
    });
}

// Auto-run dropdown load only if select elements present
document.addEventListener('DOMContentLoaded', () => {
  if (
    document.getElementById("product-type-options") ||
    document.getElementById("parts-options") ||
    document.getElementById("phone-options") ||
    document.getElementById("unit-type-options") ||
    document.getElementById("payment-method-options") ||
    document.getElementById("product-options")
  ) {
    loadDropdowns();
  }

  // auto-focus search input if present
  const input = document.getElementById('searchInput');
  if (input && document.activeElement !== input) input.focus();
});

// Prevent Enter from submitting forms in text inputs (same behavior as original)
document.addEventListener("keydown", function (e) {
  const isEnter = e.key === "Enter";
  const target = e.target;
  const isTextInput = ["INPUT", "SELECT"].includes(target.tagName);
  const isTextArea = target.tagName === "TEXTAREA";
  const isSubmitTrigger = isEnter && isTextInput && !isTextArea;
  if (isSubmitTrigger) e.preventDefault();
});

