/**
 * Bookstore Events - Database-backed data layer
 * Uses Vercel /api/events as the only database gateway.
 */

function normalizeDbEvent(event) {
    return {
        id: sanitizeInput(event.id),
        title: sanitizeInput(event.title),
        venue: sanitizeInput(event.venue),
        date: sanitizeInput(event.date),
        time: sanitizeInput(event.time),
        category: sanitizeInput(event.category),
        description: sanitizeInput(event.description),
        participants: Number(event.participants) > 0 ? 1 : 0,
        createdAt: typeof event.created_at === 'string'
            ? event.created_at
            : (typeof event.createdAt === 'string' ? event.createdAt : new Date().toISOString())
    };
}

async function loadEventsFromDatabase() {
    const response = await fetch('/api/events', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
        throw new Error('Failed to load events from database');
    }

    const data = await response.json();
    return Array.isArray(data.events) ? data.events.map(normalizeDbEvent) : [];
}

async function createEventInDatabase(eventData) {
    const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: eventData.title,
            venue: eventData.venue,
            date: eventData.date,
            time: eventData.time,
            category: eventData.category,
            description: eventData.description,
            password: eventData.password
        }),
        signal: AbortSignal.timeout(10000)
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        const error = new Error('Invalid admin password.');
        error.code = 'INVALID_PASSWORD';
        throw error;
    }

    if (!response.ok) {
        throw new Error(data.error || 'Failed to add event');
    }

    return normalizeDbEvent(data.event);
}

async function updateParticipationInDatabase(eventId, participants) {
    const response = await fetch('/api/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId, participants }),
        signal: AbortSignal.timeout(10000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Failed to update participation');
    }

    return normalizeDbEvent(data.event);
}

async function deleteEventFromDatabase(eventId) {
    const response = await fetch('/api/events?id=' + encodeURIComponent(eventId), {
        method: 'DELETE',
        signal: AbortSignal.timeout(10000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Failed to delete event');
    }
}

// The original app used localStorage. Keep it empty so the database is the source of truth.
loadEventsFromStorage = function () {
    return [];
};

// Replace localStorage-backed add behavior.
addEvent = function (eventData) {
    return createEventInDatabase(eventData);
};

// Replace localStorage-backed participation behavior.
toggleParticipation = function (eventId) {
    const event = events.find(item => item.id === eventId);
    if (!event) return false;

    const previous = event.participants;
    const next = previous === 0 ? 1 : 0;
    event.participants = next;
    filterEvents();

    updateParticipationInDatabase(eventId, next)
        .then(updated => {
            const index = events.findIndex(item => item.id === eventId);
            if (index !== -1) events[index] = updated;
            filterEvents();
        })
        .catch(error => {
            event.participants = previous;
            filterEvents();
            showToast(error.message || 'Failed to update participation.', 'error');
        });

    return true;
};

// Replace localStorage-backed delete behavior.
deleteEvent = function (eventId) {
    const event = events.find(item => item.id === eventId);
    if (!event) return false;

    deleteEventFromDatabase(eventId)
        .then(() => {
            events = events.filter(item => item.id !== eventId);
            filterEvents();
            showToast('Event deleted successfully', 'success');
        })
        .catch(error => {
            console.error('Delete event error:', error);
            showToast(error.message || 'Failed to delete event.', 'error');
        });

    // Return false so the old synchronous handler does not claim success before the API finishes.
    return false;
};

// Database-aware submit handler.
handleFormSubmit = async function (e) {
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

    try {
        const newEvent = await createEventInDatabase(formData);
        events.push(newEvent);
        closeModal();
        filterEvents();
        showToast('Event "' + newEvent.title + '" added successfully!', 'success');
        logAnalytics('EVENT_ADDED_SUCCESS', { eventId: newEvent.id });
    } catch (error) {
        if (error.code === 'INVALID_PASSWORD') {
            DOM.passwordError.textContent = 'Invalid admin password.';
            DOM.password.classList.add('error');
            DOM.password.setAttribute('aria-invalid', 'true');
            showToast('Invalid admin password.', 'error');
        } else {
            console.error('Error adding event:', error);
            showToast(error.message || 'Failed to add event. Please try again.', 'error');
        }
    } finally {
        setSubmitLoading(false);
    }
};

// Load the shared events after the original app initialization has run.
document.addEventListener('DOMContentLoaded', async () => {
    try {
        DOM.loadingSpinner.hidden = false;
        DOM.emptyState.hidden = true;

        const databaseEvents = await loadEventsFromDatabase();
        events = databaseEvents;
        filteredEvents = events.slice();
        renderEvents();
        logAnalytics('DATABASE_LOAD_SUCCESS', { eventCount: events.length });
    } catch (error) {
        console.error('Database load error:', error);
        DOM.loadingSpinner.hidden = true;
        events = [];
        filteredEvents = [];
        renderEvents();
        showToast('Unable to load events from database.', 'error');
        logAnalytics('DATABASE_LOAD_ERROR', { error: error.message });
    }
});
