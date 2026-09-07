# Studio Ops — Creative Agency ERP (Per-Account Data)

Every account that signs up gets its own private workspace — clients,
projects, tasks, invoices, expenses, time entries, files, and studio
settings (logo, colors, invoice branding) all live under that one
account and no other account can see them. There's no shared "team"
row: sign-up is self-service from the app's own screen, and the first
sign-in seeds a fresh account with sample data to explore.

The one thing every account still shares is code, not data: each
project gets a random **portal code**, and anyone with that code can
open the read-only **Client portal** to check a single project's
status and files — without an account, and without seeing which
account owns it, its budget, or anything else in that workspace.

## 1. Create a Supabase project

1. https://supabase.com → **New project**.
2. **SQL Editor** → **New query** → paste all of `supabase/schema.sql` → **Run**.
   The comments explain the storage/RLS setup and the two portal
   functions that let clients check project status without an account.
3. **Project Settings → API**: copy the **Project URL** and the **anon
   public** key.
4. **Authentication → Providers → Email**: make sure "Allow new users
   to sign up" is **ON** — the app's own "Create account" form calls
   `supabase.auth.signUp()`, so this needs to stay enabled for that to
   work. Turn it off only if you'd rather add every account by hand via
   **Authentication → Users → Add user**.
5. Optional: **Authentication → Providers → Email → Confirm email**. If
   that's on, new users get a confirmation email before they can sign
   in — the app already shows a "check your email" message when that
   happens, no extra work needed.

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

1. Open the app and use **Create account** on the sign-in screen — this
   seeds that account's own workspace with sample clients and projects.
2. Open a project, note its **portal code**, and test the **Client
   portal** link (on the sign-in screen, or from the sidebar once
   signed in) — a portal visitor with that code sees only that
   project's status and files, nothing else in the system.
3. Sign up again with a different email to confirm the second account
   starts with its own separate workspace, not the first account's data.

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

## How the isolation works

- `erp_state` has one row per account, and the row's `id` **is** that
  account's Supabase auth user id. Row Level Security only lets a
  request read/write the row whose `id` matches `auth.uid()`.
- `project_files` carries a `user_id` column, checked the same way.
- Uploaded files live in Storage at `<user_id>/<project_id>/<file>`;
  bucket policies check that the first path segment matches
  `auth.uid()` before allowing an insert or delete. Downloads stay
  public (so client-portal file links work without login).
- The two portal RPC functions (`get_portal_project`,
  `get_portal_files`) are `SECURITY DEFINER`, so they bypass RLS
  on purpose — that's the only sanctioned way to reach across
  accounts, and each one hand-picks a narrow, safe set of fields.

## Project structure

```
studio-ops-manager/
  src/
    App.jsx              the whole app: sign-in/sign-up, per-account
                          data, all views, the client portal, styles
    supabaseClient.js     Supabase client setup
    main.jsx              React entry point
  supabase/
    schema.sql             tables, RLS, storage policies, portal RPCs
  .env.example
  package.json
  vite.config.js
```
