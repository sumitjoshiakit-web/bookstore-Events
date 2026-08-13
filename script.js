/**
 * Bookstore Events - Main Application
 * Pure vanilla JavaScript implementation with all requirements
 */

// ========================================
// State Management
// ========================================

let events = [];
let filteredEvents = [];

// DOM Elements
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

    // Form fields
    title: document.getElementById('eventTitle'),
    venue: document.getElementById('eventVenue'),
    date: document.getElementById('eventDate'),
    time: document.getElementById('eventTime'),
    category: document.getElementById('eventCategory'),
    description: document.getElementById('eventDescription'),
    password: document.getElementById('adminPassword'),
    charCount: document.getElementById('charCount'),

    // Error fields
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

/**
 * Sanitize user input to prevent XSS
 */
function sanitizeInput(input) {
    if (!input) return '';
    const temp = document.createElement('div');
    temp.textContent = input;
    return temp.innerHTML;
}

/**
 * Generate a unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Telemetry - Log user interactions
 * Required by TRD: [Analytics] User interacted with Independent Bookstore Events Page
 */
function logAnalytics(action, details = {}) {
    const logMessage = '[Analytics] User interacted with Independent Bookstore Events Page';
    console.log(logMessage, { 
        action, 
        timestamp: new Date().toISOString(), 
        ...details 
    });
    
    // Update footer telemetry display
    const telemetryElement = document.querySelector('.footer-telemetry');
    if (telemetryElement) {
        telemetryElement.textContent = '\uD83D\uDCCA Last interaction: ' + action + ' at ' + new Date().toLocaleTimeString();
    }
}

/**
 * Show toast notification
 */
function showToast(message, type) {
    type = type || 'info';
    const toast = DOM.toast;
    const messageEl = DOM.toastMessage;
    
    messageEl.textContent = message;
    toast.className = 'toast ' + type;
    toast.hidden = false;
    
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function() {
        toast.hidden = true;
    }, 3000);
}

/**
 * Validate form fields
 */
function validateForm(data) {
    var errors = {};
    
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
// API Calls
// ========================================

/**
 * Verify admin password via backend API
 * Password never exposed to GitHub!  
 */
async function verifyAdminPassword(password) {
    try {
        var response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: password }),
        });

        var data = await response.json();
        
        // Log telemetry for password attempt
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
// Data Persistence (LocalStorage)
// ========================================

/**
 * Load events from localStorage
 */
function loadEventsFromStorage() {
    try {
        var stored = localStorage.getItem('bookstoreEvents');
        if (stored) {
            var parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn('Failed to load events from localStorage:', error);
    }
    return [];
}

/**
 * Save events to localStorage
 */
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

/**
 * Add a new event
 */
function addEvent(eventData) {
    // Sanitize all inputs - Required by TRD
    var sanitizedData = {
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
    
    // Log telemetry - Required by TRD
    logAnalytics('ADD_EVENT', { 
        eventId: sanitizedData.id, 
        category: sanitizedData.category 
    });
    
    return sanitizedData;
}

/**
 * Delete an event
 */
function deleteEvent(eventId) {
    var eventIndex = events.findIndex(function(e) { return e.id === eventId; });
    if (eventIndex === -1) return false;
    
    var deletedEvent = events[eventIndex];
    events.splice(eventIndex, 1);
    saveEventsToStorage(events);
    
    // Log telemetry - Required by TRD
    logAnalytics('DELETE_EVENT', { 
        eventId: eventId, 
        category: deletedEvent.category 
    });
    
    return true;
}

/**
 * Toggle participation
 */
function toggleParticipation(eventId) {
    var event = events.find(function(e) { return e.id === eventId; });
    if (!event) return false;
    
    // Simple toggle - in real app this would track users
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

/**
 * Render events to the DOM
 */
function renderEvents() {
    DOM.eventsContainer.innerHTML = '';
    
    // Show loading state - Required for bad connectivity
    DOM.loadingSpinner.hidden = false;
    DOM.emptyState.hidden = true;
    
    // Simulate async loading (for demonstration of loading indicator)
    setTimeout(function() {
        DOM.loadingSpinner.hidden = true;
        
        var eventsToRender = filteredEvents.length > 0 ? filteredEvents : events;
        
        // Empty state - Required by TRD
        if (eventsToRender.length === 0) {
            DOM.emptyState.hidden = false;
            return;
        }
        
        DOM.emptyState.hidden = true;
        
        eventsToRender.forEach(function(event) {
            var card = createEventCard(event);
            DOM.eventsContainer.appendChild(card);
        });
        
        // Telemetry for render
        logAnalytics('RENDER_EVENTS', { count: eventsToRender.length });
    }, 600);
}

/**
 * Create an event card element
 */
function createEventCard(event) {
    var card = document.createElement('div');
    card.className = 'event-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', 'Event: ' + event.title);
    
    var isParticipating = event.participants > 0;
    
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
    
    // Add event listeners
    var participateBtn = card.querySelector('.participate-btn');
    var deleteBtn = card.querySelector('.delete-btn');
    
    participateBtn.addEventListener('click', function() {
        if (toggleParticipation(event.id)) {
            renderEvents();
            showToast(isParticipating ? 'Left event' : 'Joined event!', 'success');
        }
    });
    
    deleteBtn.addEventListener('click', function() {
        if (confirm('Delete "' + event.title + '"?')) {
            if (deleteEvent(event.id)) {
                renderEvents();
                showToast('Event deleted successfully', 'success');
            }
        }
    });
    
    return card;
}

/**
 * Filter events based on search and category
 */
function filterEvents() {
    var searchTerm = DOM.searchInput.value.toLowerCase().trim();
    var category = DOM.categoryFilter.value;
    
    filteredEvents = events.filter(function(event) {
        var matchesSearch = !searchTerm || 
            event.title.toLowerCase().indexOf(searchTerm) !== -1 ||
            event.venue.toLowerCase().indexOf(searchTerm) !== -1 ||
            event.description.toLowerCase().indexOf(searchTerm) !== -1;
        
        var matchesCategory = category === 'all' || event.category === category;
        
        return matchesSearch && matchesCategory;
    });
    
    // Show/hide clear button
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

/**
 * Open the add event modal
 */
function openModal() {
    DOM.modal.classList.add('open');
    DOM.form.reset();
    DOM.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // Clear errors
    var errorElements = document.querySelectorAll('.form-error');
    for (var i = 0; i < errorElements.length; i++) {
        errorElements[i].textContent = '';
    }
    var inputElements = document.querySelectorAll('.form-input');
    for (var j = 0; j < inputElements.length; j++) {
        inputElements[j].classList.remove('error');
    }
    
    // Set default date to today
    var today = new Date().toISOString().split('T')[0];
    DOM.date.value = today;
    DOM.date.min = today;
    
    // Focus first input
    setTimeout(function() { DOM.title.focus(); }, 100);
    
    logAnalytics('OPEN_MODAL');
}

/**
 * Close the add event modal
 */
function closeModal() {
    DOM.modal.classList.remove('open');
    DOM.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Gather form data
    var formData = {
        title: DOM.title.value,
        venue: DOM.venue.value,
        date: DOM.date.value,
        time: DOM.time.value,
        category: DOM.category.value,
        description: DOM.description.value,
        password: DOM.password.value,
    };
    
    // Validate - Required by TRD
    var errors = validateForm(formData);
    
    // Clear previous errors
    var errorElements = document.querySelectorAll('.form-error');
    for (var i = 0; i < errorElements.length; i++) {
        errorElements[i].textContent = '';
    }
    var inputElements = document.querySelectorAll('.form-input');
    for (var j = 0; j < inputElements.length; j++) {
        inputElements[j].classList.remove('error');
    }
    
    // Show errors - Required by TRD
    var hasErrors = false;
    for (var field in errors) {
        if (errors.hasOwnProperty(field)) {
            var errorEl = DOM[field + 'Error'];
            var inputEl = DOM[field];
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
    
    // ✅ Verify password via backend API (not hardcoded!)
    var isValid = await verifyAdminPassword(formData.password);
    
    if (!isValid) {
        DOM.passwordError.textContent = 'Invalid admin password';
        DOM.password.classList.add('error');
        showToast('Invalid admin password!', 'error');
        return;
    }
    
    // ✅ Add event if password is valid
    try {
        var newEvent = addEvent(formData);
        closeModal();
        filterEvents();
        showToast('Event "' + newEvent.title + '" added successfully!', 'success');
        logAnalytics('EVENT_ADDED_SUCCESS', { eventId: newEvent.id });
    } catch (error) {
        showToast('Failed to add event. Please try again.', 'error');
        console.error('Error adding event:', error);
    }
}

/**
 * Update character counter
 */
function updateCharCount() {
    var count = DOM.description.value.length;
    DOM.charCount.textContent = count;
}

// ========================================
// Keyboard Navigation
// ========================================

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardNavigation(e) {
    // Escape key closes modal
    if (e.key === 'Escape' && DOM.modal.classList.contains('open')) {
        closeModal();
    }
    
    // Ctrl+Enter or Cmd+Enter submits form
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (DOM.modal.classList.contains('open')) {
            DOM.form.dispatchEvent(new Event('submit'));
        }
    }
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize the application
 */
function init() {
    // Load events from storage
    events = loadEventsFromStorage();
    filteredEvents = events.slice();
    
    // Set default date for form
    var today = new Date().toISOString().split('T')[0];
    DOM.date.min = today;
    DOM.date.value = today;
    
    // Render initial events
    renderEvents();
    
    // Set up event listeners
    setupEventListeners();
    
    // Log initial analytics - Required by TRD
    logAnalytics('PAGE_LOAD', { eventCount: events.length });
    
    console.log('\uD83D\uDCDA Bookstore Events App initialized');
    console.log('\uD83D\uDCCA ' + events.length + ' events loaded from storage');
    console.log('\uD83D\uDD10 Using environment-based admin authentication');
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Search input
    DOM.searchInput.addEventListener('input', filterEvents);
    
    // Clear search
    DOM.clearSearch.addEventListener('click', function() {
        DOM.searchInput.value = '';
        DOM.clearSearch.classList.remove('visible');
        filterEvents();
        DOM.searchInput.focus();
    });
    
    // Category filter
    DOM.categoryFilter.addEventListener('change', filterEvents);
    
    // Modal controls
    DOM.openModalBtn.addEventListener('click', openModal);
    DOM.closeModalBtn.addEventListener('click', closeModal);
    DOM.cancelModalBtn.addEventListener('click', closeModal);
    
    // Close modal on backdrop click
    DOM.modal.addEventListener('click', function(e) {
        if (e.target === DOM.modal) {
            closeModal();
        }
    });
    
    // Form submission
    DOM.form.addEventListener('submit', handleFormSubmit);
    
    // Character counter
    DOM.description.addEventListener('input', updateCharCount);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardNavigation);
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
