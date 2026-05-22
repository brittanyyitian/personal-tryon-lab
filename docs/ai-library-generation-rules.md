# AI Library Generation Rules

These rules define the paired assets used by the wardrobe AI Library. Each clothing item must ship as a bound set: one editorial model image, one product image, and one try-on input image of the same garment.

## Brand Direction

You are the visual director of a luxury summer fashion brand inspired by Zara editorial aesthetics.

Maintain a consistent visual identity across all generated fashion assets:

- premium
- minimal
- relaxed
- summer editorial
- Mediterranean inspired
- fashion magazine quality

The clothing item changes every time, but the visual language must remain consistent.

## Model Image

The model image is an editorial fashion image of the garment being worn.

Required:

- show the same clothing item as the paired product image
- never show the model's full face
- do not post-crop the generated image; generate the composition correctly in camera
- keep the garment visible and readable
- use soft natural sunlight
- show realistic fabric texture
- use clean shadows
- use elegant relaxed poses
- include subtle film grain
- keep an editorial composition
- create a vacation atmosphere without obvious beach elements

Avoid:

- full face
- logos or brand marks
- hangers
- mannequins
- heavy props
- beach, ocean, palm tree, or tourist-cliche backgrounds
- tight post-crops that hide the item shape

## Product Image

The product image is a clean ecommerce-style item image. It should match the current Ivory Summer Top reference.

Required:

- same clothing item as the paired model image
- front-facing garment on a simple wooden hanger
- neutral gray studio background
- centered composition
- full garment visible
- item fills the square as much as possible without cutting off edges
- realistic fabric texture
- soft clean shadow
- no model, no body, no mannequin
- no logo or brand marks

Avoid:

- flat lay
- invisible mannequin
- model wearing the item
- white or beige lifestyle backgrounds
- cropped-off garment edges
- extra duplicated garments
- text, tags, or watermarks

## Try-On Input Image

The try-on input image is the file passed to the website Generate flow as `garmentImage`.

In the AI Library data model this must be stored as `tryonUrl`. Uploaded items can keep using the uploaded image data URL directly, but library items must not infer try-on input from the currently displayed model/product view.

Required:

- use the same garment as the model and product images
- prefer the clean product image when it is front-facing, full garment, and has no visible logo or label
- use a normalized garment-only image if the visible product image has styling artifacts that hurt try-on
- preserve the garment structure that must transfer to the uploaded person
- keep enough image resolution for virtual try-on providers
- store this image separately from display thumbnails when needed

Avoid:

- editorial model images as the garment input
- cropped detail shots
- product images with visible brand labels or text
- images where the garment edge is cut off
- images where hanger, background, or shadow dominates the garment

## Acceptance Gate

Do not add an item to the AI Library until both images are accepted as a pair:

- the model image and product image clearly depict the same garment
- the model image follows the no-full-face rule without post-cropping
- the product image uses the hanger + gray background format
- both images are visually consistent with the existing library assets
- the try-on input image can be sent to Generate and produces a recognizable garment transfer on an uploaded model
