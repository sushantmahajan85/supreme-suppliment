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
  var progress = $('[data-scroll-progress]');
  function onHeaderScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.setProperty('--sp', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);
  }
  window.addEventListener('scroll', onHeaderScroll, { passive: true });
  onHeaderScroll();

  /* Page-load choreography: hero lines, products rising onto the podium */
  requestAnimationFrame(function () { requestAnimationFrame(function () { document.body.classList.add('is-ready'); }); });

  /* ------------------------------ Scroll reveal ------------------------------ */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else { reveals.forEach(function (el) { el.classList.add('in'); }); }

  /* ------------------------------ Hero gallery (infinite sliding carousel) ------------------------------ */
  var gal = $('[data-gallery]');
  if (gal) {
    var gStage = $('[data-gal-stage]', gal);
    var gTrack = $('[data-gal-track]', gal);
    var gSlides = $$('.gal-slide', gal);
    var gThumbs = $$('[data-gal-thumb]', gal);
    var gStrip = $('.gal-thumbs', gal);
    var gCap = $('[data-gal-cap]', gal);
    var gCount = $('[data-gal-count]', gal);
    var gBar = $('[data-gal-bar]', gal);
    var gN = gSlides.length;
    var GAL_MS = 3000;
    var gIdx = 0;
    var gPrevPos = [];
    var gTimer = null;
    var gHold = { hover: false, focus: false, drag: false, hidden: false, away: false };

    function galPos(i) {
      var off = (((i - gIdx) % gN) + gN) % gN;
      if (off > gN / 2) off -= gN;
      return Math.max(-1, Math.min(1, off));
    }

    function galRender(dragPx) {
      var snap = [];
      gSlides.forEach(function (s, i) {
        var c = galPos(i);
        var cross = gPrevPos[i] !== undefined && Math.abs(c - gPrevPos[i]) > 1.5;
        if (cross || gPrevPos[i] === undefined) { s.classList.add('no-anim'); snap.push(s); }
        gPrevPos[i] = c;
        s.style.transform = 'translate3d(calc(' + (c * 100) + '% + ' + (dragPx || 0) + 'px),0,0)';
        var cur = c === 0;
        s.classList.toggle('is-current', cur);
        s.setAttribute('aria-hidden', String(!cur));
        $('.gal-open', s).tabIndex = cur ? 0 : -1;
      });
      if (snap.length) {
        void gStage.offsetWidth;
        requestAnimationFrame(function () { snap.forEach(function (s) { s.classList.remove('no-anim'); }); });
      }
    }

    function galUi(scrollStrip) {
      var t = gThumbs[gIdx];
      var label = t.getAttribute('aria-label').replace(/^Show /, '');
      gCap.textContent = label;
      gCount.textContent = (gIdx + 1) + ' / ' + gN;
      gThumbs.forEach(function (b, n) {
        b.classList.toggle('is-active', n === gIdx);
        b.setAttribute('aria-pressed', String(n === gIdx));
      });
      if (scrollStrip) {
        gStrip.scrollTo({ left: t.offsetLeft - (gStrip.clientWidth - t.clientWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }

    function galGo(i, scrollStrip) {
      gIdx = ((i % gN) + gN) % gN;
      galRender(0);
      galUi(scrollStrip !== false);
      galSchedule();
    }

    function galHeld() { return reduceMotion || Object.keys(gHold).some(function (k) { return gHold[k]; }); }
    function galSchedule() {
      clearTimeout(gTimer);
      gBar.classList.remove('run', 'hold');
      if (galHeld()) return;
      void gBar.offsetWidth;
      gBar.style.setProperty('--gal-ms', GAL_MS + 'ms');
      gBar.classList.add('run');
      gTimer = setTimeout(function () { galGo(gIdx + 1); }, GAL_MS);
    }
    function galHold(key, on) {
      if (gHold[key] === on) return;
      gHold[key] = on;
      if (on) { clearTimeout(gTimer); gBar.classList.add('hold'); }
      else if (!galHeld()) galSchedule();
    }

    /* Warm every slide so nothing is blank mid-slide */
    function galWarm() { $$('img', gal).forEach(function (im) { im.loading = 'eager'; }); }
    if (document.readyState === 'complete') galWarm(); else window.addEventListener('load', galWarm);

    $('[data-gal-prev]', gal).addEventListener('click', function () { galGo(gIdx - 1); });
    $('[data-gal-next]', gal).addEventListener('click', function () { galGo(gIdx + 1); });
    gThumbs.forEach(function (t, n) { t.addEventListener('click', function () { galGo(n); }); });
    gal.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); galGo(gIdx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); galGo(gIdx + 1); }
    });

    /* Pause on hover (mouse only), keyboard focus, hidden tab, or when scrolled away */
    gal.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') galHold('hover', true); });
    gal.addEventListener('pointerleave', function () { galHold('hover', false); });
    gal.addEventListener('focusin', function (e) { if (e.target.matches(':focus-visible')) galHold('focus', true); });
    gal.addEventListener('focusout', function () { galHold('focus', false); });
    document.addEventListener('visibilitychange', function () { galHold('hidden', document.hidden); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { galHold('away', !en[0].isIntersecting); }, { threshold: 0.25 }).observe(gStage);
    }

    /* Drag / swipe: the slides follow the pointer, then settle on the nearest photo */
    var dragId = null, dragX0 = 0, dragDx = 0, dragMoved = false, dragT0 = 0;
    gStage.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || e.target.closest('.gal-nav')) return;
      dragId = e.pointerId; dragX0 = e.clientX; dragDx = 0; dragMoved = false; dragT0 = e.timeStamp;
    });
    gStage.addEventListener('pointermove', function (e) {
      if (e.pointerId !== dragId) return;
      dragDx = e.clientX - dragX0;
      if (!dragMoved && Math.abs(dragDx) > 6) {
        dragMoved = true;
        gTrack.classList.add('is-dragging');
        galHold('drag', true);
        try { gStage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      if (dragMoved) galRender(dragDx);
    });
    function dragEnd(e) {
      if (e.pointerId !== dragId) return;
      dragId = null;
      if (!dragMoved) return;
      var w = gStage.clientWidth;
      var v = dragDx / Math.max(1, e.timeStamp - dragT0);
      gTrack.classList.remove('is-dragging');
      galHold('drag', false);
      if (Math.abs(dragDx) > w * 0.16 || Math.abs(v) > 0.45) galGo(gIdx + (dragDx < 0 ? 1 : -1));
      else { galRender(0); galSchedule(); }
    }
    gStage.addEventListener('pointerup', dragEnd);
    gStage.addEventListener('pointercancel', dragEnd);
    /* a drag must not count as a click on the photo (which opens the lightbox) */
    gStage.addEventListener('click', function (e) {
      if (dragMoved) { e.stopPropagation(); e.preventDefault(); dragMoved = false; }
    }, true);

    galRender(0);
    galUi(false);
    galSchedule();
  }

  /* ------------------------------ Product card switchers (front / back / facts) ------------------------------ */
  $$('[data-switcher]').forEach(function (sw) {
    var main = $('.sw-main', sw);
    var imgs = $$('[data-sw-img]', sw);
    var thumbs = $$('[data-sw-thumb]', sw);
    thumbs.forEach(function (t, n) {
      t.addEventListener('click', function () {
        imgs.forEach(function (im, k) { im.classList.toggle('is-on', k === n); });
        main.dataset.lightbox = imgs[n].getAttribute('src'); main.dataset.alt = imgs[n].alt;
        thumbs.forEach(function (o) { o.classList.toggle('is-active', o === t); o.setAttribute('aria-pressed', String(o === t)); });
      });
    });
  });

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
    $('[data-card-total]').textContent = money(total);
    payLabel.textContent = 'Buy Now';
    $$('[data-cart-count]').forEach(function (b) {
      if (b.textContent !== String(qty)) {
        b.textContent = qty;
        b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
      }
    });
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
    // the checkout form is a light card
    success: 'border-emerald-600/30 bg-emerald-50 text-emerald-900',
    error: 'border-brand/40 bg-red-50 text-red-900',
    info: 'border-ink/10 bg-paper text-ink/80'
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
      // window.open() with the 'noopener' feature always returns null, so open plainly and detach the opener.
      var win = window.open(url, '_blank');
      if (win) win.opener = null;
      else window.location.href = url;                                // popup blocked → same tab
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
        status.className = 'rounded-xl border border-ink/10 bg-white p-3 text-sm text-ink/80 mt-4';
        status.textContent = 'Opening your email app — press send there to deliver your message to ' + (CFG.contactEmail || 'us') + '.';
        return;
      }
      btn.disabled = true;
      api(path, build(formEl)).then(function () {
        status.className = 'rounded-xl border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-900 mt-4';
        status.textContent = okMsg; formEl.reset();
      }).catch(function (err) {
        status.className = 'rounded-xl border border-brand/40 bg-red-50 p-3 text-sm text-red-900 mt-4';
        status.textContent = (err.status ? err.message : 'We could not reach the server.') + ' You can also email supremenutrition17@gmail.com.';
      }).then(function () { btn.disabled = false; status.focus && status.setAttribute('tabindex', '-1'); });
    });
  }
  simpleForm($('#contact-form'), '/api/contact', 'Thanks — your message has been sent. A person will reply by email.', function (f, mail) {
    if (mail) return { subject: 'Website enquiry from ' + f.name.value, body: f.message.value + '\n\n— ' + f.name.value + ' (' + f.email.value + ')' };
    return { name: f.name.value, email: f.email.value, message: f.message.value };
  });
  simpleForm($('#notify-form'), '/api/subscribe', 'You’re on the list. Thank you!', function (f, mail) { return mail ? { subject: 'Notify me about launches', body: 'Please add me to the launch list: ' + f.email.value } : { email: f.email.value }; });

  /* =================================================================== */
  /* Motion & detail layer — all of it is skipped for reduced motion     */
  /* =================================================================== */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasIO = 'IntersectionObserver' in window;

  /* Clip-path image reveals */
  var clips = $$('.reveal-clip');
  if (hasIO && !reduceMotion) {
    var cio = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); cio.unobserve(e.target); } });
    }, { threshold: 0.2 });
    clips.forEach(function (c) { cio.observe(c); });
  } else { clips.forEach(function (c) { c.classList.add('in'); }); }

  /* Nav scroll-spy */
  var spyLinks = $$('[data-spy]');
  if (hasIO && spyLinks.length) {
    var spyMap = {};
    spyLinks.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) spyMap[s.id] = a; });
    var spyOn = {};
    var spyIO = new IntersectionObserver(function (en) {
      en.forEach(function (e) { spyOn[e.target.id] = e.isIntersecting; });
      var cur = Object.keys(spyMap).filter(function (id) { return spyOn[id]; })[0];
      spyLinks.forEach(function (a) { a.classList.toggle('is-active', cur ? a === spyMap[cur] : false); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(spyMap).forEach(function (id) { spyIO.observe(document.getElementById(id)); });
  }

  /* Count-up numbers */
  var counters = $$('[data-count]');
  function runCount(el) {
    var end = Number(el.dataset.count), pad = Number(el.dataset.pad || 0), t0 = null, dur = 1400;
    function fmt(n) { var s = String(n); while (s.length < pad) s = '0' + s; return s; }
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(Math.round(end * e));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (hasIO && !reduceMotion) {
    var kio = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { runCount(e.target); kio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { c.textContent = c.dataset.pad ? '00' : '0'; kio.observe(c); });
  }

  /* Label explorer tabs (roving tabindex, arrow keys) */
  var labels = $('[data-labels]');
  if (labels) {
    var tabs = $$('[role="tab"]', labels);
    var selectTab = function (t, focus) {
      tabs.forEach(function (o) {
        var on = o === t;
        o.setAttribute('aria-selected', String(on));
        o.tabIndex = on ? 0 : -1;
        $('#' + o.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) t.focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(t); });
      t.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
        if (n === null) return;
        e.preventDefault();
        selectTab(tabs[(n + tabs.length) % tabs.length], true);
      });
    });
    // replay the row + bar animations when the explorer scrolls into view
    // (toggled within one task, so there is no paint and no layout shift)
    if (hasIO && !reduceMotion) {
      new IntersectionObserver(function (en, obs) {
        if (!en[0].isIntersecting) return;
        var cur = $('.lpanel:not([hidden])', labels);
        if (cur) { cur.hidden = true; void cur.offsetWidth; cur.hidden = false; }
        obs.disconnect();
      }, { threshold: 0.25 }).observe(labels);
    }
  }

  /* Hotspots on the open kit */
  $$('[data-hotspots]').forEach(function (wrap) {
    var spots = $$('.hs', wrap);
    function close(except) {
      spots.forEach(function (s) {
        if (s === except) return;
        s.setAttribute('aria-expanded', 'false');
        $('#' + s.getAttribute('aria-controls')).classList.remove('open');
      });
    }
    spots.forEach(function (s) {
      var card = $('#' + s.getAttribute('aria-controls'));
      s.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = s.getAttribute('aria-expanded') !== 'true';
        close(s);
        s.setAttribute('aria-expanded', String(open));
        card.classList.toggle('open', open);
      });
      if (finePointer) {
        s.addEventListener('mouseenter', function () { close(s); s.setAttribute('aria-expanded', 'true'); card.classList.add('open'); });
      }
    });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  });

  if (reduceMotion) return;

  /* Hero pointer parallax — products drift at different depths */
  var par = $('[data-parallax]');
  var stage = $('[data-stage]');
  if (par && stage && finePointer) {
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    var tick = function () {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      stage.style.setProperty('--mx', cx.toFixed(3));
      stage.style.setProperty('--my', cy.toFixed(3));
      raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(tick) : null;
    };
    par.addEventListener('pointermove', function (e) {
      var r = par.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    par.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tick); });
  }

  /* Rising embers behind the products */
  var cv = $('[data-embers]');
  if (cv && cv.getContext) {
    var ctx = cv.getContext('2d'), parts = [], W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1), running = false, eRaf;
    var size = function () {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    var spawn = function (p, initial) {
      p.x = W * (0.15 + Math.random() * 0.7);
      p.y = initial ? Math.random() * H : H * (0.7 + Math.random() * 0.2);
      p.r = 0.6 + Math.random() * 1.8;
      p.vy = 0.25 + Math.random() * 0.65;
      p.vx = (Math.random() - 0.5) * 0.25;
      p.life = 0; p.max = 220 + Math.random() * 260;
      return p;
    };
    var frame = function () {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.life++; p.y -= p.vy; p.x += p.vx + Math.sin((p.life + i * 30) / 40) * 0.15;
        var a = Math.sin(Math.PI * Math.min(1, p.life / p.max));
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,' + (60 + (i % 5) * 18) + ',60,' + (a * 0.6).toFixed(3) + ')';
        ctx.shadowColor = 'rgba(255,40,50,.9)'; ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        if (p.life > p.max || p.y < -10) spawn(p, false);
      }
      eRaf = requestAnimationFrame(frame);
    };
    size();
    for (var k = 0; k < (W < 500 ? 14 : 26); k++) parts.push(spawn({}, true));
    window.addEventListener('resize', size);
    var setRun = function (on) {
      if (on === running) return;
      running = on;
      if (on) eRaf = requestAnimationFrame(frame); else cancelAnimationFrame(eRaf);
    };
    if (hasIO) new IntersectionObserver(function (en) { setRun(en[0].isIntersecting && !document.hidden); }).observe(cv);
    else setRun(true);
    document.addEventListener('visibilitychange', function () { if (document.hidden) setRun(false); });
  }

  /* Card tilt + magnetic buttons (mouse only) */
  if (finePointer) {
    $$('[data-tilt]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(900px) rotateX(' + (-y * 6).toFixed(2) + 'deg) rotateY(' + (x * 7).toFixed(2) + 'deg) translateY(-6px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
    $$('[data-magnet]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.translate = ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + 'px';
      });
      el.addEventListener('pointerleave', function () { el.style.translate = ''; });
    });
  }

  /* Scroll-linked work: big word rows + routine timeline */
  var rows = $$('[data-scroll-x]');
  var timeline = $('[data-timeline]');
  var steps = timeline ? $$('.step', timeline) : [];
  var rail = timeline ? $('.rail i', timeline) : null;
  var sRaf = null;
  function onScrollFx() {
    sRaf = null;
    var vh = window.innerHeight;
    rows.forEach(function (row) {
      var r = row.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var p = (vh - r.top) / (vh + r.height); // 0..1 across the viewport
      row.style.transform = 'translate3d(' + ((p - 0.5) * 30 * Number(row.dataset.scrollX)).toFixed(2) + '%,0,0)';
    });
    if (timeline) {
      var tr = timeline.getBoundingClientRect();
      var mid = vh * 0.55;
      var p2 = Math.max(0, Math.min(1, (mid - tr.top) / tr.height));
      rail.parentNode.style.setProperty('--p', p2.toFixed(3));
      steps.forEach(function (s) { s.classList.toggle('is-on', s.getBoundingClientRect().top < mid); });
    }
  }
  window.addEventListener('scroll', function () { if (!sRaf) sRaf = requestAnimationFrame(onScrollFx); }, { passive: true });
  window.addEventListener('resize', onScrollFx);
  onScrollFx();
})();
