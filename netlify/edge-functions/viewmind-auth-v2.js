// SonicSync local authentication bridge.
// Firebase/Google/phone authentication is intentionally removed from the web UI.
// Guest and email/password accounts are stored locally in the browser.
export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();

  // Remove the Firebase client/config scripts from the delivered page so the
  // old Firebase bootstrap cannot produce auth initialization/API-key errors.
  html = html
    .replace(/<script[^>]+src=["']config\.js["'][^>]*><\/script>/gi, '')
    .replace(/<script[^>]+src=["'][^"']*firebase[^"']*["'][^>]*><\/script>/gi, '');

  // Remove authentication methods that require an external identity provider.
  html = html
    .replace(/<button[^>]*onclick=["']firebaseGoogleLogin\(\)["'][\s\S]*?<\/button>/gi, '')
    .replace(/<button[^>]*id=["']mode-toggle["'][\s\S]*?<\/button>/gi, '')
    .replace(/<div class=["']auth-secure-note["'][^>]*>[\s\S]*?<\/div>/gi,
      '<div class="auth-secure-note">🔐 Local account session • Guest mode • Email/password</div>');

  const patch = `
<script id="sonicsync-local-auth-v1">
(function(){
  'use strict';
  const ACCOUNT_KEY='sonicsync_local_accounts_v1';
  const SESSION_KEY='sonicsync_local_session_v1';
  const AUTH_VERSION='local-v1';

  const $=id=>document.getElementById(id);
  const read=(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch(e){return f;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}};
  const normalizeEmail=e=>String(e||'').trim().toLowerCase();
  const safeName=n=>String(n||'User').trim().slice(0,60)||'User';
  const uid=prefix=>prefix+'_'+crypto.randomUUID().replace(/-/g,'').slice(0,20);

  async function hash(text){
    const bytes=new TextEncoder().encode(text);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function error(msg){
    const e=$('auth-err');
    if(e){e.textContent=msg||'';e.style.display=msg?'block':'none';e.style.background='rgba(239,68,68,.16)';e.style.color='#fecaca';}
  }
  function busy(on,msg){
    const e=$('auth-loading');
    if(e){e.style.display=on?'flex':'none';if(msg)e.querySelector('.auth-loading-text')?.replaceChildren(document.createTextNode(msg));}
    document.querySelectorAll('.auth-btn-pro').forEach(b=>b.disabled=!!on);
  }
  function accounts(){return read(ACCOUNT_KEY,{});}
  function saveAccounts(a){write(ACCOUNT_KEY,a);}
  function localProfile(data){
    const base=(typeof window.seedLocalUserShape==='function')?window.seedLocalUserShape(data):Object.assign({coins:0,inventory:[],vipExpiry:{},rooms:0,songs:0,games:0,matches:0,wins:0,losses:0,loginStreak:0,likeCount:0,followersCount:0,followingCount:0,notifications:{},requests:{},friends:{},followers:{},following:{},likesBy:{},joinedAt:Date.now(),lastActive:Date.now()},data);
    return base;
  }
  function setSession(profile){
    window.U=profile;
    write(SESSION_KEY,{uid:profile.uid,email:profile.email,name:profile.name,guest:profile.email==='guest@sonicsync.app',version:AUTH_VERSION});
    try{if(window.users){window.users[profile.email]=profile;window.LS?.s?.('users',window.users);}}catch(e){}
  }
  function persistProfile(){
    try{if(window.U?.email==='guest@sonicsync.app')return;const a=accounts();if(window.U?.email)a[normalizeEmail(window.U.email)]={...(a[normalizeEmail(window.U.email)]||{}),profile:window.U};saveAccounts(a);}catch(e){}
  }
  // Replace the Firebase-dependent saveUser with local persistence.
  window.saveUser=function(){if(window.U){window.U.lastActive=Date.now();persistProfile();try{if(window.users){window.users[window.U.email]=window.U;window.LS?.s?.('users',window.users);}}catch(e){}}};
  window.hydrateUserFromFirebase=async function(){};
  window.initFirebaseAuth=function(){};
  window.FIREBASE_AUTH=null;
  window.DB_REF=null;

  function finish(profile){
    setSession(profile);
    error('');
    try{window.updateProfUI?.();window.lockAdminUI?.();}catch(e){}
    if(typeof window.enterApp==='function')window.enterApp();
    try{window.toast?.('Welcome '+profile.name+'! 🎵');}catch(e){}
  }

  async function emailLogin(){
    error('');
    const email=normalizeEmail($('ae')?.value), password=$('ap')?.value||'';
    if(!email||!password){error('Email aur password dono bharo.');return;}
    if(password.length<6){error('Password kam se kam 6 characters ka rakho.');return;}
    busy(true,'Signing in…');
    try{
      const a=accounts(), rec=a[email];
      if(!rec){
        error('Account nahi mila. “Create a new account” se account banao.');
        return;
      }
      const ok=(await hash(rec.salt+':'+password))===rec.passwordHash;
      if(!ok){error('Email ya password galat hai.');return;}
      const profile=localProfile({...rec.profile,email,name:rec.name,uid:rec.uid,authUid:'local:'+rec.uid,isAdmin:false,lastActive:Date.now()});
      finish(profile);
    }catch(e){console.error(e);error('Login failed. Dobara try karo.');}
    finally{busy(false);}
  }

  async function register(){
    error('');
    const name=safeName($('reg-name')?.value), email=normalizeEmail($('reg-email')?.value), password=$('reg-password')?.value||'';
    if(!name||!email||!password){error('Naam, email aur password bharo.');return;}
    if(password.length<6){error('Password kam se kam 6 characters ka rakho.');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){error('Valid email address bharo.');return;}
    busy(true,'Creating account…');
    try{
      const a=accounts();
      if(a[email]){error('Ye email already registered hai. Sign in karo.');return;}
      const salt=uid('salt');
      const id=uid('u');
      const profile=localProfile({email,name,uid:id,authUid:'local:'+id,isAdmin:false,photo:null,lastActive:Date.now()});
      a[email]={email,name,uid:id,salt,passwordHash:await hash(salt+':'+password),profile};
      saveAccounts(a);finish(profile);
    }catch(e){console.error(e);error('Account create nahi ho paya.');}
    finally{busy(false);}
  }

  function guestLogin(){
    error('');busy(true,'Starting guest session…');
    try{
      const id=uid('g');
      const profile=localProfile({email:'guest@sonicsync.app',name:'Guest_'+id.slice(-4),uid:id,authUid:'local:'+id,isAdmin:false,photo:null,lastActive:Date.now()});
      finish(profile);
    }finally{busy(false);}
  }

  window.firebaseEmailLogin=emailLogin;
  window.firebaseRegister=register;
  window.firebaseGuestLogin=guestLogin;
  window.firebaseGoogleLogin=function(){error('Google login hata diya gaya hai. Email ya Guest login use karo.');};
  window.toggleFirebasePhoneMode=function(){error('Phone login hata diya gaya hai. Email ya Guest login use karo.');};
  window.sendPasswordReset=function(){error('Password recovery local account ke liye available nahi hai. Naya password set karne ke liye account dobara create karna hoga.');};

  window.doLogout=function(){
    try{window.cleanupRoomListeners?.();}catch(e){}
    try{window.lockAdminUI?.();}catch(e){}
    window.U=null;
    try{localStorage.removeItem(SESSION_KEY);}catch(e){}
    const app=$('app'),auth=$('auth-screen');if(app)app.style.display='none';if(auth)auth.style.display='flex';
    if($('ae'))$('ae').value='';if($('ap'))$('ap').value='';error('');
    try{window.showAuthSection?.('auth-main');}catch(e){}
  };

  // Prevent the original inline Firebase handlers from running.
  document.addEventListener('click',function(ev){
    const el=ev.target?.closest?.('button');if(!el)return;
    const text=(el.textContent||'').trim();
    if(/Mobile Number Login|Login with Phone|Continue with Google/i.test(text)){
      ev.preventDefault();ev.stopImmediatePropagation();el.style.display='none';return;
    }
  },true);

  function restore(){
    const s=read(SESSION_KEY,null);if(!s)return;
    if(s.guest){
      finish(localProfile({email:'guest@sonicsync.app',name:s.name||'Guest',uid:s.uid,authUid:'local:'+s.uid,isAdmin:false,lastActive:Date.now()}));
      return;
    }
    const a=accounts(),rec=a[normalizeEmail(s.email)];
    if(rec){finish(localProfile({...rec.profile,email:rec.email,name:rec.name,uid:rec.uid,authUid:'local:'+rec.uid,isAdmin:false,lastActive:Date.now()}));}
    else localStorage.removeItem(SESSION_KEY);
  }

  function cleanupUi(){
    document.querySelectorAll('button').forEach(b=>{
      const t=(b.textContent||'').trim();
      if(/Mobile Number Login|Login with Phone|Continue with Google/i.test(t))b.style.display='none';
    });
    const note=document.querySelector('.auth-secure-note');if(note)note.textContent='🔐 Local account session • Guest mode • Email/password';
    document.querySelectorAll('[id*=firebase],[class*=firebase]').forEach(n=>{if(n.id==='auth-err')return;if(/error|auth/i.test(n.textContent||''))n.style.display='none';});
  }

  function boot(){
    cleanupUi();
    setTimeout(cleanupUi,500);
    setTimeout(cleanupUi,1500);
    // Only restore a previous session when the user explicitly enabled Stay active.
    const stay=read('sonicsync_local_stay_v1',false);
    if(stay)restore();
  }

  const stayBox=$('stay-active');
  if(stayBox)stayBox.addEventListener('change',()=>write('sonicsync_local_stay_v1',!!stayBox.checked));
  document.addEventListener('DOMContentLoaded',boot,{once:true});
  if(document.readyState!=='loading')boot();
})();
</script>`;

  if(!html.includes('id="sonicsync-local-auth-v1"')){
    html=html.includes('</body>')?html.replace('</body>',patch+'</body>'):html+patch;
  }
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
};
