/* ============================================================
   宝可梦联盟 · UI 模块
   加载 / 选人 / HUD / 商店 / 计分板 / 小地图 / 播报 / 结算
   ============================================================ */
window.UI = (function(){
const $ = id=>document.getElementById(id);
let hudT = 0, minimapBg = null;
const floaters = [];
let pauseOpen = false, shopOpen = false, addAIOpen = false;

/* ---------- 技能图标(canvas: 属性色+图案) ---------- */
function skillIconURL(def){
  const c = document.createElement('canvas'); c.width = c.height = 72;
  const g = c.getContext('2d');
  const col = DATA.TYPE_COLOR[def.type]||'#888';
  const gr = g.createLinearGradient(0,0,72,72);
  gr.addColorStop(0, col); gr.addColorStop(1, '#222');
  g.fillStyle = gr; g.fillRect(0,0,72,72);
  g.font = '38px serif'; g.textAlign='center'; g.textBaseline='middle';
  g.fillText(def.icon, 36, 40);
  return c.toDataURL();
}

/* ============================================================
   启动流程: 加载 → 选人
   ============================================================ */
function boot(){
  const ids = DATA.CHAMPS.map(c=>c.id)
    .concat([DATA.MINIONS.melee.id, DATA.MINIONS.ranged.id, DATA.MINIONS.cannon.id])
    .concat([DATA.JUNGLE.bluebuff.id, DATA.JUNGLE.redbuff.id, DATA.JUNGLE.dragon.id, DATA.JUNGLE.baron.id])
    .concat(SCENERY.AMBIENT_IDS);
  const uniq = [...new Set(ids)];
  ENT.loadModels(uniq, (done,total)=>{
    $('load-bar').style.width = (done/total*100)+'%';
    $('load-text').textContent = `捕捉宝可梦中... ${done}/${total}`;
  }).then(()=>{
    $('screen-loading').style.display = 'none';
    showSelect();
  });
}

/* ---------- 选人界面 ---------- */
let selKey = null, selDiff = 'normal';
function showSelect(){
  const sc = $('screen-select');
  sc.style.display = 'flex';
  const grid = $('champ-grid');
  grid.innerHTML = '';
  DATA.CHAMPS.forEach(c=>{
    const card = document.createElement('div');
    card.className = 'champ-card';
    card.innerHTML = `
      <img src="assets/art/${c.id}.png" alt="${c.name}">
      <div class="cc-name">${c.name}</div>
      <div class="cc-role">${c.role} · ${c.types.join('/')}</div>`;
    card.onclick = ()=>{
      document.querySelectorAll('.champ-card').forEach(x=>x.classList.remove('sel'));
      card.classList.add('sel');
      selKey = c.key;
      NET.pickChamp(c.key);
      if (NET.onLobby && NET.connected) NET.onLobby();
      AUDIO.resume(); AUDIO.play('click'); AUDIO.playCry(c.id, 0.3);
      showChampDetail(c);
      $('btn-start').classList.add('ready');
    };
    grid.appendChild(card);
  });
  document.querySelectorAll('.diff-btn').forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll('.diff-btn').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');
      selDiff = b.dataset.diff;
      AUDIO.play('click');
    };
  });
  $('btn-start').onclick = ()=>{
    if (!selKey){ msg('请先选择你的宝可梦!'); return; }
    if (NET.role==='guest'){ msg('等待房主开始对战'); return; }
    if (NET.role==='host' && NET.connected){
      if (!NET.peerKey){ msg('等待好友选择宝可梦...'); return; }
      AUDIO.play('buy');
      sc.style.display = 'none';
      NET.hostStart(selKey, selDiff);
      return;
    }
    AUDIO.play('buy');
    sc.style.display = 'none';
    startMatch();
  };
  initLobby();
}

/* ---------- 联机大厅 ---------- */
function initLobby(){
  const status = $('mp-status');
  const setStatus = (text, code)=>{
    status.innerHTML = code? `${text} — 房间码: <b class="mp-codebig">${code}</b>` : text;
  };
  $('mp-host').onclick = ()=>{
    AUDIO.resume(); AUDIO.play('click');
    $('mp-host').disabled = true; $('mp-join').disabled = true;
    NET.createRoom(setStatus);
  };
  $('mp-join').onclick = ()=>{
    const code = $('mp-code').value.trim();
    if (code.length < 4){ msg('请输入4位房间码'); return; }
    AUDIO.resume(); AUDIO.play('click');
    $('mp-host').disabled = true; $('mp-join').disabled = true;
    NET.joinRoom(code, setStatus);
  };
  NET.onLobby = ()=>{
    const mine = selKey? (DATA.CHAMPS.find(c=>c.key===selKey)||{}).name : '未选';
    const theirs = NET.peerKey? (DATA.CHAMPS.find(c=>c.key===NET.peerKey)||{}).name : '未选';
    let extra = `你: ${mine} · 好友: ${theirs}`;
    if (NET.role==='host') extra += NET.peerKey? ' — 可以开始!' : ' — 等待好友选人';
    else extra += ' — 等待房主开始';
    status.innerHTML = `<b class="mp-codebig">${NET.code||''}</b> ${extra}`;
    if (NET.role==='host' && NET.connected && NET.peerKey) $('btn-start').classList.add('ready');
  };
}
function showChampDetail(c){
  const d = $('champ-detail');
  d.innerHTML = `
    <div class="cd-head">
      <img src="assets/art/${c.id}.png">
      <div>
        <div class="cd-name">${c.name} <span class="cd-title">${c.title}</span></div>
        <div class="cd-tags">${c.types.map(t=>`<span class="type-tag" style="background:${DATA.TYPE_COLOR[t]}">${t}</span>`).join('')}
        <span class="role-tag">${c.role}</span> <span class="role-tag">${c.ranged?'远程':'近战'}</span></div>
      </div>
    </div>
    <div class="cd-skills">${c.skills.map(s=>`
      <div class="cd-skill">
        <img src="${skillIconURL(s)}"><b>[${s.key}] ${s.name}</b>
        <p>${s.desc}</p>
      </div>`).join('')}</div>`;
}
function startMatch(){
  // 队友/敌人随机(不与玩家重复)
  const others = DATA.CHAMPS.filter(c=>c.key!==selKey).map(c=>c.key);
  for (let i=others.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [others[i],others[j]]=[others[j],others[i]]; }
  const allies = others.slice(0,4);
  const rest = others.slice(4);
  const enemies = rest.slice(0,4);
  enemies.push(selKey);   // 敌方也有同款镜像英雄增加趣味?换成第5个不同的
  enemies[4] = rest[4]||others[0];
  GAME.initRenderer();
  GAME.startGame(selKey, allies, enemies, selDiff);
}

/* ============================================================
   HUD
   ============================================================ */
function onGameStart(){
  $('hud').style.display = 'block';
  buildSkillbar();
  buildShop();
  buildAddAI();
  refreshHud();
  refreshScoreboard();
  buildMinimapBg();
  msg('右键移动 / QWER技能 / Ctrl+键升级技能 / P商店 / B回城 / Tab战绩');
}

function buildSkillbar(){
  const P = GAME.player();
  const bar = $('skills');
  bar.innerHTML = '';
  P.skills.forEach((s,i)=>{
    const slot = document.createElement('div');
    slot.className = 'skill-slot';
    slot.id = 'skill-'+i;
    slot.innerHTML = `
      <img src="${skillIconURL(s.def)}">
      <div class="cd-mask" style="display:none"></div>
      <span class="skill-key">${s.def.key}</span>
      <span class="skill-pips"></span>
      <div class="skill-up" title="升级">+</div>`;
    slot.onmouseenter = ()=>showTip(skillTip(s), slot);
    slot.onmouseleave = hideTip;
    slot.querySelector('.skill-up').onclick = ()=>P.levelSkill(i);
    slot.onclick = e=>{ if (!e.target.classList.contains('skill-up')) GAME.playerCast(i); };
    bar.appendChild(slot);
  });
  // 召唤师技能
  for (const [key,def] of Object.entries({D:DATA.SUMMONER.heal, F:DATA.SUMMONER.flash})){
    const slot = document.createElement('div');
    slot.className = 'skill-slot summ';
    slot.id = 'summ-'+key;
    slot.innerHTML = `<div class="summ-icon">${def.icon}</div><div class="cd-mask" style="display:none"></div><span class="skill-key">${key}</span>`;
    slot.onmouseenter = ()=>showTip(`<b>${def.name}</b><br>${def.desc}<br>冷却 ${def.cd}秒`, slot);
    slot.onmouseleave = hideTip;
    bar.appendChild(slot);
  }
  refreshSkillbar();
}
function skillTip(s){
  const d = s.def, lvl = Math.max(0, s.lvl-1);
  const v = a=>Array.isArray(a)? a.join('/') : a;
  let t = `<b>[${d.key}] ${d.name}</b> <span class="type-tag" style="background:${DATA.TYPE_COLOR[d.type]}">${d.type}</span><br>`;
  t += `等级 ${s.lvl}/${d.key==='R'?3:5}<br>${d.desc}<br>`;
  if (d.dmg) t += `伤害: ${v(d.dmg)}<br>`;
  if (d.mana) t += `能量: ${d.mana} `;
  t += `冷却: ${v(d.cd)}秒`;
  return t;
}
function refreshSkillbar(){
  const P = GAME.player(); if (!P) return;
  P.skills.forEach((s,i)=>{
    const slot = $('skill-'+i); if (!slot) return;
    const mask = slot.querySelector('.cd-mask');
    const pips = slot.querySelector('.skill-pips');
    const up = slot.querySelector('.skill-up');
    pips.textContent = '●'.repeat(s.lvl) + '○'.repeat((i===3?3:5)-s.lvl);
    up.style.display = P.canLevelSkill(i)? 'flex':'none';
    slot.classList.toggle('unlearned', s.lvl===0);
    slot.classList.toggle('nomana', P.mana < (s.def.mana||0));
    if (s.cd > 0){ mask.style.display='flex'; mask.textContent = s.cd.toFixed(s.cd<3?1:0); }
    else mask.style.display='none';
  });
  for (const key of ['D','F']){
    const slot = $('summ-'+key); if (!slot) continue;
    const mask = slot.querySelector('.cd-mask');
    const cd = P.summCd[key];
    if (cd > 0){ mask.style.display='flex'; mask.textContent = Math.ceil(cd); }
    else mask.style.display='none';
  }
}

function refreshHud(){
  const P = GAME.player(); if (!P) return;
  $('portrait').src = 'assets/art/'+P.data.id+'.png';
  $('hud-level').textContent = P.level;
  $('hud-name').textContent = P.name;
  $('hud-kda').textContent = `${P.kills} / ${P.deaths} / ${P.assists}`;
  $('hud-cs').textContent = P.cs;
  $('hud-gold').textContent = Math.floor(P.gold);
  $('score-blue').textContent = GAME.G.teamStats.blue.kills;
  $('score-red').textContent = GAME.G.teamStats.red.kills;
  // 装备栏
  const inv = $('inventory');
  inv.innerHTML = '';
  for (let i=0;i<6;i++){
    const it = P.items[i];
    const d = document.createElement('div');
    d.className = 'inv-slot';
    if (it){
      d.innerHTML = `<img src="assets/items/${it.id}.png">`;
      d.onmouseenter = ()=>showTip(`<b>${it.name}</b><br>${it.desc}`, d);
      d.onmouseleave = hideTip;
    }
    inv.appendChild(d);
  }
}

function updateBars(){
  const P = GAME.player(); if (!P) return;
  const hpP = Math.max(0, P.hp/P.maxHp);
  $('hp-fill').style.width = (hpP*100)+'%';
  $('hp-fill').style.background = hpP>0.5? 'linear-gradient(#8ce85a,#4bb830)' : hpP>0.2? 'linear-gradient(#ffd94a,#e8a030)' : 'linear-gradient(#ff7a5a,#d83020)';
  const sh = P.shieldTotal();
  $('hp-shield').style.width = Math.min(100-hpP*100, sh/P.maxHp*100)+'%';
  $('hp-shield').style.left = (hpP*100)+'%';
  $('hp-text').textContent = `${Math.ceil(P.hp)} / ${Math.ceil(P.maxHp)}`;
  $('mp-fill').style.width = (P.mana/P.maxMana*100)+'%';
  $('mp-text').textContent = `${Math.floor(P.mana)} / ${Math.floor(P.maxMana)}`;
  const need = DATA.xpForLevel(P.level);
  $('xp-fill').style.width = Math.min(100, P.xp/need*100)+'%';
  // 计时
  const t = Math.floor(GAME.now());
  $('game-timer').textContent = `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
}

/* ---------- 提示框 ---------- */
function showTip(html, anchor){
  const tip = $('tooltip');
  tip.innerHTML = html;
  tip.style.display = 'block';
  const r = anchor.getBoundingClientRect();
  tip.style.left = Math.min(innerWidth-tip.offsetWidth-8, r.left)+'px';
  tip.style.top = (r.top - tip.offsetHeight - 8)+'px';
}
function hideTip(){ $('tooltip').style.display = 'none'; }

/* ---------- 技能过场动画: R=半屏大过场, QWE=紧凑快速版 ---------- */
function ultCutIn(champ, def){
  const isR = def.key==='R';
  // 普通技能过场只属于玩家自己;大招则玩家+镜头附近的电脑
  if (!champ.isPlayer && !isR) return;
  if (!champ.isPlayer && champ.pos.distanceTo(GAME.G.camPos) > 85) return;
  const old = document.getElementById('ultcut');
  if (old){
    if (isR && old.classList.contains('uc-mini')) old.remove();   // 大招顶掉小过场
    else return;
  }
  const enemy = champ.team !== GAME.playerTeam();
  const el = document.createElement('div');
  el.id = 'ultcut';
  el.className = (enemy? 'uc-enemy' : (champ.isPlayer? 'uc-self' : 'uc-ally')) + (isR? '' : ' uc-mini');
  const typeCol = DATA.TYPE_COLOR[def.type]||'#ffd94a';
  el.innerHTML = `
    <div class="uc-bg"></div>
    <div class="uc-lines"></div>
    <div class="uc-glow" style="background:radial-gradient(ellipse at 30% 50%, ${typeCol}55, transparent 65%)"></div>
    <img class="uc-art" src="assets/art/${champ.data.id}.png" alt="">
    <div class="uc-text">
      <div class="uc-skill" style="text-shadow:0 0 24px ${typeCol},0 4px 6px #000">${def.icon} ${def.name}</div>
      <div class="uc-champ">${champ.name} · ${champ.data.title}</div>
    </div>
    <div class="uc-edge uc-edge-t"></div>
    <div class="uc-edge uc-edge-b"></div>
    <div class="uc-flashbar"></div>`;
  document.body.appendChild(el);
  AUDIO.play(isR? 'ultcut' : 'dash');
  const life = isR? 1350 : 620;
  setTimeout(()=>el.classList.add('uc-out'), life);
  setTimeout(()=>el.remove(), life+400);
}

/* ---------- 全屏冲击闪光 ---------- */
let flashEl = null;
function screenFlash(color){
  if (!flashEl){
    flashEl = document.createElement('div');
    flashEl.id = 'screenflash';
    document.body.appendChild(flashEl);
  }
  const c = typeof color==='number'? '#'+color.toString(16).padStart(6,'0') : (color||'#fff');
  flashEl.style.transition = 'none';
  flashEl.style.background = `radial-gradient(ellipse, ${c}66, ${c}22 55%, transparent 80%)`;
  flashEl.style.opacity = '1';
  requestAnimationFrame(()=>{
    flashEl.style.transition = 'opacity .45s ease-out';
    flashEl.style.opacity = '0';
  });
}


let msgT = null;
function msg(text){
  const el = $('msg');
  el.textContent = text;
  el.style.opacity = 1;
  clearTimeout(msgT);
  msgT = setTimeout(()=>el.style.opacity = 0, 2200);
}
const annQueue = [];
function announce(text, color){
  annQueue.push({text, color});
  if (annQueue.length === 1) nextAnnounce();
}
function nextAnnounce(){
  if (!annQueue.length) return;
  const {text, color} = annQueue[0];
  const el = $('announce');
  el.textContent = text;
  el.style.color = color||'#ffd94a';
  el.classList.add('show');
  AUDIO.play('announce');
  setTimeout(()=>{
    el.classList.remove('show');
    setTimeout(()=>{ annQueue.shift(); nextAnnounce(); }, 300);
  }, 2400);
}
function killFeed(killer, victim, assists){
  const feed = $('killfeed');
  const row = document.createElement('div');
  row.className = 'kf-row';
  const kImg = killer? `<img src="assets/art/${killer.data.id}.png" class="${killer.team==='blue'?'kf-blue':'kf-red'}">` : '<span class="kf-tower">🗼</span>';
  row.innerHTML = `${kImg}<span class="kf-x">⚔</span><img src="assets/art/${victim.data.id}.png" class="${victim.team==='blue'?'kf-blue':'kf-red'}">`;
  feed.appendChild(row);
  setTimeout(()=>row.remove(), 6000);
  while (feed.children.length > 4) feed.firstChild.remove();
}

/* ---------- 伤害飘字 ---------- */
function floatDmg(unit, amt, type, crit, src){
  // 过滤小兵互殴,避免刷屏
  if (unit.kind==='minion' && (!src || (src.kind!=='champ' && src.kind!=='tower'))) return;
  if (floaters.length > 45) return;
  const el = document.createElement('div');
  el.className = 'float-dmg ' + (type==='heal'?'fd-heal': type==='spec'?'fd-spec': type==='true'?'fd-true':'fd-phys') + (crit?' fd-crit':'');
  el.textContent = (type==='heal'?'+':'') + amt + (crit?'!':'');
  $('floaters').appendChild(el);
  floaters.push({el, unit, x:unit.pos.x, z:unit.pos.z, y:unit.height+2, life:0, vy:9+Math.random()*3, vx:(Math.random()-0.5)*6});
}
function updateFloaters(dt){
  const cam = GAME.G.camera;
  const v = new THREE.Vector3();
  for (let i=floaters.length-1;i>=0;i--){
    const f = floaters[i];
    f.life += dt;
    if (f.life > 1.0){ f.el.remove(); floaters.splice(i,1); continue; }
    f.y += f.vy*dt; f.x += f.vx*dt;
    v.set(f.x, f.y, f.z).project(cam);
    f.el.style.left = ((v.x*0.5+0.5)*innerWidth)+'px';
    f.el.style.top = ((-v.y*0.5+0.5)*innerHeight)+'px';
    f.el.style.opacity = 1 - Math.max(0, f.life-0.5)*2;
  }
}

/* ============================================================
   小地图
   ============================================================ */
function buildMinimapBg(){
  const src = GAME.G.mapCanvas;
  minimapBg = document.createElement('canvas');
  minimapBg.width = minimapBg.height = 180;
  minimapBg.getContext('2d').drawImage(src, 0, 0, 180, 180);
  const mm = $('minimap');
  mm.onmousedown = e=>{
    const r = mm.getBoundingClientRect();
    const wx = ((e.clientX-r.left)/r.width*2-1)*DATA.CONST.MAP_HALF;
    const wz = ((e.clientY-r.top)/r.height*2-1)*DATA.CONST.MAP_HALF;
    GAME.G.camFollow = false;
    GAME.G.camPos.set(wx, 0, wz);
  };
}
function drawMinimap(){
  if (!minimapBg) return;
  const cv = $('minimap');
  const g = cv.getContext('2d');
  const S = cv.width;
  g.drawImage(minimapBg, 0, 0, S, S);
  const px = v=> (v/DATA.CONST.MAP_HALF*0.5+0.5)*S;
  const Gm = GAME.G;
  // 塔
  for (const t of Gm.towers){
    if (t.dead) continue;
    g.fillStyle = t.team==='blue'? '#5599ff':'#ff6655';
    g.fillRect(px(t.pos.x)-3, px(t.pos.z)-3, 6, 6);
  }
  for (const n of Gm.nexuses){
    if (n.dead) continue;
    g.fillStyle = n.team==='blue'? '#88bbff':'#ff9988';
    g.beginPath(); g.arc(px(n.pos.x), px(n.pos.z), 5, 0, 7); g.fill();
  }
  // 小兵
  for (const m of Gm.minions){
    if (m.dead) continue;
    g.fillStyle = m.team==='blue'? '#4477dd':'#dd5544';
    g.fillRect(px(m.pos.x)-1, px(m.pos.z)-1, 2.4, 2.4);
  }
  // 野怪
  g.fillStyle = '#c8a0f0';
  for (const j of Gm.jungles){
    if (j.dead) continue;
    g.beginPath(); g.arc(px(j.pos.x), px(j.pos.z), 3, 0, 7); g.fill();
  }
  // 英雄
  for (const c of Gm.champs){
    if (c.dead) continue;
    g.beginPath(); g.arc(px(c.pos.x), px(c.pos.z), c.isPlayer? 5:4, 0, 7);
    g.fillStyle = c.isPlayer? '#ffd94a' : c.team==='blue'? '#66aaff':'#ff5544';
    g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
  }
  // 相机框
  g.strokeStyle = 'rgba(255,255,255,0.6)';
  g.strokeRect(px(Gm.camPos.x)-14, px(Gm.camPos.z)-10, 28, 20);
}

/* ============================================================
   商店
   ============================================================ */
function buildShop(){
  const grid = $('shop-grid');
  grid.innerHTML = '';
  DATA.ITEMS.forEach(it=>{
    const d = document.createElement('div');
    d.className = 'shop-item';
    d.innerHTML = `
      <img src="assets/items/${it.id}.png">
      <div class="si-name">${it.name}</div>
      <div class="si-cost">💰${it.cost}</div>`;
    d.onmouseenter = ()=>showTip(`<b>${it.name}</b> 💰${it.cost}<br>${it.desc}`, d);
    d.onmouseleave = hideTip;
    d.onclick = ()=>GAME.buyItem(GAME.player(), it.id);
    grid.appendChild(d);
  });
  $('shop-close').onclick = toggleShop;
}
function toggleShop(){
  shopOpen = !shopOpen;
  $('shop').style.display = shopOpen? 'flex':'none';
  if (shopOpen) refreshShop();
  AUDIO.play('click');
}
function refreshShop(){
  const P = GAME.player();
  $('shop-gold').textContent = Math.floor(P.gold);
  const items = document.querySelectorAll('.shop-item');
  DATA.ITEMS.forEach((it,i)=>{
    const el = items[i]; if (!el) return;
    el.classList.toggle('cant', P.gold < it.cost);
    el.classList.toggle('owned', P.items.some(x=>x.id===it.id));
  });
}

/* ============================================================
   计分板
   ============================================================ */
function refreshScoreboard(){
  const Gm = GAME.G;
  for (const team of ['blue','red']){
    const tb = $('sb-'+team);
    tb.innerHTML = `<tr><th colspan="6">${team==='blue'?'🔵 蓝方(我方)':'🔴 红方(敌方)'} — 击杀 ${Gm.teamStats[team].kills}</th></tr>
      <tr class="sb-head"><td>英雄</td><td>等级</td><td>K/D/A</td><td>补刀</td><td>金币</td><td>装备</td></tr>`;
    for (const c of GAME.champsOf(team)){
      const tr = document.createElement('tr');
      if (c.isPlayer) tr.className = 'sb-me';
      tr.innerHTML = `
        <td><img class="sb-face" src="assets/art/${c.data.id}.png"> ${c.name}</td>
        <td>${c.level}</td>
        <td>${c.kills}/${c.deaths}/${c.assists}</td>
        <td>${c.cs}</td>
        <td>${Math.floor(c.gold)}</td>
        <td>${c.items.map(i=>`<img class="sb-item" src="assets/items/${i.id}.png" title="${i.name}">`).join('')}</td>`;
      tb.appendChild(tr);
    }
  }
}
function showScoreboard(v){
  if (v) refreshScoreboard();
  $('scoreboard').style.display = v? 'flex':'none';
}

/* ============================================================
   添加 AI
   ============================================================ */
function buildAddAI(){
  $('btn-addai').onclick = ()=>{
    addAIOpen = !addAIOpen;
    $('addai').style.display = addAIOpen? 'flex':'none';
    AUDIO.play('click');
  };
  $('addai-close').onclick = ()=>{ addAIOpen = false; $('addai').style.display='none'; };
  const grid = $('addai-grid');
  grid.innerHTML = '';
  let pickKey = DATA.CHAMPS[0].key;
  DATA.CHAMPS.forEach((c,i)=>{
    const d = document.createElement('div');
    d.className = 'ai-card' + (i===0?' sel':'');
    d.innerHTML = `<img src="assets/art/${c.id}.png"><span>${c.name}</span>`;
    d.onclick = ()=>{
      document.querySelectorAll('.ai-card').forEach(x=>x.classList.remove('sel'));
      d.classList.add('sel');
      pickKey = c.key;
      AUDIO.play('click');
    };
    grid.appendChild(d);
  });
  $('addai-go').onclick = ()=>{
    const team = document.querySelector('input[name="ai-team"]:checked').value;
    const bot = GAME.addBot(pickKey, team);
    if (bot){ addAIOpen = false; $('addai').style.display='none'; AUDIO.play('buy'); }
  };
}

/* ============================================================
   死亡 / 结算 / 暂停
   ============================================================ */
function showDeath(unit){
  $('death').style.display = 'flex';
}
function hideDeath(){ $('death').style.display = 'none'; }
function updateDeath(){
  const P = GAME.player();
  if (P && P.dead) $('death-timer').textContent = Math.ceil(P.respawnT);
}

function showEnd(win){
  const el = $('end');
  el.style.display = 'flex';
  $('end-title').textContent = win? '胜利!' : '失败...';
  $('end-title').className = win? 'end-win':'end-lose';
  $('end-sub').textContent = win? '敌方大师球基地已被摧毁!' : '我方大师球基地被摧毁了...';
  const P = GAME.player();
  const t = Math.floor(GAME.now());
  $('end-stats').innerHTML = `
    <div>对局时长 <b>${Math.floor(t/60)}分${t%60}秒</b></div>
    <div>${P.name} · ${P.kills}/${P.deaths}/${P.assists} · 补刀${P.cs} · 等级${P.level}</div>`;
  $('btn-again').onclick = ()=>location.reload();
}

function togglePause(){
  if (shopOpen){ toggleShop(); return; }
  if (addAIOpen){ addAIOpen=false; $('addai').style.display='none'; return; }
  pauseOpen = !pauseOpen;
  $('pause').style.display = pauseOpen? 'flex':'none';
  if (pauseOpen){
    $('pt-sound').checked = AUDIO.enabled;
    $('pt-music').checked = AUDIO.musicOn;
  }
}
function initPause(){
  $('btn-resume').onclick = togglePause;
  $('btn-restart').onclick = ()=>location.reload();
  $('pt-sound').onchange = e=>AUDIO.setEnabled(e.target.checked);
  $('pt-music').onchange = e=>AUDIO.setMusic(e.target.checked);
}

function modalOpen(){ return pauseOpen || shopOpen || addAIOpen; }

/* ---------- 每帧更新 ---------- */
let mmT = 0;
function update(dt){
  updateFloaters(dt);
  hudT -= dt;
  if (hudT <= 0){
    hudT = 0.12;
    updateBars();
    refreshSkillbar();
    updateDeath();
  }
  mmT -= dt;
  if (mmT <= 0){ mmT = 0.2; drawMinimap(); $('hud-gold').textContent = Math.floor(GAME.player()?GAME.player().gold:0); }
}

window.addEventListener('DOMContentLoaded', ()=>{ initPause(); boot(); });

return {onGameStart, refreshHud, refreshSkillbar, refreshScoreboard, refreshShop, toggleShop,
  msg, announce, killFeed, floatDmg, showDeath, hideDeath, showEnd, showScoreboard,
  togglePause, update, modalOpen, ultCutIn, screenFlash};
})();
