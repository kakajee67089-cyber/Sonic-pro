/* =====================================================================
   SonicSync Pro — v14 targeted hotfix
   Loads AFTER sonicsync-fixes.js and sonicsync-final-hotfix.js.
   Does NOT modify or replace any existing patch layer — only adds
   fixes for specific confirmed bugs. Everything here is additive and
   defensive (wrapped in try/catch), matching the existing pattern.

   Fixes included (see CHANGELOG.md for full detail):
   1. Memory Rush multiplayer: joiner never received game/room events
      because joinMemoryRushRoom() never installed the Socket.IO
      listeners that createMemoryRushRoom() installs for the host.
   2. Toast notifications: added a close/dismiss (×) button.
   3. Public room search: hardened so partial-text search (room name /
      host / code) keeps working even if the room list is briefly
      unavailable, and added a live re-filter as the room list updates.
   4. Auth screen: mobile-first layout pass (desktop styling for the
      login/register screen made subordinate to a clean single-column
      mobile layout under 720px).
   ===================================================================== */
(function () {
  'use strict';
  if (window.__SS_V14_HOTFIX__) return;
  window.__SS_V14_HOTFIX__ = true;

  var $ = function (id) { return document.getElementById(id); };
  var safe = function (fn) {
    try { return fn(); } catch (e) { console.warn('[SonicSync v14]', e); }
  };

  /* ---------------------------------------------------------------
     FIX 1 — Memory Rush multiplayer joiner never wired up.
     The host path (createMemoryRushRoom) already calls
     mrInstallSocketHandlers(). The join path did not, so a joining
     player's client never listened for room:state / room:users /
     memory:state / memory:feedback / memory:scores /
     memory:round-result — meaning no player list, no START button,
     no cards, no sync, ever, from the joiner's side.
     Fix: wrap joinMemoryRushRoom so it installs the same handlers.
  --------------------------------------------------------------- */
  function fixMemoryRushJoinHandlers() {
    var orig = window.joinMemoryRushRoom;
    if (typeof orig !== 'function' || orig.__ssV14) return;
    var wrapped = function () {
      var r = orig.apply(this, arguments);
      safe(function () {
        if (typeof window.mrInstallSocketHandlers === 'function') {
          window.mrInstallSocketHandlers();
        }
      });
      return r;
    };
    wrapped.__ssV14 = true;
    window.joinMemoryRushRoom = wrapped;
  }

  /* ---------------------------------------------------------------
     FIX 2 — Toast notifications: add a visible close/dismiss button.
     PDF requirement #17 asks for a close/dismiss option in addition
     to the existing ~3s auto-hide (which already worked correctly).
  --------------------------------------------------------------- */
  function addToastDismiss() {
    var t = $('toast');
    if (!t || t.dataset.ssV14Dismiss === '1') return;
    t.dataset.ssV14Dismiss = '1';
    t.style.position = t.style.position || 'fixed';
    t.style.paddingRight = '34px';

    var closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.style.cssText =
      'position:absolute;top:6px;right:10px;cursor:pointer;font-weight:900;' +
      'font-size:13px;opacity:.75;line-height:1;padding:4px;';
    closeBtn.onclick = function (e) {
      e.stopPropagation();
      t.classList.remove('show');
    };
    t.appendChild(closeBtn);
  }

  /* ---------------------------------------------------------------
     FIX 3 — Public room search hardening.
     The existing searchGameRoom() (patched in sonicsync-fixes.js)
     already supports partial text on room name / host / code.
     This only adds a defensive re-render if the input already has
     text when the room list finishes loading (covers the case where
     someone types before Firebase's first snapshot arrives).
  --------------------------------------------------------------- */
  function reinforcePublicRoomSearch() {
    var input = $('ss-public-room-search-v12-input');
    if (!input || input.dataset.ssV14 === '1') return;
    input.dataset.ssV14 = '1';
    // Re-run the filter shortly after room list mutations settle,
    // in case the user typed while the list was still empty.
    var host = document.getElementById('pub-grooms');
    if (host && !host.__ssV14Observer) {
      host.__ssV14Observer = true;
      var mo = new MutationObserver(function () {
        safe(function () {
          var q = input.value.trim().toLowerCase();
          if (!q) return;
          host.querySelectorAll('.pubroom').forEach(function (r) {
            r.style.display = r.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
          });
        });
      });
      mo.observe(host, { childList: true });
    }
  }

  /* ---------------------------------------------------------------
     FIX 4 — Mobile-first auth screen.
     Desktop styling stays untouched above 720px; below that, the
     login/register card goes full-width single column with larger
     touch targets. Nothing here removes or renames existing fields —
     it only affects layout/sizing.
  --------------------------------------------------------------- */
  function mobileAuthCSS() {
    if ($('ss-v14-auth-css')) return;
    var s = document.createElement('style');
    s.id = 'ss-v14-auth-css';
    s.textContent =
      '@media (max-width:720px){' +
      '#auth-screen{padding:14px !important;align-items:flex-start !important;}' +
      '#auth-screen>*{width:100% !important;max-width:100% !important;margin:0 auto !important;}' +
      '#auth-screen input,#auth-screen select{width:100% !important;font-size:16px !important;' +
      'padding:13px 14px !important;min-height:46px !important;box-sizing:border-box !important;}' +
      '#auth-screen button{width:100% !important;min-height:46px !important;font-size:15px !important;}' +
      '#auth-screen .auth-mini-link{min-height:36px !important;display:inline-flex !important;' +
      'align-items:center !important;justify-content:center !important;}' +
      '}';
    document.head.appendChild(s);
  }

  function boot() {
    fixMemoryRushJoinHandlers();
    addToastDismiss();
    reinforcePublicRoomSearch();
    mobileAuthCSS();
    // A few things (toast element, room list, join wrapper chain from
    // other patch layers) may not exist on first paint — re-run briefly.
    setTimeout(function () {
      fixMemoryRushJoinHandlers();
      addToastDismiss();
      reinforcePublicRoomSearch();
    }, 900);
    setTimeout(function () {
      fixMemoryRushJoinHandlers();
      addToastDismiss();
      reinforcePublicRoomSearch();
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
