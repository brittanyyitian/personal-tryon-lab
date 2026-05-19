# Personal Try-On Lab

This is a private prototype for evaluating AI virtual try-on quality before building a full app.

## MVP Goal

Upload one person reference image and one garment image, run several try-on providers, compare the generated images side by side, then rate:

- identity similarity
- garment fidelity
- visual appeal

## Provider Plan

The first implementation uses mock providers so the UI can be tested without API keys.

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
    imageUrl: "https://...",
    raw: {}
  };
}
```

The web tool should keep the comparison UI stable while provider code changes behind it.
