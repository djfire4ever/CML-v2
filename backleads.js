let leadsData = [];
let currentLeadID = null;

// 🔄 Load and render leads
async function loadLeads() {
  const url = `${scriptURL}?system=leads&action=getLeads`;
  const res = await fetch(url);
  leadsData = await res.json();
  renderLeads(leadsData);
}

// 📅 Format helper
function formatMmDdYyyy(input) {
  if (!input) return "";
  const d = new Date(input);
  if (isNaN(d)) return "";
  return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`;
}

// 📊 Render rows
function renderLeads(data) {
  const tbody = document.querySelector("#leadsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  data.forEach(lead => {
    tbody.innerHTML += `
      <tr>
        <td>${lead.leadID || ""}</td>
        <td>${lead.firstName || ""} ${lead.lastName || ""}</td>
        <td>${lead.phone || ""}</td>
        <td>${lead.email || ""}</td>
        <td>${lead.leadSource || ""}</td>
        <td>${lead.status || ""}</td>
        <td>${formatMmDdYyyy(lead.firstContact) || ""}</td>
        <td>${formatMmDdYyyy(lead.actionDate) || "N/A"}</td>
        <td>${formatMmDdYyyy(lead.nextFollowUpDate) || "N/A"}</td>
        <td><button class="btn btn-warning btn-sm" onclick="openLogModal(${lead.leadID})">Log Action</button></td>
      </tr>`;
  });
}

// ✏️ Log modal
function openLogModal(leadID) {
  currentLeadID = leadID;
  new bootstrap.Modal(document.getElementById("logActionModal")).show();
}

// ✅ Submit log
async function submitLogAction(event) {
  event.preventDefault();
  const actionType = document.getElementById("actionType")?.value || "";
  const actionNotes = document.getElementById("actionNotes")?.value || "";
  const customFollowUp = parseInt(document.getElementById("customFollowUpInterval")?.value.trim(), 10) || 0;

  toggleLoader(true);

  const payload = {
    system: "leads",
    action: "logAction",
    leadID: currentLeadID,
    actionType,
    notes: actionNotes,
    followUpInterval: customFollowUp
  };

  try {
    const result = await postData(scriptURL, payload);
    toggleLoader(false);

    if (result.success) {
      document.getElementById("logActionForm")?.reset();
      bootstrap.Modal.getInstance(document.getElementById("logActionModal"))?.hide();
      showToast("✅ Action logged!", "success");
      loadLeads();
    } else {
      showToast(`⚠️ ${result.message || "Unknown error"}`, "warning");
    }
  } catch (err) {
    toggleLoader(false);
    console.error(err);
    showToast("❌ Failed to log action.", "danger");
  }
}

// 🔄 Post JSON helper
async function postData(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 🔍 Filter
function filterLeads() {
  const status = document.getElementById("statusFilter").value.toLowerCase();
  const search = document.getElementById("searchBar").value.toLowerCase();

  const filtered = leadsData.filter(lead => {
    const statusMatch = !status || lead.status?.toLowerCase() === status;
    const searchable = `${lead.firstName} ${lead.lastName} ${lead.phone} ${lead.email} ${lead.leadSource} ${lead.notes} ${lead.status}`.toLowerCase();
    const searchMatch = !search || searchable.includes(search);
    return statusMatch && searchMatch;
  });
  renderLeads(filtered);
}

// 🔔 Listen for iframe refresh
window.addEventListener("message", e => {
  if (e.data?.action === "refreshLeads") loadLeads();
});

// Hook filters & log form
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logActionForm")?.addEventListener("submit", submitLogAction);
  document.getElementById("statusFilter")?.addEventListener("change", filterLeads);
  document.getElementById("searchBar")?.addEventListener("input", filterLeads);
  loadLeads();
});

