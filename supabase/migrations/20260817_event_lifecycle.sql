-- Event lifecycle and featured-event schema.
-- The current events table has no real event data yet, so this migration can be applied safely.

alter table public.events
    add column if not exists starts_at timestamptz,
    add column if not exists ends_at timestamptz,
    add column if not exists is_featured boolean not null default false,
    add column if not exists featured_person_name text,
    add column if not exists featured_person_role text;

alter table public.events
    add constraint events_time_order_check
    check (starts_at is null or ends_at is null or ends_at > starts_at);

alter table public.events
    add constraint events_featured_details_check
    check (
        is_featured = false
        or (
            nullif(trim(featured_person_name), '') is not null
            and nullif(trim(featured_person_role), '') is not null
        )
    );

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_ends_at_idx on public.events (ends_at);
