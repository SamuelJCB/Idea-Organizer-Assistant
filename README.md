# Project Hub

A personal app for capturing project ideas, keeping one clear next action on each, and parking or killing them cleanly.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS).

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Create the tables.** In the dashboard, open *SQL Editor*, paste the contents of
   `supabase/migrations/20261103000000_projects_and_logs.sql`, and run it.
   (Or with the Supabase CLI: `npx supabase link` then `npx supabase db push`.)
3. **Environment variables.** Copy `.env.example` to `.env.local` and fill in values from
   *Project Settings → API Keys* (the publishable key; the legacy `anon` key also works):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
4. **Auth URLs.** *Authentication → URL Configuration*:
   - Site URL: `http://localhost:3000` (change to the Vercel URL after deploying)
   - Redirect URLs: add `http://localhost:3000/auth/confirm` (and later `https://<your-app>.vercel.app/auth/confirm`)
5. **Magic-link email template (recommended).** *Authentication → Emails → Magic Link*: replace the link with
   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in</a>
   ```
   Without this, a link only works in the same browser that requested it, which often fails on phones
   (mail apps open links in their own browser).
6. **Run it:** `npm install` then `npm run dev`, and open http://localhost:3000.
7. **Seed your projects.** After signing in once, run `supabase/seed-samuel.sql` in the SQL Editor.

## Scripts

- `npm run dev`: development server
- `npm run build`: production build
- `npm run lint`: ESLint
- `npx tsc --noEmit`: type check

## Layout

- `supabase/migrations/`: schema, triggers, and RLS policies
- `src/proxy.ts`: refreshes the session and sends signed-out visitors to `/login`
- `src/lib/data.ts`: all reads; each one re-checks the signed-in user
- `src/app/actions.ts`: all writes (Server Actions)
- `src/app/page.tsx`: dashboard; `src/app/projects/[id]/page.tsx`: project detail
