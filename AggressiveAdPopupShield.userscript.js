// ==UserScript==
// @name         Aggressive Ad, Pop-up & Anti-Adblock Shield
// @namespace    local.shield.adandpopup
// @version      2.2.0
// @description  Strips embedded ads, blocks click-jack pop-ups, defuses anti-adblock modals, and cleans AI search boxes.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  /* =========================================================================
   * 1. GOOGLE SEARCH CLEANER (udm=14 Web Mode)
   * ========================================================================= */
  try {
    const host = window.location.hostname;
    const path = window.location.pathname;
    if (host.includes('google.') && (path === '/search' || path.startsWith('/search'))) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('q') && !urlParams.has('udm') && !urlParams.has('tbm')) {
        urlParams.set('udm', '14');
        window.location.replace(`${window.location.origin}${path}?${urlParams.toString()}`);
        return;
      }
    }
  } catch (_) {}

  /* =========================================================================
   * 2. PRE-RENDER CSS SUPPRESSION
   * ========================================================================= */
  const BLOCKED_SELECTORS = [
    'div[data-attrid="wa:/description"]',
    'div[jsname="N760b"]',
    '#super-search-ai',
    'div:has(> [aria-label*="AI Overview" i])',
    'div:has(> [aria-label*="Resumen de IA" i])',
    'div:has(> [aria-label*="Resumen creado por IA" i])',
    '[data-entityname*="AI Overview"]',
    '.g-blk:has([data-async-context*="ai_overview"])',
    '#b_copilot', '.b_side_copilot', '.copilot-banner',
    '[data-testid="duckassist"]',
    '.adsbygoogle', 'ins.adsbygoogle', '[id*="google_ads"]', '[id*="div-gpt-ad"]',
    '[class*="taboola"]', '[id*="taboola"]',
    '[class*="outbrain"]', '[id*="outbrain"]',
    '[class*="zergnet"]', '[id*="zergnet"]',
    '[class*="criteo"]', '[id*="criteo"]',
    '[class*="teads"]', '[id*="teads"]',
    '[class*="ad-slot"]', '[id*="ad-slot"]',
    '[class*="ad-banner"]', '[id*="ad-banner"]',
    '[class*="ad-container"]', '[id*="ad-container"]',
    '[class*="ad-wrapper"]', '[id*="ad-wrapper"]',
    '[class*="floating-ad"]', '[class*="sticky-ad"]',
    '[id*="sticky-banner"]', '[class*="sponsored-post"]',
    '[class*="adblock-modal"]', '[id*="adblock-modal"]',
    '[class*="adblock-overlay"]', '[id*="adblock-overlay"]',
    '[class*="adblock-wall"]', '[id*="adblock-wall"]',
    '[class*="sp-message-container"]',
    'tp-yt-paper-dialog:has(#content > ytd-enforcement-message-view-model)'
  ];

  const injectStyles = () => {
    const style = document.createElement('style');
    style.id = 'embedded-shield-css';
    style.textContent = `
      ${BLOCKED_SELECTORS.join(',\n')} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        max-height: 0 !important;
        pointer-events: none !important;
        overflow: hidden !important;
      }
      html, body {
        overflow: auto !important;
        position: static !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  if (document.head || document.documentElement) {
    injectStyles();
  } else {
    document.addEventListener('DOMContentLoaded', injectStyles);
  }

  /* =========================================================================
   * 3. AD-SDK STUBS (Anti-Adblock Evasion)
   * ========================================================================= */
  const adsenseArray = [];
  adsenseArray.push = function (args) {
    if (typeof args === 'object' && args !== null && typeof args.onload === 'function') {
      setTimeout(args.onload, 0);
    }
    return 1;
  };
  adsenseArray.loaded = true;
  window.adsbygoogle = adsenseArray;

  window.googletag = window.googletag || {};
  window.googletag.cmd = window.googletag.cmd || [];
  window.googletag.cmd.push = function (fn) {
    if (typeof fn === 'function') {
      try { fn(); } catch (_) {}
    }
    return 1;
  };

  const dummySlot = {
    addService: function () { return this; },
    defineSizeMapping: function () { return this; },
    setCollapseEmptyDiv: function () { return this; },
    setTargeting: function () { return this; },
    clearTargeting: function () { return this; }
  };

  window.googletag.defineSlot = function () { return dummySlot; };
  window.googletag.defineOutOfPageSlot = function () { return dummySlot; };
  window.googletag.display = function () {};
  window.googletag.enableServices = function () {};
  window.googletag.pubads = function () {
    return {
      addEventListener: function () {},
      clear: function () {},
      collapseEmptyDivs: function () {},
      disableInitialLoad: function () {},
      display: function () {},
      enableSingleRequest: function () {},
      refresh: function () {},
      setTargeting: function () {}
    };
  };

  window.canRunAds = true;
  window.isAdBlockActive = false;
  window.adblocker = false;

  /* =========================================================================
   * 4. NETWORK BAIT SCRIPT DEFUSER
   * ========================================================================= */
  const AD_NET_REGEX = /(?:googlesyndication\.com\/pagead|doubleclick\.net\/gampad|securepubads|criteo\.net|adnxs\.com|taboola\.com|outbrain\.com)/i;
  const BAIT_JS_REGEX = /(?:ads?\b|adblock|advertisement|prebid)\.js(?:\?|$)/i;

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (AD_NET_REGEX.test(url) || BAIT_JS_REGEX.test(url)) {
      return Promise.resolve(new Response('/* defused */ window.canRunAds = true;', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
      }));
    }
    return origFetch.apply(this, arguments);
  };

  const origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._shield_url = typeof url === 'string' ? url : '';
    return origXhrOpen.apply(this, arguments);
  };

  const origXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    const targetUrl = this._shield_url || '';
    if (AD_NET_REGEX.test(targetUrl) || BAIT_JS_REGEX.test(targetUrl)) {
      Object.defineProperty(this, 'status', { value: 200 });
      Object.defineProperty(this, 'readyState', { value: 4 });
      Object.defineProperty(this, 'responseText', { value: '/* defused */' });
      Object.defineProperty(this, 'response', { value: '/* defused */' });
      setTimeout(() => {
        this.dispatchEvent(new Event('readystatechange'));
        this.dispatchEvent(new Event('load'));
      }, 0);
      return;
    }
    return origXhrSend.apply(this, arguments);
  };

  /* =========================================================================
   * 5. POP-UP & CLICK-TRAP INTERCEPTOR
   * ========================================================================= */
  const BLOCKED_REDIRECTS = [
    /\b(affiliate|redirect|track|click|popup|popunder|adserver|banner|traffic)\b/i,
    /[?&](utm_|click_id=|aff_id=|ad_id=|ref_id=)/i,
    /(doubleclick\.net|googlesyndication|adnxs|exoclick|propellerads|popads|outbrain|taboola|bet365|1xbet)/i
  ];

  function isBlockedUrl(url) {
    if (!url || url === 'about:blank' || url === 'javascript:void(0)') return true;
    return BLOCKED_REDIRECTS.some(p => p.test(url));
  }

  const nativeOpen = window.open;
  window.open = function (url, name, specs) {
    if (typeof url !== 'string' || isBlockedUrl(url)) {
      return null;
    }
    return nativeOpen.call(window, url, name, specs);
  };

  window.addEventListener('click', function (e) {
    if (!e.isTrusted) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    const anchor = e.target.closest('a');
    if (anchor) {
      const href = anchor.getAttribute('href') || anchor.href || '';
      if (isBlockedUrl(href)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (anchor.target === '_blank') {
        anchor.rel = 'noopener noreferrer';
      }
    }

    const target = e.target;
    if (target && target !== document.body && target !== document.documentElement) {
      const style = window.getComputedStyle(target);
      const isTrap =
        style.position === 'fixed' &&
        (parseInt(style.zIndex, 10) > 1000 || style.zIndex === '2147483647') &&
        (style.opacity === '0' || style.backgroundColor === 'transparent' || style.backgroundColor === 'rgba(0, 0, 0, 0)');

      if (isTrap && !target.querySelector('input, textarea, select')) {
        target.remove();
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
  }, true);

  /* =========================================================================
   * 6. MODAL REMOVER & MUTATION OBSERVER
   * ========================================================================= */
  const NAGGING = /disable your adblocker|ad blocker detected|desactiva tu bloqueador|bloqueador de anuncios/i;

  setInterval(() => {
    const modals = document.querySelectorAll('div, section, aside');
    for (const el of modals) {
      const txt = el.textContent || '';
      if (txt.length > 20 && txt.length < 500 && NAGGING.test(txt)) {
        const s = window.getComputedStyle(el);
        if (el.offsetHeight > 100 && (s.position === 'fixed' || s.position === 'absolute')) {
          el.remove();
          document.body.style.overflow = 'auto';
          document.documentElement.style.overflow = 'auto';
        }
      }
    }
  }, 1000);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (!node || node.nodeType !== 1) return;
        for (const sel of BLOCKED_SELECTORS) {
          if (node.matches && node.matches(sel)) {
            node.remove();
            return;
          }
        }
      });
    }
  });

  const initObserver = () => {
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }
})();
