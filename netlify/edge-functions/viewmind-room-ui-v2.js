export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;
  let html = await response.text();
  if (html.includes('viewmind-room-ui-v2')) return response;

  const injection = `
<style id="viewmind-room-ui-v2">
#viewmind-room-ui-v2-overlay{position:fixed;inset:0;z-index:2147483640;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(4,7,18,.72);backdrop-filter:blur(10px)}
#viewmind-room-ui-v2-overlay.show{display:flex}
.vmr2-card{width:min(430px,100%);padding:22px;border-radius:24px;background:#10162d;color:#fff;border:1px solid rgba(139,92,246,.4);box-shadow:0 24px 80px rgba(0,0,0,.5);font-family:system-ui,sans-serif}
.vmr2-card h3{margin:0 0 8px;font-size:20px}.vmr2-card p{margin:0 0 16px;color:#b9c1d8;font-size:13px}.vmr2-start{width:100%;padding:13px;border:0;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800}.vmr2-wait{display:none;color:#8be9ff;font-weight:700;text-align:center;padding:12px}.vmr2-close{float:right;background:none;border:0;color:#9aa4c0;font-size:20px}
</style>
<script id="viewmind-room-ui-v2">
(function(){
'use strict';
window.ViewMindRoomUI={version:'2.1',hostStartRequired:true,persistentRadar:true,tenSecondAutoClose:false};
function init(){
  var overlay=document.getElementById('viewmind-room-ui-v2-overlay');
  if(!overlay){overlay=document.createElement('div');overlay.id='viewmind-room-ui-v2-overlay';overlay.innerHTML='<div class="vmr2-card"><button class="vmr2-close" type="button">×</button><h3>Room ready</h3><p>Players who join this room remain visible until the host starts the session.</p><button class="vmr2-start" type="button">START</button><div class="vmr2-wait">Waiting for the host to start…</div></div>';document.body.appendChild(overlay);}
  var start=overlay.querySelector('.vmr2-start'), wait=overlay.querySelector('.vmr2-wait'), close=overlay.querySelector('.vmr2-close');
  close.onclick=function(){overlay.classList.remove('show');};
  window.ViewMindRoomUI.showHostStart=function(){start.style.display='block';wait.style.display='none';overlay.classList.add('show');};
  window.ViewMindRoomUI.showWaiting=function(){start.style.display='none';wait.style.display='block';overlay.classList.add('show');};
  window.ViewMindRoomUI.hide=function(){overlay.classList.remove('show');};
  // Do not install a 10-second timeout. Existing application Socket.IO handlers remain authoritative.
  start.onclick=function(){
    if(window.io && window.ViewMindRoomSocket){window.ViewMindRoomSocket.emit('room:start');}
    window.ViewMindRoomUI.hide();
  };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
</script>`;
  html=html.includes('</body>')?html.replace('</body>',injection+'</body>'):html+injection;
  const headers=new Headers(response.headers);headers.delete('content-length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
};
