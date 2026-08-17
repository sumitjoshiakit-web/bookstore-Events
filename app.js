let events = [];
let statusFilter = 'all';
let lastFocused = null;

const $ = id => document.getElementById(id);
const D = {
    container: $('eventsContainer'), empty: $('emptyState'), emptyTitle: $('emptyTitle'), emptyDesc: $('emptyDescription'), loading: $('loadingSpinner'),
    search: $('searchInput'), clear: $('clearSearch'), category: $('categoryFilter'), status: [...document.querySelectorAll('.status-filter')],
    open: $('openAddEventModal'), modal: $('addEventModal'), close: $('closeModal'), cancel: $('cancelModal'), form: $('addEventForm'), submit: $('submitEvent'),
    title: $('eventTitle'), venue: $('eventVenue'), sd: $('eventStartDate'), st: $('eventStartTime'), ed: $('eventEndDate'), et: $('eventEndTime'),
    cat: $('eventCategory'), desc: $('eventDescription'), featured: $('eventFeatured'), guest: $('featuredPersonName'), role: $('featuredPersonRole'),
    guestBox: $('featuredGuestFields'), password: $('adminPassword'), count: $('charCount'), toast: $('toast'), toastMsg: $('toastMessage')
};

const clean = value => typeof value === 'string' ? value.trim().replace(/\0/g, '') : '';
const analytics = (action, details = {}) => console.log('[Analytics] User interacted with Independent Bookstore Events Page', { action, timestamp: new Date().toISOString(), ...details });

function toast(message, type = 'info') {
    D.toastMsg.textContent = message;
    D.toast.className = `toast ${type}`;
    D.toast.hidden = false;
    clearTimeout(D.toast._timer);
    D.toast._timer = setTimeout(() => { D.toast.hidden = true; }, 3500);
}

function busy(button, loading, text) {
    if (loading) {
        button.dataset.original = button.textContent;
        button.textContent = text;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
    } else {
        button.textContent = button.dataset.original || button.textContent;
        delete button.dataset.original;
        button.disabled = false;
        button.removeAttribute('aria-busy');
    }
}

async function api(url, options = {}) {
    const response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(10000) });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
}

async function load() {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const data = await api('/api/events', { headers: { Accept: 'application/json' } });
            return Array.isArray(data.events) ? data.events : [];
        } catch (error) {
            lastError = error;
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
        }
    }
    throw lastError;
}

function eventDates(event) {
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);
    return { start, end, valid: !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) };
}

function status(event, now = new Date()) {
    const { start, end, valid } = eventDates(event);
    if (!valid) return 'past';
    if (now < start) return 'upcoming';
    if (now < end) return 'current';
    return 'past';
}

function dateText(event) {
    const { start, end, valid } = eventDates(event);
    if (!valid) return 'Invalid date/time';
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
    const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });
    return start.toDateString() === end.toDateString() ? `${date.format(start)} · ${time.format(start)}–${time.format(end)}` : `${dateTime.format(start)} – ${dateTime.format(end)}`;
}

const categoryName = value => ({ 'book-club': 'Book Club', 'author-event': 'Author Event', workshop: 'Workshop', reading: 'Reading', signing: 'Book Signing' })[value] || value;

function filteredEvents() {
    const query = clean(D.search.value).toLowerCase();
    const category = D.category.value;
    return events.filter(event => {
        const currentStatus = status(event);
        const text = `${event.title} ${event.venue} ${event.description} ${event.featured_person_name || ''} ${event.featured_person_role || ''}`.toLowerCase();
        return (!query || text.includes(query)) && (category === 'all' || event.category === category) && (statusFilter === 'all' || currentStatus === statusFilter);
    }).sort((a, b) => {
        const statusOrder = { current: 0, upcoming: 1, past: 2 };
        const statusDifference = statusOrder[status(a)] - statusOrder[status(b)];
        if (statusDifference) return statusDifference;
        if (Boolean(b.is_featured) !== Boolean(a.is_featured)) return Number(b.is_featured) - Number(a.is_featured);
        return new Date(a.starts_at) - new Date(b.starts_at);
    });
}

function createCard(event) {
    const currentStatus = status(event);
    const card = document.createElement('article');
    card.className = `event-card status-${currentStatus}${event.is_featured ? ' featured-event' : ''}`;
    card.setAttribute('role', 'listitem');

    const header = document.createElement('div');
    header.className = 'event-card-header';
    const title = document.createElement('h3');
    title.className = 'event-title';
    title.textContent = event.title;
    const badge = document.createElement('span');
    badge.className = 'event-status-badge';
    badge.textContent = currentStatus === 'current' ? 'Current' : currentStatus === 'upcoming' ? 'Upcoming' : 'Past';
    header.append(title, badge);
    card.append(header);

    if (event.is_featured) {
        const featured = document.createElement('div');
        featured.className = 'featured-badge';
        featured.textContent = '★ Featured Event';
        card.append(featured);
    }

    const category = document.createElement('span');
    category.className = 'event-category-badge';
    category.textContent = categoryName(event.category);
    const venue = document.createElement('div');
    venue.className = 'event-venue';
    venue.textContent = `Venue: ${event.venue}`;
    const datetime = document.createElement('div');
    datetime.className = 'event-datetime';
    datetime.textContent = `Date & time: ${dateText(event)}`;
    const description = document.createElement('p');
    description.className = 'event-description';
    description.textContent = event.description;
    card.append(category, venue, datetime, description);

    if (event.is_featured) {
        const guest = document.createElement('div');
        guest.className = 'featured-guest';
        const role = document.createElement('strong');
        role.textContent = `★ ${event.featured_person_role}: `;
        const name = document.createElement('span');
        name.textContent = event.featured_person_name;
        guest.append(role, name);
        card.append(guest);
    }

    const participantCount = Number(event.participants) || 0;
    const count = document.createElement('p');
    count.className = 'event-participants';
    count.textContent = `${participantCount} participant${participantCount === 1 ? '' : 's'}`;
    card.append(count);

    const actions = document.createElement('div');
    actions.className = 'event-card-actions';
    const participate = document.createElement('button');
    participate.type = 'button';
    participate.className = 'participate-btn';
    participate.textContent = currentStatus === 'past' ? 'Event Completed' : 'Participate';
    participate.disabled = currentStatus === 'past';
    participate.setAttribute('aria-label', participate.disabled ? `${event.title} is completed` : `Participate in ${event.title}`);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete event: ${event.title}`);

    participate.addEventListener('click', async () => {
        if (participate.disabled) return;
        busy(participate, true, 'Saving...');
        try {
            const result = await api('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'participate', eventId: event.id }) });
            if (result.alreadyParticipated) {
                toast('Your participation has already been recorded.', 'info');
                return;
            }
            events = await load();
            render();
            toast('Your participation has been recorded successfully!', 'success');
            analytics('PARTICIPATE', { eventId: event.id });
        } catch (error) {
            toast(error.message || 'Unable to record your participation. Please check your connection and try again.', 'error');
        } finally { busy(participate, false); }
    });

    deleteButton.addEventListener('click', async () => {
        if (!confirm(`Delete “${event.title}”? This cannot be undone.`)) return;
        const password = prompt('Enter admin password:');
        if (!password) return;
        busy(deleteButton, true, 'Deleting...');
        try {
            await api(`/api/events?id=${encodeURIComponent(event.id)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
            events = await load();
            render();
            toast('Event deleted successfully.', 'success');
            analytics('DELETE_EVENT', { eventId: event.id });
        } catch (error) {
            toast(error.message || 'Unable to delete event. Please try again.', 'error');
        } finally { busy(deleteButton, false); }
    });

    actions.append(participate, deleteButton);
    card.append(actions);
    return card;
}

function renderSection(title, currentStatus, items) {
    const section = document.createElement('section');
    section.className = 'event-status-section';
    section.setAttribute('aria-labelledby', `section-${currentStatus}`);
    const heading = document.createElement('div');
    heading.className = 'event-section-heading';
    const h2 = document.createElement('h2');
    h2.id = `section-${currentStatus}`;
    h2.textContent = title;
    const count = document.createElement('span');
    count.className = 'event-section-count';
    count.textContent = String(items.length);
    heading.append(h2, count);
    const grid = document.createElement('div');
    grid.className = 'events-grid';
    grid.setAttribute('role', 'list');
    items.forEach(event => grid.append(createCard(event)));
    section.append(heading, grid);
    return section;
}

function render() {
    D.container.replaceChildren();
    const list = filteredEvents();
    if (!list.length) {
        D.empty.hidden = false;
        D.emptyTitle.textContent = 'No events found';
        D.emptyDesc.textContent = 'Try a different search term, category, or status filter.';
        return;
    }
    D.empty.hidden = true;
    const fragment = document.createDocumentFragment();
    [['Current Events', 'current'], ['Upcoming Events', 'upcoming'], ['Past Events', 'past']].forEach(([title, currentStatus]) => {
        const items = list.filter(event => status(event) === currentStatus);
        if (items.length) fragment.append(renderSection(title, currentStatus, items));
    });
    D.container.append(fragment);
}

function setStatusFilter(value) {
    statusFilter = value;
    D.status.forEach(button => {
        const active = button.dataset.status === value;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    render();
}

function clearErrors() {
    document.querySelectorAll('.form-error').forEach(element => { element.textContent = ''; });
    document.querySelectorAll('.form-input').forEach(element => { element.classList.remove('error'); element.removeAttribute('aria-invalid'); });
}

function formErrors(data) {
    const errors = {};
    if (clean(data.title).length < 2 || clean(data.title).length > 100) errors.title = 'Title must be between 2 and 100 characters.';
    if (clean(data.venue).length < 2 || clean(data.venue).length > 100) errors.venue = 'Venue must be between 2 and 100 characters.';
    if (!data.sd) errors.sd = 'Start date is required.';
    if (!data.st) errors.st = 'Start time is required.';
    if (!data.ed) errors.ed = 'End date is required.';
    if (!data.et) errors.et = 'End time is required.';
    if (data.sd && data.st && data.ed && data.et && new Date(`${data.ed}T${data.et}`) <= new Date(`${data.sd}T${data.st}`)) errors.ed = 'End date and time must be after the start date and time.';
    if (!['book-club', 'author-event', 'workshop', 'reading', 'signing'].includes(data.cat)) errors.cat = 'Please select a valid category.';
    if (clean(data.desc).length < 5 || clean(data.desc).length > 500) errors.desc = 'Description must be between 5 and 500 characters.';
    if (data.featured && clean(data.guest).length < 2) errors.guest = 'Featured person name is required.';
    if (data.featured && clean(data.role).length < 2) errors.role = 'Featured person role is required.';
    if (!clean(data.password)) errors.password = 'Admin password is required.';
    return errors;
}

function showErrors(errors) {
    const map = { title: 'eventTitle', venue: 'eventVenue', sd: 'eventStartDate', st: 'eventStartTime', ed: 'eventEndDate', et: 'eventEndTime', cat: 'eventCategory', desc: 'eventDescription', guest: 'featuredPersonName', role: 'featuredPersonRole', password: 'adminPassword' };
    Object.entries(errors).forEach(([field, message]) => {
        const input = $(map[field]);
        const error = $(field === 'sd' ? 'sdError' : field === 'st' ? 'stError' : field === 'ed' ? 'edError' : field === 'et' ? 'etError' : field === 'cat' ? 'catError' : field === 'desc' ? 'descError' : field === 'guest' ? 'guestError' : field === 'role' ? 'roleError' : field + 'Error');
        if (input) { input.classList.add('error'); input.setAttribute('aria-invalid', 'true'); }
        if (error) error.textContent = message;
    });
}

function toggleGuest() {
    const featured = D.featured.checked;
    D.guestBox.hidden = !featured;
    D.guest.required = featured;
    D.role.required = featured;
}

function openModal() {
    lastFocused = document.activeElement;
    D.form.reset();
    clearErrors();
    D.guestBox.hidden = true;
    D.guest.required = false;
    D.role.required = false;
    D.modal.classList.add('open');
    D.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const today = new Date().toISOString().slice(0, 10);
    D.sd.value = today;
    D.ed.value = today;
    D.sd.min = today;
    D.ed.min = today;
    D.title.focus();
    analytics('OPEN_MODAL');
}

function closeModal() {
    D.modal.classList.remove('open');
    D.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused?.focus) lastFocused.focus();
}

async function submitForm(event) {
    event.preventDefault();
    const data = { title: D.title.value, venue: D.venue.value, sd: D.sd.value, st: D.st.value, ed: D.ed.value, et: D.et.value, cat: D.cat.value, desc: D.desc.value, featured: D.featured.checked, guest: D.guest.value, role: D.role.value, password: D.password.value };
    clearErrors();
    const errors = formErrors(data);
    if (Object.keys(errors).length) { showErrors(errors); toast('Please correct the highlighted fields.', 'error'); return; }

    busy(D.submit, true, 'Saving...');
    try {
        const startsAt = new Date(`${data.sd}T${data.st}`).toISOString();
        const endsAt = new Date(`${data.ed}T${data.et}`).toISOString();
        const result = await api('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: clean(data.title), venue: clean(data.venue), starts_at: startsAt, ends_at: endsAt, category: data.cat, description: clean(data.desc), is_featured: data.featured, featured_person_name: clean(data.guest), featured_person_role: clean(data.role), password: data.password })
        });
        events = await load();
        closeModal();
        render();
        toast(`Event “${result.event?.title || data.title}” added successfully.`, 'success');
        analytics('ADD_EVENT', { eventId: result.event?.id, featured: data.featured });
    } catch (error) {
        toast(error.message || 'Unable to save the event. Please try again.', 'error');
    } finally { busy(D.submit, false); }
}

function focusTrap(event) {
    if (!D.modal.classList.contains('open') || event.key !== 'Tab') return;
    const focusable = [...D.modal.querySelectorAll('button, input, select, textarea')].filter(element => !element.disabled && !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

async function init() {
    D.loading.hidden = false;
    D.empty.hidden = true;
    try {
        events = await load();
        render();
    } catch (error) {
        console.error('Failed to load events:', error);
        D.empty.hidden = false;
        D.emptyTitle.textContent = 'Unable to load events';
        D.emptyDesc.textContent = 'Please check your internet connection and try again.';
        toast('Unable to connect to the event database. Please try again.', 'error');
    } finally { D.loading.hidden = true; }
}

D.status.forEach(button => button.addEventListener('click', () => setStatusFilter(button.dataset.status)));
D.search.addEventListener('input', () => { D.clear.classList.toggle('visible', Boolean(D.search.value)); render(); });
D.clear.addEventListener('click', () => { D.search.value = ''; D.clear.classList.remove('visible'); render(); D.search.focus(); });
D.category.addEventListener('change', render);
D.open.addEventListener('click', openModal);
D.close.addEventListener('click', closeModal);
D.cancel.addEventListener('click', closeModal);
D.modal.addEventListener('click', event => { if (event.target === D.modal) closeModal(); });
D.form.addEventListener('submit', submitForm);
D.featured.addEventListener('change', toggleGuest);
D.desc.addEventListener('input', () => { D.count.textContent = String(D.desc.value.length); });
D.ed.addEventListener('change', () => { if (D.ed.value < D.sd.value) D.ed.value = D.sd.value; });
D.modal.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); closeModal(); } else focusTrap(event); });
setInterval(() => { if (events.length) render(); }, 60000);
document.addEventListener('DOMContentLoaded', init);
