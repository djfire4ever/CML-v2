// =======================
// SECTION 1: Globals
// =======================
const bootstrapColors = {
  primary: '#0d6efd',
  secondary: '#6c757d',
  success: '#198754',
  danger: '#dc3545',
  warning: '#ffc107',
  info: '#0dcaf0',
  light: '#f8f9fa'
};

window.addEventListener('FullCalendarLoaded', () => {
  console.log('✅ FullCalendar scripts loaded. Initializing calendar logic...');

  const allDayCheckbox = document.getElementById('eventAllDay');
  const endGroup = document.getElementById('endDateGroup');
  const eventColorSelect = document.getElementById('eventColor');
  const colorPreview = document.getElementById('colorPreview');

  function toggleEndField() {
    if (allDayCheckbox?.checked) {
      endGroup?.classList.add('d-none');
    } else {
      endGroup?.classList.remove('d-none');
    }
  }

  if (allDayCheckbox && endGroup) {
    allDayCheckbox.addEventListener('change', toggleEndField);
    toggleEndField();
  }

  if (eventColorSelect && colorPreview) {
    eventColorSelect.addEventListener('change', e => {
      const colorClass = e.target.value;
      colorPreview.style.backgroundColor = bootstrapColors[colorClass] || '#3788d8';
    });
    colorPreview.style.backgroundColor = bootstrapColors[eventColorSelect.value] || '#3788d8';
  }

  // =======================
  // SECTION 2: Calendar Init
  // =======================
  setTimeout(() => {
    const Calendar = window.FullCalendar?.Calendar;
    const dayGridPlugin = window.FullCalendar?.DayGrid;
    const timeGridPlugin = window.FullCalendar?.TimeGrid;
    const interactionPlugin = window.FullCalendar?.Interaction;
    const listPlugin = window.FullCalendar?.List;
  
    // Only include plugins that are actually loaded
    const plugins = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin].filter(Boolean);
  
    if (!Calendar || plugins.length < 1) {
      console.error('❌ FullCalendar plugins missing.', { Calendar, plugins });
      return;
    }
  
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) {
      console.error('❌ #calendar not found.');
      return;
    }
  
    const calendar = new Calendar(calendarEl, {
      // plugins,
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
      },
      selectable: true,
      editable: true,
      eventDidMount(info) {
        info.el.style.color = 'black';
      },
      events(fetchInfo, success, failure) {
        toggleLoader(true);
        fetch(scriptURL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system: 'calendar',
            action: 'getEvents',
            start: fetchInfo.startStr,
            end: fetchInfo.endStr
          })
        })
        .then(res => res.json())
        .then(response => {
          if (response.success && Array.isArray(response.data)) {
            const events = response.data.map(ev => ({
              id: ev.eventID,
              title: ev.title,
              start: ev.start,
              end: ev.end,
              allDay: ev.allDay === true || ev.allDay === 'TRUE' || (!ev.start.includes('T')),
              backgroundColor: bootstrapColors[ev.color] || ev.color || '#3788d8',
              borderColor: bootstrapColors[ev.color] || ev.color || '#3788d8',
              textColor: '#fff',
              extendedProps: {
                description: ev.description || '',
                status: ev.status || '',
                category: ev.category || ''
              }
            }));
            success(events);
          } else {
            failure('Fetch failed');
            showToast('⚠️ Failed to load events', 'danger');
          }
        })
        .catch(err => {
          failure(err.message);
          showToast('⚠️ ' + err.message, 'danger');
        })
        .finally(() => toggleLoader(false));
      },
      select(info) {
        const form = document.getElementById('eventForm');
        form.reset();
        form.dataset.editing = 'false';
        form.dataset.eventId = '';
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventStart').value = info.startStr;
        document.getElementById('eventEnd').value = info.endStr;
        allDayCheckbox.checked = info.allDay;
        toggleEndField();
        document.getElementById('eventStatus').value = 'scheduled';
        document.getElementById('eventCategory').value = '';
        document.getElementById('eventDescription').value = '';
        eventColorSelect.value = 'primary';
        colorPreview.style.backgroundColor = bootstrapColors['primary'];
        document.getElementById('deleteEventBtn').style.display = 'none';
        new bootstrap.Modal(document.getElementById('addEventModal')).show();
      },
      eventClick(info) {
        const event = info.event;
        const form = document.getElementById('eventForm');
        form.dataset.editing = 'true';
        form.dataset.eventId = event.id;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventStart').value = formatDateTimeLocal(event.start);
        document.getElementById('eventEnd').value = formatDateTimeLocal(event.end || event.start);
        allDayCheckbox.checked = event.allDay;
        toggleEndField();
        document.getElementById('eventStatus').value = event.extendedProps.status || '';
        document.getElementById('eventCategory').value = event.extendedProps.category || '';
        document.getElementById('eventDescription').value = event.extendedProps.description || '';
        const selectedColor = Object.keys(bootstrapColors).find(
          k => bootstrapColors[k] === event.backgroundColor
        ) || 'light';
        eventColorSelect.value = selectedColor;
        colorPreview.style.backgroundColor = bootstrapColors[selectedColor];
        document.getElementById('deleteEventBtn').style.display = 'inline-block';
        new bootstrap.Modal(document.getElementById('addEventModal')).show();
      },
      eventDrop(info) {
        updateEvent(info.event);
      },
      eventResize(info) {
        updateEvent(info.event);
      }
    });

    calendar.render();

// =======================
// SECTION 3: Form Submit
// =======================
document.getElementById('eventForm').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  const title = document.getElementById('eventTitle').value.trim();
  if (!title) return showToast('⚠️ Event title required.', 'warning');

  const startInput = document.getElementById('eventStart').value;
  let endInput = document.getElementById('eventEnd').value;
  const isAllDay = allDayCheckbox.checked;

  if (isAllDay && (!endInput || endInput.trim() === '')) {
    const startDate = new Date(startInput);
    startDate.setDate(startDate.getDate() + 1);
    endInput = startDate.toISOString().split('T')[0];
  }

  const eventData = {
    system: 'calendar',
    action: form.dataset.editing === 'true' ? 'editEvent' : 'addEvent',
    ...(form.dataset.editing === 'true' && { eventID: form.dataset.eventId }),
    eventInfo: {
      title,
      start: startInput,
      end: endInput,
      allDay: isAllDay,
      status: document.getElementById('eventStatus').value,
      category: document.getElementById('eventCategory').value,
      description: document.getElementById('eventDescription').value,
      color: eventColorSelect.value
    }
  };

  toggleLoader(true);
  fetch(scriptURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData)
  })
  .then(res => res.json())
  .then(response => {
    if (response.success) {
      calendar.refetchEvents();
      bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
      form.reset();
      showToast('✅ Event saved', 'success');
    } else {
      showToast('⚠️ Save error: ' + (response.error || 'Unknown issue'), 'danger');
    }
  })
  .catch(err => {
    showToast('⚠️ ' + err.message, 'danger');
  })
  .finally(() => toggleLoader(false));
});

// =======================
// SECTION 4: Delete Event
// =======================
document.getElementById('deleteEventBtn').addEventListener('click', () => {
  const form = document.getElementById('eventForm');
  const eventId = form.dataset.eventId;
  if (!eventId) return showToast('⚠️ No event to delete.', 'warning');

  const payload = {
    system: 'calendar',
    action: 'deleteEvent',
    eventID: eventId
  };

  toggleLoader(true);
  fetch(scriptURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(response => {
    if (response.success) {
      calendar.refetchEvents();
      bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
      showToast('🗑️ Event deleted', 'success');
    } else {
      showToast('⚠️ Delete failed', 'danger');
    }
  })
  .catch(err => {
    showToast('⚠️ ' + err.message, 'danger');
  })
  .finally(() => toggleLoader(false));
});

// =======================
// SECTION 5: Update Event
// =======================
function updateEvent(event) {
  const payload = {
    system: 'calendar',
    action: 'editEvent',
    eventID: event.id,
    eventInfo: {
      title: event.title,
      start: event.startStr,
      end: event.endStr || event.startStr,
      allDay: event.allDay
    }
  };

  toggleLoader(true);
  fetch(scriptURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(response => {
    if (!response.success) {
      showToast('⚠️ Failed to update event.', 'danger');
    }
  })
  .catch(err => {
    showToast('⚠️ ' + err.message, 'danger');
  })
  .finally(() => toggleLoader(false));
  }
  }, 200); // End setTimeout
}); // End window.addEventListener

// =======================
// SECTION 6: Helper
// =======================
function formatDateTimeLocal(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

