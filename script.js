/**
 * Independent Bookstore Events - Main Application
 * Pure vanilla JavaScript. Database is the only source of truth.
 */

let events = [];
let statusFilter = 'all';
let lastFocusedElement = null;

const DOM = {
    eventsContainer: document.getElementById('eventsContainer'),
    emptyState: document.getElementById('emptyState'),
    emptyTitle: document.getElementById('emptyTitle'),
    emptyDescription: document.getElementById('emptyDescription'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    searchInput: document.getElementById('searchInput'),
    clearSearch: document.getElementById('clearSearch'),
    categoryFilter: document.getElementById('categoryFilter'),
    statusButtons: [...document.querySelectorAll('.status-filter')],
    openModalBtn: document.getElementById('openAddEventModal'),
    closeModalBtn: document.getElementById('closeModal'),
    cancelModalBtn: document.getElementById('cancelModal'),
    modal: document.getElementById('addEventModal'),
    form: document.getElementById('addEventForm'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    submitButton: document.getElementById('submitEvent'),
    title: document.getElementById('eventTitle'),
    venue: document.getElementById('eventVenue'),
    date: document.getElementById('eventDate'),
    time: document.getElementById('eventTime'),
    category: document.getElementById('eventCategory'),
    description: document.getElementById('eventDescription'),
    password: document.getElementById('adminPassword'),
    charCount: document.getElementById('charCount'),
    titleError: document.getElementById('titleError'),
    venueError: document.getElementById('venueError'),
    dateError: document.getElementById('dateError'),
    timeError: document.getElementById('timeError'),
    categoryError: document.getElementById('categoryError'),
    descriptionError: document.getElementById('descriptionError'),
    passwordError: document.getElementById('passwordError')
};

function sanitizeInput(value) {
    return typeof value === 'string' ? value.trim().replace(/\0/g, '') : '';
}

function logAnalytics(action, details = {}) {
    console.log('[Analytics] User interacted with Independent Bookstore Events Page', {
        action,
        timestamp: new Date().toISOString(),
        ...details
    });
}

function showToast(message, type = 'info') {
    DOM.toastMessage.textContent = message;
    DOM.toast.className = 'toast ' + type;
    DOM.toast.hidden = false;
    clearTimeout(DOM.toast._timeout);
    DOM.toast._timeout = setTimeout(() => { DOM.toast.hidden = true; }, 3500);
}

function setLoading(button, loading, loadingText) {
    button.disabled = loading;
    button.setAttribute('aria-busy', String(loading));
    if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
    } else {
        button.textContent = button.dataset.originalText || button.textContent;
        delete button.dataset.originalText;
    }
}

function getEventStatus(event, now = new Date()) {
    const date = sanitizeInput(event.date);
    const time = sanitizeInput(event.time);
    const start = new Date(`${date}T${time || '00:00'}`);
    if (Number.isNaN(start.getTime())) return 'past';

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    if (eventDay > today) return 'upcoming';
    if (eventDay < today) return 'past';

    // The current data model has no end-time column. For today's events,
    // treat the event as current from its start time through the day.
    // A future end-time can be added later without changing this UI model.
    return start <= now ? 'current' : 'upcoming';
}

function statusLabel(status) {
    return status === 'current' ? 'Current' : status.charAt(0).toUpperCase() + status.slice(1);
}

function formatEventDate(date, time) {
    const value = new Date(`${date}T${time || '00:00'}`);
    if (Number.isNaN(value.getTime())) return `${date} at ${time}`;
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(value);
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(10000)
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
}

async function loadEventsFromAPI() {
    const data = await fetchJson('/api/events', { headers: { Accept: 'application/json' } });
    return Array.isArray(data.events) ? data.events : [];
}

async function participateInEvent(eventId) {
    const data = await fetchJson('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'participate', eventId })
    }).catch(async error => {
        if (error.message === 'Your participation has already been recorded.') {
            return { alreadyParticipated: true, message: error.message };
        }
        throw error;
    });
    return data;
}

async function verifyAdminPassword(password) {
    try {
        const data = await fetchJson('/api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        return { valid: data.valid === true, networkError: false };
    } catch (error) {
        return { valid: false, networkError: error.message !== 'Invalid admin password.' };
    }
}

async function addEvent(data) {
    return fetchJson('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: sanitizeInput(data.title),
            venue: sanitizeInput(data.venue),
            date: sanitizeInput(data.date),
            time: sanitizeInput(data.time),
            category: sanitizeInput(data.category),
            description: sanitizeInput(data.description),
            password: data.password
        })
    });
}

async function deleteEvent(eventId, password) {
    return fetchJson('/api/events?id=' + encodeURIComponent(eventId), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
}

function matchesFilters(event) {
    const search = DOM.searchInput.value.trim().toLowerCase();
    const category = DOM.categoryFilter.value;
    const status = getEventStatus(event);
    const text = `${event.title} ${event.venue} ${event.description}`.toLowerCase();
    return (!search || text.includes(search)) &&
        (category === 'all' || event.category === category) &&
        (statusFilter === 'all' || status === statusFilter);
}

function filteredEvents() {
    return events.filter(matchesFilters).sort((a, b) => {
        const aDate = new Date(`${a.date}T${a.time || '00:00'}`);
        const bDate = new Date(`${b.date}T${b.time || '00:00'}`);
        return aDate - bDate;
    });
}

function createEventCard(event) {
    const status = getEventStatus(event);
    const card = document.createElement('article');
    card.className = `event-card status-${status}`;
    card.setAttribute('role', 'listitem');

    const header = document.createElement('div');
    header.className = 'event-card-header';
    const title = document.createElement('h3');
    title.className = 'event-title';
    title.textContent = event.title;
    const statusBadge = document.createElement('span');
    statusBadge.className = 'event-status-badge';
    statusBadge.textContent = statusLabel(status);
    header.append(title, statusBadge);

    const category = document.createElement('span');
    category.className = 'event-category-badge';
    category.textContent = event.category;

    const venue = document.createElement('div');
    venue.className = 'event-venue';
    venue.textContent = `📍 ${event.venue}`;

    const datetime = document.createElement('div');
    datetime.className = 'event-datetime';
    datetime.textContent = `📅 ${formatEventDate(event.date, event.time)}`;

    const description = document.createElement('p');
    description.className = 'event-description';
    description.textContent = event.description;

    const count = document.createElement('p');
    count.className = 'event-participants';
    count.textContent = `${Number(event.participants) || 0} participant${Number(event.participants) === 1 ? '' : 's'}`;

    const actions = document.createElement('div');
    actions.className = 'event-card-actions';

    const participate = document.createElement('button');
    participate.type = 'button';
    participate.className = 'participate-btn';
    participate.textContent = status === 'past' ? 'Event Completed' : 'Participate';
    participate.setAttribute('aria-label', status === 'past' ? `${event.title} is completed` : `Participate in ${event.title}`);
    participate.disabled = status === 'past';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete event: ${event.title}`);

    participate.addEventListener('click', async () => {
        if (participate.disabled) return;
        setLoading(participate, true, 'Saving...');
        try {
            const result = await participateInEvent(event.id);
            if (result.alreadyParticipated || result.message === 'Your participation has already been recorded.') {
                showToast('Your participation has already been recorded.', 'info');
                return;
            }
            events = await loadEventsFromAPI();
            renderEvents();
            showToast('Your participation has been recorded successfully!', 'success');
            logAnalytics('PARTICIPATE', { eventId: event.id });
        } catch (error) {
            console.error('Participation error:', error);
            showToast('Unable to record your participation. Please check your connection and try again.', 'error');
        } finally {
            setLoading(participate, false);
        }
    });

    deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
        const password = prompt('Enter admin password:');
        if (!password) return;
        setLoading(deleteBtn, true, 'Deleting...');
        try {
            await deleteEvent(event.id, password);
            events = await loadEventsFromAPI();
            renderEvents();
            showToast('Event deleted successfully.', 'success');
            logAnalytics('DELETE_EVENT', { eventId: event.id });
        } catch (error) {
            console.error('Delete error:', error);
            showToast(error.message || 'Unable to delete event. Please try again.', 'error');
        } finally {
            setLoading(deleteBtn, false);
        }
    });

    actions.append(participate, deleteBtn);
    header.append(category);
    card.append(header, venue, datetime, description, count, actions);
    return card;
}

function renderSection(title, status, sectionEvents) {
    const section = document.createElement('section');
    section.className = 'event-status-section';
    section.setAttribute('aria-labelledby', `section-${status}`);

    const heading = document.createElement('div');
    heading.className = 'event-section-heading';
    const h2 = document.createElement('h2');
    h2.id = `section-${status}`;
    h2.textContent = title;
    const count = document.createElement('span');
    count.className = 'event-section-count';
    count.textContent = String(sectionEvents.length);
    heading.append(h2, count);

    const grid = document.createElement('div');
    grid.className = 'events-grid';
    grid.setAttribute('role', 'list');
    sectionEvents.forEach(event => grid.appendChild(createEventCard(event)));

    section.append(heading, grid);
    return section;
}

function renderEvents() {
    DOM.loadingSpinner.hidden = false;
    DOM.emptyState.hidden = true;
    DOM.eventsContainer.replaceChildren();

    const list = filteredEvents();
    if (!list.length) {
        DOM.loadingSpinner.hidden = true;
        DOM.emptyState.hidden = false;
        const hasSearch = DOM.searchInput.value.trim() || DOM.categoryFilter.value !== 'all';
        DOM.emptyTitle.textContent = hasSearch ? 'No events found' : 'No events in this view';
        DOM.emptyDescription.textContent = hasSearch
            ? 'Try a different search term, category, or status.'
            : 'There are currently no events to display here.';
        return;
    }

    const groups = [
        ['Current Events', 'current'],
        ['Upcoming Events', 'upcoming'],
        ['Past Events', 'past']
    ];

    const fragment = document.createDocumentFragment();
    groups.forEach(([title, status]) => {
        const group = list.filter(event => getEventStatus(event) === status);
        if (group.length) fragment.appendChild(renderSection(title, status, group));
    });
    DOM.eventsContainer.appendChild(fragment);
    DOM.loadingSpinner.hidden = true;
    logAnalytics('RENDER_EVENTS', { count: list.length, filter: statusFilter });
}

function setStatusFilter(status) {
    statusFilter = status;
    DOM.statusButtons.forEach(button => {
        const active = button.dataset.status === status;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    renderEvents();
}

function validateForm(data) {
    const errors = {};
    if (data.title.trim().length < 2 || data.title.trim().length > 100) errors.title = 'Title must be between 2 and 100 characters.';
    if (data.venue.trim().length < 2 || data.venue.trim().length > 100) errors.venue = 'Venue must be between 2 and 100 characters.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) errors.date = 'Please select a valid date.';
    if (!/^\d{2}:\d{2}$/.test(data.time)) errors.time = 'Please select a valid time.';
    if (!['book-club', 'author-event', 'workshop', 'reading', 'signing'].includes(data.category)) errors.category = 'Please select a valid category.';
    if (data.description.trim().length < 5 || data.description.trim().length > 500) errors.description = 'Description must be between 5 and 500 characters.';
    if (!data.password.trim()) errors.password = 'Admin password is required.';
    return errors;
}

function clearFormErrors() {
    document.querySelectorAll('.form-error').forEach(el => { el.textContent = ''; });
    document.querySelectorAll('.form-input').forEach(el => {
        el.classList.remove('error');
        el.removeAttribute('aria-invalid');
    });
}

function openModal() {
    lastFocusedElement = document.activeElement;
    DOM.form.reset();
    clearFormErrors();
    DOM.modal.classList.add('open');
    DOM.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    DOM.charCount.textContent = '0';
    const today = new Date().toISOString().slice(0, 10);
    DOM.date.value = today;
    DOM.date.min = today;
    setTimeout(() => DOM.title.focus(), 50);
    logAnalytics('OPEN_MODAL');
}

function closeModal() {
    DOM.modal.classList.remove('open');
    DOM.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocusedElement?.focus) lastFocusedElement.focus();
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const data = {
        title: DOM.title.value,
        venue: DOM.venue.value,
        date: DOM.date.value,
        time: DOM.time.value,
        category: DOM.category.value,
        description: DOM.description.value,
        password: DOM.password.value
    };
    clearFormErrors();
    const errors = validateForm(data);
    Object.entries(errors).forEach(([field, message]) => {
        const input = DOM[field];
        const error = DOM[field + 'Error'];
        if (input) {
            input.classList.add('error');
            input.setAttribute('aria-invalid', 'true');
        }
        if (error) error.textContent = message;
    });
    if (Object.keys(errors).length) {
        showToast('Please fix the highlighted fields.', 'error');
        return;
    }

    setLoading(DOM.submitButton, true, 'Saving...');
    try {
        const auth = await verifyAdminPassword(data.password);
        if (auth.networkError) throw new Error('Unable to verify the admin password. Please check your connection and try again.');
        if (!auth.valid) {
            DOM.password.classList.add('error');
            DOM.password.setAttribute('aria-invalid', 'true');
            DOM.passwordError.textContent = 'Invalid admin password.';
            showToast('Invalid admin password.', 'error');
            return;
        }
        const result = await addEvent(data);
        events = await loadEventsFromAPI();
        closeModal();
        renderEvents();
        showToast(`Event "${result.event?.title || data.title}" added successfully.`, 'success');
        logAnalytics('ADD_EVENT', { eventId: result.event?.id });
    } catch (error) {
        console.error('Add event error:', error);
        showToast(error.message || 'Unable to add the event. Please try again.', 'error');
    } finally {
        setLoading(DOM.submitButton, false);
    }
}

async function loadWithRetry() {
    DOM.loadingSpinner.hidden = false;
    DOM.emptyState.hidden = true;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            events = await loadEventsFromAPI();
            renderEvents();
            return;
        } catch (error) {
            if (attempt === 2) {
                console.error('Failed to load events:', error);
                DOM.loadingSpinner.hidden = true;
                DOM.emptyState.hidden = false;
                DOM.emptyTitle.textContent = 'Unable to load events';
                DOM.emptyDescription.textContent = 'Please check your internet connection and try again.';
                showToast('Unable to load events. Please try again.', 'error');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
        }
    }
}

function setupEventListeners() {
    DOM.searchInput.addEventListener('input', renderEvents);
    DOM.clearSearch.addEventListener('click', () => {
        DOM.searchInput.value = '';
        DOM.searchInput.focus();
        renderEvents();
    });
    DOM.categoryFilter.addEventListener('change', renderEvents);
    DOM.statusButtons.forEach(button => button.addEventListener('click', () => setStatusFilter(button.dataset.status)));
    DOM.openModalBtn.addEventListener('click', openModal);
    DOM.closeModalBtn.addEventListener('click', closeModal);
    DOM.cancelModalBtn.addEventListener('click', closeModal);
    DOM.modal.addEventListener('click', event => { if (event.target === DOM.modal) closeModal(); });
    DOM.form.addEventListener('submit', handleFormSubmit);
    DOM.description.addEventListener('input', () => { DOM.charCount.textContent = DOM.description.value.length; });
    document.addEventListener('keydown', event => {
        if (!DOM.modal.classList.contains('open')) return;
        if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
        if (event.key === 'Tab') {
            const focusable = [...DOM.modal.querySelectorAll('button, input, select, textarea')].filter(el => !el.disabled);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadWithRetry();
    logAnalytics('PAGE_LOAD');
});
