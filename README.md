# Supreme Nutrition — Fat Loss Kit landing page

Pure static site: **HTML + Tailwind CSS + vanilla JS**. No React / Next.js / framework. Hosts on **GitHub Pages** as-is.

UI migration of https://wellness-essentials-16.emergent.host/.

## Deploy on GitHub Pages
1. Push this folder's contents to a GitHub repo (root has `index.html`, `assets/`, `.nojekyll`).
2. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
3. Done. All paths are relative, so it works at `https://<user>.github.io/<repo>/` and on a custom domain.

`assets/css/styles.css` is the **compiled Tailwind CSS and is committed**, so GitHub Pages needs no build step.

## Editing styles (only if you change Tailwind classes)
Tailwind is used through its CLI; the files for it are `src/input.css`, `tailwind.config.js`, `package.json`.
```bash
npm install
npm run build     # regenerates assets/css/styles.css  (commit the result)
npm run watch:css # while editing
```
Preview locally with any static server, e.g. `python -m http.server` (or open `index.html`).

## Configuration — `assets/js/config.js`
| Setting | What to do |
|---|---|
| `whatsappNumber` | Digits, international format, e.g. `919876543210`. **Empty — the original site had no number.** Until set, the WhatsApp buttons show a "not configured" note. |
| `razorpayPaymentLinks` / `razorpayPaymentPage` | Razorpay payment URL(s) — see below. Empty until you add them. |
| `contactEmail` | Already `supremenutrition17@gmail.com` (from the original footer). |
| `apiBase` | Leave `''` on GitHub Pages. Only for the optional backend. |

### Razorpay on a static site (no server)
GitHub Pages cannot run server code, so the secure approach is a **Razorpay-hosted payment link/page** — the amount is fixed on Razorpay's side and cannot be changed from the browser.
1. Razorpay Dashboard → *Payments → Payment Links* (or *Payment Pages*). Amount ₹3,499 per kit, and enable collecting name, phone, email and **shipping address**.
2. Per quantity: create one link per quantity and set `razorpayPaymentLinks: { 1: 'https://rzp.io/l/…', 2: 'https://rzp.io/l/…' }` (the quantity selector is limited to the quantities you configure).
   Or create one Payment Page with its own quantity field and set `razorpayPaymentPage: 'https://pages.razorpay.com/…'` (the site then hides its quantity selector).
3. **Buy Now** opens that Razorpay page. Payment confirmation comes from Razorpay (email + Dashboard). The site never shows a "payment successful" message itself, because a static page cannot verify a payment.

Never put the Razorpay **secret** key in this repo.

### Optional: own backend with order verification
`optional-backend/` is a small zero-dependency Node server (Razorpay order creation, signature + payment verification, webhook, duplicate protection). It **cannot run on GitHub Pages**; host it on Render/Railway/etc., copy `.env.example` → `.env`, set `apiBase` in `config.js` to its URL and `ALLOWED_ORIGIN` to your Pages URL. The page then switches to a full delivery form + in-page Razorpay Checkout. Skip this folder if you use payment links.

## Static-hosting behaviour
- Contact form / "Notify me": no server, so they open the visitor's email app with a pre-filled message to `contactEmail`.
- Footer legal links open the Policies section on the same page.

## Content notes (migration decisions)
- The live site sells the **Fat loss kit** (₹3,499, MRP ₹3,999); CutCORE is one of its four products. The hero features the CutCORE bottle; the purchase is the kit at its real price.
- Reused: all copy, 6 FAQ answers, footer/manufacturer details, AYUSH licence, kit + label images (full ingredient panels open in a lightbox).
- Dropped: three "Sample review — real customer stories coming soon" testimonials (not genuine) and the "DEMO CART" (replaced by real checkout).
- Returns / privacy / terms are still "pending final copy" as on the original; GSTIN, registered address and return window must come from the business.
- Missing on the original and therefore not invented: WhatsApp number, social links, canonical URL, absolute `og:image` (set these after you know the live URL).
- `assets/img/source/` holds the untouched original images (public on Pages; delete if you prefer).

## Verified
Served as a static copy under a sub-path (like GitHub Pages): no broken assets, no console errors, anchors resolve, FAQ/lightbox/menu work, payment-link redirect per quantity, WhatsApp URL, email fallbacks, and the "not configured" states. Optional backend: 21 tests pass against a mock Razorpay API. **Not verified:** a real Razorpay payment (no credentials), Lighthouse scores.
