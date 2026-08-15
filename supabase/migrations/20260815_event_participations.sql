-- Bookstore Events: participation records
-- Run this migration in Supabase SQL Editor before deploying the API changes.

create table if not exists public.event_participations (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    participant_id uuid not null,
    created_at timestamptz not null default now(),

    constraint event_participations_event_participant_key
        unique (event_id, participant_id)
);

create index if not exists event_participations_event_id_idx
    on public.event_participations(event_id);

create index if not exists event_participations_participant_id_idx
    on public.event_participations(participant_id);
