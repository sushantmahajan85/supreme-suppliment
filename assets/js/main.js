(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var inr = new Intl.NumberFormat('en-IN');
  var money = function (n) { return '₹' + inr.format(n); };

  /* ------------------------------ Header + mobile menu ------------------------------ */
  var header = $('[data-header]');
  var menuBtn = $('[data-menu-btn]');
  var menu = $('[data-menu]');
  var menuIcon = $('[data-menu-icon]');

  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menuIcon.setAttribute('d', open ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16');
    if (open) { menu.hidden = false; requestAnimationFrame(function () { menu.classList.add('open'); }); }
    else { menu.classList.remove('open'); setTimeout(function () { if (!menu.classList.contains('open')) menu.hidden = true; }, 400); }
  }
  menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); } });
  window.addEventListener('scroll', function () { header.classList.toggle('shadow-[0_10px_40px_-20px_#000]', window.scrollY > 10); }, { passive: true });

  /* ------------------------------ Scroll reveal ------------------------------ */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else { reveals.forEach(function (el) { el.classList.add('in'); }); }

  /* ------------------------------ Pointer tilt (desktop only) ------------------------------ */
  var stage = $('[data-stage]');
  var tilt = $('[data-tilt]');
  if (stage && tilt && !reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var raf = 0;
    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        tilt.style.setProperty('--ry', (x * 12).toFixed(2) + 'deg');
        tilt.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
      });
    });
    stage.addEventListener('pointerleave', function () { tilt.style.setProperty('--ry', '0deg'); tilt.style.setProperty('--rx', '0deg'); });
  }

  /* ------------------------------ FAQ accordion ------------------------------ */
  $$('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      $$('.faq-q').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); $('#' + b.getAttribute('aria-controls')).classList.remove('open'); });
      if (!open) { btn.setAttribute('aria-expanded', 'true'); $('#' + btn.getAttribute('aria-controls')).classList.add('open'); }
    });
  });

  /* Footer links open the matching policy <details> */
  $$('[data-open-policy]').forEach(function (a) {
    a.addEventListener('click', function () {
      var d = $(a.getAttribute('href'));
      if (d && d.tagName === 'DETAILS') d.open = true;
    });
  });

  /* ------------------------------ Label lightbox ------------------------------ */
  var dlg = $('[data-lightbox-dialog]');
  var dlgImg = $('[data-lightbox-img]');
  $$('[data-lightbox]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!dlg.showModal) { window.open(b.dataset.lightbox, '_blank', 'noopener'); return; }
      dlgImg.src = b.dataset.lightbox; dlgImg.alt = b.dataset.alt || '';
      dlg.showModal();
    });
  });
  if (dlg) dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  /* ------------------------------ Sticky mobile buy bar ------------------------------ */
  var bar = $('[data-sticky-bar]');
  var hero = $('#hero-title');
  var orderSec = $('#order');
  if (bar && 'IntersectionObserver' in window) {
    var state = { hero: true, order: false };
    var update = function () {
      var show = !state.hero && !state.order;
      bar.classList.toggle('translate-y-full', !show);
      bar.setAttribute('aria-hidden', String(!show));
      $$('a', bar).forEach(function (a) { a.tabIndex = show ? 0 : -1; });
    };
    new IntersectionObserver(function (en) { state.hero = en[0].isIntersecting; update(); }).observe(hero);
    new IntersectionObserver(function (en) { state.order = en[0].isIntersecting; update(); }, { threshold: 0.05 }).observe(orderSec);
  }

  /* ------------------------------ Quantity + totals ------------------------------ */
  var qty = 1;
  var maxQty = CFG.maxQty || 10;
  var qtyOut = $('#qty-out');
  var payLabel = $('[data-pay-label]');
  function renderTotals() {
    var total = qty * CFG.unitPrice;
    qtyOut.textContent = qty;
    $('[data-sum-qty]').textContent = qty;
    $('[data-total]').textContent = money(total);
    payLabel.textContent = 'Buy Now — ' + money(total);
  }
  $$('[data-qty]').forEach(function (b) {
    b.addEventListener('click', function () {
      qty = Math.min(maxQty, Math.max(1, qty + Number(b.dataset.qty)));
      renderTotals();
    });
  });
  renderTotals();

  /* ------------------------------ WhatsApp click-to-chat ------------------------------ */
  function waUrl() {
    var number = String(CFG.whatsappNumber || '').replace(/\D/g, '');
    if (number.length < 8 || number.length > 15) return null;
    var msg = 'Hello! I am interested in ordering ' + CFG.productName + '. Quantity: ' + qty +
      '. Selected option: ' + CFG.productOption +
      '. Displayed price: ' + money(CFG.unitPrice) + ' per kit (' + money(qty * CFG.unitPrice) + ' for ' + qty + '). ' +
      'Please confirm availability, delivery charges, and the final order total.';
    return 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  }
  $$('[data-wa]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = waUrl();
      if (url) { window.open(url, '_blank', 'noopener'); return; }
      var note = 'WhatsApp ordering is not configured yet — the business number has not been added. Please email supremenutrition17@gmail.com.';
      var slot = $('[data-wa-msg]');
      if (b.closest('#checkout-form')) { showStatus('info', note); }
      else if (slot) { slot.textContent = note; slot.classList.remove('hidden'); }
      else { alert(note); }
    });
  });

  /* ------------------------------ Checkout (Razorpay) ------------------------------ */
  var form = $('#checkout-form');
  var statusBox = $('#checkout-status');
  var payBtn = $('#pay-btn');
  var spinner = $('[data-spinner]');
  var API = (CFG.apiBase || '').replace(/\/$/, '');
  var MODE = API ? 'api' : 'static';
  form.setAttribute('data-mode', MODE);

  // Static mode: payment happens on a Razorpay-hosted link/page (amount fixed by Razorpay).
  var LINKS = CFG.razorpayPaymentLinks || {};
  var PAGE = CFG.razorpayPaymentPage || '';
  if (MODE === 'static') {
    if (PAGE) { $('[data-qty-wrap]').hidden = true; }            // quantity is chosen on Razorpay's page
    else {
      var keys = Object.keys(LINKS).map(Number).filter(function (n) { return n > 0 && LINKS[n]; });
      if (keys.length) { maxQty = Math.max.apply(null, keys); renderTotals(); }
    }
  }
  function staticPayUrl() {
    var u = PAGE || LINKS[qty] || '';
    return /^https:\/\/[^\s]+$/.test(u) ? u : '';
  }

  var tone = {
    success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
    error: 'border-brand/50 bg-brand/10 text-red-100',
    info: 'border-white/20 bg-white/5 text-silver'
  };
  function showStatus(kind, html) {
    statusBox.className = 'mt-5 rounded-2xl border p-4 text-sm leading-relaxed ' + tone[kind];
    statusBox.textContent = '';
    var p = document.createElement('p'); p.textContent = html; statusBox.appendChild(p);
    statusBox.focus({ preventScroll: false });
  }
  function setBusy(busy, label) {
    payBtn.disabled = busy;
    spinner.classList.toggle('hidden', !busy);
    if (label) payLabel.textContent = label; else renderTotals();
  }

  var rules = {
    name: function (v) { return v.trim().length >= 2 || 'Please enter your full name.'; },
    phone: function (v) { return /^(\+?91)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, '')) || 'Enter a valid 10-digit Indian mobile number.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Enter a valid email address.'; },
    address: function (v) { return v.trim().length >= 8 || 'Please enter your full delivery address.'; },
    city: function (v) { return v.trim().length >= 2 || 'Please enter your city.'; },
    state: function (v) { return v.trim().length >= 2 || 'Please enter your state.'; },
    pincode: function (v) { return /^[1-9]\d{5}$/.test(v.trim()) || 'Enter a valid 6-digit PIN code.'; }
  };
  function validate() {
    var firstBad = null, data = {};
    Object.keys(rules).forEach(function (k) {
      var input = form.elements[k];
      var res = rules[k](input.value);
      var err = $('[data-err="' + k + '"]', form);
      err.textContent = res === true ? '' : res;
      input.setAttribute('aria-invalid', res === true ? 'false' : 'true');
      if (res !== true && !firstBad) firstBad = input;
      data[k] = input.value.trim();
    });
    if (firstBad) { firstBad.focus(); return null; }
    return data;
  }
  Object.keys(rules).forEach(function (k) {
    form.elements[k].addEventListener('input', function () {
      var ok = rules[k](this.value) === true;
      if (ok) { $('[data-err="' + k + '"]', form).textContent = ''; this.setAttribute('aria-invalid', 'false'); }
    });
  });

  function api(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error((j.error && j.error.message) || 'Request failed'); e.code = j.error && j.error.code; e.status = r.status; throw e; }
        return j;
      });
    });
  }

  var rzpLoading = null;
  function loadRazorpay() {
    if (window.Razorpay) return Promise.resolve();
    if (rzpLoading) return rzpLoading;
    rzpLoading = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = res;
      s.onerror = function () { rzpLoading = null; rej(new Error('Could not load Razorpay Checkout. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
    return rzpLoading;
  }

  // One idempotency key per distinct attempt so double-clicks / retries never create duplicate orders.
  function attemptKey(data) {
    var sig = JSON.stringify([qty, data]);
    try {
      var saved = JSON.parse(sessionStorage.getItem('sn_attempt') || 'null');
      if (saved && saved.sig === sig) return saved.key;
      var key = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
      sessionStorage.setItem('sn_attempt', JSON.stringify({ sig: sig, key: key }));
      return key;
    } catch (e) { return String(Date.now()) + Math.random().toString(16).slice(2); }
  }
  function clearAttempt() { try { sessionStorage.removeItem('sn_attempt'); } catch (e) { /* ignore */ } }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (payBtn.disabled) return;

    if (MODE === 'static') {
      var url = staticPayUrl();
      if (!url) {
        showStatus('info', 'Online payment is not switched on yet — the Razorpay payment link has not been added. Please order on WhatsApp or email ' + (CFG.contactEmail || 'us') + '.');
        return;
      }
      showStatus('info', 'Opening Razorpay’s secure payment page… Your order is confirmed only by Razorpay’s payment confirmation, not by this page.');
      if (!window.open(url, '_blank', 'noopener')) window.location.href = url;
      return;
    }

    var customer = validate();
    if (!customer) { showStatus('error', 'Please fix the highlighted fields and try again.'); return; }

    setBusy(true, 'Preparing secure checkout…');
    showStatus('info', 'Creating your order…');

    api('/api/orders', { quantity: qty, customer: customer, idempotencyKey: attemptKey(customer) })
      .then(function (order) {
        return loadRazorpay().then(function () { return order; });
      })
      .then(function (order) {
        setBusy(false);
        openCheckout(order, customer);
      })
      .catch(function (err) {
        setBusy(false);
        if (err.code === 'payments_not_configured') {
          showStatus('info', 'Online payment is not switched on yet (Razorpay keys are not configured on the server). Your details were not charged or saved. Please order via WhatsApp or email supremenutrition17@gmail.com.');
        } else if (err.status === undefined || err.name === 'TypeError') {
          showStatus('error', 'We could not reach the order server. Please check your connection and try again, or order on WhatsApp.');
        } else {
          showStatus('error', err.message);
        }
      });
  });

  function openCheckout(order, customer) {
    var settled = false;
    var rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'Supreme Nutrition',
      description: CFG.productName + ' × ' + order.quantity,
      image: new URL('assets/img/logo.webp', location.href).href,
      prefill: { name: customer.name, email: customer.email, contact: customer.phone },
      notes: { receipt: order.receipt },
      theme: { color: '#F20D18', backdrop_color: '#050505' },
      modal: {
        escape: true,
        ondismiss: function () {
          if (!settled) showStatus('info', 'Payment was cancelled — you have not been charged. You can press Buy Now to try again.');
        }
      },
      handler: function (resp) {
        settled = true;
        setBusy(true, 'Verifying payment…');
        showStatus('info', 'Payment received by Razorpay. Verifying it on our server — please don’t close this page…');
        api('/api/payments/verify', {
          razorpay_order_id: resp.razorpay_order_id,
          razorpay_payment_id: resp.razorpay_payment_id,
          razorpay_signature: resp.razorpay_signature
        }).then(function (v) {
          setBusy(false);
          if (v.status === 'paid') {
            clearAttempt();
            showStatus('success', 'Payment verified. Thank you! Your order reference is ' + v.receipt + '. We will dispatch within 48 hours and email you at ' + customer.email + '.');
            form.reset(); qty = 1; renderTotals();
          } else {
            showStatus('info', 'Your payment is pending confirmation from the bank (reference ' + v.receipt + '). We will confirm by email once it is captured. Please do not pay again.');
          }
        }).catch(function (err) {
          setBusy(false);
          showStatus('error', 'We could not verify your payment automatically (' + err.message + '). If money was debited, do not pay again — contact supremenutrition17@gmail.com with payment id ' + resp.razorpay_payment_id + '.');
        });
      }
    });
    rzp.on('payment.failed', function (r) {
      settled = true;
      var reason = (r && r.error && r.error.description) || 'The payment could not be completed.';
      showStatus('error', 'Payment failed: ' + reason + ' You have not been marked as paid. Please try again.');
      api('/api/payments/failed', { razorpay_order_id: order.orderId, reason: reason }).catch(function () { /* best effort */ });
      setTimeout(function () { settled = false; }, 0);
    });
    rzp.open();
  }

  /* ------------------------------ Contact + notify forms ------------------------------ */
  function simpleForm(formEl, path, okMsg, build) {
    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = $('[data-form-status]', formEl.closest('section')) || $('[data-form-status]', formEl);
      var btn = $('button[type=submit]', formEl);
      if (!formEl.checkValidity()) { formEl.reportValidity(); return; }
      if (!API) {
        // Static hosting: no server to post to, so hand the message to the visitor's email app.
        var m = build(formEl, true);
        window.location.href = 'mailto:' + (CFG.contactEmail || '') + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.body);
        status.className = 'rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-silver mt-4';
        status.textContent = 'Opening your email app — press send there to deliver your message to ' + (CFG.contactEmail || 'us') + '.';
        return;
      }
      btn.disabled = true;
      api(path, build(formEl)).then(function () {
        status.className = 'rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-100 mt-4';
        status.textContent = okMsg; formEl.reset();
      }).catch(function (err) {
        status.className = 'rounded-xl border border-brand/50 bg-brand/10 p-3 text-sm text-red-100 mt-4';
        status.textContent = (err.status ? err.message : 'We could not reach the server.') + ' You can also email supremenutrition17@gmail.com.';
      }).then(function () { btn.disabled = false; status.focus && status.setAttribute('tabindex', '-1'); });
    });
  }
  simpleForm($('#contact-form'), '/api/contact', 'Thanks — your message has been sent. A person will reply by email.', function (f, mail) {
    if (mail) return { subject: 'Website enquiry from ' + f.name.value, body: f.message.value + '\n\n— ' + f.name.value + ' (' + f.email.value + ')' };
    return { name: f.name.value, email: f.email.value, message: f.message.value };
  });
  simpleForm($('#notify-form'), '/api/subscribe', 'You’re on the list. Thank you!', function (f, mail) { return mail ? { subject: 'Notify me about launches', body: 'Please add me to the launch list: ' + f.email.value } : { email: f.email.value }; });
})();
