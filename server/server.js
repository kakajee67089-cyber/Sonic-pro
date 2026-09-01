'use strict';

// SonicSync Pro realtime backend.
// Firebase Authentication remains the source of identity. Guests (anonymous
// Firebase users), Google users and email/password users all have Firebase IDs.
// The server only keeps ephemeral realtime room/game state.

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { jwtVerify, decodeProtectedHeader } = require('jose');
const { createPublicKey } = require('crypto');

const PORT = process.env.PORT || 3000;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'sonic-singh';
const FIREBASE_CERT_URL = 'https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let firebaseCertCache = { expiresAt: 0, keys: new Map() };

async function getFirebaseKey(kid) {
  if (!kid) throw new Error('Missing token key id');
  if (Date.now() >= firebaseCertCache.expiresAt || !firebaseCertCache.keys.has(kid)) {
    const res = await fetch(FIREBASE_CERT_URL);
    if (!res.ok) throw new Error('Unable to fetch Firebase signing certificates');
    const certs = await res.json();
    const keys = new Map();
    for (const [id, cert] of Object.entries(certs)) keys.set(id, createPublicKey(cert));
    const cc = res.headers.get('cache-control') || '';
    const m = cc.match(/max-age=(\d+)/i);
    const ttl = m ? Number(m[1]) * 1000 : 3600000;
    firebaseCertCache = { expiresAt: Date.now() + Math.max(60000, ttl - 60000), keys };
  }
  const key = firebaseCertCache.keys.get(kid);
  if (!key) throw new Error('Unknown Firebase signing key');
  return key;
}
async function verifyFirebaseToken(token) {
  const { kid } = decodeProtectedHeader(token);
  const key = await getFirebaseKey(kid);
  const { payload } = await jwtVerify(token, key, { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID });
  if (payload.sub !== payload.user_id) throw new Error('Invalid Firebase token subject');
  return payload;
}

const app = express();
const server = http.createServer(app);
const allowedOrigins = String(process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
const io = new Server(server, {
  cors: { origin: (origin, callback) => (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) ? callback(null, true) : callback(new Error('CORS origin not allowed')), methods: ['GET','POST'] },
  transports: ['websocket','polling'], pingInterval: 10000, pingTimeout: 10000, maxHttpBufferSize: 2e6,
  connectionStateRecovery: { maxDisconnectionDuration: 120000, skipMiddlewares: false }
});
app.get('/', (_req,res)=>res.json({ok:true,service:'SonicSync Socket.IO',auth:'firebase',project:PROJECT_ID,message:'Realtime server is running'}));
app.get('/health', (_req,res)=>res.json({ok:true,service:'SonicSync Socket.IO',auth:'firebase',project:PROJECT_ID,now:Date.now()}));

const rooms = new Map();
const presence = new Map();
const CODE_RE = /^[A-Z0-9]{6}$/;
const MR_SYMBOLS = ['🔴','🔵','🟢','🟡','🟣','🟠','⭐','❤️','⚡','🎯','🌟','💎'];
const MS_CFG = {easy:{cols:4,rows:4,on:6},medium:{cols:5,rows:5,on:9},hard:{cols:6,rows:6,on:13}};
function cleanUser(user={}){return{uid:String(user.uid||'').slice(0,100),name:String(user.name||'Guest').slice(0,60),photo:user.photo?String(user.photo).slice(0,1000):null};}
function ensureRoom(roomId,data={}){if(!rooms.has(roomId))rooms.set(roomId,{roomId,type:data.type||'music',hostUid:data.hostUid||null,users:new Map(),sockets:new Map(),playback:null,gameState:null,gameData:{},createdAt:Date.now()});return rooms.get(roomId);}
function publicUsers(room){return Object.fromEntries([...room.users.entries()].map(([uid,u])=>[uid,u]));}
function publicPlayback(room){return room.playback?{...room.playback}:null;}
function publicGameState(room){return room.gameState?JSON.parse(JSON.stringify(room.gameState)):null;}
function removeEmpty(roomId){const room=rooms.get(roomId);if(room&&room.sockets.size===0)rooms.delete(roomId);}
function isMember(socket,roomId){const room=rooms.get(roomId);return!!room&&room.sockets.has(socket.id);}
function broadcastUsers(room){io.to(room.roomId).emit('room:users',publicUsers(room));}
function broadcastRoomState(room,socket=null){const state={roomId:room.roomId,type:room.type,hostUid:room.hostUid,users:publicUsers(room),playback:publicPlayback(room),gameState:publicGameState(room)};(socket||io.to(room.roomId)).emit('room:state',state);}
function socketForUid(uid){return presence.get(String(uid||''))||new Set();}
function relayToUid(uid,event,payload){for(const sid of socketForUid(uid))io.to(sid).emit(event,payload);}
function seeded(seed){let x=(Number(seed)>>>0)||123456789;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function makeMindPattern(seed,difficulty){const cfg=MS_CFG[difficulty]||MS_CFG.easy,n=cfg.cols*cfg.rows,r=seeded(seed),set=new Set();while(set.size<cfg.on)set.add(Math.floor(r()*n));return[...set];}
function nextMemoryRound(room){
  const d=['easy','medium','hard'].includes(room.gameData.difficulty)?room.gameData.difficulty:'easy';
  const cfg={easy:{cols:4,rows:4,targetCount:3,previewMs:2200},medium:{cols:5,rows:4,targetCount:4,previewMs:2600},hard:{cols:6,rows:5,targetCount:5,previewMs:3000}}[d];
  const target=MR_SYMBOLS[Math.floor(Math.random()*MR_SYMBOLS.length)],total=cfg.cols*cfg.rows,cards=Array(total).fill(null),used=new Set();
  while(used.size<cfg.targetCount)used.add(Math.floor(Math.random()*total));
  used.forEach(i=>cards[i]=target);
  for(let i=0;i<total;i++){if(cards[i]!==null)continue;let s=MR_SYMBOLS[Math.floor(Math.random()*MR_SYMBOLS.length)];if(s===target)s=MR_SYMBOLS[(MR_SYMBOLS.indexOf(s)+1)%MR_SYMBOLS.length];cards[i]=s;}
  room.gameData.round=Number(room.gameData.round||0)+1;room.gameData.roundId=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;room.gameData.cards=cards;room.gameData.targetId=target;room.gameData.targetCount=cfg.targetCount;room.gameData.previewMs=cfg.previewMs;room.gameData.picked={};room.gameData.deadlineAt=0;
  room.gameState={roomId:room.roomId,round:room.gameData.round,roundId:room.gameData.roundId,difficulty:d,cards,targetId:target,previewMs:cfg.previewMs,deadlineAt:0};
  io.to(room.roomId).emit('memory:state',room.gameState);io.to(room.roomId).emit('memory:scores',{roomId:room.roomId,scores:room.gameData.scores||{},roundWins:room.gameData.roundWins||{}});
}

io.use(async(socket,next)=>{try{const token=String(socket.handshake.auth?.token||'');if(!token)return next(new Error('Firebase authentication required'));socket.user=await verifyFirebaseToken(token);return next();}catch(e){return next(new Error('Invalid Firebase authentication'));}});

io.on('connection',socket=>{
  socket.on('time:ping',data=>socket.emit('time:pong',{clientSentAt:Number(data?.clientSentAt)||0,serverNow:Date.now()}));
  socket.on('presence:register',payload=>{const uid=String(payload?.uid||'').slice(0,100);if(!uid)return;socket.data.presenceUid=uid;if(!presence.has(uid))presence.set(uid,new Set());presence.get(uid).add(socket.id);socket.emit('presence:registered',{uid});});

  socket.on('room:create',payload=>{
    const roomId=String(payload?.roomId||'').toUpperCase();if(!CODE_RE.test(roomId))return socket.emit('room:error',{message:'Invalid room code'});
    const user=cleanUser(payload?.user);user.authUid=String(socket.user?.user_id||'');if(!user.uid||!user.authUid)return socket.emit('room:error',{message:'Missing authenticated user'});
    const existing=rooms.get(roomId);if(existing&&existing.sockets.size>0&&existing.hostUid!==user.uid)return socket.emit('room:error',{message:'Room already exists'});
    const room=ensureRoom(roomId,{type:payload?.type||'music',hostUid:user.uid});room.hostUid=room.hostUid||user.uid;room.type=payload?.type||room.type;room.users.set(user.uid,user);room.sockets.set(socket.id,user.uid);socket.join(roomId);socket.data.rooms=socket.data.rooms||new Set();socket.data.rooms.add(roomId);broadcastRoomState(room,socket);broadcastUsers(room);
  });
  socket.on('room:join',payload=>{
    const roomId=String(payload?.roomId||'').toUpperCase(),user=cleanUser(payload?.user);user.authUid=String(socket.user?.user_id||'');if(!CODE_RE.test(roomId)||!user.uid||!user.authUid)return socket.emit('room:error',{message:'Invalid room or authentication'});
    const room=rooms.get(roomId)||ensureRoom(roomId,{type:payload?.type||'music'});if(!room.hostUid)room.hostUid=payload?.isHost?user.uid:null;room.users.set(user.uid,user);room.sockets.set(socket.id,user.uid);socket.join(roomId);socket.data.rooms=socket.data.rooms||new Set();socket.data.rooms.add(roomId);broadcastRoomState(room,socket);broadcastUsers(room);
  });
  socket.on('room:leave',payload=>{const roomId=String(payload?.roomId||'').toUpperCase(),room=rooms.get(roomId);if(!room)return;const uid=room.sockets.get(socket.id)||String(payload?.uid||'');room.sockets.delete(socket.id);socket.leave(roomId);if(![...room.sockets.values()].includes(uid))room.users.delete(uid);if(room.hostUid===uid)room.hostUid=[...room.users.keys()][0]||null;broadcastUsers(room);broadcastRoomState(room);removeEmpty(roomId);});

  socket.on('music:event',state=>{const roomId=String(state?.roomId||'').toUpperCase(),room=rooms.get(roomId);if(!room||!isMember(socket,roomId))return;const uid=room.sockets.get(socket.id);if(uid!==room.hostUid)return;const event={roomId,hostUid:room.hostUid,action:String(state.action||'state'),videoId:state.videoId?String(state.videoId).slice(0,64):null,title:String(state.title||'').slice(0,300),ch:String(state.ch||'').slice(0,200),thumb:String(state.thumb||'').slice(0,1000),position:Math.max(0,Number(state.position)||0),playing:!!state.playing,serverAt:Date.now(),duration:Math.max(0,Number(state.duration)||0)};room.playback=event;socket.to(roomId).emit('music:event',event);});
  socket.on('music:request-state',payload=>{const roomId=String(payload?.roomId||'').toUpperCase(),room=rooms.get(roomId);if(!room||!isMember(socket,roomId))return;const hostSocketId=[...room.sockets.entries()].find(([,uid])=>uid===room.hostUid)?.[0];if(hostSocketId)io.to(hostSocketId).emit('music:request-state',{roomId,requesterUid:payload?.uid||null});if(room.playback)socket.emit('music:state',room.playback);});
  socket.on('chat:message',message=>{const roomId=String(message?.roomId||'').toUpperCase(),room=rooms.get(roomId);if(!room||!isMember(socket,roomId))return;const uid=room.sockets.get(socket.id),msg={roomId,uid,name:String(message?.name||'Guest').slice(0,60),photo:message?.photo?String(message.photo).slice(0,1000):null,text:String(message?.text||'').slice(0,2000),time:Date.now(),type:message?.type==='voice'?'voice':'text',audioData:message?.type==='voice'&&message?.audioData?String(message.audioData).slice(0,1500000):undefined};socket.to(roomId).emit('chat:message',msg);});

  socket.on('game:request',req=>{const target=String(req?.toUid||'');if(target)relayToUid(target,'game:request',{...req,time:Number(req.time)||Date.now()});});
  socket.on('game:request:response',res=>{const target=String(res?.fromUid||'');if(target)relayToUid(target,'game:request:response',res);});

  socket.on('memory:start',payload=>{const room=rooms.get(String(payload?.roomId||'').toUpperCase());if(!room||!isMember(socket,room.roomId)||room.sockets.get(socket.id)!==room.hostUid)return;room.type='memoryrush';room.gameData={difficulty:['easy','medium','hard'].includes(payload?.difficulty)?payload.difficulty:'easy',scores:{},roundWins:{},round:0,started:true};for(const p of room.users.keys()){room.gameData.scores[p]=0;room.gameData.roundWins[p]=0;}nextMemoryRound(room);broadcastRoomState(room);});
  socket.on('memory:pick',payload=>{const roomId=String(payload?.roomId||'').toUpperCase(),room=rooms.get(roomId);if(!room||!isMember(socket,roomId))return;const uid=room.sockets.get(socket.id),gd=room.gameData||{};if(!gd.started||payload?.roundId!==gd.roundId)return;const idx=Number(payload?.index);if(!Number.isInteger(idx)||idx<0||idx>=(gd.cards||[]).length)return;gd.picked[uid]=gd.picked[uid]||{};if(Object.prototype.hasOwnProperty.call(gd.picked[uid],idx))return;const correct=gd.cards[idx]===gd.targetId;gd.picked[uid][idx]=correct;if(correct)gd.scores[uid]=Number(gd.scores?.[uid]||0)+1;socket.emit('memory:feedback',{roomId,index:idx,correct,score:Number(gd.scores?.[uid]||0),roundId:gd.roundId});io.to(roomId).emit('memory:scores',{roomId,scores:gd.scores,roundWins:gd.roundWins});const pickedCorrect=Object.values(gd.picked[uid]).filter(Boolean).length;if(pickedCorrect>=Number(gd.targetCount||3)){gd.roundWins[uid]=Number(gd.roundWins?.[uid]||0)+1;io.to(roomId).emit('memory:round-result',{roomId,winnerUid:uid,roundWins:gd.roundWins,scores:gd.scores});setTimeout(()=>{if(rooms.get(roomId)===room&&gd.started)nextMemoryRound(room);},650);}});
  socket.on('memory:timeout',()=>{});

  socket.on('mind:start',payload=>{const room=rooms.get(String(payload?.roomId||'').toUpperCase());if(!room||!isMember(socket,room.roomId)||room.sockets.get(socket.id)!==room.hostUid)return;const difficulty=MS_CFG[payload?.difficulty]?payload.difficulty:'easy';room.type='mindsnap';room.gameData={difficulty,puzzleNo:1,scores:{},solved:{},picked:{},started:true,seed:(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0};for(const p of room.users.keys()){room.gameData.scores[p]=0;room.gameData.solved[p]=0;}room.gameState={roomId:room.roomId,puzzleNo:1,difficulty,pattern:makeMindPattern(room.gameData.seed,difficulty),previewMs:1200,deadlineAt:0};io.to(room.roomId).emit('mind:state',room.gameState);broadcastRoomState(room);});
  socket.on('mind:tap',payload=>{const roomId=String(payload?.roomId||'').toUpperCase(),room=rooms.get(roomId);if(!room||!isMember(socket,roomId))return;const gd=room.gameData||{},st=room.gameState||{},uid=room.sockets.get(socket.id);if(!gd.started||Number(payload?.puzzleNo)!==Number(st.puzzleNo))return;const idx=Number(payload?.index),correct=Number.isInteger(idx)&&idx>=0&&st.pattern?.includes(idx);if(!correct){socket.emit('mind:feedback',{roomId,index:idx,correct:false,wrongStreak:1,score:Number(gd.scores?.[uid]||0),solved:Number(gd.solved?.[uid]||0)});return;}gd.picked[uid]=gd.picked[uid]||new Set();if(gd.picked[uid].has(idx))return;gd.picked[uid].add(idx);socket.emit('mind:feedback',{roomId,index:idx,correct:true,score:Number(gd.scores?.[uid]||0),solved:Number(gd.solved?.[uid]||0)});if(gd.picked[uid].size>=st.pattern.length){gd.scores[uid]=Number(gd.scores?.[uid]||0)+1;gd.solved[uid]=Number(gd.solved?.[uid]||0)+1;for(const other of room.users.keys())if(other!==uid){const sid=[...room.sockets.entries()].find(([,u])=>u===other)?.[0];if(sid)io.to(sid).emit('mind:opponent',{roomId,score:gd.scores[other]||0,solved:gd.solved[other]||0});}setTimeout(()=>{if(rooms.get(roomId)!==room||!gd.started)return;gd.puzzleNo=Number(gd.puzzleNo||st.puzzleNo)+1;gd.picked={};gd.seed=(Number(gd.seed||1)+2654435761)>>>0;room.gameState={roomId,puzzleNo:gd.puzzleNo,difficulty:gd.difficulty,pattern:makeMindPattern(gd.seed,gd.difficulty),previewMs:1200,deadlineAt:0};io.to(roomId).emit('mind:match-progress',{roomId,scores:gd.scores,solved:gd.solved});io.to(roomId).emit('mind:state',room.gameState);},450);}});
  socket.on('mind:timeout',()=>{});

  socket.on('disconnect',()=>{const pUid=socket.data.presenceUid;if(pUid&&presence.has(pUid)){presence.get(pUid).delete(socket.id);if(!presence.get(pUid).size)presence.delete(pUid);}const joined=socket.data.rooms?[...socket.data.rooms]:[];for(const roomId of joined){const room=rooms.get(roomId);if(!room)continue;const uid=room.sockets.get(socket.id);room.sockets.delete(socket.id);if(uid&&!([...room.sockets.values()].includes(uid)))room.users.delete(uid);if(room.hostUid===uid)room.hostUid=[...room.users.keys()][0]||null;broadcastUsers(room);broadcastRoomState(room);removeEmpty(roomId);}});
});
server.listen(PORT,()=>console.log(`SonicSync Socket.IO Firebase-auth server running on port ${PORT}`));
