// ViewMind Auth v2: Firebase Authentication bridge while preserving the existing
// Firebase Realtime Database and Socket.IO layers.
export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  let html = await response.text();
  const patch = `
<script id="viewmind-auth-v2-sdk">
(function(){
  'use strict';
  var config={apiKey:'AIzaSyAiSZULFtq9qci10W9oVEYnsxuv3JkiVDM',authDomain:'soni-c9410.firebaseapp.com',databaseURL:'https://soni-c9410-default-rtdb.firebaseio.com',projectId:'soni-c9410',storageBucket:'soni-c9410.firebasestorage.app',messagingSenderId:'933796139968',appId:'1:933796139968:web:90343e6f4752057ea06e25'};
  function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  function ready(){return !!(window.firebase&&firebase.apps&&firebase.apps.length&&firebase.auth&&firebase.database);}
  async function boot(){
    try{
      if(!window.firebase) await load('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
      if(!window.firebase.database) await load('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js');
      if(!window.firebase.auth) await load('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');
      if(!firebase.apps.length) firebase.initializeApp(config);
      var auth=firebase.auth(), db=firebase.database();
      window.ViewMindAuthV2={auth:auth,db:db,version:'2.0'};

      function localUsers(){try{return JSON.parse(localStorage.getItem('ss6_users')||'{}')||{};}catch(e){return {};}}
      function findLegacy(email){var all=localUsers(), key=String(email||'').toLowerCase();return Object.values(all).find(function(u){return String(u&&u.email||'').toLowerCase()===key)||null;}
      function setErr(msg){var e=document.getElementById('auth-err');if(e){e.textContent=msg;e.style.display='block';}}
      async function persistUser(fu,legacy){
        var ref=db.ref('users/'+fu.uid), snap=await ref.once('value'), old=snap.val()||{};
        var profile=Object.assign({},legacy||{},old,{uid:fu.uid,email:fu.email||old.email||legacy?.email||'',lastActive:Date.now()});
        if(!profile.name) profile.name=(fu.displayName||String(fu.email||'User').split('@')[0]);
        profile.authProvider='firebase';
        await ref.set(profile);
        try{localStorage.setItem('ss6_last_auth_uid',fu.uid);}catch(e){}
        window.U=profile;
        return profile;
      }
      async function login(email,password){
        email=String(email||'').trim().toLowerCase();
        if(!email||!password){setErr('ईमेल और पासवर्ड भरें');return false;}
        setErr('');
        var legacy=findLegacy(email), cred;
        try{
          // Existing legacy accounts must authenticate with their real password.
          // We never auto-create an account when a matching legacy email exists.
          if(legacy) cred=await auth.signInWithEmailAndPassword(email,password);
          else {
            try{cred=await auth.signInWithEmailAndPassword(email,password);}
            catch(e){if(e&&e.code==='auth/user-not-found')cred=await auth.createUserWithEmailAndPassword(email,password);else throw e;}
          }
          var profile=await persistUser(cred.user,legacy);
          if(typeof window.enterApp==='function') window.enterApp();
          if(typeof window.toast==='function') window.toast('✅ सुरक्षित Firebase login • UID: '+profile.uid);
          return true;
        }catch(e){
          var m=e&&e.code==='auth/wrong-password'?'❌ गलत पासवर्ड':e&&e.code==='auth/invalid-credential'?'❌ ईमेल या पासवर्ड गलत है':e&&e.code==='auth/email-already-in-use'?'❌ यह ईमेल पहले से registered है':e&&e.code==='auth/weak-password'?'❌ पासवर्ड बहुत कमजोर है':'❌ Login असफल हुआ';
          setErr(m);return false;
        }
      }
      window.viewMindFirebaseLogin=login;

      // Capture the existing Login/Register button before its old local handler runs.
      document.addEventListener('click',function(ev){
        var b=ev.target&&ev.target.closest&&ev.target.closest('.auth-main');
        if(!b)return;
        ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
        login(document.getElementById('ae')?.value,document.getElementById('ap')?.value);
      },true);

      var oldLogout=window.doLogout;
      window.doLogout=function(){
        try{auth.signOut();}catch(e){}
        try{localStorage.removeItem('ss6_last_auth_uid');}catch(e){}
        return oldLogout?oldLogout.apply(this,arguments):undefined;
      };

      // Restore a valid Firebase session on refresh/device reopen.
      auth.onAuthStateChanged(async function(fu){
        if(!fu)return;
        try{
          var legacy=findLegacy(fu.email||''), profile=await persistUser(fu,legacy);
          if(document.getElementById('auth-screen')?.style.display!=='none' && typeof window.enterApp==='function')window.enterApp();
          if(window.SS_SOCKET&&window.SS_SOCKET_CONNECTED)window.SS_SOCKET.emit('presence:register',{uid:profile.uid,name:profile.name,photo:profile.photo||null});
        }catch(e){console.warn('ViewMind Firebase session restore failed',e);}
      });
    }catch(e){console.error('ViewMind Auth v2 unavailable',e);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
</script>`;
  if(!html.includes('id="viewmind-auth-v2-sdk"'))html=html.includes('</body>')?html.replace('</body>',patch+'</body>'):html+patch;
  const headers=new Headers(response.headers);headers.delete('content-length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
};
