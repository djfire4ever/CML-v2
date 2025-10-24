// global.js

// Page meta setup
window.pageMeta = window.pageMeta || {};
window.pageMeta.loadedFrom = "global.js";
window.pageMeta.pageType = "global";
window.pageMeta.context = window !== window.parent ? "iframe" : "parent";
window.pageMeta.ready = false;

// Deferred console logging system
window._deferredLogs = window._deferredLogs || { parent: [], iframe: [] };

const logWithContext = (...args) => {
  const context = window.pageMeta.context;
  const color = context === "iframe"
    ? "color: orange; font-weight:bold;"
    : "color: green; font-weight:bold;";
  window._deferredLogs[context].push({ args, color });
};

// Global initialization logs
logWithContext("✅ global.js loaded");

// Global error logging (lightweight)
window._errorLog = [];
window.addEventListener("error", (e) => {
  const msg = `[${new Date().toLocaleTimeString()}] ${e.message} @ ${e.filename}:${e.lineno}`;
  window._errorLog.push(msg);
  if (window._errorLog.length > 10) window._errorLog.shift();
});

// Environment / script URL
window.isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
window.scriptURL = window.isLocal
  ? "https://script.google.com/macros/s/AKfycbz0n1Br3EO0z7Dukhqo0bZ_QKCZ-3hLjjsLdZye6kBPdu7Wdl7ag9dTBbgiJ5ArrCQ/exec"
  : "/netlify/functions/leadProxy";
logWithContext(`🌍 Environment: ${window.isLocal ? "Local" : "Live"}`);

// Library versions
window.LIB_VERSIONS = {
  bootstrap: "5.3.8",
  bootstrapIcons: "1.13.1",
  fontAwesome: "7.0.1",
  fullCalendarCore: "6.1.17",
  fullCalendarPlugins: "6.1.17"
};

// Shared CSS & JS loaders
window.loadSharedStyles = (options = {}) => {
  const { stylesheet } = options;
  const stylesheets = [
    `https://cdn.jsdelivr.net/npm/bootstrap@${window.LIB_VERSIONS.bootstrap}/dist/css/bootstrap.min.css`,
    `https://cdn.jsdelivr.net/npm/bootstrap-icons@${window.LIB_VERSIONS.bootstrapIcons}/font/bootstrap-icons.min.css`,
    `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/${window.LIB_VERSIONS.fontAwesome}/css/all.min.css`
  ];

  // Always include style.css if nothing is specified
  stylesheets.push(stylesheet || 'style.css');

  // Append everything (duplication allowed)
  stylesheets.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  });

  // Log summary
  logWithContext(
    `✅ Shared styles loaded${stylesheet ? ` (with ${stylesheet})` : ''}`
  );
};

window.loadGlobalScripts = () => {
  if (window.scriptsAlreadyLoaded) return;
  window.scriptsAlreadyLoaded = true;

  const bootstrapScript = document.createElement('script');
  bootstrapScript.src = `https://cdn.jsdelivr.net/npm/bootstrap@${window.LIB_VERSIONS.bootstrap}/dist/js/bootstrap.bundle.min.js`;
  bootstrapScript.defer = true;
  bootstrapScript.onload = () => {
    logWithContext('✅ Bootstrap JS loaded');
  };
  document.body.appendChild(bootstrapScript);
};

// DOM ready
document.addEventListener('DOMContentLoaded', () => {
  logWithContext('✅ DOM Ready: Scripts/Styles Loaded');
  window.loadSharedStyles();
  window.loadGlobalScripts();
  window.pageMeta.ready = true;

  // Print logs for this context once
  const context = window.pageMeta.context;
  console.groupCollapsed(`%c[${context}] Page Load Summary`, context === "iframe" ? "color: orange;" : "color: green;");
  window._deferredLogs[context].forEach(log => console.log(`%c[${context}]`, log.color, ...log.args));
  console.groupEnd();
});

// Shared formatters / helpers
window.formatDateForUser = (date) =>
  date ? new Date(date).toLocaleDateString("en-US") : "";

window.formatCurrency = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
};

window.parseSafeNumber = (raw) => {
  if (raw == null) return 0;
  const s = String(raw).replace(/[^0-9.-]+/g, "");
  return parseFloat(s) || 0;
};

window.formatPhoneNumber = (number) => {
  if (!number) return "";
  const digits = String(number).replace(/\D/g, "");
  if (digits.length !== 10) return number;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
};

// Show Toast Notification with different styles for Lead Form and Admin
window.showToast = (message, type = "success", forLeadForm = false) => {
  const toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) return;

  let bgColor;
  let headerText;
    
  if (forLeadForm) {
    if (type === "success") {
      bgColor = "bg-primary";
      headerText = "Thank You!";
      message = "We will contact you shortly.";
    } else if (type === "warning") {
      bgColor = "bg-warning";
      headerText = "Attention!";
    } else if (type === "error") {
      bgColor = "bg-danger";
      headerText = "❌ Error!";
    }
  } else {
    bgColor = type === "success" ? "bg-black" : "bg-danger";
    headerText = type === "success" ? "✅ Success" : "❌ Error";
  }

  const toast = document.createElement("div");
  toast.classList.add("toast", "show", bgColor, "text-info", "fade");
  toast.setAttribute("role", "alert");
  
  toast.innerHTML = `
    <div class="toast-header bg-info text-black">
        <strong class="me-auto">${headerText}</strong>
        <button type="button" class="btn-close btn-close-info" data-bs-dismiss="toast"></button>
    </div>
    <div class="toast-body">${message}</div>
  `;
    
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 5000);
  }, 5000);
};

// Loader overlay toggle
window.toggleLoader = () => {
  const loader = document.getElementById("loadingOverlay");
  if (!loader) return;

  loader.classList.toggle("show");

  if (loader.classList.contains("show")) {
    loader.classList.remove("d-none");
  } else {
    loader.classList.add("d-none");
  }
};

