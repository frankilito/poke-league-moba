/* ============================================================
   宝可梦联盟 · 电脑角色 AI
   状态机: LANE 推线 / FIGHT 战斗 / RETREAT 撤退 / RECALL 回城 / BASE 购物
   ============================================================ */
window.AI = (function(){

const DIFF = {
  easy:   {decide:0.65, skillCh:0.45, ultCh:0.5,  aimErr:7,  retreat:0.22, dive:false},
  normal: {decide:0.40, skillCh:0.75, ultCh:0.8,  aimErr:3.5,retreat:0.30, dive:false},
  hard:   {decide:0.22, skillCh:0.95, ultCh:0.95, aimErr:1.4,retreat:0.34, dive:true},
};
let difficulty = 'normal';
function setDifficulty(d){ difficulty = d; }
function cfg(){ return DIFF[difficulty]; }

function initBot(bot){
  bot.ai = {state:'LANE', decideT:Math.random()*0.4, wpIdx:0, shopped:false, retreatUntil:0};
}

function hpPct(u){ return u.hp/u.maxHp; }

/* 评估某点附近的敌我战力 */
function threatAt(bot, pos, r){
  const enemies = GAME.champsOf(GAME.enemyOf(bot.team)).filter(c=>!c.dead && !c.stealthed && c.pos.distanceTo(pos)<r);
  const allies = GAME.champsOf(bot.team).filter(c=>!c.dead && c.pos.distanceTo(pos)<r);
  let e=0, a=0;
  for (const c of enemies) e += c.hp + c.level*80;
  for (const c of allies) a += c.hp + c.level*80;
  return {enemies, allies, score: a - e};
}

function nearestEnemyTower(bot, r){
  let best=null, bd=r||60;
  for (const t of GAME.towersOf(GAME.enemyOf(bot.team))){
    if (t.dead) continue;
    const d = bot.distTo(t);
    if (d < bd){ bd = d; best = t; }
  }
  return best;
}

/* 选攻击目标:优先残血英雄 > 塔下安全判断 > 小兵/塔 */
function pickTarget(bot){
  const c = cfg();
  const enemies = GAME.unitsNear(bot.pos, 34, u=>u.team===GAME.enemyOf(bot.team) && !u.dead && !u.stealthed);
  const champs = enemies.filter(u=>u.kind==='champ');
  const creeps = enemies.filter(u=>u.kind==='minion' || u.kind==='jungle');
  const towers = enemies.filter(u=>u.kind==='tower' && !u.protected_ || u.kind==='tower' && !u.protected_);
  const structs = enemies.filter(u=>(u.kind==='tower'||u.kind==='nexus') && !u.protected_);

  // 英雄目标:塔下别追(除非困难难度且对面快死)
  let champTarget = null;
  if (champs.length){
    champs.sort((a,b)=>hpPct(a)-hpPct(b));
    const t = champs[0];
    const underTower = nearestEnemyTower(bot, 40) && t.distTo(nearestEnemyTower(bot,40)) < 38;
    if (!underTower || (c.dive && hpPct(t) < 0.2) ) champTarget = t;
  }
  if (champTarget) return champTarget;
  if (creeps.length){
    creeps.sort((a,b)=>a.hp-b.hp);
    return creeps[0];
  }
  if (structs.length){
    structs.sort((a,b)=>bot.distTo(a)-bot.distTo(b));
    return structs[0];
  }
  return null;
}

/* 技能释放决策 */
function useSkills(bot, target){
  const c = cfg();
  if (bot.silenced || bot.channel) return;
  for (let i=0;i<4;i++){
    const s = bot.skills[i];
    if (s.lvl<=0 || s.cd>0) continue;
    const def = s.def;
    if (bot.mana < (def.mana||0)) continue;
    if (Math.random() > (i===3? c.ultCh : c.skillCh)) continue;
    const p = def.pattern;
    const dist = target? bot.distTo(target) : 999;

    // 增益/护盾/治疗类
    if (p==='buff'){
      if (target && dist < 26){ GAME.castSkillAI(bot, i, bot.pos, bot); return; }
      continue;
    }
    if (p==='channelheal'){
      if (hpPct(bot) < 0.5 && (!target || dist > 20)){ GAME.castSkillAI(bot, i, bot.pos, bot); return; }
      continue;
    }
    if (p==='healaoe'){
      const hurtAllies = GAME.champsOf(bot.team).filter(a=>!a.dead && a.pos.distanceTo(bot.pos)<(def.radius||20) && hpPct(a)<0.62);
      if (hurtAllies.length){ GAME.castSkillAI(bot, i, bot.pos, bot); return; }
      continue;
    }
    if (!target) continue;

    // 大招人数/斩杀判断
    if (i===3){
      if (def.pattern==='nova' || def.pattern==='zone'){
        const around = GAME.unitsNear(bot.pos, def.radius||18, u=>u.kind==='champ' && u.team===GAME.enemyOf(bot.team) && !u.dead);
        if (around.length < 1 || (around.length<2 && hpPct(around[0]||target)>0.55)) continue;
      } else if (target.kind==='champ' ? hpPct(target) > 0.62 : true){
        if (!(target.kind==='champ')) continue;
        continue;
      }
    }

    // 射程判断 + 预判
    const range = def.range || 20;
    if (dist > range + (target.radius||1)) continue;
    const aim = target.pos.clone();
    if (def.speed && target.getMS){
      const flight = dist/def.speed;
      if (target.moving && target.moveTarget){
        const d = target.moveTarget.clone().sub(target.pos); d.y=0;
        if (d.lengthSq()>0.1){ d.normalize(); aim.addScaledVector(d, target.getMS()*flight*0.85); }
      }
    }
    const err = c.aimErr;
    aim.x += (Math.random()-0.5)*err; aim.z += (Math.random()-0.5)*err;

    if (p==='dash' || p==='blink'){
      // 进攻性位移:仅当血量健康
      if (hpPct(bot) < 0.45) continue;
      if (dist > 14 && dist < range+8){ GAME.castSkillAI(bot, i, aim, target); return; }
      continue;
    }
    GAME.castSkillAI(bot, i, aim, target);
    return;
  }
}

/* 逃生技能 */
function useEscape(bot, threat){
  if (bot.silenced || bot.channel) return;
  const away = bot.pos.clone().sub(threat.pos.clone()); away.y=0;
  if (away.lengthSq()<0.1) away.set(1,0,0);
  away.normalize();
  for (let i=0;i<4;i++){
    const s = bot.skills[i];
    if (s.lvl<=0 || s.cd>0 || bot.mana<(s.def.mana||0)) continue;
    if (s.def.pattern==='dash' || s.def.pattern==='blink'){
      const dst = bot.pos.clone().addScaledVector(away, s.def.range||30);
      GAME.castSkillAI(bot, i, dst, null);
      return;
    }
  }
  // 召唤师闪现
  if (bot.summCd.F<=0 && hpPct(bot)<0.2 && bot.distTo(threat)<14){
    GAME.castSummoner(bot, 'F', bot.pos.clone().addScaledVector(away, 20));
  }
}

function decide(bot){
  const c = cfg();
  const me = bot;
  const enemyTeam = GAME.enemyOf(me.team);
  const home = me.homePos;
  const threat = threatAt(me, me.pos, 34);
  const nearestFoe = threat.enemies.sort((a,b)=>me.distTo(a)-me.distTo(b))[0];

  // 召唤师治疗
  if (hpPct(me) < 0.26 && me.summCd.D<=0) GAME.castSummoner(me, 'D', null);

  // ---- 状态切换 ----
  const atBase = me.pos.distanceTo(home) < 14;
  if (atBase && (me.recallT<=0)){
    // 购物 & 补给
    GAME.aiShop(me);
    if (hpPct(me) > 0.92 && me.mana/me.maxMana > 0.8) me.ai.state = 'LANE';
    else { me.ai.state = 'BASE'; me.moveTarget = null; me.attackTarget = null; return; }
  }

  const lowHp = hpPct(me) < c.retreat;
  const outnumbered = threat.enemies.length >= threat.allies.length + 2 && threat.enemies.length >= 2;
  if ((lowHp || outnumbered) && me.ai.state !== 'RECALL'){
    me.ai.state = 'RETREAT';
    me.ai.retreatUntil = GAME.now() + 2.2;
  }

  switch (me.ai.state){
    case 'RETREAT': {
      me.attackTarget = null;
      if (nearestFoe && me.distTo(nearestFoe) < 20) useEscape(me, nearestFoe);
      // 往家撤
      me.moveTo(home);
      const safe = !nearestFoe || me.distTo(nearestFoe) > 42;
      if (safe && GAME.now() > me.ai.retreatUntil){
        if (hpPct(me) < 0.5){ me.ai.state = 'RECALL'; GAME.startRecall(me); }
        else me.ai.state = 'LANE';
      }
      return;
    }
    case 'RECALL': {
      me.moveTarget = null; me.attackTarget = null;
      if (nearestFoe && me.distTo(nearestFoe) < 26){ me.ai.state = 'RETREAT'; me.moveTo(home); }
      else if (me.recallT<=0 && me.pos.distanceTo(home)<14) me.ai.state = 'BASE';
      else if (me.recallT<=0) GAME.startRecall(me);
      return;
    }
    case 'BASE': return; // 等待回血,下个tick重新评估
  }

  // ---- 防守:基地遭真正威胁时(敌方英雄入侵或大股兵线),派最近的2-3人回防,其余继续分路 ----
  const base = GAME.nexusOf(me.team);
  if (base && !base.dead){
    const champInv = GAME.unitsNear(base.pos, 55, u=>u.team===enemyTeam && !u.dead && u.kind==='champ').length;
    const minionInv = GAME.unitsNear(base.pos, 45, u=>u.team===enemyTeam && !u.dead && u.kind==='minion').length;
    const threat = champInv >= 1 && (champInv + minionInv) >= 3 ? 3 : minionInv >= 7 ? 2 : 0;
    if (threat > 0){
      const defenders = GAME.champsOf(me.team).filter(c=>!c.dead)
        .sort((a,b)=>a.pos.distanceTo(base.pos)-b.pos.distanceTo(base.pos))
        .slice(0, threat);
      if (defenders.includes(me) && me.pos.distanceTo(base.pos) > 60){
        me.ai.state = 'LANE';
        me.moveTo(base.pos);
        return;
      }
    }
  }

  // ---- 战斗 ----
  const target = pickTarget(me);
  if (target){
    me.ai.state = 'FIGHT';
    me.attackTarget = target;
    useSkills(me, target);
    // 走位:远程且目标太近则风筝
    if (me.ranged && target.kind!=='tower' && target.kind!=='nexus'){
      const d = me.distTo(target);
      if (d < me.getRange()*0.5 && me.atkCdT > 0.25){
        const away = me.pos.clone().sub(target.pos); away.y=0; away.normalize();
        const p = me.pos.clone().addScaledVector(away, 8);
        me.attackTarget = null;
        me.moveTo(p);
        me.ai.kiteT = GAME.now()+0.5;
        setTimeout(()=>{},0);
      }
    }
    return;
  }

  // ---- 分路推进:投影到最近路段,永远朝该段终点走(无回头/无震荡) ----
  me.ai.state = 'LANE';
  const wps = GAME.laneWaypoints(me.team, me.laneIdx);
  let segI = 0, segD = 1e9;
  for (let i=0;i<wps.length-1;i++){
    const ax=wps[i].x, az=wps[i].z, bx=wps[i+1].x, bz=wps[i+1].z;
    const abx=bx-ax, abz=bz-az;
    const L2 = abx*abx+abz*abz || 1;
    let tt = ((me.pos.x-ax)*abx + (me.pos.z-az)*abz)/L2;
    tt = Math.max(0, Math.min(1, tt));
    const d = Math.hypot(me.pos.x-(ax+abx*tt), me.pos.z-(az+abz*tt));
    if (d < segD){ segD = d; segI = i; }
  }
  let idx = segI + 1;
  if (idx < wps.length-1 && Math.hypot(me.pos.x-wps[idx].x, me.pos.z-wps[idx].z) < 10) idx++;
  me.ai.wpIdx = idx;
  me.moveTo(wps[idx]);
}

function update(bot, dt){
  if (bot.dead){ return; }
  if (!bot.ai) initBot(bot);
  bot.ai.decideT -= dt;
  if (bot.ai.decideT <= 0){
    bot.ai.decideT = cfg().decide * (0.8+Math.random()*0.4);
    try{ decide(bot); }catch(e){ console.warn('AI error', e); }
  }
}

/* 重生后重置 */
function onRespawn(bot){
  if (bot.ai){ bot.ai.state = 'BASE'; bot.ai.wpIdx = 0; }
}

return {update, initBot, setDifficulty, onRespawn, get difficulty(){return difficulty;}};
})();
