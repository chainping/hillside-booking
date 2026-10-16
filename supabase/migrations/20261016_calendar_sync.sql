-- Calendar sync outbox. Run once in Supabase SQL Editor after review.
-- Google credentials must never be stored in this database or in GitHub Pages.
create table if not exists public.booking_calendar_sync (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  google_event_id text,
  desired_state text not null default 'delete' check (desired_state in ('create','delete')),
  sync_status text not null default 'pending' check (sync_status in ('pending','processing','synced','error')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
alter table public.booking_calendar_sync enable row level security;
revoke all on public.booking_calendar_sync from anon, authenticated;
grant all on public.booking_calendar_sync to service_role;

create or replace function public.enqueue_booking_calendar_sync()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare wanted text;
begin
  wanted := case when new.status = 'approved' then 'create' else 'delete' end;
  if tg_op = 'UPDATE' and old.status = new.status
    and old.start_at is not distinct from new.start_at
    and old.end_at is not distinct from new.end_at
    and old.room_id is not distinct from new.room_id
    and old.activity_name is not distinct from new.activity_name then
    return new;
  end if;
  insert into public.booking_calendar_sync(booking_id,desired_state,sync_status,next_attempt_at,updated_at)
  values(new.id,wanted,'pending',now(),now())
  on conflict (booking_id) do update
  set desired_state=excluded.desired_state,
      sync_status='pending', attempts=0, next_attempt_at=now(),
      locked_at=null,last_error=null,updated_at=now();
  return new;
end;
$$;
drop trigger if exists trg_booking_calendar_sync on public.bookings;
create trigger trg_booking_calendar_sync after insert or update of status,start_at,end_at,room_id,activity_name
on public.bookings for each row execute function public.enqueue_booking_calendar_sync();

-- Backfill approved reservations. Existing Google events must be reconciled before
-- enabling the worker, otherwise a second event could be created.
insert into public.booking_calendar_sync(booking_id,desired_state)
select id,'create' from public.bookings where status='approved'
on conflict (booking_id) do nothing;

create or replace function public.claim_booking_calendar_sync(p_limit integer default 10)
returns table(booking_id uuid, desired_state text, google_event_id text,
              room_id text, activity_name text, start_at timestamptz, end_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  return query
  with picked as (
    select q.booking_id from public.booking_calendar_sync q
    where (q.sync_status in ('pending','error') and q.next_attempt_at <= now())
       or (q.sync_status='processing' and q.locked_at < now()-interval '10 minutes')
    order by q.updated_at
    for update skip locked
    limit least(greatest(p_limit,1),30)
  ), claimed as (
    update public.booking_calendar_sync q
    set sync_status='processing',locked_at=now(),attempts=q.attempts+1,updated_at=now()
    from picked p where q.booking_id=p.booking_id
    returning q.booking_id,q.desired_state,q.google_event_id
  )
  select c.booking_id,c.desired_state,c.google_event_id,
         b.room_id,b.activity_name,b.start_at,b.end_at
  from claimed c join public.bookings b on b.id=c.booking_id;
end;
$$;
revoke all on function public.claim_booking_calendar_sync(integer) from public,anon,authenticated;
grant execute on function public.claim_booking_calendar_sync(integer) to service_role;

create or replace function public.complete_booking_calendar_sync(
  p_booking_id uuid,p_desired_state text,p_event_id text,p_error text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  update public.booking_calendar_sync q set
    google_event_id=case when p_error is null then p_event_id else q.google_event_id end,
    sync_status=case when p_error is null then 'synced' else 'error' end,
    last_error=left(p_error,500),
    locked_at=null,
    next_attempt_at=case when p_error is null then now()
      else now()+make_interval(mins=>least(120,power(2,least(q.attempts,7))::integer)) end,
    updated_at=now()
  where q.booking_id=p_booking_id and q.desired_state=p_desired_state and q.sync_status='processing';
end;
$$;
revoke all on function public.complete_booking_calendar_sync(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_booking_calendar_sync(uuid,text,text,text) to service_role;
