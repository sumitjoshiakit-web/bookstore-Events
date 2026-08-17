const ALLOWED_CATEGORIES = new Set(['book-club', 'author-event', 'workshop', 'reading', 'signing']);
const PARTICIPANT_COOKIE = 'bookstore_participant_id';
const PARTICIPANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;

function json(res, status, body) { return res.status(status).json(body); }
function clean(value, maxLength) { return typeof value === 'string' ? value.trim().replace(/\0/g, '').slice(0, maxLength) : ''; }
function getAdminPassword(req) {
    const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    if (auth.startsWith('Bearer ')) return auth.slice(7);
    return typeof (req.body || {}).password === 'string' ? req.body.password : '';
}
function requireAdmin(req, res) {
    const configured = process.env.ADMIN_PASSWORD || '';
    if (!configured || getAdminPassword(req) !== configured) {
        json(res, 401, { error: 'Invalid admin password' });
        return false;
    }
    return true;
}
function parseCookies(req) {
    const header = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
    const cookies = {};
    for (const part of header.split(';')) {
        const index = part.indexOf('=');
        if (index !== -1) cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
    }
    return cookies;
}
function isUuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function getOrCreateParticipantId(req, res) {
    const existing = parseCookies(req)[PARTICIPANT_COOKIE];
    if (isUuid(existing)) return existing;
    const participantId = crypto.randomUUID();
    res.setHeader('Set-Cookie', `${PARTICIPANT_COOKIE}=${participantId}; Max-Age=${PARTICIPANT_COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`);
    return participantId;
}
async function supabaseRequest(path, options = {}) {
    const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) throw new Error('Supabase environment variables are not configured');
    return fetch(url + '/rest/v1/' + path, {
        ...options,
        headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
}
function mapEvent(row) {
    return {
        id: row.id, title: row.title, venue: row.venue,
        starts_at: row.starts_at, ends_at: row.ends_at,
        category: row.category, description: row.description,
        is_featured: Boolean(row.is_featured),
        featured_person_name: row.featured_person_name || '',
        featured_person_role: row.featured_person_role || '',
        participants: Number(row.participants) || 0, created_at: row.created_at
    };
}
async function databaseError(response, operation) {
    const details = await response.text();
    console.error(`Supabase ${operation} error:`, details);
    let parsed = null;
    try { parsed = JSON.parse(details); } catch (_) {}
    return { error: `Database ${operation.toLowerCase()} failed`, details: parsed?.message || parsed?.hint || parsed?.details || details.slice(0, 500) };
}
function validIsoDateTime(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
}
function validateEvent(body) {
    const title = clean(body.title, 100), venue = clean(body.venue, 100);
    const startsAt = clean(body.starts_at, 40), endsAt = clean(body.ends_at, 40);
    const category = clean(body.category, 30), description = clean(body.description, 500);
    const isFeatured = body.is_featured === true;
    const guestName = clean(body.featured_person_name, 100), guestRole = clean(body.featured_person_role, 100);
    if (title.length < 2 || venue.length < 2 || description.length < 5) return { error: 'Title, venue and description are invalid' };
    if (!validIsoDateTime(startsAt) || !validIsoDateTime(endsAt)) return { error: 'Valid start and end date/time are required' };
    if (new Date(endsAt) <= new Date(startsAt)) return { error: 'End date and time must be after the start date and time' };
    if (!ALLOWED_CATEGORIES.has(category)) return { error: 'Invalid category' };
    if (isFeatured && (!guestName || !guestRole)) return { error: 'Featured person name and role are required for a featured event' };
    return { title, venue, startsAt, endsAt, category, description, isFeatured, guestName, guestRole };
}

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            const response = await supabaseRequest('events?select=id,title,venue,starts_at,ends_at,category,description,is_featured,featured_person_name,featured_person_role,participants,created_at&order=starts_at.asc', { method: 'GET' });
            if (!response.ok) return json(res, 502, await databaseError(response, 'READ'));
            return json(res, 200, { events: (await response.json()).map(mapEvent) });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            if (body.action === 'participate') {
                const eventId = clean(body.eventId, 100);
                if (!isUuid(eventId)) return json(res, 400, { error: 'Valid event id is required' });
                const participantId = getOrCreateParticipantId(req, res);
                const eventResponse = await supabaseRequest(`events?id=eq.${encodeURIComponent(eventId)}&select=id,participants,ends_at`, { method: 'GET' });
                if (!eventResponse.ok) return json(res, 502, await databaseError(eventResponse, 'READ'));
                const rows = await eventResponse.json();
                if (!rows.length) return json(res, 404, { error: 'Event not found' });
                if (new Date(rows[0].ends_at) <= new Date()) return json(res, 400, { error: 'This event has already ended.' });
                const participationResponse = await supabaseRequest('event_participations', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ event_id: eventId, participant_id: participantId }) });
                if (participationResponse.status === 409) return json(res, 409, { error: 'Your participation has already been recorded.', alreadyParticipated: true, message: 'Your participation has already been recorded.' });
                if (!participationResponse.ok) return json(res, 502, await databaseError(participationResponse, 'PARTICIPATION INSERT'));
                const updateResponse = await supabaseRequest(`events?id=eq.${encodeURIComponent(eventId)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ participants: Number(rows[0].participants) + 1 }) });
                if (!updateResponse.ok) return json(res, 502, await databaseError(updateResponse, 'PARTICIPANT COUNT UPDATE'));
                return json(res, 201, { alreadyParticipated: false, event: mapEvent((await updateResponse.json())[0]) });
            }
            if (!requireAdmin(req, res)) return;
            const validation = validateEvent(body);
            if (validation.error) return json(res, 400, { error: validation.error });
            const row = { id: crypto.randomUUID(), title: validation.title, venue: validation.venue, starts_at: validation.startsAt, ends_at: validation.endsAt, category: validation.category, description: validation.description, is_featured: validation.isFeatured, featured_person_name: validation.isFeatured ? validation.guestName : null, featured_person_role: validation.isFeatured ? validation.guestRole : null, participants: 0 };
            const response = await supabaseRequest('events', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
            if (!response.ok) return json(res, 502, await databaseError(response, 'INSERT'));
            return json(res, 201, { event: mapEvent((await response.json())[0]) });
        }

        if (req.method === 'PATCH') {
            if (!requireAdmin(req, res)) return;
            const body = req.body || {};
            const id = clean(body.id, 100);
            if (!id) return json(res, 400, { error: 'Event id is required' });
            const updates = {};
            if (body.starts_at !== undefined || body.ends_at !== undefined) {
                const current = await supabaseRequest(`events?id=eq.${encodeURIComponent(id)}&select=starts_at,ends_at`, { method: 'GET' });
                if (!current.ok) return json(res, 502, await databaseError(current, 'READ'));
                const row = (await current.json())[0];
                const starts = body.starts_at ?? row?.starts_at, ends = body.ends_at ?? row?.ends_at;
                if (!validIsoDateTime(starts) || !validIsoDateTime(ends) || new Date(ends) <= new Date(starts)) return json(res, 400, { error: 'End date and time must be after the start date and time' });
                updates.starts_at = starts; updates.ends_at = ends;
            }
            if (body.participants !== undefined) updates.participants = Math.max(0, Number(body.participants) || 0);
            if (!Object.keys(updates).length) return json(res, 400, { error: 'No valid fields to update' });
            const response = await supabaseRequest(`events?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(updates) });
            if (!response.ok) return json(res, 502, await databaseError(response, 'UPDATE'));
            const rows = await response.json();
            if (!rows.length) return json(res, 404, { error: 'Event not found' });
            return json(res, 200, { event: mapEvent(rows[0]) });
        }

        if (req.method === 'DELETE') {
            if (!requireAdmin(req, res)) return;
            const id = clean(new URL(req.url, 'http://localhost').searchParams.get('id') || '', 100);
            if (!id) return json(res, 400, { error: 'Event id is required' });
            const response = await supabaseRequest(`events?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
            if (!response.ok) return json(res, 502, await databaseError(response, 'DELETE'));
            if (!(await response.json()).length) return json(res, 404, { error: 'Event not found' });
            return json(res, 200, { deleted: true });
        }
        res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
        return json(res, 405, { error: 'Method not allowed' });
    } catch (error) {
        console.error('Events API error:', error);
        return json(res, 500, { error: 'Internal server error' });
    }
}
