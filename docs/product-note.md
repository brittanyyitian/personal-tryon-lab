# Personal Try-On Lab

This is a private, local-only prototype for evaluating AI virtual try-on quality before building a full app.

## Local-Only Privacy Rule

The current version must not upload images or call remote APIs. Images are read by the browser with `FileReader`, mock outputs are generated on a local canvas, and saved notes stay in browser `localStorage`.

Before adding any real provider, require an explicit code change and review. Do not add `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, external scripts, analytics, or remote image URLs without confirming that remote upload is intended.

## MVP Goal

Upload one person reference image and one garment image, run several try-on providers, compare the generated images side by side, then rate:

- identity similarity
- garment fidelity
- visual appeal

## Future Provider Plan

These providers are ideas for a later opt-in version only. They are not connected in the current local-only prototype.

The first implementation uses mock providers so the UI can be tested without API keys or remote network calls.

Planned real providers:

- FASHN Try-On / Try-On Max for the main try-on result
- Replicate IDM-VTON for an affordable non-commercial benchmark
- OpenAI image generation/editing for light beautification and editorial output

## Next API Integration Shape

Each provider should eventually implement the same interface:

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
