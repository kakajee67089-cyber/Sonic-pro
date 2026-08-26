export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  if (html.includes("viewmind-powered-popup")) return new Response(html, response);

  const injection = `
<style id="viewmind-powered-popup-style">
#viewmind-powered-popup{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(5,8,22,.66);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
#viewmind-powered-popup.show{display:flex}
#viewmind-powered-popup .vpp-card{position:relative;width:min(420px,100%);padding:30px 24px 24px;border:1px solid rgba(129,140,248,.45);border-radius:28px;background:linear-gradient(145deg,rgba(24,28,58,.98),rgba(10,14,34,.98));box-shadow:0 28px 100px rgba(0,0,0,.58);color:#fff;text-align:center;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:vppIn .32s cubic-bezier(.2,.8,.2,1)}
#viewmind-powered-popup .vpp-logo{width:64px;height:64px;margin:0 auto 14px;border-radius:20px;display:grid;place-items:center;background:linear-gradient(135deg,#6366f1,#ec4899);box-shadow:0 12px 35px rgba(99,102,241,.38);font-size:30px}
#viewmind-powered-popup h3{margin:0 0 7px;font-size:22px;font-weight:900;letter-spacing:.2px}
#viewmind-powered-popup p{margin:0;color:#b8bfd5;font-size:13px;line-height:1.55}
#viewmind-powered-popup .vpp-name{margin-top:9px;color:#8be9ff;font-weight:900;font-size:15px}
#viewmind-powered-popup .vpp-version{margin-top:7px;color:#c7d2fe;font-size:12px;font-weight:800;letter-spacing:.5px}
#viewmind-powered-popup .vpp-close{margin-top:20px;width:100%;border:0;border-radius:15px;padding:13px 18px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:900;cursor:pointer;box-shadow:0 5px 0 rgba(0,0,0,.22)}
#viewmind-powered-popup .vpp-close:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(0,0,0,.22)}
@keyframes vppIn{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
</style>
<div id="viewmind-powered-popup" aria-hidden="true">
  <div class="vpp-card" role="dialog" aria-modal="true" aria-labelledby="viewmind-powered-title">
    <div class="vpp-logo">✦</div>
    <h3 id="viewmind-powered-title">ViewMind</h3>
    <p>Website Powered by</p>
    <div class="vpp-name">Devanand Kumar</div>
    <div class="vpp-version">Version 2.1</div>
    <button class="vpp-close" type="button" aria-label="Close">Close</button>
  </div>
</div>
<script id="viewmind-powered-popup">
(function(){
  function init(){
    var overlay=document.getElementById('viewmind-powered-popup');
    if(!overlay)return;
    var close=overlay.querySelector('.vpp-close');
    var key='viewmind_powered_popup_seen_v2_1';
    function hide(){overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');}
    function show(){overlay.classList.add('show');overlay.setAttribute('aria-hidden','false');}
    close.addEventListener('click',hide);
    overlay.addEventListener('click',function(e){if(e.target===overlay)hide();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')hide();});
    try{if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');show();}}catch(_){show();}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
</script>`;

  const marker="</body>";
  const output=html.includes(marker)?html.replace(marker,injection+marker):html+injection;
  const headers=new Headers(response.headers);
  headers.delete("content-length");
  return new Response(output,{status:response.status,statusText:response.statusText,headers});
};
