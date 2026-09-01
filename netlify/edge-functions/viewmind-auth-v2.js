// SonicSync auth-page compatibility edge.
// IMPORTANT: Firebase authentication is intentionally preserved.
// This edge function removes ONLY the phone/OTP login UI. Google, Guest,
// Email/Password, Firebase Auth and Realtime Database are left untouched.
export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();

  // Remove only the phone-login controls/sections from the delivered page.
  // Do not remove config.js or any Firebase SDK script.
  html = html
    .replace(/<div[^>]*id=["']phone-section["'][^>]*>[\s\S]*?<\/div>\s*/gi, '')
    .replace(/<div[^>]*id=["']otp-section["'][^>]*>[\s\S]*?<\/div>\s*/gi, '')
    .replace(/<button[^>]*id=["']mode-toggle["'][^>]*>[\s\S]*?<\/button>\s*/gi, '')
    .replace(/<button[^>]*onclick=["']toggleFirebasePhoneMode\(\)["'][^>]*>[\s\S]*?<\/button>\s*/gi, '');

  // Remove the phone/reCAPTCHA sections if the HTML contains nested divs that
  // make a simple non-greedy replacement unsafe. This is intentionally scoped
  // to known authentication IDs/classes and does not touch the rest of the app.
  html = html
    .replace(/<div[^>]*id=["']recaptcha-container["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<input[^>]*id=["']phone["'][^>]*>/gi, '')
    .replace(/<input[^>]*id=["']otp["'][^>]*>/gi, '')
    .replace(/<button[^>]*onclick=["']sendFirebaseOTP\(\)["'][^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<button[^>]*onclick=["']verifyFirebaseOTP\(\)["'][^>]*>[\s\S]*?<\/button>/gi, '');

  const patch = `
<script id="sonicsync-phone-login-disabled-v1">
(function(){
  'use strict';
  function removePhoneOnly(){
    document.getElementById('phone-section')?.remove();
    document.getElementById('otp-section')?.remove();
    document.getElementById('recaptcha-container')?.remove();
    document.getElementById('mode-toggle')?.remove();
    document.querySelectorAll('button').forEach(function(b){
      var t=(b.textContent||'').trim();
      if(/Mobile Number Login|Login with Phone|Send OTP|Verify & Sync|Change number/i.test(t)) b.remove();
    });
  }
  removePhoneOnly();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',removePhoneOnly,{once:true});
  setTimeout(removePhoneOnly,250);
  setTimeout(removePhoneOnly,1000);
  setTimeout(removePhoneOnly,2500);
})();
</script>`;

  if(!html.includes('id="sonicsync-phone-login-disabled-v1"')){
    html = html.includes('</body>') ? html.replace('</body>', patch + '</body>') : html + patch;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {status: response.status, statusText: response.statusText, headers});
};
