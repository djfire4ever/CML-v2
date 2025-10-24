document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("galleryManagerModal");
  const saveButton = modal.querySelector("#saveGalleryChanges");
  const galleryGrid = modal.querySelector("#galleryGrid");

  let gallerySlots = [];
  let currentProdID = null;
  let currentProductName = "";

  // ===== Helpers =====
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function createSlots(count = 8) {
    galleryGrid.innerHTML = "";
    gallerySlots = [];
    for (let i = 0; i < count; i++) {
      const slot = document.createElement("div");
      slot.className = "gallery-slot";
      slot.dataset.index = i;
      slot.draggable = i !== 0;
      const imgContainer = document.createElement("div");
      imgContainer.className = "slot-image-container";
      if (i === 0) imgContainer.textContent = "Thumbnail";
      else imgContainer.textContent = "+ Add Image";
      slot.appendChild(imgContainer);
      if (i !== 0) {
        const buttons = document.createElement("div");
        buttons.className = "slot-buttons";
        buttons.innerHTML = `
          <button type="button" class="btn btn-sm btn-outline-warning set-main">⭐</button>
          <button type="button" class="btn btn-sm btn-outline-danger delete-image">🗑</button>`;
        slot.appendChild(buttons);
        const captionDiv = document.createElement("div");
        captionDiv.className = "slot-caption";
        captionDiv.innerHTML = `<input type="text" class="caption-input" placeholder="Caption...">`;
        slot.appendChild(captionDiv);
      }
      galleryGrid.appendChild(slot);
      gallerySlots.push(slot);
    }
  }

  function clearSlot(slot, isThumbnail = false) {
    slot.innerHTML = "";
    slot.classList.remove("empty");
    const container = document.createElement("div");
    container.className = "slot-image-container";
    if (isThumbnail) container.textContent = "Thumbnail";
    else container.textContent = "+ Add Image";
    slot.appendChild(container);
    if (!isThumbnail) {
      const buttons = document.createElement("div");
      buttons.className = "slot-buttons";
      buttons.innerHTML = `
        <button type="button" class="btn btn-sm btn-outline-warning set-main">⭐</button>
        <button type="button" class="btn btn-sm btn-outline-danger delete-image">🗑</button>`;
      slot.appendChild(buttons);
      const captionDiv = document.createElement("div");
      captionDiv.className = "slot-caption";
      captionDiv.innerHTML = `<input type="text" class="caption-input" placeholder="Caption...">`;
      slot.appendChild(captionDiv);
    }
    slot.file = null;
    if (!isThumbnail) slot.classList.add("empty");
  }

  function renderSlot(slot, data, index) {
    slot.classList.remove("empty");
    const imgContainer = slot.querySelector(".slot-image-container");
    const buttons = slot.querySelector(".slot-buttons");
    imgContainer.innerHTML = "";
    if (buttons) buttons.innerHTML = "";
    if (index === 0) {
      const badge = document.createElement("span");
      badge.className = "slot-badge";
      badge.textContent = "📌Thumbnail";
      imgContainer.appendChild(badge);
      if (data?.url) {
        const img = document.createElement("img");
        img.src = convertGoogleDriveLink(data.url);
        img.alt = "Thumbnail";
        imgContainer.appendChild(img);
      } else slot.classList.add("empty");
      return;
    }
    const captionInput = slot.querySelector(".caption-input");
    captionInput.value = data?.caption || "";
    if (data?.url) {
      const img = document.createElement("img");
      img.src = convertGoogleDriveLink(data.url);
      img.alt = `Gallery image ${index}`;
      imgContainer.appendChild(img);
      buttons.innerHTML = `
        <button type="button" class="btn btn-sm btn-outline-warning set-main">⭐</button>
        <button type="button" class="btn btn-sm btn-outline-danger delete-image">🗑</button>`;
      if (data.isMain) {
        const mainBadge = document.createElement("span");
        mainBadge.className = "slot-badge main-badge";
        mainBadge.textContent = "⭐ Main";
        imgContainer.appendChild(mainBadge);
      }
    } else {
      slot.classList.add("empty");
      imgContainer.textContent = "+ Add Image";
    }
    slot.file = data?.file || null;
  }

  // ===== File Handling =====
  function openFilePickerForSlot(slot) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (file && file.type.startsWith("image/")) handleFile(file, slot);
    });
    input.click();
  }

  function handleFile(file, slot) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const imgContainer = slot.querySelector(".slot-image-container");
      imgContainer.innerHTML = `<img src="${ev.target.result}" alt="Uploaded Image">`;
      const buttons = slot.querySelector(".slot-buttons");
      if (buttons && !buttons.querySelector(".set-main")) {
        buttons.innerHTML = `
          <button type="button" class="btn btn-sm btn-outline-warning set-main">⭐</button>
          <button type="button" class="btn btn-sm btn-outline-danger delete-image">🗑</button>`;
      }
      slot.file = file;
      slot.classList.remove("empty");
      normalizeGallerySlots();
    };
    reader.readAsDataURL(file);
  }

  // ===== Click Handlers =====
  galleryGrid.addEventListener("click", (e) => {
    const slot = e.target.closest(".gallery-slot");
    if (!slot || e.target.closest(".caption-input")) return;
    // Set Main
    if (e.target.closest(".set-main")) {
      gallerySlots.slice(1).forEach(s => s.querySelector(".main-badge")?.remove());
      const box = slot.querySelector(".slot-image-container");
      if (!box.querySelector(".main-badge")) {
        const badge = document.createElement("span");
        badge.className = "slot-badge main-badge";
        badge.textContent = "⭐ Main";
        box.appendChild(badge);
      }
      return;
    }
    // Delete
    if (e.target.closest(".delete-image")) {
      const idx = gallerySlots.indexOf(slot);
      clearSlot(slot, idx === 0);
      normalizeGallerySlots();
      return;
    }
    // Add / Replace Image
    if (!e.target.closest(".main-badge")) openFilePickerForSlot(slot);
  });

  // ===== Collect State =====
  function collectState() {
    const normalSlots = gallerySlots.slice(1); // slots 1–7
    const images = normalSlots
      .filter(slot => slot.file || slot.querySelector("img"))
      .map(slot => ({
        slot,
        img: slot.querySelector(".slot-image-container img"),
        file: slot.file,
        caption: slot.querySelector(".caption-input")?.value || "",
        isMain: !!slot.querySelector(".main-badge"),
      }));

    // Find the main image
    let mainImage = images.find(i => i.isMain);
    if (!mainImage && images.length) mainImage = images[0]; // default to first image

    // Put main image first
    const ordered = [mainImage, ...images.filter(i => i !== mainImage)];

    // Clear all slots first
    normalSlots.forEach(slot => clearSlot(slot, false));

    // Render ordered images into slots
    ordered.forEach((data, idx) => {
      const slot = normalSlots[idx];
      slot.file = data.file;

      // Append existing img element or uploaded image
      const imgContainer = slot.querySelector(".slot-image-container");
      imgContainer.innerHTML = "";
      if (data.img) imgContainer.appendChild(data.img);

      // Caption input
      const captionDiv = slot.querySelector(".slot-caption input");
      if (captionDiv) captionDiv.value = data.caption;

      // Main badge
      slot.querySelector(".main-badge")?.remove();
      if (data === mainImage) {
        const badge = document.createElement("span");
        badge.className = "slot-badge main-badge";
        badge.textContent = "⭐ Main";
        imgContainer.appendChild(badge);
      }

      slot.classList.remove("empty");
    });

    // Return full state including thumbnail (slot0)
    return gallerySlots.map((slot, idx) => {
      const img = slot.querySelector(".slot-image-container img");
      return {
        file: slot.file || null,
        url: img ? img.src : null,
        caption: slot.querySelector(".caption-input")?.value || "",
        isThumbnail: idx === 0,
        isMain: idx !== 0 && !!slot.querySelector(".main-badge"),
        sortOrder: idx + 1,
      };
    });
  }

  // ===== Normalize Slots (compact + isMain) =====
  function normalizeGallerySlots() {
    const slots = gallerySlots.slice(1); // slots 1–7
    // Include slots that have either a file or an <img> anywhere inside the slot
    const images = slots.filter(s => s.file || s.querySelector(".slot-image-container img"));

    if (!images.length) return; // nothing to normalize

    // Find main image
    let mainSlot = images.find(s => s.querySelector(".main-badge"));
    if (!mainSlot) mainSlot = images[0]; // default to first image

    // Rebuild slots 1–7 in order
    images.forEach((slot, idx) => {
      const container = slot.querySelector(".slot-image-container");
      const badge = container.querySelector(".main-badge");
      if (slot === mainSlot) {
        if (!badge) {
          const mainBadge = document.createElement("span");
          mainBadge.className = "slot-badge main-badge";
          mainBadge.textContent = "⭐ Main";
          container.appendChild(mainBadge);
        }
      } else badge?.remove();
    });

    for (let i = 0; i < 7; i++) {
      const slot = slots[i];
      const imgSlot = images[i] || null;

      if (imgSlot) {
        slot.innerHTML = imgSlot.innerHTML;
        slot.file = imgSlot.file || null;
        slot.classList.remove("empty");
      } else {
        clearSlot(slot, false);
      }
    }
  }

  // ===== Open Modal =====
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".openGalleryBtn");
    if (!btn) return;
    const productCard = btn.closest(".product-accordion");
    if (!productCard) return;
    currentProdID = productCard.dataset.prodId;
    currentProductName =
      productCard.querySelector(".productName-input")?.value ||
      productCard.querySelector(".productName-header")?.textContent ||
      "Unnamed Product";
    await openGalleryModal(currentProdID, currentProductName);
  });

  async function openGalleryModal(prodID, productName) {
    currentProdID = prodID;
    currentProductName = productName;
    createSlots(8);
    try {
      toggleLoader?.(true);
      const res = await fetch(`${scriptURL}?action=getGalleryByProdId&prodID=${prodID}`);
      const data = await res.json();
      const gallery = data?.success ? data.gallery : { thumbnail: null, images: [] };
      renderSlot(gallerySlots[0], gallery.thumbnail || null, 0);
      for (let i = 1; i < 8; i++) renderSlot(gallerySlots[i], gallery.images?.[i - 1] || null, i);
      normalizeGallerySlots();
    } catch (err) {
      console.error("Error fetching gallery:", err);
      gallerySlots.forEach((slot, idx) => renderSlot(slot, null, idx));
      showToast?.("⚠️ Error loading gallery", "danger");
    } finally {
      toggleLoader?.(false);
    }
    new bootstrap.Modal(modal).show();
    modal.addEventListener("hidden.bs.modal", () => {
      gallerySlots.forEach((slot, idx) => clearSlot(slot, idx === 0));
      currentProdID = null;
      currentProductName = "";
    }, { once: true });
  }

// ===== Save =====
saveButton?.addEventListener("click", async () => {
  if (!currentProdID) return showToast?.("⚠️ No product selected", "warning");

  const state = collectState();
  const payload = {
    system: "galleries",
    action: "edit",
    prodID: currentProdID,
    productName: currentProductName,
    thumbnail: null,
    images: []
  };

  const thumb = state[0];
  if (thumb.file) payload.thumbnail = {
    fileName: thumb.file.name,
    fileMime: thumb.file.type,
    fileData: await fileToBase64(thumb.file),
    caption: thumb.caption,
    sortOrder: 1,
    isMain: true
  };
  else if (thumb.url) payload.thumbnail = {
    url: thumb.url,
    caption: thumb.caption,
    sortOrder: 1,
    isMain: true
  };

  payload.images = await Promise.all(state.slice(1).map(async (img, idx) => {
    if (img.file) return {
      fileName: img.file.name,
      fileMime: img.file.type,
      fileData: await fileToBase64(img.file),
      caption: img.caption,
      sortOrder: idx + 2,
      isMain: img.isMain
    };
    if (img.url) return {
      url: img.url,
      caption: img.caption,
      sortOrder: idx + 2,
      isMain: img.isMain
    };
    return null;
  })).then(arr => arr.filter(Boolean));

  try {
    toggleLoader?.(true);
    const res = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      showToast?.("✅ Gallery saved!", "success");

      // Close the modal
      const bsModal = bootstrap.Modal.getInstance(document.getElementById("galleryManagerModal"));
      bsModal?.hide();

    } else showToast?.(result.message || "❌ Error saving gallery", "danger");

  } catch (err) {
    console.error(err);
    showToast?.("❌ Network error saving gallery", "danger");
  } finally {
    toggleLoader?.(false);
  }
});

  // ===== Drag & Drop =====
  let draggedSlot = null, placeholder = null;
  galleryGrid.addEventListener("dragstart", e => {
    const slot = e.target.closest(".gallery-slot");
    if (!slot || slot.dataset.index === "0" || slot.classList.contains("empty")) return;
    draggedSlot = slot;
    e.dataTransfer.effectAllowed = "move";
    slot.classList.add("dragging");
    placeholder = document.createElement("div");
    placeholder.className = "gallery-slot placeholder";
    placeholder.style.height = `${slot.offsetHeight}px`;
    placeholder.style.width = `${slot.offsetWidth}px`;
    slot.parentNode.insertBefore(placeholder, slot.nextSibling);
  });
  galleryGrid.addEventListener("dragover", e => {
    e.preventDefault();
    const target = e.target.closest(".gallery-slot");
    if (!draggedSlot || !target || target === draggedSlot || target.dataset.index==="0") return;
    const rect = target.getBoundingClientRect();
    const next = e.clientY - rect.top > rect.height/2 ? target.nextSibling : target;
    galleryGrid.insertBefore(placeholder, next);
  });
  galleryGrid.addEventListener("drop", e => {
    e.preventDefault();
    if (!placeholder || !draggedSlot) return;
    galleryGrid.insertBefore(draggedSlot, placeholder);
    draggedSlot.classList.remove("dragging");
    placeholder.remove();
    placeholder = null;
    draggedSlot = null;
    gallerySlots = Array.from(galleryGrid.querySelectorAll(".gallery-slot"));
    gallerySlots.forEach((s,i)=>s.dataset.index=i);
    normalizeGallerySlots();
  });
  galleryGrid.addEventListener("dragend", e => {
    if (draggedSlot) draggedSlot.classList.remove("dragging");
    placeholder?.remove();
    draggedSlot = null;
    placeholder = null;
  });
});
