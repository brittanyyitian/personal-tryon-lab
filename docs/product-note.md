# Personal Try-On Lab

This is a private prototype for evaluating AI virtual try-on quality before building a full app.

The project is split into:

- `frontend/src`: the minimal browser UI
- `backend`: the local Node server and remote provider proxy

## Local-Only Privacy Rule

Local development can run without uploads, but the current personal testing flow defaults to remote try-on enabled with explicit non-private test-image consent checked in the UI. Images are read by the browser with `FileReader`, and saved notes stay in browser `localStorage`.

Remote provider calls should use non-private test images only.

Do not add external scripts, analytics, or remote image URLs without confirming that remote upload is intended.

## MVP Goal

Upload one or more person reference images and multiple outfit items, pick the active person/item on the board, run a try-on provider, compare generated results, then rate:

- identity similarity
- garment fidelity
- visual appeal

## Remote Provider Plan

Configured providers:

- Open-source Hugging Face / Gradio virtual try-on provider for the first free remote test
- FASHN Try-On / Try-On Max for the main try-on result
- Replicate IDM-VTON for an affordable non-commercial benchmark
- OpenAI image generation/editing for light beautification and editorial output

API keys are read by the local backend from `.env`:

```bash
cp .env.example .env
```

Then fill:

```bash
HF_VTON_SPACE=fashn-ai/fashn-vton-1.5
HF_VTON_API_NAME=/try_on
FASHN_API_KEY=
REPLICATE_API_TOKEN=
OPENAI_API_KEY=
```

Deployment steps live in `docs/deployment.md`.

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
