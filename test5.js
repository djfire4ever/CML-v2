// ====== Global Config & State ======
const SELECTORS = {
  searchInput: "searchInput",
  resultsContainer: "clientsSearchResults",
  rowTemplate: "rowTemplate"
};

let clientData = [];

// ----- Unified Tier System -----
const TIERS = {
  New:      { label: "New",      color: "black",     textColor: "info",     icon: "🆕", iconBgColor: "success" },
  Silver:   { label: "Silver",   color: "secondary", textColor: "black",    icon: "🥈", iconBgColor: "secondary" },
  Gold:     { label: "Gold",     color: "warning",   textColor: "black",    icon: "🥇", iconBgColor: "warning" },
  Platinum: { label: "Platinum", color: "primary",   textColor: "black",    icon: "💎", iconBgColor: "primary" } // 🏆 🎖️ 
};
const getTierData = tier => TIERS[tier] || TIERS.New;

// ----- Email Templates Allowed -----
const EMAIL_TEMPLATES_ALLOWED_KEYS = ["lead", "thankyou", "promo", "uploadlink", "tierupgrade"];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ====== Load Clients ======
async function loadClients() {
  toggleLoader(true);
  try {
    const res = await fetch(`${scriptURL}?action=getDataForSearch`);
    const json = await res.json();
    const data = Array.isArray(json) ? json : json.data || [];

    // Map backend objects directly
    clientData = data.map(r => ({
      clientID: r.clientID || "",
      firstName: r.firstName || "",
      lastName: r.lastName || "",
      nickName: r.nickName || "",
      email: r.email || "",
      street: r.street || "",
      city: r.city || "",
      state: r.state || "",
      zip: r.zip || "",
      tier: r.tier || "New",
      memberSince: r.memberSince || "",
      birthday: r.birthday || "", 
      raw: r // optional, keep raw for debugging
    }));
  } catch (err) {
    console.error("❌ Error loading client data:", err);
    clientData = [];
    showToast("⚠️ Failed to load client database", "error");
  } finally {
    toggleLoader(false);
  }
}

// ====== DOM Ready (Unified Client Card Approach) ======
document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById(SELECTORS.searchInput);
  const resultsContainer = document.getElementById(SELECTORS.resultsContainer);
  if (!searchInput || !resultsContainer) return;

  // --- Load client data ---
  await loadClients();

  // --- Load email templates ---
  await loadEmailTemplates();

  // --- Render only the Add card initially ---
  renderClientCard(null);

  // --- Initialize counters ---
  const totalCounter = document.getElementById("totalCounter");
  const searchCounter = document.getElementById("searchCounter");
  if (totalCounter) totalCounter.textContent = String(clientData.length);
  if (searchCounter) searchCounter.textContent = "0";

  // --- Live search filtering (centralized) ---
  searchInput.addEventListener("input", () => refreshSearchResults());

  // Scroll card into center when accordion finishes expanding
  document.addEventListener("shown.bs.collapse", (e) => {
    const card = e.target.closest(".accordion-item.client-row");
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ===== Delegated Click Handling (unchanged) =====
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const card = btn.closest(".accordion-item.client-row");
  if (!card) return;

  const saveBtn         = card.querySelector(".save-button");
  const editBtn         = card.querySelector(".edit-button");
  const cancelBtn       = card.querySelector(".cancel-button");
  const beforeDeleteBtn = card.querySelector(".before-delete-button");
  const deleteBtn       = card.querySelector(".delete-button");

  const isAddCard = !card.dataset.clientId;

  // --- Edit / Cancel ---
  if (btn.classList.contains("edit-button")) enableEditToggle(card, true, isAddCard);
  if (btn.classList.contains("cancel-button")) enableEditToggle(card, false, isAddCard);

  // --- Save (Add / Edit unified) ---
  if (btn.classList.contains("save-button")) {
    const clientID = card.dataset.clientId || card.querySelector(".clientID-input").value.trim();
    if (!clientID) return showToast("⚠️ Client ID is required", "error");

    const clientInfo = {
      firstName: card.querySelector(".firstName-input").value.trim(),
      lastName: card.querySelector(".lastName-input").value.trim(),
      nickName: card.querySelector(".nickName-input").value.trim(),
      email: card.querySelector(".email-input").value.trim(),
      street: card.querySelector(".street-input").value.trim(),
      city: card.querySelector(".city-input").value.trim(),
      state: card.querySelector(".state-input").value.trim(),
      zip: card.querySelector(".zip-input").value.trim(),
      tier: card.querySelector(".tier-input").value,
      memberSince: card.querySelector(".memberSince-input").value
    };

    try {
      toggleLoader(true);
      const res = await fetch(scriptURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "clients",
          action: "edit",
          clientID,
          clientInfo
        })
      });

      const result = await res.json();
      if (result.success) {
        showToast("✅ Client saved!", "success");
        card.dataset.clientId = clientID; // assign ID for new clients
        enableEditToggle(card, false, !card.dataset.clientId);

        await loadClients();
        refreshSearchResults(clientID); // scroll to saved client
      } else {
        showToast(result.message || "❌ Error saving client", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("❌ Network error saving client", "error");
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
    const clientID = card.dataset.clientId;
    if (!clientID) return showToast("⚠️ Client ID missing", "error");

    toggleLoader(true);
    try {
      const res = await fetch(scriptURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: "clients", action: "delete", clientID })
      });
      const result = await res.json();
      if (result.success) {
        showToast("✅ Client deleted!", "success");
        card.remove();
        await loadClients();
        refreshSearchResults();
      } else {
        showToast("⚠️ Could not delete client.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("⚠️ Error deleting client.", "error");
    } finally {
      toggleLoader(false);
    }
  }
});
});

// ====== Render Client Card (Full Rewrite) ======
function renderClientCard(client = null) {
  const container = document.getElementById(SELECTORS.resultsContainer);
  if (!container) return;
  const template = document.getElementById(SELECTORS.rowTemplate);
  if (!template) return;

  const clone = template.content.cloneNode(true);
  const wrapper = clone.querySelector(".accordion-item.client-row");
  if (!wrapper) return;
  const isAddCard = !client;

  if (client?.clientID) wrapper.dataset.clientId = client.clientID;

  // --- Accordion IDs ---
  const header = wrapper.querySelector("h2.accordion-header");
  const collapse = wrapper.querySelector(".accordion-collapse");
  if (header && collapse) {
    const hId = `heading-${client?.clientID || "add"}`;
    const cId = `collapse-${client?.clientID || "add"}`;
    header.id = hId;
    collapse.id = cId;
    collapse.setAttribute("aria-labelledby", hId);
    collapse.setAttribute("data-bs-parent", `#${SELECTORS.resultsContainer}`);
    const btn = header.querySelector(".accordion-button");
    if (btn) {
      btn.setAttribute("data-bs-target", `#${cId}`);
      btn.setAttribute("aria-controls", cId);
    }
  }

  // --- Body Fields ---
  const fields = {
    firstName: [wrapper.querySelector(".firstName"), wrapper.querySelector(".firstName-input")],
    lastName: [wrapper.querySelector(".lastName"), wrapper.querySelector(".lastName-input")],
    nickName: [wrapper.querySelector(".nickName"), wrapper.querySelector(".nickName-input")],
    email: [wrapper.querySelector(".email"), wrapper.querySelector(".email-input")],
    street: [wrapper.querySelector(".street"), wrapper.querySelector(".street-input")],
    city: [wrapper.querySelector(".city"), wrapper.querySelector(".city-input")],
    state: [wrapper.querySelector(".state"), wrapper.querySelector(".state-input")],
    zip: [wrapper.querySelector(".zip"), wrapper.querySelector(".zip-input")],
    tier: [wrapper.querySelector(".tier"), wrapper.querySelector(".tier-input")],
    memberSince: [wrapper.querySelector(".memberSince")],
    birthday: [wrapper.querySelector(".birthday"), wrapper.querySelector(".birthday-month-input"), wrapper.querySelector(".birthday-day-input")],
    clientID: [wrapper.querySelector(".clientID"), wrapper.querySelector(".clientID-input")]
  };

  const tierHeader = wrapper.querySelector(".tier-header");
  const headerBtn = wrapper.querySelector(".accordion-button");
  const iconBg = wrapper.querySelector(".tier-icon-bg");
  const emailBtn = wrapper.querySelector(".btn-info.dropdown-toggle");
  const dropdown = wrapper.querySelector(".email-template-dropdown");

  if (client) {
    // --- Existing Client ---
    const tierData = getTierData(client.tier);

    if (wrapper.querySelector(".clientID-header"))
      wrapper.querySelector(".clientID-header").textContent = `📞 ${formatPhoneNumber(client.clientID)}`;
    if (wrapper.querySelector(".clientName-header"))
      wrapper.querySelector(".clientName-header").textContent = `${client.firstName} ${client.lastName}`;
    if (tierHeader) tierHeader.textContent = tierData.icon;

    if (headerBtn) {
      Object.values(TIERS).forEach(t => headerBtn.classList.remove(`bg-${t.color}`, `text-${t.textColor}`));
      headerBtn.classList.add(`bg-${tierData.color}`, `text-${tierData.textColor}`);
    }

    if (iconBg) {
      iconBg.className = `bi bi-award tier-icon-bg position-absolute text-${tierData.iconBgColor}`;
      iconBg.style.pointerEvents = "none";
    }

    // --- Populate fields ---
    Object.entries(fields).forEach(([key, arr]) => {
      if (key === "birthday") {
        const span = arr[0];
        const monthInput = arr[1];
        const dayInput = arr[2];
        const val = client[key] instanceof Date ? client[key] : client[key] ? new Date(client[key]) : null;

        if (val instanceof Date && !isNaN(val)) {
          const mm = val.getMonth();
          const dd = val.getDate();
          span.textContent = `${MONTH_NAMES[mm]} ${dd}`;
          monthInput.innerHTML = `<option value="" disabled hidden>Month</option>` + MONTH_NAMES.map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}" ${i===mm?'selected':''}>${m}</option>`).join("");
          dayInput.innerHTML = `<option value="" disabled hidden>Day</option>` + Array.from({length:31},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}" ${i===dd-1?'selected':''}>${i+1}</option>`).join("");
        } else {
          span.textContent = "";
          monthInput.innerHTML = `<option value="" disabled selected hidden>Month</option>` + MONTH_NAMES.map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join("");
          dayInput.innerHTML = `<option value="" disabled selected hidden>Day</option>` + Array.from({length:31},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}">${i+1}</option>`).join("");
        }
      } else {
        const span = arr[0];
        const input = arr[1];
        let val = client[key] || "";
        if (key === "clientID") val = formatPhoneNumber(val);
        if (key === "memberSince") val = formatDateForUser(val);
        if (span) span.textContent = val;
        if (input) input.value = val;
      }
    });

    // --- Email dropdown ---
    if (emailBtn) emailBtn.classList.remove("d-none");
    if (dropdown) {
      dropdown.innerHTML = "";
      EMAIL_TEMPLATES_ALLOWED_KEYS.forEach(key => {
        if (templates[key]) {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.className = "dropdown-item";
          a.href = "#";
          a.textContent = key.charAt(0).toUpperCase() + key.slice(1);
          a.onclick = (e) => {
            e.preventDefault();
            openEmailModal(client, templates[key]);
          };
          li.appendChild(a);
          dropdown.appendChild(li);
        }
      });
    }

    enableEditToggle(wrapper, false, isAddCard);
  } else {
    // --- Add New Client Card ---
    if (wrapper.querySelector(".clientID-header"))
      wrapper.querySelector(".clientID-header").innerHTML = `<span class="text-muted">📞</span>`;
    if (wrapper.querySelector(".clientName-header"))
      wrapper.querySelector(".clientName-header").textContent = "➕ Add New Client";
    if (tierHeader) tierHeader.textContent = "";
    if (headerBtn) headerBtn.className = "accordion-button collapsed";
    if (iconBg) iconBg.className = "bi bi-award tier-icon-bg position-absolute";

    // Clear fields
    Object.entries(fields).forEach(([key, arr]) => {
      if (key === "memberSince") {
        const span = arr[0];
        if (span) span.textContent = formatDateForUser(new Date());
      } else if (key === "birthday") {
        const span = arr[0];
        const monthInput = arr[1];
        const dayInput = arr[2];
        if (span) span.textContent = "";
        monthInput.innerHTML = `<option value="" disabled selected hidden>Month</option>` + MONTH_NAMES.map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join("");
        dayInput.innerHTML = `<option value="" disabled selected hidden>Day</option>` + Array.from({length:31},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}">${i+1}</option>`).join("");
      } else {
        const span = arr[0];
        const input = arr[1];
        if (span) span.textContent = "";
        if (input) input.value = "";
      }
    });

    if (emailBtn) emailBtn.classList.add("d-none");
    if (dropdown) dropdown.innerHTML = "";

    enableEditToggle(wrapper, true, isAddCard);
  }

  container.appendChild(clone);
}

// ====== Enable/Disable Edit Mode (Full Rewrite) ======
function enableEditToggle(wrapper, isEditing, isAddCard = false) {
  const editBtn = wrapper.querySelector(".edit-button");
  const saveBtn = wrapper.querySelector(".save-button");
  const cancelBtn = wrapper.querySelector(".cancel-button");
  const beforeDeleteBtn = wrapper.querySelector(".before-delete-button");
  const deleteBtn = wrapper.querySelector(".delete-button");

  if (editBtn) editBtn.classList.toggle("d-none", isEditing || isAddCard);
  if (saveBtn) { saveBtn.classList.toggle("d-none", !isEditing); saveBtn.disabled = true; }
  if (cancelBtn) cancelBtn.classList.toggle("d-none", !isEditing || isAddCard);
  if (beforeDeleteBtn) beforeDeleteBtn.style.display = isAddCard ? "none" : "inline-block";
  if (deleteBtn) deleteBtn.classList.add("d-none");

  // --- Birthday inputs ---
  const monthInput = wrapper.querySelector(".birthday-month-input");
  const dayInput = wrapper.querySelector(".birthday-day-input");
  const span = wrapper.querySelector(".birthday");

  if (monthInput && dayInput && span) {
    [monthInput, dayInput].forEach(input => {
      if (!input.dataset.listenerAttached) {
        input.addEventListener("change", () => {
          const mm = monthInput.value;
          const dd = dayInput.value;
          if (mm && dd) {
            span.textContent = `${MONTH_NAMES[parseInt(mm,10)-1]} ${dd}`;
            if (saveBtn) saveBtn.disabled = false;
          } else {
            span.textContent = "";
          }
        });
        input.dataset.listenerAttached = "1";
      }
    });
    monthInput.classList.toggle("d-none", !isEditing);
    dayInput.classList.toggle("d-none", !isEditing);
    span.classList.toggle("d-none", isEditing);
  }

  // --- Other fields ---
  const fieldMap = [
    [".firstName-input",".firstName"],
    [".lastName-input",".lastName"],
    [".nickName-input",".nickName"],
    [".email-input",".email"],
    [".street-input",".street"],
    [".city-input",".city"],
    [".state-input",".state"],
    [".zip-input",".zip"],
    [".tier-input",".tier"],
    [".clientID-input",".clientID"]
  ];

  fieldMap.forEach(([inputSel, spanSel]) => {
    const input = wrapper.querySelector(inputSel);
    const spanField = wrapper.querySelector(spanSel);
    if (input && spanField) {
      input.classList.toggle("d-none", !isEditing);
      spanField.classList.toggle("d-none", isEditing);

      if (!input.dataset.listenerAttached) {
        input.addEventListener("input", () => {
          let val = input.value;
          if (spanField) spanField.textContent = val;

          // --- Special handling ---
          if (inputSel === ".clientID-input") {
            const header = wrapper.querySelector(".clientID-header");
            if (header) header.innerHTML = val ? `📞 ${formatPhoneNumber(val)}` : `<span class="text-muted">📞</span>`;
          } else if (inputSel === ".tier-input") {
            const tierData = getTierData(val);
            const headerBtn = wrapper.querySelector(".accordion-button");
            const iconBg = wrapper.querySelector(".tier-icon-bg");
            const tierHeader = wrapper.querySelector(".tier-header");

            if (headerBtn) {
              Object.values(TIERS).forEach(t=>headerBtn.classList.remove(`bg-${t.color}`, `text-${t.textColor}`));
              headerBtn.classList.add(`bg-${tierData.color}`, `text-${tierData.textColor}`);
            }
            if (iconBg) {
              Object.values(TIERS).forEach(t=>iconBg.classList.remove(`text-${t.iconBgColor || t.color}`));
              iconBg.classList.add(`text-${tierData.iconBgColor || tierData.color}`);
            }
            if (tierHeader) tierHeader.textContent = tierData.icon;
          }

          if (saveBtn) saveBtn.disabled = false;
        });
        input.dataset.listenerAttached = "1";
      }
    }
  });

  if (isAddCard) {
    const iconBg = wrapper.querySelector(".tier-icon-bg");
    const tierInput = wrapper.querySelector(".tier-input");
    const tierVal = tierInput?.value || "New";
    const tierData = getTierData(tierVal);
    if (iconBg) iconBg.classList.add(`text-${tierData.iconBgColor || tierData.color}`);
  }
}

// ----- Load email templates -----
async function loadEmailTemplates() {
  toggleLoader(true);
  try {
    const tplData = await (await fetch(scriptURL + "?action=getEmailTemplates")).json();
    if (!Array.isArray(tplData)) return;
    templates = Object.fromEntries(tplData.map(t => [t.type, { subject: t.subject, body: t.body }]));
  } catch (err) {
    console.error("Error in loadEmailTemplates:", err);
    showToast("⚠️ Failed to load email templates", "error");
  }
  finally { toggleLoader(false); }
}

// ----- Open email modal -----
function openEmailModal(client,template){
  const modalEl=document.getElementById("emailModal"), modal=new bootstrap.Modal(modalEl);
  const replacePlaceholders=str=>Object.entries(client).reduce((s,[k,v])=>s.replaceAll(`{{${k}}}`,v||""),str);
  let subject=replacePlaceholders(template.subject), body=replacePlaceholders(template.body);

  if(body.includes("{{uploadLink}}")){
    const link=`https://cml-live-test.netlify.app/clientuploadform.html?clientID=${encodeURIComponent(client.clientID)}&firstName=${encodeURIComponent(client.firstName)}&lastName=${encodeURIComponent(client.lastName)}&email=${encodeURIComponent(client.email)}`;
    body = body.replace(/{{uploadLink}}/g, link);
  }

  document.getElementById("emailTo").value = client.email;
  document.getElementById("emailSubject").value = subject;
  document.getElementById("emailBody").value = body;
  modal.show();

  document.getElementById("sendEmailBtn").onclick = () => sendEmail(client.email,subject,body,modal);
}

// ----- Send email -----
async function sendEmail(to,subject,body,modal){
  toggleLoader(true);
  try{
    const result = await (await fetch(scriptURL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:"clients",action:"sendEmail",to,subject,body})})).json();
    showToast(result.success?"📧 Email sent!":"❌ Email failed",result.success?"success":"error");
    if(result.success) modal?.hide();
  } catch (err) {
    console.error("Error in sendEmail:", err);
    showToast("⚠️ Failed to send email", "error");
  }
  finally { toggleLoader(false); }
}

function refreshSearchResults(focusClientID = null) {
  const searchInput = document.getElementById(SELECTORS.searchInput);
  const resultsContainer = document.getElementById(SELECTORS.resultsContainer);
  if (!searchInput || !resultsContainer) return;

  const query = (searchInput.value || "").toLowerCase().trim();
  const words = query.split(/\s+/).filter(Boolean);

  resultsContainer.innerHTML = "";
  renderClientCard(null); // always render Add card first

  const filtered = query
    ? clientData.filter(client =>
        words.every(w =>
          Object.values(client).some(val => (val?.toString() || "").toLowerCase().includes(w))
        )
      )
    : clientData.slice();

  filtered.forEach(c => renderClientCard(c));

  const totalCounter = document.getElementById("totalCounter");
  const searchCounter = document.getElementById("searchCounter");
  if (totalCounter) totalCounter.textContent = String(clientData.length);
  if (searchCounter) searchCounter.textContent = String(filtered.length);

  if (focusClientID) {
    const el = resultsContainer.querySelector(`.accordion-item[data-client-id="${focusClientID}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

