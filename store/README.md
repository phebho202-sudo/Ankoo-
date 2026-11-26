# ANKOO: official website and online store

The ANKOO luxury fashion website: storefront, journal, customer accounts, Paystack checkout, WhatsApp support and an admin dashboard. It lives in `store/`, separate from the Ankoo bookkeeping app at the repository root, and deploys as its own service.

- **Brand audit and what is still needed from ANKOO:** [`docs/BRAND-AUDIT.md`](docs/BRAND-AUDIT.md)
- **Deploy (Railway, step by step):** [`docs/DEPLOY.md`](docs/DEPLOY.md)
- **Payments, email, WhatsApp, analytics, Meta ads:** [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md)

## What's included

| Area | Features |
|---|---|
| Storefront | Cinematic homepage, collections, shop with category/size/colour/price/availability filters and sorting, search, product pages with gallery, size and colour selection, stock status, related products, wishlist |
| Content | About page with the ÌTÀN ÀNKÓÒ series, Journal (episodes, documentaries, behind-the-scenes, campaigns, collaborations, culture) with YouTube/Vimeo/TikTok/Instagram embeds or uploaded video, editable policy pages, contact form |
| Commerce | Bag, discount codes (percentage, fixed, free delivery), configurable shipping zones (Akure, Lagos, other states, international, pickup), Paystack checkout, bespoke measurement notes, order confirmation and tracking, customer accounts and order history |
| Admin (`/admin`) | Sales dashboard and launch checklist, orders with status updates and customer emails, products with photographs/variants/stock, collections, customers, discounts, shipping, homepage and hero banners, journal, pages, testimonials, Instagram, media library, messages, WhatsApp log, subscribers, settings. Works on laptop and phone |
| Support | Floating WhatsApp button with context-aware messages; optional automated WhatsApp replies for routine questions using ANKOO's approved texts |
| SEO and marketing | Page titles and descriptions, canonical URLs, Product/Organization/Article/Breadcrumb structured data, Open Graph, XML sitemap, robots.txt, Google Analytics 4 and Meta Pixel (with consent), Search Console verification, product feed for Meta and Google catalogues |
| Security | scrypt passwords, hashed session tokens, CSRF protection, strict Content-Security-Policy, rate limiting, signed webhooks, server-side price and stock checks, no card data ever stored |

Nothing in the catalogue is invented: the store starts with no products, prices, delivery fees or testimonials. ANKOO adds real ones in the admin.

## Run locally

Needs Node.js 22.5 or newer. There are no dependencies to install.

```bash
cd store
npm start                                     # http://localhost:3000
npm run create-admin -- you@example.com "Your Name"   # prints a temporary password
npm test
```

Without `PAYSTACK_SECRET_KEY`, and outside production, checkout uses a clearly labelled **test payment** page so the whole flow can be tried. In production, checkout stays disabled until Paystack is connected.

## Configuration

All secrets are environment variables: see [`.env.example`](.env.example). Never commit real keys. Brand details (logo, WhatsApp number, email, socials, locations, support texts, analytics IDs, exchange rates) are edited in **Admin → Settings**, not in code.

## Project layout

```
src/server.js        entry point, route registration
src/app.js           HTTP plumbing: router, sessions, CSRF, security headers, gzip, static and media files
src/db.js            SQLite schema and first-run content
src/catalog.js       product queries          src/commerce.js   cart, discounts, shipping, orders
src/paystack.js      payments                 src/mailer.js     transactional email (Resend)
src/whatsapp.js      click-to-chat and Cloud API auto-replies
src/seo.js           JSON-LD, sitemap, robots, product feed
src/routes/          shop, content, account, checkout, admin
src/views/           site layout and components, admin UI kit
public/              CSS, JS, icons
test/                end-to-end tests (node:test)
```
