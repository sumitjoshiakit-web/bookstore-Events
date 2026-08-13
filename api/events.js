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

function json(res, status, body) {
    return res.status(status).json(body);
}

function clean(value, maxLength) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\0/g, '').slice(0, maxLength);
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
        participants: Number(row.participants) > 0 ? 1 : 0,
        created_at: row.created_at
    };
}

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            const response = await supabaseRequest(
                'events?select=*&order=date.asc,time.asc,created_at.asc',
                { method: 'GET' }
            );

            if (!response.ok) {
                console.error('Supabase GET error:', await response.text());
                return json(res, 502, { error: 'Database read failed' });
            }

            const rows = await response.json();
            return json(res, 200, { events: rows.map(mapEvent) });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const adminPassword = process.env.ADMIN_PASSWORD || '';

            if (typeof body.password !== 'string' || body.password !== adminPassword) {
                return json(res, 401, { error: 'Invalid admin password' });
            }

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
