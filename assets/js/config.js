/*
 * Public site configuration — this is a static site (GitHub Pages friendly).
 * Nothing secret goes in this file. NEVER paste a Razorpay *secret* key anywhere in the frontend.
 */
window.SITE_CONFIG = {
  // Business WhatsApp number in international format, digits only (e.g. "919876543210").
  // No number was published on the original site, so this is empty.
  whatsappNumber: '',

  contactEmail: 'supremenutrition17@gmail.com',

  productName: 'Fat loss kit — 30-day program',
  productOption: 'Standard kit — CutCore, Appetite Control, L-Carnitine 3000 (orange & berry blast)',

  // Display values (the real amount is set on the Razorpay link/page or by the backend).
  unitPrice: 3499,
  mrp: 3999,
  maxQty: 10,

  /*
   * PAYMENTS — static mode (no server needed, works on GitHub Pages)
   * Create Payment Links / a Payment Page in Razorpay Dashboard (Payments -> Payment Links),
   * set the amount there, tick "collect customer details & address", then paste the URL(s) here.
   *   - Per quantity:  { 1: 'https://rzp.io/l/aaa', 2: 'https://rzp.io/l/bbb' }  (amount = qty × ₹3,499)
   *   - Or one Payment Page that has its own quantity selector: 'https://pages.razorpay.com/xxxx'
   * The amount is fixed on Razorpay's side, so it cannot be tampered with from the browser.
   */
  razorpayPaymentLinks: {},
  razorpayPaymentPage: '',

  /*
   * PAYMENTS — API mode (optional). Only if you host optional-backend/ somewhere (Render, Railway, ...).
   * GitHub Pages cannot run it. When set, the page shows the full delivery form and uses
   * server-created Razorpay orders with signature verification.
   */
  apiBase: '',
};
