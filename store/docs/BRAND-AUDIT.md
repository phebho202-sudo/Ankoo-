# ANKOO brand audit (Phase 1) and creative direction (Phase 2)

## What was audited

| Source | Found |
|---|---|
| This GitHub repository | A separate, already-deployed product, the **Ankoo bookkeeping app** for traders. It has no fashion brand assets. Left untouched; the website was built in `store/`. |
| Google Drive: "Ankoo folder" | Two video files (a screen recording and a phone video, 30–260 MB). |
| Google Drive: "ANKOO Perfect Fit Footage.2" | Campaign clips: *Entrance clip*, *Entrance clip 2*, *Shopping clip*, *Measurement clip*, *ScreenRecording clip* (75–220 MB each, MOV/MP4). |
| Google Drive: `IMG_8712.JPG` | Photograph of a mural in the ANKOO space: men in agbada in forest green and gold with coral beads, a vine motif and geometric marks. Used (compressed) on the homepage story and About page, captioned neutrally. **Please confirm** it shows your space and may be published. |
| Google Drive: photographer folders (`smbellophotography`, `foalyphotoss`) | Event and wedding photographs of identifiable clients in ivory tailoring. **Not used**: they need the photographers' and clients' permission, and confirmation of which pieces are ANKOO's. |

**Not found anywhere:** the ANKOO logo file, a product list, prices, sizes, colours, fabric details, ÌTÀN ÀNKÓÒ scripts or text, the verified business email, the WhatsApp number, social media links, and the Akure and Lagos addresses. Following your rules, none of these were invented.

## What ANKOO needs to supply (all in the admin, no code)

1. **Logo**: Admin → Settings → Logo (SVG or transparent PNG). Until then, the name is set as a typographic wordmark.
2. **Contact details**: WhatsApp number, verified business email, Instagram/Facebook/TikTok links, Akure and Lagos addresses (Admin → Settings).
3. **Products**: name, photographs, description, fabric, care, sizes, colours, stock and price in ₦ (Admin → Products).
4. **Delivery fees** for Akure, Lagos, other states and international, plus any approved delivery estimates (Admin → Shipping). Checkout offers only zones with a fee you have set.
5. **Your story**: replace the starter About text, which uses only the brand description from the brief, and review the Delivery, Returns, Privacy and Terms pages (Admin → Pages).
6. **ÌTÀN ÀNKÓÒ episodes and campaign films**: upload to YouTube (best for long films and mobile data) and add each as a Journal story. The Drive clips are too large to serve directly. If you want a short silent hero loop, export a 10–20 second 1080p MP4 under about 15 MB and upload it in Admin → Hero banners.
7. **Hero photography**: one landscape and one portrait image (Admin → Hero banners).
8. **Testimonials**: real client quotes with permission only (Admin → Testimonials).

## Creative direction

- **Palette:** deep forest green `#16301F` (primary), warm ivory `#F5F0E6`, paper white `#FBF9F4`, earthy neutrals (sand `#D6C8AE`, clay `#8A6A48`) and a restrained gold `#B08D57`, used only for focus states and fine rules. The palette follows the mural's green and gold.
- **Type:** Cormorant Garamond for display, with full support for Yoruba diacritics (ÌTÀN ÀNKÓÒ). Manrope for text and small uppercase labels with wide letter-spacing.
- **Layout:** editorial. Full-bleed hero, generous white space, 4:5 product imagery, thin rules instead of boxes, no rounded corners, no gradients beyond a soft scrim that keeps text readable over photographs.
- **Motion:** minimal. Slow image zoom on hover and fades, disabled for visitors who prefer reduced motion.
- **Mobile first:** sticky add-to-bag bar, swipeable gallery, horizontal product rails, full-screen menu, a WhatsApp button on every page, 16px inputs (no zoom on iPhone) and a single-page checkout.

## Sitemap

```
/                      Home: hero, manifesto, collections, featured, new arrivals, story, journal, bestsellers, testimonials, Instagram, newsletter
/shop                  All pieces (filters: category, size, colour, price, availability; sort)
/collections/:slug     New Arrivals · Women · Men · Ready-to-Wear · Bespoke · Accessories (editable)
/product/:slug         Product details
/about                 The House + ÌTÀN ÀNKÓÒ + locations
/journal(/:slug)       Stories and films, filterable by category
/contact               Channels, locations, contact form
/cart  /checkout  /order/:number  /track
/login /register /account (orders, wishlist, profile)
/pages/:slug           Delivery, Returns, Size guide, Privacy, Terms
/admin                 Dashboard
```
