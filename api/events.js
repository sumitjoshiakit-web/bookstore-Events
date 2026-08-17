/**
 * Vercel Serverless Function - Bookstore Events database API
 * Supabase service-role key is used only on the server.
 */

const ALLOWED_CATEGORIES = new Set([
    'book-club',
    'author-event',
    'workshop',
    'reading',
    'signing'
]);

const PARTICIPANT_COOKIE = 'bookstore_participant_id';
const PARTICIPANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;

function json(res, status, body) {
    return res.status(status).json(body);
}

function clean(value, maxLength) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\0/g, '').slice(0, maxLength);
}

function getAdminPassword(req) {
    const auth = typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : '';

    if (auth.startsWith('Bearer ')) {
        return auth.slice(7);
    }

    const body = req.body || {};
    return typeof body.password === 'string' ? body.password : '';
}

function requireAdmin(req, res) {
    const configured = process.env.ADMIN_PASSWORD || '';
    const supplied = getAdminPassword(req);

    if (!configured || supplied !== configured) {
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
        if (index === -1) continue;
        const name = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        if (name) cookies[name] = value;
    }

    return cookies;
}

function isUuid(value) {
    return typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getOrCreateParticipantId(req, res) {
    const cookies = parseCookies(req);
    const existing = cookies[PARTICIPANT_COOKIE];

    if (isUuid(existing)) {
        return existing;
    }

    const participantId = crypto.randomUUID();
    const cookie = [
        `${PARTICIPANT_COOKIE}=${participantId}`,
        `Max-Age=${PARTICIPANT_COOKIE_MAX_AGE}`,
        'Path=/',
        'HttpOnly',
        'Secure',
        'SameSite=Lax'
    ].join('; ');

    res.setHeader('Set-Cookie', cookie);
    return participantId;
}

async function supabaseRequest(path, options = {}) {
    const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!url || !key) {
        throw new Error('Supabase environment variables are not configured');
    }

    return fetch(url + '/rest/v1/' + path, {
        ...options,
        headers: {
            apikey: key,
            Authorization: 'Bearer ' + key,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
}

function mapEvent(row) {
    return {
        id: row.id,
        title: row.title,
        venue: row.venue,
        date: row.date,
        time: row.time,
        category: row.category,
        description: row.description,
        participants: Number(row.participants) || 0,
        created_at: row.created_at
    };
}

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            // Keep this query limited to the columns used by the application.
            // In particular, do not require an optional created_at column just to sort events.
            const response = await supabaseRequest(
                'events?select=id,title,venue,date,time,category,description,participants&order=date.asc,time.asc',
                { method: 'GET' }
            );

            if (!response.ok) {
                const details = await response.text();
                console.error('Supabase GET error:', details);
                return json(res, 502, { error: 'Database read failed' });
            }

            const rows = await response.json();
            return json(res, 200, { events: rows.map(mapEvent) });
        }

        if (req.method === 'POST') {
            const body = req.body || {};

            if (body.action === 'participate') {
                const eventId = clean(body.eventId, 100);
                if (!isUuid(eventId)) {
                    return json(res, 400, { error: 'Valid event id is required' });
                }

                const participantId = getOrCreateParticipantId(req, res);

                const eventResponse = await supabaseRequest(
                    'events?id=eq.' + encodeURIComponent(eventId) + '&select=id,participants',
                    { method: 'GET' }
                );

                if (!eventResponse.ok) {
                    console.error('Supabase event lookup error:', await eventResponse.text());
                    return json(res, 502, { error: 'Database read failed' });
                }

                const eventRows = await eventResponse.json();
                if (!eventRows.length) {
                    return json(res, 404, { error: 'Event not found' });
                }

                const participationResponse = await supabaseRequest(
                    'event_participations',
                    {
                        method: 'POST',
                        headers: { Prefer: 'return=representation' },
                        body: JSON.stringify({
                            event_id: eventId,
                            participant_id: participantId
                        })
                    }
                );

                if (participationResponse.status === 409) {
                    return json(res, 409, {
                        alreadyParticipated: true,
                        message: 'Your participation has already been recorded.'
                    });
                }

                if (!participationResponse.ok) {
                    console.error('Supabase participation insert error:', await participationResponse.text());
                    return json(res, 502, { error: 'Participation could not be recorded' });
                }

                const updateResponse = await supabaseRequest(
                    'events?id=eq.' + encodeURIComponent(eventId),
                    {
                        method: 'PATCH',
                        headers: { Prefer: 'return=representation' },
                        body: JSON.stringify({
                            participants: Number(eventRows[0].participants) + 1
                        })
                    }
                );

                if (!updateResponse.ok) {
                    console.error('Supabase participant count update error:', await updateResponse.text());
                    return json(res, 502, { error: 'Participation was recorded but count update failed' });
                }

                const updatedRows = await updateResponse.json();
                return json(res, 201, {
                    alreadyParticipated: false,
                    event: mapEvent(updatedRows[0])
                });
            }

            if (!requireAdmin(req, res)) return;

            const title = clean(body.title, 100);
            const venue = clean(body.venue, 100);
            const date = clean(body.date, 10);
            const time = clean(body.time, 5);
            const category = clean(body.category, 30);
            const description = clean(body.description, 500);

            if (title.length < 2 || venue.length < 2 || description.length < 5) {
                return json(res, 400, { error: 'Invalid event data' });
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
                return json(res, 400, { error: 'Invalid date or time' });
            }
            if (!ALLOWED_CATEGORIES.has(category)) {
                return json(res, 400, { error: 'Invalid category' });
            }

            const row = {
                id: crypto.randomUUID(),
                title,
                venue,
                date,
                time,
                category,
                description,
                participants: 0
            };

            const response = await supabaseRequest('events', {
                method: 'POST',
                headers: { Prefer: 'return=representation' },
                body: JSON.stringify(row)
            });

            if (!response.ok) {
                console.error('Supabase POST error:', await response.text());
                return json(res, 502, { error: 'Database insert failed' });
            }

            const rows = await response.json();
            return json(res, 201, { event: mapEvent(rows[0]) });
        }

        if (req.method === 'PATCH') {
            if (!requireAdmin(req, res)) return;

            const body = req.body || {};
            const id = clean(body.id, 100);
            const participants = Number(body.participants) > 0 ? 1 : 0;

            if (!id) return json(res, 400, { error: 'Event id is required' });

            const response = await supabaseRequest(
                'events?id=eq.' + encodeURIComponent(id),
                {
                    method: 'PATCH',
                    headers: { Prefer: 'return=representation' },
                    body: JSON.stringify({ participants })
                }
            );

            if (!response.ok) {
                console.error('Supabase PATCH error:', await response.text());
                return json(res, 502, { error: 'Database update failed' });
            }

            const rows = await response.json();
            if (!rows.length) return json(res, 404, { error: 'Event not found' });
            return json(res, 200, { event: mapEvent(rows[0]) });
        }

        if (req.method === 'DELETE') {
            if (!requireAdmin(req, res)) return;

            const url = new URL(req.url, 'http://localhost');
            const id = clean(url.searchParams.get('id') || '', 100);
            if (!id) return json(res, 400, { error: 'Event id is required' });

            const response = await supabaseRequest(
                'events?id=eq.' + encodeURIComponent(id),
                {
                    method: 'DELETE',
                    headers: { Prefer: 'return=representation' }
                }
            );

            if (!response.ok) {
                console.error('Supabase DELETE error:', await response.text());
                return json(res, 502, { error: 'Database delete failed' });
            }

            const rows = await response.json();
            if (!rows.length) return json(res, 404, { error: 'Event not found' });
            return json(res, 200, { deleted: true });
        }

        res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
        return json(res, 405, { error: 'Method not allowed' });
    } catch (error) {
        console.error('Events API error:', error);
        return json(res, 500, { error: 'Internal server error' });
    }
}
