# ANKOO: Verified Meta Account Audit

**Date:** 26 November 2026
**Method:** read-only, via Meta connection. Nothing was created, published or spent.

## 1. Verified account state

| Item | Verified finding |
|---|---|
| Business portfolio | "Felix Boluwaji E" (ID 548360149293666) |
| Ad account | "Felix Boluwaji E", `act_1033939003069672`. **Active** (status 1, no disable reason). Currency **NGN**, timezone Africa/Lagos. |
| Lifetime spend | **₦0**. The account has never run ads. |
| Account spend cap | **Not set** (0). To be set to the approved ₦300,000 before launch. |
| Balance | ₦0 |
| Minimum daily budget per ad set | ₦1,361. All planned ad sets (₦2,000–₦3,500) are above this. |
| Campaigns / ad sets / ads | **None** |
| Custom or lookalike audiences | **None.** Retargeting pools must be built from scratch, which is why Campaign B runs first. |
| Pixel / dataset | **None** |
| Facebook Pages reachable | "phebstyle" (109007180797132) and "Felix Boluwaji E" (1520324057824670). **No ANKOO Page.** |
| Instagram accounts linked | **None.** Neither Page has an Instagram account connected. |
| WhatsApp on Page | Not verifiable until the ANKOO Page exists and the number is linked |
| Payment method | **Not visible through this connection.** Check it in Meta Business Settings → Billing & payments. |

**Temporary connection note:** at ANKOO's instruction, Ads will run from a new ANKOO Page. The connection is temporarily pointed at "phebstyle" only so the account could be read. It will be switched to the ANKOO Page before anything is built. No ad will run from "phebstyle".

## 2. Blockers before Stage 3 (building paused drafts)

1. **Create (or rename to) an "ANKOO" Facebook Page** in the "Felix Boluwaji E" Business portfolio. Use the logo, forest-green cover, and the bio "Modern African luxury menswear. Bespoke Agbada, Kaftan & groom's wear. Akure · Lagos."
2. **Link the ANKOO Instagram account** to that Page (Business Suite → Settings → Linked accounts).
3. **Link WhatsApp Business +234 816 545 2482** to the ANKOO Page (Page settings → Linked accounts → WhatsApp).
4. **Add or confirm a payment method** on ad account `act_1033939003069672`.
5. **ARCON vetting** for Nigerian-facing ads. Confirm the requirement and process.

## 3. Targeting verified against Meta (this account)

### Interests (all valid)
| Interest | ID |
|---|---|
| Weddings (social concept) | 6003409392877 |
| Engagement (weddings) | 6003360603580 |
| Wedding dress (weddings) | 6003402319418 |
| Bespoke tailoring | 6018455590244 |
| Suit (clothing) | 6003467486537 |
| Haute couture (clothing) | 6004107864209 |
| Luxury goods (retail) | 6007828099136 |
| Fashion design (design) | 6003266266843 |
| men's fashion (retail) | 6003281862210 |
| Men's clothing retailers (retail) | 6926840667413 |

**Not available:** "Menswear" (returned invalid), "Agbada", "African fashion", "Nigerian culture". These will not be used. The Agbada and heritage angle is carried by the creative and copy instead.

### Life events (available)
| Life event | ID |
|---|---|
| Newly engaged (6 months) | 6002714398772 |
| Newly engaged (1 year) | 6003050210972 |

### Locations
| Location | Meta key |
|---|---|
| Lagos State (region) | 2607 |
| Lekki, Lagos (city) | 1630978 |
| Ikeja (city) | 1625140 |
| Akure, Ondo State (city) | 1612934 |

### Reach estimates (Meta, ages 25–50, wedding + tailoring interests OR newly engaged)
| Ad set | Estimated audience |
|---|---|
| C1 Lagos State | **1.9M – 2.3M** people |
| C2 Akure +40 km | **153K – 181K** people |

These are Meta's audience-size estimates, not predicted reach. At ₦3,500 and ₦2,500 per day, neither audience will be exhausted in 30 days. Frequency will be monitored in Akure, where the pool is smaller.

## 4. Ad set targeting specs (ready to build once the ANKOO Page exists)

**C1 Lagos, Wedding & Occasion → WhatsApp, ₦3,500/day**
```json
{"geo_locations":{"regions":[{"key":"2607"}]},"age_min":25,"age_max":50,
 "flexible_spec":[{"interests":[{"id":"6003409392877"},{"id":"6003360603580"},{"id":"6003402319418"},
 {"id":"6018455590244"},{"id":"6003467486537"},{"id":"6004107864209"}],
 "life_events":[{"id":"6002714398772"},{"id":"6003050210972"}]}]}
```

**C2 Akure + Ondo/Ekiti, Wedding & Occasion → WhatsApp, ₦2,500/day**
Same as C1, with `"geo_locations":{"cities":[{"key":"1612934","radius":40,"distance_unit":"kilometer"}]}`. Ado-Ekiti and Ondo town keys will be added once they are looked up.

**B1 Craftsmanship → ThruPlay, ₦2,000/day**
Lagos State + Akure (+40 km), ages 25–50, interests: Bespoke tailoring, Suit, Haute couture, Luxury goods, men's fashion (retail), Fashion design.

**E1 Retargeting → WhatsApp, ₦2,000/day from day 8**
Video viewers (ThruPlay) and Page/IG engagers, last 30 days. Excludes people who messaged in the last 7 days. These audiences are created after B1 has run for about 7 days.

## 5. Draft build status (Stage 3), 26 Nov 2026

Everything below is **PAUSED**. Nothing has spent money.
The Page used for now is "Felix Boluwaji E" (1520324057824670), as a stand-in until the ANKOO Page is visible to the connection.

| Level | Name | ID | Status |
|---|---|---|---|
| Campaign | ANK_C_Wedding_WA_NG_2026-12 (Engagement) | 120254661186600606 | PAUSED. No ad sets yet. |
| Campaign | ANK_B_Craft_ThruPlay_NG_2026-12 (Awareness) | 120254661193330606 | PAUSED |
| Ad set | B1_Lagos-Akure-Ibadan-Abuja_25-50_Craft, ₦2,000/day, ThruPlay | 120254661216060606 | PAUSED. No ads yet. |
| Campaign | ANK_E_Retarget_WA_NG_2026-12 (Engagement) | 120254661194250606 | PAUSED. No ad sets yet. |

### Blocked items
1. **C1 Lagos and C2 Akure WhatsApp ad sets.** Meta refused them: *"Page with WhatsApp Business account required. Your Page is not linked to a WhatsApp account."* Fix: link WhatsApp +234 816 545 2482 to the **ANKOO** Page, and make the ANKOO Page visible to the connection (re-login, selecting ANKOO).
2. **B1 ads.** ThruPlay needs **video**. The Drive videos exceed the 10 MB download limit. Fix: export 15–30 s vertical clips under 10 MB, or upload them directly to Ads Manager's media library.
3. **E1 retargeting ad set.** Needs video-viewer and engager audiences, which can't exist until B and C have run for about a week.
4. **Account spend limit (₦300,000).** Not settable through this connection. Set it in Ads Manager → Billing & payments → Account spending limit.

## 6. Creative assets in the Meta media library (26 Nov 2026)

ANKOO confirmed that the garments are ANKOO-made, that the couple, groomsmen and photographers consent to paid-ad use, and that ARCON is handled.
All images were cropped only (no edits, no distortion), uploaded as **advertiser-supplied** (not AI-generated), and are reusable by any Page.

| Asset | Use | Size | Image hash |
|---|---|---|---|
| A2 Groom, ivory tuxedo | V1 hero, wedding | 1080×1350 | d5128ef28dca046b11bc38dec771d58b |
| A3 Tailoring detail (B&W) | V3 craftsmanship | 1080×1350 | 1a2aa645fe6e70f4e34287213445e4e4 |
| A4 Groom + groomsmen | V2 groom & his men | 1080×1350 | 96514d5be8beb8ea0515259774536fc1 |
| A5 Couple (B&W) | V5 retargeting / carousel | 1080×1350 | 12c919da40b44e0f9c92028b26facf8b |
| A7 Groom portrait | Carousel card | 1080×1350 | 04ee3ea6b9eee139c17ceb774bd64cde |
| A1 Studio mural | V4 heritage, feed | 1080×1350 | 1cd31a72e86c0b25308005add454a816 |
| A1 Studio mural | V4 heritage, Stories/Reels | 1080×1920 | ecf6a6b49509750c4a16a627804bab8a |

**Ads not yet created on purpose:** an ad is tied to a Page. Ads made on the stand-in Page would need rebuilding on ANKOO, and WhatsApp ads are refused until a Page has WhatsApp linked. They will be created once the ANKOO Page (with WhatsApp) is visible to the connection.
