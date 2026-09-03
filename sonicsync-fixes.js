(function(){
  'use strict';
  if(window.__SS_FIX_V12__) return;
  window.__SS_FIX_V12__=true;

  const $=id=>document.getElementById(id);
  const safe=fn=>{try{return fn()}catch(e){console.warn('[SonicSync fix]',e)}};

  function removePhoneAuth(){
    ['phone-section','otp-section','mode-toggle'].forEach(id=>$(id)?.remove());
    document.querySelectorAll('#auth-screen button').forEach(b=>{
      const t=(b.textContent||'').toLowerCase();
      if(t.includes('mobile number')||t.includes('login with phone')||t.includes('send otp')||t.includes('verify mobile')) b.remove();
    });
  }

  function mobileCSS(){
    if($('ss-v12-css')) return;
    const s=document.createElement('style');s.id='ss-v12-css';
    s.textContent=`
      *,*::before,*::after{box-sizing:border-box}
      html,body{width:100%;max-width:100%;min-width:0;overflow-x:hidden!important}
      body{touch-action:pan-y}
      #app,#auth-screen,.pages,.page,.game-overlay{width:100%!important;max-width:100vw!important;min-width:0!important;overflow-x:hidden!important}
      .pages{padding-left:max(0px,env(safe-area-inset-left));padding-right:max(0px,env(safe-area-inset-right))}
      button,.btn,.nb,input,select,textarea{touch-action:manipulation}
      button,.btn{min-height:44px}
      .page .hero h1,.page h1{line-height:1.15;overflow-wrap:anywhere}
      #pg-game [style*="grid-template-columns:1fr 1fr"],#pg-memoryrush [style*="grid-template-columns:1fr 1fr"],#pg-mindsnap [style*="grid-template-columns:1fr 1fr"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      #pg-game .btn{min-width:0}
      #pg-memoryrush .mr-grid,#pg-mindsnap .ms-grid{width:min(92vw,420px)!important;max-width:100%!important;margin-inline:auto}
      #pg-memoryrush .mr-cell,#pg-mindsnap .ms-tile{min-width:0!important;min-height:52px!important}
      #ss-mode-picker{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(7,10,24,.72);backdrop-filter:blur(10px)}
      #ss-mode-picker.show{display:flex}
      #ss-mode-picker .ssmp-card{width:min(390px,94vw);border:1px solid rgba(129,140,248,.45);border-radius:24px;padding:20px;background:linear-gradient(145deg,#161b3d,#0c1025);color:#fff;box-shadow:0 28px 90px rgba(0,0,0,.55)}
      #ss-mode-picker .ssmp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
      #ss-mode-picker button{border:0;border-radius:16px;padding:16px 10px;color:#fff;font-weight:900;cursor:pointer;font-size:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6)}
      #ss-mode-picker button.secondary{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14)}
      @media(max-width:520px){.tb{padding-left:8px!important;padding-right:8px!important}.tbl{max-width:42vw!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bnav{height:68px!important}.nb .ni{font-size:22px!important}.nb .nl{font-size:9px!important}#pg-game{padding-bottom:82px!important}#pg-game .card{padding:12px!important}}
    `;
    document.head.appendChild(s);
  }

  function installModePicker(){
    if($('ss-mode-picker')) return;
    const ov=document.createElement('div');ov.id='ss-mode-picker';ov.setAttribute('aria-hidden','true');
    ov.innerHTML=`<div class="ssmp-card" role="dialog" aria-modal="true" aria-labelledby="ssmp-title"><div style="font-size:28px">🎮</div><div id="ssmp-title" style="font-size:20px;font-weight:900;margin-top:4px">How do you want to play?</div><div class="ssmp-grid"><button id="ssmp-solo">🧑 Solo</button><button id="ssmp-multi">👥 Multiplayer</button></div><button id="ssmp-cancel" class="secondary" style="width:100%;margin-top:9px">Cancel</button></div>`;
    document.body.appendChild(ov);let action={solo:null,multi:null};
    function open(title,solo,multi){action={solo,multi};$('ssmp-title').textContent=title+' — Play mode';ov.classList.add('show');ov.setAttribute('aria-hidden','false')}
    function close(){ov.classList.remove('show');ov.setAttribute('aria-hidden','true')}
    $('ssmp-solo').onclick=()=>{const f=action.solo;close();safe(()=>f&&f())};$('ssmp-multi').onclick=()=>{const f=action.multi;close();safe(()=>f&&f())};$('ssmp-cancel').onclick=close;ov.addEventListener('click',e=>{if(e.target===ov)close()});window.__ssOpenMode=open;
  }

  function captureGameModeClicks(){
    document.addEventListener('click',function(e){const b=e.target.closest('button');if(!b)return;const txt=(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase(),page=b.closest('.page');if(!page)return;
      if(page.id==='pg-memoryrush'&&(txt.includes('solo')||txt.includes('create room')||txt.includes('with a friend')||txt.includes('multiplayer'))){e.preventDefault();e.stopImmediatePropagation();window.__ssOpenMode('Memory Rush',window.startMemoryRushSolo,window.createMemoryRushRoom);return}
      if(page.id==='pg-mindsnap'&&(txt.includes('solo')||txt.includes('create duel')||txt.includes('friend')||txt.includes('multiplayer'))){e.preventDefault();e.stopImmediatePropagation();window.__ssOpenMode('Mind Snap Duel',window.startMindSolo,window.createMindRoom);return}
      if(page.id==='pg-cardflip'&&(txt.includes('solo')||txt.includes('create room')||txt.includes('friend')||txt.includes('multiplayer'))){e.preventDefault();e.stopImmediatePropagation();window.__ssOpenMode('Card Flip',()=>window.startFCGame?.('solo'),window.createFCRoom);return}
    },true);
  }

  function patchClocks(){
    const mr=window.mrStartCountdown;if(typeof mr==='function'&&!mr.__ssV12){window.mrStartCountdown=function(){if(window.mrSolo===false){clearInterval(window.mrTimer);$('mr-timer')&&($('mr-timer').textContent='∞');$('mr-progress-fill')&&($('mr-progress-fill').style.width='100%');return}return mr.apply(this,arguments)};window.mrStartCountdown.__ssV12=true}
    const ms=window.msStartPuzzleClock;if(typeof ms==='function'&&!ms.__ssV12){window.msStartPuzzleClock=function(){if(window.msSolo===false){clearInterval(window.msPuzzleTimer);$('ms-puzzle-time')&&($('ms-puzzle-time').textContent='∞');return}return ms.apply(this,arguments)};window.msStartPuzzleClock.__ssV12=true}
    const mm=window.msStartMatchClock;if(typeof mm==='function'&&!mm.__ssV12){window.msStartMatchClock=function(){if(window.msSolo===false){clearInterval(window.msMatchTimer);$('ms-match-time')&&($('ms-match-time').textContent='∞');return}return mm.apply(this,arguments)};window.msStartMatchClock.__ssV12=true}
    const qt=window.startQTimer;if(typeof qt==='function'&&!qt.__ssV12){window.startQTimer=function(){if(typeof quizRoomId!=='undefined'&&quizRoomId){clearInterval(window.qTimerInt);$('qtimer')&&($('qtimer').textContent='∞');return}return qt.apply(this,arguments)};window.startQTimer.__ssV12=true}
    const qtt=window.startQuizTotalTimer;if(typeof qtt==='function'&&!qtt.__ssV12){window.startQuizTotalTimer=function(){if(typeof quizRoomId!=='undefined'&&quizRoomId){clearInterval(window.SS_QUIZ_TOTAL_TIMER);$('q-total-timer')&&($('q-total-timer').textContent='∞');return}return qtt.apply(this,arguments)};window.startQuizTotalTimer.__ssV12=true}
  }

  function patchNotifications(){const old=window.toast;if(typeof old==='function'&&!old.__ssV12){window.toast=function(msg){const r=old.apply(this,arguments),t=$('toast');if(t){t.style.transition='none';t.style.display='block';t.style.opacity='1';clearTimeout(t.__ssV12Timer);t.__ssV12Timer=setTimeout(()=>{t.style.opacity='0';setTimeout(()=>{t.style.display=''},220)},3000)}return r};window.toast.__ssV12=true}}

  function installPullRefresh(){if(window.__ssPullRefresh)return;window.__ssPullRefresh=true;let sy=0,tracking=false;document.addEventListener('touchstart',e=>{if(window.scrollY<=2&&e.touches.length===1){sy=e.touches[0].clientY;tracking=true}},{passive:true});document.addEventListener('touchmove',e=>{if(!tracking)return;const dy=e.touches[0].clientY-sy;if(dy>90){tracking=false;document.querySelector('.page.active')?.animate?.([{transform:'translateY(0)'},{transform:'translateY(8px)'},{transform:'translateY(0)'}],{duration:220});setTimeout(()=>location.reload(),60)}},{passive:true});document.addEventListener('touchend',()=>{tracking=false},{passive:true})}

  function patchSocketStatus(){const old=window.ssSetSocketStatus;if(typeof old==='function'&&!old.__ssV12){window.ssSetSocketStatus=function(connected){if(connected||navigator.onLine)return old.call(this,true,'🟢 Online');return old.call(this,false,'🔴 Offline')};window.ssSetSocketStatus.__ssV12=true}addEventListener('online',()=>safe(()=>window.ssSetSocketStatus?.(true,'🟢 Online')));addEventListener('offline',()=>safe(()=>window.ssSetSocketStatus?.(false,'🔴 Offline')))}

  function patchRoomSearch(){const old=window.searchGameRoom;if(typeof old==='function'&&!old.__ssV12){window.searchGameRoom=async function(q){q=String(q||'').trim().toLowerCase();const res=$('home-game-result');if(!res)return;if(!q){res.style.display='none';return}res.style.display='block';res.innerHTML='<div style="font-size:12px;color:var(--muted)">🔍 Searching public rooms…</div>';try{const all=await window.dbGet('rooms');const matches=Object.values(all||{}).filter(r=>r&&r.isPublic&&((r.code||'').toLowerCase().includes(q)||(r.host||'').toLowerCase().includes(q)||(r.name||'').toLowerCase().includes(q))).slice(0,20);if(!matches.length){res.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px">No matching public room.</div>';return}const icons={ludo:'🎲',snake:'🐍',carrom:'🎯',bubble:'🫧',flipcard:'🃏',memoryrush:'🧠',mindsnap:'⚡',game:'🎮',music:'🎵'};res.innerHTML='';matches.forEach(r=>{const d=document.createElement('div');d.style.cssText='display:flex;align-items:center;gap:9px;padding:10px;border:1px solid var(--border);border-radius:12px;margin-bottom:7px;background:var(--card)';d.innerHTML=`<span style="font-size:24px">${icons[r.type]||'🎮'}</span><div style="flex:1;min-width:0"><div style="font-weight:800;font-size:12px">${window.esc?.(r.name||r.type||'Game Room')||r.name||r.type}</div><div style="font-size:10px;color:var(--muted)">Host: ${window.esc?.(r.host||'?')||r.host||'?'} • Code: ${r.code}</div></div><button class="btn bp sm">Join</button>`;d.querySelector('button').onclick=()=>window.joinGameRoom(r.code,r.type||'game');res.appendChild(d)})}catch(e){res.innerHTML='<div style="font-size:12px;color:#ef4444">❌ Room search failed.</div>'}};window.searchGameRoom.__ssV12=true}}

  function installPublicRoomSearch(){const host=$('pub-grooms');if(!host||$('ss-public-room-search-v12'))return;const wrap=document.createElement('div');wrap.id='ss-public-room-search-v12';wrap.style.cssText='display:flex;gap:8px;margin:8px 0 10px';wrap.innerHTML='<input id="ss-public-room-search-v12-input" class="inp" type="search" placeholder="🔎 Search room / host / code…" aria-label="Search public game rooms" style="flex:1;min-width:0;font-size:16px!important">';host.parentNode.insertBefore(wrap,host);const input=wrap.firstElementChild;input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();host.querySelectorAll('.pubroom').forEach(r=>r.style.display=!q||r.textContent.toLowerCase().includes(q)?'flex':'none')})}

  function patchRoomMemberUX(){
    const origMR=window.mrRoomUsers;if(typeof origMR==='function'&&!origMR.__ssV12){window.mrRoomUsers=function(us){const box=$('mr-players');if(!box)return;const arr=Object.values(us||{});box.innerHTML=arr.map((u,i)=>`<div class="ssrr-user" data-uid="${u.uid}"><div class="ssrr-avatar">${u.photo?`<img src="${u.photo}" alt="">`:(u.name||'?')[0].toUpperCase()}</div><div style="flex:1"><div style="font-weight:800;font-size:12px">${window.esc?.(u.name||'Player')||u.name||'Player'}</div><div style="font-size:10px;opacity:.65">${i===0?'HOST':'PLAYER'}</div></div>${window.mrHost&&u.uid!==window.U?.uid?'<button data-ss-kick style="border:0;background:#ef4444;color:#fff;border-radius:10px;padding:7px 9px;font-weight:800">✕</button>':''}</div>`).join('')||'<div style="font-size:11px;opacity:.6;text-align:center">Waiting…</div>';const st=$('mr-start-btn');if(st)st.style.display=window.mrHost&&arr.length>=2?'block':'none';const opp=arr.find(u=>u.uid!==window.U?.uid);if($('mr-p2-name'))$('mr-p2-name').textContent=opp?.name||'Opponent';box.querySelectorAll('[data-ss-kick]').forEach(k=>k.onclick=()=>safe(()=>window.SS_SOCKET?.emit('room:kick',{roomId:window.mrRoomId,targetUid:k.closest('[data-uid]').dataset.uid})))};window.mrRoomUsers.__ssV12=true}
    const origMS=window.msRoomUsers;if(typeof origMS==='function'&&!origMS.__ssV12){window.msRoomUsers=function(us){const box=$('ms-players');if(!box)return;const arr=Object.values(us||{});box.innerHTML=arr.map((u,i)=>`<div class="ssrr-user" data-uid="${u.uid}"><div class="ssrr-avatar">${u.photo?`<img src="${u.photo}" alt="">`:(u.name||'?')[0].toUpperCase()}</div><div style="flex:1"><div style="font-weight:800;font-size:12px">${window.esc?.(u.name||'Player')||u.name||'Player'}</div><div style="font-size:10px;opacity:.65">${i===0?'HOST':'PLAYER'}</div></div>${window.msHost&&u.uid!==window.U?.uid?'<button data-ss-kick style="border:0;background:#ef4444;color:#fff;border-radius:10px;padding:7px 9px;font-weight:800">✕</button>':''}</div>`).join('')||'<div style="font-size:11px;opacity:.6">Waiting for player…</div>';const st=$('ms-start-btn');if(st)st.style.display=window.msHost&&arr.length>=2?'block':'none';const opp=arr.find(u=>u.uid!==window.U?.uid);if($('ms-opp-name'))$('ms-opp-name').textContent=opp?.name||'Opponent';box.querySelectorAll('[data-ss-kick]').forEach(k=>k.onclick=()=>safe(()=>window.SS_SOCKET?.emit('room:kick',{roomId:window.msRoomId,targetUid:k.closest('[data-uid]').dataset.uid})))};window.msRoomUsers.__ssV12=true}
    function addRequestButton(containerId,roomVar,game){const c=$(containerId);if(!c||$(containerId+'-ssreq'))return;const b=document.createElement('button');b.id=containerId+'-ssreq';b.className='btn bh sm';b.textContent='📨 Request START';b.style.width='100%';b.style.marginTop='8px';b.onclick=()=>safe(()=>window.SS_SOCKET?.emit('game:request-start',{roomId:window[roomVar],game,uid:window.U?.uid,name:window.U?.name}));c.appendChild(b)}
    addRequestButton('mr-room-box','mrRoomId','memoryrush');addRequestButton('ms-room-box','msRoomId','mindsnap');
  }

  function installSocketRoomEvents(){
    const old=window.ssInitSocket;if(typeof old!=='function'||old.__ssV12)return;
    window.ssInitSocket=function(){
      const r=old.apply(this,arguments);
      setTimeout(function(){
        const sock=window.SS_SOCKET;if(!sock||sock.__ssRoomV12)return;sock.__ssRoomV12=true;
        sock.on('game:request-start',function(p){if(p?.roomId!==window.mrRoomId&&p?.roomId!==window.msRoomId)return;const ok=confirm((p.name||'Player')+' wants to start the game. Accept?');if(ok)sock.emit('game:start',{roomId:p.roomId,game:p.game})});
        sock.on('room:kicked',function(p){if(!p?.roomId)return;window.toast?.('You were removed from the room.');if(p.roomId===window.mrRoomId){window.mrRoomId=null;window.mrSolo=false}if(p.roomId===window.msRoomId){window.msRoomId=null;window.msSolo=false}window.goPage?.('game')});
        sock.on('game:started',function(p){if(p?.roomId===window.msRoomId)window.msStarted=true});
        sock.on('connect',function(){safe(function(){sock.emit('presence:register',{uid:window.U?.uid,name:window.U?.name,photo:window.U?.photo||null,email:window.U?.email||null})})});
      },120);return r;
    };window.ssInitSocket.__ssV12=true;
  }

  function fixFindOpponent(){
    const old=window.findOpponent;if(typeof old!=='function'||old.__ssV12)return;
    window.findOpponent=function(){if(window.mmSearching)return;window.mmSearching=true;if($('mm-find-btn'))$('mm-find-btn').style.display='none';if($('mm-cancel-btn'))$('mm-cancel-btn').style.display='block';if($('mm-status'))$('mm-status').style.display='block';if($('mm-status-text'))$('mm-status-text').textContent='Searching for '+window.mmType+' opponent…';const s=window.SS_SOCKET;if(s&&s.connected){window.__ssMMHandlers();s.emit('matchmaking:join',{game:window.mmType,uid:window.U?.uid,name:window.U?.name,photo:window.U?.photo||null})}else old.apply(this,arguments)};window.findOpponent.__ssV12=true;
    window.__ssMMHandlers=function(){const s=window.SS_SOCKET;if(!s||s.__ssMMV12)return;s.__ssMMV12=true;s.on('matchmaking:queued',p=>{if($('mm-status-text'))$('mm-status-text').textContent='Waiting for another '+(p.game||window.mmType)+' player…'});s.on('matchmaking:matched',p=>{window.mmSearching=false;clearInterval(window.mmTimer);if($('mm-status-text'))$('mm-status-text').textContent='🎉 Opponent found: '+(p.opponent?.name||'Player');window.toast?.('🎉 Opponent found!');if(p.game==='math'||p.game==='color'){window.quizRoomId=p.roomId;window.quizIsHost=p.hostUid===window.U?.uid;window.quizMode='multi';window.quizPendingType=p.game==='color'?'color':'math';window.quizPendingOp='mix';if(window.showQuizWaiting)window.showQuizWaiting(p.hostUid===window.U?.uid,p.roomId);else if(window.joinQuizRoom){const i=$('qjoinp');if(i)i.value=p.roomId;window.joinQuizRoom()}}})};
  }

  function patchSocialNotifications(){
    if(window.__ssSocialV12)return;window.__ssSocialV12=true;let last='';
    setInterval(function(){safe(async function(){if(!window.U?.uid||typeof window.dbGet!=='function')return;const me=await window.dbGet('users/'+window.U.uid);if(!me)return;const notes=Object.entries(me.notifications||{}).reverse();const fresh=notes.find(function(pair){const n=pair[1];return n&&n.read===false&&Number(n.time||0)>Date.now()-10000&&pair[0]!==last});if(!fresh)return;const key=fresh[0],n=fresh[1];last=key;window.toast?.(n.type==='like'?'❤️ Someone liked your profile':n.type==='follow'?'👥 Someone followed you':n.type==='request'?'🤝 Friend request received':'🔔 New activity');window.dbUpdate?.('users/'+window.U.uid+'/notifications/'+key,{...n,read:true})})},3000);
  }

  function boot(){removePhoneAuth();mobileCSS();installModePicker();captureGameModeClicks();patchClocks();patchNotifications();installPullRefresh();patchSocketStatus();patchRoomSearch();installPublicRoomSearch();patchRoomMemberUX();installSocketRoomEvents();fixFindOpponent();patchSocialNotifications();setTimeout(()=>{removePhoneAuth();patchClocks();patchNotifications();patchRoomSearch();installPublicRoomSearch();patchRoomMemberUX()},800);setInterval(()=>safe(()=>{patchClocks();patchNotifications();patchSocketStatus();installPublicRoomSearch();patchRoomMemberUX()}),1500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* ===== V13 INTEGRATION HOTFIXES =====
   Additive fixes only: the existing Firebase auth/game implementations stay in place.
*/
(function(){
  'use strict';
  const q=s=>document.querySelector(s), el=id=>document.getElementById(id);
  const safe=fn=>{try{return fn()}catch(e){console.warn('[SonicSync v13]',e)}};
  const toast=m=>safe(()=>window.toast?.(m));

  window.ssStartMpTimer=function(){
    try{clearInterval(window.SS_MP_TIMER?.timer);clearInterval(window.V4?.timer)}catch(e){}
    const t=el('ss-mp-timer'); if(t){t.textContent='∞';t.classList.remove('warn');t.classList.remove('show');}
    return null;
  };
  window.ssStopMpTimer=function(){
    try{clearInterval(window.SS_MP_TIMER?.timer);clearInterval(window.V4?.timer)}catch(e){}
    const t=el('ss-mp-timer');if(t)t.classList.remove('show','warn');
  };

  window.ssRadarCancel=function(){
    window.__SS_RADAR_ABORT=true;
    try{window.ssRadarClose?.()}finally{window.__SS_RADAR_ABORT=false;}
  };
  window.__ssPatchRadarCleanup=function(){
    if(window.__ssRadarCleanupV13)return;
    window.__ssRadarCleanupV13=true;
    const close=window.ssRadarClose;
    if(typeof close==='function'){
      window.ssRadarClose=function(){
        const abort=!!window.__SS_RADAR_ABORT;
        if(!abort){
          try{const code=window.SS_RADAR?.code;if(code&&typeof window.dbOff==='function'){window.dbOff('rooms/'+code+'/startRequests');}}catch(e){}
        }
        return close.apply(this,arguments);
      };
    }
    const cancel=el('ss-radar-close');
    if(cancel)cancel.setAttribute('onclick','ssRadarCancel()');
  };

  function markPublicRoom(code,meta){
    if(!code||typeof window.dbUpdate!=='function')return;
    const u=window.U||{};
    const data={code:String(code).toUpperCase(),name:String(meta?.name||((meta?.game||window.SS_RADAR?.kind||'Game')+' Room')).slice(0,80),host:String(u.name||'Player').slice(0,60),hostUid:String(u.uid||''),type:String(meta?.type||meta?.game||window.SS_RADAR?.kind||'game'),isPublic:true,updated:Date.now(),created:Number(meta?.created||Date.now())};
    window.dbUpdate('rooms/'+data.code,data);
  }
  function enhanceRadar(){
    const card=q('#ss-radar-overlay .ss-radar-card');if(!card||el('ss-radar-room-name'))return;
    const wrap=document.createElement('div');wrap.id='ss-radar-room-name-wrap';wrap.style.cssText='margin:8px 0 10px';wrap.innerHTML='<input id="ss-radar-room-name" class="inp" maxlength="60" placeholder="Room name (optional)" aria-label="Room name" style="width:100%;font-size:16px!important">';
    const codeBox=card.querySelector('.ss-radar-codebox');if(codeBox)codeBox.parentNode.insertBefore(wrap,codeBox);
    const input=el('ss-radar-room-name');input?.addEventListener('change',()=>{const code=String(window.SS_RADAR?.code||'').toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code))return;const name=input.value.trim()||((window.SS_RADAR?.kind||'Game')+' Room');markPublicRoom(code,{name,type:window.SS_RADAR?.kind,game:window.SS_RADAR?.kind});safe(()=>window.SS_SOCKET?.emit('room:meta',{roomId:code,name,isPublic:true}));});
  }
  function wrapRadarOpen(){
    const old=window.ssRadarOpen;if(typeof old!=='function'||old.__ssV13)return;
    window.ssRadarOpen=function(opts){const r=old.apply(this,arguments);enhanceRadar();const input=el('ss-radar-room-name');if(input){input.value=String(opts?.roomName||opts?.title||((opts?.kind||'Game')+' Room')).replace(/\s*•.*$/,'').trim().slice(0,60);input.style.display=opts?.host?'block':'none';}setTimeout(()=>{const code=String(window.SS_RADAR?.code||'').toUpperCase();if(opts?.host&&/^[A-Z0-9]{6}$/.test(code))markPublicRoom(code,{name:input?.value,type:opts?.kind,game:opts?.kind});},180);return r};window.ssRadarOpen.__ssV13=true;
  }
  function patchGameHub(){const game=el('pg-game');if(!game||game.__ssV13Hub)return;game.__ssV13Hub=true;game.querySelectorAll('button').forEach(btn=>{const t=(btn.textContent||'').toLowerCase();if(!t.includes('math battle')&&!t.includes('color quiz')&&!t.includes('card flip')&&!t.includes('memory rush')&&!t.includes('mind snap duel'))return;btn.style.minWidth='0';btn.style.minHeight='52px';});}
  function patchRadarUsers(){const box=el('ss-radar-users');if(!box||box.__ssV13)return;box.__ssV13=true;const observer=new MutationObserver(()=>safe(()=>{box.querySelectorAll('.ss-radar-user').forEach(node=>{const name=node.textContent?.trim()||'Player';node.style.minHeight='44px';node.style.cursor='pointer';if(!node.querySelector('[data-v13-kick]')&&window.SS_RADAR?.host){const user=Object.values(window.SS_RADAR.users||{}).find(u=>String(u.name||'')===name);if(user&&user.uid!==window.U?.uid){const b=document.createElement('button');b.dataset.v13Kick='1';b.textContent='✕';b.style.cssText='margin-left:auto;border:0;border-radius:9px;background:#ef4444;color:#fff;padding:6px 9px;font-weight:900;min-height:36px';b.onclick=e=>{e.stopPropagation();safe(()=>window.SS_SOCKET?.emit('room:kick',{roomId:window.SS_RADAR.code,targetUid:user.uid}));safe(()=>window.dbRemove?.('rooms/'+window.SS_RADAR.code+'/users/'+user.uid));};node.appendChild(b);}}});}));observer.observe(box,{childList:true,subtree:true});}
  function patchFollowRequests(){const old=window.toggleProfileFollow;if(typeof old!=='function'||old.__ssV13)return;window.toggleProfileFollow=async function(uid){if(!window.U||uid===window.U.uid)return;const target=await(typeof window.dbGet==='function'?window.dbGet('publicProfiles/'+uid):Promise.resolve(null)).catch(()=>null);if(!target)return;const already=!!(target.followers&&target.followers[window.U.uid]);if(already)return old.apply(this,arguments);const req={uid:window.U.uid,name:window.U.name,photo:window.U.photo||null,time:Date.now(),status:'pending'};safe(()=>window.dbUpdate?.('users/'+uid+'/followRequests/'+window.U.uid,req));safe(()=>window.dbPush?.('users/'+uid+'/notifications',{type:'followRequest',from:{uid:window.U.uid,name:window.U.name,photo:window.U.photo||null},time:req.time,read:false,status:'pending'}));toast('👥 Follow request sent');};window.toggleProfileFollow.__ssV13=true;window.respondFollowRequest=function(fromUid,accept){if(!window.U?.uid)return;const me=window.U.uid;safe(()=>window.dbUpdate?.('users/'+me+'/followRequests/'+fromUid,{status:accept?'accepted':'rejected',respondedAt:Date.now()}));if(accept){safe(()=>window.dbUpdate?.('users/'+me+'/followers/'+fromUid,{uid:fromUid,time:Date.now()}));safe(()=>window.dbUpdate?.('users/'+fromUid+'/following/'+me,{uid:me,name:window.U.name,photo:window.U.photo||null,time:Date.now()}));safe(()=>window.dbUpdate?.('publicProfiles/'+me+'/followers/'+fromUid,{uid:fromUid,time:Date.now()}));safe(()=>window.dbUpdate?.('users/'+fromUid+'/notifications',{['followAccepted_'+me]:{type:'followAccepted',from:{uid:me,name:window.U.name,photo:window.U.photo||null},time:Date.now(),read:false}}));toast('✅ Follow request accepted');}else toast('❌ Follow request rejected');safe(()=>window.renderMySocial?.());};}
  function patchSocialRenderer(){const old=window.renderMySocial;if(typeof old!=='function'||old.__ssV13)return;window.renderMySocial=async function(){const r=old.apply(this,arguments);setTimeout(()=>safe(async()=>{if(!window.U?.uid||typeof window.dbGet!=='function')return;const me=await window.dbGet('users/'+window.U.uid);const list=el('my-social-list');if(!me||!list)return;const reqs=Object.values(me.followRequests||{}).filter(x=>x&&x.status==='pending');if(!reqs.length)return;const frag=document.createDocumentFragment();reqs.forEach(x=>{const d=document.createElement('div');d.className='social-row';d.innerHTML=`<div class="social-mini-avatar">${String(x.name||'?')[0].toUpperCase()}</div><div class="sr-main"><div class="sr-name">${window.esc?window.esc(x.name||'User'):x.name||'User'}</div><div class="sr-time">👥 Follow request</div></div><button class="btn bi sm" onclick="respondFollowRequest('${String(x.uid).replace(/'/g,'')}',true)">✓</button><button class="btn bh sm" onclick="respondFollowRequest('${String(x.uid).replace(/'/g,'')}',false)">✕</button>`;frag.appendChild(d);});list.prepend(frag);}),250);return r;};window.renderMySocial.__ssV13=true;}
  function patchNotificationPoll(){if(window.__ssNotifV13)return;window.__ssNotifV13=true;const style=document.createElement('style');style.textContent='#game-req-popup,#request-popup,.game-request-popup{animation:ssNotif3s .2s ease}@keyframes ssNotif3s{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}';document.head.appendChild(style);}
  function patchSocketReconnect(){const sock=window.SS_SOCKET;if(!sock||sock.__ssV13Reconnect)return;sock.__ssV13Reconnect=true;const register=()=>safe(()=>sock.emit('presence:register',{uid:window.U?.uid,name:window.U?.name,photo:window.U?.photo||null,email:window.U?.email||null}));sock.on('connect',register);sock.on('reconnect',register);sock.on('disconnect',()=>safe(()=>window.ssSetSocketStatus?.(navigator.onLine,'Online')));addEventListener('online',()=>{try{if(!sock.connected)sock.connect()}catch(e){}safe(()=>window.ssSetSocketStatus?.(true,'🟢 Online'))});}
  function patchQuizAndCardSocketBridge(){const sock=window.SS_SOCKET;if(!sock||sock.__ssV13GameBridge)return;sock.__ssV13GameBridge=true;const emitRoom=(event,code)=>safe(()=>{if(code&&window.U)sock.emit(event,{roomId:code,type:window.SS_RADAR?.kind||'game',user:{uid:window.U.uid,name:window.U.name,photo:window.U.photo||null},name:(window.SS_RADAR?.kind||'Game')+' Room',isPublic:true});});const oldCFCreate=window.createFCRoom;if(typeof oldCFCreate==='function'&&!oldCFCreate.__ssV13){window.createFCRoom=function(){const r=oldCFCreate.apply(this,arguments);const code=window.fcRoomId;if(code)emitRoom('room:create',code);return r};window.createFCRoom.__ssV13=true;}const oldCFJoin=window.joinFCRoom;if(typeof oldCFJoin==='function'&&!oldCFJoin.__ssV13){window.joinFCRoom=function(){const r=oldCFJoin.apply(this,arguments);const code=String(window.fcRoomId||'').toUpperCase();if(code)emitRoom('room:join',code);return r};window.joinFCRoom.__ssV13=true;}const oldCFStart=window.hostStartFC;if(typeof oldCFStart==='function'&&!oldCFStart.__ssV13){window.hostStartFC=function(){const code=window.fcRoomId;if(code)safe(()=>sock.emit('game:start',{roomId:code,game:'flipcard'}));return oldCFStart.apply(this,arguments)};window.hostStartFC.__ssV13=true;}const oldQCreate=window.createHostedQuizRoom;if(typeof oldQCreate==='function'&&!oldQCreate.__ssV13){window.createHostedQuizRoom=function(type,op){const r=oldQCreate.apply(this,arguments);const code=window.quizRoomId;if(code)emitRoom('room:create',code);return r};window.createHostedQuizRoom.__ssV13=true;}const oldQJoin=window.joinQuizRoom;if(typeof oldQJoin==='function'&&!oldQJoin.__ssV13){window.joinQuizRoom=function(){const r=oldQJoin.apply(this,arguments);const code=String(window.quizRoomId||'').toUpperCase();if(code)emitRoom('room:join',code);return r};window.joinQuizRoom.__ssV13=true;}const oldQStart=window.hostStartQuiz;if(typeof oldQStart==='function'&&!oldQStart.__ssV13){window.hostStartQuiz=function(){const code=window.quizRoomId;if(code)safe(()=>sock.emit('game:start',{roomId:code,game:'quiz'}));return oldQStart.apply(this,arguments)};window.hostStartQuiz.__ssV13=true;}sock.on('room:host-changed',p=>{if(!p?.roomId)return;if(p.roomId===window.quizRoomId)window.quizIsHost=p.hostUid===window.U?.uid;if(p.roomId===window.fcRoomId)window.fcIsHost=p.hostUid===window.U?.uid;});sock.on('game:started',p=>{if(!p?.roomId||p.hostUid===window.U?.uid)return;if(p.game==='quiz'&&window.quizRoomId===p.roomId)toast('🚀 Host started the quiz');if(p.game==='flipcard'&&window.fcRoomId===p.roomId)toast('🚀 Host started Card Flip');});}
  function patchGenericFindOpponent(){const s=window.SS_SOCKET;if(!s||s.__ssV13GenericMM)return;s.__ssV13GenericMM=true;s.on('matchmaking:matched',p=>safe(()=>{if(!p?.roomId)return;const game=String(p.game||'').toLowerCase();if(['ludo','bubble','snake','carrom'].includes(game)){window.mmSearching=false;clearInterval(window.mmTimer);window.mmMatchedRoomId=p.roomId;window.mmMatchedGame=game;const title=game==='ludo'?'Ludo':game==='bubble'?'Bubble Battle':game==='snake'?'Snake & Ladder':'Carrom Pool';if(window.ssRadarOpen)window.ssRadarOpen({kind:game,icon:game==='ludo'?'🎲':game==='bubble'?'🫧':game==='snake'?'🐍':'🎯',title:title+' • MATCH FOUND',sub:'Opponent mil gaya. Room synced — game-specific multiplayer state ready.',code:p.roomId,host:p.hostUid===window.U?.uid,users:{},canClose:true});toast('🎉 '+title+' opponent found');}}));}
  function patchStartRadarFlows(){if(window.__ssRadarStartFlowV13)return;window.__ssRadarStartFlowV13=true;const wrap=name=>{const old=window[name];if(typeof old!=='function'||old.__ssV13Start)return;window[name]=function(){window.__SS_RADAR_STARTING=true;try{return old.apply(this,arguments)}finally{setTimeout(()=>{window.__SS_RADAR_STARTING=false},250)}};window[name].__ssV13Start=true;};['hostStartFC','hostStartMemoryRush','startMindMatch','hostStartQuiz'].forEach(wrap);}
  function patchRadarCloseFinal(){const old=window.ssRadarClose;if(typeof old!=='function'||old.__ssV13FinalClose)return;window.ssRadarClose=function(){const starting=!!window.__SS_RADAR_STARTING,r=window.SS_RADAR||{};try{clearInterval(r.timer);clearInterval(r.codePoll);}catch(e){}const o=el('ss-radar-overlay');if(o)o.classList.remove('show');const rq=el('ss-radar-request');if(rq){rq.style.display='none';rq.disabled=false;rq.textContent='🙋 REQUEST START';}if(starting)return;if(window.__SS_RADAR_ABORT){try{const code=String(r.code||'').toUpperCase();if(code&&window.dbRemove&&r.host)window.dbRemove('rooms/'+code);}catch(e){}}const fn=r.closeFn;r.closeFn=null;if(typeof fn==='function')safe(()=>fn());else safe(()=>window.goPage?.(r.kind==='music'?'room':'game'));};window.ssRadarClose.__ssV13FinalClose=true;}
  function bootV13(){enhanceRadar();wrapRadarOpen();patchRadarUsers();patchGameHub();patchFollowRequests();patchSocialRenderer();patchNotificationPoll();patchSocketReconnect();patchQuizAndCardSocketBridge();patchGenericFindOpponent();patchStartRadarFlows();patchRadarCloseFinal();window.__ssPatchRadarCleanup?.();window.ssStartMpTimer=()=>null;if(el('ss-radar-close'))el('ss-radar-close').setAttribute('onclick','ssRadarCancel()');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bootV13,0),{once:true});else setTimeout(bootV13,0);
  setTimeout(bootV13,1200);
})();
