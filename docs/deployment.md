# Deployment Notes

This project is a small Node web service. It serves the frontend from `frontend/src` and exposes backend API routes from `backend/server.js`.

## Current GitHub Repo

- Repo: `https://github.com/brittanyyitian/personal-tryon-lab`
- Visibility: private
- Branch: `main`

## Option A: Vercel

Vercel can host the frontend and the API Functions in this repo.

Current Vercel files:

- `vercel.json`: rewrites `/`, `/styles.css`, and `/app.js` to the existing frontend files
- `api/config.js`: Vercel Function for `/api/config`
- `api/tryon.js`: Vercel Function for `/api/tryon`

Deploy steps:

1. Open `https://vercel.com`.
2. Sign in with GitHub.
3. Click `Add New` -> `Project`.
4. Select `brittanyyitian/personal-tryon-lab`.
5. Keep the framework as `Other`.
6. Build settings can stay mostly empty/default:

```text
Install Command: npm install
Build Command: leave empty
Output Directory: leave empty
```

7. Add environment variables:

```text
HF_VTON_SPACE=fashn-ai/fashn-vton-1.5
HF_VTON_API_NAME=/try_on
HF_TOKEN=
HF_ITEM_CLASSIFIER_MODELS=patrickjohncyh/fashion-clip,Marqo/marqo-fashionCLIP,openai/clip-vit-large-patch14
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JOB_TABLE=tryon_jobs
SUPABASE_RESULT_BUCKET=tryon-results
```

`HF_TOKEN` enables remote visual item classification before try-on. Without it, item type detection falls back to filename and image-shape hints, and the user can still manually correct the type in the UI.

Optional paid/API providers:

```text
OPENAI_API_KEY=
FASHN_API_KEY=
REPLICATE_API_TOKEN=
```

8. Click `Deploy`.

Vercel will provide a URL like:

```text
https://personal-tryon-lab.vercel.app
```

Important limitation: Vercel Functions are not long-running workers. The direct `/api/tryon` flow can time out if the AI provider queues for too long. The more stable production design is:

```text
POST /api/jobs -> save job in Supabase
worker/provider -> generate image
GET /api/jobs/:id -> poll result
```

That job queue flow should be added when Supabase is introduced.

## Supabase Setup

Supabase is optional for local tests, but recommended for deployed tests because it records every generation attempt.

1. Create a Supabase project.
2. Open `SQL Editor`.
3. Paste and run `supabase/schema.sql`.
4. Open `Project Settings` -> `API`.
5. Copy these values into Vercel environment variables:

```text
SUPABASE_URL=<Project URL>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

Use the service role key only on the server side. Do not expose it in frontend code.

The current integration stores:

- one `tryon_jobs` row per generation
- status: `running`, `succeeded`, or `failed`
- provider, mode, item type, garment source
- generated result image data URL and private Storage path when available

The current integration does not yet add user login or per-user asset libraries. That should come next with Supabase Auth and private Storage paths.

## Option B: Render

Use Render as a Web Service, not GitHub Pages. GitHub Pages cannot run the backend API.

1. Open `https://render.com`.
2. Sign in with GitHub.
3. Click `New` -> `Web Service`.
4. Select `brittanyyitian/personal-tryon-lab`.
5. Use these settings:

```text
Runtime: Node
Branch: main
Build Command: npm install
Start Command: npm start
```

6. Add the same environment variables listed above.
7. Click `Deploy`.

Render will provide a public URL like:

```text
https://your-service-name.onrender.com
```

## Cost Notes

Render can be tested on the free tier. Free services may sleep when inactive, so the first page load can be slow.

AI model costs are separate from hosting:

- Hugging Face Space can be free but may queue or be unstable.
- OpenAI, FASHN, and Replicate usually require separate paid API usage.
- ChatGPT Plus/Pro subscription does not include OpenAI API credits.

## Privacy Notes

Local development keeps images on your machine unless remote mode is enabled.

After deployment, uploaded images pass through the deployed Render service and then to the enabled remote provider when generating. Use non-private test images only unless the privacy model is redesigned.

Before sharing widely, add an access password or login gate.

## Updating The Deployed Site

After editing locally:

```bash
npm run check
git status --short
git add .
git commit -m "Describe the change"
git push
```

Render should auto-deploy from the `main` branch after push. If it does not, open the Render service dashboard and click `Manual Deploy`.

## Local Run

```bash
npm install
npm start
```

Then open:

```text
http://127.0.0.1:4173
```
