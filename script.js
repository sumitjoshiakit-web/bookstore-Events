/**
 * Bookstore Events - Main Application
 * Pure vanilla JavaScript implementation
 */

// ========================================
// State Management
// ========================================

let events = [];
let filteredEvents = [];
let lastFocusedElement = null;

const DOM = {
    eventsContainer: document.getElementById('eventsContainer'),
    emptyState: document.getElementById('emptyState'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    searchInput: document.getElementById('searchInput'),
    clearSearch: document.getElementById('clearSearch'),
    categoryFilter: document.getElementById('categoryFilter'),
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
    passwordError: document.getElementById('passwordError'),
};

// ========================================
// Utility Functions
// ========================================

function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return '';
    }
    return input.trim().replace(/\0/g, '');
}

function logAnalytics(action, details = {}) {
    const logMessage = '[Analytics] User interacted with Independent Bookstore Events Page';
    console.log(logMessage, { 
        action, 
        timestamp: new Date().toISOString(), 
        ...details 
    });
    
    const telemetryElement = document.querySelector('.footer-telemetry');
    if (telemetryElement) {
        telemetryElement.textContent = '\uD83D\uDCCA Last interaction: ' + action + ' at ' + new Date().toLocaleTimeString();
    }
}

function showToast(message, type = 'info') {
    const toast = DOM.toast;
    const messageEl = DOM.toastMessage;
    
    messageEl.textContent = message;
    toast.className = 'toast ' + type;
    toast.hidden = false;
    
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.hidden = true;
    }, 3000);
}

function setSubmitLoading(isLoading) {
    DOM.submitButton.disabled = isLoading;
    if (isLoading) {
        DOM.submitButton.setAttribute('aria-busy', 'true');
        DOM.submitButton.textContent = 'Verifying...';
    } else {
        DOM.submitButton.removeAttribute('aria-busy');
        DOM.submitButton.textContent = 'Add Event';
    }
}

function validateForm(data) {
    const errors = {};

    const title = data.title.trim();
    const venue = data.venue.trim();
    const description = data.description.trim();

    if (title.length < 2 || title.length > 100) {
        errors.title = 'Title must be between 2 and 100 characters.';
    }

    if (venue.length < 2 || venue.length > 100) {
        errors.venue = 'Venue must be between 2 and 100 characters.';
    }

    if (!data.date) {
        errors.date = 'Please select a date.';
    } else {
        const selectedDate = new Date(data.date + 'T00:00:00');
        if (Number.isNaN(selectedDate.getTime())) {
            errors.date = 'Please enter a valid date.';
        }
    }

    if (!data.time) {
        errors.time = 'Please select a time.';
    } else if (!/^\d{2}:\d{2}$/.test(data.time)) {
        errors.time = 'Please enter a valid time.';
    }

    const validCategories = ['book-club', 'author-event', 'workshop', 'reading', 'signing'];
    if (!validCategories.includes(data.category)) {
        errors.category = 'Please select a valid category.';
    }

    if (description.length < 5 || description.length > 500) {
        errors.description = 'Description must be between 5 and 500 characters.';
    }

    if (typeof data.password !== 'string' || data.password.trim() === '') {
        errors.password = 'Admin password is required.';
    }

    return errors;
}

// ========================================
// API Calls
// ========================================

async function verifyAdminPassword(password) {
    try {
        const response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
            signal: AbortSignal.timeout(10000)
        });

        if (response.status === 401) {
            return { valid: false, networkError: false };
        }

        if (!response.ok) {
            throw new Error('Authentication service unavailable');
        }

        const data = await response.json();
        return { valid: data.valid === true, networkError: false };

    } catch (error) {
        console.error('Password verification error:', error);
        logAnalytics('PASSWORD_VERIFY_ERROR', { error: error.message });
        return { valid: false, networkError: true };
    }
}

// ========================================
// Database API Persistence
// ========================================

async function loadEventsFromAPI() {
    const response = await fetch('/api/events', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to load events');
    }

    return Array.isArray(data.events) ? data.events : [];
}

async function addEvent(eventData) {
    const sanitizedData = {
        title: sanitizeInput(eventData.title),
        venue: sanitizeInput(eventData.venue),
        date: sanitizeInput(eventData.date),
        time: sanitizeInput(eventData.time),
        category: sanitizeInput(eventData.category),
        description: sanitizeInput(eventData.description),
        password: eventData.password
    };

    const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedData),
        signal: AbortSignal.timeout(10000)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to add event');
    }

    logAnalytics('ADD_EVENT', { 
        eventId: data.event?.id, 
        category: sanitizedData.category 
    });

    return data.event;
}

async function deleteEvent(eventId, password) {
    const response = await fetch('/api/events?id=' + encodeURIComponent(eventId), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(10000)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to delete event');
    }

    logAnalytics('DELETE_EVENT', { eventId });
    return data;
}

async function participateInEvent(eventId) {
    const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'participate',
            eventId
        }),
        signal: AbortSignal.timeout(10000)
    });

    const data = await response.json();

    if (response.status === 409) {
        return {
            alreadyParticipated: true,
            message: data.message || 'Your participation has already been recorded.'
        };
    }

    if (!response.ok) {
        throw new Error(data.error || 'Unable to record your participation');
    }

    logAnalytics('PARTICIPATE', { eventId, status: 'joined' });
    return {
        alreadyParticipated: false,
        event: data.event
    };
}

// ========================================
// Rendering
// ========================================

function renderEvents() {
    DOM.loadingSpinner.hidden = false;
    DOM.eventsContainer.replaceChildren();

    const eventsToRender = filteredEvents;

    if (eventsToRender.length === 0) {
        DOM.loadingSpinner.hidden = true;
        DOM.emptyState.hidden = false;
        return;
    }

    DOM.emptyState.hidden = true;
    const fragment = document.createDocumentFragment();
    eventsToRender.forEach(event => {
        fragment.appendChild(createEventCard(event));
    });
    DOM.eventsContainer.appendChild(fragment);

    DOM.loadingSpinner.hidden = true;
    logAnalytics('RENDER_EVENTS', { count: eventsToRender.length });
}

function createEventCard(event) {
    const card = document.createElement('article');
    card.className = 'event-card';
    card.setAttribute('role', 'listitem');

    // Header
    const header = document.createElement('div');
    header.className = 'event-card-header';

    const title = document.createElement('h3');
    title.className = 'event-title';
    title.textContent = event.title;

    const category = document.createElement('span');
    category.className = 'event-category-badge';
    category.textContent = event.category;

    header.append(title, category);

    // Venue
    const venue = document.createElement('div');
    venue.className = 'event-venue';
    const venueIcon = document.createElement('span');
    venueIcon.setAttribute('aria-hidden', 'true');
    venueIcon.textContent = '📍';
    venue.append(venueIcon, document.createTextNode(' ' + event.venue));

    // Date/Time
    const datetime = document.createElement('div');
    datetime.className = 'event-datetime';
    const dateIcon = document.createElement('span');
    dateIcon.setAttribute('aria-hidden', 'true');
    dateIcon.textContent = '📅';
    datetime.append(dateIcon, document.createTextNode(' ' + event.date + ' at ' + event.time));

    // Description
    const description = document.createElement('p');
    description.className = 'event-description';
    description.textContent = event.description;

    // Actions
    const actions = document.createElement('div');
    actions.className = 'event-card-actions';

    const participateBtn = document.createElement('button');
    participateBtn.type = 'button';
    participateBtn.className = 'participate-btn';
    participateBtn.dataset.id = event.id;
    participateBtn.setAttribute('aria-label', 'Participate in ' + event.title);
    participateBtn.textContent = 'Participate';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.id = event.id;
    deleteBtn.setAttribute('aria-label', 'Delete event: ' + event.title);
    deleteBtn.textContent = 'Delete';

    participateBtn.addEventListener('click', async () => {
        try {
            participateBtn.disabled = true;
            const result = await participateInEvent(event.id);

            if (result.alreadyParticipated) {
                showToast(
                    result.message || 'Your participation has already been recorded.',
                    'info'
                );
                return;
            }

            events = await loadEventsFromAPI();
            filterEvents();
            showToast('Your participation has been recorded successfully!', 'success');
        } catch (error) {
            console.error('Participation error:', error);
            showToast('Unable to record your participation. Please try again.', 'error');
        } finally {
            participateBtn.disabled = false;
        }
    });

    deleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete "' + event.title + '"?')) return;

        const password = prompt('Enter admin password:');
        if (!password) return;

        try {
            deleteBtn.disabled = true;
            await deleteEvent(event.id, password);
            events = await loadEventsFromAPI();
            filterEvents();
            showToast('Event deleted successfully', 'success');
        } catch (error) {
            console.error('Delete error:', error);
            showToast(error.message || 'Unable to delete event. Please try again.', 'error');
        } finally {
            deleteBtn.disabled = false;
        }
    });

    actions.append(participateBtn, deleteBtn);
    card.append(header, venue, datetime, description, actions);
    return card;
}

function filterEvents() {
    const searchTerm = DOM.searchInput.value.trim().toLowerCase();
    const category = DOM.categoryFilter.value;

    filteredEvents = events.filter(event => {
        const matchesSearch = searchTerm === '' ||
            event.title.toLowerCase().includes(searchTerm) ||
            event.venue.toLowerCase().includes(searchTerm) ||
            event.description.toLowerCase().includes(searchTerm);
        const matchesCategory = category === 'all' || event.category === category;
        return matchesSearch && matchesCategory;
    });

    DOM.clearSearch.classList.toggle('visible', searchTerm.length > 0);
    renderEvents();
}

// ========================================
// Modal Management
// ========================================

function openModal() {
    lastFocusedElement = document.activeElement;
    DOM.modal.classList.add('open');
    DOM.form.reset();
    DOM.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input').forEach(el => {
        el.classList.remove('error');
        el.removeAttribute('aria-invalid');
    });

    const today = new Date().toISOString().split('T')[0];
    DOM.date.value = today;
    DOM.date.min = today;
    DOM.charCount.textContent = '0';

    setTimeout(() => DOM.title.focus(), 100);
    logAnalytics('OPEN_MODAL');
}

function closeModal() {
    DOM.modal.classList.remove('open');
    DOM.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = {
        title: DOM.title.value,
        venue: DOM.venue.value,
        date: DOM.date.value,
        time: DOM.time.value,
        category: DOM.category.value,
        description: DOM.description.value,
        password: DOM.password.value,
    };
    
    const errors = validateForm(formData);
    
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input').forEach(el => {
        el.classList.remove('error');
        el.removeAttribute('aria-invalid');
    });
    
    let hasErrors = false;
    for (const field in errors) {
        if (Object.prototype.hasOwnProperty.call(errors, field)) {
            const errorEl = DOM[field + 'Error'];
            const inputEl = DOM[field];
            if (errorEl) errorEl.textContent = errors[field];
            if (inputEl) {
                inputEl.classList.add('error');
                inputEl.setAttribute('aria-invalid', 'true');
            }
            hasErrors = true;
        }
    }
    
    if (hasErrors) {
        showToast('Please fix the errors in the form', 'error');
        return;
    }
    
    setSubmitLoading(true);
    
    const result = await verifyAdminPassword(formData.password);
    
    if (result.networkError) {
        DOM.passwordError.textContent = 'Unable to verify password. Please check your internet connection and try again.';
        DOM.password.classList.add('error');
        DOM.password.setAttribute('aria-invalid', 'true');
        showToast('Connection problem. Please try again.', 'error');
        setSubmitLoading(false);
        return;
    }
    
    if (!result.valid) {
        DOM.passwordError.textContent = 'Invalid admin password.';
        DOM.password.classList.add('error');
        DOM.password.setAttribute('aria-invalid', 'true');
        showToast('Invalid admin password.', 'error');
        setSubmitLoading(false);
        return;
    }
    
    try {
        const newEvent = await addEvent(formData);
        closeModal();
        events = await loadEventsFromAPI();
        filterEvents();
        showToast('Event "' + newEvent.title + '" added successfully!', 'success');
        logAnalytics('EVENT_ADDED_SUCCESS', { eventId: newEvent.id });
    } catch (error) {
        showToast(error.message || 'Failed to add event. Please try again.', 'error');
        console.error('Error adding event:', error);
    } finally {
        setSubmitLoading(false);
    }
}

function updateCharCount() {
    DOM.charCount.textContent = DOM.description.value.length;
}

function handleKeyboardNavigation(e) {
    if (!DOM.modal.classList.contains('open')) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
    }

    if (e.key === 'Tab') {
        const focusable = DOM.modal.querySelectorAll('button, input, select, textarea');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!DOM.submitButton.disabled) {
            DOM.form.requestSubmit();
        }
    }
}

// ========================================
// Initialization
// ========================================

async function init() {
    const today = new Date().toISOString().split('T')[0];
    DOM.date.min = today;
    DOM.date.value = today;

    setupEventListeners();

    try {
        events = await loadEventsFromAPI();
        filteredEvents = events.slice();
        renderEvents();

        logAnalytics('PAGE_LOAD', { eventCount: events.length });

        console.log('\uD83D\uDCDA Bookstore Events App initialized');
        console.log('\uD83D\uDCCA ' + events.length + ' events loaded from database');
        console.log('\uD83D\uDD10 Using environment-based admin authentication');
    } catch (error) {
        console.error('Failed to load events:', error);
        events = [];
        filteredEvents = [];
        DOM.loadingSpinner.hidden = true;
        DOM.emptyState.hidden = false;
        showToast('Unable to load events. Please try again.', 'error');
    }
}

function setupEventListeners() {
    DOM.searchInput.addEventListener('input', filterEvents);
    
    DOM.clearSearch.addEventListener('click', () => {
        DOM.searchInput.value = '';
        DOM.clearSearch.classList.remove('visible');
        filterEvents();
        DOM.searchInput.focus();
    });
    
    DOM.categoryFilter.addEventListener('change', filterEvents);
    
    DOM.openModalBtn.addEventListener('click', openModal);
    DOM.closeModalBtn.addEventListener('click', closeModal);
    DOM.cancelModalBtn.addEventListener('click', closeModal);
    
    DOM.modal.addEventListener('click', (e) => {
        if (e.target === DOM.modal) closeModal();
    });
    
    DOM.form.addEventListener('submit', handleFormSubmit);
    DOM.description.addEventListener('input', updateCharCount);
    document.addEventListener('keydown', handleKeyboardNavigation);
}

document.addEventListener('DOMContentLoaded', init);
