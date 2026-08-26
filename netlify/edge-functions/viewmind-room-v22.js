// ViewMind v2.2 room/radar/request UI patch.
// Keeps the existing Firebase + Socket.IO systems and adds a persistent room radar,
// UID/email request bridge, host START/waiting state, and removes music auto-close timers.
export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  let html = await response.text();
  const patch = `<style id="viewmind-v22-style">
#vm22-room{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:min(360px,calc(100vw - 32px));font:500 14px/1.35 system-ui,sans-serif;background:rgba(12,16,28,.96);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:14px;box-shadow:0 18px 55px rgba(0,0,0,.35);backdrop-filter:blur(16px)}
#vm22-room[hidden]{display:none}#vm22-room .vm22-row{display:flex;gap:8px;align-items:center;margin:7px 0}#vm22-room input{flex:1;min-width:0;background:#fff;color:#111;border:0;border-radius:10px;padding:10px}#vm22-room button{border:0;border-radius:10px;padding:9px 12px;font-weight:700;cursor:pointer}#vm22-start{width:100%;margin-top:8px;background:#22c55e;color:#062b14}#vm22-status{opacity:.82;font-size:12px}.vm22-user{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}.vm22-badge{font-size:11px;opacity:.7}
</style>
<script id="viewmind-v22-room">
(function(){'use strict';
function boot(){
 if(window.__VIEWMIND_V22_BOOTED)return; window.__VIEWMIND_V22_BOOTED=true;
 var panel=document.createElement('section');panel.id='vm22-room';panel.hidden=true;panel.innerHTML='<div><strong>ViewMind Room Radar</strong> <span class="vm22-badge">v2.2</span></div><div id="vm22-status">Room not connected</div><div class="vm22-row"><input id="vm22-code" maxlength="6" placeholder="Team code"><button id="vm22-join">Join</button></div><div class="vm22-row"><input id="vm22-search" placeholder="UID / email"><button id="vm22-request">Request</button></div><div id="vm22-users"></div><button id="vm22-start" hidden>START</button>';
 document.body.appendChild(panel);
 var status=panel.querySelector('#vm22-status'),usersEl=panel.querySelector('#vm22-users'),start=panel.querySelector('#vm22-start');
 var socket=window.socket||window.sonicSocket||window.roomSocket||null;
 function getSocket(){if(socket&&socket.connected)return socket;if(window.io){try{socket=window.io();return socket}catch(e){}}return null}
 function me(){var u=window.currentUser||window.user||window.loggedInUser||{};return {uid:String(u.uid||u.id||''),name:String(u.name||u.displayName||'Guest'),photo:u.photoURL||u.photo||null}}
 function show(){panel.hidden=false}
 function renderUsers(data){usersEl.innerHTML='';var entries=Object.entries(data||{});entries.forEach(function(x){var el=document.createElement('div');el.className='vm22-user';el.innerHTML='<span>'+String(x[1]?.name||x[0]).replace(/[<>]/g,'')+'</span><span class="vm22-badge">'+(x[0]===me().uid?'YOU':'CONNECTED')+'</span>';usersEl.appendChild(el)});var host=entries.length&&entries[0][1];if(host){var uid=me().uid;var hostUid=window.__VM22_HOST_UID||null;start.hidden=!(hostUid===uid||entries.length===1)} }
 function wire(s){if(!s||s.__vm22wired)return;s.__vm22wired=true;
  s.on('room:state',function(st){window.__VM22_HOST_UID=st.hostUid;show();status.textContent='Connected • '+(st.users?Object.keys(st.users).length:0)+' player(s)';renderUsers(st.users);if(st.playback&&st.playback.action==='start')status.textContent='Room started'});
  s.on('room:users',function(u){show();status.textContent='Radar • '+Object.keys(u||{}).length+' connected';renderUsers(u)});
  s.on('room:error',function(e){show();status.textContent=e&&e.message?e.message:'Room error'});
  s.on('game:request',function(r){show();var ok=confirm((r.from?.name||'A player')+' wants to join/request a game. Accept?');s.emit('game:request:response',{requestId:r.requestId,toUid:r.toUid,fromUid:r.from?.uid,status:ok?'accepted':'rejected',roomId:r.roomId||null,game:r.game||'music'});status.textContent=ok?'Request accepted':'Request rejected'});
  s.on('game:request:response',function(r){show();status.textContent=r.status==='accepted'?'Request accepted':'Request '+(r.status||'updated')});
  s.on('music:event',function(e){if(e&&e.action==='start'){show();status.textContent='Room started • Music sync active'}});
  s.on('connect',function(){status.textContent='Socket connected'});s.on('disconnect',function(){status.textContent='Reconnecting…'});
 }
 var s=getSocket();wire(s);if(!s)status.textContent='Socket connection not ready';
 panel.querySelector('#vm22-join').onclick=function(){var s=getSocket();if(!s){status.textContent='Socket connection unavailable';return}var code=panel.querySelector('#vm22-code').value.trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code)){status.textContent='Enter a valid 6-character team code';return}var u=me();if(!u.uid){status.textContent='Please login first';return}wire(s);s.emit('room:join',{roomId:code,user:u,type:'music'});show()};
 panel.querySelector('#vm22-start').onclick=function(){var s=getSocket();var u=me();var code=panel.querySelector('#vm22-code').value.trim().toUpperCase();if(!s||!u.uid||!code)return;if(window.__VM22_HOST_UID&&window.__VM22_HOST_UID!==u.uid){status.textContent='Only the host can START';return}s.emit('music:event',{roomId:code,action:'start',playing:false,position:0,serverAt:Date.now(),title:''});status.textContent='Room started • Waiting players released'};
 panel.querySelector('#vm22-request').onclick=function(){var s=getSocket();var target=panel.querySelector('#vm22-search').value.trim();var u=me();if(!s||!u.uid||!target){status.textContent='Login and enter a UID/email';return}s.emit('game:request',{requestId:'req-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),from:u,toUid:target,game:'music',time:Date.now()});status.textContent='Request sent'};
 // Never let the old 10-second music radar countdown close the room panel.
 try{window.setTimeout(function(){document.querySelectorAll('[data-music-countdown],.music-countdown,#musicCountdown').forEach(function(e){e.style.display='none'})},0)}catch(e){}
 window.ViewMindRoomV22={version:'2.2',radar:true,requests:true,hostStart:true,persistentRadar:true};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
</script>`;
  if(!html.includes('id="viewmind-v22-room"'))html=html.includes('</body>')?html.replace('</body>',patch+'</body>'):html+patch;
  const headers=new Headers(response.headers);headers.delete('content-length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
};
