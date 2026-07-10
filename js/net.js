/* ============================================================
   宝可梦联盟 · 在线联机模块 (WebRTC P2P via PeerJS)
   主机(host)权威模拟 → 10Hz 状态快照;客机(guest)木偶世界 + 输入转发
   ============================================================ */
window.NET = (function(){
const PREFIX = 'poke-league-v1-';
const S = {
  role:'off',            // off | host | guest
  peer:null, conn:null,
  code:'', connected:false, started:false,
  myKey:null, peerKey:null,
  idCounter:1,
  byId:{},               // guest: netId -> unit
  outFloats:[], outCasts:[], outUi:[],
  snapT:0,
  lastMeSent:0,
  onLobby:null,          // UI回调
};

function send(obj){
  if (S.conn && S.conn.open){
    try{ S.conn.send(JSON.stringify(obj)); }catch(e){}
  }
}

/* ============================================================
   房间
   ============================================================ */
function randCode(){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i=0;i<4;i++) c += chars[Math.floor(Math.random()*chars.length)];
  return c;
}
function createRoom(onStatus){
  S.role = 'host';
  S.code = randCode();
  onStatus('正在连接联机服务...');
  const peer = new Peer(PREFIX+S.code, {debug:0});
  S.peer = peer;
  peer.on('open', ()=>onStatus('房间已创建,等待好友加入', S.code));
  peer.on('error', err=>{
    if (err.type==='unavailable-id'){ S.code = randCode(); }
    onStatus('联机服务错误: '+err.type);
  });
  peer.on('connection', c=>{
    if (S.conn){ c.close(); return; }
    S.conn = c;
    c.on('open', ()=>{
      S.connected = true;
      onStatus('好友已加入!', S.code);
      send({t:'hi', champ:S.myKey});
      if (S.onLobby) S.onLobby();
    });
    c.on('data', d=>handleHost(JSON.parse(d)));
    c.on('close', ()=>onPeerLost());
  });
}
function joinRoom(code, onStatus){
  S.role = 'guest';
  onStatus('正在连接联机服务...');
  const peer = new Peer({debug:0});
  S.peer = peer;
  peer.on('error', err=>onStatus('连接失败: '+(err.type==='peer-unavailable'?'房间不存在':err.type)));
  peer.on('open', ()=>{
    onStatus('正在加入房间...');
    const c = peer.connect(PREFIX+code.toUpperCase().trim(), {reliable:true});
    S.conn = c;
    c.on('open', ()=>{
      S.connected = true;
      onStatus('已加入房间!等待房主开始', code.toUpperCase());
      send({t:'hi', champ:S.myKey});
      if (S.onLobby) S.onLobby();
    });
    c.on('data', d=>handleGuest(JSON.parse(d)));
    c.on('close', ()=>onPeerLost());
  });
}
function pickChamp(key){
  S.myKey = key;
  if (S.connected) send({t:'hi', champ:key});
}
function onPeerLost(){
  S.connected = false;
  if (!S.started){ if (S.onLobby) S.onLobby(); return; }
  if (S.role==='host'){
    UI.announce('好友已断线,由AI接管', '#ff9080');
    const p2 = GAME.G.p2;
    if (p2){ p2.remote = false; AI.initBot(p2); }
    S.role = 'off';
  } else {
    UI.announce('与房主的连接已断开', '#ff9080');
    UI.msg('连接断开——请刷新页面重新联机');
  }
}

/* ============================================================
   主机:开局与逐帧同步
   ============================================================ */
function hostStart(hostKey, difficulty){
  const others = DATA.CHAMPS.filter(c=>c.key!==hostKey && c.key!==S.peerKey).map(c=>c.key);
  for (let i=others.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [others[i],others[j]]=[others[j],others[i]]; }
  const allies = others.slice(0,3);
  const enemies = others.slice(3,8);
  S.started = true;
  send({t:'start', host:hostKey, guest:S.peerKey, allies, enemies, difficulty});
  GAME.initRenderer();
  GAME.startGame(hostKey, allies, enemies, difficulty, {p2Key:S.peerKey});
}
function nid(u){
  if (!u.netId){ u.netId = 'u'+(S.idCounter++); }
  return u.netId;
}
function indexStructures(){
  const G = GAME.G;
  let i = 0;
  for (const t of G.towers) t.netId = 's'+(i++);
  for (const n of G.nexuses) n.netId = 's'+(i++);
}
function spawnMsg(u){
  const m = {t:'sp', id:u.netId, team:u.team, x:+u.pos.x.toFixed(1), z:+u.pos.z.toFixed(1)};
  if (u.kind==='champ'){
    m.k = 'c'; m.key = u.data.key;
    m.g = (u===GAME.G.p2)? 1 : 0;
  } else if (u.kind==='minion'){
    m.k = 'm'; m.mt = u.mtype; m.lane = u.lane;
  } else if (u.kind==='jungle'){
    m.k = 'j';
    for (const key of Object.keys(DATA.JUNGLE)) if (DATA.JUNGLE[key]===u.cfg) m.jk = key;
  }
  return m;
}
function hostTick(dt){
  if (!S.conn || !S.conn.open) return;
  S.snapT -= dt;
  if (S.snapT > 0) return;
  S.snapT = 0.1;
  const G = GAME.G;
  const all = G.champs.concat(G.minions, G.jungles, G.towers, G.nexuses);
  const rows = [];
  for (const u of all){
    // 新单位 → 发spawn
    if (!u.netId){
      if (u.kind==='tower'||u.kind==='nexus') continue;   // 结构由双方各自确定性生成
      nid(u);
      send(spawnMsg(u));
      u._sentDead = false;
    }
    // 生死事件
    if (u.dead && !u._sentDead){
      u._sentDead = true;
      send({t:'die', id:u.netId, my:(u===G.p2)?1:0});
    } else if (!u.dead && u._sentDead){
      u._sentDead = false;
      send({t:'resp', id:u.netId, x:+u.pos.x.toFixed(1), z:+u.pos.z.toFixed(1)});
    }
    if (u.dead) continue;
    rows.push([u.netId, +u.pos.x.toFixed(1), +u.pos.z.toFixed(1), Math.ceil(u.hp), Math.ceil(u.maxHp),
      +u.facing.toFixed(2), u.level||0, u.moving?1:0,
      (u.attackTarget && u.attackTarget.netId)? u.attackTarget.netId : 0,
      u.protected_?1:0, Math.round(u.shieldTotal())]);
  }
  // P2 的 HUD 数据
  const p2 = G.p2;
  let me = null;
  if (p2){
    me = {
      gold:Math.floor(p2.gold), mana:Math.floor(p2.mana), mm:Math.floor(p2.maxMana),
      lv:p2.level, xp:Math.floor(p2.xp), sp:p2.skillPoints,
      cds:p2.skills.map(s=>+s.cd.toFixed(1)), sls:p2.skills.map(s=>s.lvl),
      sd:+p2.summCd.D.toFixed(1), sf:+p2.summCd.F.toFixed(1),
      items:p2.items.map(i=>i.id),
      k:p2.kills, d:p2.deaths, a:p2.assists, cs:p2.cs,
      rt:+p2.respawnT.toFixed(1),
    };
  }
  send({t:'snap', clock:+G.clock.toFixed(1), kills:[G.teamStats.blue.kills, G.teamStats.red.kills],
    rows, me, fl:S.outFloats.splice(0,40), cs:S.outCasts.splice(0), ui:S.outUi.splice(0)});
}
/* 主机侧钩子 */
function onCast(unit, idx, aim, target, lvl){
  if (S.role!=='host' || !S.started) return;
  S.outCasts.push({id:nid(unit), i:idx, l:lvl, ax:+aim.x.toFixed(1), az:+aim.z.toFixed(1),
    tid:(target&&target.netId)||0});
}
function onFloat(unit, amt, type, crit){
  if (S.role!=='host' || !S.started || !unit.netId) return;
  if (S.outFloats.length < 40) S.outFloats.push([unit.netId, amt, type, crit?1:0]);
}
function onAnnounce(text, color){ if (S.role==='host'&&S.started) S.outUi.push({a:[text,color]}); }
function onKillFeed(killer, victim, assists){
  if (S.role==='host'&&S.started) S.outUi.push({kf:[killer?killer.netId:0, victim.netId]});
}
function onEnd(win){ if (S.role==='host'&&S.started) send({t:'end', win}); }

/* 主机:处理客机输入 */
function handleHost(m){
  if (m.t==='hi'){ S.peerKey = m.champ; if (S.onLobby) S.onLobby(); return; }
  const G = GAME.G;
  const p2 = G.p2;
  if (!p2 || p2.dead) { if (m.t==='addbot') doAddBot(m); return; }
  const unitById = id=>{
    const all = G.champs.concat(G.minions, G.jungles, G.towers, G.nexuses);
    return all.find(u=>u.netId===id && !u.dead);
  };
  switch(m.t){
    case 'mv': p2.attackTarget = null; p2.moveTo({x:m.x, z:m.z}); break;
    case 'atk': { const u = unitById(m.tid); if (u){ p2.attackTarget = u; p2.moveTarget = null; } break; }
    case 'stop': p2.attackTarget = null; p2.moveTarget = null; break;
    case 'cast': {
      const t = m.tid? unitById(m.tid) : null;
      GAME.castSkill(p2, m.i, new THREE.Vector3(m.ax, 0, m.az), t);
      break;
    }
    case 'lvl': p2.levelSkill(m.i); break;
    case 'summ': GAME.castSummoner(p2, m.k, m.ax!=null? new THREE.Vector3(m.ax,0,m.az):null); break;
    case 'recall': GAME.startRecall(p2); break;
    case 'buy': GAME.buyItem(p2, m.id); break;
    case 'addbot': doAddBot(m); break;
  }
}
function doAddBot(m){ GAME.addBot(m.key, m.team); }

/* ============================================================
   客机:木偶世界
   ============================================================ */
function handleGuest(m){
  switch(m.t){
    case 'hi': S.peerKey = m.champ; if (S.onLobby) S.onLobby(); break;
    case 'start': guestStart(m); break;
    case 'sp': spawnPuppet(m); break;
    case 'die': puppetKill(m); break;
    case 'resp': puppetRespawn(m); break;
    case 'snap': applySnap(m); break;
    case 'end': G_end(m.win); break;
  }
}
function guestStart(m){
  S.started = true;
  document.getElementById('screen-select').style.display = 'none';
  GAME.initRenderer();
  GAME.startGuest(m);
  // 结构确定性生成后编号(与主机一致的创建顺序)
  const G = GAME.G;
  let i = 0;
  for (const t of G.towers){ t.netId = 's'+(i++); S.byId[t.netId] = t; }
  for (const n of G.nexuses){ n.netId = 's'+(i++); S.byId[n.netId] = n; }
}
function spawnPuppet(m){
  const G = GAME.G;
  let u = null;
  if (m.k==='c'){
    const data = DATA.CHAMPS.find(c=>c.key===m.key);
    u = new ENT.Champion(data, m.team, m.g===1, {x:m.x, z:m.z, laneIdx:1});
    u.remotePuppet = true;
    u.buildModel(G.scene);
    G.champs.push(u);
    if (m.g===1){
      G.player = u;
      UI.onGameStart();
      AUDIO.startMusic();
      UI.announce('联机对战开始!协力摧毁敌方大师球!', '#ffd94a');
    }
    AUDIO.playCry(data.id, 0.2);
  } else if (m.k==='m'){
    u = new ENT.Minion(m.mt, m.team, m.lane||0, 1);
    u.pos.set(m.x, 0, m.z);
    u.buildModel(G.scene, m.team==='blue'? 0x2244aa : 0xaa2222);
    G.minions.push(u);
  } else if (m.k==='j'){
    const cfg = DATA.JUNGLE[m.jk];
    if (!cfg) return;
    u = new ENT.JungleMonster(cfg, null, m.x, m.z);
    u.buildModel(G.scene);
    u.hoverY = (cfg===DATA.JUNGLE.dragon)? 1.5 : 0;
    G.jungles.push(u);
  }
  if (u){ u.netId = m.id; u.netPos = new THREE.Vector3(m.x,0,m.z); S.byId[m.id] = u; }
}
function puppetKill(m){
  const u = S.byId[m.id];
  if (!u || u.dead) return;
  u.dead = true;
  u.attackTarget = null;
  FX.deathPoof(u.pos, u.projColor);
  if (u.kind==='tower'){
    FX.explosion(u.pos, {color:0xffc060, radius:16, count:36, size:3});
    AUDIO.play('towerDown');
  } else if (u.kind==='nexus'){
    FX.explosion(u.pos, {color:0xb080ff, radius:26, count:60, size:4});
  } else if (u.pokeId && u.kind!=='minion'){
    AUDIO.playCry(u.pokeId, 0.3);
  }
  u.removeModel();
  if (u.isPlayer){ AUDIO.play('death'); UI.showDeath(u); }
  // 小兵/野怪从数组清理
  const G = GAME.G;
  if (u.kind==='minion') G.minions = G.minions.filter(x=>x!==u);
  if (u.kind==='jungle') G.jungles = G.jungles.filter(x=>x!==u);
  if (u.kind!=='champ') delete S.byId[m.id];
}
function puppetRespawn(m){
  const u = S.byId[m.id];
  if (!u) return;
  u.dead = false;
  u.hp = u.maxHp;
  u.pos.set(m.x, 0, m.z);
  u.netPos = new THREE.Vector3(m.x, 0, m.z);
  u.buildModel(GAME.G.scene);
  FX.burst(u.pos, {count:18, tex:'star', color:0x9ecfff, size:1.8, speed:6, up:1.5, life:0.7});
  if (u.isPlayer){ UI.hideDeath(); UI.refreshHud(); }
}
function applySnap(m){
  const G = GAME.G;
  G.clock = m.clock;
  G.teamStats.blue.kills = m.kills[0];
  G.teamStats.red.kills = m.kills[1];
  for (const r of m.rows){
    const u = S.byId[r[0]];
    if (!u || u.dead) continue;
    if (!u.netPos) u.netPos = new THREE.Vector3();
    u.netPos.set(r[1], 0, r[2]);
    if (u.pos.distanceTo(u.netPos) > 22) u.pos.copy(u.netPos);   // 传送/闪现直接贴齐
    if (u.hp !== r[3] || u.maxHp !== r[4] || u.level !== r[6] || u.netShield !== r[10]){
      u.hp = r[3]; u.maxHp = r[4];
      if (u.kind==='champ') u.level = r[6];
      u.netShield = r[10];
      u.shields = r[10]>0? [{amt:r[10], dur:99, t:0}] : [];
      u.markBar();
    }
    u.netFacing = r[5];
    u.netMoving = r[7]===1;
    u.attackTarget = r[8]? (S.byId[r[8]]||null) : null;
    u.protected_ = r[9]===1;
  }
  // 我的HUD数据
  const P = G.player;
  if (P && m.me){
    const me = m.me;
    P.gold = me.gold; P.mana = me.mana; P.maxMana = me.mm;
    P.level = me.lv; P.xp = me.xp; P.skillPoints = me.sp;
    P.skills.forEach((s,i)=>{ s.cd = me.cds[i]; s.lvl = me.sls[i]; });
    P.summCd.D = me.sd; P.summCd.F = me.sf;
    P.kills = me.k; P.deaths = me.d; P.assists = me.a; P.cs = me.cs;
    P.respawnT = me.rt;
    if (P._itemSig !== me.items.join(',')){
      P._itemSig = me.items.join(',');
      P.items = me.items.map(id=>DATA.ITEMS.find(x=>x.id===id)).filter(Boolean);
      UI.refreshHud(); UI.refreshShop();
    }
  }
  // 伤害飘字
  for (const f of (m.fl||[])){
    const u = S.byId[f[0]];
    if (u && !u.dead) UI.floatDmg(u, f[1], f[2], f[3]===1);
  }
  // 技能施放(特效重演)
  for (const c of (m.cs||[])){
    const u = S.byId[c.id];
    if (!u || u.dead) continue;
    const t = c.tid? S.byId[c.tid] : null;
    GAME.netCast(u, c.i, c.l, new THREE.Vector3(c.ax, 0, c.az), t);
  }
  // UI事件
  for (const e of (m.ui||[])){
    if (e.a) UI.announce(e.a[0], e.a[1]);
    if (e.kf){
      const k = S.byId[e.kf[0]], v = S.byId[e.kf[1]];
      if (v && v.kind==='champ') UI.killFeed(k&&k.kind==='champ'?k:null, v, []);
    }
  }
}
function G_end(win){
  GAME.G.running = false;
  AUDIO.stopMusic();
  AUDIO.play(win? 'victory':'defeat');
  setTimeout(()=>UI.showEnd(win), 1200);
}

/* 客机输入转发 */
function gInput(m){ send(m); }

/* 主机侧UI钩子安装 */
function installHostHooks(){
  const _fd = UI.floatDmg, _an = UI.announce, _kf = UI.killFeed, _se = UI.showEnd;
  UI.floatDmg = function(u, amt, type, crit, src){ onFloat(u, amt, type, crit); return _fd(u, amt, type, crit, src); };
  UI.announce = function(t, c){ onAnnounce(t, c); return _an(t, c); };
  UI.killFeed = function(k, v, a){ onKillFeed(k, v, a); return _kf(k, v, a); };
  UI.showEnd = function(win){ onEnd(win); return _se(win); };
}

return {
  get role(){ return S.role; },
  get connected(){ return S.connected; },
  get started(){ return S.started; },
  get code(){ return S.code; },
  get peerKey(){ return S.peerKey; },
  set onLobby(fn){ S.onLobby = fn; },
  createRoom, joinRoom, pickChamp, hostStart, hostTick, indexStructures,
  onCast, gInput, installHostHooks,
};
})();
