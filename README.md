# ARCA

ARCA is a Next.js and Supabase digital trading-card vault. This repository is currently in a backend stabilization phase: new product features should wait until the database, storage, and security foundation has been verified in Supabase.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Storage, and RLS
- OpenAI Responses API for card autofill and image boundary detection

## Environment Variables

Create `.env.local` for local development:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
OPENAI_API_KEY=your-openai-api-key
OPENAI_VISION_MODEL=gpt-4.1-mini
NEXT_PUBLIC_ENABLE_OPENCV_SCANNER=false
```

`NEXT_PUBLIC_ENABLE_OPENCV_SCANNER` controls OpenCV edge detection in the scanner. Leave `false` until edge detection is stable; manual guide-frame capture works without it.

`OPENAI_API_KEY` is required for `/api/card-autofill` and `/api/card-detection`. `OPENAI_VISION_MODEL` is optional; the app falls back to `gpt-4.1-mini` for autofill and `gpt-4.1` for card detection when unset.

Do not expose a Supabase service-role key in any `NEXT_PUBLIC_` variable.

## Supabase Setup

1. Create a Supabase project.
2. Configure email/password authentication.
3. Apply the migrations in `supabase/migrations` in timestamp order.
4. Verify the following tables exist:
   - `profiles`
   - `collections`
   - `cards`
   - `card_images`
   - `card_training_events`
   - `user_follows`
5. Verify the following storage buckets exist and are private:
   - `card_images`
   - `collection_covers`
   - `card_training_images`
6. Verify RLS is enabled on every public table above.
7. Verify the app can read private images through signed URLs and public images only when the related collection is public.

The baseline migration is `20260619000000_baseline_schema.sql`. It defines the core schema, storage buckets, grants, RLS policies, and indexes needed by the app. Later migrations remain in place for historical hardening and compatibility with existing projects.

## Required Indexes

The baseline migration includes the currently required scale indexes:

- `cards(owner_id, created_at desc)`
- `cards(collection_id, created_at desc)`
- `collections(owner_id, created_at desc)`
- `collections(visibility, created_at desc)`
- `user_follows(follower_id)`
- `user_follows(following_id)`
- `card_images(card_id)`
- `card_training_events(user_id, created_at desc)`

Run Supabase advisors after applying migrations and before production launch.

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

Run checks:

```bash
npm run lint
npx tsc --noEmit --incremental false --pretty false
```

## Deployment

For Vercel or a similar host:

1. Set the environment variables listed above.
2. Apply Supabase migrations before directing production traffic to the deployment.
3. Confirm auth redirect URLs include the deployed origin and `/auth/callback`.
4. Confirm private storage images render in the deployed app.
5. Confirm OpenAI-backed API routes return configured responses rather than setup errors.

## Card CRUD Reliability Notes

The current card create, edit, and delete flows are still browser-orchestrated Supabase operations. They now sit on a stronger RLS and storage baseline, but the next backend hardening step should move multi-step mutations into transactional database RPCs or server routes.

Recommended order:

1. Create `create_card_with_images` as a Postgres RPC or server route that validates collection ownership, inserts the card, inserts front/back image rows, and archives training metadata as one unit where possible.
2. Create `update_card_with_images` to replace image rows and card metadata without client-side rollback logic.
3. Create `delete_card_safely` to delete card rows, image rows, and storage objects with a clear failure report.

Storage object deletion cannot be fully transactional with Postgres row changes, so server-side orchestration should record cleanup failures and retry them.

## Pending Product Integrations

Recent sales, pricing, marketplace, grading prediction, and display image lookup are not live integrations yet. UI copy should continue to describe these as pending until real providers and validation rules are connected.
