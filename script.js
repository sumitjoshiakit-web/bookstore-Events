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
 * Password never exposed to GitHub! 🔐
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
    
    logAnalytics('PART
