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
