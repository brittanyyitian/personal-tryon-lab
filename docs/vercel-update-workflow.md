# Vercel Update Workflow

This project is deployed by pushing `main` to GitHub. Do not guess the Vercel URL or run a new Vercel project setup.

## Current Deployment

- GitHub repo: `https://github.com/brittanyyitian/personal-tryon-lab`
- Branch: `main`
- Vercel project: `ai-tryon-lab`
- Production URL: `https://ai-tryon-lab.vercel.app`
- Main studio page: `https://ai-tryon-lab.vercel.app/studio-flow.html`

## Push Local Changes To Vercel

Run these from the repo root:

```bash
cd /Users/edy/personal-tryon-lab
npm run check
git status --short
git add <changed-files>
git commit -m "Describe the change"
git push origin main
```

Vercel auto-deploys after `main` is pushed. There is normally no need to run `vercel`, `npx vercel`, or `vercel --prod`.

## Verify The Deploy

After pushing, wait for Vercel to build, then check the live page:

```bash
curl -I https://ai-tryon-lab.vercel.app/studio-flow.html
```

Expected:

```text
HTTP/2 200
server: Vercel
```

To confirm a specific frontend change is live, search the deployed HTML for a unique string from the change:

```bash
curl -sS https://ai-tryon-lab.vercel.app/studio-flow.html | rg "unique-string-from-change"
```

For static assets, check their deployed paths directly:

```bash
curl -I https://ai-tryon-lab.vercel.app/assets/library/example.png
```

Library item images use versioned filenames, for example `item-name-product-v1.png`, and are served with a long immutable browser cache. If an image changes, add a new versioned filename such as `item-name-product-v2.png` and update the reference in `studio-flow.html`. Do not overwrite an existing versioned image with different content.

## If The New Version Is Not Live Yet

1. Confirm the commit was pushed:

```bash
git log -1 --oneline
git status --short
```

2. Wait a minute and retry the `curl` check. Vercel can take a short time to finish production deployment.

3. If it still is not live, open Vercel project `ai-tryon-lab`, go to `Deployments`, and confirm the latest deployment from `main` is `Ready`.

## Network Notes

If local `curl` fails with DNS resolution inside Codex, retry with network approval instead of changing the deployment flow. The correct production URL remains:

```text
https://ai-tryon-lab.vercel.app
```
