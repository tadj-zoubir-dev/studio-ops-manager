-- Studio Ops ERP — multi-tenant schema (each account gets its own data)
-- Run this in your Supabase project's SQL Editor (Dashboard -> SQL Editor
-- -> New query -> paste -> Run). Written to run top-to-bottom, but if
-- anything errors, run it section by section.
--
-- What this schema is for: any number of accounts, each with their own
-- private workspace (clients, projects, tasks, invoices, files). Nobody
-- can see another account's data — everything is scoped by auth.uid().
-- The app's sign-up form creates the account; the first sign-in seeds
-- that account's own erp_state row automatically.
--
-- Upgrading from the older single-shared-team version of this schema?
-- See the MIGRATION note at the very bottom before running this.

-- 1) erp_state -- one row per account, holding that account's whole app
--    state as a JSON document (clients, projects, tasks, invoices,
--    settings). The row's id IS the owning user's auth.uid(), so RLS can
--    check ownership with a simple equality.
create table if not exists erp_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2) project_files -- file metadata (bytes live in Storage, see step 4).
--    user_id records which account owns the file, independent of which
--    project it's attached to.
create table if not exists project_files (
  id text primary key,
  project_id text not null,
  user_id uuid not null,
  name text not null,
  size bigint,
  type text,
  storage_path text not null,
  uploaded_at date not null default current_date
);

create index if not exists project_files_project_idx on project_files (project_id);
create index if not exists project_files_user_idx on project_files (user_id);

-- 3) Row Level Security -- every account can only read or write its own
-- rows. The client portal (which IS meant to be reachable without an
-- account) instead goes through the two SECURITY DEFINER functions in
-- step 5, which hand back only a curated, safe subset of one project's
-- data regardless of which account owns it.
alter table erp_state enable row level security;
alter table project_files enable row level security;

drop policy if exists "erp_state_select_team" on erp_state;
drop policy if exists "erp_state_insert_team" on erp_state;
drop policy if exists "erp_state_update_team" on erp_state;

create policy "erp_state_select_own" on erp_state
  for select using (id = auth.uid()::text);
create policy "erp_state_insert_own" on erp_state
  for insert with check (id = auth.uid()::text);
create policy "erp_state_update_own" on erp_state
  for update using (id = auth.uid()::text);

drop policy if exists "project_files_select_team" on project_files;
drop policy if exists "project_files_insert_team" on project_files;
drop policy if exists "project_files_delete_team" on project_files;

create policy "project_files_select_own" on project_files
  for select using (user_id = auth.uid());
create policy "project_files_insert_own" on project_files
  for insert with check (user_id = auth.uid());
create policy "project_files_delete_own" on project_files
  for delete using (user_id = auth.uid());

-- 4) Storage bucket for uploaded project files. The app uploads to
-- "<user_id>/<project_id>/<file>", so folder-based policies keep one
-- account from reading/deleting another account's objects. Downloads
-- stay public (so portal file links work without login) — only
-- insert/delete are ownership-checked.
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', true)
on conflict (id) do nothing;

drop policy if exists "project_files_bucket_read" on storage.objects;
drop policy if exists "project_files_bucket_insert_team" on storage.objects;
drop policy if exists "project_files_bucket_delete_team" on storage.objects;

create policy "project_files_bucket_read" on storage.objects
  for select using (bucket_id = 'project-files');

create policy "project_files_bucket_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "project_files_bucket_delete_own" on storage.objects
  for delete using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5) Client portal RPC functions -- the ONLY way an anonymous visitor can
--    reach any data. Both are SECURITY DEFINER (bypass RLS internally)
--    but each hand-picks exactly which fields it returns, and each
--    looks the project up by its portal code across every account's
--    erp_state row, so a portal code can never leak a client's budget,
--    other projects, other clients, or which account owns the project.
create or replace function get_portal_project(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  found_state jsonb;
  found_project jsonb;
  found_client jsonb;
  task_list jsonb;
begin
  select data into found_state
  from erp_state
  where exists (
    select 1 from jsonb_array_elements(coalesce(data->'projects', '[]'::jsonb)) p
    where upper(p->>'portalCode') = upper(p_code)
  )
  limit 1;

  if found_state is null then
    return null;
  end if;

  select p into found_project
  from jsonb_array_elements(found_state->'projects') p
  where upper(p->>'portalCode') = upper(p_code)
  limit 1;

  select c into found_client
  from jsonb_array_elements(coalesce(found_state->'clients', '[]'::jsonb)) c
  where c->>'id' = found_project->>'clientId'
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'title', t->>'title',
    'status', t->>'status',
    'dueDate', t->>'dueDate'
  )), '[]'::jsonb)
  into task_list
  from jsonb_array_elements(coalesce(found_state->'tasks', '[]'::jsonb)) t
  where t->>'projectId' = found_project->>'id';

  return json_build_object(
    'project', json_build_object(
      'id', found_project->>'id',
      'name', found_project->>'name',
      'status', found_project->>'status',
      'deadline', found_project->>'deadline',
      'description', found_project->>'description'
    ),
    'client', json_build_object('company', found_client->>'company'),
    'tasks', task_list
  );
end;
$$;

grant execute on function get_portal_project(text) to anon, authenticated;

-- File listing for the portal -- looks up the project by the same code
-- across every account, then returns just that project's file rows.
create or replace function get_portal_files(p_code text)
returns setof project_files
language plpgsql
security definer
set search_path = public
as $$
declare
  found_project_id text;
begin
  select (
    select p->>'id' from jsonb_array_elements(coalesce(data->'projects', '[]'::jsonb)) p
    where upper(p->>'portalCode') = upper(p_code)
    limit 1
  )
  into found_project_id
  from erp_state
  where exists (
    select 1 from jsonb_array_elements(coalesce(data->'projects', '[]'::jsonb)) p
    where upper(p->>'portalCode') = upper(p_code)
  )
  limit 1;

  if found_project_id is null then
    return;
  end if;

  return query
    select * from project_files
    where project_id = found_project_id
    order by uploaded_at desc;
end;
$$;

grant execute on function get_portal_files(text) to anon, authenticated;

-- 6) Let people sign up from the app.
-- The app now ships its own "Create account" form, which calls
-- supabase.auth.signUp(). For that to work: Dashboard -> Authentication
-- -> Providers -> Email -> make sure "Allow new users to sign up" is ON.
-- If you'd rather approve people yourself, turn that off and create
-- accounts by hand instead (Authentication -> Users -> Add user) — the
-- rest of this schema works identically either way, since isolation is
-- per-account, not per-signup-method.
--
-- If your project has "Confirm email" turned on (Authentication ->
-- Providers -> Email), new users get a confirmation email and can't sign
-- in until they click it — the app already shows a message telling them
-- to check their inbox in that case.

-- 7) TEST STEPS (run after everything above succeeds):
--   a. Sign up (or sign in) as a fresh account in the deployed app so
--      that account's own erp_state row gets seeded with sample data.
--   b. In the SQL editor: select id from erp_state; -- confirm each
--      account has its own row, keyed by its user id.
--   c. select data->'projects'->0->>'portalCode'
--      from erp_state where id = 'THAT-USER-ID';  -- copy that code.
--   d. select get_portal_project('THE-CODE-YOU-COPIED');
--      Should return project/client/tasks JSON, no budgets or invoices.
--   e. select * from get_portal_files('THE-CODE-YOU-COPIED');
--      Should return that project's files (empty is fine if none yet).
--   f. Sign in as a second, different account and confirm it sees an
--      empty/seeded workspace of its own — not the first account's data.

-- MIGRATION (only if you're upgrading from the old single-shared-team
-- schema, where every user shared one row with id = 'team'):
--   1. Decide which real auth user should keep that data going forward.
--   2. update erp_state set id = 'THAT-USERS-AUTH-UID' where id = 'team';
--   3. project_files.user_id didn't exist before this version — add it
--      with: alter table project_files add column if not exists user_id
--      uuid; then: update project_files set user_id = 'THAT-USERS-AUTH-UID'
--      where user_id is null; then re-run step 2 near the top of this
--      file to make it NOT NULL and add the index.
--   4. Existing files in the "project-files" bucket were stored at
--      "<project_id>/<file>" (no user id prefix). Either move them to
--      "<user_id>/<project_id>/<file>" in Storage, or keep the old
--      insert/delete policies for those legacy paths a bit longer while
--      new uploads use the new prefix.
