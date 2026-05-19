# Personal Try-On Lab

This is a private prototype for evaluating AI virtual try-on quality before building a full app.

The project is split into:

- `frontend/src`: the A Minimal browser UI
- `backend`: the local Node server and remote provider proxy

## Local-Only Privacy Rule

By default, the app starts in local mode and must not upload images or call remote APIs. Images are read by the browser with `FileReader`, mock outputs are generated on a local canvas, and saved notes stay in browser `localStorage`.

Remote provider calls are allowed only in Level 2 remote test mode, and only after the UI consent checkbox is enabled. Use non-private test images only.

Do not add external scripts, analytics, or remote image URLs without confirming that remote upload is intended.

## MVP Goal

Upload one person reference image and one garment image, run several try-on providers, compare the generated images side by side, then rate:

- identity similarity
- garment fidelity
- visual appeal

## Remote Provider Plan

Configured providers:

- FASHN Try-On / Try-On Max for the main try-on result
- Replicate IDM-VTON for an affordable non-commercial benchmark
- OpenAI image generation/editing for light beautification and editorial output

API keys are read by the local backend from `.env`:

```bash
cp .env.example .env
```

Then fill:

```bash
FASHN_API_KEY=
REPLICATE_API_TOKEN=
OPENAI_API_KEY=
```

## Provider Interface

Each provider implements the same backend interface:

```js
async function runTryOn({ personImage, garmentImage, mode }) {
  return {
    status: "success",
    imageUrl: "local-or-user-approved-provider-result",
    raw: {}
  };
}
```

The web tool should keep the comparison UI stable while provider code changes behind it.
