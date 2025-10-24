// ✅ Contact method toggles, lead modal submission
document.addEventListener("DOMContentLoaded", () => {
  const contactMethodPhone = document.getElementById("contactMethodPhone");
  const contactMethodEmail = document.getElementById("contactMethodEmail");
  const phoneField = document.getElementById("phoneField");
  const emailField = document.getElementById("emailField");
  const phoneInput = document.getElementById("phone");
  const emailInput = document.getElementById("email");
  const submitBtn = document.getElementById("submitLead");
  const leadForm = document.getElementById("leadForm");

  function toggleFields() {
    const phoneChecked = contactMethodPhone?.checked;
    const emailChecked = contactMethodEmail?.checked;

    phoneField.style.display = phoneChecked ? "block" : "none";
    emailField.style.display = emailChecked ? "block" : "none";

    phoneInput.required = phoneChecked;
    emailInput.required = emailChecked;
  }

  contactMethodPhone?.addEventListener("change", toggleFields);
  contactMethodEmail?.addEventListener("change", toggleFields);
  toggleFields();

  submitBtn?.addEventListener("click", () => {
    if (!contactMethodPhone.checked && !contactMethodEmail.checked) {
      alert("Please select at least one preferred contact method.");
      return;
    }
    if (leadForm?.checkValidity()) {
      handleLeadSubmission();
    } else {
      leadForm?.reportValidity();
    }
  });
});

async function handleLeadSubmission() {
  const getValue = id => document.getElementById(id)?.value.trim() || "";

  const firstName = getValue("firstName");
  const lastName = getValue("lastName");
  const phone = getValue("phone");
  const email = getValue("email");
  const leadSource = getValue("leadSource") || "N/A";
  const interestLevel = getValue("interestLevel") || "N/A";
  const inquiryType = getValue("inquiryType") || "N/A";
  const notes = getValue("notes") || "N/A";
  const bestTime = getValue("bestTime") || "N/A";
  const contactMethodPhone = document.getElementById("contactMethodPhone").checked;
  const contactMethodEmail = document.getElementById("contactMethodEmail").checked;

  if (!firstName) {
    return showToast("First Name is required!", "warning", true);
  }

  const preferredContact = [
    contactMethodPhone ? "Phone" : null,
    contactMethodEmail ? "Email" : null
  ].filter(Boolean).join(", ");

  const leadData = {
    firstName, lastName,
    phone: contactMethodPhone ? phone : "",
    email: contactMethodEmail ? email : "",
    preferredContact,
    bestTime,
    leadSource,
    interestLevel,
    inquiryType,
    notes,
    status: "New",
    leadDate: new Date(),
    followupDate: ""
  };

  try {
    const res = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: "leads", action: "add", leadInfo: leadData })
    });

    const result = await res.json();
    if (result.success) {
      showToast("✅ Thank you. We will contact you shortly.", "success", true);
      bootstrap.Modal.getInstance(document.getElementById("leadModal"))?.hide();
      document.getElementById("leadForm")?.reset();

      // Send signal to admin iframe to refresh
      parent.document.getElementById("content-frame")?.contentWindow?.postMessage({ action: "refreshLeads" }, "*");
    } else {
      showToast(`❌ Error: ${result.error || "Unknown error"}`, "danger", true);
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to submit lead.", "danger", true);
  }
}
