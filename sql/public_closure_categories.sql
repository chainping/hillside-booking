-- Run manually in Supabase SQL Editor after reviewing permissions.
-- Public-safe closure categories only; never expose internal_reason or created_by.
create or replace function public.public_closure_categories(from_time timestamptz, to_time timestamptz)
returns table(room_id text, start_at timestamptz, end_at timestamptz, category text)
language sql
stable
security definer
set search_path = ''
as $$
  select rb.room_id, rb.start_at, rb.end_at,
    case
      when rb.internal_reason = '寒假閉館' or rb.internal_reason like '寒假閉館｜%' then 'winter'
      when rb.internal_reason = '暑假閉館' or rb.internal_reason like '暑假閉館｜%' then 'summer'
      when rb.internal_reason = '臨時閉館' or rb.internal_reason like '臨時閉館｜%' then 'temporary'
      when rb.internal_reason = '其他全館停用' or rb.internal_reason like '其他全館停用｜%' then 'other'
      else 'unavailable'
    end as category
  from public.room_blocks rb
  where rb.start_at < to_time and rb.end_at > from_time
    and from_time < to_time
    and to_time <= from_time + interval '40 days'
  order by rb.start_at
  limit 1000;
$$;
revoke all on function public.public_closure_categories(timestamptz,timestamptz) from public;
grant execute on function public.public_closure_categories(timestamptz,timestamptz) to anon, authenticated;
