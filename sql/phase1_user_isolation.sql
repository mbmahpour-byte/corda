-- ============================================================================
-- Phase 1 — Per-user library isolation
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- IMPORTANT ordering: run this BEFORE deploying the matching app code.
--   - The new "Add Song" insert now sends user_id, which needs the column below.
--   - Once RLS is on, inserts WITHOUT user_id are rejected — so old code + new
--     schema also breaks. Run this and deploy the code together; don't add songs
--     in between.
--
-- IMPORTANT about auth.uid(): inside the SQL editor auth.uid() is NULL (it runs
-- as the service role, not as you). So you must paste your literal user id in the
-- backfill step. Find it at: Dashboard → Authentication → Users → your row → copy
-- the UID (uuid). Then replace PASTE-YOUR-AUTH-UID-HERE below.
-- ============================================================================

-- 1. Add an owner column to songs -------------------------------------------
alter table songs add column if not exists user_id uuid references auth.users(id);

-- 2. Claim all existing songs as yours --------------------------------------
--    Replace the placeholder with your real auth UID (see note above).
update songs
   set user_id = '151ccac9-ebea-4174-9f9a-c66f38e6d8a3'
 where user_id is null;

-- 3. Lock songs down so each user only sees their own -----------------------
alter table songs enable row level security;

drop policy if exists "own songs" on songs;
create policy "own songs" on songs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Protect setlists (should already be scoped — this makes it explicit) ----
alter table setlists enable row level security;

drop policy if exists "own setlists" on setlists;
create policy "own setlists" on setlists
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. Protect the setlist_songs join rows via their parent setlist ------------
alter table setlist_songs enable row level security;

drop policy if exists "own setlist_songs" on setlist_songs;
create policy "own setlist_songs" on setlist_songs
  for all
  using (
    exists (
      select 1 from setlists s
       where s.id = setlist_songs.setlist_id
         and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from setlists s
       where s.id = setlist_songs.setlist_id
         and s.user_id = auth.uid()
    )
  );

-- 6. Sanity check — should return ONLY your songs when run from the app,
--    and every row should now have a user_id:
--    select count(*) filter (where user_id is null) as orphaned,
--           count(*) as total
--      from songs;
