// ----- Tier mapping -----
const TIER_MAP = { New: 0, Bronze: 1, Silver: 2, Gold: 3, Platinum: 4 };
const TIER_NAMES = Object.fromEntries(Object.entries(TIER_MAP).map(([n, i]) => [i, n]));
const TIER_COLORS = { New: "secondary", Bronze: "secondary", Silver: "info", Gold: "warning", Platinum: "danger" };
const TIER_ICONS = { New: "🆕", Bronze: "🥉", Silver: "🥈", Gold: "🥇", Platinum: "💎" };
const getTierIcon = tier => TIER_ICONS[tier] || "🏷️";

// ----- Email Templates Allowed -----
const EMAIL_TEMPLATES_ALLOWED_KEYS = ["lead", "thankyou", "promo", "uploadlink", "tierupgrade"];

document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById("searchInput");
  const resultsContainer = document.getElementById("clientsSearchResults");
  const addClientForm = document.getElementById("addClientFormAccordion");
  const FIELDS = ["clientID","firstName","lastName","nickName","email","street","city","state","zip"];
  let data = [], activeTierFilter = null, templates = {};

  // ----- Load clients -----
  async function loadClients() {
    toggleLoader(true);
    try {
      data = await (await fetch(scriptURL + "?action=getDataForSearch")).json();
      const hash = window.location.hash;
      if (hash.startsWith("#tier=")) activeTierFilter = decodeURIComponent(hash.replace("#tier=", ""));
      renderResults();
    } catch { showToast("⚠️ Failed to load data","error"); }
    finally { toggleLoader(false); }
  }

  // ----- Load email templates -----
  async function loadEmailTemplates() {
    toggleLoader(true);
    try {
      const tplData = await (await fetch(scriptURL + "?action=getEmailTemplates")).json();
      if (!Array.isArray(tplData)) return;
      templates = Object.fromEntries(tplData.map(t => [t.type, { subject: t.subject, body: t.body }]));
    } catch { showToast("❌ Error loading email templates","error"); }
    finally { toggleLoader(false); }
  }

  // ----- Render results -----
  function renderResults() {
    const val = searchInput.value.toLowerCase().trim();
    const words = val.split(/\s+/);
    resultsContainer.innerHTML = "";
    let results = val || activeTierFilter ? [...data] : [];
    if (activeTierFilter) results = results.filter(r => (r[10] || "New") === activeTierFilter);
    if (val) results = results.filter(r => words.every(w => [0,1,2,3,10].some(i => r[i].toString().toLowerCase().includes(w))));
    document.getElementById("searchCounter").textContent = results.length;
    document.getElementById("totalCounter").textContent = data.length;

    results.forEach(r => {
      const template = document.getElementById("rowTemplate").content.cloneNode(true);
      const item = template.querySelector(".accordion-item"), clientID = r[0];
      const headerBtn = item.querySelector(".accordion-button"), collapseEl = item.querySelector(".accordion-collapse"), headerEl = item.querySelector(".accordion-header");

      headerBtn.setAttribute("data-bs-target", `#collapse-${clientID}`);
      collapseEl.id = `collapse-${clientID}`;
      headerEl.id = `heading-${clientID}`;
      collapseEl.addEventListener("shown.bs.collapse", () => item.scrollIntoView({behavior:"smooth", block:"center"}));

      const values = { clientID:r[0], firstName:r[1], lastName:r[2], nickName:r[3], email:r[4], street:r[5], city:r[6], state:r[7], zip:r[8], tierID:r[9]||0, tier:r[10]||"New" };
      headerBtn.innerHTML = `<div class="row w-100 align-items-center">
        <div class="col-2 text-truncate">📞 ${values.clientID || "N/A"}</div>
        <div class="col-8 text-truncate">👤 ${values.firstName} ${values.lastName}</div>
        <div class="col-2 text-end">${getTierIcon(values.tier)}</div>
      </div>`;
      if(values.tier !== "New") headerBtn.classList.add(`bg-${TIER_COLORS[values.tier]}`,"text-black");

      // Fill row fields
      FIELDS.concat(["tier"]).forEach(f => {
        const span = item.querySelector(`.${f}`), input = item.querySelector(`.${f}-input`);
        if(span) { span.textContent = f==="tier"?values[f]:values[f]||""; if(f==="tier"){ span.dataset.tierId=values.tierID; span.className="tier"; } }
        if(input) input.value = values[f]||"";
      });

      // Buttons
      const editBtn = item.querySelector(".edit-button"), saveBtn = item.querySelector(".save-button"), cancelBtn = item.querySelector(".cancel-button"),
            deleteBtn = item.querySelector(".delete-button"), beforeDeleteBtn = item.querySelector(".before-delete-button"),
            tierInput = item.querySelector(".tier-input");

      const toggleEditMode = editing => {
        FIELDS.concat(["tier"]).forEach(f => { item.querySelector(`.${f}`)?.classList.toggle("d-none", editing); item.querySelector(`.${f}-input`)?.classList.toggle("d-none", !editing); });
        [editBtn, saveBtn, cancelBtn, tierInput].forEach(el => el.classList.toggle("d-none", el!==editBtn?!editing:editing));
      };
      const resetValues = () => { FIELDS.concat(["tier"]).forEach(f => { item.querySelector(`.${f}`).textContent=values[f]||""; item.querySelector(`.${f}-input`).value=values[f]||"" }); tierInput.value=values.tier; };

      editBtn.addEventListener("click", ()=>toggleEditMode(true));
      cancelBtn.addEventListener("click", ()=>{ resetValues(); toggleEditMode(false); });

      saveBtn.addEventListener("click", async () => {
        const updated = Object.fromEntries(FIELDS.map(f=>[f,item.querySelector(`.${f}-input`).value.trim()]));
          updated.tier = tierInput?.value || values.tier;
        const currentTier=tierInput?.value, previousTierID=item.querySelector(".tier").dataset.tierId, tierChanged=currentTier && currentTier!==values.tier;

        toggleLoader(true);
        try {
          const payload = tierChanged ? {system:"clients",action:"updateTier",clientID,newTier:currentTier,changeType:"manual",previousTierID,notes:"Changed via edit mode"} : {system:"clients",action:"edit",clientID,clientInfo:updated};
          const result = await (await fetch(scriptURL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})).json();
          showToast(result.success?"✅ Client updated!":"⚠️ Update failed",result.success?"success":"error");
          await loadClients();
        } catch { showToast("⚠️ Update failed","error"); }
        finally { toggleLoader(false); }
      });

      beforeDeleteBtn.addEventListener("click", () => {
        const isDelete = beforeDeleteBtn.dataset.buttonState==="delete";
        deleteBtn.classList.toggle("d-none", !isDelete);
        beforeDeleteBtn.textContent = isDelete?"Cancel":"Delete";
        beforeDeleteBtn.dataset.buttonState=isDelete?"cancel":"delete";
      });

      deleteBtn.addEventListener("click", async () => {
        toggleLoader(true);
        try {
          const result = await (await fetch(scriptURL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:"clients",action:"delete",clientID})})).json();
          showToast(result.success?"✅ Client deleted!":"⚠️ Delete failed",result.success?"success":"error");
          await loadClients();
        } catch { showToast("⚠️ Delete failed","error"); }
        finally { toggleLoader(false); }
      });

      // Email dropdown
      const emailMenu = item.querySelector(".email-template-dropdown");
      if(emailMenu){
        emailMenu.innerHTML="";
        if(values.email){
          EMAIL_TEMPLATES_ALLOWED_KEYS.filter(k=>templates[k]).forEach(k=>{
            const a=document.createElement("a");
            a.className="dropdown-item"; a.href="#"; a.textContent=k.charAt(0).toUpperCase()+k.slice(1);
            a.addEventListener("click", e=>{ e.preventDefault(); openEmailModal(values,templates[k]); });
            const li=document.createElement("li"); li.appendChild(a); emailMenu.appendChild(li);
          });
        } else emailMenu.innerHTML=`<li><span class="dropdown-item text-muted">No email</span></li>`;
      }

      resultsContainer.appendChild(item);
    });
  }

  // ----- Add client -----
  async function addClient(e){
    e.preventDefault();
    const clientInfo = Object.fromEntries(FIELDS.map(f => [f, document.getElementById(f).value.trim()]));
    if(!clientInfo.clientID||!clientInfo.firstName||!clientInfo.lastName) return showToast("❌ Missing required fields","error");

    toggleLoader(true);
    try{
      const result = await (await fetch(scriptURL+"?action=add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:"clients",action:"add",clientID:clientInfo.clientID,clientInfo})})).json();
      showToast(result.success?"✅ Client added!":"❌ Add failed",result.success?"success":"error");
      if(result.success) addClientForm.reset();
      await loadClients();
    } catch { showToast("❌ Add error","error"); }
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
    } catch { showToast("❌ Email send failed","error"); }
    finally { toggleLoader(false); }
  }

  // ----- Clear filter button -----
  document.getElementById("clearTierFilterBtn")?.addEventListener("click",()=>{activeTierFilter=null;window.location.hash="";renderResults();});

  // ----- Initialize -----
  await loadClients();
  await loadEmailTemplates();
  searchInput?.addEventListener("input", renderResults);
  addClientForm?.addEventListener("submit", addClient);
  document.getElementById("addCancelBtn")?.addEventListener("click",()=>addClientForm.reset());
});
