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

/* Runtime compatibility hotfix for the existing index.html. */
(function(){
  'use strict';
  var booted=false, socketBound=null, startBound=false;

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
    s.on('connect_error',function(){window.SONICSYNC_SOCKET_CONNECTED=false;});
  }

  function ensureSocket(){
    bindSocket();
    // The existing client already has infinite Socket.IO reconnection.
    // Never create a second socket while the first one is reconnecting.
    if(window.SS_SOCKET) return;
    if(!window.U || !window.U.uid) return;
    if(typeof window.ssInitSocket==='function'){
      try{window.ssInitSocket();}catch(e){}
      bindSocket();
    }
  }

  function bindStartControl(){
    if(startBound) return;
    var el=document.getElementById('quiz-host-start');
    if(!el) return;
    startBound=true;
    if(el.tagName==='BUTTON' || el.tagName==='INPUT') el.setAttribute('type','button');
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
  }

  function boot(){
    if(booted) return;
    booted=true;
    setInterval(function(){
      bindStartControl();
      bindSocket();
      ensureSocket();
    },500);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
