# Studio Ops — Creative Agency ERP (Single Manager Login)

The simplest version of the Studio Ops ERP: exactly one login for the
whole team — the manager's — created directly in Supabase, with no
signup form anywhere in the app. Everyone else on the team works
through the manager rather than having their own account. No billing,
no multi-user accounts, no per-agency data isolation.

**If you want each team member to have their own login instead**, use
the "single team" build — same shared data, but with a sign-up form so
everyone can create their own account. **If you're planning to sell
access to other agencies**, use the multi-tenant SaaS build, which
keeps each customer's data completely separate and has Stripe billing
wired in.

## 1. Create a Supabase project

1. https://supabase.com → **New project**.
2. **SQL Editor** → **New query** → paste all of `supabase/schema.sql` → **Run**.
   The comments explain the two portal functions (what let clients
   check project status without an account) and, in section 6, exactly
   how to create the one manager account this app needs.
3. **Project Settings → API**: copy the **Project URL** and the **anon
   public** key.
4. **Authentication → Users → Add user**: create the manager's login —
   an email and password (or use "Send invite link" to have them set
   their own password).
5. **Authentication → Providers → Email**: turn off "Allow new users
   to sign up". The app has no signup screen either way, but this
   closes the door on someone signing up directly against the
   Supabase API.

## 2. Configure and run locally

```bash
cd studio-ops-manager
npm install
cp .env.example .env
```

Fill in `.env` with the Supabase URL and anon key from step 1. Then:

```bash
npm run dev
```

## 3. Try it out

1. Sign in with the manager account you created in step 1 — this seeds
   the dataset with sample clients and projects.
2. Open a project, note its **portal code**, and test the **Client
   portal** link (on the sign-in screen, or from the sidebar once
   signed in) — a portal visitor with that code sees only that
   project's status and files, nothing else in the system.
3. Everyone else on the team uses the app either by looking over the
   manager's shoulder, or — if you want them editing data too — you'll
   want the "single team" build instead, which supports multiple
   logins against the same shared data.

## 4. Deploy

```bash
npm install -g vercel
vercel
```

Or via the dashboard: **Add New → Project**, import your repo (push it
to GitHub first). Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
as Environment Variables in the Vercel project settings, then deploy.
There's no `/api` folder in this build — it's a static site talking
directly to Supabase.

## What's different from the other builds

- No signup form anywhere in the app — `AuthScreen` is sign-in only.
  The one account is created by hand in the Supabase dashboard.
- Same shared `erp_state` row and Row Level Security as the "single
  team" build (`auth.role() = 'authenticated'`) — technically nothing
  stops you from creating a second Supabase user later if you change
  your mind, since the policies don't hardcode a single user ID. The
  enforcement that there's "only one user" is the missing signup form
  plus disabling public signup in Supabase, not a database-level rule.
- No `workspaces` table, no Stripe, no trial/billing UI.
- Everything else — ticket/stamp design, Kanban board, invoice
  auto-generation + PDF download, studio settings, file uploads, the
  client portal — is unchanged.

## Project structure

```
studio-ops-manager/
  src/
    App.jsx              the whole app: sign-in, shared data, all
                          views, the client portal, styles
    supabaseClient.js     Supabase client setup
    main.jsx              React entry point
  supabase/
    schema.sql             tables, RLS, storage policies, portal RPCs
  .env.example
  package.json
  vite.config.js
```
