// ViewMind v2.2 room/radar/request bridge.
// Uses the app's authenticated Socket.IO connection first; never creates a second
// unauthenticated socket when the main app connection is available.
export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  let html = await response.text();
  const patch = `<style id="viewmind-v22-style">
#vm22-room{position:fixed;right:12px;bottom:76px;z-index:2147483000;width:min(370px,calc(100vw - 24px));max-height:58vh;overflow:auto;font:500 14px/1.35 system-ui,sans-serif;background:rgba(12,16,28,.97);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:14px;box-shadow:0 18px 55px rgba(0,0,0,.35);backdrop-filter:blur(16px)}
#vm22-room[hidden]{display:none}#vm22-room .vm22-row{display:flex;gap:8px;align-items:center;margin:7px 0}#vm22-room input{flex:1;min-width:0;background:#fff;color:#111;border:0;border-radius:10px;padding:10px;font-size:16px}#vm22-room button{border:0;border-radius:10px;padding:10px 12px;font-weight:800;cursor:pointer;min-height:44px}#vm22-start{width:100%;margin-top:8px;background:#22c55e;color:#062b14}#vm22-status{opacity:.82;font-size:12px}.vm22-user{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}.vm22-badge{font-size:11px;opacity:.7}
</style>
<script id="viewmind-v22-room">
(function(){'use strict';
function boot(){
 if(window.__VIEWMIND_V22_BOOTED)return;window.__VIEWMIND_V22_BOOTED=true;
 var panel=document.createElement('section');panel.id='vm22-room';panel.hidden=true;panel.innerHTML='<div><strong>ViewMind Room Radar</strong> <span class="vm22-badge">v2.2</span></div><div id="vm22-status">Connecting…</div><div class="vm22-row"><input id="vm22-code" maxlength="6" placeholder="Team code" inputmode="text"><button id="vm22-join">Join</button></div><div class="vm22-row"><input id="vm22-search" placeholder="UID / email" inputmode="email"><button id="vm22-request">Request</button></div><div id="vm22-users"></div><button id="vm22-start" hidden>START</button>';
 document.body.appendChild(panel);
 var status=panel.querySelector('#vm22-status'),usersEl=panel.querySelector('#vm22-users'),start=panel.querySelector('#vm22-start');
 function getSocket(){var s=window.SS_SOCKET||window.socket||window.sonicSocket||window.roomSocket;return s&&s.connected?s:null}
 function me(){var u=window.U||window.currentUser||window.user||{};return {uid:String(u.uid||u.id||''),name:String(u.name||u.displayName||'Guest'),photo:u.photoURL||u.photo||null,email:String(u.email||'')}}
 function show(){panel.hidden=false}
 function renderUsers(data,hostUid){usersEl.innerHTML='';var entries=Object.entries(data||{});entries.forEach(function(x){var el=document.createElement('div');el.className='vm22-user';var safeName=String(x[1]?.name||x[0]).replace(/[<>]/g,'');el.innerHTML='<span>'+safeName+'</span><span class="vm22-badge">'+(x[0]===me().uid?'YOU':x[0]===hostUid?'HOST':'CONNECTED')+'</span>';usersEl.appendChild(el)});start.hidden=!(hostUid&&hostUid===me().uid&&entries.length>=2)}
 function wire(s){if(!s||s.__vm22wired)return;s.__vm22wired=true;s.on('room:state',function(st){window.__VM22_HOST_UID=st.hostUid;window.__VM22_ROOM_ID=st.roomId;show();status.textContent='Connected • '+Object.keys(st.users||{}).length+' player(s)';renderUsers(st.users,st.hostUid)});s.on('room:users',function(u){show();status.textContent='Radar • '+Object.keys(u||{}).length+' connected';renderUsers(u,window.__VM22_HOST_UID)});s.on('room:error',function(e){show();status.textContent=e?.message||'Room error'});s.on('game:request',function(r){show();status.textContent='Game request from '+(r.from?.name||'Player')});s.on('game:request-start',function(r){show();status.textContent=(r.name||'Player')+' requested START';start.hidden=false});s.on('game:request:response',function(r){show();status.textContent=r.status==='accepted'?'Request accepted':'Request '+(r.status||'updated')});s.on('room:kicked',function(){status.textContent='You were removed from the room';panel.hidden=true});s.on('connect',function(){status.textContent='Socket connected'});s.on('disconnect',function(){status.textContent=navigator.onLine?'Reconnecting…':'Internet offline'})}
 var s=getSocket();if(s)wire(s);else status.textContent='Socket connection not ready';
 panel.querySelector('#vm22-join').onclick=function(){var s=getSocket(),u=me(),code=panel.querySelector('#vm22-code').value.trim().toUpperCase();if(!s){status.textContent='Socket connection unavailable';return}if(!/^[A-Z0-9]{6}$/.test(code)){status.textContent='Enter a valid 6-character team code';return}if(!u.uid){status.textContent='Please login first';return}wire(s);s.emit('room:join',{roomId:code,user:u,type:'music'});show()};
 panel.querySelector('#vm22-start').onclick=function(){var s=getSocket(),u=me(),code=window.__VM22_ROOM_ID||panel.querySelector('#vm22-code').value.trim().toUpperCase();if(!s||!u.uid||!code)return;if(window.__VM22_HOST_UID!==u.uid){status.textContent='Only the host can START';return}s.emit('game:start',{roomId:code,game:'music'});status.textContent='Room started'};
 panel.querySelector('#vm22-request').onclick=function(){var s=getSocket(),target=panel.querySelector('#vm22-search').value.trim(),u=me();if(!s||!u.uid||!target){status.textContent='Login and enter a UID/email';return}wire(s);s.emit('game:request',{requestId:'req-'+Date.now(),from:u,toUid:target,game:'music',time:Date.now()});status.textContent='Request sent'};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
</script>`;
  if(!html.includes('id="viewmind-v22-room"'))html=html.includes('</body>')?html.replace('</body>',patch+'</body>'):html+patch;
  const headers=new Headers(response.headers);headers.delete('content-length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
};
