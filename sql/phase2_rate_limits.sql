-- ============================================================================
-- Phase 2 — Per-user rate limiting for the AI proxy endpoints
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Backs the checkRateLimit() helper in api/_auth.js. Uses a fixed-window
-- counter keyed by (user_id, time-bucket). The RPC runs SECURITY DEFINER and
-- reads auth.uid() from the caller's JWT, so the serverless function only needs
-- the user's own access token — no service-role key on the server.
-- ============================================================================

-- 1. Counter table. One row per active user per window; pruned by the function.
create table if not exists rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket  bigint not null,
  count   int not null default 0,
  primary key (user_id, bucket)
);

-- Lock the table: no direct client access. Only the SECURITY DEFINER function
-- (which bypasses RLS) may touch it.
alter table rate_limits enable row level security;

-- 2. Atomic check-and-increment. Returns true if the request is allowed.
--    p_limit  = max requests permitted within the window
--    p_window = window length in seconds (bucket granularity)
create or replace function check_rate_limit(p_limit int, p_window int default 60)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid   := auth.uid();
  v_bucket bigint := floor(extract(epoch from now()) / p_window);
  v_count  int;
begin
  if v_uid is null then
    return false;  -- unauthenticated callers are never allowed
  end if;

  -- Drop this user's stale buckets so the table stays tiny.
  delete from rate_limits where user_id = v_uid and bucket < v_bucket;

  insert into rate_limits (user_id, bucket, count)
  values (v_uid, v_bucket, 1)
  on conflict (user_id, bucket)
  do update set count = rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Allow signed-in users to invoke the function (it self-scopes via auth.uid()).
grant execute on function check_rate_limit(int, int) to authenticated;
