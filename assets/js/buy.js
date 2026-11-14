/*
 * Points every [data-buy] link at the Razorpay store set in config.js (razorpayPaymentPage),
 * opening it in a new tab. Without a valid https URL the links keep their #order fallback.
 * Shared by index.html and the policy pages, so the payment URL lives in one place.
 */
(function () {
  var url = (window.SITE_CONFIG && window.SITE_CONFIG.razorpayPaymentPage) || '';
  if (!/^https:\/\/[^\s]+$/.test(url)) return;
  var links = document.querySelectorAll('a[data-buy]');
  for (var i = 0; i < links.length; i++) {
    links[i].href = url;
    links[i].target = '_blank';
    links[i].rel = 'noopener';
  }
})();
