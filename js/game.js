/* ============================================================
   宝可梦联盟 · 主逻辑
   地图 / 技能系统 / 小兵 / 防御塔 / 野怪 / 经济 / 输入 / 主循环
   ============================================================ */
window.GAME = (function(){
const {CONST} = DATA;
const V3 = (x,y,z)=>new THREE.Vector3(x,y,z);

/* ---------- 全局状态 ---------- */
const G = {
  scene:null, camera:null, renderer:null,
  clock:0, running:false, over:false,
  champs:[], minions:[], towers:[], nexuses:[], jungles:[],
  timers:[],
  waveN:0, waveT:CONST.FIRST_WAVE,
  player:null,
  camFollow:true, camDist:95, camPos:new THREE.Vector3(),
  mouse:{x:0,y:0, ground:new THREE.Vector3()},
  attackMove:false,
  ray:new THREE.Raycaster(), groundPlane:new THREE.Plane(V3(0,1,0),0),
  teamStats:{blue:{kills:0, dragon:0}, red:{kills:0, dragon:0}},
  jungleSpawns:[],
  firstBlood:false,
  fountain:{blue:V3(-108,0,108), red:V3(108,0,-108)},
  edgePan:{x:0,z:0},
};

const LANES = {
  blue:[
    [V3(-98,0,75), V3(-98,0,-65), V3(-65,0,-98), V3(85,0,-98)],
    [V3(-75,0,75), V3(0,0,0), V3(80,0,-80)],
    [V3(-75,0,98), V3(65,0,98), V3(98,0,65), V3(98,0,-85)],
  ],
};
LANES.red = LANES.blue.map(l=>l.slice().reverse().map(v=>v.clone().multiplyScalar(-1)).reverse());
// 上面双重反转有误,直接构造:红方路径 = 蓝方路径逐点取反再反序
LANES.red = LANES.blue.map(lane => lane.map(v=>v.clone().negate()).reverse());

const TOWER_POS = { // 蓝方,红方镜像
  lanes:[
    {outer:[-98,-25], inner:[-98,45]},
    {outer:[-35,35],  inner:[-62,62]},
    {outer:[25,98],   inner:[-45,98]},
  ],
  nexus:[-86,86],
};

function enemyOf(team){ return team==='blue'? 'red':'blue'; }
function allUnits(){ return G.champs.concat(G.minions, G.towers, G.nexuses, G.jungles); }
function unitsNear(pos, r, filter){
  const out = [];
  for (const u of allUnits()){
    if (u.dead) continue;
    const dx = u.pos.x-pos.x, dz = u.pos.z-pos.z;
    if (dx*dx+dz*dz <= r*r && (!filter || filter(u))) out.push(u);
  }
  return out;
}
function champsOf(team){ return G.champs.filter(c=>c.team===team); }
function towersOf(team){ return G.towers.filter(t=>t.team===team); }
function nexusOf(team){ return G.nexuses.find(n=>n.team===team); }
function after(t, fn){ G.timers.push({t:G.clock+t, fn}); }

/* ============================================================
   地图构建
   ============================================================ */
function buildGroundTexture(){
  const S = 2048, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const w2m = S/(CONST.MAP_HALF*2);      // world->px
  const px = (x)=> (x+CONST.MAP_HALF)*w2m;
  // 草地底色
  g.fillStyle = '#3d8b45'; g.fillRect(0,0,S,S);
  // 噪点草丛
  for (let i=0;i<6500;i++){
    const x = Math.random()*S, y = Math.random()*S;
    g.fillStyle = `rgba(${30+Math.random()*40|0},${110+Math.random()*60|0},${40+Math.random()*30|0},0.35)`;
    g.beginPath(); g.arc(x,y,3+Math.random()*13,0,7); g.fill();
  }
  // 深色林地斑块
  for (let i=0;i<150;i++){
    const x = Math.random()*S, y = Math.random()*S;
    g.fillStyle = `rgba(20,${70+Math.random()*30|0},30,0.22)`;
    g.beginPath(); g.ellipse(x,y,26+Math.random()*70,20+Math.random()*50,Math.random()*3,0,7); g.fill();
  }
  // 小花点缀
  const petalCols = ['#ffd0da','#fff3b0','#ffc8ee','#ffffff','#cfe4ff','#ffdcb0'];
  for (let i=0;i<1600;i++){
    const x = Math.random()*S, y = Math.random()*S;
    g.fillStyle = petalCols[i%petalCols.length];
    g.globalAlpha = 0.5+Math.random()*0.4;
    g.beginPath(); g.arc(x,y,1.6+Math.random()*2.6,0,7); g.fill();
  }
  g.globalAlpha = 1;
  // 半场色调
  g.fillStyle = 'rgba(60,110,220,0.05)';
  g.beginPath(); g.moveTo(0,S); g.lineTo(0,0); g.lineTo(S,S); g.closePath(); g.fill();
  g.fillStyle = 'rgba(220,70,60,0.05)';
  g.beginPath(); g.moveTo(S,0); g.lineTo(0,0); g.lineTo(S,S); g.closePath(); g.fill();
  // 河道 (x=z 对角线): 先铺沙滩再铺水
  g.strokeStyle = '#d8c890'; g.lineWidth = 30*w2m; g.lineCap='round';
  g.beginPath(); g.moveTo(px(-106), px(-106)); g.lineTo(px(106), px(106)); g.stroke();
  g.strokeStyle = '#4d9fd8'; g.lineWidth = 20*w2m;
  g.beginPath(); g.moveTo(px(-104), px(-104)); g.lineTo(px(104), px(104)); g.stroke();
  g.strokeStyle = 'rgba(160,220,255,0.5)'; g.lineWidth = 14*w2m;
  g.beginPath(); g.moveTo(px(-104), px(-104)); g.lineTo(px(104), px(104)); g.stroke();
  // 车道路径
  function lanePath(pts, wWorld, color){
    g.strokeStyle = color; g.lineWidth = wWorld*w2m; g.lineJoin='round'; g.lineCap='round';
    g.beginPath();
    pts.forEach((p,i)=> g[i?'lineTo':'moveTo'](px(p.x), px(p.z)));
    g.stroke();
  }
  for (const lane of LANES.blue){
    const full = [V3(-97,0,97), ...lane, V3(97,0,-97)];
    lanePath(full, 15, '#b89b5e');
    lanePath(full, 11, '#cbb27a');
  }
  // 基地地台
  for (const [cx,cz,c1] of [[-97,97,'#3a6cd8'],[97,-97,'#d84040']]){
    g.fillStyle = c1+'55';
    g.beginPath(); g.arc(px(cx),px(cz), 30*w2m, 0, 7); g.fill();
    g.strokeStyle = c1; g.lineWidth = 4;
    g.beginPath(); g.arc(px(cx),px(cz), 30*w2m, 0, 7); g.stroke();
  }
  // 泉水
  for (const [cx,cz,c] of [[-108,108,'#6ab0ff'],[108,-108,'#ff8a7a']]){
    g.fillStyle = c;
    g.beginPath(); g.arc(px(cx),px(cz), 12*w2m, 0, 7); g.fill();
  }
  // 野怪营地标记
  for (const [cx,cz,c] of [[-60,-10,'#4aa0f0'],[-10,60,'#ff5040'],[60,10,'#4aa0f0'],[10,-60,'#ff5040'],[-45,-45,'#b060f8'],[45,45,'#f8a030']]){
    g.fillStyle = c+'44';
    g.beginPath(); g.arc(px(cx),px(cz), 9*w2m, 0, 7); g.fill();
  }
  // 精灵球中圈装饰(河道中央)
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
  g.beginPath(); g.arc(S/2,S/2, 10*w2m, 0, 7); g.stroke();
  g.beginPath(); g.arc(S/2,S/2, 3*w2m, 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  return {tex:t, canvas:cv};
}

function buildMap(){
  const {tex, canvas} = buildGroundTexture();
  G.mapCanvas = canvas;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CONST.MAP_HALF*2, CONST.MAP_HALF*2),
    new THREE.MeshLambertMaterial({map:tex}));
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  G.scene.add(ground);
  // 外围墙体
  const wallMat = new THREE.MeshLambertMaterial({color:0x2e5e38});
  for (const [x,z,w,d] of [[0,-124,260,8],[0,124,260,8],[-124,0,8,260],[124,0,8,260]]){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,10,d), wallMat);
    m.position.set(x,5,z);
    G.scene.add(m);
  }
  // 树木岩石装饰(高精度程序化模型)
  let placed = 0, guard = 0;
  const spots = [];
  while (placed < 46 && guard++ < 900){
    const x = (Math.random()*2-1)*92, z = (Math.random()*2-1)*92;
    if (Math.abs(x+z) < 16) continue;             // 中路
    if (Math.abs(x-z) < 16) continue;             // 河道
    if (Math.abs(x) > 84 || Math.abs(z) > 84) continue; // 边路
    let bad = false;
    for (const [cx,cz] of [[-60,-10],[-10,60],[60,10],[10,-60],[-45,-45],[45,45],[-97,97],[97,-97]])
      if (Math.hypot(x-cx,z-cz) < 14){ bad = true; break; }
    for (const s of spots) if (Math.hypot(x-s[0],z-s[1]) < 9){ bad = true; break; }
    if (bad) continue;
    spots.push([x,z]);
    const roll = Math.random();
    const kind = roll<0.24? 'rock' : roll<0.5? 'pine' : roll<0.62? 'sakura' : 'oak';
    const h = kind==='rock'? 3+Math.random()*2 : 8+Math.random()*5;
    const prop = SCENERY.makeProp(kind, h);
    prop.position.set(x,0,z);
    prop.rotation.y = Math.random()*7;
    G.scene.add(prop);
    placed++;
  }
}

/* 环境模型也走缓存:tree/pine/rock 以字符串id存 */

function buildStructures(){
  for (const team of ['blue','red']){
    const mir = team==='blue'? 1 : -1;
    TOWER_POS.lanes.forEach((L, laneIdx)=>{
      for (const tier of ['outer','inner']){
        const [x,z] = L[tier];
        const t = new ENT.Tower(tier, team, x*mir, z*mir, laneIdx);
        t.buildModel(G.scene);
        G.towers.push(t);
      }
    });
    const [nx,nz] = TOWER_POS.nexus;
    const nt = new ENT.Tower('nexus', team, nx*mir, nz*mir, -1);
    nt.buildModel(G.scene); G.towers.push(nt);
    const nex = new ENT.Nexus(team, 97*(team==='blue'?-1:1), 97*(team==='blue'?1:-1));
    nex.buildModel(G.scene); G.nexuses.push(nex);
    // 泉水水晶
    const f = G.fountain[team];
    const cry = new THREE.Mesh(new THREE.OctahedronGeometry(3.4),
      new THREE.MeshLambertMaterial({color: team==='blue'?0x66aaff:0xff7766, emissive:team==='blue'?0x223a66:0x662222}));
    cry.position.set(f.x, 5, f.z);
    G.scene.add(cry);
    (team==='blue'? G:G).crystal = cry;
  }
}

function updateTowerProtection(){
  for (const team of ['blue','red']){
    const ts = towersOf(team);
    let anyInnerDown = false;
    for (let lane=0; lane<3; lane++){
      const outer = ts.find(t=>t.lane===lane && t.tier==='outer');
      const inner = ts.find(t=>t.lane===lane && t.tier==='inner');
      if (inner) inner.protected_ = !(outer && outer.dead) && !!outer;
      if (inner && inner.dead) anyInnerDown = true;
    }
    const nexusT = ts.find(t=>t.tier==='nexus');
    if (nexusT) nexusT.protected_ = !anyInnerDown;
    const nex = nexusOf(team);
    if (nex) nex.protected_ = !(nexusT && nexusT.dead);
  }
}

/* ============================================================
   小兵
   ============================================================ */
function spawnWave(){
  G.waveN++;
  for (const team of ['blue','red']){
    if (G.minions.filter(m=>m.team===team && !m.dead).length > 70) continue;
    const nex = nexusOf(team);
    if (!nex || nex.dead) continue;
    for (let lane=0; lane<3; lane++){
      const comp = ['melee','melee','melee','ranged','ranged','ranged'];
      if (G.waveN % CONST.CANNON_EVERY === 0) comp.push('cannon');
      comp.forEach((mt,i)=>{
        after(i*0.7, ()=>{
          const wp0 = LANES[team][lane][0];
          const m = new ENT.Minion(mt, team, lane, G.waveN);
          m.pos.set(nex.pos.x + (Math.random()-0.5)*4, 0, nex.pos.z + (Math.random()-0.5)*4);
          m.buildModel(G.scene, team==='blue'? 0x2244aa : 0xaa2222);
          m.moveTo(wp0);
          G.minions.push(m);
        });
      });
    }
  }
}

function minionAI(m){
  if (m.dead) return;
  // 现有目标校验
  if (m.attackTarget && (m.attackTarget.dead || m.distTo(m.attackTarget) > 34 || m.attackTarget.stealthed))
    m.attackTarget = null;
  if (!m.attackTarget){
    // 找目标:优先小兵/塔,近距离英雄
    const foes = unitsNear(m.pos, 20, u=>u.team===enemyOf(m.team) && !u.dead && !u.stealthed && !u.protected_);
    let best = null, bd = 1e9;
    for (const u of foes){
      let pri = u.kind==='minion'? 0 : u.kind==='tower'||u.kind==='nexus'? 1 : 2;
      const d = m.distTo(u) + pri*12;
      if (d < bd){ bd = d; best = u; }
    }
    if (best) m.attackTarget = best;
  }
  if (!m.attackTarget){
    // 沿路推进
    const wps = LANES[m.team][m.lane];
    if (m.wpIdx >= wps.length) m.wpIdx = wps.length-1;
    let wp = wps[m.wpIdx];
    while (m.wpIdx < wps.length-1 && Math.hypot(m.pos.x-wp.x, m.pos.z-wp.z) < 7){
      m.wpIdx++; wp = wps[m.wpIdx];
    }
    // 终点:敌方基地
    if (m.wpIdx === wps.length-1 && Math.hypot(m.pos.x-wp.x, m.pos.z-wp.z) < 7){
      const nex = nexusOf(enemyOf(m.team));
      if (nex && !nex.dead && !nex.protected_) m.attackTarget = nex;
    }
    if (!m.attackTarget) m.moveTo(wp);
  }
}

/* ============================================================
   防御塔索敌
   ============================================================ */
function towerAI(t){
  if (t.dead) return;
  const foes = unitsNear(t.pos, t.baseRange, u=>u.team===enemyOf(t.team) && !u.dead && !u.stealthed && (u.kind==='minion'||u.kind==='champ'));
  // 仇恨英雄优先
  let target = null;
  if (t.heatTarget && !t.heatTarget.dead && t.distTo(t.heatTarget)<=t.baseRange && t.heat>0) target = t.heatTarget;
  if (!target){
    const minions = foes.filter(u=>u.kind==='minion');
    if (minions.length){ minions.sort((a,b)=>t.distTo(a)-t.distTo(b)); target = minions[0]; }
    else if (foes.length){ foes.sort((a,b)=>t.distTo(a)-t.distTo(b)); target = foes[0]; }
  }
  if (target){
    if (t.curTarget !== target){ t.curTarget = target; t.ramp = 0; }
    else if (target.kind==='champ') t.ramp = Math.min(1.2, (t.ramp||0)+0.18);
    if (t.atkCdT <= 0) t.fireAt(target);
  } else t.curTarget = null;
}
function onChampCombat(victim, attacker){
  victim.lastCombatT = G.clock;
  // 塔保护:在塔范围内攻击敌方英雄 → 塔转火
  for (const t of towersOf(victim.team)){
    if (!t.dead && t.distTo(attacker) <= t.baseRange){
      t.heatTarget = attacker; t.heat = 3;
    }
  }
}

/* ============================================================
   野怪
   ============================================================ */
function setupJungle(){
  const J = DATA.JUNGLE;
  G.jungleSpawns = [
    {cfg:J.bluebuff, x:-60, z:-10, nextT:CONST.BUFF_SPAWN, respawn:CONST.BUFF_RESPAWN, unit:null},
    {cfg:J.redbuff,  x:-10, z:60,  nextT:CONST.BUFF_SPAWN, respawn:CONST.BUFF_RESPAWN, unit:null},
    {cfg:J.bluebuff, x:60,  z:10,  nextT:CONST.BUFF_SPAWN, respawn:CONST.BUFF_RESPAWN, unit:null},
    {cfg:J.redbuff,  x:10,  z:-60, nextT:CONST.BUFF_SPAWN, respawn:CONST.BUFF_RESPAWN, unit:null},
    {cfg:J.dragon,   x:45,  z:45,  nextT:CONST.DRAGON_SPAWN, respawn:CONST.DRAGON_RESPAWN, unit:null},
    {cfg:J.baron,    x:-45, z:-45, nextT:CONST.BARON_SPAWN, respawn:99999, unit:null},
  ];
}
function jungleTick(){
  for (const s of G.jungleSpawns){
    if (s.unit && !s.unit.dead) continue;
    if (G.clock >= s.nextT){
      const u = new ENT.JungleMonster(s.cfg, s, s.x, s.z);
      u.buildModel(G.scene);
      u.hoverY = s.cfg===DATA.JUNGLE.dragon? 1.5 : 0;
      G.jungles.push(u);
      s.unit = u;
      s.nextT = Infinity;
      if (s.cfg === DATA.JUNGLE.baron) UI.announce('远古大岩蛇 出现在了上方河道!', '#b060f8');
      if (s.cfg === DATA.JUNGLE.dragon) UI.announce('狂暴暴鲤龙 出现在了下方河道!', '#f8a030');
    }
  }
}

/* ============================================================
   击杀 / 经济 / 经验
   ============================================================ */
function grantKillRewards(unit, killer){
  const killerChamp = killer && killer.kind==='champ'? killer : null;
  // 经验分享
  if (unit.xpReward){
    const team = killer? killer.team : enemyOf(unit.team);
    if (team==='blue'||team==='red'){
      const sharers = champsOf(team).filter(c=>!c.dead && c.distTo(unit) < CONST.XP_RANGE);
      const xp = unit.xpReward/Math.max(1,sharers.length)*(sharers.length>1?1.3:1);
      sharers.forEach(c=>c.addXp(xp));
      if (killerChamp && !sharers.includes(killerChamp)) killerChamp.addXp(unit.xpReward*0.6);
    }
  }
  if (killerChamp && unit.goldReward){
    killerChamp.addGold(unit.goldReward);
    if (unit.kind==='minion' || unit.kind==='jungle'){
      killerChamp.cs++;
      if (killerChamp.isPlayer) UI.refreshHud();
    }
  }
}

function onUnitDeath(unit, killer){
  grantKillRewards(unit, killer);
  const killerChamp = killer && killer.kind==='champ'? killer : null;

  if (unit.kind==='champ'){
    G.teamStats[enemyOf(unit.team)].kills++;
    // 击杀信用
    let credit = killerChamp;
    if (!credit){
      // 塔/兵补刀:最近伤害的英雄
      let bestT = -1;
      for (const [uid,t] of unit.aggroList){
        if (t > bestT){ const c = G.champs.find(x=>x.uid===uid && x.team!==unit.team); if (c){ bestT=t; credit=c; } }
      }
    }
    const goldBase = CONST.KILL_GOLD + Math.min(400, (unit.killStreak||0)*60);
    if (credit){
      credit.kills++;
      credit.killStreak = (credit.killStreak||0)+1;
      credit.addGold(goldBase);
      credit.addXp(CONST.KILL_XP + unit.level*12);
      // 连杀窗口
      const nw = G.clock;
      if (nw - (credit.multiT||-99) < 11) credit.multiN++;
      else credit.multiN = 1;
      credit.multiT = nw;
    }
    // 助攻
    const assists = [];
    for (const [uid, t] of unit.aggroList){
      if (G.clock - t < 10){
        const c = G.champs.find(x=>x.uid===uid);
        if (c && c!==credit && c.team!==unit.team){ c.assists++; c.addGold(CONST.ASSIST_GOLD); assists.push(c); }
      }
    }
    unit.killStreak = 0;
    unit.aggroList.clear();
    UI.killFeed(credit, unit, assists);
    if (!G.firstBlood && credit){ G.firstBlood = true; UI.announce('一血! '+credit.name+' 拿下首杀!', '#ffd94a'); AUDIO.play('kill'); }
    else if (credit){
      const mk = ['','','双杀!','三杀!','四杀!','五杀!!'][Math.min(5,credit.multiN)];
      if (credit.multiN>=2) UI.announce(credit.name+' '+mk, '#ff9040');
      else if (credit.killStreak===3) UI.announce(credit.name+' 正在大杀特杀!', '#ff9040');
      else if (credit.killStreak>=5) UI.announce(credit.name+' 已经超神!', '#ff5040');
      AUDIO.play('kill');
    }
    if (unit.isPlayer){ AUDIO.play('death'); UI.showDeath(unit); }
    // 团灭
    if (champsOf(unit.team).every(c=>c.dead))
      UI.announce((unit.team===playerTeam()? '我方':'敌方')+'团灭!', unit.team===playerTeam()? '#ff5040':'#ffd94a');
    UI.refreshHud(); UI.refreshScoreboard();
  }
  else if (unit.kind==='tower'){
    updateTowerProtection();
    champsOf(enemyOf(unit.team)).forEach(c=>c.addGold(DATA.TOWERS.teamGold));
    UI.announce((unit.team===playerTeam()? '我方':'敌方')+unit.name.slice(2)+' 被摧毁!', unit.team===playerTeam()? '#ff7060':'#ffd94a');
  }
  else if (unit.kind==='jungle'){
    const cfg = unit.cfg;
    if (unit.camp) unit.camp.nextT = G.clock + unit.camp.respawn;
    if (killerChamp){
      if (cfg.buff){
        const b = cfg.buff;
        killerChamp.addBuff({id:'jbuff_'+b.name, name:b.name, dur:b.dur,
          stats:{cdr:b.cdr||0, atk:b.atk||0, sp:b.sp||0, mpregen:b.mpregen||0},
          onhitBurn:b.onhitBurn||0, onhitSlowPct:b.onhitSlow||0, hpPerSec:b.hpregen||0});
        FX.aura(killerChamp, {color:b.color, dur:3});
        if (cfg===DATA.JUNGLE.baron){
          champsOf(killerChamp.team).forEach(c=>{ if (!c.dead && c!==killerChamp)
            c.addBuff({id:'baron', name:b.name, dur:b.dur, stats:{atk:b.atk, sp:b.sp}, hpPerSec:b.hpregen}); });
          UI.announce((killerChamp.team===playerTeam()?'我方':'敌方')+'击杀了远古大岩蛇!', '#b060f8');
          AUDIO.play('announce');
        }
      }
      if (cfg.stack){
        G.teamStats[killerChamp.team].dragon++;
        champsOf(killerChamp.team).forEach(c=>
          c.addBuff({id:'dragon'+G.teamStats[killerChamp.team].dragon, name:cfg.stack.name, dur:1e9, dmgAmp:cfg.stack.dmgAmp}));
        UI.announce((killerChamp.team===playerTeam()?'我方':'敌方')+'击杀了暴鲤龙! (全队伤害+5%)', '#f8a030');
        AUDIO.play('announce');
      }
      if (cfg.teamGold) champsOf(killerChamp.team).forEach(c=>c.addGold(cfg.teamGold));
    }
  }
}

function onNexusDestroyed(nexus){
  if (G.over) return;
  G.over = true; G.running = false;
  const win = nexus.team !== playerTeam();
  AUDIO.stopMusic();
  AUDIO.play(win? 'victory':'defeat');
  setTimeout(()=>UI.showEnd(win), 1200);
}

/* ============================================================
   技能系统
   ============================================================ */
function skillVal(arr, lvl){
  if (!Array.isArray(arr)) return arr;
  return arr[Math.min(lvl, arr.length-1)];
}
/* 大招级打击反馈:综合冲击特效+镜头震动+顿帧 */
function bigHit(pos, color, radius){
  FX.ultImpact(pos, {color, radius:radius||16});
  G.shake = Math.max(G.shake||0, 1.15);
  G.hitstop = 0.11;
  AUDIO.play('explosion');
}
function skillDmg(unit, def, lvl){
  return skillVal(def.dmg, lvl) + (def.ratio||0)*unit.powerStat();
}
function dmgType(unit){ return unit.atkType==='special'? 'spec':'phys'; }
function typeColor(def){ return parseInt((DATA.TYPE_COLOR[def.type]||'#ffffff').slice(1),16); }

function applyCC(target, def, src, lvl){
  if (!target || target.dead || target.kind==='tower' || target.kind==='nexus') return;
  if (def.slow) target.addBuff({id:'slow'+src.uid+def.key, name:'减速', dur:def.slow.dur, slowPct:def.slow.pct});
  if (def.stun) target.addBuff({name:'眩晕', dur:skillVal(def.stun,lvl), stun:true});
  if (def.root) target.addBuff({name:'定身', dur:skillVal(def.root,lvl), root:true});
  if (def.charm) target.addBuff({name:'魅惑', dur:def.charm, charm:true, src});
  if (def.silence) target.addBuff({name:'沉默', dur:def.silence, silence:true});
  if (def.knockup){
    target.addBuff({name:'击飞', dur:def.knockup, knockup:true, stun:true});
    target.knock = null;
  }
  if (def.stun||def.root||def.knockup) FX.burst(target.pos, {count:6, tex:'star', color:0xffe97a, size:1.2, speed:4, up:1.5, life:0.5, yOff:target.height+1});
  if (def.pattern==='aoe' && def.stun && def.vfx==='hypnosis')
    FX.burst(target.pos, {count:4, tex:'zzz', color:0xd0b0ff, size:2, speed:1.5, up:2, life:1.2, yOff:target.height+1});
}

function hitEnemiesInCircle(unit, center, radius, dmg, def, lvl){
  const foes = unitsNear(center, radius, u=>u.team!==unit.team && u.team!==('neutral'===unit.team?'x':undefined) && !u.dead);
  const list = foes.filter(u=>u.team===enemyOf(unit.team)||u.team==='neutral');
  for (const f of list){
    if (f.kind==='nexus'||f.kind==='tower') continue;
    let d = dmg;
    if (def.missingRatio) d += (f.maxHp-f.hp)*def.missingRatio;
    f.takeDamage(d, dmgType(unit), unit);
    applyCC(f, def, unit, lvl);
    if (def.pull){
      const dir = center.clone().sub(f.pos); dir.y=0;
      if (dir.length()>2){ dir.normalize(); f.knock = {vel:dir.multiplyScalar(def.pull*3), t:0.3}; }
    }
    if (def.dot) applyDot(unit, f, def, lvl);
  }
  return list;
}
function applyDot(unit, target, def, lvl){
  const dps = skillVal(def.dot.dps, lvl) + (def.dot.ratio||0)*unit.powerStat();
  target.addBuff({id:'dot'+unit.uid+def.key, name:def.name, dur:def.dot.dur, dot:{dps, type:dmgType(unit), src:unit}});
  if (def.leech){
    unit.addBuff({id:'leech'+unit.uid, name:'汲取', dur:def.dot.dur, hpPerSec:dps*def.leech});
    FX.aura(unit, {color:0x7dffa0, dur:def.dot.dur, tex:'leaf'});
  }
}

/* 技能施放主入口 */
function castSkill(unit, idx, aimPos, explicitTarget){
  if (G.over || unit.dead) return false;
  const s = unit.skills[idx];
  if (!s || s.lvl<=0) { if (unit.isPlayer) UI.msg('技能尚未学习'); return false; }
  if (s.cd > 0) { if (unit.isPlayer) UI.msg('技能冷却中'); return false; }
  if (unit.silenced || unit.stunned) { if (unit.isPlayer) UI.msg('无法施法!'); return false; }
  if (unit.channel) return false;
  const def = s.def, lvl = s.lvl-1;
  if (unit.mana < (def.mana||0)){ if (unit.isPlayer){ UI.msg('能量不足'); AUDIO.play('error'); } return false; }

  // 目标处理
  let aim = aimPos? aimPos.clone() : unit.pos.clone();
  aim.y = 0;
  if (def.range){
    const d = aim.clone().sub(unit.pos); d.y = 0;
    if (d.length() > def.range){ d.setLength(def.range); aim = unit.pos.clone().add(d); }
  }
  let target = explicitTarget;
  if (def.pattern==='targeted' || def.pattern==='chase'){
    if (!target || target.dead || target.team===unit.team){
      // 找瞄准点附近的敌人
      const cand = unitsNear(aim, 10, u=>u.team===enemyOf(unit.team) && !u.dead && u.kind!=='tower' && u.kind!=='nexus' && !u.stealthed);
      cand.sort((a,b)=>a.pos.distanceTo(aim)-b.pos.distanceTo(aim));
      target = cand[0];
      if (!target){
        const cand2 = unitsNear(unit.pos, def.range, u=>u.team===enemyOf(unit.team) && !u.dead && u.kind==='champ' && !u.stealthed);
        cand2.sort((a,b)=>unit.distTo(a)-unit.distTo(b));
        target = cand2[0];
      }
    }
    if (!target || unit.distTo(target) > def.range + 4){
      if (unit.isPlayer){ UI.msg('范围内没有目标'); }
      return false;
    }
  }

  // 消耗
  unit.mana -= def.mana||0;
  s.cd = skillVal(def.cd, lvl) * unit.cdrFactor();
  unit.faceToward(aim.x, aim.z);
  unit.attackAnimT = 0.3;
  if (unit.isPlayer){ AUDIO.play('cast'); UI.refreshSkillbar(); }
  UI.ultCutIn(unit, def);
  if (idx===3 && unit.pokeId) AUDIO.playCry(unit.pokeId, 0.4);
  if (window.NET && NET.role==='host') NET.onCast(unit, idx, aim, target, lvl);

  execPattern(unit, def, lvl, aim, target);
  return true;
}

function execPattern(unit, def, lvl, aim, target){
  const col = typeColor(def);
  const type = dmgType(unit);
  const from = ()=>V3(unit.pos.x, unit.height*0.55, unit.pos.z);
  const dir = aim.clone().sub(unit.pos); dir.y = 0;
  if (dir.lengthSq()<0.01) dir.set(Math.sin(unit.facing),0,Math.cos(unit.facing));
  dir.normalize();

  switch(def.pattern){

  case 'bolt': { // 直线弹道
    const dst = unit.pos.clone().addScaledVector(dir, def.range);
    dst.y = 3;
    const hitSet = new Set();
    const vfxMap = {lightning:['spark',3.2], watershot:['bubble',3], razorleaf:['leaf',2.6], vinewhip:['leaf',2.4],
      shadowball:['soft',3.4], icebeam:['snow',2.8], dragonpulse:['glow',3.4], psywave:['glow',3.2], fascinate:['heart',2.6]};
    const [ptex, psize] = vfxMap[def.vfx]||['glow',3];
    if (def.vfx==='lightning'){
      // 闪电箭:一瞬直达 + 链状视觉
      after(0.05, ()=>{
        let hit = null, bd = 1e9;
        for (const u of unitsNear(unit.pos, def.range, x=>x.team===enemyOf(unit.team)&&!x.dead&&x.kind!=='tower'&&x.kind!=='nexus')){
          const rel = u.pos.clone().sub(unit.pos); rel.y=0;
          const along = rel.dot(dir);
          if (along<2||along>def.range) continue;
          const perp = rel.clone().addScaledVector(dir,-along).length();
          if (perp < def.width + u.radius && along < bd){ bd = along; hit = u; }
        }
        const end = hit? hit.pos.clone().setY(hit.height*0.5) : dst;
        FX.lightningBolt(from(), end, {color:0xffe97a, dur:0.32, displace:3.4});
        FX.lightningBolt(from(), end, {color:0xffffff, dur:0.22, displace:1.8});
        FX.flash(unit.pos, col, 3, 40, 0.3);
        AUDIO.play('thunder');
        if (hit){
          hit.takeDamage(skillDmg(unit,def,lvl), type, unit);
          applyCC(hit, def, unit, lvl);
          FX.burst(hit.pos, {count:12, tex:'spark', color:[0xffe97a,0xffffff], size:1.8, speed:12, up:0.8, life:0.4, yOff:hit.height*0.5});
        }
      });
      break;
    }
    FX.projectile({from:from(), to:dst, speed:def.speed||95, color:col, size:psize, tex:ptex,
      onUpdate:(p,dt,eff)=>{
        for (const u of unitsNear(p, (def.width||4)+2, x=>x.team===enemyOf(unit.team)&&!x.dead&&x.kind!=='tower'&&x.kind!=='nexus'&&!hitSet.has(x.uid))){
          hitSet.add(u.uid);
          u.takeDamage(skillDmg(unit,def,lvl), type, unit);
          applyCC(u, def, unit, lvl);
          FX.burst(p, {count:10, tex:ptex, color:col, size:1.6, speed:10, up:0.7, life:0.4});
          if (def.vfx==='vinewhip') FX.ring(u.pos, {r1:5, color:col, dur:0.4});
          if (!def.pierce){ eff.dead = true; FX.explosion(p, {color:col, radius:4, count:12, size:1.6}); return; }
        }
      },
      onArrive:(p)=>{ if(!def.pierce) FX.burst(p, {count:8, tex:ptex, color:col, size:1.4, speed:8, up:0.6, life:0.35}); }});
    break;
  }

  case 'wave': { // 宽体推进波(冲浪)
    const dst = unit.pos.clone().addScaledVector(dir, def.range); dst.y=1.5;
    const hitSet = new Set();
    FX.projectile({from:from(), to:dst, speed:def.speed||65, color:col, size:5, tex:'bubble', trailTex:'bubble',
      onUpdate:(p,dt,eff)=>{
        FX.burst(p, {count:2, tex:'bubble', color:[0x9fd8ff,col], size:2.4, speed:6, up:1.4, life:0.5, spread:def.width/2});
        for (const u of unitsNear(p, def.width/2+2, x=>x.team===enemyOf(unit.team)&&!x.dead&&x.kind!=='tower'&&x.kind!=='nexus'&&!hitSet.has(x.uid))){
          hitSet.add(u.uid);
          u.takeDamage(skillDmg(unit,def,lvl), type, unit);
          applyCC(u, def, unit, lvl);
          u.knock = {vel:dir.clone().multiplyScalar(18), t:0.3};
        }
      }});
    FX.ring(unit.pos, {r1:8, color:col, dur:0.4});
    break;
  }

  case 'homing': { // 追踪弹(鬼火)
    const foes = unitsNear(unit.pos, def.range, u=>u.team===enemyOf(unit.team) && !u.dead && u.kind!=='tower' && u.kind!=='nexus' && !u.stealthed);
    foes.sort((a,b)=>(b.kind==='champ'?1:0)-(a.kind==='champ'?1:0) || unit.distTo(a)-unit.distTo(b));
    const n = def.count||3;
    for (let i=0;i<n;i++){
      const t = foes[i % Math.max(1,foes.length)];
      if (!t) break;
      after(i*0.12, ()=>{
        if (t.dead) return;
        FX.projectile({from:from(), target:t, speed:70+i*8, color:col, size:2.6, tex:'flame', arc:6,
          onArrive:(p,tt)=>{ if (tt&&!tt.dead){
            tt.takeDamage(skillDmg(unit,def,lvl), type, unit);
            FX.explosion(p, {color:col, radius:4, count:12, size:1.8});
          }}});
      });
    }
    if (!foes.length && unit.isPlayer) UI.msg('附近没有敌人');
    break;
  }

  case 'aoe': { // 落点区域
    FX.telegraph(aim, def.radius, def.delay||0.6, unit.team===playerTeam()? 0x50c0ff:0xff5040);
    const isUlt = def.key==='R';
    after(def.delay||0.6, ()=>{
      const dmg = skillDmg(unit,def,lvl);
      hitEnemiesInCircle(unit, aim, def.radius, dmg, def, lvl);
      if (isUlt) bigHit(aim, col, def.radius);
      // vfx
      switch(def.vfx){
        case 'thunderweb':
          FX.skyStrike(aim, {color:0xf8c832, radius:def.radius});
          for (let i=0;i<5;i++){ const a=i/5*Math.PI*2;
            FX.lightningBolt({x:aim.x,y:1,z:aim.z},{x:aim.x+Math.cos(a)*def.radius, y:0.5, z:aim.z+Math.sin(a)*def.radius},{color:0xf8c832,dur:0.4,displace:2}); }
          break;
        case 'hypnosis':
          FX.ring(aim, {r1:def.radius, color:0xd0a0ff, dur:0.8});
          FX.burst(aim, {count:14, tex:'note', color:[0xd0a0ff,0xf0d0ff], size:2, speed:4, up:1.6, life:1.1, spread:def.radius*0.7});
          AUDIO.play('freeze');
          break;
        case 'twister':
          FX.tornado(()=>aim, {dur:1.6, color:0xb8a0ff, r0:2, r1:def.radius*0.8, height:14});
          AUDIO.play('dash');
          break;
        case 'confine':
          FX.ring(aim, {r1:def.radius, color:0xf860a0, dur:0.6});
          FX.burst(aim, {count:16, tex:'star', color:0xf8a0d0, size:1.8, speed:6, up:1.5, life:0.7, spread:def.radius*0.6});
          break;
        case 'psychicblast': case 'psystrike':
          FX.explosion(aim, {color:0xf860a0, radius:def.radius, count:40, size:3});
          FX.ring(aim, {r1:def.radius*1.4, color:0xffffff, dur:0.6});
          FX.tornado(()=>aim, {dur:1, color:0xf8a0d0, r0:1, r1:def.radius*0.7, height:16});
          AUDIO.play('explosion');
          break;
        case 'fireblast': {
          FX.explosion(aim, {color:0xff7a3c, radius:def.radius, count:44, size:3.4});
          // 大字形火焰
          const arms = [[0,1],[0.95,0.31],[0.59,-0.81],[-0.59,-0.81],[-0.95,0.31]];
          for (const [ax,az] of arms)
            for (let k=1;k<=4;k++)
              FX.burst({x:aim.x+ax*k*def.radius/4, y:0, z:aim.z+az*k*def.radius/4},
                {count:4, tex:'flame', color:[0xffb060,0xff7a3c], size:2.6, speed:3, up:2.4, life:0.8});
          AUDIO.play('explosion');
          break;
        }
        default:
          if (!isUlt){ FX.explosion(aim, {color:col, radius:def.radius, count:26, size:2.4}); AUDIO.play('explosion'); }
      }
    });
    break;
  }

  case 'storm': { // 多段天雷
    FX.telegraph(aim, def.radius, def.delay||0.5, 0xf8c832);
    const strikes = def.strikes||5;
    for (let i=0;i<strikes;i++){
      after((def.delay||0.5) + i*(def.interval||0.35), ()=>{
        // 优先劈范围内的敌人
        const foes = unitsNear(aim, def.radius, u=>u.team===enemyOf(unit.team) && !u.dead && u.kind!=='tower' && u.kind!=='nexus');
        let p;
        if (foes.length && Math.random()<0.75){
          const t = foes[Math.floor(Math.random()*foes.length)];
          p = t.pos.clone();
        } else {
          const a = Math.random()*Math.PI*2, r = Math.random()*def.radius;
          p = V3(aim.x+Math.cos(a)*r, 0, aim.z+Math.sin(a)*r);
        }
        FX.skyStrike(p, {color:0xf8c832, radius:6});
        FX.pillar(p, {color:0xffe97a, r:2.2, h:24, dur:0.45});
        FX.streaks(p, {color:0xffe97a, count:7, len:7});
        FX.crackDecal(p, {color:0xffd94a, r:5, dur:1.2});
        G.shake = Math.max(G.shake||0, 0.5);
        AUDIO.play('thunder');
        hitEnemiesInCircle(unit, p, 6.5, skillDmg(unit,def,lvl), def, lvl);
      });
    }
    // 终结一击:中心大爆
    after((def.delay||0.5) + strikes*(def.interval||0.35), ()=>{
      bigHit(aim, 0xf8c832, def.radius*0.8);
      FX.lightningBolt({x:aim.x, y:44, z:aim.z}, {x:aim.x, y:0.5, z:aim.z}, {color:0xffffff, dur:0.35, displace:5, segments:14});
      hitEnemiesInCircle(unit, aim, def.radius*0.8, skillDmg(unit,def,lvl)*0.6, def, lvl);
    });
    break;
  }

  case 'nova': { // 自身周围爆发
    const dmg = skillDmg(unit,def,lvl);
    const center = unit.pos.clone();
    const isUlt = def.key==='R';
    if (isUlt) bigHit(center, col, def.radius);
    if (def.vfx==='earthshatter'){
      FX.ring(center, {r1:def.radius, color:0xc09060, dur:0.55});
      FX.burst(center, {count:30, tex:'smoke', color:0x9a7a50, size:3, speed:14, up:1.2, life:0.9, normalBlend:true, opacity:0.6});
      FX.debris(center, {count:14, color:0x9a7a50, speed:24});
      FX.crackDecal(center, {color:0xffc060, r:def.radius, dur:3});
    } else if (def.vfx==='shadownova'){
      FX.burst(center, {count:26, tex:'soft', color:0x9080e0, size:3, speed:6, life:0.6, implode:true, spread:def.radius});
      FX.tornado(()=>unit.pos, {dur:1.2, color:0x9080e0, r0:2, r1:def.radius*0.8, height:12, tex:'soft'});
    } else if (!isUlt){
      FX.explosion(center, {color:col, radius:def.radius, count:30, size:2.6});
      AUDIO.play('explosion');
    }
    hitEnemiesInCircle(unit, center, def.radius, dmg, def, lvl);
    break;
  }

  case 'cone': { // 扇形近战
    const ang = Math.atan2(dir.x, dir.z);
    FX.slashArc(unit.pos, ang, {range:def.range, color:col, arc:def.angle, y:unit.height*0.4, dur:0.3});
    if (def.vfx==='flameclaw')
      FX.burst(unit.pos.clone().addScaledVector(dir, def.range*0.6), {count:16, tex:'flame', color:[0xffb060,0xff7a3c], size:2.2, speed:8, up:1, life:0.5});
    if (def.vfx==='karatechop'){
      FX.slashArc(unit.pos, ang, {range:def.range*0.8, color:0xffffff, arc:def.angle, y:unit.height*0.5, dur:0.22, dirSign:-1});
      G.shake = 0.3;
    }
    AUDIO.play('hit');
    const foes = unitsNear(unit.pos, def.range+2, u=>u.team===enemyOf(unit.team) && !u.dead && u.kind!=='tower' && u.kind!=='nexus');
    for (const f of foes){
      const rel = f.pos.clone().sub(unit.pos); rel.y=0;
      const a2 = rel.angleTo(dir);
      if (a2 <= def.angle/2 + 0.15){
        f.takeDamage(skillDmg(unit,def,lvl), type, unit);
        applyCC(f, def, unit, lvl);
        if (def.dot) applyDot(unit, f, def, lvl);
      }
    }
    break;
  }

  case 'channelcone': { // 引导扇形(喷射火焰)
    unit.moveTarget = null; unit.attackTarget = null;
    const fixDir = dir.clone();
    unit.channel = {name:def.name, t:0, dur:def.dur, tick:def.tick, moveCancels:true,
      onTick:()=>{
        const orig = unit.pos.clone().addScaledVector(fixDir, 2);
        for (let k=0;k<4;k++){
          const spreadA = (Math.random()-0.5)*def.angle;
          const ca = Math.cos(spreadA), sa = Math.sin(spreadA);
          const d2 = V3(fixDir.x*ca - fixDir.z*sa, 0, fixDir.x*sa + fixDir.z*ca);
          FX.burst(orig.clone().addScaledVector(d2, 4+Math.random()*def.range*0.8),
            {count:2, tex:'flame', color:[0xffb060,0xff7a3c,0xffe080], size:2.6, speed:5, up:1.2, life:0.45, yOff:2});
        }
        FX.flash(unit.pos, 0xff7a3c, 2, 40, 0.2);
        const foes = unitsNear(unit.pos, def.range+2, u=>u.team===enemyOf(unit.team) && !u.dead && u.kind!=='tower' && u.kind!=='nexus');
        for (const f of foes){
          const rel = f.pos.clone().sub(unit.pos); rel.y=0;
          if (rel.angleTo(fixDir) <= def.angle/2 + 0.1)
            f.takeDamage(skillDmg(unit,def,lvl), type, unit);
        }
      }};
    AUDIO.play('explosion');
    break;
  }

  case 'beam': { // 蓄力直线光束
    const dst = unit.pos.clone().addScaledVector(dir, def.range);
    unit.moveTarget = null;
    const isUlt = def.key==='R';
    FX.telegraphLine(unit.pos, dst, def.width, def.delay||0.6, col);
    // 蓄力:能量向施法者汇聚
    FX.aura(unit, {color:col, dur:def.delay||0.6, up:-2});
    FX.burst(unit.pos, {count:22, tex:'glow', color:[col,0xffffff], size:1.8, speed:26, life:0.55, implode:true, spread:14, yOff:3});
    after(def.delay||0.6, ()=>{
      if (unit.dead) return;
      const beamCol = def.vfx==='solarbeam'? 0xffe97a : def.vfx==='hydrocannon'? 0x4aa0f0 : col;
      FX.beam(unit.pos, dst, {color:beamCol, width:def.width*(isUlt?1.4:1), dur:isUlt?0.8:0.6, tex:def.vfx==='hydrocannon'?'bubble':'glow'});
      FX.streaks(unit.pos, {color:beamCol, count:10, len:9});
      if (isUlt){
        bigHit(dst, beamCol, def.width*1.6);
        FX.pillar(unit.pos, {color:beamCol, r:3, h:22, dur:0.5});
        // 沿途爆点
        const d3 = dst.clone().sub(unit.pos); const L3 = d3.length(); d3.normalize();
        for (let k=1;k<=3;k++){
          const p3 = unit.pos.clone().addScaledVector(d3, L3*k/4);
          after(k*0.06, ()=>FX.explosion(p3, {color:beamCol, radius:def.width, count:14, size:2}));
        }
      }
      G.shake = Math.max(G.shake||0, isUlt? 1.1 : 0.5);
      AUDIO.play('explosion');
      const d2 = dst.clone().sub(unit.pos); d2.y=0; const len = d2.length(); d2.normalize();
      for (const u of unitsNear(unit.pos, len+6, x=>x.team===enemyOf(unit.team)&&!x.dead&&x.kind!=='tower'&&x.kind!=='nexus')){
        const rel = u.pos.clone().sub(unit.pos); rel.y=0;
        const along = rel.dot(d2);
        if (along<0||along>len) continue;
        if (rel.clone().addScaledVector(d2,-along).length() < def.width/2 + u.radius + 1){
          u.takeDamage(skillDmg(unit,def,lvl), type, unit);
          applyCC(u, def, unit, lvl);
        }
      }
    });
    break;
  }

  case 'dash': { // 位移+路径伤害
    const dst = unit.pos.clone().addScaledVector(dir, Math.min(def.range, aim.clone().sub(unit.pos).length()||def.range));
    // 立即结算路径命中
    const len = dst.clone().sub(unit.pos).length();
    if (def.dmg){
      for (const u of unitsNear(unit.pos, len+6, x=>x.team===enemyOf(unit.team)&&!x.dead&&x.kind!=='tower'&&x.kind!=='nexus')){
        const rel = u.pos.clone().sub(unit.pos); rel.y=0;
        const along = rel.dot(dir);
        if (along>-2 && along<len+2 && rel.clone().addScaledVector(dir,-along).length() < 5+u.radius){
          u.takeDamage(skillDmg(unit,def,lvl), type, unit);
          applyCC(u, def, unit, lvl);
        }
      }
    }
    unit.knock = {vel:dir.clone().multiplyScalar(len/0.28), t:0.28};
    unit.faceToward(dst.x, dst.z);
    if (def.empower) unit.addBuff({name:'强化攻击', dur:def.empower.dur, empower:def.empower.pct});
    // 尾迹
    const trailCol = def.vfx==='aquajet'? 0x4aa0f0 : def.vfx==='extremespeed'? 0xffffff : col;
    const trail = {n:8};
    for (let i=0;i<trail.n;i++)
      after(i*0.035, ()=>FX.burst(unit.pos, {count:4, tex:def.vfx==='rollout'?'smoke':'glow', color:trailCol, size:2.2, speed:2, up:0.5, life:0.4, normalBlend:def.vfx==='rollout'}));
    AUDIO.play('dash');
    break;
  }

  case 'leap': { // 跳跃落地AoE(泰山压顶)
    FX.telegraph(aim, def.radius, 0.55, 0xffc060);
    const start = unit.pos.clone();
    const jump = aim.clone().sub(start);
    unit.knock = {vel:jump.multiplyScalar(1/0.55), t:0.55};
    unit.addBuff({name:'跳跃', dur:0.55, knockup:true});
    after(0.58, ()=>{
      if (unit.dead) return;
      G.shake = 0.5;
      FX.ring(unit.pos, {r1:def.radius, color:0xffc060, dur:0.5});
      FX.explosion(unit.pos, {color:col, radius:def.radius, count:24, size:2.6});
      AUDIO.play('explosion');
      hitEnemiesInCircle(unit, unit.pos, def.radius, skillDmg(unit,def,lvl), def, lvl);
    });
    AUDIO.play('dash');
    break;
  }

  case 'blink': { // 瞬移
    FX.burst(unit.pos, {count:14, tex:'soft', color:col, size:2, speed:5, up:1, life:0.5});
    FX.ring(unit.pos, {r1:5, color:col, dur:0.4});
    unit.pos.set(aim.x, 0, aim.z);
    unit.clampMap();
    FX.burst(unit.pos, {count:16, tex:'star', color:[col,0xffffff], size:1.8, speed:6, up:1.4, life:0.6});
    FX.ring(unit.pos, {r1:6, color:col, dur:0.45});
    FX.flash(unit.pos, col, 3, 40, 0.35);
    if (def.stealth){
      unit.addBuff({name:'隐身', dur:def.stealth, stealth:true});
      unit.addBuff({name:'加速', dur:def.stealth, stats:{ms:def.buff? def.buff.ms:0.2}});
    }
    AUDIO.play('flash');
    break;
  }

  case 'chase': { // 冲向目标单体(怪力E/R)
    const t = target;
    const gap = t.pos.clone().sub(unit.pos); gap.y=0;
    const glen = Math.max(0.1, gap.length()-3);
    gap.normalize();
    unit.knock = {vel:gap.clone().multiplyScalar(glen/0.22), t:0.22};
    after(0.24, ()=>{
      if (unit.dead || t.dead) return;
      unit.faceToward(t.pos.x, t.pos.z);
      t.takeDamage(skillDmg(unit,def,lvl), type, unit);
      applyCC(t, def, unit, lvl);
      if (def.key==='R'){
        bigHit(t.pos, col, 11);
        FX.slashArc(t.pos, unit.facing, {range:9, color:0xffffff, arc:2.2, y:3});
        FX.slashArc(t.pos, unit.facing+1.2, {range:8, color:col, arc:2, y:4, dirSign:-1});
      } else {
        G.shake = 0.3;
        FX.explosion(t.pos, {color:col, radius:6, count:20, size:2.2});
        FX.slashArc(t.pos, unit.facing, {range:8, color:0xffffff, arc:2, y:3});
        AUDIO.play('crit');
      }
    });
    AUDIO.play('dash');
    break;
  }

  case 'targeted': { // 指向单体
    const t = target;
    if (def.vfx==='psybeam'){
      FX.lightningBolt(from(), {x:t.pos.x, y:t.height*0.6, z:t.pos.z}, {color:0xf860a0, dur:0.35, displace:1.5});
      FX.burst(t.pos, {count:14, tex:'star', color:[0xf860a0,0xffc0e0], size:1.8, speed:8, up:1, life:0.5, yOff:t.height*0.5});
    } else if (def.vfx==='leechseed'){
      FX.projectile({from:from(), target:t, speed:60, color:0x5cc860, size:2, tex:'leaf', arc:5,
        onArrive:()=>FX.aura(t, {color:0x5cc860, dur:def.dot.dur, tex:'leaf', up:1})});
    }
    t.takeDamage(skillDmg(unit,def,lvl), type, unit);
    applyCC(t, def, unit, lvl);
    if (def.dot) applyDot(unit, t, def, lvl);
    break;
  }

  case 'buff': { // 自身增益/护盾/回复
    const b = def.buff||{};
    const stats = {};
    if (b.atk) stats.atk = skillVal(b.atk, lvl);
    if (b.sp) stats.sp = skillVal(b.sp, lvl);
    if (b.as) stats.as = b.as;
    if (b.ms) stats.ms = b.ms;
    if (b.def) stats.def = b.def;
    if (b.sdef) stats.sdef = b.sdef;
    const buff = {id:'skill'+def.key+unit.uid, name:def.name, dur:b.dur||4, stats};
    if (b.lifesteal) buff.stats.lifesteal = b.lifesteal;
    unit.addBuff(buff);
    if (def.shield) unit.addShield(skillVal(def.shield,lvl) + (def.shieldRatio||0)*unit.powerStat(), b.dur||3.5);
    if (def.heal) unit.heal(skillVal(def.heal,lvl) + 0.3*unit.powerStat());
    // vfx
    if (def.shield){ FX.shieldBubble(unit, b.dur||3.5, col); AUDIO.play('shield'); }
    else { FX.aura(unit, {color:col, dur:Math.min(3,b.dur||3), tex:def.vfx==='outrage'?'flame':'star', spin:true}); AUDIO.play('shield'); }
    if (def.vfx==='outrage'){
      FX.pillar(unit.pos, {color:0xff5040, r:3.5, h:26, dur:0.8});
      FX.ring(unit.pos, {r1:14, color:0xff5040, dur:0.6});
      FX.streaks(unit.pos, {color:0xff7050, count:10, len:9});
      FX.crackDecal(unit.pos, {color:0xff6040, r:8, dur:2});
      G.shake = Math.max(G.shake||0, 0.8);
    } else if (def.key==='R'){
      FX.pillar(unit.pos, {color:col, r:3, h:22, dur:0.7});
      FX.ring(unit.pos, {r1:12, color:col, dur:0.6});
    }
    break;
  }

  case 'healaoe': {
    const allies = unitsNear(unit.pos, def.radius, u=>u.team===unit.team && !u.dead && u.kind==='champ');
    const amt = skillVal(def.heal,lvl) + (def.healRatio||0)*unit.powerStat();
    for (const a of allies){ a.heal(amt); FX.healBurst(a, 0x7dffa0); }
    FX.ring(unit.pos, {r1:def.radius, color:0x7dffa0, dur:0.8});
    AUDIO.play('heal');
    break;
  }

  case 'channelheal': { // 睡觉
    unit.moveTarget = null; unit.attackTarget = null;
    unit.channel = {name:def.name, t:0, dur:def.dur, tick:0.5, moveCancels:true,
      onTick:()=>{
        unit.heal(unit.maxHp*def.healPctPerSec*0.5);
        FX.burst(unit.pos, {count:2, tex:'zzz', color:0xc0d8ff, size:2.2, speed:1.2, up:2, life:1.4, yOff:unit.height});
      }};
    AUDIO.play('heal');
    break;
  }

  case 'zone': { // 环绕自身持续领域
    const zcol = def.vfx==='blizzard'? 0xbfeaff : col;
    const ztex = def.vfx==='blizzard'? 'snow' : def.vfx==='firespin'? 'flame':'glow';
    const isUlt = def.key==='R';
    if (isUlt) bigHit(unit.pos, zcol, def.radius*0.7);
    FX.zone(()=>unit.pos, {dur:def.dur, radius:def.radius, tex:ztex, color:zcol, size:2,
      up:def.vfx==='blizzard'? -0.5:1.6, gravity:def.vfx==='blizzard'? -6:-1, spin:true, emitEvery:isUlt?0.035:0.05, per:isUlt?4:3,
      yOff:def.vfx==='blizzard'? 12:0.5, life:def.vfx==='blizzard'? 1.2:0.7});
    FX.ring(unit.pos, {r1:def.radius, color:zcol, dur:0.7});
    if (def.vfx==='blizzard'){
      // 环形冰晶尖刺
      for (let i=0;i<8;i++){
        const a = i/8*Math.PI*2;
        after(i*0.08, ()=>{
          if (unit.dead) return;
          const p = V3(unit.pos.x+Math.cos(a)*def.radius*0.7, 0, unit.pos.z+Math.sin(a)*def.radius*0.7);
          FX.pillar(p, {color:0xbfeaff, r:1.2, h:9, dur:0.6});
        });
      }
    }
    const ticks = Math.floor(def.dur/def.tick);
    for (let i=1;i<=ticks;i++){
      after(i*def.tick, ()=>{
        if (unit.dead) return;
        hitEnemiesInCircle(unit, unit.pos, def.radius, skillDmg(unit,def,lvl), def, lvl);
      });
    }
    if (def.vfx==='blizzard') AUDIO.play('freeze');
    else AUDIO.play('explosion');
    break;
  }
  }
}

/* ============================================================
   玩家施法:目标选定逻辑
   优先级: 鼠标悬停敌人 > 锁定目标 > 当前攻击目标 > 范围内最近英雄 > 范围内最近敌人 > 鼠标地面
   ============================================================ */
function playerCast(i){
  const P = G.player;
  if (!P || P.dead) return;
  const s = P.skills[i];
  if (!s || s.lvl<=0){ UI.msg('技能尚未学习 (Ctrl+'+'QWER'[i]+' 或点 + 升级)'); return; }
  const def = s.def;
  const et = enemyOf(P.team);
  const valid = u=>u && !u.dead && u.team===et && u.kind!=='tower' && u.kind!=='nexus' && !u.stealthed;
  // 位移类技能永远朝鼠标方向(逃生优先)
  const mouseOnly = def.pattern==='dash' || def.pattern==='blink';
  let target = null;
  if (!mouseOnly){
    const hover = unitsNear(G.mouse.ground, 7, valid)
      .sort((a,b)=>a.pos.distanceTo(G.mouse.ground)-b.pos.distanceTo(G.mouse.ground))[0];
    target = hover
      || (valid(G.selected)? G.selected : null)
      || (valid(P.attackTarget)? P.attackTarget : null);
    if (target && def.range && P.distTo(target) > def.range + 6) target = null;   // 超范围回退默认
    if (!target && def.range){
      const cands = unitsNear(P.pos, def.range, valid);
      cands.sort((a,b)=>((b.kind==='champ')-(a.kind==='champ')) || P.distTo(a)-P.distTo(b));
      target = cands[0]||null;
    }
  }
  let aim;
  if (target){
    aim = target.pos.clone();
    // 弹道预判:朝目标移动方向提前量
    if (def.speed && target.moving && target.moveTarget && target.getMS){
      const d = target.moveTarget.clone().sub(target.pos); d.y = 0;
      if (d.lengthSq() > 0.1){
        d.normalize();
        aim.addScaledVector(d, target.getMS()*(P.distTo(target)/def.speed)*0.8);
      }
    }
  } else {
    aim = G.mouse.ground.clone();
  }
  // 联机客机:本地校验通过后转发给主机执行
  if (G.netRole==='guest'){
    if (s.cd > 0 || P.mana < (def.mana||0)) { UI.msg(s.cd>0?'技能冷却中':'能量不足'); return; }
    NET.gInput({t:'cast', i, ax:+aim.x.toFixed(1), az:+aim.z.toFixed(1), tid:(target&&target.netId)||0});
    return;
  }
  castSkill(P, i, aim, target);
}

/* AI 施放接口 */
function castSkillAI(bot, idx, aimPos, target){
  return castSkill(bot, idx, aimPos, target);
}

/* 联机客机:技能特效重演(无伤害,由 G.netRole==='guest' 保证) */
function netCast(unit, idx, lvl, aim, target){
  if (unit.dead) return;
  const def = unit.data? unit.data.skills[idx] : null;
  if (!def) return;
  unit.faceToward(aim.x, aim.z);
  unit.attackAnimT = 0.3;
  UI.ultCutIn(unit, def);
  if (idx===3 && unit.pokeId) AUDIO.playCry(unit.pokeId, 0.4);
  if (unit.isPlayer) AUDIO.play('cast');
  try{ execPattern(unit, def, lvl, aim, target); }catch(e){ console.warn('netCast', e); }
}

/* 召唤师技能 */
function castSummoner(champ, key, aimPos){
  if (champ.dead || G.over) return false;
  if (G.netRole==='guest' && champ.isPlayer){
    if (champ.summCd[key] > 0){ UI.msg('召唤师技能冷却中'); return false; }
    const a = aimPos||G.mouse.ground;
    NET.gInput({t:'summ', k:key, ax:+a.x.toFixed(1), az:+a.z.toFixed(1)});
    return true;
  }
  if (champ.summCd[key] > 0){ if (champ.isPlayer) UI.msg('召唤师技能冷却中'); return false; }
  if (key==='D'){
    champ.summCd.D = DATA.SUMMONER.heal.cd;
    champ.heal(champ.maxHp*0.25);
    champ.addBuff({name:'伤药加速', dur:1.5, stats:{ms:0.3}});
    FX.healBurst(champ, 0x7dffa0);
    AUDIO.play('heal');
  } else if (key==='F'){
    champ.summCd.F = DATA.SUMMONER.flash.cd;
    const aim = aimPos||G.mouse.ground;
    const d = V3(aim.x-champ.pos.x, 0, aim.z-champ.pos.z);
    if (d.length() > DATA.SUMMONER.flash.range) d.setLength(DATA.SUMMONER.flash.range);
    FX.burst(champ.pos, {count:10, tex:'soft', color:0xffe97a, size:2, speed:4, up:1, life:0.4});
    champ.pos.add(d); champ.clampMap();
    champ.moveTarget = null;
    FX.burst(champ.pos, {count:12, tex:'star', color:0xffe97a, size:1.6, speed:5, up:1.2, life:0.5});
    AUDIO.play('flash');
  }
  if (champ.isPlayer) UI.refreshSkillbar();
  return true;
}

function startRecall(champ){
  if (champ.dead || champ.recallT > 0) return;
  if (G.netRole==='guest' && champ.isPlayer){ NET.gInput({t:'recall'}); UI.msg('回城中...'); return; }
  champ.recallT = 8;
  champ.moveTarget = null; champ.attackTarget = null;
  champ.recallFx = FX.recallBeam(champ, 8.2, champ.team==='blue'? 0x7ab8ff:0xff9080);
  if (champ.isPlayer) AUDIO.play('recall');
}

/* ============================================================
   商店
   ============================================================ */
function canShop(champ){
  return champ.dead || champ.pos.distanceTo(G.fountain[champ.team]) < 22;
}
function buyItem(champ, itemId){
  const item = DATA.ITEMS.find(i=>i.id===itemId);
  if (!item) return false;
  if (G.netRole==='guest' && champ.isPlayer){
    if (champ.gold < item.cost){ UI.msg('金币不足'); AUDIO.play('error'); return false; }
    NET.gInput({t:'buy', id:itemId});
    return true;
  }
  if (!canShop(champ)){ if (champ.isPlayer){ UI.msg('需要在泉水处购买装备'); AUDIO.play('error'); } return false; }
  if (champ.gold < item.cost){ if (champ.isPlayer){ UI.msg('金币不足'); AUDIO.play('error'); } return false; }
  if (item.consume){
    champ.gold -= item.cost;
    if (item.consume==='level'){ if (champ.level>=CONST.MAX_LEVEL){ champ.gold += item.cost; UI.msg('已满级'); return false; } champ.addXp(DATA.xpForLevel(champ.level)-champ.xp+1); }
    else if (item.consume==='heal40') champ.heal(champ.maxHp*0.4);
    else if (item.consume==='full'){ champ.heal(champ.maxHp); champ.mana = champ.maxMana; }
    if (champ.isPlayer){ AUDIO.play('buy'); UI.refreshHud(); UI.refreshShop(); }
    return true;
  }
  if (champ.items.length >= 6){ if (champ.isPlayer){ UI.msg('装备栏已满(6件)'); AUDIO.play('error'); } return false; }
  if (champ.items.some(i=>i.id===itemId)){ if (champ.isPlayer){ UI.msg('同名装备只能购买一件'); AUDIO.play('error'); } return false; }
  champ.gold -= item.cost;
  champ.items.push(item);
  champ.computeStats(false);
  if (champ.isPlayer){ AUDIO.play('buy'); UI.refreshHud(); UI.refreshShop(); UI.msg('购买了 '+item.name); }
  return true;
}

const AI_BUILDS = {
  physical:['muscle-band','black-belt','shell-bell','choice-band','quick-claw','scope-lens','leftovers'],
  special: ['wise-glasses','charcoal','twisted-spoon','choice-specs','life-orb','leftovers','assault-vest'],
  tank:    ['metal-coat','eviolite','leftovers','rocky-helmet','assault-vest','focus-sash','choice-band'],
};
function aiShop(bot){
  const isTank = bot.data.role==='坦克'||bot.data.role==='辅助';
  const build = isTank? AI_BUILDS.tank : AI_BUILDS[bot.data.atkType]||AI_BUILDS.physical;
  for (const id of build){
    if (bot.items.length >= 6) break;
    const item = DATA.ITEMS.find(i=>i.id===id);
    if (!item || bot.items.some(i=>i.id===id)) continue;
    if (bot.gold >= item.cost){
      bot.gold -= item.cost;
      bot.items.push(item);
      bot.computeStats(false);
    } else break;
  }
}

/* ============================================================
   英雄创建 / 重生 / 添加AI
   ============================================================ */
function spawnChampion(champData, team, isPlayer, laneIdx){
  const f = G.fountain[team];
  const c = new ENT.Champion(champData, team, isPlayer, {x:f.x+(Math.random()-0.5)*8, z:f.z+(Math.random()-0.5)*8, laneIdx});
  c.homePos.set(f.x, 0, f.z);
  c.buildModel(G.scene);
  G.champs.push(c);
  if (!isPlayer) AI.initBot(c);
  AUDIO.playCry(champData.id, 0.25);
  return c;
}
function respawnChampion(c){
  c.dead = false;
  c.hp = c.maxHp; c.mana = c.maxMana;
  c.buffs = c.buffs.filter(b=>b.dur>1e8); // 保留龙魂
  c.shields = [];
  c.pos.copy(c.homePos);
  c.moveTarget = null; c.attackTarget = null;
  c.buildModel(G.scene);
  FX.burst(c.pos, {count:18, tex:'star', color:0x9ecfff, size:1.8, speed:6, up:1.5, life:0.7});
  if (!c.isPlayer){ AI.onRespawn(c); aiShop(c); }
  else { UI.hideDeath(); UI.refreshHud(); }
  AUDIO.playCry(c.data.id, 0.2);
}
function addBot(champKey, team){
  if (G.over) return null;
  if (G.netRole==='guest'){ NET.gInput({t:'addbot', key:champKey, team}); return true; }
  if (champsOf(team).length >= CONST.MAX_TEAM_CHAMPS){ UI.msg('该队伍已满('+CONST.MAX_TEAM_CHAMPS+'人)'); return null; }
  const data = DATA.CHAMPS.find(c=>c.key===champKey);
  if (!data) return null;
  // 车道:选人最少的
  const counts = [0,0,0];
  champsOf(team).forEach(c=>counts[c.laneIdx]++);
  const lane = counts.indexOf(Math.min(...counts));
  const bot = spawnChampion(data, team, false, lane);
  // 追平等级和经济
  const all = G.champs.filter(c=>c!==bot);
  const avgLvl = Math.round(all.reduce((a,c)=>a+c.level,0)/Math.max(1,all.length));
  while (bot.level < avgLvl) bot.levelUp();
  bot.gold += Math.floor(G.clock*1.6);
  aiShop(bot);
  bot.hp = bot.maxHp; bot.mana = bot.maxMana;
  UI.announce((team===playerTeam()? '我方':'敌方')+'新伙伴 '+data.name+' 加入战斗!', team===playerTeam()? '#7dffa0':'#ff9080');
  UI.refreshScoreboard();
  return bot;
}

/* ============================================================
   泉水
   ============================================================ */
function fountainTick(dt){
  for (const team of ['blue','red']){
    const f = G.fountain[team];
    for (const c of G.champs){
      if (c.dead) continue;
      const d = c.pos.distanceTo(f);
      if (d < 18){
        if (c.team===team){
          c.heal(c.maxHp*0.08*dt);
          c.mana = Math.min(c.maxMana, c.mana + c.maxMana*0.1*dt);
        } else {
          c.takeDamage(300*dt, 'true', null); // 泉水激光
        }
      }
    }
  }
}

/* ============================================================
   输入 / 相机
   ============================================================ */
function groundPoint(clientX, clientY){
  const r = G.renderer.domElement.getBoundingClientRect();
  const mx = ((clientX-r.left)/r.width)*2-1, my = -((clientY-r.top)/r.height)*2+1;
  G.ray.setFromCamera({x:mx,y:my}, G.camera);
  const p = new THREE.Vector3();
  G.ray.ray.intersectPlane(G.groundPlane, p);
  return p;
}

function setupInput(){
  const dom = G.renderer.domElement;
  dom.addEventListener('contextmenu', e=>e.preventDefault());

  dom.addEventListener('mousedown', e=>{
    AUDIO.resume();
    if (!G.running || !G.player || G.player.dead) return;
    const p = groundPoint(e.clientX, e.clientY);
    if (!p) return;
    if (e.button===2){ // 右键:移动/攻击
      const foes = unitsNear(p, 8, u=>u.team===enemyOf(playerTeam()) && !u.dead);
      foes.sort((a,b)=>a.pos.distanceTo(p)-b.pos.distanceTo(p));
      const target = foes.find(u=>!u.protected_);
      if (target){
        if (G.netRole==='guest') NET.gInput({t:'atk', tid:target.netId||0});
        else { G.player.attackTarget = target; G.player.moveTarget = null; }
        FX.ring(target.pos, {r1:target.radius+2, r0:target.radius+1, color:0xff4040, dur:0.4});
      } else {
        if (G.netRole==='guest') NET.gInput({t:'mv', x:+p.x.toFixed(1), z:+p.z.toFixed(1)});
        else { G.player.attackTarget = null; G.player.moveTo(p); }
        FX.ring(p, {r1:3, color:0x50ff70, dur:0.4});
        AUDIO.play('move');
      }
    } else if (e.button===0 && G.attackMove){
      G.attackMove = false;
      document.body.style.cursor = 'default';
      const foes = unitsNear(p, 16, u=>u.team===enemyOf(playerTeam()) && !u.dead && !u.protected_);
      foes.sort((a,b)=>a.pos.distanceTo(p)-b.pos.distanceTo(p));
      if (foes[0]){
        if (G.netRole==='guest') NET.gInput({t:'atk', tid:foes[0].netId||0});
        else G.player.attackTarget = foes[0];
      }
      else {
        if (G.netRole==='guest') NET.gInput({t:'mv', x:+p.x.toFixed(1), z:+p.z.toFixed(1)});
        else G.player.moveTo(p);
      }
      FX.ring(p, {r1:3, color:0xff8040, dur:0.4});
    } else if (e.button===0){
      // 左键:锁定/取消锁定目标
      const foes = unitsNear(p, 7, u=>u.team===enemyOf(playerTeam()) && !u.dead && u.kind!=='nexus' && !u.stealthed);
      foes.sort((a,b)=>a.pos.distanceTo(p)-b.pos.distanceTo(p));
      if (foes[0]){
        G.selected = foes[0];
        FX.ring(foes[0].pos, {r1:foes[0].radius+3, color:0xff4040, dur:0.5});
        AUDIO.play('click');
      } else {
        G.selected = null;
      }
    }
  });

  window.addEventListener('mousemove', e=>{
    G.mouse.x = e.clientX; G.mouse.y = e.clientY;
    const p = groundPoint(e.clientX, e.clientY);
    if (p) G.mouse.ground.copy(p);
    // 边缘平移
    const M = 24;
    G.edgePan.x = e.clientX < M? -1 : e.clientX > innerWidth-M? 1 : 0;
    G.edgePan.z = e.clientY < M? -1 : e.clientY > innerHeight-M? 1 : 0;
  });

  window.addEventListener('wheel', e=>{
    if (UI.modalOpen && UI.modalOpen()) return;
    G.camDist = Math.max(55, Math.min(150, G.camDist + e.deltaY*0.05));
  }, {passive:true});

  window.addEventListener('keydown', e=>{
    if (e.repeat) return;
    AUDIO.resume();
    const k = e.key.toLowerCase();
    if (k==='escape'){ UI.togglePause(); return; }
    if (k==='tab'){ e.preventDefault(); UI.showScoreboard(true); return; }
    if (!G.running || !G.player) return;
    const P = G.player;
    if (k==='p'){ UI.toggleShop(); return; }
    if (P.dead) return;
    const skillKeys = {q:0,w:1,e:2,r:3};
    if (k in skillKeys){
      const i = skillKeys[k];
      // ctrl/alt加点
      if (e.ctrlKey || e.altKey){ P.levelSkill(i); return; }
      playerCast(i);
      return;
    }
    if (k==='d') castSummoner(P, 'D', null);
    if (k==='f') castSummoner(P, 'F', G.mouse.ground.clone());
    if (k==='b') startRecall(P);
    if (k==='s'){
      if (G.netRole==='guest') NET.gInput({t:'stop'});
      else { P.moveTarget = null; P.attackTarget = null; }
    }
    if (k==='a'){ G.attackMove = true; document.body.style.cursor = 'crosshair'; }
    if (k==='y'){ G.camFollow = !G.camFollow; UI.msg(G.camFollow? '镜头锁定':'镜头解锁'); }
    if (k===' '){ e.preventDefault(); G.camPos.set(P.pos.x, 0, P.pos.z); G.spaceHold = true; }
  });
  window.addEventListener('keyup', e=>{
    if (e.key===' ') G.spaceHold = false;
    if (e.key.toLowerCase()==='tab') UI.showScoreboard(false);
  });
}

function updateCamera(dt){
  const P = G.player;
  if ((G.camFollow || G.spaceHold) && P && !P.dead){
    G.camPos.lerp(V3(P.pos.x,0,P.pos.z), Math.min(1, dt*8));
  } else {
    const spd = 90*dt;
    G.camPos.x += G.edgePan.x*spd;
    G.camPos.z += G.edgePan.z*spd;
  }
  const H = CONST.MAP_HALF+10;
  G.camPos.x = Math.max(-H, Math.min(H, G.camPos.x));
  G.camPos.z = Math.max(-H, Math.min(H, G.camPos.z));
  let shx = 0, shz = 0;
  if (G.shake > 0){
    G.shake -= dt*2;
    shx = (Math.random()-0.5)*G.shake*2; shz = (Math.random()-0.5)*G.shake*2;
  }
  const d = G.camDist;
  G.camera.position.set(G.camPos.x + shx, d*0.82, G.camPos.z + d*0.6 + shz);
  G.camera.lookAt(G.camPos.x, 0, G.camPos.z - 6);
}

/* ============================================================
   初始化 / 主循环
   ============================================================ */
function initRenderer(){
  const testMode = location.search.includes('test');
  G.scene = new THREE.Scene();
  G.scene.background = new THREE.Color(0x1a2f4a);
  G.scene.fog = new THREE.Fog(0x1a2f4a, 220, 420);
  G.camera = new THREE.PerspectiveCamera(46, innerWidth/innerHeight, 1, 600);
  G.renderer = new THREE.WebGLRenderer({antialias:!testMode, canvas:document.getElementById('game-canvas')});
  G.renderer.setSize(testMode? 320:innerWidth, testMode? 200:innerHeight);
  G.renderer.setPixelRatio(testMode? 0.5 : Math.min(devicePixelRatio, 1.6));
  G.renderer.shadowMap.enabled = !testMode;
  G.renderer.shadowMap.type = THREE.PCFShadowMap;
  G.renderer.outputEncoding = THREE.sRGBEncoding;
  window.addEventListener('resize', ()=>{
    G.camera.aspect = innerWidth/innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(innerWidth, innerHeight);
  });
  // 灯光
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x2a4a2a, 0.95);
  G.scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.0);
  sun.position.set(80, 140, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  const sc = 140;
  sun.shadow.camera.left = -sc; sun.shadow.camera.right = sc;
  sun.shadow.camera.top = sc; sun.shadow.camera.bottom = -sc;
  sun.shadow.camera.far = 400;
  G.scene.add(sun);
  FX.init(G.scene);
}

function startGame(playerKey, allyKeys, enemyKeys, difficulty, opts){
  opts = opts||{};
  AI.setDifficulty(difficulty);
  buildMap();
  SCENERY.build(G.scene);
  buildStructures();
  updateTowerProtection();
  setupJungle();
  setupInput();
  // 车道分配: 玩家中路;其余 上上/下下
  const laneOrder = [0,0,2,2];
  const pd = DATA.CHAMPS.find(c=>c.key===playerKey);
  G.player = spawnChampion(pd, 'blue', true, 1);
  // 联机模式:第二位玩家(由远端输入控制)
  if (opts.p2Key){
    const p2d = DATA.CHAMPS.find(c=>c.key===opts.p2Key);
    G.p2 = spawnChampion(p2d, 'blue', false, 0);
    G.p2.remote = true;
    G.p2.ai = null;
    NET.indexStructures();
    NET.installHostHooks();
  }
  allyKeys.forEach((k,i)=>{
    const d = DATA.CHAMPS.find(c=>c.key===k);
    spawnChampion(d, 'blue', false, laneOrder[i]!=null? laneOrder[i] : 1);
  });
  const enemyLanes = [1,0,0,2,2];
  enemyKeys.forEach((k,i)=>{
    const d = DATA.CHAMPS.find(c=>c.key===k);
    spawnChampion(d, 'red', false, enemyLanes[i]!=null? enemyLanes[i] : 1);
  });
  G.camPos.set(G.player.pos.x, 0, G.player.pos.z);
  G.running = true;
  G.clock = 0;
  UI.onGameStart();
  AUDIO.startMusic();
  UI.announce('欢迎来到宝可梦联盟! 摧毁敌方大师球基地获得胜利!', '#ffd94a');
  after(CONST.FIRST_WAVE-3, ()=>UI.announce('小拉达兵即将出击!', '#c0d8ff'));
  requestAnimationFrame(loop);
}

let lastT = 0, aiTick = 0, towerTick = 0, slowTick = 0;
function loop(t){
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (t-lastT)/1000 || 0.016);
  lastT = t;
  // 顿帧(大招命中的打击停顿)
  if (G.hitstop > 0){ G.hitstop -= dt; dt *= 0.15; }
  if (!G.running){
    // 结束后继续渲染特效
    FX.update(dt);
    if (G.renderer) G.renderer.render(G.scene, G.camera);
    return;
  }
  G.clock += dt;

  // 定时器
  for (let i=G.timers.length-1;i>=0;i--){
    if (G.clock >= G.timers[i].t){
      const fn = G.timers[i].fn;
      G.timers.splice(i,1);
      try{ fn(); }catch(e){ console.warn(e); }
    }
  }
  // 兵线
  G.waveT -= dt;
  if (G.waveT <= 0){ G.waveT = CONST.WAVE_INTERVAL; spawnWave(); }
  // 被动金币与经验
  if (G.clock > CONST.PASSIVE_GOLD_START)
    for (const c of G.champs) c.gold += CONST.PASSIVE_GOLD*dt;
  if (G.clock > CONST.PASSIVE_XP_START)
    for (const c of G.champs) if (!c.dead) c.addXp(CONST.PASSIVE_XP*dt);

  // AI 决策
  aiTick -= dt;
  const doAI = aiTick <= 0;
  if (doAI) aiTick = 0.1;
  // 单位更新
  for (const c of G.champs){
    if (!c.isPlayer && !c.remote && !c.dead) AI.update(c, dt);
    c.update(dt);
  }
  for (const m of G.minions){ if (doAI) minionAI(m); m.update(dt); }
  towerTick -= dt;
  if (towerTick<=0){ towerTick = 0.25; for (const tw of G.towers) towerAI(tw); }
  for (const tw of G.towers) tw.update(dt);
  for (const n of G.nexuses) n.update(dt);
  for (const j of G.jungles) j.update(dt);
  // 清理尸体(联机主机:先保证 die 消息已发出)
  const keepDead = window.NET && NET.role==='host';
  if (G.minions.some(m=>m.dead)) G.minions = G.minions.filter(m=>!m.dead || (keepDead && m.netId && !m._sentDead));
  if (G.jungles.some(j=>j.dead)) G.jungles = G.jungles.filter(j=>!j.dead || (keepDead && j.netId && !j._sentDead));

  fountainTick(dt);
  // 锁定目标光环
  if (G.selected && (G.selected.dead || !G.selectRing)){
    if (!G.selectRing){
      G.selectRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 32),
        new THREE.MeshBasicMaterial({color:0xff4040, transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false}));
      G.selectRing.rotation.x = -Math.PI/2;
      G.selectRing.position.y = 0.3;
      G.scene.add(G.selectRing);
    }
    if (G.selected.dead) G.selected = null;
  }
  if (G.selectRing){
    if (G.selected && !G.selected.dead){
      G.selectRing.visible = true;
      G.selectRing.position.set(G.selected.pos.x, 0.3, G.selected.pos.z);
      G.selectRing.scale.setScalar(G.selected.radius + 2.2 + Math.sin(G.clock*5)*0.25);
    } else G.selectRing.visible = false;
  }
  slowTick -= dt;
  if (slowTick <= 0){ slowTick = 0.5; jungleTick(); }

  FX.update(dt);
  SCENERY.update(dt);
  if (window.NET && NET.role==='host') NET.hostTick(dt);
  updateCamera(dt);
  UI.update(dt);
  G.renderer.render(G.scene, G.camera);
}

/* ============================================================
   联机客机:木偶世界(仅渲染/插值/特效,模拟全在主机)
   ============================================================ */
function startGuest(m){
  G.netRole = 'guest';
  buildMap();
  SCENERY.build(G.scene);
  buildStructures();
  setupInput();
  G.running = true;
  G.clock = 0;
  requestAnimationFrame(guestLoop);
}
let gLastT = 0;
function guestLoop(t){
  requestAnimationFrame(guestLoop);
  let dt = Math.min(0.05, (t-gLastT)/1000 || 0.016);
  gLastT = t;
  if (G.hitstop > 0){ G.hitstop -= dt; dt *= 0.15; }
  if (!G.running){
    FX.update(dt);
    if (G.renderer) G.renderer.render(G.scene, G.camera);
    return;
  }
  G.clock += dt;
  // 延迟特效定时器(AoE落点等)
  for (let i=G.timers.length-1;i>=0;i--){
    if (G.clock >= G.timers[i].t){
      const fn = G.timers[i].fn;
      G.timers.splice(i,1);
      try{ fn(); }catch(e){}
    }
  }
  for (const c of G.champs) c.puppetUpdate(dt);
  for (const mn of G.minions) mn.puppetUpdate(dt);
  for (const j of G.jungles) j.puppetUpdate(dt);
  for (const tw of G.towers) tw.update(dt);
  for (const n of G.nexuses) n.update(dt);
  // 锁定目标光环(与主循环相同)
  if (G.selected && G.selected.dead) G.selected = null;
  if (!G.selectRing && G.selected){
    G.selectRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 32),
      new THREE.MeshBasicMaterial({color:0xff4040, transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false}));
    G.selectRing.rotation.x = -Math.PI/2;
    G.scene.add(G.selectRing);
  }
  if (G.selectRing){
    if (G.selected){
      G.selectRing.visible = true;
      G.selectRing.position.set(G.selected.pos.x, 0.3, G.selected.pos.z);
      G.selectRing.scale.setScalar(G.selected.radius + 2.2 + Math.sin(G.clock*5)*0.25);
    } else G.selectRing.visible = false;
  }
  FX.update(dt);
  SCENERY.update(dt);
  updateCamera(dt);
  UI.update(dt);
  G.renderer.render(G.scene, G.camera);
}

/* ---------- 对外 API ---------- */
return {
  G, initRenderer, startGame, startGuest, netCast, addBot, buyItem, castSkill, playerCast, castSummoner, startRecall, aiShop,
  castSkillAI, respawnChampion, onUnitDeath, onNexusDestroyed, onChampCombat,
  unitsNear, champsOf, towersOf, nexusOf, enemyOf,
  now(){ return G.clock; },
  player(){ return G.player; },
  playerTeam(){ return 'blue'; },
  laneWaypoints(team, laneIdx){ return LANES[team][Math.max(0,Math.min(2,laneIdx))]; },
  canShop,
};
})();
const playerTeam = ()=>GAME.playerTeam();
