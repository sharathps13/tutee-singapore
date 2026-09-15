/* ==========================================================================
   Tutee Connect — Singapore landing page
   Vanilla re-implementation of every interaction from the React reference.
   Loaded with `defer`, so the DOM is ready when this runs.
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* Swap one space-separated class set for another. */
  function setClasses(el, remove, add) {
    if (!el) return;
    remove.split(/\s+/).filter(Boolean).forEach(function (c) { el.classList.remove(c); });
    add.split(/\s+/).filter(Boolean).forEach(function (c) { el.classList.add(c); });
  }

  function smoothTo(id) {
    var t = document.getElementById(id);
    if (t) t.scrollIntoView({ behavior: 'smooth' });
    return !!t;
  }

  /* True on the home page — where every section anchor actually exists. */
  function isHomePage() {
    return !!document.getElementById('home');
  }

  /* Scroll to a section here, or hand off to the home page when we're on a
     sub-page (the directory) where that section doesn't exist. */
  function goToSection(id) {
    if (id === 'top') {
      if (isHomePage()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      window.location.href = './index.html';
      return;
    }
    if (document.getElementById(id)) { smoothTo(id); return; }
    window.location.href = './index.html#' + id;
  }

  /* Minimal markdown: **bold** + newlines. Escapes HTML first. */
  function mdToHtml(s) {
    var esc = String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  /* ------------------------------------------------------------------ *
   * 1. Scroll reveal — mirrors the reference's shared IntersectionObserver
   *    (threshold 0.1, adds `.active`, then unobserves).
   * ------------------------------------------------------------------ */
  var revealObserver = null;
  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal').forEach(function (el) { el.classList.add('active'); });
      return;
    }
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('active');
          revealObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    observeReveals();
  }
  function observeReveals() {
    if (!revealObserver) return;
    $$('.reveal:not(.active)').forEach(function (el) { revealObserver.observe(el); });
  }

  /* ------------------------------------------------------------------ *
   * 2. Sticky header — condenses past 50px.
   * ------------------------------------------------------------------ */
  var HEADER_TOP    = 'py-3 sm:py-5';
  var HEADER_SCROLL = 'py-2 sm:py-3 bg-bg-surface border-b border-border-color shadow-sm';
  function initHeader() {
    var header = $('header');
    if (!header) return;
    var scrolled = null;
    function apply() {
      var now = window.scrollY > 50;
      if (now === scrolled) return;
      scrolled = now;
      if (now) setClasses(header, HEADER_TOP, HEADER_SCROLL);
      else     setClasses(header, HEADER_SCROLL, HEADER_TOP);
    }
    window.addEventListener('scroll', apply, { passive: true });
    apply();
  }

  /* ------------------------------------------------------------------ *
   * 3. Mobile navigation drawer.
   * ------------------------------------------------------------------ */
  function initMobileMenu() {
    var shell = $('[data-mobile-menu]');
    var panel = $('[data-mobile-menu-panel]');
    var openBtn  = $('[data-mobile-menu-open]');
    var closeBtn = $('[data-mobile-menu-close]');
    if (!shell || !panel) return;

    function open() {
      setClasses(shell, 'invisible opacity-0 pointer-events-none', 'visible opacity-100 pointer-events-auto');
      // let the shell paint before sliding the sheet up
      requestAnimationFrame(function () {
        setClasses(panel, 'translate-y-full', 'translate-y-0');
      });
      document.body.style.overflow = 'hidden';
    }
    function close() {
      setClasses(panel, 'translate-y-0', 'translate-y-full');
      setClasses(shell, 'visible opacity-100 pointer-events-auto', 'invisible opacity-0 pointer-events-none');
      document.body.style.overflow = '';
    }

    if (openBtn)  openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    // backdrop
    var backdrop = $('[data-mobile-menu-backdrop]', shell);
    if (backdrop) backdrop.addEventListener('click', close);
    // any nav item inside closes the drawer
    $$('a, button', panel).forEach(function (el) {
      if (el === closeBtn) return;
      el.addEventListener('click', function () { setTimeout(close, 60); });
    });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    document.addEventListener('tc:closemenu', close);
  }

  /* ------------------------------------------------------------------ *
   * 4. Anchor scrolling for nav items and CTAs.
   * ------------------------------------------------------------------ */
  function initScrollTargets() {
    // Footer logo / chevron: back to the top of THIS page, not to the home page.
    $$('[data-scroll-top]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    $$('[data-scroll-to]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var id = el.getAttribute('data-scroll-to');
        document.dispatchEvent(new CustomEvent('tc:closemenu'));
        setTimeout(function () { goToSection(id); }, 40);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 5. Services — desktop tab cards + detail panel.
   * ------------------------------------------------------------------ */
  var SVC_CARD_ON   = 'border-primary outline outline-2 outline-primary/20 shadow-xl shadow-primary/20 xl:scale-105 z-20';
  var SVC_CARD_OFF  = 'border-border-color hover:border-primary/50 hover:shadow-lg z-10';
  var SVC_ICON_ON   = 'bg-primary text-white scale-110 shadow-primary/30';
  var SVC_ICON_OFF  = 'bg-primary/5 text-primary group-hover:bg-primary/10 group-hover:scale-110';
  var SVC_TITLE_ON  = 'text-primary';
  var SVC_TITLE_OFF = 'text-text-main group-hover:text-primary';

  function initServicesDesktop(services) {
    var cards = $$('[data-service-card]');
    if (!cards.length) return;
    var panelIcon    = $('[data-service-panel-icon]');
    var panelTitle   = $('[data-service-panel-title]');
    var panelTagline = $('[data-service-panel-tagline]');
    var panelDesc    = $('[data-service-panel-desc]');
    var dots         = $$('[data-service-dot]');

    function select(idx) {
      cards.forEach(function (card, i) {
        var on   = i === idx;
        var icon = $('[data-service-card-icon]', card);
        var ttl  = $('[data-service-card-title]', card);
        var wash = $('[data-service-card-wash]', card);
        setClasses(card, on ? SVC_CARD_OFF : SVC_CARD_ON, on ? SVC_CARD_ON : SVC_CARD_OFF);
        setClasses(icon, on ? SVC_ICON_OFF : SVC_ICON_ON, on ? SVC_ICON_ON : SVC_ICON_OFF);
        setClasses(ttl,  on ? SVC_TITLE_OFF : SVC_TITLE_ON, on ? SVC_TITLE_ON : SVC_TITLE_OFF);
        setClasses(wash, on ? 'opacity-0 group-hover:opacity-100' : 'opacity-100',
                         on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100');
      });
      dots.forEach(function (d, i) {
        setClasses(d, i === idx ? 'w-1.5 bg-border-color' : 'w-6 bg-primary',
                      i === idx ? 'w-6 bg-primary' : 'w-1.5 bg-border-color');
      });
      var s = services[idx];
      if (!s) return;
      if (panelIcon)    panelIcon.innerHTML   = s.icon;
      if (panelTitle)   panelTitle.textContent   = s.title;
      if (panelTagline) panelTagline.textContent = s.tagline;
      if (panelDesc)    panelDesc.textContent    = s.desc;
    }

    cards.forEach(function (card, i) {
      card.addEventListener('click', function () { select(i); });
    });
    select(0);
  }

  /* ------------------------------------------------------------------ *
   * 6. Services — mobile bottom sheet.
   * ------------------------------------------------------------------ */
  function initServicesMobile(services) {
    var sheet    = $('[data-sheet]');
    var backdrop = $('[data-sheet-backdrop]');
    if (!sheet) return;
    var idx = 0, open = false;

    var sIcon    = $('[data-sheet-icon]');
    var sTitle   = $('[data-sheet-title]');
    var sTagline = $('[data-sheet-tagline]');
    var sDesc    = $('[data-sheet-desc]');
    var dots     = $$('[data-sheet-dot]');
    var body     = $('[data-sheet-body]');

    function render() {
      var s = services[idx];
      if (!s) return;
      if (sIcon)    sIcon.innerHTML      = s.iconSm || s.icon;
      if (sTitle)   sTitle.textContent   = s.title;
      if (sTagline) sTagline.textContent = s.tagline;
      if (sDesc)    sDesc.textContent    = s.desc;
      dots.forEach(function (d, i) {
        d.style.width  = i === idx ? '18px' : '6px';
        d.style.height = '6px';
        d.style.background = i === idx ? '#760d0d' : 'rgba(0,0,0,0.15)';
      });
      if (body) body.scrollTop = 0;
    }
    function show(i) {
      idx = i; open = true; render();
      sheet.style.transform = 'translateY(0)';
      if (backdrop) setClasses(backdrop, 'invisible opacity-0 pointer-events-none', 'visible opacity-100 pointer-events-auto');
      document.body.style.overflow = 'hidden';
    }
    function hide() {
      open = false;
      sheet.style.transform = 'translateY(105%)';
      if (backdrop) setClasses(backdrop, 'visible opacity-100 pointer-events-auto', 'invisible opacity-0 pointer-events-none');
      document.body.style.overflow = '';
    }
    function step(d) { idx = (idx + d + services.length) % services.length; render(); }

    $$('[data-sheet-open]').forEach(function (btn, i) {
      btn.addEventListener('click', function () { show(i); });
    });
    $$('[data-sheet-close]').forEach(function (b) { b.addEventListener('click', hide); });
    if (backdrop) backdrop.addEventListener('click', hide);
    var prev = $('[data-sheet-prev]'), next = $('[data-sheet-next]');
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { idx = i; render(); }); });
    var cta = $('[data-sheet-cta]');
    if (cta) cta.addEventListener('click', function () { hide(); setTimeout(function () { goToSection('contact'); }, 300); });

    // swipe
    var startX = 0;
    sheet.addEventListener('touchstart', function (e) { startX = e.changedTouches[0].screenX; }, { passive: true });
    sheet.addEventListener('touchend', function (e) {
      var delta = startX - e.changedTouches[0].screenX;
      if (Math.abs(delta) > 50) step(delta > 0 ? 1 : -1);
    }, { passive: true });

    window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) hide(); });
    hide();
  }

  /* ------------------------------------------------------------------ *
   * 7. Mobile snap carousels (universities + testimonials) — dot sync.
   *    Mirrors the reference: observer scoped to the scroll container,
   *    threshold 0.6, 50ms debounce.
   * ------------------------------------------------------------------ */
  function initCarousel(trackSel, cardSel, dotSel) {
    var track = $(trackSel);
    if (!track) return;
    var cards = $$(cardSel, track);
    var dots  = $$(dotSel);
    if (!cards.length || !dots.length) return;

    function paint(i) {
      dots.forEach(function (d, j) {
        setClasses(d, j === i ? 'w-1.5 bg-border-color' : 'w-4 bg-primary',
                      j === i ? 'w-4 bg-primary' : 'w-1.5 bg-border-color');
      });
    }
    paint(0);

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () {
        if (cards[i]) cards[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    });

    if (!('IntersectionObserver' in window)) return;
    var timer = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var n = Number(e.target.getAttribute('data-index'));
        if (isNaN(n)) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { paint(n); }, 50);
      });
    }, { root: track, threshold: 0.6 });
    cards.forEach(function (c) { io.observe(c); });
  }

  /* ------------------------------------------------------------------ *
   * 8. FAQ accordion — desktop and mobile variants.
   * ------------------------------------------------------------------ */
  function initFaq() {
    // desktop
    var dItems = $$('[data-faq-item]');
    if (dItems.length) {
      var dOpen = 0;
      var paintD = function () {
        dItems.forEach(function (item, i) {
          var on = i === dOpen;
          var q    = $('[data-faq-q]', item);
          var ic   = $('[data-faq-icon-wrap]', item);
          var chev = $('[data-faq-chevron]', item);
          var body = $('[data-faq-body]', item);
          setClasses(item, on ? 'border-border-color shadow-sm hover:shadow-md' : 'border-primary/30 shadow-md shadow-primary/5',
                           on ? 'border-primary/30 shadow-md shadow-primary/5' : 'border-border-color shadow-sm hover:shadow-md');
          setClasses(q, on ? 'text-text-main group-hover:text-primary' : 'text-primary',
                        on ? 'text-primary' : 'text-text-main group-hover:text-primary');
          setClasses(ic, on ? 'bg-bg-dark text-text-muted group-hover:bg-primary/5 group-hover:text-primary' : 'bg-primary/10 text-primary',
                         on ? 'bg-primary/10 text-primary' : 'bg-bg-dark text-text-muted group-hover:bg-primary/5 group-hover:text-primary');
          if (chev) chev.classList.toggle('rotate-180', on);
          setClasses(body, on ? 'max-h-0 opacity-0' : 'max-h-96 pb-6 opacity-100',
                           on ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0');
        });
      };
      dItems.forEach(function (item, i) {
        var btn = $('[data-faq-toggle]', item);
        if (btn) btn.addEventListener('click', function () { dOpen = (dOpen === i) ? null : i; paintD(); });
      });
      paintD();
    }

    // mobile
    var mItems = $$('[data-faq-m-item]');
    if (mItems.length) {
      var mOpen = 0;
      var paintM = function () {
        mItems.forEach(function (item, i) {
          var on = i === mOpen;
          item.style.border    = on ? '1px solid rgba(118,13,13,0.2)' : '1px solid rgba(18,58,58,0.1)';
          item.style.boxShadow = on ? '0 4px 20px rgba(118,13,13,0.08)' : '0 1px 6px rgba(18,58,58,0.07)';
          var num  = $('[data-faq-m-num]', item);
          var q    = $('[data-faq-m-q]', item);
          var chev = $('[data-faq-m-chevron]', item);
          var body = $('[data-faq-m-body]', item);
          if (num) { num.style.background = on ? '#760d0d' : 'rgba(18,58,58,0.08)'; num.style.color = on ? 'white' : '#123a3a'; }
          if (q)    q.style.color = on ? '#760d0d' : '#1a2e2e';
          if (chev) { chev.style.color = on ? '#760d0d' : '#123a3a'; chev.style.transform = on ? 'rotate(180deg)' : 'rotate(0deg)'; }
          if (body) { body.style.maxHeight = on ? '300px' : '0'; body.style.opacity = on ? '1' : '0'; }
        });
      };
      mItems.forEach(function (item, i) {
        var btn = $('[data-faq-m-toggle]', item);
        if (btn) btn.addEventListener('click', function () { mOpen = (mOpen === i) ? null : i; paintM(); });
      });
      paintM();
    }
  }

  /* ------------------------------------------------------------------ *
   * 9. Lead forms → /api/enquiry.
   * ------------------------------------------------------------------ */
  /* Enquiries go to our own serverless function, not a third-party form
     service. Nothing secret lives here: the mail-provider API key and the
     recipient are server-side only (see _tooling/serverless/enquiry.py). The form has
     four states — idle, submitting (button disabled and relabelled), success
     and error — and `status()` below is the only thing that switches between
     them, so the success and error boxes can never both be showing. */
  var ENQUIRY_ENDPOINT = '/api/enquiry';

  function enquiryPage() {
    try { return location.host + location.pathname; } catch (e) { return ''; }
  }

  function initForms() {
    $$('form[data-lead-form]').forEach(function (form) {
      var btn      = $('[data-submit-btn]', form);
      var btnLabel = btn ? btn.textContent : '';
      var okBox    = $('[data-form-success]', form);
      var errBox   = $('[data-form-error]', form);

      function status(state, msg) {
        if (okBox)  okBox.classList.toggle('hidden', state !== 'success');
        if (errBox) {
          errBox.classList.toggle('hidden', state !== 'error');
          if (state === 'error' && msg) {
            var t = $('[data-form-error-text]', errBox) || errBox;
            t.textContent = msg;
          }
        }
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        status('idle');

        var data = {};
        new FormData(form).forEach(function (v, k) { data[k] = v; });

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) {
          status('error', 'Please enter a valid email address.');
          return;
        }
        if (!/^[0-9]{7,15}$/.test(String(data.phone_number || '').replace(/\D/g, ''))) {
          status('error', 'Please enter a valid phone number (7-15 digits).');
          return;
        }

        data.phone = (data.country_code || '') + ' ' + (data.phone_number || '');
        delete data.country_code;
        delete data.phone_number;
        delete data.access_key;
        data.page = enquiryPage();

        if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

        fetch(ENQUIRY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data)
        })
          .then(function (r) {
            return r.json().catch(function () { return { success: false }; });
          })
          .then(function (res) {
            if (res && res.success) {
              status('success');
              form.reset();
              setTimeout(function () { status('idle'); }, 5000);
            } else {
              status('error', res.message || 'Something went wrong. Please try again.');
            }
          })
          .catch(function () {
            status('error', 'Network error. Please check your connection and try again.');
          })
          .then(function () {
            if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
          });
      });
    });

    // A university picked on the directory page pre-fills the enquiry.
    try {
      var picked = localStorage.getItem('selectedUniversity');
      if (picked) {
        localStorage.removeItem('selectedUniversity');
        $$('[data-destination-input]').forEach(function (i) { i.value = picked; });
        $$('[data-destination-label]').forEach(function (l) { l.textContent = picked; });
      }
    } catch (err) { /* storage unavailable */ }
  }

  /* ------------------------------------------------------------------ *
   * 10. AI counsellor panel.
   * ------------------------------------------------------------------ */
  var CHAT_WELCOME = "Hi! 👋 I'm your **Tutee Connect AI Counsellor**. \n\nI can answer questions about Singapore Student's Passes, top Singapore institutions, and our 99% success rate programs. How can I help you today?";

  function cannedReply(text) {
    var q = text.toLowerCase();
    if (/visa|pass|student's pass|solar|ica|refus/.test(q))
      return 'Singapore issues a **Student\'s Pass**, applied for through **SOLAR** by your institution and approved by **ICA**. Apply **two to three months before your course starts**, then complete formalities on arrival — biometrics and a **medical examination**. There is **no credibility interview**, so the decisive work is documentary. Tutee Connect boasts a **99% Singapore Student\'s Pass Success Rate**, with rigorous documentation support so you are fully prepared.';
    if (/scholarship|fund|financial|aid|bursar/.test(q))
      return 'Singapore\'s big one is the **MOE Tuition Grant**, which is open to **international students** and roughly **halves your tuition** — in return for a **three-year bond** working for a Singapore-registered employer after you graduate. On top of that the institutions offer generous merit scholarships. We analyse your academic profile and help you apply where you have the highest chance of securing funding.';
    if (/cost|fee|tuition|money|expense/.test(q))
      return 'It depends enormously on whether you take the MOE Tuition Grant. At NUS in **AY2026/27**, an international student on the grant pays about **S$21,000 to S$30,000 a year** for most programs, and about **S$33,000 to S$45,000 without it**. Private institutions are generally lower and are not covered by the grant. We help students secure **non-collateral education loans** and find permitted part-time work.';
    if (/job|work|earn|part.?time|employment pass|compass/.test(q))
      return "This one needs care. You may work **16 hours a week in term time** — and without an hourly cap during vacation — **only if your institution is on the Ministry of Manpower's specified list**, which is essentially the autonomous universities, the polytechnics and ITE. Students at **most private institutions may not work at all**. After graduating from an Institute of Higher Learning you can take a **one-year Long-Term Visit Pass** to job-hunt (you cannot work on it), then move to an **Employment Pass**. Our 'Earn While You Learn' initiative guides eligible students on securing these jobs immediately upon arrival.";
    if (/ielts|pte|duolingo|gmat|exam|english/.test(q))
      return 'Singapore sets **no immigration language test** — there is no equivalent of a SELT, and ICA does not ask for a language certificate. The requirement comes from the **institution**, and the universities accept **IELTS Academic, TOEFL iBT or PTE Academic**. Some postgraduate courses such as MBAs also ask for a GMAT score. We can help you shortlist institutions that perfectly match your current scores.';
    if (/tutee|connect|service|help/.test(q))
      return 'Tutee Connect provides end-to-end support for Singapore admissions! From institution shortlisting and applications, to SOLAR registration and Student\'s Pass documentation, MOE Tuition Grant applications, education loans, and post-landing settlement. We are your one-stop solution.';
    return "That's a great question! Studying in Singapore involves a lot of moving parts (admissions, SOLAR and the Student's Pass, the Tuition Grant bond, loans), and our experts at Tutee Connect are dedicated to navigating every single detail with you.";
  }

  function initChat() {
    var panel    = $('[data-chat-panel]');
    var launcher = $('[data-chat-open]');
    if (!panel || !launcher) return;

    var list    = $('[data-chat-messages]');
    var form    = $('[data-chat-form]');
    var input   = $('[data-chat-input]');
    var typing  = $('[data-chat-typing]');
    var chips   = $$('[data-chat-chip]');
    var chipRow = $('[data-chat-chips]');

    var stage = 'idle';           // idle | asking_name | asking_phone | asking_email
    var lead  = { name: '', phone: '', email: '' };
    var askedForDetails = false;
    var isOpen = false;

    var AI_AVATAR = './assets/img/logo/icon.png';
    var USER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';

    function clockNow() {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /* Markup mirrors the reference message bubble exactly. */
    function push(role, content) {
      if (!list) return;
      var isAi = role === 'assistant';
      var wrap = document.createElement('div');
      wrap.className = 'flex gap-2.5 max-w-[90%] ' + (isAi ? 'self-start' : 'self-end ml-auto flex-row-reverse');
      wrap.innerHTML =
        '<div class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 outline outline-1 outline-offset-1 ' +
          (isAi ? 'bg-white outline-border-color shadow-sm' : 'bg-secondary text-white outline-transparent') + '">' +
          (isAi ? '<img src="' + AI_AVATAR + '" alt="AI" class="w-[20px] h-[20px] object-contain">' : USER_ICON) +
        '</div>' +
        '<div class="px-4 py-3 rounded-[20px] text-[14.5px] leading-relaxed relative ' +
          (isAi ? 'bg-white border border-border-color text-text-main rounded-tl-sm shadow-sm'
                : 'bg-primary text-white rounded-tr-sm shadow-md') + '">' +
          (isAi
            ? '<div class="prose prose-sm prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 prose-strong:text-text-main max-w-none break-words">' + mdToHtml(content) + '</div>'
            : '<div class="whitespace-pre-wrap break-words">' + mdToHtml(content) + '</div>') +
          '<div class="text-[10px] mt-1 text-right ' + (isAi ? 'text-text-muted/60' : 'text-white/60') + '">' + clockNow() + '</div>' +
        '</div>';
      if (typing && typing.parentNode === list) list.insertBefore(wrap, typing);
      else list.appendChild(wrap);
      list.scrollTop = list.scrollHeight;
    }
    function setTyping(on) {
      if (typing) typing.classList.toggle('hidden', !on);
      if (list) list.scrollTop = list.scrollHeight;
    }
    function hideChips() { if (chipRow) chipRow.classList.add('hidden'); }

    /* Inline styles beat the compiled Tailwind translate utilities, so the
       slide-in works identically at both breakpoints. */
    function paintPanel() {
      var mobile = window.matchMedia('(max-width: 767px)').matches;
      if (isOpen) {
        panel.style.transform = 'translateY(0)';
        panel.style.opacity = '1';
        panel.style.pointerEvents = 'auto';
      } else {
        panel.style.transform = mobile ? 'translateY(100%)' : 'translateY(20px)';
        panel.style.opacity = '0';
        panel.style.pointerEvents = 'none';
      }
    }
    function open() {
      isOpen = true; paintPanel();
      setClasses(launcher, 'scale-100 opacity-100', 'scale-0 opacity-0 pointer-events-none');
      if (list && !list.querySelector('[data-chat-msg-seeded]')) {
        list.setAttribute('data-chat-msg-seeded', '1');
      }
      if (input) setTimeout(function () { input.focus(); }, 250);
    }
    function close() {
      isOpen = false; paintPanel();
      setClasses(launcher, 'scale-0 opacity-0 pointer-events-none', 'scale-100 opacity-100');
    }
    function reset() {
      $$('[data-chat-bubble-host] > div', list).forEach(function (n) { n.remove(); });
      if (list) {
        $$(':scope > div', list).forEach(function (n) {
          if (n !== typing && n !== chipRow && !n.hasAttribute('data-chat-tail')) n.remove();
        });
      }
      stage = 'idle';
      lead = { name: '', phone: '', email: '' };
      askedForDetails = false;
      if (chipRow) chipRow.classList.remove('hidden');
      if (input) input.value = '';
      setTyping(false);
      push('assistant', CHAT_WELCOME);
    }
    window.addEventListener('resize', paintPanel);

    function submitLead() {
      return fetch(ENQUIRY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          subject: 'New Lead from Chatbot!',
          from_name: 'Tutee AI Counsellor',
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          destination: 'Chatbot General Inquiry',
          page: enquiryPage()
        })
      }).then(function (r) {
        return r.json().catch(function () { return { success: false }; });
      });
    }

    function send(text) {
      if (!text || !text.trim()) return;
      push('user', text);
      if (input) input.value = '';
      hideChips();

      // Mid-capture: collecting name / phone / email.
      if (stage !== 'idle') {
        setTyping(true);
        setTimeout(function () {
          if (stage === 'asking_name') {
            lead.name = text;
            stage = 'asking_phone';
            setTyping(false);
            push('assistant', 'Thanks ' + text.split(' ')[0] + '! What is the best **Phone Number** (with country code) to reach you at?');
            return;
          }
          if (stage === 'asking_phone') {
            if (!/^[0-9]{7,15}$/.test(text.replace(/\D/g, ''))) {
              setTyping(false);
              push('assistant', "That doesn't look like a valid phone number. Please enter a valid number (e.g., +91 98765 43210).");
              return;
            }
            lead.phone = text;
            stage = 'asking_email';
            setTyping(false);
            push('assistant', 'Got it. Lastly, what is your **Email Address**?');
            return;
          }
          if (stage === 'asking_email') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
              setTyping(false);
              push('assistant', "That doesn't look like a valid email address. Could you double-check and try again?");
              return;
            }
            lead.email = text;
            setTyping(false);
            push('assistant', 'Perfect! Submitting your profile to our experts now...');
            stage = 'idle';
            setTyping(true);
            submitLead()
              .then(function (res) {
                setTyping(false);
                push('assistant', res && res.success
                  ? '✅ **Success!** Your profile has been assigned to an expert counsellor. They will contact you shortly to help with your admission and visa process.\n\nIs there anything else I can help you with in the meantime?'
                  : 'Oops, something went wrong submitting your profile. Please try using the main contact form on our website.');
              })
              .catch(function () {
                setTyping(false);
                push('assistant', 'Network error while submitting. Please try the main contact form or WhatsApp!');
              });
          }
        }, 600);
        return;
      }

      // Explicit "evaluate my profile" starts capture straight away.
      if (/^evaluate my profile$/i.test(text.trim())) {
        setTyping(true);
        setTimeout(function () {
          setTyping(false);
          stage = 'asking_name';
          push('assistant', "I'd be happy to help you evaluate your profile! Our expert human counsellors review these directly to ensure accuracy.\n\nCould I please get your **Full Name**?");
        }, 500);
        return;
      }

      // Normal answer, then ask for details once.
      setTyping(true);
      setTimeout(function () {
        setTyping(false);
        push('assistant', cannedReply(text));
        if (!askedForDetails) {
          askedForDetails = true;
          setTyping(true);
          setTimeout(function () {
            setTyping(false);
            push('assistant', 'To give you the most accurate and personalised guidance for your unique profile, could I quickly grab your **Full Name**?');
            stage = 'asking_name';
          }, 1500);
        }
      }, 700);
    }

    launcher.addEventListener('click', open);
    $$('[data-chat-close]').forEach(function (b) { b.addEventListener('click', close); });
    $$('[data-chat-reset]').forEach(function (b) { b.addEventListener('click', reset); });
    $$('[data-chat-contact]').forEach(function (b) {
      b.addEventListener('click', function () { close(); goToSection('contact'); });
    });
    chips.forEach(function (c) {
      c.addEventListener('click', function () { send(c.textContent.trim()); });
    });
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        send(input ? input.value : '');
        syncSendBtn();
      });
    }

    // Send button enables only with content, matching the reference.
    var sendBtn = $('[data-chat-send]');
    var SEND_OFF = 'bg-border-color text-text-muted/50';
    var SEND_ON  = 'bg-primary text-white shadow-md active:scale-90 hover:bg-primary-dark';
    function syncSendBtn() {
      if (!sendBtn || !input) return;
      var has = !!input.value.trim();
      sendBtn.disabled = !has;
      if (has) setClasses(sendBtn, SEND_OFF, SEND_ON);
      else     setClasses(sendBtn, SEND_ON, SEND_OFF);
    }
    if (input) {
      input.addEventListener('input', syncSendBtn);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send(input.value);
          syncSendBtn();
        }
      });
    }
    syncSendBtn();
    close();
  }

  /* ------------------------------------------------------------------ *
   * 11. University directory page — search + paging + selection.
   * ------------------------------------------------------------------ */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var ICON_TROPHY = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trophy text-primary" aria-hidden="true"><path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"></path><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"></path><path d="M18 9h1.5a1 1 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"></path><path d="M6 9H4.5a1 1 0 0 1 0-5H6"></path></svg>';
  var ICON_BUILDING = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-building-2 text-primary" aria-hidden="true"><path d="M10 12h4"></path><path d="M10 8h4"></path><path d="M14 21v-3a2 2 0 0 0-4 0v3"></path><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path></svg>';
  var ICON_PIN = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin text-primary/70 shrink-0" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>';
  var ICON_CAP = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-graduation-cap text-text-muted shrink-0" aria-hidden="true"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"></path><path d="M22 10v6"></path><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path></svg>';
  var ICON_USERS = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users text-text-muted" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle></svg>';
  var ICON_GLOBE = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe text-primary" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>';
  var ICON_TICK = '<svg class="w-3 h-3 text-white" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

  /* The QS World University Rankings 2027 cover only FOUR Singapore
     institutions, and no published table — QS World, QS Asia, THE or ARWU
     — reaches a fifth: SIT and SUSS have never been assessed, and no
     ranking covers a polytechnic. So only entries 1-4 are flagged `ranked` and
     get a position. Everything else shows a dash rather than implying a
     ranking it doesn't hold. */
  function rankLabel(u) {
    return u.ranked ? '#' + u.rank : '\u2014';
  }

  function initDirectory() {
    var grid = $('[data-uni-grid]');
    if (!grid || !window.SG_UNIVERSITIES) return;

    var all       = window.SG_UNIVERSITIES;


    /* The bundled dataset above is the fallback; Supabase is the source of truth.

       supabase-data.js calls this when a fresher copy arrives — it swaps the rows

       and re-renders through the normal filter path, so no listener is rebound and

       the current search term survives. Returns false for an empty or malformed

       payload, which leaves the bundled data untouched. */

    window.TC_applyUniversities = function (rows) {

      if (!Array.isArray(rows) || !rows.length) return false;

      all = rows;

      applyFilter();

      return true;

    };

    if (Array.isArray(window.TC_pendingUniversities) && window.TC_pendingUniversities.length) {

      all = window.TC_pendingUniversities;          // arrived before the page was ready

      window.TC_pendingUniversities = null;

    }
    var list      = $('[data-uni-list-mobile]');
    var search    = $('[data-uni-search]');
    var clearBtn  = $('[data-uni-clear]');
    var countEl   = $('[data-uni-count]');
    var moreWrap  = $('[data-uni-more-wrap]');
    var moreBtn   = $('[data-uni-more]');
    var emptyBox  = $('[data-uni-empty]');
    var resultBox = $('[data-uni-results]');
    var bar       = $('[data-uni-bar]');
    var barCount  = $('[data-uni-bar-count]');
    var barNoun   = $('[data-uni-bar-noun]');
    var modal     = $('[data-uni-modal]');
    var modalBtn  = $('[data-uni-modal-submit]');

    var PAGE     = 20;
    var shown    = PAGE;
    var filtered = all;
    var selected = [];

    /* Mobile row — same markup as the reference compact list. */
    function row(u) {
      var on = selected.indexOf(u.name) > -1;
      return '<div data-uni-row="' + esc(u.name) + '" class="flex items-center gap-3 px-4 py-3.5 transition-all active:scale-[0.99] cursor-pointer select-none ' +
          (on ? 'bg-primary/[0.04]' : 'bg-bg-surface hover:bg-bg-dark') + '">' +
          '<div class="shrink-0 w-9 h-9 rounded-xl flex flex-col items-center justify-center ' +
            (on ? 'bg-primary text-white' : 'bg-primary/8 text-primary') + '">' +
            '<span class="text-[10px] font-black leading-none">' + rankLabel(u) + '</span></div>' +
          '<div class="flex-grow min-w-0">' +
            '<p class="text-[13.5px] font-bold leading-tight truncate transition-colors ' + (on ? 'text-primary' : 'text-text-main') + '">' + esc(u.name) + '</p>' +
            '<div class="flex items-center gap-2 mt-0.5">' +
              '<span class="text-[11px] text-text-muted truncate">' + esc(u.location) + '</span>' +
              '<span class="shrink-0 text-[10px] font-bold text-text-muted/50 bg-bg-dark px-1.5 py-0.5 rounded-md">' + esc(u.stpBasis) + '</span>' +
            '</div></div>' +
          '<div class="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ' +
            (on ? 'bg-primary border-primary' : 'border-border-color bg-bg-surface') + '">' + (on ? ICON_TICK : '') + '</div>' +
        '</div>';
    }

    /* Desktop card — same markup as the reference detailed card. */
    function card(u) {
      var on = selected.indexOf(u.name) > -1;
      return '<div class="bg-bg-surface rounded-2xl p-5 md:p-6 border border-border-color shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 group flex flex-col sm:flex-row sm:items-center gap-6">' +
          '<div class="shrink-0 flex items-center sm:flex-col sm:justify-center w-auto sm:w-20 sm:h-20 bg-primary/5 rounded-xl border border-primary/10 p-3 self-start sm:self-auto gap-3 sm:gap-1">' +
            (u.ranked ? ICON_TROPHY : ICON_BUILDING) +
            '<span class="font-bold text-primary text-lg md:text-xl">' + rankLabel(u) + '</span></div>' +
          '<div class="flex-grow min-w-0">' +
            '<div class="flex items-start justify-between gap-4 mb-1">' +
              '<h3 class="text-lg md:text-xl font-bold text-text-main group-hover:text-primary transition-colors text-wrap" title="' + esc(u.name) + '">' + esc(u.name) + '</h3>' +
              '<span class="shrink-0 text-xs font-bold px-2.5 py-1 rounded-md border bg-secondary/5 text-secondary border-secondary/20">' + esc(u.type) + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-1.5 text-text-muted text-sm font-medium mb-3">' + ICON_PIN +
              '<span class="text-wrap break-words">' + esc(u.location) + '</span></div>' +
            '<div class="flex flex-wrap gap-3">' +
              '<div class="flex items-center gap-2 text-sm bg-bg-surface px-3 py-2 rounded-lg border border-border-color shrink-0 max-w-full">' + ICON_CAP +
                '<span class="text-text-muted text-wrap break-words" title="' + esc(u.programs) + '">' + esc(u.programs) + '</span></div>' +
              '<div class="flex items-center gap-2 text-sm bg-bg-surface px-3 py-2 rounded-lg border border-border-color shrink-0">' + ICON_USERS +
                '<span class="text-text-muted">Student\'s Pass: <strong class="text-text-main">' + esc(u.stpBasis) + '</strong></span></div>' +
              '<div class="flex items-center gap-2 text-sm bg-[#EEF2FF] text-primary px-3 py-2 rounded-lg border border-primary/20 shrink-0">' + ICON_GLOBE +
                '<span class="font-semibold">Intl. Admits: Yes</span></div>' +
            '</div></div>' +
          '<div class="shrink-0 sm:self-center mt-4 sm:mt-0">' +
            '<button type="button" data-uni-select="' + esc(u.name) + '" class="cursor-pointer w-full sm:w-28 px-4 py-3 sm:py-2 border sm:rounded-full rounded-xl flex items-center justify-center font-bold text-sm transition-all shadow-sm ' +
              (on ? 'bg-primary border-primary text-white hover:bg-primary-dark'
                  : 'bg-bg-surface border-border-color text-text-muted hover:bg-primary/5 hover:border-primary/20 hover:text-primary') + '">' +
              (on ? 'Selected' : 'Select') + '</button></div>' +
        '</div>';
    }

    function toggle(name) {
      var i = selected.indexOf(name);
      if (i > -1) selected.splice(i, 1);
      else selected.push(name);
      render();
    }

    function render() {
      var page = filtered.slice(0, shown);
      if (list) list.innerHTML = page.map(row).join('');
      grid.innerHTML = page.map(card).join('');

      if (countEl) countEl.textContent = 'Showing ' + filtered.length + ' ' + (filtered.length === 1 ? 'Institution' : 'Institutions');
      if (emptyBox)  emptyBox.classList.toggle('hidden', filtered.length !== 0);
      if (resultBox) resultBox.classList.toggle('hidden', filtered.length === 0);
      if (moreWrap)  moreWrap.classList.toggle('hidden', shown >= filtered.length);
      if (clearBtn)  clearBtn.classList.toggle('hidden', !(search && search.value));

      // selection bar
      if (bar) {
        bar.classList.toggle('hidden', selected.length === 0);
        if (barCount) barCount.textContent = String(selected.length);
        if (barNoun)  barNoun.textContent = (selected.length === 1 ? 'Institution' : 'Institutions') + ' Selected';
      }
      if (modalBtn) {
        modalBtn.textContent = selected.length > 0
          ? 'Apply to ' + selected.length + ' ' + (selected.length === 1 ? 'Institution' : 'Institutions')
          : 'Submit Profile';
      }
      $$('[data-destination-input]', modal || document).forEach(function (i) { i.value = selected.join(', ') || 'General Singapore Inquiry'; });
      $$('[data-destination-label]', modal || document).forEach(function (l) { l.textContent = selected.join(', ') || 'General Singapore Inquiry'; });

      $$('[data-uni-select]', grid).forEach(function (b) {
        b.addEventListener('click', function () { toggle(b.getAttribute('data-uni-select')); });
      });
      if (list) $$('[data-uni-row]', list).forEach(function (r) {
        r.addEventListener('click', function () { toggle(r.getAttribute('data-uni-row')); });
      });
    }

    /* `alt` is searched but never rendered. The CPE register holds legal
       institution names, so without it the directory could not be found by the
       short forms applicants actually type -- "NUS", "NTU", "SIM", "MDIS",
       "PSB", "JCU", "EASB", "LSBF", "Kaplan" -- nor by the URA planning region,
       because the card shows only the planning area. Every run of punctuation
       becomes a single space so that "at sunrice" finds "At-Sunrice" and
       "sp jain" finds "SP Jain", and accents are stripped to base letters.
       Folding is the only change here: no markup, classes or animation are
       touched. */
    function defold(s) {
      s = s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
      return s.replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function haystack(u) {
      if (u.__hay === undefined) {
        u.__hay = defold((u.name + ' ' + u.location + ' ' + u.programs + ' ' +
                          u.type + ' ' + (u.alt || '')).toLowerCase());
      }
      return u.__hay;
    }

    function applyFilter() {
      var q = defold((search ? search.value : '').trim().toLowerCase());
      filtered = !q ? all : all.filter(function (u) {
        return haystack(u).indexOf(q) > -1;
      });
      shown = PAGE;
      render();
    }

    if (search)   search.addEventListener('input', applyFilter);
    var showBtn = $('[data-uni-show-results]');
    if (showBtn) {
      showBtn.addEventListener('click', function () {
        applyFilter();
        var anchor = $('[data-uni-results]') || grid;
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    if (clearBtn) clearBtn.addEventListener('click', function () { if (search) search.value = ''; applyFilter(); });
    if (moreBtn)  moreBtn.addEventListener('click', function () { shown += PAGE; render(); });

    // selection -> modal
    var openModal  = $('[data-uni-proceed]');
    var closeModal = $('[data-uni-modal-close]');
    if (openModal && modal) {
      openModal.addEventListener('click', function () {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      });
    }
    if (closeModal && modal) {
      closeModal.addEventListener('click', function () {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
      });
    }
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          modal.classList.add('hidden');
          document.body.style.overflow = '';
        }
      });
    }
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
      }
    });

    render();
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  var services = window.SG_SERVICES || [];
  initReveal();
  initHeader();
  initMobileMenu();
  initScrollTargets();
  initServicesDesktop(services);
  initServicesMobile(services);
  initCarousel('[data-uni-track]',  '.university-card',  '[data-uni-dot]');
  initCarousel('[data-tst-track]',  '.testimonial-card', '[data-tst-dot]');
  initFaq();
  initForms();
  initChat();
  initDirectory();

  // Deep link support: /index.html#contact etc.
  if (window.location.hash && window.location.hash.length > 1) {
    var id = window.location.hash.slice(1);
    setTimeout(function () { smoothTo(id); }, 300);
  }
})();
