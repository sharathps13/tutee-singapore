/**
 * Serve the university directory from Supabase, with the bundled file as fallback.
 *
 * Load order on universities.html is:
 *
 *   universities-data.js   the static dataset — renders instantly, always works
 *   supabase-data.js       this file — asks Supabase for a fresher copy
 *   main.js                the page
 *
 * So the directory is never blank and never depends on the network: the page
 * paints from the bundled data, and if Supabase answers, the rows are swapped in
 * and the grid re-renders. If Supabase is unreachable, misconfigured, slow or
 * out of quota, the visitor sees the bundled data and nothing looks broken.
 *
 * The anon key is meant to be public — it is the key browsers use — and the
 * `universities` table is SELECT-only for it under RLS. No service key, and
 * nothing that can read a lead, ever reaches this file.
 *
 * Configuration lives in assets/js/supabase-config.js (generated per site). Until
 * that file is filled in, this is a no-op and the bundled dataset is used.
 *
 * Canonical copy: _tooling/netlify/supabase-data.js — installed into every site
 * by _tooling/install_netlify.py. Edit it there.
 */
(function () {
  'use strict';

  var cfg = window.TC_SUPABASE || {};
  var url = (cfg.url || '').replace(/\/+$/, '');
  var key = cfg.anonKey || '';
  var country = cfg.country || '';

  // Not configured yet — keep the bundled dataset. This is the default state
  // and is deliberately silent: a site should deploy and work before Supabase
  // exists.
  if (!url || !key || !country) return;

  // Only the directory page consumes the dataset; the home page's twelve cards
  // are static markup. No point spending a request there.
  if (!document.querySelector('[data-uni-grid]')) return;

  // PostgREST returns at most 1000 rows per request by default, and three of
  // the datasets are larger than that (Australia 1258, France 1156, Canada
  // 1135). Page until a short page comes back.
  var PAGE = 1000;
  var MAX_PAGES = 20;          // 20k rows is far beyond any real dataset
  var TIMEOUT_MS = 8000;

  function fetchPage(offset) {
    var endpoint = url + '/rest/v1/universities'
      + '?select=slug,name,rank,location,type,programs,ranked,attrs'
      + '&country=eq.' + encodeURIComponent(country)
      + '&order=rank.asc'
      + '&limit=' + PAGE
      + '&offset=' + offset;

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;

    return fetch(endpoint, {
      headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' },
      signal: controller ? controller.signal : undefined,
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  /* Rebuild the object shape the page already expects: the typed core columns
     plus the country-specific remainder that was stored in `attrs`. */
  function toRow(r) {
    var out = {
      id: r.slug,
      name: r.name,
      rank: r.rank,
      location: r.location,
      type: r.type,
      programs: r.programs,
      ranked: !!r.ranked,
    };
    var attrs = r.attrs || {};
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) out[k] = attrs[k];
    }
    return out;
  }

  function loadAll() {
    var rows = [];
    function next(offset, page) {
      if (page >= MAX_PAGES) return Promise.resolve(rows);
      return fetchPage(offset).then(function (batch) {
        if (!Array.isArray(batch)) throw new Error('unexpected payload');
        rows = rows.concat(batch.map(toRow));
        if (batch.length < PAGE) return rows;
        return next(offset + PAGE, page + 1);
      });
    }
    return next(0, 0);
  }

  loadAll().then(function (rows) {
    if (!rows.length) return;                       // empty table — keep bundled

    // main.js exposes this once the directory is initialised. If the page has
    // not reached that point yet, stash the rows and let it pick them up.
    if (typeof window.TC_applyUniversities === 'function') {
      window.TC_applyUniversities(rows);
    } else {
      window.TC_pendingUniversities = rows;
    }
  }).catch(function (err) {
    // Never surface this to the visitor: the bundled dataset is already on
    // screen and correct. Log for whoever is looking at the console.
    if (window.console && console.warn) {
      console.warn('universities: live data unavailable, using bundled copy ('
        + (err && err.message ? err.message : err) + ')');
    }
  });
})();
