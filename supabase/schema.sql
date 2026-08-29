-- Studio Ops ERP — single-manager schema
-- Run this in your Supabase project's SQL Editor (Dashboard -> SQL Editor
-- -> New query -> paste -> Run). Written to run top-to-bottom, but if
-- anything errors, run it section by section -- the two functions near the
-- bottom haven't been run against a live database, only checked carefully
-- by hand; test them with the steps at the very end of this file.
--
-- What this schema is for: exactly one login (the manager's), created
-- directly in the Supabase dashboard -- the app itself has no signup form.
-- Everyone else on the team works through the manager rather than having
-- their own account. If you later want individual team-member logins
-- sharing one dataset, or separate agencies each with their own private
-- data to sell access to, ask for those variants -- both are small,
-- contained changes from this schema, not a rewrite.

-- 1) erp_state -- a single shared row holding the whole app's data as one
--    JSON document (clients, projects, tasks, invoices, settings).
create table if not exists erp_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2) project_files -- file metadata (bytes live in Storage, see step 4).
create table if not exists project_files (
  id text primary key,
  project_id text not null,
  name text not null,
  size bigint,
  type text,
  storage_path text not null,
  uploaded_at date not null default current_date
);

create index if not exists project_files_project_idx on project_files (project_id);

-- 3) Row Level Security -- restricted to signed-in team members only.
-- Nobody unauthenticated can read or write these tables directly. The
-- client portal (which IS meant to be reachable without an account)
-- instead goes through the two SECURITY DEFINER functions in step 5,
-- which hand back only a curated, safe subset of one project's data.
alter table erp_state enable row level security;
alter table project_files enable row level security;

create policy "erp_state_select_team" on erp_state
  for select using (auth.role() = 'authenticated');
create policy "erp_state_insert_team" on erp_state
  for insert with check (auth.role() = 'authenticated');
create policy "erp_state_update_team" on erp_state
  for update using (auth.role() = 'authenticated');

create policy "project_files_select_team" on project_files
  for select using (auth.role() = 'authenticated');
create policy "project_files_insert_team" on project_files
  for insert with check (auth.role() = 'authenticated');
create policy "project_files_delete_team" on project_files
  for delete using (auth.role() = 'authenticated');

-- 4) Storage bucket for uploaded project files.
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', true)
on conflict (id) do nothing;

-- Public read (so download links / portal downloads work without login).
-- Insert/delete require a signed-in team member.
create policy "project_files_bucket_read" on storage.objects
  for select using (bucket_id = 'project-files');

create policy "project_files_bucket_insert_team" on storage.objects
  for insert with check (bucket_id = 'project-files' and auth.role() = 'authenticated');

create policy "project_files_bucket_delete_team" on storage.objects
  for delete using (bucket_id = 'project-files' and auth.role() = 'authenticated');

-- 5) Client portal RPC functions -- the ONLY way an anonymous visitor can
--    reach any data. Both are SECURITY DEFINER (bypass RLS internally)
--    but each hand-picks exactly which fields it returns, so a portal
--    code can never leak a client's budget, other projects, or other
--    clients -- even though everything lives in one shared table.
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

-- File listing for the portal -- looks up the project by the same code,
-- then returns just that project's file rows.
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

-- 6) Create the manager's account
-- The app has no signup form, so create the one login by hand:
-- Supabase dashboard -> Authentication -> Users -> Add user. Set the
-- manager's email and a password there (or use "Send invite link" to have
-- them set their own password). That's the only account this app needs.
--
-- Also close the door Supabase leaves open by default: Authentication ->
-- Providers -> Email -> turn off "Allow new users to sign up". The app
-- never shows a signup form either way, but this stops someone from
-- signing up directly against the Supabase API and getting in anyway.

-- 7) TEST STEPS (run after everything above succeeds and you've created
--    the manager account):
--   a. Sign in as the manager in the deployed app so the shared erp_state
--      row gets seeded with sample data.
--   b. In the SQL editor: select data->'projects'->0->>'portalCode'
--      from erp_state limit 1;  -- copy that code.
--   c. select get_portal_project('THE-CODE-YOU-COPIED');
--      Should return project/client/tasks JSON, no budgets or invoices.
--   d. select * from get_portal_files('THE-CODE-YOU-COPIED');
--      Should return that project's files (empty is fine if none yet).
