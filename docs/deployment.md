# Deployment Notes

This project is a small Node web service. It serves the frontend from `frontend/src` and exposes backend API routes from `backend/server.js`.

## Current GitHub Repo

- Repo: `https://github.com/brittanyyitian/personal-tryon-lab`
- Visibility: private
- Branch: `main`

## Recommended Host: Render

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

6. Add environment variables:

```text
HF_VTON_SPACE=fashn-ai/fashn-vton-1.5
HF_VTON_API_NAME=/try_on
```

Optional paid/API providers:

```text
OPENAI_API_KEY=
FASHN_API_KEY=
REPLICATE_API_TOKEN=
```

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
