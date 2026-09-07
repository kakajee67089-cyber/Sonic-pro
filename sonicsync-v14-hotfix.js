/* SonicSync Pro v14 — consolidated compatibility/reliability hotfix.
   Additive: preserves the existing UI, Firebase identity system and game code.
*/
(function(){'use strict';
  if(window.__SS_V14_HOTFIX_V2__)return; window.__SS_V14_HOTFIX_V2__=true;
  const $=id=>document.getElementById(id), safe=fn=>{try{return fn()}catch(e){console.warn('[SonicSync v14]',e)}};

  function removePhoneAuthUI(){
    ['phone-section','otp-section','mode-toggle','recaptcha-container'].forEach(id=>$(id)?.remove());
    document.querySelectorAll('#auth-screen button,[onclick]').forEach(el=>{
      const t=(el.textContent||'').toLowerCase(), oc=(el.getAttribute('onclick')||'').toLowerCase();
      if(/mobile number login|send otp|verify mobile|change number/.test(t)||/sendfirebaseotp|verifyfirebaseotp|togglefirebasephonemode|phone-section|otp-section/.test(oc)) el.remove();
    });
  }

  function mobileAuth(){
    if($('ss-v14-mobile-css'))return;
    const s=document.createElement('style');s.id='ss-v14-mobile-css';s.textContent=`
      html,body{overflow-x:hidden!important;max-width:100%!important}
      #app,.pages,.page,.game-overlay,.ss-radar-overlay{max-width:100vw!important;overflow-x:hidden!important}
      @media(max-width:720px){
        #auth-screen{padding:12px!important;align-items:flex-start!important;overflow:auto!important}
        .auth-ultra-wrapper{width:100%!important;max-width:430px!important;padding:18px 8px 24px!important}
        .auth-card-ultra{width:100%!important;box-sizing:border-box!important;padding:22px 16px!important;border-radius:28px!important}
        #auth-screen input{font-size:16px!important;min-height:48px!important;box-sizing:border-box!important}
        #auth-screen button{min-height:48px!important;touch-action:manipulation}
        #pg-game>div:last-of-type{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        #pg-game button{min-width:0!important;max-width:100%!important}
        .ss-radar-card{width:min(430px,calc(100vw - 24px))!important;max-width:calc(100vw - 24px)!important}
        .ss-radar-users,.ss-radar-card{overflow-x:hidden!important}
      }
    `;document.head.appendChild(s);
  }

  function fixMemoryRushJoin(){
    const orig=window.joinMemoryRushRoom;
    if(typeof orig!=='function'||orig.__ssV14Fix)return;
    const wrapped=function(){const r=orig.apply(this,arguments);safe(()=>window.mrInstallSocketHandlers?.());return r};
    wrapped.__ssV14Fix=true;window.joinMemoryRushRoom=wrapped;
  }

  function addToastDismiss(){
    const t=$('toast');if(!t||t.dataset.ssDismiss)return;t.dataset.ssDismiss='1';t.style.position='fixed';t.style.paddingRight='36px';
    const b=document.createElement('button');b.type='button';b.textContent='×';b.setAttribute('aria-label','Dismiss notification');b.style.cssText='position:absolute;right:7px;top:4px;border:0;background:transparent;color:inherit;font-size:18px;font-weight:900;cursor:pointer;padding:3px 7px';b.onclick=e=>{e.stopPropagation();t.classList.remove('show');t.style.opacity='0'};t.appendChild(b);
  }

  function patchRoomSearch(){
    const orig=window.searchGameRoom;if(typeof orig!=='function'||orig.__ssV14Fix)return;
    window.searchGameRoom=async function(q){
      q=String(q||'').trim().toLowerCase();const out=$('home-game-result');if(!out)return;
      if(!q){out.style.display='none';return} out.style.display='block';out.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px">🔎 Searching public rooms…</div>';
      try{
        const all=await (window.dbGet?window.dbGet('rooms'):Promise.resolve(null));
        const vals=Object.values(all||{}).filter(r=>r&&r.isPublic!==false);
        const rows=vals.filter(r=>[r.name,r.host,r.code,r.roomName].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,30);
        if(!rows.length){out.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px">No matching public room.</div>';return}
        out.innerHTML='';const icons={ludo:'🎲',bubble:'🫧',carrom:'🎯',snake:'🐍',flipcard:'🃏',memoryrush:'🧠',mindsnap:'⚡',music:'🎵',game:'🎮'};
        rows.forEach(r=>{const d=document.createElement('div');d.style.cssText='display:flex;align-items:center;gap:9px;padding:10px;border:1px solid var(--border);border-radius:12px;margin-bottom:7px;background:var(--card)';
          const safeName=window.esc?window.esc(r.name||r.roomName||r.type||'Game Room'):String(r.name||r.roomName||r.type||'Game Room');
          const safeHost=window.esc?window.esc(r.host||'?'):String(r.host||'?');d.innerHTML=`<span style="font-size:24px">${icons[r.type]||'🎮'}</span><div style="flex:1;min-width:0"><div style="font-weight:800;font-size:12px">${safeName}</div><div style="font-size:10px;color:var(--muted)">Host: ${safeHost} • Code: ${String(r.code||'')}</div></div><button class="btn bp sm" type="button">Join</button>`;
          d.querySelector('button').onclick=()=>safe(()=>window.joinGameRoom?.(r.code,r.type||'game'));out.appendChild(d);
        });
      }catch(e){out.innerHTML='<div style="font-size:12px;color:#ef4444;padding:8px">❌ Room search failed.</div>'}
    };window.searchGameRoom.__ssV14Fix=true;
  }

  function roomRequestAndKick(){
    const wire=(fnName,boxId,roomVar,hostVar)=>{const orig=window[fnName];if(typeof orig!=='function'||orig.__ssV14Room)return;window[fnName]=function(us){const r=orig.apply(this,arguments);safe(()=>{
      const box=$(boxId),room=window[roomVar];if(!box||!room)return;const host=!!window[hostVar];const users=Object.values(us||{});if(host){box.querySelectorAll('[data-v14-kick]').forEach(x=>x.remove());users.forEach(u=>{if(!u.uid||u.uid===window.U?.uid)return;const row=box.querySelector(`[data-uid="${CSS.escape(String(u.uid))}"]`);if(row&&!row.querySelector('[data-v14-kick]')){const b=document.createElement('button');b.type='button';b.dataset.v14Kick='1';b.textContent='✕';b.setAttribute('aria-label','Remove player');b.style.cssText='margin-left:auto;border:0;border-radius:9px;background:#ef4444;color:#fff;padding:7px 10px;font-weight:900';b.onclick=e=>{e.stopPropagation();safe(()=>window.SS_SOCKET?.emit('room:kick',{roomId:room,targetUid:u.uid}));safe(()=>window.dbRemove?.('rooms/'+room+'/users/'+u.uid));};row.appendChild(b)}})}});return r};window[fnName].__ssV14Room=true};
    wire('mrRoomUsers','mr-players','mrRoomId','mrHost');wire('msRoomUsers','ms-players','msRoomId','msHost');
  }

  function requestStartUI(){
    const add=(boxId,roomVar,game)=>{const c=$(boxId);if(!c||c.querySelector('[data-v14-request]'))return;const b=document.createElement('button');b.type='button';b.dataset.v14Request='1';b.className='btn bh sm';b.textContent='📨 REQUEST START';b.style.cssText='width:100%;margin-top:8px;min-height:44px';b.onclick=()=>safe(()=>window.SS_SOCKET?.emit('game:request-start',{roomId:window[roomVar],game,uid:window.U?.uid,name:window.U?.name}));c.appendChild(b)};
    add('mr-room-box','mrRoomId','memoryrush');add('ms-room-box','msRoomId','mindsnap');
  }

  function socketEvents(){
    const s=window.SS_SOCKET;if(!s||s.__ssV14Events)return;s.__ssV14Events=true;
    s.on('game:request-start',p=>{if(!p?.roomId)return;const own=p.roomId===window.mrRoomId||p.roomId===window.msRoomId||p.roomId===window.quizRoomId||p.roomId===window.fcRoomId;if(!own)return;window.toast?.('📨 '+(p.name||'Player')+' requested START.');
      const btns=['mr-start-btn','ms-start-btn','quiz-host-start','fc-start-btn','fc-host-start'].map($).filter(Boolean);btns.forEach(b=>{if(window.mrHost||window.msHost||window.quizIsHost||window.fcIsHost)b.style.display='flex'});
    });
    s.on('room:kicked',p=>{if(!p?.roomId)return;window.toast?.('🚫 You were removed from the room.');['mrRoomId','msRoomId','quizRoomId','fcRoomId'].forEach(k=>{if(String(window[k]||'')===String(p.roomId))window[k]=null});});
    s.on('game:started',p=>{if(!p?.roomId)return;window.toast?.('🚀 Host started the game');safe(()=>{if(p.roomId===window.mrRoomId)window.mrInstallSocketHandlers?.();if(p.roomId===window.msRoomId)window.msInstallHandlers?.()});});
  }

  function robustSocketStatus(){
    const update=()=>{const online=navigator.onLine!==false;safe(()=>window.ssSetSocketStatus?.(online,online?'🟢 Online':'🔴 Offline'));};
    addEventListener('online',update);addEventListener('offline',update);setTimeout(update,500);
  }

  function pullRefresh(){if(window.__SS_V14_PULL)return;window.__SS_V14_PULL=true;let y=0,armed=false;document.addEventListener('touchstart',e=>{if(window.scrollY<=2&&e.touches.length===1){y=e.touches[0].clientY;armed=true}},{passive:true});document.addEventListener('touchmove',e=>{if(!armed)return;if(e.touches[0].clientY-y>95){armed=false;const active=document.querySelector('.page.active');if(active)active.scrollTop=0;location.reload()}},{passive:true});document.addEventListener('touchend',()=>armed=false,{passive:true})}

  function boot(){removePhoneAuthUI();mobileAuth();fixMemoryRushJoin();addToastDismiss();patchRoomSearch();roomRequestAndKick();requestStartUI();socketEvents();robustSocketStatus();pullRefresh();setTimeout(()=>{removePhoneAuthUI();fixMemoryRushJoin();addToastDismiss();requestStartUI()},800);setTimeout(()=>{removePhoneAuthUI();fixMemoryRushJoin();requestStartUI()},2000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
