(function(){'use strict';
  function q(s){return document.querySelector(s)}
  function byId(id){return document.getElementById(id)}
  function safe(fn){try{return fn()}catch(e){console.warn('[SonicSync final hotfix]',e)}}

  function repairMenu(){
    const ham=byId('ham'); if(!ham) return;
    const items=[
      ['🏠','Home',"goPage('home');closeHam();"],
      ['🎵','Music Room',"goPage('music-room');closeHam();"],
      ['📡','My Room',"goPage('room');closeHam();",'hm-room'],
      ['🎮','Games',"goPage('game');closeHam();"],
      ['🎯','Carrom Pool',"goPage('carrom');closeHam();"],
      ['🃏','Flip Card',"goPage('cardflip');closeHam();"],
      ['🎵','Music Quiz',"goPage('musicquiz');mqPlaylist=[];closeHam();"],
      ['🔢','Number Dash',"goPage('numberdash');closeHam();"],
      ['🔍','Find Opponent',"goPage('matchmaking');loadActivePlayers();closeHam();"],
      ['🏆','Leaderboard',"goPage('leaderboard');loadLeaderboard();closeHam();"],
      ['🗳️','Song Voting',"goPage('voting');loadVoting();closeHam();"],
      ['🕐','History',"goPage('history');renderHist();closeHam();"],
      ['👤','Profile',"goPage('profile');closeHam();"],
      ['👑','VIP Store',"goPage('vip-store');closeHam();"],
      ['🛡️','Admin',"goPage('admin');refreshAdmin();closeHam();",'hm-admin']
    ];
    if(ham.dataset.finalMenu==='1') return;
    ham.innerHTML=items.map(function(x){return '<div class="hi"'+(x[3]?(' id="'+x[3]+'" style="display:none;"'):'')+' onclick="'+x[2]+'"><span class="hico">'+x[0]+'</span><span>'+x[1]+'</span></div>'}).join('');
    ham.dataset.finalMenu='1';
  }

  function patchHub(){
    const game=byId('pg-game'); if(!game||game.dataset.finalHub==='1') return;
    game.querySelectorAll('button').forEach(function(btn){
      const t=(btn.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(t==='card flip') btn.setAttribute('onclick',"window.__ssOpenMode ? window.__ssOpenMode('Card Flip',()=>startFCGame('solo'),createFCRoom) : (goPage('cardflip'),showCFLobby())");
      else if(t==='memory rush') btn.setAttribute('onclick',"window.__ssOpenMode ? window.__ssOpenMode('Memory Rush',startMemoryRushSolo,createMemoryRushRoom) : (goPage('memoryrush'),initMRLobby())");
      else if(t==='mind snap duel') btn.setAttribute('onclick',"window.__ssOpenMode ? window.__ssOpenMode('Mind Snap Duel',startMindSolo,createMindRoom) : (goPage('mindsnap'),initMindSnap())");
    });
    game.dataset.finalHub='1';
  }

  function patchCardFlipPage(){
    const p=byId('pg-flipcard'); if(!p||p.dataset.finalMode==='1') return;
    p.querySelectorAll('button').forEach(function(btn){
      const t=(btn.textContent||'').toLowerCase();
      if(t.includes('solo') && typeof window.startFCGame==='function') btn.setAttribute('onclick',"startFCGame('solo')");
      if((t.includes('create room')||t.includes('multiplayer')) && typeof window.createFCRoom==='function') btn.setAttribute('onclick','createFCRoom()');
    });
    p.dataset.finalMode='1';
  }

  function patchMobile(){
    if(byId('ss-final-mobile-css')) return;
    const s=document.createElement('style');s.id='ss-final-mobile-css';s.textContent=`
      html,body{overflow-x:hidden!important;max-width:100%!important}
      #app{max-width:100vw!important;overflow-x:hidden!important}
      .pages{width:100%!important;max-width:100vw!important;overflow-x:hidden!important}
      .page{max-width:100vw!important;overflow-x:hidden!important}
      #pg-game>div:last-of-type{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      #pg-game button{min-width:0;max-width:100%}
      .game-overlay,.ss-radar-overlay{max-width:100vw!important;overflow-x:hidden!important}
      .ss-radar-card{width:min(430px,calc(100vw - 24px))!important;max-width:calc(100vw - 24px)!important}
      input,select,textarea{max-width:100%!important}
    `;document.head.appendChild(s);
  }

  function start(){
    repairMenu();patchMobile();patchHub();patchCardFlipPage();
    setTimeout(function(){repairMenu();patchHub();patchCardFlipPage()},500);
    setTimeout(function(){repairMenu();patchHub();patchCardFlipPage()},1500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();