// SonicSync auth-page compatibility edge.
// Firebase authentication is intentionally preserved. Phone/OTP UI only is removed.
export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();

  // Remove only the phone-login controls/sections from the delivered page.
  html = html
    .replace(/<div[^>]*id=["']phone-section["'][^>]*>[\s\S]*?<\/div>\s*/gi, '')
    .replace(/<div[^>]*id=["']otp-section["'][^>]*>[\s\S]*?<\/div>\s*/gi, '')
    .replace(/<button[^>]*id=["']mode-toggle["'][^>]*>[\s\S]*?<\/button>\s*/gi, '')
    .replace(/<button[^>]*onclick=["']toggleFirebasePhoneMode\(\)["'][^>]*>[\s\S]*?<\/button>\s*/gi, '')
    .replace(/<div[^>]*id=["']recaptcha-container["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<input[^>]*id=["']phone["'][^>]*>/gi, '')
    .replace(/<input[^>]*id=["']otp["'][^>]*>/gi, '')
    .replace(/<button[^>]*onclick=["']sendFirebaseOTP\(\)["'][^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<button[^>]*onclick=["']verifyFirebaseOTP\(\)["'][^>]*>[\s\S]*?<\/button>/gi, '');

  // Consolidate the main UI font system without changing the visual brand fonts.
  html = html.replace(/font-family:\s*["']?Rajdhani["']?,\s*sans-serif/gi, "font-family:'Plus Jakarta Sans',sans-serif");
  html = html.replace(/font-family:\s*["']?Space Grotesk["']?,\s*sans-serif/gi, "font-family:'Plus Jakarta Sans',sans-serif");

  const patch = `
<style id="sonicsync-usability-v1">
:root{--ss-r1:8px;--ss-r2:12px;--ss-r3:16px;--ss-r4:20px;--ss-pill:999px;--ss-ui:'Plus Jakarta Sans',sans-serif;--ss-display:'Orbitron',sans-serif}
html,body{font-family:var(--ss-ui)!important}
body{font-size:14px!important}
h1{font-family:var(--ss-display)!important;font-size:24px!important;line-height:1.2!important}
h2{font-family:var(--ss-display)!important;font-size:20px!important;line-height:1.25!important}
h3{font-family:var(--ss-ui)!important;font-size:17px!important;line-height:1.3!important}
p,li{font-size:14px!important;line-height:1.5!important}
small,.lbl,.nl{font-size:12px!important;line-height:1.35!important}
input,select,textarea{font-family:var(--ss-ui)!important;font-size:16px!important}
button,.btn,.qopt,.cfbtn,.mr-action,.mr-start,.ss-radar-search button,.ss-radar-uid-actions button{font-family:var(--ss-ui)!important;font-size:14px!important;line-height:1.2!important;border-radius:var(--ss-r2)!important}
.btn{padding:11px 16px!important;min-height:44px!important;box-shadow:0 5px 0 rgba(0,0,0,.14)!important}
.qopt,.cfbtn{min-height:44px!important;border-radius:var(--ss-r2)!important}
.card,.pubroom,.vitem,.hitem,.astat,.mr-card,.mr-player-row,.profile-section,.profile-stat,.social-row{border-radius:var(--ss-r3)!important}
.inp,.sw input,.search-input,.auth-input-pro input{border-radius:var(--ss-r2)!important}
#toast,.uid-b,.chip,.sm{border-radius:var(--ss-pill)!important}
.ms-tile,.mr-cell,.mr-face,.mr-back,.mr-front{border-radius:var(--ss-r2)!important}
#pg-mindsnap .ms-hero p{font-size:12px!important;line-height:1.45!important}
.tbb,.profile-close{min-height:34px!important;border-radius:50%!important}
.nb{min-height:44px!important;border-radius:var(--ss-r2)!important}
.auth-btn-pro{min-height:52px!important;height:auto!important;border-radius:var(--ss-r2)!important;font-size:15px!important}
.auth-mini-link,.auth-link-pro{min-height:40px!important;border-radius:var(--ss-r2)!important;font-size:13px!important}
#auth-screen{padding:12px 10px!important;align-items:flex-start!important}
#auth-screen .auth-wrapper-pro{width:min(100%,430px)!important;padding-top:48px!important;margin:0 auto!important}
#auth-screen .auth-card-ultra{width:100%!important;max-width:430px!important;padding:52px 16px 18px!important;border-radius:var(--ss-r4)!important}
#auth-screen .auth-brand-pro{font-size:27px!important}
#auth-screen .auth-tag-pro{font-size:12px!important;letter-spacing:1.4px!important}
#auth-screen .auth-input-pro input{height:52px!important;font-size:16px!important}
#pg-game button,#pg-quiz button,#pg-cardflip button,#pg-memoryrush button,#pg-mindsnap button,#pg-game .btn,#pg-quiz .qopt,#pg-quiz .cq-opt,#pg-memoryrush .mr-cell,#pg-mindsnap .ms-tile{pointer-events:auto!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent}
#pg-memoryrush .mr-grid,#pg-mindsnap .ms-grid{position:relative;z-index:2;pointer-events:auto!important}
.page .hero-logo{pointer-events:none}
@media(max-width:480px){#auth-screen .auth-card-ultra{padding:50px 15px 16px!important}.qopts{gap:8px!important}}
</style>
<script id="sonicsync-usability-runtime-v1">
(function(){
  function demoteExtraH1(){
    var hs=document.querySelectorAll('h1');
    hs.forEach(function(h,i){
      if(i===0||h.dataset.ssH1Fixed)return;
      var h2=document.createElement('h2');
      Array.from(h.attributes).forEach(function(a){h2.setAttribute(a.name,a.value)});
      h2.innerHTML=h.innerHTML;h2.dataset.ssH1Fixed='1';h.replaceWith(h2);
    });
  }
  function fix(){demoteExtraH1();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fix,{once:true});else fix();
  new MutationObserver(fix).observe(document.documentElement,{subtree:true,childList:true});
})();
</script>`;

  if (!html.includes('id="sonicsync-usability-v1"')) {
    html = html.includes('</head>') ? html.replace('</head>', patch + '</head>') : html + patch;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {status: response.status, statusText: response.statusText, headers});
};
