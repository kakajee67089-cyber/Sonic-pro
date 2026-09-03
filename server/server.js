'use strict';

// SonicSync Pro realtime backend v13.
// Firebase Authentication remains the only identity source. No local auth is used.
const http=require('http');
const express=require('express');
const {Server}=require('socket.io');
const {jwtVerify,decodeProtectedHeader}=require('jose');
const {createPublicKey}=require('crypto');

const PORT=process.env.PORT||3000;
const PROJECT_ID=process.env.FIREBASE_PROJECT_ID||'sonic-singh';
const CERT_URL='https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache={expiresAt:0,keys:new Map()};
async function firebaseKey(kid){
  if(!kid)throw new Error('Missing Firebase key id');
  if(Date.now()>=certCache.expiresAt||!certCache.keys.has(kid)){
    const r=await fetch(CERT_URL);if(!r.ok)throw new Error('Firebase certificate fetch failed');
    const certs=await r.json(),keys=new Map();for(const [id,cert] of Object.entries(certs))keys.set(id,createPublicKey(cert));
    const cc=r.headers.get('cache-control')||'',m=cc.match(/max-age=(\d+)/i),ttl=m?Number(m[1])*1000:3600000;
    certCache={expiresAt:Date.now()+Math.max(60000,ttl-60000),keys};
  }
  const key=certCache.keys.get(kid);if(!key)throw new Error('Unknown Firebase key');return key;
}
async function verifyFirebaseToken(token){
  const t=String(token||'');if(!t)throw new Error('Firebase authentication required');
  const {kid}=decodeProtectedHeader(t);const key=await firebaseKey(kid);
  const {payload}=await jwtVerify(t,key,{issuer:`https://securetoken.google.com/${PROJECT_ID}`,audience:PROJECT_ID});
  if(payload.sub!==payload.user_id)throw new Error('Invalid Firebase subject');return payload;
}

const app=express();const server=http.createServer(app);
const allowed=String(process.env.CORS_ORIGIN||'*').split(',').map(x=>x.trim()).filter(Boolean);
const io=new Server(server,{cors:{origin:(origin,cb)=>(!origin||allowed.includes('*')||allowed.includes(origin))?cb(null,true):cb(new Error('CORS origin not allowed')),methods:['GET','POST']},transports:['websocket','polling'],pingInterval:10000,pingTimeout:10000,maxHttpBufferSize:2e6,connectionStateRecovery:{maxDisconnectionDuration:120000,skipMiddlewares:false}});
app.get('/',(_q,res)=>res.json({ok:true,service:'SonicSync Socket.IO',version:'v13',auth:'firebase',project:PROJECT_ID}));
app.get('/health',(_q,res)=>res.json({ok:true,service:'SonicSync Socket.IO',version:'v13',auth:'firebase',project:PROJECT_ID,now:Date.now()}));

const rooms=new Map();
const presence=new Map();
const presenceEmail=new Map();
const matchQueue=new Map();
const CODE_RE=/^[A-Z0-9]{6}$/;
const MR_SYMBOLS=['🔴','🔵','🟢','🟡','🟣','🟠','⭐','❤️','⚡','🎯','🌟','💎','🔥','🎵','🎮'];
const MS_CFG={easy:{cols:4,rows:4,on:6},medium:{cols:5,rows:5,on:9},hard:{cols:6,rows:6,on:13}};
function cleanUser(u={}){return{uid:String(u.uid||'').slice(0,100),name:String(u.name||'Guest').slice(0,60),photo:u.photo?String(u.photo).slice(0,1000):null,email:String(u.email||'').trim().toLowerCase().slice(0,200)};}
function ensureRoom(id,type='music',hostUid=null){if(!rooms.has(id))rooms.set(id,{roomId:id,type,hostUid,name:'',isPublic:true,users:new Map(),sockets:new Map(),playback:null,gameState:null,gameData:{},createdAt:Date.now()});const r=rooms.get(id);if(type)r.type=type;if(hostUid&&!r.hostUid)r.hostUid=hostUid;return r;}
function publicUsers(r){return Object.fromEntries([...r.users.entries()].map(([uid,u])=>[uid,u]));}
function member(s,id){const r=rooms.get(id);return!!r&&r.sockets.has(s.id);}
function emitUsers(r){io.to(r.roomId).emit('room:users',publicUsers(r));}
function emitState(r,s=null){const st={roomId:r.roomId,type:r.type,hostUid:r.hostUid,name:r.name||'',isPublic:r.isPublic!==false,users:publicUsers(r),playback:r.playback,gameState:r.gameState};(s||io.to(r.roomId)).emit('room:state',st);}
function removeEmpty(id){const r=rooms.get(id);if(r&&r.sockets.size===0){clearTimeout(r.gameData?.timeout);rooms.delete(id);}}
function socketsForUid(uid){return presence.get(String(uid||''))||new Set();}
function relayUid(uid,event,payload){for(const sid of socketsForUid(uid))io.to(sid).emit(event,payload);}
function resolveTarget(target){const q=String(target||'').trim().toLowerCase();if(!q)return new Set();if(presence.has(q))return new Set(presence.get(q));return new Set(presenceEmail.get(q)||[]);}
function registerPresence(s,u){if(!u.uid)return;let set=presence.get(u.uid);if(!set){set=new Set();presence.set(u.uid,set)}set.add(s.id);if(u.email){let es=presenceEmail.get(u.email);if(!es){es=new Set();presenceEmail.set(u.email,es)}es.add(s.id)}s.data.uid=u.uid;s.data.email=u.email;s.data.user=u;s.emit('presence:registered',{uid:u.uid});}
function unregisterPresence(s){const uid=s.data.uid,email=s.data.email;if(uid&&presence.has(uid)){presence.get(uid).delete(s.id);if(!presence.get(uid).size)presence.delete(uid)}if(email&&presenceEmail.has(email)){presenceEmail.get(email).delete(s.id);if(!presenceEmail.get(email).size)presenceEmail.delete(email)}}

function makeMemoryRound(r){
  const d=['easy','medium','hard'].includes(r.gameData.difficulty)?r.gameData.difficulty:'easy';
  const cfg={easy:{cols:4,rows:4,targetCount:3,previewMs:2200},medium:{cols:5,rows:4,targetCount:4,previewMs:2600},hard:{cols:6,rows:5,targetCount:5,previewMs:3000}}[d];
  const total=cfg.cols*cfg.rows,target=MR_SYMBOLS[Math.floor(Math.random()*MR_SYMBOLS.length)],cards=Array(total).fill(null),used=new Set();while(used.size<cfg.targetCount)used.add(Math.floor(Math.random()*total));used.forEach(i=>cards[i]=target);
  for(let i=0;i<total;i++){if(cards[i]!==null)continue;let x=MR_SYMBOLS[Math.floor(Math.random()*MR_SYMBOLS.length)];if(x===target)x=MR_SYMBOLS[(MR_SYMBOLS.indexOf(x)+1)%MR_SYMBOLS.length];cards[i]=x;}
  r.gameData.round=Number(r.gameData.round||0)+1;r.gameData.roundId=`mr-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;r.gameData.cards=cards;r.gameData.targetId=target;r.gameData.targetCount=cfg.targetCount;r.gameData.previewMs=cfg.previewMs;r.gameData.picked={};r.gameData.deadlineAt=0;r.gameData.timeout=null;
  for(const uid of r.users.keys())r.gameData.picked[uid]=new Set();
  r.gameState={roomId:r.roomId,round:r.gameData.round,difficulty:d,cards,targetId:target,roundId:r.gameData.roundId,previewMs:cfg.previewMs,deadlineAt:0};
  io.to(r.roomId).emit('memory:state',r.gameState);io.to(r.roomId).emit('memory:scores',{roomId:r.roomId,scores:r.gameData.scores||{},roundWins:r.gameData.roundWins||{}});
}
function startMemory(r,d){r.type='memoryrush';r.gameData={difficulty:['easy','medium','hard'].includes(d)?d:'easy',round:0,scores:{},roundWins:{},started:true,deadlineAt:0};for(const uid of r.users.keys()){r.gameData.scores[uid]=0;r.gameData.roundWins[uid]=0}makeMemoryRound(r);}
function seeded(seed){let x=(Number(seed)>>>0)||123456789;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296};}
function makeMindPattern(seed,d){const cfg=MS_CFG[d]||MS_CFG.easy,n=cfg.cols*cfg.rows,r=seeded(seed),set=new Set();while(set.size<cfg.on)set.add(Math.floor(r()*n));return[...set];}
function makeMindRound(r){const d=r.gameData.difficulty||'easy',seed=(Date.now()^((Number(r.gameData.puzzleNo||0)*2654435761)>>>0))>>>0,pattern=makeMindPattern(seed,d);r.gameData.puzzleNo=Number(r.gameData.puzzleNo||0)+1;r.gameData.pattern=pattern;r.gameData.previewMs=1200;r.gameData.picked={};r.gameData.wrong={};for(const uid of r.users.keys()){r.gameData.picked[uid]=new Set();r.gameData.wrong[uid]=0;}r.gameState={roomId:r.roomId,puzzleNo:r.gameData.puzzleNo,difficulty:d,pattern,previewMs:1200,deadlineAt:0,matchEndAt:0};io.to(r.roomId).emit('mind:state',r.gameState);io.to(r.roomId).emit('mind:match-progress',{roomId:r.roomId,scores:r.gameData.scores||{},solved:r.gameData.solved||{}});}
function startMind(r,d){r.type='mindsnap';r.gameData={difficulty:['easy','medium','hard'].includes(d)?d:'easy',puzzleNo:0,scores:{},solved:{},picked:{},wrong:{},started:true,deadlineAt:0};for(const uid of r.users.keys()){r.gameData.scores[uid]=0;r.gameData.solved[uid]=0}makeMindRound(r);}
function createMatch(game,a,b,aSocketId,bSocketId){const roomId=(Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-2)).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);const r=ensureRoom(roomId,game,a.uid);r.hostUid=a.uid;r.name=(String(game).toUpperCase()+' Match').slice(0,80);r.users.set(a.uid,a);r.users.set(b.uid,b);r.gameState={started:false};for(const [sid,u] of [[aSocketId,a.uid],[bSocketId,b.uid]]){if(!sid)continue;const so=io.sockets.sockets.get(sid);if(so){r.sockets.set(sid,u);so.join(roomId);so.data.rooms=so.data.rooms||new Set();so.data.rooms.add(roomId);}}emitState(r);emitUsers(r);return roomId;}
function queueMatch(s,payload){const game=String(payload?.game||'math').toLowerCase();const uid=s.data.uid;if(!uid)return s.emit('matchmaking:error',{message:'Authentication required'});let q=matchQueue.get(game);if(!q){q=new Map();matchQueue.set(game,q)}for(const [otherUid,e] of q){if(otherUid===uid)continue;const me=s.data.user||{uid,name:String(payload.name||'Player'),photo:payload.photo||null,email:s.data.email||''};const opp=e.user;const roomId=createMatch(game,opp,me,e.socketId,s.id);q.delete(otherUid);io.to(s.id).emit('matchmaking:matched',{roomId,game,hostUid:otherUid,opponent:opp});io.to(e.socketId).emit('matchmaking:matched',{roomId,game,hostUid:otherUid,opponent:me});return;}q.set(uid,{uid,user:{uid,name:String(payload.name||s.data.user?.name||'Player'),photo:payload.photo||s.data.user?.photo||null,email:s.data.email||''},socketId:s.id,time:Date.now()});s.emit('matchmaking:queued',{game});}
function leaveMatch(uid){for(const q of matchQueue.values())q.delete(uid);}

io.use(async(s,next)=>{try{s.user=await verifyFirebaseToken(s.handshake.auth?.token);next()}catch(e){next(new Error(e?.message||'Firebase authentication required'))}});
io.on('connection',socket=>{
  socket.on('time:ping',d=>socket.emit('time:pong',{clientSentAt:Number(d?.clientSentAt)||0,serverNow:Date.now()}));
  socket.on('presence:register',p=>registerPresence(socket,cleanUser(p)));
  socket.on('room:create',p=>{const id=String(p?.roomId||'').toUpperCase(),u=cleanUser(p?.user);if(!CODE_RE.test(id)||!u.uid)return socket.emit('room:error',{message:'Invalid room or user'});u.authUid=String(socket.user?.user_id||'');const old=rooms.get(id);if(old&&old.sockets.size&&old.hostUid!==u.uid)return socket.emit('room:error',{message:'Room already exists'});const r=ensureRoom(id,p?.type||'music',u.uid);r.hostUid=u.uid;r.type=p?.type||r.type;r.name=String(p?.name||r.name||'').slice(0,80);r.isPublic=p?.isPublic!==false;r.users.set(u.uid,u);r.sockets.set(socket.id,u.uid);socket.join(id);socket.data.rooms=socket.data.rooms||new Set();socket.data.rooms.add(id);emitState(r,socket);emitUsers(r);});
  socket.on('room:meta',p=>{const id=String(p?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id)||r.sockets.get(socket.id)!==r.hostUid)return;r.name=String(p?.name||r.name||'').slice(0,80);r.isPublic=p?.isPublic!==false;emitState(r);});
  socket.on('room:join',p=>{const id=String(p?.roomId||'').toUpperCase(),u=cleanUser(p?.user);if(!CODE_RE.test(id)||!u.uid)return socket.emit('room:error',{message:'Invalid room or user'});u.authUid=String(socket.user?.user_id||'');const r=rooms.get(id)||ensureRoom(id,p?.type||'music',p?.isHost?u.uid:null);if(!r.hostUid&&p?.isHost)r.hostUid=u.uid;r.name=String(p?.name||r.name||'').slice(0,80);r.isPublic=p?.isPublic!==false;r.users.set(u.uid,u);r.sockets.set(socket.id,u.uid);socket.join(id);socket.data.rooms=socket.data.rooms||new Set();socket.data.rooms.add(id);emitState(r,socket);emitUsers(r);});
  socket.on('room:reconnect',p=>{const id=String(p?.roomId||'').toUpperCase(),u=cleanUser(p?.user),r=rooms.get(id);if(!r||!CODE_RE.test(id)||!u.uid)return socket.emit('room:error',{message:'Room not available'});u.authUid=String(socket.user?.user_id||'');r.users.set(u.uid,u);r.sockets.set(socket.id,u.uid);socket.join(id);socket.data.rooms=socket.data.rooms||new Set();socket.data.rooms.add(id);emitState(r,socket);emitUsers(r);});
  socket.on('room:leave',p=>leaveRoom(socket,p?.roomId,p?.uid));
  socket.on('room:kick',p=>{const id=String(p?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id)||r.sockets.get(socket.id)!==r.hostUid)return;const target=String(p?.targetUid||'');if(!target||target===r.hostUid)return;for(const [sid,uid] of r.sockets.entries())if(uid===target){io.to(sid).emit('room:kicked',{roomId:id});io.sockets.sockets.get(sid)?.leave(id);r.sockets.delete(sid);}r.users.delete(target);emitUsers(r);emitState(r);removeEmpty(id);});
  socket.on('game:request',req=>{const target=String(req?.toUid||'').trim().toLowerCase();if(!target||!req?.from?.uid)return;const payload={...req,type:'gameRequest',status:'pending',time:Number(req.time)||Date.now(),from:cleanUser(req.from)};const ids=resolveTarget(target);for(const sid of ids)io.to(sid).emit('game:request',payload);});
  socket.on('game:request:response',res=>{const target=String(res?.fromUid||'');if(target)relayUid(target,'game:request:response',res);});
  socket.on('game:request-start',p=>{const id=String(p?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id)||r.sockets.get(socket.id)===r.hostUid)return;const uid=r.sockets.get(socket.id),u=r.users.get(uid)||{},hostSid=[...r.sockets.entries()].find(([,x])=>x===r.hostUid)?.[0];if(hostSid)io.to(hostSid).emit('game:request-start',{roomId:id,game:String(p?.game||r.type),uid,name:u.name||'Player',time:Date.now(),status:'pending'});});
  socket.on('game:start',p=>{const id=String(p?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id)||r.sockets.get(socket.id)!==r.hostUid)return socket.emit('room:error',{message:'Only host can START'});if(r.users.size<2)return socket.emit('room:error',{message:'Need at least two players'});r.gameState={...(r.gameState||{}),started:true,startedAt:Date.now(),game:String(p?.game||r.type)};io.to(id).emit('game:started',{...r.gameState,hostUid:r.hostUid});});
  socket.on('matchmaking:join',p=>queueMatch(socket,p));
  socket.on('matchmaking:leave',()=>leaveMatch(socket.data.uid));
  socket.on('music:event',p=>musicEvent(socket,p));
  socket.on('music:request-state',p=>{const id=String(p?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id))return;const hs=[...r.sockets.entries()].find(([,u])=>u===r.hostUid)?.[0];if(hs)io.to(hs).emit('music:request-state',{roomId:id,requesterUid:p?.uid||null});if(r.playback)socket.emit('music:state',r.playback);});
  socket.on('music:control',p=>{const id=String(p?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id)||r.sockets.get(socket.id)!==r.hostUid)return;const a=String(p?.action||'state'),cur=r.playback||{};if(!['play','pause','seek','volume','mute','next'].includes(a))return;const e={roomId:id,hostUid:r.hostUid,action:a,videoId:p?.videoId??cur.videoId??null,title:String(p?.title??cur.title??'').slice(0,300),ch:String(p?.ch??cur.ch??'').slice(0,200),thumb:String(p?.thumb??cur.thumb??'').slice(0,1000),position:Math.max(0,Number(p?.position??cur.position??0)||0),playing:a==='pause'?false:(a==='play'?true:(p?.playing!=null?!!p.playing:!!cur.playing)),volume:Math.max(0,Math.min(1,Number(p?.volume??cur.volume??0.8))),muted:!!(p?.muted??cur.muted),serverAt:Date.now(),duration:Math.max(0,Number(p?.duration??cur.duration??0)||0)};r.playback=e;io.to(id).emit('music:control',e);io.to(id).emit('music:event',e);});
  socket.on('chat:message',m=>{const id=String(m?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id))return;const uid=r.sockets.get(socket.id);socket.to(id).emit('chat:message',{roomId:id,uid,name:String(m?.name||'Guest').slice(0,60),photo:m?.photo?String(m.photo).slice(0,1000):null,text:String(m?.text||'').slice(0,2000),time:Date.now(),type:m?.type==='voice'?'voice':'text',audioData:m?.type==='voice'&&m?.audioData?String(m.audioData).slice(0,1500000):undefined});});
  socket.on('memory:start',p=>{const id=String(p?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id)||r.sockets.get(socket.id)!==r.hostUid)return socket.emit('room:error',{message:'Only host can START'});if(r.users.size<2)return socket.emit('room:error',{message:'Need two players before START'});startMemory(r,p?.difficulty);emitState(r);});
  socket.on('memory:pick',p=>{const id=String(p?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id)||!r.gameData?.started)return;const uid=r.sockets.get(socket.id);if(String(p?.roundId)!==String(r.gameData.roundId))return;const idx=Number(p?.index);if(!Number.isInteger(idx)||idx<0||idx>=r.gameData.cards.length)return;const set=r.gameData.picked[uid]||(r.gameData.picked[uid]=new Set());if(set.has(idx))return;const good=r.gameData.cards[idx]===r.gameData.targetId;if(good)set.add(idx);socket.emit('memory:feedback',{roomId:id,index:idx,correct:good,score:Number(r.gameData.scores?.[uid]||0),roundId:r.gameData.roundId});if(good&&set.size>=Number(r.gameData.targetCount||3)){r.gameData.scores[uid]=Number(r.gameData.scores?.[uid]||0)+1;r.gameData.roundWins[uid]=Number(r.gameData.roundWins?.[uid]||0)+1;io.to(id).emit('memory:scores',{roomId:id,scores:r.gameData.scores,roundWins:r.gameData.roundWins});io.to(id).emit('memory:round-result',{roomId:id,winnerUid:uid,roundWins:r.gameData.roundWins,scores:r.gameData.scores});setTimeout(()=>{if(rooms.get(id)===r&&r.gameData?.started)makeMemoryRound(r)},650);}});
  socket.on('memory:timeout',()=>{});
  socket.on('mind:start',p=>{const id=String(p?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id)||r.sockets.get(socket.id)!==r.hostUid)return socket.emit('room:error',{message:'Only host can START'});if(r.users.size<2)return socket.emit('room:error',{message:'Need two players before START'});startMind(r,p?.difficulty);emitState(r);});
  socket.on('mind:tap',p=>{const id=String(p?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id)||!r.gameData?.started)return;const uid=r.sockets.get(socket.id),st=r.gameState;if(Number(p?.puzzleNo)!==Number(st?.puzzleNo))return;const idx=Number(p?.index);if(!Number.isInteger(idx))return;const picked=r.gameData.picked[uid]||(r.gameData.picked[uid]=new Set());if(picked.has(idx))return;const good=st.pattern.includes(idx);if(good)picked.add(idx);else r.gameData.wrong[uid]=Number(r.gameData.wrong[uid]||0)+1;const wrong=Number(r.gameData.wrong[uid]||0);if(good&&picked.size>=st.pattern.length){r.gameData.scores[uid]=Number(r.gameData.scores[uid]||0)+1;r.gameData.solved[uid]=Number(r.gameData.solved[uid]||0)+1;socket.emit('mind:feedback',{roomId:id,index:idx,correct:true,score:r.gameData.scores[uid],solved:r.gameData.solved[uid],wrongStreak:0});io.to(id).emit('mind:match-progress',{roomId:id,scores:r.gameData.scores,solved:r.gameData.solved});setTimeout(()=>{if(rooms.get(id)===r&&r.gameData?.started)makeMindRound(r)},300);return;}socket.emit('mind:feedback',{roomId:id,index:idx,correct:good,score:Number(r.gameData.scores[uid]||0),solved:Number(r.gameData.solved[uid]||0),wrongStreak:wrong});if(!good&&wrong>=2){setTimeout(()=>{if(rooms.get(id)===r&&r.gameData?.started)makeMindRound(r)},250);}});
  socket.on('mind:timeout',()=>{});
  socket.on('disconnect',()=>{leaveMatch(socket.data.uid);unregisterPresence(socket);const joined=socket.data.rooms?[...socket.data.rooms]:[];for(const id of joined)leaveRoom(socket,id,socket.data.uid);});
});
function musicEvent(socket,p){const id=String(p?.roomId||'').toUpperCase(),r=rooms.get(id);if(!r||!member(socket,id)||r.sockets.get(socket.id)!==r.hostUid)return;const e={roomId:id,hostUid:r.hostUid,action:String(p?.action||'state'),videoId:p?.videoId?String(p.videoId).slice(0,64):null,title:String(p?.title||'').slice(0,300),ch:String(p?.ch||'').slice(0,200),thumb:String(p?.thumb||'').slice(0,1000),position:Math.max(0,Number(p?.position)||0),playing:!!p?.playing,serverAt:Date.now(),duration:Math.max(0,Number(p?.duration)||0)};r.playback=e;socket.to(id).emit('music:event',e);}
function leaveRoom(socket,idRaw,uidRaw){const id=String(idRaw||'').toUpperCase(),r=rooms.get(id);if(!r)return;const uid=r.sockets.get(socket.id)||String(uidRaw||'');r.sockets.delete(socket.id);try{socket.leave(id)}catch(e){}if(uid&&!([...r.sockets.values()].includes(uid)))r.users.delete(uid);if(r.hostUid===uid&&r.users.size){const next=[...r.users.values()][0];r.hostUid=next.uid;io.to(id).emit('room:host-changed',{roomId:id,hostUid:r.hostUid,name:next.name});}emitUsers(r);emitState(r);removeEmpty(id);}
server.listen(PORT,()=>console.log(`SonicSync Socket.IO Firebase-auth v13 running on port ${PORT}`));
