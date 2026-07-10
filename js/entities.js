/* ============================================================
   宝可梦联盟 · 实体模块
   模型加载 / 单位基类 / 英雄 / 小兵 / 防御塔 / 基地 / 野怪
   ============================================================ */
window.ENT = (function(){
const {CONST, TOWERS} = DATA;

/* ---------- 模型加载与归一化 ---------- */
const modelCache = {};   // id -> {scene, animations, scaleFor(height)}
function loadModels(ids, onProgress){
  const loader = new THREE.GLTFLoader();
  if (THREE.DRACOLoader){
    const draco = new THREE.DRACOLoader();
    draco.setDecoderPath('js/draco/');
    loader.setDRACOLoader(draco);
  }
  let done = 0;
  const jobs = ids.map(id => new Promise(res=>{
    loader.load('assets/models/'+id+'.glb', gltf=>{
      const root = gltf.scene;
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3(); box.getSize(size);
      const center = new THREE.Vector3(); box.getCenter(center);
      modelCache[id] = {
        scene: root, animations: gltf.animations||[],
        rawH: Math.max(0.001, size.y), rawCx: center.x, rawCz: center.z, rawMinY: box.min.y,
      };
      done++; if (onProgress) onProgress(done, ids.length);
      res();
    }, undefined, err=>{
      console.warn('模型加载失败', id, err);
      modelCache[id] = null;
      done++; if (onProgress) onProgress(done, ids.length);
      res();
    });
  }));
  return Promise.all(jobs);
}

function instantiate(id, height, tint){
  const tpl = modelCache[id];
  const group = new THREE.Group();
  let mixer = null;
  if (tpl){
    const root = (THREE.SkeletonUtils && THREE.SkeletonUtils.clone)? THREE.SkeletonUtils.clone(tpl.scene) : tpl.scene.clone(true);
    const s = height / tpl.rawH;
    root.scale.setScalar(s);
    root.position.set(-tpl.rawCx*s, -tpl.rawMinY*s, -tpl.rawCz*s);
    root.traverse(o=>{
      if (o.isMesh){
        o.castShadow = true;
        if (tint && o.material){
          o.material = o.material.clone();
          if (o.material.emissive) o.material.emissive = new THREE.Color(tint).multiplyScalar(0.25);
        }
      }
    });
    group.add(root);
    if (tpl.animations.length){
      mixer = new THREE.AnimationMixer(root);
      const clip = tpl.animations.find(a=>/idle|wait/i.test(a.name)) || tpl.animations[0];
      const act = mixer.clipAction(clip);
      act.time = Math.random()*clip.duration;
      act.play();
    }
  } else {
    // 兜底:胶囊体
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(height*0.28, height*0.5, 4, 10),
      new THREE.MeshLambertMaterial({color: tint||0x999999}));
    m.position.y = height*0.5; m.castShadow = true;
    group.add(m);
  }
  return {group, mixer};
}

/* ---------- 血条 ---------- */
function makeHpBar(unit, w, h){
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 30;
  const g = cv.getContext('2d');
  const t = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({map:t, transparent:true, depthWrite:false, depthTest:false});
  const sp = new THREE.Sprite(mat);
  sp.scale.set(w||7, (w||7)*30/128, 1);
  sp.renderOrder = 900;
  return {sprite:sp, cv, g, t, dirty:true, lastHp:-1, lastSh:-1, lastLvl:-1, lastMana:-1};
}
function drawHpBar(unit){
  const b = unit.bar; if (!b) return;
  const g = b.g, W = 128, H = 30;
  g.clearRect(0,0,W,H);
  const isChamp = unit.kind==='champ';
  const barY = isChamp? 6 : 9, barH = isChamp? 11 : 12;
  let x0 = 0;
  // 等级框
  if (isChamp){
    g.fillStyle = '#1a1a2e';
    g.fillRect(0, 2, 20, 20);
    g.strokeStyle = '#c8a028'; g.lineWidth = 2; g.strokeRect(1,3,18,18);
    g.fillStyle = '#ffe97a'; g.font = 'bold 13px sans-serif'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText(unit.level, 10, 13);
    x0 = 22;
  }
  const bw = W - x0 - 2;
  // 底
  g.fillStyle = 'rgba(10,10,20,0.85)';
  g.fillRect(x0, barY-2, bw+2, barH+4 + (isChamp?7:0));
  // HP
  const pct = Math.max(0, unit.hp/unit.maxHp);
  let color = unit.barColor;
  g.fillStyle = color;
  g.fillRect(x0+1, barY, bw*pct, barH);
  // 刻度(每200血)
  g.fillStyle = 'rgba(0,0,0,0.45)';
  for (let v=200; v<unit.maxHp; v+=200){
    const xx = x0+1 + bw*(v/unit.maxHp);
    g.fillRect(xx, barY, 1, barH);
  }
  // 护盾
  const sh = unit.shieldTotal();
  if (sh > 0){
    const spct = Math.min(1-0.0, sh/unit.maxHp);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    const sx = x0+1+bw*pct;
    g.fillRect(sx, barY, Math.min(bw*spct, bw-bw*pct), barH);
  }
  // 蓝条
  if (isChamp){
    g.fillStyle = '#2050a0';
    g.fillRect(x0+1, barY+barH+2, bw*(unit.mana/unit.maxMana), 4);
  }
  b.t.needsUpdate = true;
}

/* ---------- 单位基类 ---------- */
let UID = 1;
class Unit {
  constructor(o){
    this.uid = UID++;
    this.kind = o.kind||'unit';
    this.name = o.name||'?';
    this.team = o.team;                       // 'blue' | 'red' | 'neutral'
    this.pos = new THREE.Vector3(o.x||0, 0, o.z||0);
    this.height = o.height||4;
    this.radius = o.radius|| this.height*0.32;
    this.maxHp = o.hp; this.hp = o.hp;
    this.baseMs = o.ms||22;
    this.baseRange = o.range||8;
    this.baseAs = o.as||0.7;
    this.dmg = o.dmg||10;
    this.def = o.def||0; this.sdef = o.sdef||0;
    this.atkType = o.atkType||'physical';
    this.pokeId = o.pokeId||null;
    this.ranged = o.ranged!=null? o.ranged : (this.baseRange > 14);
    this.projColor = o.projColor||0xffffff;
    this.buffs = [];
    this.shields = [];
    this.dead = false;
    this.moveTarget = null;
    this.attackTarget = null;
    this.atkCdT = 0;
    this.windup = 0;         // 攻击前摇剩余
    this.windupTarget = null;
    this.lastAttacker = null;
    this.aggroList = new Map();   // 伤害记录(助攻)
    this.facing = 0;
    this.bobT = Math.random()*10;
    this.model = null; this.mixer = null;
    this.bar = null;
    this.hpRegen = o.hpRegen||0;
    this.xpReward = o.xp||0;
    this.goldReward = o.gold||0;
    this.knock = null;    // {vel(V3), t}
  }
  get barColor(){
    if (this.team === 'neutral') return '#c8a0f0';
    const myTeam = GAME.playerTeam();
    if (this === GAME.player()) return '#ffd94a';
    return this.team === myTeam ? '#37c86e' : '#e84040';
  }
  buildModel(scene, tint){
    const inst = instantiate(this.pokeId, this.height, tint);
    this.model = inst.group; this.mixer = inst.mixer;
    this.model.position.copy(this.pos);
    scene.add(this.model);
    this.bar = makeHpBar(this, this.kind==='champ'? 8.5 : 6);
    this.bar.sprite.position.y = this.height + 2.2;
    this.model.add(this.bar.sprite);
    drawHpBar(this);
  }
  shieldTotal(){ return this.shields.reduce((a,s)=>a+s.amt, 0); }
  hasFlag(f){ return this.buffs.some(b=>b[f]); }
  get stunned(){ return this.hasFlag('stun') || this.hasFlag('sleep') || this.hasFlag('knockup') || this.hasFlag('charm'); }
  get rooted(){ return this.hasFlag('root'); }
  get silenced(){ return this.hasFlag('silence'); }
  get stealthed(){ return this.hasFlag('stealth'); }
  buffStat(key){
    let v = 0;
    for (const b of this.buffs){ if (b.stats && b.stats[key]) v += b.stats[key]; }
    return v;
  }
  slowFactor(){
    let worst = 0;
    for (const b of this.buffs){ if (b.slowPct) worst = Math.max(worst, b.slowPct); }
    return 1 - worst;
  }
  getMS(){ return Math.max(6, (this.baseMs + this.buffStat('msFlat')) * (1 + this.buffStat('ms')) * this.slowFactor()); }
  getAS(){ return Math.min(2.5, this.baseAs * (1 + this.buffStat('as'))); }
  getRange(){ return this.baseRange; }
  getDef(){ return Math.max(0, this.def + this.buffStat('def')); }
  getSdef(){ return Math.max(0, this.sdef + this.buffStat('sdef')); }
  getAtkDmg(){ return this.dmg + this.buffStat('atk') + this.buffStat('sp'); }
  dmgAmp(){ let v = 1; for (const b of this.buffs){ if (b.dmgAmp) v += b.dmgAmp; } return v; }

  addBuff(b){
    b.t = 0;
    if (b.id){
      const old = this.buffs.find(x=>x.id===b.id);
      if (old){ Object.assign(old, b); old.t = 0; this.markBar(); return old; }
    }
    this.buffs.push(b);
    this.markBar();
    return b;
  }
  addShield(amt, dur){
    this.shields.push({amt, dur, t:0});
    this.markBar();
  }
  markBar(){ if (this.bar) this.bar.dirty = true; }

  takeDamage(amt, type, src, opts){
    if (this.dead || amt<=0) return 0;
    if (window.GAME && GAME.G.netRole==='guest') return 0;   // 客机不做本地结算
    opts = opts||{};
    let dmg = amt;
    if (src && src.dmgAmp) dmg *= src.dmgAmp();
    if (type==='phys') dmg *= 100/(100+this.getDef());
    else if (type==='spec') dmg *= 100/(100+this.getSdef());
    if (this.dmgTakenMul) dmg *= this.dmgTakenMul;
    dmg = Math.max(1, Math.round(dmg));
    // 睡眠被打醒
    for (let i=this.buffs.length-1;i>=0;i--) if (this.buffs[i].sleep) this.buffs.splice(i,1);
    // 护盾吸收
    let rest = dmg;
    for (const s of this.shields){
      const use = Math.min(s.amt, rest);
      s.amt -= use; rest -= use;
      if (rest<=0) break;
    }
    this.shields = this.shields.filter(s=>s.amt>0.5);
    // 气势披带
    if (rest >= this.hp && this.cheatDeathReady && this.kind==='champ'){
      this.cheatDeathReady = false;
      this.cheatDeathCd = 180;
      this.hp = 1;
      this.addShield(this.maxHp*0.25, 3);
      FX.shieldBubble(this, 3, 0xffd94a);
      FX.healBurst(this, 0xffd94a);
      if (this.isPlayer) UI.announce('气势披带发动!', '#ffd94a');
      rest = 0;
    }
    this.hp -= rest;
    this.markBar();
    if (src){
      this.lastAttacker = src;
      if (src.kind==='champ') this.aggroList.set(src.uid, GAME.now());
      if (this.kind==='champ' && src.kind==='champ') GAME.onChampCombat(this, src);
    }
    UI.floatDmg(this, dmg, type, opts.crit, src);
    if (this.hitFlashT!=null) this.hitFlashT = 0.12;
    if (this.hp <= 0) this.die(src);
    return dmg;
  }
  heal(amt){
    if (this.dead) return;
    if (window.GAME && GAME.G.netRole==='guest') return;
    const real = Math.min(amt, this.maxHp - this.hp);
    this.hp += real;
    if (real > 2) UI.floatDmg(this, Math.round(real), 'heal');
    this.markBar();
  }
  die(killer){
    if (this.dead) return;
    this.dead = true;
    this.attackTarget = null; this.moveTarget = null;
    FX.deathPoof(this.pos, this.projColor);
    GAME.onUnitDeath(this, killer);
    if (this.pokeId && this.kind!=='minion') AUDIO.playCry(this.pokeId, 0.3);
    this.removeModel();
  }
  removeModel(){
    if (this.model && this.model.parent) this.model.parent.remove(this.model);
  }
  moveTo(p){
    this.moveTarget = new THREE.Vector3(p.x, 0, p.z);
  }
  faceToward(x, z){
    const dx = x-this.pos.x, dz = z-this.pos.z;
    if (Math.abs(dx)+Math.abs(dz) > 0.01) this.facing = Math.atan2(dx, dz);
  }
  distTo(u){ const dx=this.pos.x-u.pos.x, dz=this.pos.z-u.pos.z; return Math.sqrt(dx*dx+dz*dz); }
  inAttackRange(u){ return this.distTo(u) <= this.getRange() + this.radius + u.radius; }

  /* 联机客机:木偶更新(位置插值+攻击视觉+模型同步,无任何数值模拟) */
  puppetUpdate(dt){
    if (this.dead) return;
    if (this.netPos) this.pos.lerp(this.netPos, Math.min(1, dt*9));
    if (this.netFacing != null && !this.attackTarget) this.facing = this.netFacing;
    if (this.atkCdT > 0) this.atkCdT -= dt;
    if (this.windup > 0){
      this.windup -= dt;
      if (this.windup <= 0 && this.windupTarget && !this.windupTarget.dead)
        this.resolveAttack(this.windupTarget);
    }
    if (this.attackTarget && !this.attackTarget.dead && this.inAttackRange(this.attackTarget)){
      this.faceToward(this.attackTarget.pos.x, this.attackTarget.pos.z);
      this.tryAttack(this.attackTarget);
    }
    this.moving = !!this.netMoving;
    // 增益视觉计时(仅清理,不结算)
    for (let i=this.buffs.length-1;i>=0;i--){
      const b = this.buffs[i]; b.t += dt;
      if (b.t >= b.dur) this.buffs.splice(i,1);
    }
    this.syncModel(dt);
  }

  /* 通用更新:增益/位移/攻击/模型 */
  update(dt){
    if (this.dead) return;
    // 增益计时
    for (let i=this.buffs.length-1;i>=0;i--){
      const b = this.buffs[i];
      b.t += dt;
      if (b.dot){
        b.dotAcc = (b.dotAcc||0) + dt;
        if (b.dotAcc >= 0.5){
          b.dotAcc -= 0.5;
          this.takeDamage(b.dot.dps*0.5, b.dot.type||'spec', b.dot.src);
        }
      }
      if (b.hpPerSec) this.heal(b.hpPerSec*dt);
      if (b.t >= b.dur){ this.buffs.splice(i,1); this.markBar(); }
    }
    if (this.dead) return; // DOT 可能致死
    for (let i=this.shields.length-1;i>=0;i--){
      const s = this.shields[i]; s.t += dt;
      if (s.t >= s.dur){ this.shields.splice(i,1); this.markBar(); }
    }
    if (this.hpRegen) this.heal(this.hpRegen*dt*0.999);
    if (this.atkCdT > 0) this.atkCdT -= dt;

    // 击退/击飞位移
    if (this.knock){
      this.pos.addScaledVector(this.knock.vel, dt);
      this.knock.t -= dt;
      if (this.knock.t <= 0) this.knock = null;
      this.clampMap();
    }
    // 魅惑:被迫走向来源
    const charm = this.buffs.find(b=>b.charm);
    if (charm && charm.src && !charm.src.dead){
      const d = charm.src.pos.clone().sub(this.pos); d.y = 0;
      if (d.length() > 3){
        d.normalize();
        this.pos.addScaledVector(d, this.getMS()*0.55*dt);
        this.faceToward(charm.src.pos.x, charm.src.pos.z);
      }
    }
    // 攻击前摇结算
    if (this.windup > 0){
      this.windup -= dt;
      if (this.windup <= 0 && this.windupTarget && !this.windupTarget.dead){
        this.resolveAttack(this.windupTarget);
      }
    }
    // 常规移动
    if (!this.stunned && !this.knock){
      let goal = null;
      if (this.attackTarget && !this.attackTarget.dead){
        if (this.inAttackRange(this.attackTarget)){
          this.faceToward(this.attackTarget.pos.x, this.attackTarget.pos.z);
          this.tryAttack(this.attackTarget);
        } else if (!this.rooted){
          goal = this.attackTarget.pos;
        }
      } else if (this.moveTarget && !this.rooted){
        goal = this.moveTarget;
      }
      if (goal){
        const d = new THREE.Vector3(goal.x-this.pos.x, 0, goal.z-this.pos.z);
        const dist = d.length();
        if (dist < 0.6){ this.moveTarget = null; }
        else {
          d.normalize();
          this.pos.addScaledVector(d, Math.min(dist, this.getMS()*dt));
          this.faceToward(goal.x, goal.z);
          this.moving = true;
        }
      } else this.moving = false;
    }
    this.clampMap();
    this.syncModel(dt);
  }
  clampMap(){
    const H = CONST.MAP_HALF - 2;
    this.pos.x = Math.max(-H, Math.min(H, this.pos.x));
    this.pos.z = Math.max(-H, Math.min(H, this.pos.z));
  }
  tryAttack(target){
    if (this.atkCdT > 0 || this.windup > 0 || this.stunned) return;
    const as = this.getAS();
    this.atkCdT = 1/as;
    this.windup = Math.min(0.3, 0.3/as);
    this.windupTarget = target;
    this.attackAnimT = 0.32;
  }
  resolveAttack(target){
    if (this.dead || target.dead || this.distTo(target) > this.getRange()+this.radius+target.radius+4) return;
    const from = new THREE.Vector3(this.pos.x, this.height*0.55, this.pos.z);
    if (this.ranged){
      FX.projectile({from, target, speed:95, color:this.projColor, size:this.kind==='champ'?2.4:1.6,
        tex:this.projTex||'glow',
        onArrive:(p,t)=>{ if (t && !t.dead) this.applyAAHit(t); }});
    } else {
      FX.slashArc(this.pos, this.facing===0?0.0001:this.facing, {range:this.getRange()+target.radius+2, color:this.projColor, arc:1.2, y:this.height*0.45});
      this.applyAAHit(target);
    }
    if (this.kind==='champ' && this.isPlayer) AUDIO.play('cast');
  }
  applyAAHit(target){
    let dmg = this.getAtkDmg();
    let crit = false;
    const critCh = this.critChance? this.critChance() : 0;
    if (critCh && Math.random() < critCh){ dmg *= 1.8; crit = true; }
    // 强化普攻
    const emp = this.buffs.find(b=>b.empower);
    if (emp){ dmg *= (1+emp.empower); this.buffs.splice(this.buffs.indexOf(emp),1);
      FX.burst(target.pos, {count:8, tex:'spark', color:0xffe97a, size:1.6, speed:10, up:0.8, life:0.4}); }
    const type = this.atkType==='special'? 'spec':'phys';
    const dealt = target.takeDamage(dmg, type, this, {crit});
    // 吸血
    const ls = this.lifesteal? this.lifesteal() : 0;
    if (ls) this.heal(dealt*ls);
    // 装备/红buff 特效
    for (const b of this.buffs){
      if (b.onhitBurn) target.addBuff({id:'redburn', name:'岩之怒火', dur:2, dot:{dps:b.onhitBurn, type:'true', src:this}});
      if (b.onhitSlowPct) target.addBuff({id:'redslow', name:'减速', dur:1.2, slowPct:b.onhitSlowPct});
    }
    if (this.itemOnHit) this.itemOnHit(target);
    // 反甲
    if (target.thorns && !this.ranged){
      this.takeDamage(dealt*target.thorns, 'phys', target);
    }
    if (crit) AUDIO.play('crit');
    else if (this.isPlayer || (target.isPlayer)) AUDIO.play('hit');
    FX.burst(target.pos, {count:3, tex:'glow', color:this.projColor, size:1.1, speed:6, up:0.6, life:0.3, yOff:target.height*0.5});
  }
  syncModel(dt){
    if (!this.model) return;
    this.bobT += dt;
    let y = 0;
    // 程序化动画:移动摆动 / 攻击突进
    if (this.moving) y = Math.abs(Math.sin(this.bobT*9))*0.5;
    if (this.attackAnimT > 0){
      this.attackAnimT -= dt;
      const k = Math.sin((0.32-this.attackAnimT)/0.32*Math.PI);
      this.model.position.set(
        this.pos.x + Math.sin(this.facing)*k*1.2, y,
        this.pos.z + Math.cos(this.facing)*k*1.2);
    } else {
      this.model.position.set(this.pos.x, y + (this.hoverY||0), this.pos.z);
    }
    // 击飞
    const ku = this.buffs.find(b=>b.knockup);
    if (ku) this.model.position.y += Math.sin(Math.min(1,ku.t/ku.dur)*Math.PI)*4;
    // 转向
    let diff = this.facing - this.model.rotation.y;
    while (diff > Math.PI) diff -= Math.PI*2;
    while (diff < -Math.PI) diff += Math.PI*2;
    this.model.rotation.y += diff*Math.min(1, dt*10);
    if (this.mixer) this.mixer.update(dt);
    // 受击闪白
    if (this.hitFlashT > 0) this.hitFlashT -= dt;
    // 隐身透明
    const alpha = this.stealthed? 0.35 : 1;
    if (alpha !== this._lastAlpha){
      this._lastAlpha = alpha;
      this.model.traverse(o=>{
        if (o.isMesh && o.material){ o.material.transparent = alpha<1||o.material.transparent; o.material.opacity = alpha; }
      });
    }
    if (this.bar && this.bar.dirty){ this.bar.dirty = false; drawHpBar(this); }
  }
}

/* ---------- 英雄 ---------- */
class Champion extends Unit {
  constructor(data, team, isPlayer, o){
    super({kind:'champ', name:data.name, team, x:o.x, z:o.z,
      hp:data.hp, ms:data.ms, range:data.range, as:data.as, dmg: data.atk,
      def:data.def, sdef:data.sdef, height:data.height, pokeId:data.id,
      atkType:data.atkType, ranged:data.ranged});
    this.data = data;
    this.isPlayer = !!isPlayer;
    this.level = 1; this.xp = 0;
    this.gold = CONST.START_GOLD;
    this.items = [];
    this.kills = 0; this.deaths = 0; this.assists = 0; this.cs = 0;
    this.skills = data.skills.map(s=>({def:s, lvl:0, cd:0}));
    this.skillPoints = 1;
    this.summCd = {D:0, F:0};
    this.respawnT = 0;
    this.recallT = 0; this.recallFx = null;
    this.homePos = new THREE.Vector3(o.x, 0, o.z);
    this.laneIdx = o.laneIdx!=null? o.laneIdx : 1;
    this.xpBoost = 0;
    this.cheatDeathReady = false; this.cheatDeathCd = 0;
    this.hitFlashT = 0;
    this.channel = null;   // {name, t, dur, tick, onTick, onEnd, moveCancels}
    this.projTex = {'电':'spark','火':'flame','水':'bubble','草':'leaf','冰':'snow','超':'glow','鬼':'soft','龙':'glow'}[data.types[0]]||'glow';
    this.projColor = parseInt(DATA.TYPE_COLOR[data.types[0]].slice(1),16);
    this.computeStats(true);
  }
  itemStat(key){
    let v = 0;
    for (const it of this.items){ if (it.stats && it.stats[key]) v += it.stats[key]; }
    return v;
  }
  computeStats(full){
    const d = this.data, L = this.level-1;
    const hpMax = d.hp + d.hpL*L + this.itemStat('hp');
    if (full){ this.hp = hpMax; }
    else { this.hp = Math.min(this.hp, hpMax); }
    this.maxHp = hpMax;
    this.maxMana = d.mp + d.mpL*L;
    if (full) this.mana = this.maxMana;
    else this.mana = Math.min(this.mana, this.maxMana);
    this.atk = d.atk + d.atkL*L + this.itemStat('atk');
    this.sp  = d.atk*0.2 + d.atkL*L + this.itemStat('sp');   // 特攻成长
    this.def = d.def + d.defL*L + this.itemStat('def');
    this.sdef = d.sdef + d.sdefL*L + this.itemStat('sdef');
    this.baseAs = (d.as + d.asL*L) * (1 + this.itemStat('as'));
    this.baseMs = d.ms * (1 + this.itemStat('ms'));
    this.hpRegen = 1.2 + L*0.12 + this.itemStat('hpregen');
    this.mpRegen = 4 + L*0.35 + this.itemStat('mpregen');
    this.xpBoost = this.items.some(i=>i.xpBoost)? 0.4 : 0;
    this.thorns = this.items.reduce((a,i)=>a+(i.thorns||0),0);
    this.cheatDeathReady = this.items.some(i=>i.cheatDeath) && this.cheatDeathCd<=0;
    this.markBar();
  }
  // 主输出属性(物攻手用atk,特攻手用sp)
  getAtkDmg(){
    const base = this.atkType==='special'
      ? this.data.atk + this.data.atkL*(this.level-1) + this.itemStat('sp')
      : this.atk;
    return base + this.buffStat('atk') + this.buffStat('sp');
  }
  powerStat(){ // 技能加成属性
    return this.atkType==='special'
      ? this.data.atk*0.9 + this.data.atkL*(this.level-1) + this.itemStat('sp') + this.buffStat('sp')
      : this.atk*0.9 + this.buffStat('atk');
  }
  critChance(){ return this.itemStat('crit'); }
  lifesteal(){ return this.itemStat('lifesteal') + this.buffStat('lifesteal'); }
  cdrFactor(){ return Math.max(0.5, 1 - (this.itemStat('cdr') + this.buffStat('cdr'))); }
  itemOnHit(target){
    for (const it of this.items){
      if (it.onhitSlow) target.addBuff({id:'krock', name:'王者之证', dur:it.onhitSlow.dur, slowPct:it.onhitSlow.pct});
    }
  }
  addXp(amt){
    if (this.level >= CONST.MAX_LEVEL) return;
    this.xp += amt*(1+this.xpBoost);
    while (this.level < CONST.MAX_LEVEL && this.xp >= DATA.xpForLevel(this.level)){
      this.xp -= DATA.xpForLevel(this.level);
      this.levelUp();
    }
  }
  levelUp(){
    this.level++;
    this.skillPoints++;
    const hpGain = this.data.hpL;
    this.computeStats(false);
    this.hp = Math.min(this.maxHp, this.hp + hpGain);
    FX.levelUpFx(this);
    if (this.isPlayer){ AUDIO.play('levelup'); UI.refreshSkillbar(); }
    else if (!this.remote) this.autoSpendPoints();
    this.markBar();
  }
  autoSpendPoints(){
    // AI加点:优先R,然后 Q>W>E 循环
    while (this.skillPoints > 0){
      const order = [3,0,1,2];
      let spent = false;
      for (const i of order){
        if (this.canLevelSkill(i)){ this.levelSkill(i); spent = true; break; }
      }
      if (!spent) break;
    }
  }
  canLevelSkill(i){
    if (this.skillPoints<=0) return false;
    const s = this.skills[i];
    const maxLvl = i===3? 3 : 5;
    if (s.lvl >= maxLvl) return false;
    if (i===3) return this.level >= 6 + s.lvl*3;   // R: 6/9/12级(近似)
    return s.lvl < Math.ceil(this.level/2)+1;
  }
  levelSkill(i){
    if (window.GAME && GAME.G.netRole==='guest' && this.isPlayer){
      NET.gInput({t:'lvl', i});
      AUDIO.play('click');
      return true;
    }
    if (!this.canLevelSkill(i)) return false;
    this.skills[i].lvl++;
    this.skillPoints--;
    if (this.isPlayer){ AUDIO.play('click'); UI.refreshSkillbar(); }
    return true;
  }
  addGold(amt){
    this.gold += amt;
    if (this.isPlayer && amt >= 40) AUDIO.play('gold');
  }
  update(dt){
    if (this.dead){
      this.respawnT -= dt;
      if (this.respawnT <= 0) GAME.respawnChampion(this);
      return;
    }
    // 能量回复
    this.mana = Math.min(this.maxMana, this.mana + (this.mpRegen + this.buffStat('mpregen'))*dt);
    // 冷却
    for (const s of this.skills) if (s.cd > 0) s.cd -= dt;
    if (this.summCd.D > 0) this.summCd.D -= dt;
    if (this.summCd.F > 0) this.summCd.F -= dt;
    if (this.cheatDeathCd > 0){
      this.cheatDeathCd -= dt;
      if (this.cheatDeathCd <= 0 && this.items.some(i=>i.cheatDeath)) this.cheatDeathReady = true;
    }
    // 引导技能
    if (this.channel){
      const c = this.channel;
      c.t += dt;
      if (this.stunned || (c.moveCancels && this.moving)){
        if (c.onEnd) c.onEnd(false);
        this.channel = null;
      } else {
        c.acc = (c.acc||0)+dt;
        if (c.tick && c.acc >= c.tick){ c.acc -= c.tick; c.onTick && c.onTick(); }
        if (c.t >= c.dur){ c.onEnd && c.onEnd(true); this.channel = null; }
      }
    }
    // 回城
    if (this.recallT > 0){
      const interrupted = this.moving || this.attackTarget || this.stunned ||
        (this.lastCombatT != null && GAME.now() - this.lastCombatT < 0.1);
      if (interrupted){
        this.recallT = 0;
        if (this.recallFx) this.recallFx.cancel();
        if (this.isPlayer) UI.announce('回城被打断', '#e88');
      } else {
        this.recallT -= dt;
        if (this.recallT <= 0){
          this.pos.copy(this.homePos);
          FX.burst(this.pos, {count:20, tex:'star', color:0x9ecfff, size:1.6, speed:8, up:2, life:0.7});
          AUDIO.play('flash');
        }
      }
    }
    super.update(dt);
  }
  die(killer){
    if (this.dead) return;
    this.deaths++;
    this.respawnT = CONST.RESPAWN_BASE + this.level*CONST.RESPAWN_PER_LVL;
    this.recallT = 0;
    this.channel = null;
    if (this.recallFx) this.recallFx.cancel();
    super.die(killer);
  }
}

/* ---------- 小兵 ---------- */
class Minion extends Unit {
  constructor(type, team, lane, waveN){
    const d = DATA.MINIONS[type];
    const grow = Math.floor(waveN/2);
    super({kind:'minion', name:d.name, team,
      hp:d.hp + d.hpGrow*grow, ms:d.ms, range:d.range, as:1/d.atkCd,
      dmg:d.dmg + d.dmgGrow*grow, def:0, sdef:0, height:d.height, pokeId:d.id,
      xp:d.xp, gold:d.gold + Math.floor(grow*0.9), projColor:d.projColor||0xffffff});
    this.mtype = type;
    this.lane = lane;
    this.wpIdx = 0;
    this.aggroT = 0;
  }
}

/* ---------- 防御塔 ---------- */
class Tower extends Unit {
  constructor(tier, team, x, z, lane){
    const d = TOWERS[tier];
    super({kind:'tower', name:(team==='blue'?'蓝方':'红方')+d.name, team, x, z,
      hp:d.hp, ms:0, range:d.range, as:0.8, dmg:d.dmg, def:TOWERS.def, sdef:TOWERS.def,
      height:14, xp:TOWERS.xp, gold:TOWERS.gold});
    this.tier = tier;
    this.lane = lane;
    this.radius = 3.4;
    this.heatTarget = null; this.heat = 0;
    this.protected_ = tier!=='outer';   // 需先破外塔
  }
  buildModel(scene){
    // 精灵球塔:石柱 + 巨大精灵球
    const g = new THREE.Group();
    const teamCol = this.team==='blue'? 0x3a6cd8 : 0xd84040;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 9, 8),
      new THREE.MeshLambertMaterial({color:0x8a8a96}));
    pillar.position.y = 4.5; pillar.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.6, 1.2, 8),
      new THREE.MeshLambertMaterial({color:0x6a6a76}));
    rim.position.y = 9.2;
    // 精灵球
    const ballTop = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 12, 0, Math.PI*2, 0, Math.PI/2),
      new THREE.MeshLambertMaterial({color:teamCol}));
    const ballBot = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 12, 0, Math.PI*2, Math.PI/2, Math.PI/2),
      new THREE.MeshLambertMaterial({color:0xf2f2f2}));
    const band = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.42, 10, 24),
      new THREE.MeshLambertMaterial({color:0x222228}));
    band.rotation.x = Math.PI/2;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 10),
      new THREE.MeshBasicMaterial({color:0xffffff}));
    this.eyeMat = new THREE.MeshBasicMaterial({color:0x99e0ff});
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), this.eyeMat);
    const ball = new THREE.Group();
    ball.add(ballTop, ballBot, band, eye, core);
    eye.position.set(0,0,0); core.position.set(0,0,0);
    ball.position.y = 12.6;
    ball.castShadow = true;
    g.add(pillar, rim, ball);
    this.ballGroup = ball;
    g.position.copy(this.pos);
    scene.add(g);
    this.model = g;
    this.bar = makeHpBar(this, 10);
    this.bar.sprite.position.y = this.height + 3.6;
    g.add(this.bar.sprite);
    drawHpBar(this);
  }
  update(dt){
    if (this.dead) return;
    if (this.atkCdT > 0) this.atkCdT -= dt;
    if (this.bar && this.bar.dirty){ this.bar.dirty = false; drawHpBar(this); }
    if (this.ballGroup){
      this.ballGroup.rotation.y += dt*0.6;
      if (this.eyeMat) this.eyeMat.color.setHex(this.heat>0? 0xff5040 : 0x99e0ff);
    }
    if (this.heat > 0) this.heat -= dt;
  }
  fireAt(target){
    this.atkCdT = 1.25;
    const from = new THREE.Vector3(this.pos.x, 12.6, this.pos.z);
    const dmg = this.dmg * (1 + Math.min(1.2, this.ramp||0));
    FX.projectile({from, target, speed:70, color:this.team==='blue'?0x66aaff:0xff6655, size:3, tex:'glow', arc:4,
      onArrive:(p,t)=>{
        if (t && !t.dead){
          t.takeDamage(dmg, 'phys', this);
          FX.explosion(p, {color:this.team==='blue'?0x66aaff:0xff6655, radius:4, count:10, size:1.6});
          if (t.isPlayer) AUDIO.play('towerHit');
        }
      }});
  }
  die(killer){
    if (this.dead) return;
    this.dead = true;
    FX.explosion(this.pos, {color:0xffc060, radius:16, count:36, size:3});
    FX.ring(this.pos, {r1:20, color:0xffffff, dur:0.8});
    AUDIO.play('towerDown');
    GAME.onUnitDeath(this, killer);
    this.removeModel();
  }
}

/* ---------- 基地水晶(大师球) ---------- */
class Nexus extends Unit {
  constructor(team, x, z){
    super({kind:'nexus', name:(team==='blue'?'蓝方':'红方')+DATA.NEXUS.name, team, x, z,
      hp:DATA.NEXUS.hp, ms:0, range:0, dmg:0, def:60, sdef:60, height:12});
    this.radius = 5;
    this.protected_ = true;
  }
  buildModel(scene){
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 8.4, 2.4, 8),
      new THREE.MeshLambertMaterial({color:0x777788}));
    base.position.y = 1.2;
    // 大师球
    const purple = new THREE.MeshLambertMaterial({color:0x7040b0});
    const top = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 14, 0, Math.PI*2, 0, Math.PI/2), purple);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 14, 0, Math.PI*2, Math.PI/2, Math.PI/2),
      new THREE.MeshLambertMaterial({color:0xf0f0f0}));
    const band = new THREE.Mesh(new THREE.TorusGeometry(5, 0.6, 10, 28),
      new THREE.MeshLambertMaterial({color:0x222228}));
    band.rotation.x = Math.PI/2;
    const btn = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10),
      new THREE.MeshBasicMaterial({color: this.team==='blue'? 0x88c0ff : 0xff8877}));
    // M标记
    const mDot1 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), new THREE.MeshLambertMaterial({color:0xff70b0}));
    mDot1.position.set(-1.8, 2.4, 4.3);
    const mDot2 = mDot1.clone(); mDot2.position.set(1.8, 2.4, 4.3);
    const ball = new THREE.Group();
    ball.add(top, bot, band, btn, mDot1, mDot2);
    ball.position.y = 8; ball.castShadow = true;
    g.add(base, ball);
    this.ballGroup = ball;
    g.position.copy(this.pos);
    scene.add(g);
    this.model = g;
    this.bar = makeHpBar(this, 13);
    this.bar.sprite.position.y = 17;
    g.add(this.bar.sprite);
    drawHpBar(this);
    // 队色光柱
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 30, 10, 1, true),
      new THREE.MeshBasicMaterial({color:this.team==='blue'?0x4a90ff:0xff5544, transparent:true, opacity:0.18,
        blending:THREE.AdditiveBlending, depthWrite:false}));
    beam.position.y = 20;
    g.add(beam);
  }
  update(dt){
    if (this.dead) return;
    if (this.ballGroup){ this.ballGroup.rotation.y += dt*0.4; this.ballGroup.position.y = 8 + Math.sin(GAME.now()*1.2)*0.5; }
    if (this.bar && this.bar.dirty){ this.bar.dirty = false; drawHpBar(this); }
  }
  die(killer){
    if (this.dead) return;
    this.dead = true;
    FX.explosion(this.pos, {color:0xb080ff, radius:26, count:60, size:4});
    GAME.onNexusDestroyed(this);
    this.removeModel();
  }
}

/* ---------- 野怪 ---------- */
class JungleMonster extends Unit {
  constructor(cfg, camp, x, z){
    const mins = Math.floor(GAME? GAME.now()/60 : 0);
    super({kind:'jungle', name:cfg.name, team:'neutral', x, z,
      hp:cfg.hp + (cfg.hpGrow||0)*mins, ms:18, range:cfg.range, as:0.65,
      dmg:cfg.dmg, def:20, sdef:20, height:cfg.height, pokeId:cfg.id,
      xp:cfg.xp, gold:cfg.gold});
    this.cfg = cfg;
    this.camp = camp;
    this.homeX = x; this.homeZ = z;
    this.leashR = 26;
  }
  update(dt){
    if (this.dead) return;
    // 脱战回家满血
    if (this.attackTarget){
      const dHome = Math.hypot(this.pos.x-this.homeX, this.pos.z-this.homeZ);
      if (dHome > this.leashR || this.attackTarget.dead){
        this.attackTarget = null;
        this.moveTo({x:this.homeX, z:this.homeZ});
        this.hp = this.maxHp; this.shields.length = 0; this.buffs.length = 0;
        this.markBar();
      }
    } else if (this.lastAttacker && !this.lastAttacker.dead && this.distTo(this.lastAttacker) < 30){
      this.attackTarget = this.lastAttacker;
    }
    super.update(dt);
  }
}

return {loadModels, instantiate, Unit, Champion, Minion, Tower, Nexus, JungleMonster, drawHpBar};
})();
