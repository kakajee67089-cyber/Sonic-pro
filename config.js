// Your web app's Firebase configuration
// Google, Guest/Anonymous and Email/Password authentication remain enabled.
const firebaseConfig = {
  apiKey: "AIzaSyC4yFUw23s1Wb9ignSPzRdGeSaThNLTiXY",
  authDomain: "sonic-singh.firebaseapp.com",
  databaseURL: "https://sonic-singh-default-rtdb.firebaseio.com",
  projectId: "sonic-singh",
  storageBucket: "sonic-singh.firebasestorage.app",
  messagingSenderId: "668422254722",
  appId: "1:668422254722:web:31394b6c816e6122eb449b",
  measurementId: "G-8NMB6HYKWY"
};

window.SONICSYNC_FIREBASE_CONFIG = firebaseConfig;
// Keep the frontend Socket.IO endpoint aligned with the live Sonic-pro Render service.
window.SONICSYNC_SOCKET_URL = window.SONICSYNC_SOCKET_URL || 'https://sonic-pro-qfa9.onrender.com';

/*
 * SonicSync realtime/UI compatibility hotfix.
 *
 * The current index.html already contains the Firebase room/quiz implementation.
 * This small layer fixes two runtime problems without replacing that large file:
 *  1) keep retrying the existing Socket.IO initializer and expose a reliable
 *     connected flag for the existing UI;
 *  2) make the multiplayer QUIZ START control a real action instead of allowing
 *     a surrounding form/button default action to navigate back to Home.
 *
 * Existing functions remain the source of truth; this file only coordinates them.
 */
(function(){
  'use strict';
  var booted=false, socketBound=null, startBound=false, retryTimer=null;

  function bindSocket(){
    var s=window.SS_SOCKET;
    if(!s || socketBound===s) return;
    socketBound=s;
    window.SONICSYNC_SOCKET_CONNECTED=!!s.connected;
    s.on('connect',function(){
      window.SONICSYNC_SOCKET_CONNECTED=true;
      window.dispatchEvent(new CustomEvent('sonicsync:socket-ready'));
    });
    s.on('disconnect',function(){
      window.SONICSYNC_SOCKET_CONNECTED=false;
      window.dispatchEvent(new CustomEvent('sonicsync:socket-lost'));
    });
    s.on('connect_error',function(){
      window.SONICSYNC_SOCKET_CONNECTED=false;
    });
  }

  function ensureSocket(){
    bindSocket();
    if(window.SS_SOCKET && window.SS_SOCKET.connected) return;
    if(!window.U || !window.U.uid) return;
    if(typeof window.ssInitSocket==='function'){
      try{ window.ssInitSocket(); }catch(e){}
      bindSocket();
    }
  }

  function bindStartControl(){
    if(startBound) return;
    var el=document.getElementById('quiz-host-start');
    if(!el) return;
    startBound=true;
    el.addEventListener('click',function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      ensureSocket();
      setTimeout(function(){
        if(typeof window.hostStartQuiz==='function'){
          try{window.hostStartQuiz();}catch(e){console.error('Quiz start failed',e);}
        }
      },0);
    },true);
    if(el.tagName==='BUTTON' || el.tagName==='INPUT') el.setAttribute('type','button');
  }

  function boot(){
    if(booted) return;
    booted=true;
    var tick=function(){
      bindStartControl();
      bindSocket();
      ensureSocket();
      if(document.getElementById('quiz-host-start')) startBound=true;
      retryTimer=setTimeout(tick,500);
    };
    tick();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
