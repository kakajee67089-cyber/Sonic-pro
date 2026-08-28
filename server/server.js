'use strict';

// SonicSync Pro V9 - Socket.IO server
// Live rooms + Memory Rush + Mind Snap Duel + instant UID game requests.
// Firebase remains the persistent store used by the client for profiles/history.

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 2e6
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'SonicSync Socket.IO V9', now: Date.now() }));
app.get('/', (_req, res) => res.json({ ok: true, service: 'SonicSync Socket.IO V9' }));

const rooms = new Map();
const online = new Map(); // uid -> socket ids
const CODE_RE = /^[A-Z0-9]{6}$/;
const MR_SYMBOLS = ['🔴','🔵','🟢','🟡','🟣','🟠','🩷','🩵','⭐','💎','🔥','⚡','🍀','🌙','☀️','🎵','🎯','🎮'];
const MS_CFG = { easy:{cols:4,rows:4,on:6}, medium:{cols:5,rows:5,on:9}, hard:{cols:6,rows:6,on:13} };

function cleanUser(user={}) { return { uid:String(user.uid||'').slice(0,100), name:String(user.name||'Guest').slice(0,60), photo:user.photo?String(user.photo).slice(0,1000):null }; }
function ensureRoom(roomId,data={}) {
  if(!rooms.has(roomId)) rooms.set(roomId,{roomId,type:data.type||'music',hostUid:data.hostUid||null,users:new Map(),sockets:new Map(),playback:null,gameState:null,memory:null,mind:null,createdAt:Date.now()});
  return rooms.get(roomId);
}
function publicUsers(room){ return Object.fromEntries([...room.users.entries()].map(([uid,u])=>[uid,u])); }
function isMember(socket,roomId){ const r=rooms.get(roomId); return !!r&&r.sockets.has(socket.id); }
function broadcastUsers(room){ io.to(room.roomId).emit('room:users',publicUsers(room)); }
function removeEmpty(roomId){ const r=rooms.get(roomId); if(r&&r.sockets.size===0)rooms.delete(roomId); }
function userForSocket(room,socket){ const uid=room?.sockets.get(socket.id); return uid?room.users.get(uid):null; }
function emitRoomState(socket,room){ socket.emit('room:state',{roomId:room.roomId,type:room.type,hostUid:room.hostUid,users:publicUsers(room),playback:room.playback,gameState:room.gameState}); }
function randCode(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join(''); }
function makeMemoryRound(room){
  const diff=room.memory?.difficulty||'easy';
  const cfg=diff==='hard'?{cols:6,rows:6,targetCount:4}:diff==='medium'?{cols:5,rows:5,targetCount:3}:{cols:4,rows:4,targetCount:3};
  const total=cfg.cols*cfg.rows, target=MR_SYMBOLS[Math.floor(Math.random()*12)], cards=Array(total).fill(null), used=new Set();
  while(used.size<cfg.targetCount)used.add(Math.floor(Math.random()*total));
  used.forEach(i=>cards[i]=target);
  for(let i=0;i<total;i++){ if(cards[i])continue; let s=MR_SYMBOLS[Math.floor(Math.random()*MR_SYMBOLS.length)]; if(s===target)s=MR_SYMBOLS[(MR_SYMBOLS.indexOf(s)+1)%MR_SYMBOLS.length]; cards[i]=s; }
  const now=Date.now(),previewMs=2200;
  room.memory.round=(room.memory.round||0)+1;
  room.memory.cards=cards; room.memory.targetId=target; room.memory.roundId='mr-'+now+'-'+room.memory.round;
  room.memory.previewMs=previewMs; room.memory.deadlineAt=now+previewMs+15000; room.memory.picked={};
  for(const uid of room.users.keys())room.memory.picked[uid]=new Set();
  const state={roomId:room.roomId,round:room.memory.round,difficulty:diff,cards,targetId:target,roundId:room.memory.roundId,previewMs,deadlineAt:room.memory.deadlineAt};
  room.gameState=state; io.to(room.roomId).emit('memory:state',state);
  clearTimeout(room.memory.timeout); room.memory.timeout=setTimeout(()=>memoryTimeout(room),previewMs+15050);
}
function memoryTimeout(room){ if(!rooms.has(room.roomId)||!room.memory)return; const scores=room.memory.scores||{}; const wins=room.memory.roundWins||{}; io.to(room.roomId).emit('memory:round-result',{roomId:room.roomId,winnerUid:null,roundWins:wins,scores}); makeMemoryRound(room); }
function emitMemoryScores(room){ io.to(room.roomId).emit('memory:scores',{roomId:room.roomId,scores:room.memory.scores||{},roundWins:room.memory.roundWins||{}}); }
function seedMemory(room){ room.memory=room.memory||{difficulty:'easy',round:0,scores:{},roundWins:{}}; for(const uid of room.users.keys()){if(room.memory.scores[uid]==null)room.memory.scores[uid]=0;if(room.memory.roundWins[uid]==null)room.memory.roundWins[uid]=0;} }

function seeded(seed){ let x=(Number(seed)>>>0)||123456789; return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}; }
function makeMindPattern(diff,seed){ const cfg=MS_CFG[diff]||MS_CFG.easy,n=cfg.cols*cfg.rows,r=seeded(seed),set=new Set();while(set.size<cfg.on)set.add(Math.floor(r()*n));return [...set]; }
function makeMindPuzzle(room){
  const now=Date.now(),diff=room.mind?.difficulty||'easy',pattern=makeMindPattern(diff,(now^(room.mind.puzzleNo*2654435761))>>>0),previewMs=1200;
  room.mind.puzzleNo=(room.mind.puzzleNo||0)+1; room.mind.pattern=pattern; room.mind.previewMs=previewMs; room.mind.puzzleEndAt=Math.min(room.mind.matchEndAt,now+previewMs+15000); room.mind.picked={}; room.mind.wrong={};
  for(const uid of room.users.keys()){room.mind.picked[uid]=new Set();room.mind.wrong[uid]=0;}
  emitMindState(room);
  clearTimeout(room.mind.timeout); room.mind.timeout=setTimeout(()=>mindTimeout(room),previewMs+15050);
}
function emitMindState(room){
  if(!room.mind)return; const uids=[...room.users.keys()];
  for(const uid of uids){ const opp=uids.find(x=>x!==uid); const st={roomId:room.roomId,difficulty:room.mind.difficulty,puzzleNo:room.mind.puzzleNo,pattern:room.mind.pattern,previewMs:room.mind.previewMs,matchEndAt:room.mind.matchEndAt,puzzleEndAt:room.mind.puzzleEndAt,score:Number(room.mind.scores?.[uid]||0),solved:Number(room.mind.solved?.[uid]||0),oppScore:Number(room.mind.scores?.[opp]||0),oppSolved:Number(room.mind.solved?.[opp]||0)}; const sid=[...room.sockets.entries()].find(([,x])=>x===uid)?.[0]; if(sid)io.to(sid).emit('mind:state',st); }
}
function mindTimeout(room){ if(!rooms.has(room.roomId)||!room.mind)return; if(Date.now()>=room.mind.matchEndAt)return finishMind(room); makeMindPuzzle(room); }
function finishMind(room){ if(!room.mind||room.mind.finished)return;room.mind.finished=true;clearTimeout(room.mind.timeout);const uids=[...room.users.keys()],a=uids[0],b=uids[1],sa=Number(room.mind.scores?.[a]||0),sb=Number(room.mind.scores?.[b]||0),winner=sa===sb?null:(sa>sb?a:b);for(const uid of uids){const sid=[...room.sockets.entries()].find(([,x])=>x===uid)?.[0];if(sid)io.to(sid).emit('mind:match-end',{roomId:room.roomId,meScore:Number(room.mind.scores?.[uid]||0),oppScore:Number(room.mind.scores?.[uids.find(x=>x!==uid)]||0),winnerUid:winner});}}

function registerOnline(socket,user){ if(!user?.uid)return;let set=online.get(user.uid);if(!set){set=new Set();online.set(user.uid,set)}set.add(socket.id);socket.data.uid=user.uid;socket.data.user=user;socket.emit('presence:registered',{uid:user.uid}); }
function deliverToUid(uid,event,payload){const ids=online.get(String(uid))||new Set();for(const sid of ids)io.to(sid).emit(event,payload);}

io.on('connection',socket=>{
  socket.on('time:ping',d=>socket.emit('time:pong',{clientSentAt:Number(d?.clientSentAt)||0,serverNow:Date.now()}));
  socket.on('presence:register',p=>registerOnline(socket,cleanUser(p)));

  socket.on('room:create',p=>{
    const roomId=String(p?.roomId||'').toUpperCase(),user=cleanUser(p?.user);if(!CODE_RE.test(roomId)||!user.uid)return socket.emit('room:error',{message:'Invalid room or user'});
    const existing=rooms.get(roomId);if(existing&&existing.sockets.size>0&&existing.hostUid!==user.uid)return socket.emit('room:error',{message:'Room already exists'});
    const room=ensureRoom(roomId,{type:p?.type||'music',hostUid:user.uid});room.hostUid=user.uid;room.type=p?.type||room.type;room.users.set(user.uid,user);room.sockets.set(socket.id,user.uid);socket.join(roomId);socket.data.rooms=socket.data.rooms||new Set();socket.data.rooms.add(roomId);emitRoomState(socket,room);broadcastUsers(room);
  });

  socket.on('room:join',p=>{
    const roomId=String(p?.roomId||'').toUpperCase(),user=cleanUser(p?.user);if(!CODE_RE.test(roomId)||!user.uid)return socket.emit('room:error',{message:'Invalid room or user'});
    const room=rooms.get(roomId)||ensureRoom(roomId,{type:p?.type||'music'});if(!room.hostUid&&p?.isHost)room.hostUid=user.uid;room.users.set(user.uid,user);room.sockets.set(socket.id,user.uid);socket.join(roomId);socket.data.rooms=socket.data.rooms||new Set();socket.data.rooms.add(roomId);emitRoomState(socket,room);broadcastUsers(room);
  });

  socket.on('room:leave',p=>leaveRoom(socket,p?.roomId,p?.uid));

  socket.on('game:request',req=>{
    if(!req?.from?.uid||!req?.toUid)return;const clean={...req,type:'gameRequest',status:'pending',time:Number(req.time)||Date.now(),from:cleanUser(req.from)};deliverToUid(req.toUid,'game:request',clean);
  });
  socket.on('game:request:response',r=>{if(!r?.requestId)return;const payload={requestId:r.requestId,status:r.status,fromUid:r.toUid,toUid:r.fromUid,roomId:r.roomId,game:r.game,time:Date.now()};deliverToUid(r.fromUid,'game:request:response',payload);});

  // Multiplayer START handshake: only the room host may start; all members receive
  // the same server timestamp so both clients can enter the game together.
  socket.on('game:request-start',p=>{
    const roomId=String(p?.roomId||'').toUpperCase(),room=rooms.get(roomId);
    if(!room||!isMember(socket,roomId))return;
    const uid=room.sockets.get(socket.id);
    if(uid===room.hostUid)return;
    const payload={roomId,game:String(p?.game||room.type||'game'),uid:String(uid||p?.uid||''),name:String(p?.name||'Player').slice(0,60),time:Date.now(),status:'pending'};
    const hostSid=[...room.sockets.entries()].find(([,u])=>u===room.hostUid)?.[0];
    if(hostSid)io.to(hostSid).emit('game:request-start',payload);
  });
  socket.on('game:start',p=>{
    const roomId=String(p?.roomId||'').toUpperCase(),room=rooms.get(roomId);
    if(!room||!isMember(socket,roomId)||room.sockets.get(socket.id)!==room.hostUid)return socket.emit('room:error',{message:'Only room host can START'});
    if(room.users.size<2)return socket.emit('room:error',{message:'Need two players before START'});
    const payload={roomId,game:String(p?.game||room.type||'game'),hostUid:room.hostUid,startedAt:Date.now()};
    room.gameState=Object.assign({},room.gameState||{}, {started:true,startedAt:payload.startedAt,game:payload.game});
    io.to(roomId).emit('game:started',payload);
  });

  socket.on('music:event',state=>{const roomId=String(state?.roomId||'').toUpperCase(),room=rooms.get(roomId);if(!room||!isMember(socket,roomId)||room.sockets.get(socket.id)!==room.hostUid)return;const e={roomId,hostUid:room.hostUid,action:String(state.action||'state'),videoId:state.videoId||null,title:String(state.title||'').slice(0,300),ch:String(state.ch||'').slice(0,200),thumb:String(state.thumb||'').slice(0,1000),position:Math.max(0,Number(state.position)||0),playing:!!state.playing,serverAt:Date.now(),duration:Math.max(0,Number(state.duration)||0)};room.playback=e;socket.to(roomId).emit('music:event',e)});
  socket.on('music:request-state',p=>{const room=rooms.get(String(p?.roomId||'').toUpperCase());if(!room||!isMember(socket,room.roomId))return;const hostSid=[...room.sockets.entries()].find(([,u])=>u===room.hostUid)?.[0];if(hostSid)io.to(hostSid).emit('music:request-state',{roomId:room.roomId,requesterUid:p?.uid||null});if(room.playback)socket.emit('music:state',room.playback)});

  // Host-authoritative shared controls. Joiners never get to mutate room playback.
  socket.on('music:control',p=>{
    const roomId=String(p?.roomId||'').toUpperCase(),room=rooms.get(roomId);
    if(!room||!isMember(socket,roomId)||room.sockets.get(socket.id)!==room.hostUid)return;
    const action=String(p?.action||'');
    if(!['play','pause','seek','volume','mute','next'].includes(action))return;
    const current=room.playback||{};
    const e={
      roomId,hostUid:room.hostUid,action,
      videoId:p?.videoId??current.videoId??null,title:String(p?.title??current.title??'').slice(0,300),
      ch:String(p?.ch??current.ch??'').slice(0,200),thumb:String(p?.thumb??current.thumb??'').slice(0,1000),
      position:Math.max(0,Number(p?.position??current.position??0)||0),
      playing:action==='pause'?false:(action==='play'?true:!!current.playing),
      volume:Math.max(0,Math.min(1,Number(p?.volume??current.volume??0.8))),muted:!!(p?.muted??current.muted),
      serverAt:Date.now(),duration:Math.max(0,Number(p?.duration??current.duration??0)||0)
    };
    if(action!=='volume'&&action!=='mute')room.playback=Object.assign({},current,e);
    io.to(roomId).emit('music:control',e);
    if(action!=='volume'&&action!=='mute')io.to(roomId).emit('music:event',e);
  });

  // Memory Rush authoritative actions.
  socket.on('memory:start',p=>{const room=rooms.get(String(p?.roomId||'').toUpperCase());if(!room||!isMember(socket,room.roomId)||room.sockets.get(socket.id)!==room.hostUid||room.users.size<2)return socket.emit('room:error',{message:'Need two players before START'});room.memory={difficulty:['easy','medium','hard'].includes(p?.difficulty)?p.difficulty:'easy',round:0,scores:{},roundWins:{},picked:{}};seedMemory(room);makeMemoryRound(room);emitMemoryScores(room)});
  socket.on('memory:pick',p=>{const room=rooms.get(String(p?.roomId||'').toUpperCase()),uid=room?.sockets.get(socket.id);if(!room||!uid||!room.memory||Date.now()>room.memory.deadlineAt)return;const idx=Number(p?.index);if(!Number.isInteger(idx)||idx<0||idx>=room.memory.cards.length)return;const set=room.memory.picked[uid]||(room.memory.picked[uid]=new Set());if(set.has(idx))return;const correct=room.memory.cards[idx]===room.memory.targetId;if(correct)set.add(idx);const sid=socket.id;socket.emit('memory:feedback',{roomId:room.roomId,index:idx,correct});if(correct&&set.size===room.memory.cards.filter(x=>x===room.memory.targetId).length){room.memory.scores[uid]=(room.memory.scores[uid]||0)+1;room.memory.roundWins[uid]=(room.memory.roundWins[uid]||0)+1;emitMemoryScores(room);clearTimeout(room.memory.timeout);const winnerUid=uid;io.to(room.roomId).emit('memory:round-result',{roomId:room.roomId,winnerUid,roundWins:room.memory.roundWins,scores:room.memory.scores});setTimeout(()=>{if(rooms.has(room.roomId))makeMemoryRound(room)},800)}else if(correct)emitMemoryScores(room);});
  socket.on('memory:timeout',p=>{const room=rooms.get(String(p?.roomId||'').toUpperCase());if(!room||!room.memory)return;if(String(p?.roundId||'')!==String(room.memory.roundId||''))return;clearTimeout(room.memory.timeout);io.to(room.roomId).emit('memory:round-result',{roomId:room.roomId,winnerUid:null,roundWins:room.memory.roundWins||{},scores:room.memory.scores||{}});setTimeout(()=>{if(rooms.has(room.roomId))makeMemoryRound(room)},500)});

  // Mind Snap authoritative actions.
  socket.on('mind:start',p=>{const room=rooms.get(String(p?.roomId||'').toUpperCase());if(!room||!isMember(socket,room.roomId)||room.sockets.get(socket.id)!==room.hostUid||room.users.size<2)return socket.emit('room:error',{message:'Need two players before START'});const difficulty=['easy','medium','hard'].includes(p?.difficulty)?p.difficulty:'easy';room.mind={difficulty,puzzleNo:0,scores:{},solved:{},matchEndAt:Date.now()+60000};for(const uid of room.users.keys()){room.mind.scores[uid]=0;room.mind.solved[uid]=0}makeMindPuzzle(room)});
  socket.on('mind:tap',p=>{const room=rooms.get(String(p?.roomId||'').toUpperCase()),uid=room?.sockets.get(socket.id);if(!room||!uid||!room.mind||room.mind.finished||Date.now()>room.mind.matchEndAt||Number(p?.puzzleNo)!==room.mind.puzzleNo)return;const idx=Number(p?.index);if(!Number.isInteger(idx))return;const picked=room.mind.picked[uid]||(room.mind.picked[uid]=new Set());if(picked.has(idx))return;const good=room.mind.pattern.includes(idx);if(good)picked.add(idx);else room.mind.wrong[uid]=(room.mind.wrong[uid]||0)+1;socket.emit('mind:feedback',{roomId:room.roomId,index:idx,correct:good,score:Number(room.mind.scores[uid]||0),solved:Number(room.mind.solved[uid]||0),wrongStreak:Number(room.mind.wrong[uid]||0)});if(good&&picked.size===room.mind.pattern.length){room.mind.scores[uid]=(room.mind.scores[uid]||0)+1;room.mind.solved[uid]=(room.mind.solved[uid]||0)+1;for(const [sid,u] of room.sockets.entries())if(u!==uid)io.to(sid).emit('mind:opponent',{roomId:room.roomId,score:room.mind.scores[uid],solved:room.mind.solved[uid]});if(Date.now()<room.mind.matchEndAt)setTimeout(()=>{if(rooms.has(room.roomId)&&!room.mind.finished)makeMindPuzzle(room)},220)}else if(!good&&room.mind.wrong[uid]>=2){setTimeout(()=>{if(rooms.has(room.roomId)&&!room.mind.finished)makeMindPuzzle(room)},250)}});
  socket.on('mind:timeout',p=>{const room=rooms.get(String(p?.roomId||'').toUpperCase());if(!room||!room.mind||Number(p?.puzzleNo)!==room.mind.puzzleNo)return;if(Date.now()>=room.mind.matchEndAt)finishMind(room);else makeMindPuzzle(room)});

  socket.on('chat:message',m=>{const roomId=String(m?.roomId||'').toUpperCase(),room=rooms.get(roomId);if(!room||!isMember(socket,roomId))return;const uid=room.sockets.get(socket.id);socket.to(roomId).emit('chat:message',{roomId,uid,name:String(m?.name||'Guest').slice(0,60),photo:m?.photo?String(m.photo).slice(0,1000):null,text:String(m?.text||'').slice(0,2000),time:Date.now(),type:m?.type==='voice'?'voice':'text',audioData:m?.type==='voice'&&m?.audioData?String(m.audioData).slice(0,1500000):undefined})});

  socket.on('disconnect',()=>{const uid=socket.data.uid;if(uid&&online.has(uid)){online.get(uid).delete(socket.id);if(!online.get(uid).size)online.delete(uid)}const joined=socket.data.rooms?[...socket.data.rooms]:[];joined.forEach(r=>leaveRoom(socket,r,uid));});
});

function leaveRoom(socket,roomIdRaw,uidRaw){const roomId=String(roomIdRaw||'').toUpperCase(),room=rooms.get(roomId);if(!room)return;const uid=room.sockets.get(socket.id)||String(uidRaw||'');room.sockets.delete(socket.id);try{socket.leave(roomId)}catch(e){}if(uid&&!([...room.sockets.values()].includes(uid)))room.users.delete(uid);broadcastUsers(room);if(room.users.size<2){clearTimeout(room.memory?.timeout);clearTimeout(room.mind?.timeout)}removeEmpty(roomId)}

server.listen(PORT,()=>console.log(`SonicSync Socket.IO V9 running on port ${PORT}`));
