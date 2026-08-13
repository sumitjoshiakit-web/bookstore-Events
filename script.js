/**
 * Bookstore Events - Main Application
 * Pure vanilla JavaScript implementation
 */

// ========================================
// State Management
// ========================================

let events = [];
let filteredEvents = [];

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
    if (!input) return '';
    const temp = document.createElement('div');
    temp.textContent = input;
    return temp.innerHTML;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
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

function validateForm(data) {
    const errors = {};
    
    if (!data.title || data.title.trim().length < 2) {
        errors.title = 'Title must be at least 2 characters';
    }
    if (!data.venue || data.venue.trim().length < 2) {
        errors.venue = 'Venue must be at least 2 characters';
    }
    if (!data.date) {
        errors.date = 'Please select a date';
    }
    if (!data.time) {
        errors.time = 'Please select a time';
    }
    if (!data.category) {
        errors.category = 'Please select a category';
    }
    if (!data.description || data.description.trim().length < 5) {
        errors.description = 'Description must be at least 5 characters';
    }
    if (!data.password) {
        errors.password = 'Admin password is required';
    }
    
    return errors;
}

// ========================================
// API Calls - FIXED PATH
// ========================================

async function verifyAdminPassword(password) {
    try {
        const response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password }),
        });

        const data = await response.json();
        
        if (data.valid) {
            logAnalytics('PASSWORD_VERIFIED', { success: true });
        } else {
            logAnalytics('PASSWORD_VERIFIED', { success: false });
        }
        
        return data.valid === true;
    } catch (error) {
        console.error('Password verification error:', error);
        logAnalytics('PASSWORD_VERIFY_ERROR', { error: error.message });
        return false;
    }
}

// ========================================
// Data Persistence
// ========================================

function loadEventsFromStorage() {
    try {
        const stored = localStorage.getItem('bookstoreEvents');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn('Failed to load events from localStorage:', error);
    }
    return [];
}

function saveEventsToStorage(eventsData) {
    try {
        localStorage.setItem('bookstoreEvents', JSON.stringify(eventsData));
    } catch (error) {
        console.warn('Failed to save events to localStorage:', error);
    }
}

// ========================================
// Event Management
// ========================================

function addEvent(eventData) {
    const sanitizedData = {
        id: generateId(),
        title: sanitizeInput(eventData.title.trim()),
        venue: sanitizeInput(eventData.venue.trim()),
        date: sanitizeInput(eventData.date),
        time: sanitizeInput(eventData.time),
        category: sanitizeInput(eventData.category),
        description: sanitizeInput(eventData.description.trim()),
        participants: 0,
        createdAt: new Date().toISOString(),
    };
    
    events.push(sanitizedData);
    saveEventsToStorage(events);
    
    logAnalytics('ADD_EVENT', { 
        eventId: sanitizedData.id, 
        category: sanitizedData.category 
    });
    
    return sanitizedData;
}

function deleteEvent(eventId) {
    const eventIndex = events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) return false;
    
    const deletedEvent = events[eventIndex];
    events.splice(eventIndex, 1);
    saveEventsToStorage(events);
    
    logAnalytics('DELETE_EVENT', { 
        eventId: eventId, 
        category: deletedEvent.category 
    });
    
    return true;
}

function toggleParticipation(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) return false;
    
    event.participants = event.participants === 0 ? 1 : 0;
    saveEventsToStorage(events);
    
    logAnalytics('PARTICIPATE_TOGGLE', { 
        eventId: eventId, 
        status: event.participants === 1 ? 'joined' : 'left' 
    });
    
    return true;
}

// ========================================
// Rendering
// ========================================

function renderEvents() {
    DOM.eventsContainer.innerHTML = '';
    
    DOM.loadingSpinner.hidden = false;
    DOM.emptyState.hidden = true;
    
    setTimeout(() => {
        DOM.loadingSpinner.hidden = true;
        
        const eventsToRender = filteredEvents.length > 0 ? filteredEvents : events;
        
        if (eventsToRender.length === 0) {
            DOM.emptyState.hidden = false;
            return;
        }
        
        DOM.emptyState.hidden = true;
        
        eventsToRender.forEach(event => {
            const card = createEventCard(event);
            DOM.eventsContainer.appendChild(card);
        });
        
        logAnalytics('RENDER_EVENTS', { count: eventsToRender.length });
    }, 600);
}

function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', 'Event: ' + event.title);
    
    const isParticipating = event.participants > 0;
    
    card.innerHTML = 
        '<div class="event-card-header">' +
            '<h3 class="event-title">' + event.title + '</h3>' +
            '<span class="event-category-badge">' + event.category + '</span>' +
        '</div>' +
        '<div class="event-venue">' +
            '<span aria-hidden="true">\uD83D\uDCCD</span> ' + event.venue +
        '</div>' +
        '<div class="event-datetime">' +
            '<span aria-hidden="true">\uD83D\uDCC5</span> ' + event.date + ' at ' + event.time +
        '</div>' +
        '<p class="event-description">' + event.description + '</p>' +
        '<div class="event-card-actions">' +
            '<button class="participate-btn ' + (isParticipating ? 'participated' : '') + '" ' +
                    'data-id="' + event.id + '" ' +
                    'aria-label="' + (isParticipating ? 'Leave' : 'Join') + ' ' + event.title + '">' +
                '<span aria-hidden="true">' + (isParticipating ? '\u2705' : '\uD83C\uDFAB') + '</span> ' +
                (isParticipating ? 'Participating' : 'Participate') +
                (event.participants > 0 ? ' (' + event.participants + ')' : '') +
            '</button>' +
            '<button class="delete-btn" ' +
                    'data-id="' + event.id + '" ' +
                    'aria-label="Delete event: ' + event.title + '">' +
                '<span aria-hidden="true">\uD83D\uDDD1\uFE0F</span> Delete' +
            '</button>' +
        '</div>';
    
    const participateBtn = card.querySelector('.participate-btn');
    const deleteBtn = card.querySelector('.delete-btn');
    
    participateBtn.addEventListener('click', () => {
        if (toggleParticipation(event.id)) {
            renderEvents();
            showToast(isParticipating ? 'Left event' : 'Joined event!', 'success');
        }
    });
    
    deleteBtn.addEventListener('click', () => {
        if (confirm('Delete "' + event.title + '"?')) {
            if (deleteEvent(event.id)) {
                renderEvents();
                showToast('Event deleted successfully', 'success');
            }
        }
    });
    
    return card;
}

function filterEvents() {
    const searchTerm = DOM.searchInput.value.toLowerCase().trim();
    const category = DOM.categoryFilter.value;
    
    filteredEvents = events.filter(event => {
        const matchesSearch = !searchTerm || 
            event.title.toLowerCase().indexOf(searchTerm) !== -1 ||
            event.venue.toLowerCase().indexOf(searchTerm) !== -1 ||
            event.description.toLowerCase().indexOf(searchTerm) !== -1;
        
        const matchesCategory = category === 'all' || event.category === category;
        
        return matchesSearch && matchesCategory;
    });
    
    if (searchTerm.length > 0) {
        DOM.clearSearch.classList.add('visible');
    } else {
        DOM.clearSearch.classList.remove('visible');
    }
    
    renderEvents();
}

// ========================================
// Modal Management
// ========================================

function openModal() {
    DOM.modal.classList.add('open');
    DOM.form.reset();
    DOM.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
    
    const today = new Date().toISOString().split('T')[0];
    DOM.date.value = today;
    DOM.date.min = today;
    
    setTimeout(() => DOM.title.focus(), 100);
    
    logAnalytics('OPEN_MODAL');
}

function closeModal() {
    DOM.modal.classList.remove('open');
    DOM.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
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
    document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
    
    let hasErrors = false;
    for (const field in errors) {
        if (errors.hasOwnProperty(field)) {
            const errorEl = DOM[field + 'Error'];
            const inputEl = DOM[field];
            if (errorEl) {
                errorEl.textContent = errors[field];
                hasErrors = true;
            }
            if (inputEl) {
                inputEl.classList.add('error');
            }
        }
    }
    
    if (hasErrors) {
        showToast('Please fix the errors in the form', 'error');
        return;
    }
    
    const isValid = await verifyAdminPassword(formData.password);
    
    if (!isValid) {
        DOM.passwordError.textContent = 'Invalid admin password';
        DOM.password.classList.add('error');
        showToast('Invalid admin password!', 'error');
        return;
    }
    
    try {
        const newEvent = addEvent(formData);
        closeModal();
        filterEvents();
        showToast('Event "' + newEvent.title + '" added successfully!', 'success');
        logAnalytics('EVENT_ADDED_SUCCESS', { eventId: newEvent.id });
    } catch (error) {
        showToast('Failed to add event. Please try again.', 'error');
        console.error('Error adding event:', error);
    }
}

function updateCharCount() {
    DOM.charCount.textContent = DOM.description.value.length;
}

function handleKeyboardNavigation(e) {
    if (e.key === 'Escape' && DOM.modal.classList.contains('open')) {
        closeModal();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (DOM.modal.classList.contains('open')) {
            DOM.form.dispatchEvent(new Event('submit'));
        }
    }
}

// ========================================
// Initialization
// ========================================

function init() {
    events = loadEventsFromStorage();
    filteredEvents = events.slice();
    
    const today = new Date().toISOString().split('T')[0];
    DOM.date.min = today;
    DOM.date.value = today;
    
    renderEvents();
    setupEventListeners();
    
    logAnalytics('PAGE_LOAD', { eventCount: events.length });
    
    console.log('\uD83D\uDCDA Bookstore Events App initialized');
    console.log('\uD83D\uDCCA ' + events.length + ' events loaded from storage');
    console.log('\uD83D\uDD10 Using environment-based admin authentication');
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
        if (e.target === DOM.modal) {
            closeModal();
        }
    });
    
    DOM.form.addEventListener('submit', handleFormSubmit);
    DOM.description.addEventListener('input', updateCharCount);
    document.addEventListener('keydown', handleKeyboardNavigation);
}

document.addEventListener('DOMContentLoaded', init);
