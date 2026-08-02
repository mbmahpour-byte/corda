-- ============================================================================
-- Phase 2 — Per-user rate limiting for the AI proxy endpoints
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Backs the checkRateLimit() helper in api/_auth.js. Uses a fixed-window
-- counter keyed by (user_id, scope, time-bucket). The RPC runs SECURITY DEFINER
-- and reads auth.uid() from the caller's JWT, so the serverless function only
-- needs the user's own access token — no service-role key on the server.
--
-- `scope` isolates each endpoint's counter (e.g. 'claude' vs 'chords') so they
-- don't share — and drain — the same bucket. Safe to re-run: the counter data
-- is ephemeral (self-pruning), so this drops and recreates it cleanly.
-- ============================================================================

-- Old single-scope function (if a previous version was installed). The new
-- signature adds p_scope, so the old overload must be removed explicitly.
drop function if exists check_rate_limit(int, int);

-- Counter data is throwaway; recreate with scope in the key.
drop table if exists rate_limits;

-- 1. Counter table. One row per (user, endpoint, window); pruned by the function.
create table rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope   text not null,
  bucket  bigint not null,
  count   int not null default 0,
  primary key (user_id, scope, bucket)
);

-- Lock the table: no direct client access. Only the SECURITY DEFINER function
-- (which bypasses RLS) may touch it.
alter table rate_limits enable row level security;

-- 2. Atomic check-and-increment. Returns true if the request is allowed.
--    p_scope  = per-endpoint counter name (e.g. 'claude', 'chords')
--    p_limit  = max requests permitted within the window
--    p_window = window length in seconds (bucket granularity)
create or replace function check_rate_limit(p_scope text, p_limit int, p_window int default 60)
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

  -- Drop this user's stale buckets for THIS scope so the table stays tiny.
  delete from rate_limits
   where user_id = v_uid and scope = p_scope and bucket < v_bucket;

  insert into rate_limits (user_id, scope, bucket, count)
  values (v_uid, p_scope, v_bucket, 1)
  on conflict (user_id, scope, bucket)
  do update set count = rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Allow signed-in users to invoke the function (it self-scopes via auth.uid()).
grant execute on function check_rate_limit(text, int, int) to authenticated;
