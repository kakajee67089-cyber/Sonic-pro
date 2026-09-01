(function () {
  'use strict';
  var booted = false;
  function el(id){ return document.getElementById(id); }
  function connected(){ try { return typeof SS_SOCKET_CONNECTED !== 'undefined' ? !!SS_SOCKET_CONNECTED : false; } catch(e) { return false; } }
  function hideLegacyMpTimer(){ var t=el('ss-mp-timer'); if(t){t.classList.remove('show','warn');t.textContent='';t.setAttribute('aria-hidden','true');} }

  // Multiplayer games are open-ended. Solo games keep their own local timers.
  window.ssStartMpTimer=function(){hideLegacyMpTimer();};
  window.ssStopMpTimer=function(){hideLegacyMpTimer();};
  window.ssStartMpTimer.__ssNoLimit=true;

  function patchGameClocks(){
    var oldMR=window.mrStartCountdown;
    if(typeof oldMR==='function'&&!oldMR.__ssNoLimit){window.mrStartCountdown=function(){if(window.mrSolo===false){clearInterval(window.mrTimer);var t=el('mr-timer'),p=el('mr-progress-fill');if(t)t.textContent='∞';if(p)p.style.width='100%';return;}return oldMR.apply(this,arguments);};window.mrStartCountdown.__ssNoLimit=true;}
    var oldMS=window.msStartPuzzleClock;
    if(typeof oldMS==='function'&&!oldMS.__ssNoLimit){window.msStartPuzzleClock=function(){if(window.msSolo===false){clearInterval(window.msPuzzleTimer);var t=el('ms-puzzle-time');if(t)t.textContent='∞';return;}return oldMS.apply(this,arguments);};window.msStartPuzzleClock.__ssNoLimit=true;}
    var oldMatch=window.msStartMatchClock;
    if(typeof oldMatch==='function'&&!oldMatch.__ssNoLimit){window.msStartMatchClock=function(){if(window.msSolo===false){clearInterval(window.msMatchTimer);var t=el('ms-match-time');if(t)t.textContent='∞';return;}return oldMatch.apply(this,arguments);};window.msStartMatchClock.__ssNoLimit=true;}
  }

  function installRoomSearch(){
    var host=el('pub-grooms');
    if(!host||el('ss-public-room-search'))return;
    var card=host.closest('.card');if(!card)return;
    var wrap=document.createElement('div');wrap.id='ss-public-room-search-wrap';wrap.style.cssText='display:flex;gap:8px;margin:8px 0 10px;align-items:center;';
    wrap.innerHTML='<input id="ss-public-room-search" class="inp" type="search" inputmode="search" autocomplete="off" placeholder="🔎 Search room name or code…" aria-label="Search public game rooms" style="flex:1;min-width:0;height:44px;font-size:16px!important;">';
    host.parentNode.insertBefore(wrap,host);
    var input=el('ss-public-room-search');input.addEventListener('input',filter);input.addEventListener('search',filter);
    function filter(){var q=String(input.value||'').trim().toLowerCase();host.querySelectorAll('.pubroom').forEach(function(row){row.style.display=!q||row.textContent.toLowerCase().indexOf(q)!==-1?'flex':'none';});var visible=[].slice.call(host.querySelectorAll('.pubroom')).filter(function(x){return x.style.display!=='none';});var empty=el('ss-public-room-empty');if(q&&!visible.length){if(!empty){empty=document.createElement('div');empty.id='ss-public-room-empty';empty.style.cssText='font-size:12px;color:var(--muted);padding:10px;text-align:center';host.appendChild(empty);}empty.textContent='No matching public room.';}else if(empty)empty.remove();}
    window.__ssFilterPublicRooms=filter;
  }
  function refreshRoomSearch(){
    installRoomSearch();
    try{if(typeof window.renderPubRooms==='function'&&!window.renderPubRooms.__ssWrapped){var original=window.renderPubRooms;window.renderPubRooms=function(){var r=original.apply(this,arguments);setTimeout(function(){try{window.__ssFilterPublicRooms&&window.__ssFilterPublicRooms();}catch(e){}},120);return r;};window.renderPubRooms.__ssWrapped=true;}}catch(e){}
  }

  function mobileLayout(){
    var cssId='ss-mobile-game-fix-v10';if(el(cssId))return;
    var s=document.createElement('style');s.id=cssId;s.textContent='html,body{width:100%;max-width:100%;overflow-x:hidden!important}body{min-width:0!important}#app,#auth-screen,.page,.game-overlay{width:100%!important;max-width:100vw!important;min-width:0!important;overflow-x:hidden!important}.page>*{max-width:100%!important}button,a,input,select,textarea{touch-action:manipulation}button{min-height:44px}.btn,.qopt,.cfbtn,.mr-action,.ms-action,.quiz-mode-btn{min-height:44px!important}@media(max-width:768px){#auth-screen{padding:10px!important;align-items:flex-start!important}#auth-screen .auth-wrapper-pro{width:100%!important;max-width:430px!important;margin:0 auto!important;padding-top:24px!important}#auth-screen .auth-card-ultra{width:100%!important;box-sizing:border-box!important;padding:46px 14px 16px!important}#auth-screen .auth-input-pro input{width:100%!important;box-sizing:border-box!important;font-size:16px!important}#pg-game .card,#pg-game .pubroom,#pg-quiz .card,#pg-memoryrush .mr-card,#pg-mindsnap .ms-card,#pg-cardflip .card{max-width:100%!important;box-sizing:border-box!important}#pg-game [style*="grid-template-columns:1fr 1fr"],#pg-quiz [style*="grid-template-columns:1fr 1fr"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}#pg-memoryrush .mr-grid,#pg-mindsnap .ms-grid{width:min(92vw,360px)!important;max-width:100%!important;margin-left:auto!important;margin-right:auto!important}#pg-mindsnap .ms-tile,#pg-memoryrush .mr-cell{min-width:0!important;min-height:44px!important}#fc-start-room-btn,#mr-start-btn,#ms-start-btn,#quiz-host-start{width:100%!important;min-height:48px!important}}@media(max-width:390px){#pg-game [style*="grid-template-columns:1fr 1fr"]{gap:7px!important}#pg-game .btn{padding-left:8px!important;padding-right:8px!important;font-size:12px!important}}';document.head.appendChild(s);
  }

  function syncStartButtons(){[['mr-start-btn','mr-players'],['ms-start-btn','ms-players'],['quiz-host-start','quiz-players']].forEach(function(pair){var b=el(pair[0]),box=el(pair[1]);if(!b||!box)return;var count=box.children?box.children.length:0;if(count>=2&&!b.dataset.ssForceHidden)b.style.display='flex';});}

  function installSocketRecovery(){
    try{if(typeof ssInitSocket!=='function'||ssInitSocket.__ssV10)return;var original=ssInitSocket;ssInitSocket=function(){var r=original.apply(this,arguments);setTimeout(function(){try{if(typeof SS_SOCKET!=='undefined'&&SS_SOCKET&&!SS_SOCKET.__ssV10Presence){SS_SOCKET.__ssV10Presence=true;SS_SOCKET.on('connect',function(){try{var u=(typeof U!=='undefined'?U:null);if(u)SS_SOCKET.emit('presence:register',{uid:u.uid,name:u.name||'Player',photo:u.photo||null});}catch(e){}});}}catch(e){}},100);return r;};ssInitSocket.__ssV10=true;}catch(e){}
  }

  function start(){
    if(booted)return;booted=true;mobileLayout();installRoomSearch();installSocketRecovery();patchGameClocks();hideLegacyMpTimer();refreshRoomSearch();
    setInterval(function(){try{patchGameClocks();installSocketRecovery();installRoomSearch();syncStartButtons();hideLegacyMpTimer();}catch(e){}},1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
