/* ============================================================
   宝可梦联盟 · 3D 技能特效库
   程序化粒子纹理 + 投射物 / 光束 / 天雷 / 冲击波 / 领域 / 光环
   ============================================================ */
window.FX = (function(){
  let scene = null;
  const particles = [];      // 活跃粒子
  const pool = [];           // 粒子精灵池
  const effects = [];        // 有 update(dt) 的复合特效
  const lights = [];         // 点光源池
  const MAX_PARTICLES = 1500;

  /* ---------- 程序化纹理 ---------- */
  const tex = {};
  function makeTex(name, draw, size){
    const c = document.createElement('canvas'); c.width = c.height = size||64;
    const g = c.getContext('2d');
    draw(g, size||64);
    const t = new THREE.CanvasTexture(c);
    tex[name] = t; return t;
  }
  function radial(g, s, stops){
    const gr = g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
    stops.forEach(([o,c])=>gr.addColorStop(o,c));
    g.fillStyle = gr; g.fillRect(0,0,s,s);
  }
  function initTextures(){
    makeTex('glow', (g,s)=>radial(g,s,[[0,'rgba(255,255,255,1)'],[0.25,'rgba(255,255,255,0.9)'],[0.6,'rgba(255,255,255,0.28)'],[1,'rgba(255,255,255,0)']]));
    makeTex('soft', (g,s)=>radial(g,s,[[0,'rgba(255,255,255,0.75)'],[0.5,'rgba(255,255,255,0.3)'],[1,'rgba(255,255,255,0)']]));
    makeTex('star', (g,s)=>{
      g.translate(s/2,s/2); g.fillStyle='#fff';
      g.beginPath();
      for(let i=0;i<10;i++){ const r = i%2? s*0.14 : s*0.45, a = i*Math.PI/5 - Math.PI/2;
        g[i?'lineTo':'moveTo'](Math.cos(a)*r, Math.sin(a)*r); }
      g.closePath(); g.fill();
      g.globalCompositeOperation='lighter';
      radial(g,0,[[0,'rgba(255,255,255,0.6)'],[1,'rgba(255,255,255,0)']]);
    });
    makeTex('spark', (g,s)=>{
      g.translate(s/2,s/2); g.fillStyle='#fff';
      g.beginPath(); g.moveTo(0,-s*0.48); g.lineTo(s*0.09,-s*0.09); g.lineTo(s*0.48,0); g.lineTo(s*0.09,s*0.09);
      g.lineTo(0,s*0.48); g.lineTo(-s*0.09,s*0.09); g.lineTo(-s*0.48,0); g.lineTo(-s*0.09,-s*0.09);
      g.closePath(); g.fill();
    });
    makeTex('flame', (g,s)=>{
      const gr = g.createRadialGradient(s/2,s*0.62,2,s/2,s*0.55,s*0.42);
      gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.35,'rgba(255,220,120,0.9)');
      gr.addColorStop(0.7,'rgba(255,120,40,0.5)'); gr.addColorStop(1,'rgba(255,60,0,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(s/2, s*0.05);
      g.bezierCurveTo(s*0.85,s*0.4, s*0.8,s*0.75, s/2,s*0.95);
      g.bezierCurveTo(s*0.2,s*0.75, s*0.15,s*0.4, s/2,s*0.05);
      g.fill();
    });
    makeTex('leaf', (g,s)=>{
      g.translate(s/2,s/2); g.rotate(0.6); g.fillStyle='#eaffea';
      g.beginPath(); g.moveTo(0,-s*0.42);
      g.quadraticCurveTo(s*0.3,-s*0.1, 0,s*0.42);
      g.quadraticCurveTo(-s*0.3,-s*0.1, 0,-s*0.42);
      g.fill();
      g.strokeStyle='rgba(255,255,255,0.8)'; g.lineWidth=2;
      g.beginPath(); g.moveTo(0,-s*0.36); g.lineTo(0,s*0.36); g.stroke();
    });
    makeTex('snow', (g,s)=>{
      g.translate(s/2,s/2); g.strokeStyle='#fff'; g.lineWidth=3; g.lineCap='round';
      for(let i=0;i<6;i++){ g.rotate(Math.PI/3);
        g.beginPath(); g.moveTo(0,0); g.lineTo(0,-s*0.42);
        g.moveTo(0,-s*0.24); g.lineTo(s*0.1,-s*0.32); g.moveTo(0,-s*0.24); g.lineTo(-s*0.1,-s*0.32);
        g.stroke(); }
    });
    makeTex('bubble', (g,s)=>{
      g.strokeStyle='rgba(255,255,255,0.9)'; g.lineWidth=3;
      g.beginPath(); g.arc(s/2,s/2,s*0.38,0,Math.PI*2); g.stroke();
      radial(g,s,[[0,'rgba(255,255,255,0)'],[0.75,'rgba(255,255,255,0.12)'],[0.95,'rgba(255,255,255,0.4)'],[1,'rgba(255,255,255,0)']]);
      g.fillStyle='rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(s*0.36,s*0.34,s*0.07,0,Math.PI*2); g.fill();
    });
    makeTex('ring', (g,s)=>{
      g.strokeStyle='#fff'; g.lineWidth=6;
      g.beginPath(); g.arc(s/2,s/2,s*0.4,0,Math.PI*2); g.stroke();
    });
    makeTex('note', (g,s)=>{
      g.fillStyle='#fff'; g.strokeStyle='#fff'; g.lineWidth=4;
      g.beginPath(); g.ellipse(s*0.35,s*0.7,s*0.14,s*0.1,-0.3,0,Math.PI*2); g.fill();
      g.beginPath(); g.moveTo(s*0.47,s*0.68); g.lineTo(s*0.47,s*0.2); g.lineTo(s*0.72,s*0.28); g.stroke();
    });
    makeTex('zzz', (g,s)=>{
      g.fillStyle='#fff'; g.font='bold 40px sans-serif'; g.textAlign='center'; g.textBaseline='middle';
      g.fillText('Z', s/2, s/2);
    });
    makeTex('heart', (g,s)=>{
      g.fillStyle='#fff'; g.translate(s/2,s/2); g.scale(0.9,0.9);
      g.beginPath(); g.moveTo(0,s*0.3);
      g.bezierCurveTo(-s*0.5,-s*0.05,-s*0.25,-s*0.42,0,-s*0.15);
      g.bezierCurveTo(s*0.25,-s*0.42,s*0.5,-s*0.05,0,s*0.3);
      g.fill();
    });
    makeTex('smoke', (g,s)=>radial(g,s,[[0,'rgba(200,200,200,0.5)'],[0.6,'rgba(160,160,160,0.22)'],[1,'rgba(120,120,120,0)']]));
    // 地裂纹贴图:放射状锯齿裂缝
    makeTex('crack', (g,s)=>{
      g.translate(s/2,s/2);
      g.strokeStyle='#fff'; g.lineCap='round';
      const arms = 8;
      for (let i=0;i<arms;i++){
        const a0 = i/arms*Math.PI*2 + (Math.random()-0.5)*0.5;
        let x=0, y=0, a=a0, w=4.5;
        g.lineWidth = w;
        g.beginPath(); g.moveTo(0,0);
        const steps = 4+Math.floor(Math.random()*3);
        for (let k=0;k<steps;k++){
          const len = s*0.09*(1+Math.random()*0.6);
          a += (Math.random()-0.5)*0.9;
          x += Math.cos(a)*len; y += Math.sin(a)*len;
          g.lineTo(x,y);
        }
        g.stroke();
        // 分叉
        if (Math.random()<0.7){
          g.lineWidth = 2;
          g.beginPath(); g.moveTo(x*0.5,y*0.5);
          g.lineTo(x*0.5+Math.cos(a0+1)*s*0.12, y*0.5+Math.sin(a0+1)*s*0.12);
          g.stroke();
        }
      }
      const gr = g.createRadialGradient(0,0,2,0,0,s*0.2);
      gr.addColorStop(0,'rgba(255,255,255,0.9)'); gr.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(-s/2,-s/2,s,s);
    }, 256);
  }

  /* ---------- 粒子系统 ---------- */
  function getSprite(){
    let s = pool.pop();
    if (!s){
      const m = new THREE.SpriteMaterial({map:tex.glow, transparent:true, depthWrite:false,
        blending:THREE.AdditiveBlending, color:0xffffff});
      s = new THREE.Sprite(m);
    }
    s.visible = true;
    return s;
  }
  function freeSprite(s){
    s.visible = false;
    if (s.parent) s.parent.remove(s);
    if (pool.length < MAX_PARTICLES) pool.push(s);
  }

  // burst(pos, opts) — 一次性粒子爆发
  function burst(pos, o){
    o = o||{};
    const n = Math.min(o.count||12, MAX_PARTICLES - particles.length);
    for (let i=0;i<n;i++){
      const s = getSprite();
      s.material.map = tex[o.tex||'glow'];
      s.material.blending = o.normalBlend? THREE.NormalBlending : THREE.AdditiveBlending;
      s.material.color.set(Array.isArray(o.color)? o.color[i%o.color.length] : (o.color||0xffffff));
      s.material.opacity = o.opacity!=null? o.opacity : 1;
      s.material.rotation = o.spin? Math.random()*Math.PI*2 : 0;
      const spread = o.spread!=null? o.spread : 1.2;
      if (o.implode){
        // 内爆:粒子从外圈汇聚向中心
        const a2 = Math.random()*Math.PI*2;
        const rr = spread*(0.8+Math.random()*0.4);
        s.position.set(pos.x+Math.cos(a2)*rr, (pos.y||0)+(o.yOff||1.5)+(Math.random()-0.5)*2, pos.z+Math.sin(a2)*rr);
      } else {
        s.position.set(
          pos.x + (Math.random()-0.5)*spread*2,
          (pos.y||0) + (o.yOff||1.5) + (Math.random()-0.5)*spread,
          pos.z + (Math.random()-0.5)*spread*2);
      }
      const sp = o.speed!=null? o.speed : 8;
      const ang = Math.random()*Math.PI*2;
      const up = o.up!=null? o.up : 0.5;
      const size0 = (o.size||1.4) * (0.6+Math.random()*0.8);
      let vel;
      if (o.implode){
        vel = new THREE.Vector3(pos.x-s.position.x, 0, pos.z-s.position.z).normalize().multiplyScalar(sp*(0.7+Math.random()*0.6));
      } else {
        vel = new THREE.Vector3(Math.cos(ang)*sp*(0.3+Math.random()*0.7), sp*up*(0.4+Math.random()*0.9), Math.sin(ang)*sp*(0.3+Math.random()*0.7));
      }
      particles.push({
        sprite:s,
        vel,
        ttl: (o.life||0.6)*(0.7+Math.random()*0.6), life:0,
        size0, size1: o.shrink===false? size0 : size0*0.15,
        gravity: o.implode? 0 : (o.gravity!=null? o.gravity : -6),
        drag: o.implode? 0 : (o.drag!=null? o.drag : 2),
        spinV: o.spin? (Math.random()-0.5)*6 : 0,
        follow: o.follow||null, swirl: o.swirl||0,
      });
      scene.add(s);
    }
  }

  /* ---------- 复合特效基类 ---------- */
  function addEffect(e){ effects.push(e); return e; }

  /* 点光源脉冲(池化,最多10个) */
  function flash(pos, color, intensity, dist, dur){
    let L = lights.find(l=>!l.active);
    if (!L){
      if (lights.length >= 10) return;
      L = {light:new THREE.PointLight(0xffffff, 0, 50), active:false};
      lights.push(L); scene.add(L.light);
    }
    L.active = true; L.t = 0; L.dur = dur||0.35; L.i0 = intensity||2.5;
    L.light.color.set(color); L.light.intensity = L.i0; L.light.distance = dist||45;
    L.light.position.set(pos.x, (pos.y||0)+6, pos.z);
  }

  /* 投射物: target(单位)优先于 to(点) */
  function projectile(o){
    const s = getSprite();
    s.material.map = tex[o.tex||'glow'];
    s.material.blending = THREE.AdditiveBlending;
    s.material.color.set(o.color||0xffffff);
    s.material.opacity = 1;
    s.scale.setScalar(o.size||2.2);
    const from = o.from.clone? o.from.clone() : new THREE.Vector3(o.from.x, o.from.y||3, o.from.z);
    if (from.y === 0) from.y = 3;
    s.position.copy(from);
    scene.add(s);
    const e = {
      pos: s.position, sprite:s, t:0, dead:false, isProjectile:true,
      update(dt){
        this.t += dt;
        let dst;
        if (o.target && !o.target.dead){
          dst = new THREE.Vector3(o.target.pos.x, (o.target.height||3)*0.55, o.target.pos.z);
        } else if (o.target && o.target.dead){ this.dead = true; if (o.onFizzle) o.onFizzle(this.pos); return; }
        else dst = new THREE.Vector3(o.to.x, o.to.y!=null? o.to.y:3, o.to.z);
        const d = dst.clone().sub(this.pos); const dist = d.length();
        const step = (o.speed||80)*dt;
        // 尾迹
        if (o.trail !== false && Math.random()<0.85){
          burst(this.pos, {count:1, tex:o.trailTex||o.tex||'soft', color:o.trailColor||o.color, size:(o.size||2.2)*0.5,
            speed:1, up:0.1, life:0.32, gravity:0, spread:0.25, yOff:0});
        }
        if (dist <= step + (o.hitDist||0)){
          this.dead = true;
          if (o.onArrive) o.onArrive(dst, o.target);
        } else {
          d.normalize().multiplyScalar(step);
          if (o.arc){ // 抛物线偏移
            const p = Math.min(1, this.t*(o.speed||80)/Math.max(1,from.distanceTo(dst)));
            d.y += (Math.sin(p*Math.PI))*o.arc*dt*3;
          }
          this.pos.add(d);
          if (o.onUpdate) o.onUpdate(this.pos, dt, this);
        }
      },
      dispose(){ freeSprite(s); }
    };
    return addEffect(e);
  }

  /* 光束 */
  function beam(from, to, o){
    o = o||{};
    const dir = new THREE.Vector3(to.x-from.x, 0, to.z-from.z);
    const len = dir.length(); dir.normalize();
    const w = o.width||4;
    const geo = new THREE.CylinderGeometry(w/2, w/2, len, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({color:o.color||0xffffff, transparent:true, opacity:0.85,
      blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
    const m = new THREE.Mesh(geo, mat);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(w/5, w/5, len, 8, 1, true),
      new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false}));
    m.add(core);
    m.position.set((from.x+to.x)/2, o.y!=null? o.y:3.2, (from.z+to.z)/2);
    m.rotation.z = Math.PI/2;
    m.rotation.y = -Math.atan2(dir.z, dir.x);
    scene.add(m);
    flash(from, o.color||0xffffff, 3, 55, 0.4);
    // 沿线粒子
    const steps = Math.floor(len/6);
    for (let i=0;i<steps;i++){
      const p = {x: from.x+dir.x*i*6, y:0, z: from.z+dir.z*i*6};
      burst(p, {count:2, tex:o.tex||'glow', color:o.color, size:1.6, speed:5, up:0.9, life:0.5, yOff:3});
    }
    const e = { t:0, dead:false,
      update(dt){
        this.t += dt;
        const d = o.dur||0.45;
        const k = 1 - this.t/d;
        if (k <= 0){ this.dead = true; return; }
        mat.opacity = 0.85*k; core.material.opacity = 0.95*k;
        m.scale.x = m.scale.z = 0.5 + 0.5*k + Math.sin(this.t*40)*0.06;
      },
      dispose(){ scene.remove(m); geo.dispose(); mat.dispose(); core.geometry.dispose(); core.material.dispose(); }
    };
    return addEffect(e);
  }

  /* 闪电链(锯齿折线) */
  function lightningBolt(a, b, o){
    o = o||{};
    const mat = new THREE.LineBasicMaterial({color:o.color||0xaad4ff, transparent:true, opacity:1,
      blending:THREE.AdditiveBlending, depthWrite:false});
    const geo = new THREE.BufferGeometry();
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    function regen(){
      const pts = [];
      const n = o.segments||9;
      const av = new THREE.Vector3(a.x, a.y!=null?a.y:4, a.z);
      const bv = new THREE.Vector3(b.x, b.y!=null?b.y:3, b.z);
      for (let i=0;i<=n;i++){
        const p = av.clone().lerp(bv, i/n);
        if (i>0 && i<n){
          const d = (o.displace||3)*(1 - Math.abs(i/n - 0.5));
          p.x += (Math.random()-0.5)*d*2; p.y += (Math.random()-0.5)*d; p.z += (Math.random()-0.5)*d*2;
        }
        pts.push(p);
      }
      geo.setFromPoints(pts);
    }
    regen();
    const e = { t:0, rt:0, dead:false,
      update(dt){
        this.t += dt; this.rt += dt;
        if (this.rt > 0.045){ this.rt = 0; regen(); }
        const d = o.dur||0.3;
        mat.opacity = Math.max(0, 1 - this.t/d);
        if (this.t >= d) this.dead = true;
      },
      dispose(){ scene.remove(line); geo.dispose(); mat.dispose(); }
    };
    return addEffect(e);
  }

  /* 天雷:从天而降的闪电 + 闪光 + 地面冲击 */
  function skyStrike(pos, o){
    o = o||{};
    const top = {x:pos.x + (Math.random()-0.5)*6, y:38, z:pos.z + (Math.random()-0.5)*6};
    lightningBolt(top, {x:pos.x, y:0.5, z:pos.z}, {color:o.color||0xbfe0ff, dur:0.28, displace:4, segments:11});
    lightningBolt(top, {x:pos.x, y:0.5, z:pos.z}, {color:0xffffff, dur:0.2, displace:2.2, segments:8});
    flash(pos, o.color||0xaad4ff, 4, 60, 0.3);
    ring(pos, {r1:o.radius||7, color:o.color||0xaad4ff, dur:0.5});
    burst(pos, {count:14, tex:'spark', color:[0xffffff, o.color||0xffe97a], size:1.6, speed:16, up:0.9, life:0.5, yOff:0.5});
  }

  /* 扩散环 */
  function ring(pos, o){
    o = o||{};
    const geo = new THREE.RingGeometry(0.8, 1, 48);
    const mat = new THREE.MeshBasicMaterial({color:o.color||0xffffff, transparent:true, opacity:o.opacity||0.9,
      side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false});
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    m.position.set(pos.x, (o.y!=null?o.y:0.25), pos.z);
    scene.add(m);
    const e = { t:0, dead:false,
      update(dt){
        this.t += dt;
        const d = o.dur||0.5, k = this.t/d;
        if (k>=1){ this.dead = true; return; }
        const r = (o.r0||1) + ((o.r1||10) - (o.r0||1)) * (o.easeOut===false? k : 1-Math.pow(1-k,2.2));
        m.scale.setScalar(r);
        mat.opacity = (o.opacity||0.9)*(1-k);
      },
      dispose(){ scene.remove(m); geo.dispose(); mat.dispose(); }
    };
    return addEffect(e);
  }

  /* 地面预警圈(危险指示) */
  function telegraph(pos, radius, dur, color){
    const group = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.RingGeometry(radius*0.94, radius, 48),
      new THREE.MeshBasicMaterial({color:color||0xff4040, transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false}));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 40),
      new THREE.MeshBasicMaterial({color:color||0xff4040, transparent:true, opacity:0.18, side:THREE.DoubleSide, depthWrite:false}));
    const grow = new THREE.Mesh(new THREE.CircleGeometry(radius, 40),
      new THREE.MeshBasicMaterial({color:color||0xff7060, transparent:true, opacity:0.3, side:THREE.DoubleSide, depthWrite:false}));
    grow.scale.setScalar(0.01);
    [rim,fill,grow].forEach(x=>{ x.rotation.x = -Math.PI/2; group.add(x); });
    group.position.set(pos.x, 0.22, pos.z);
    scene.add(group);
    const e = { t:0, dead:false,
      update(dt){
        this.t += dt;
        const k = Math.min(1, this.t/dur);
        grow.scale.setScalar(Math.max(0.01,k));
        if (this.t >= dur) this.dead = true;
      },
      dispose(){ scene.remove(group); [rim,fill,grow].forEach(x=>{x.geometry.dispose(); x.material.dispose();}); }
    };
    return addEffect(e);
  }

  /* 直线预警 */
  function telegraphLine(from, to, width, dur, color){
    const dir = new THREE.Vector3(to.x-from.x,0,to.z-from.z);
    const len = dir.length();
    const geo = new THREE.PlaneGeometry(len, width);
    const mat = new THREE.MeshBasicMaterial({color:color||0xff4040, transparent:true, opacity:0.28, side:THREE.DoubleSide, depthWrite:false});
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    m.rotation.z = -Math.atan2(dir.z, dir.x);
    m.position.set((from.x+to.x)/2, 0.22, (from.z+to.z)/2);
    scene.add(m);
    const e = { t:0, dead:false,
      update(dt){ this.t+=dt; mat.opacity = 0.28*(0.7+0.3*Math.sin(this.t*14)); if (this.t>=dur) this.dead=true; },
      dispose(){ scene.remove(m); geo.dispose(); mat.dispose(); }
    };
    return addEffect(e);
  }

  /* 持续领域(暴风雪/火漩涡):粒子循环生成 */
  function zone(getPos, o){
    o = o||{};
    const e = { t:0, et:0, dead:false,
      update(dt){
        this.t += dt; this.et += dt;
        if (this.t >= (o.dur||3)){ this.dead = true; return; }
        if (this.et > (o.emitEvery||0.08)){
          this.et = 0;
          const p = getPos();
          const r = o.radius||12;
          const a = Math.random()*Math.PI*2, rr = Math.sqrt(Math.random())*r;
          burst({x:p.x+Math.cos(a)*rr, y:0, z:p.z+Math.sin(a)*rr},
            {count:o.per||2, tex:o.tex||'glow', color:o.color, size:o.size||1.6, speed:o.speed||4,
             up:o.up!=null?o.up:1.2, life:o.life||0.8, gravity:o.gravity!=null?o.gravity:-2,
             spin:o.spin, yOff:o.yOff!=null?o.yOff:0.5, spread:0.5});
        }
      },
      dispose(){}
    };
    return addEffect(e);
  }

  /* 环绕单位的光环(升腾粒子) */
  function aura(unit, o){
    o = o||{};
    return zone(()=>unit.pos, {dur:o.dur||3, radius:o.radius|| (unit.radius||2)+1.2, tex:o.tex||'glow',
      color:o.color, size:o.size||1.2, speed:2, up:o.up!=null?o.up:2.4, life:0.7, gravity:2, emitEvery:0.07, per:2, spin:o.spin});
  }

  /* 护盾泡 */
  function shieldBubble(unit, dur, color){
    const geo = new THREE.SphereGeometry(1, 20, 14);
    const mat = new THREE.MeshBasicMaterial({color:color||0x7ac0ff, transparent:true, opacity:0.32,
      blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
    const m = new THREE.Mesh(geo, mat);
    scene.add(m);
    const r = (unit.height||5)*0.62 + 1;
    const e = { t:0, dead:false,
      update(dt){
        this.t += dt;
        if (this.t >= dur || unit.dead || !unit.shield || unit.shield<=0.5){ this.dead = true; return; }
        m.position.set(unit.pos.x, (unit.height||5)*0.5, unit.pos.z);
        m.scale.setScalar(r*(1+Math.sin(this.t*6)*0.04));
        mat.opacity = 0.32 + Math.sin(this.t*8)*0.08;
      },
      dispose(){ scene.remove(m); geo.dispose(); mat.dispose(); }
    };
    return addEffect(e);
  }

  /* 挥砍弧光 */
  function slashArc(pos, angle, o){
    o = o||{};
    const R = o.range||13;
    const geo = new THREE.RingGeometry(R*0.45, R*0.95, 24, 1, -(o.arc||1.5)/2, o.arc||1.5);
    const mat = new THREE.MeshBasicMaterial({color:o.color||0xffe0a0, transparent:true, opacity:0.9,
      side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false});
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    m.rotation.z = -angle;
    m.position.set(pos.x, o.y!=null?o.y:1.8, pos.z);
    scene.add(m);
    const e = { t:0, dead:false,
      update(dt){
        this.t += dt; const d = o.dur||0.28, k = this.t/d;
        if (k>=1){ this.dead=true; return; }
        mat.opacity = 0.9*(1-k);
        m.rotation.z = -angle + (o.sweep||1.2)*k*(o.dirSign||1);
        m.scale.setScalar(1+k*0.25);
      },
      dispose(){ scene.remove(m); geo.dispose(); mat.dispose(); }
    };
    return addEffect(e);
  }

  /* 龙卷风 */
  function tornado(getPos, o){
    o = o||{};
    const sprites = [];
    const n = 26;
    for (let i=0;i<n;i++){
      const s = getSprite();
      s.material.map = tex[o.tex||'soft'];
      s.material.color.set(o.color||0xcfe8ff);
      s.material.blending = THREE.AdditiveBlending;
      s.material.opacity = 0.8;
      sprites.push({s, a:Math.random()*Math.PI*2, h:Math.random()});
      scene.add(s);
    }
    const e = { t:0, dead:false,
      update(dt){
        this.t += dt;
        if (this.t >= (o.dur||2)){ this.dead = true; return; }
        const p = getPos();
        for (const it of sprites){
          it.a += dt*(5 - it.h*2);
          it.h += dt*0.55; if (it.h>1) it.h -= 1;
          const r = (o.r0||2) + it.h*(o.r1||6);
          it.s.position.set(p.x + Math.cos(it.a)*r, it.h*(o.height||10), p.z + Math.sin(it.a)*r);
          it.s.scale.setScalar(1.2 + it.h*2.2);
          it.s.material.opacity = 0.75*(1-it.h*0.6);
        }
      },
      dispose(){ sprites.forEach(it=>freeSprite(it.s)); }
    };
    return addEffect(e);
  }

  /* 回城光柱 */
  function recallBeam(unit, dur, color){
    const geo = new THREE.CylinderGeometry(2.2, 2.8, 24, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({color:color||0x7ab8ff, transparent:true, opacity:0.35,
      blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
    const m = new THREE.Mesh(geo, mat); scene.add(m);
    const e = { t:0, dead:false, cancel(){ this.dead = true; },
      update(dt){
        this.t += dt;
        if (this.t>=dur || unit.dead){ this.dead = true; return; }
        m.position.set(unit.pos.x, 12, unit.pos.z);
        m.rotation.y += dt*2;
        mat.opacity = 0.25 + 0.18*Math.sin(this.t*7);
        if (Math.random()<0.4) burst(unit.pos, {count:1, tex:'star', color:color||0x9ecfff, size:1.4, speed:1.5, up:3.2, life:0.8, gravity:2, yOff:0.5});
      },
      dispose(){ scene.remove(m); geo.dispose(); mat.dispose(); }
    };
    return addEffect(e);
  }

  /* 爆炸 */
  function explosion(pos, o){
    o = o||{};
    const c = o.color||0xffa040;
    burst(pos, {count:o.count||22, tex:o.tex||'glow', color:[c,0xffffff], size:o.size||2.2, speed:o.speed||18, up:0.7, life:0.55, yOff:1.5});
    burst(pos, {count:10, tex:'smoke', color:0x555555, size:3, speed:7, up:0.8, life:1.0, gravity:1, normalBlend:true, opacity:0.4});
    ring(pos, {r1:o.radius||10, color:c, dur:0.45});
    flash(pos, c, 4, 55, 0.35);
  }

  /* 冲天光柱 */
  function pillar(pos, o){
    o = o||{};
    const h = o.h||30, r = o.r||3.5;
    const geo = new THREE.CylinderGeometry(r*0.8, r, h, 14, 1, true);
    const mat = new THREE.MeshBasicMaterial({color:o.color||0xffffff, transparent:true, opacity:0.7,
      blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
    const m = new THREE.Mesh(geo, mat);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r*0.3, r*0.4, h, 8, 1, true),
      new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false}));
    m.add(core);
    m.position.set(pos.x, h/2, pos.z);
    m.scale.set(0.2, 0.05, 0.2);
    scene.add(m);
    const e = { t:0, dead:false,
      update(dt){
        this.t += dt;
        const d = o.dur||0.75, k = this.t/d;
        if (k>=1){ this.dead = true; return; }
        const grow = Math.min(1, this.t/0.1);
        m.scale.set(0.6+0.6*(1-k), grow, 0.6+0.6*(1-k));
        m.rotation.y += dt*3;
        mat.opacity = 0.7*(1-k*k);
        core.material.opacity = 0.9*(1-k);
      },
      dispose(){ scene.remove(m); geo.dispose(); mat.dispose(); core.geometry.dispose(); core.material.dispose(); }
    };
    return addEffect(e);
  }

  /* 碎石飞溅 */
  const debrisGeo = new THREE.TetrahedronGeometry(0.6);
  function debris(pos, o){
    o = o||{};
    const n = o.count||9;
    const items = [];
    for (let i=0;i<n;i++){
      const mat = new THREE.MeshLambertMaterial({color: new THREE.Color(o.color||0x8a7a68).multiplyScalar(0.6+Math.random()*0.7)});
      const m = new THREE.Mesh(debrisGeo, mat);
      const sc = 0.5+Math.random()*1.1;
      m.scale.setScalar(sc);
      m.position.set(pos.x, 1, pos.z);
      m.castShadow = true;
      const a = Math.random()*Math.PI*2, sp = 8+Math.random()*(o.speed||16);
      items.push({m, mat, vel:new THREE.Vector3(Math.cos(a)*sp, 14+Math.random()*14, Math.sin(a)*sp),
        rv:new THREE.Vector3(Math.random()*9,Math.random()*9,Math.random()*9), landed:false});
      scene.add(m);
    }
    const e = { t:0, dead:false,
      update(dt){
        this.t += dt;
        const d = o.dur||1.5;
        let alive = false;
        for (const it of items){
          if (!it.landed){
            it.vel.y -= 55*dt;
            it.m.position.addScaledVector(it.vel, dt);
            it.m.rotation.x += it.rv.x*dt; it.m.rotation.y += it.rv.y*dt; it.m.rotation.z += it.rv.z*dt;
            if (it.m.position.y <= 0.3){ it.m.position.y = 0.3; it.landed = true; }
            alive = true;
          }
          if (this.t > d*0.6){
            it.mat.transparent = true;
            it.mat.opacity = Math.max(0, 1-(this.t-d*0.6)/(d*0.4));
          }
        }
        if (this.t >= d) this.dead = true;
      },
      dispose(){ items.forEach(it=>{ scene.remove(it.m); it.mat.dispose(); }); }
    };
    return addEffect(e);
  }

  /* 地面裂纹贴花 */
  function crackDecal(pos, o){
    o = o||{};
    const r = o.r||12;
    const geo = new THREE.PlaneGeometry(r*2, r*2);
    const mat = new THREE.MeshBasicMaterial({map:tex.crack, color:o.color||0xffb060, transparent:true, opacity:0.95,
      blending:THREE.AdditiveBlending, depthWrite:false});
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    m.rotation.z = Math.random()*Math.PI*2;
    m.position.set(pos.x, 0.24, pos.z);
    m.scale.setScalar(0.2);
    scene.add(m);
    const e = { t:0, dead:false,
      update(dt){
        this.t += dt;
        const d = o.dur||2.2;
        m.scale.setScalar(Math.min(1, this.t/0.12));
        if (this.t > d*0.4) mat.opacity = 0.95*Math.max(0, 1-(this.t-d*0.4)/(d*0.6));
        if (this.t >= d) this.dead = true;
      },
      dispose(){ scene.remove(m); geo.dispose(); mat.dispose(); }
    };
    return addEffect(e);
  }

  /* 放射速度线 */
  function streaks(pos, o){
    o = o||{};
    const n = o.count||10;
    const group = new THREE.Group();
    const mats = [];
    for (let i=0;i<n;i++){
      const len = (o.len||9)*(0.6+Math.random()*0.8);
      const geo = new THREE.PlaneGeometry(len, 0.45+Math.random()*0.4);
      const mat = new THREE.MeshBasicMaterial({color:o.color||0xffffff, transparent:true, opacity:0.9,
        blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
      const m = new THREE.Mesh(geo, mat);
      const a = Math.random()*Math.PI*2;
      m.position.set(Math.cos(a)*len*0.55, (o.y!=null?o.y:2.5)+(Math.random()-0.5)*3, Math.sin(a)*len*0.55);
      m.rotation.y = -a;
      m.rotation.x = (Math.random()-0.5)*0.6;
      group.add(m); mats.push(mat);
    }
    group.position.set(pos.x, 0, pos.z);
    scene.add(group);
    const e = { t:0, dead:false,
      update(dt){
        this.t += dt;
        const d = o.dur||0.3, k = this.t/d;
        if (k>=1){ this.dead = true; return; }
        group.scale.setScalar(0.4+k*1.2);
        mats.forEach(mt=>mt.opacity = 0.9*(1-k));
      },
      dispose(){ scene.remove(group); group.children.forEach(c=>{c.geometry.dispose(); c.material.dispose();}); }
    };
    return addEffect(e);
  }

  /* ★ 大招级综合冲击:内爆预兆+爆炸+光柱+冲击波+裂地+碎石+速度线 */
  function ultImpact(pos, o){
    o = o||{};
    const c = o.color||0xffa040;
    const R = o.radius||16;
    burst(pos, {count:36, tex:o.tex||'glow', color:[c,0xffffff], size:3.4, speed:30, up:0.9, life:0.7, yOff:2});
    burst(pos, {count:18, tex:'spark', color:[c,0xffffff], size:2.2, speed:38, up:0.6, life:0.5, yOff:2});
    burst(pos, {count:16, tex:'smoke', color:0x444444, size:4.5, speed:10, up:1.1, life:1.6, gravity:1.5, normalBlend:true, opacity:0.5});
    pillar(pos, {color:c, r:R*0.24, h:34, dur:0.7});
    ring(pos, {r1:R*1.7, color:c, dur:0.55});
    ring(pos, {r1:R*1.2, color:0xffffff, dur:0.8, y:0.4});
    crackDecal(pos, {color:c, r:R*0.95});
    debris(pos, {count:10, color:0x8a7a68, speed:20});
    streaks(pos, {color:c, count:12, len:R*0.8});
    flash(pos, c, 6, 90, 0.5);
    if (window.UI && UI.screenFlash) UI.screenFlash(c);
  }

  /* 治疗光效 */
  function healBurst(unit, color){
    burst(unit.pos, {count:12, tex:'star', color:color||0x7dffa0, size:1.5, speed:3, up:3.5, life:0.9, gravity:3, yOff:1});
    ring(unit.pos, {r1:(unit.radius||2)+3, color:color||0x7dffa0, dur:0.6});
  }

  /* 升级特效 */
  function levelUpFx(unit){
    ring(unit.pos, {r1:6, color:0xffe97a, dur:0.7});
    burst(unit.pos, {count:16, tex:'star', color:[0xffe97a,0xfff7c0], size:1.6, speed:5, up:3, life:1, gravity:3});
    flash(unit.pos, 0xffe97a, 3, 40, 0.5);
  }

  function deathPoof(pos, color){
    burst(pos, {count:16, tex:'smoke', color:0x888888, size:2.6, speed:6, up:1.4, life:0.9, normalBlend:true, opacity:0.5});
    burst(pos, {count:10, tex:'glow', color:color||0xffffff, size:1.8, speed:9, up:1, life:0.5});
  }

  /* ---------- 主更新 ---------- */
  function update(dt){
    // 粒子
    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.ttl){ freeSprite(p.sprite); particles.splice(i,1); continue; }
      const k = p.life/p.ttl;
      p.vel.y += p.gravity*dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag*dt));
      if (p.swirl){
        const a = Math.atan2(p.sprite.position.z, p.sprite.position.x);
        p.vel.x += -Math.sin(a)*p.swirl*dt; p.vel.z += Math.cos(a)*p.swirl*dt;
      }
      p.sprite.position.addScaledVector(p.vel, dt);
      if (p.sprite.position.y < 0.1) p.sprite.position.y = 0.1;
      const sz = p.size0 + (p.size1-p.size0)*k;
      p.sprite.scale.setScalar(sz);
      p.sprite.material.opacity = (1-k)*(p.sprite.material.opacity>0?1:1)*(1-k*0.2);
      if (p.spinV) p.sprite.material.rotation += p.spinV*dt;
    }
    // 复合特效
    for (let i=effects.length-1;i>=0;i--){
      const e = effects[i];
      e.update(dt);
      if (e.dead){ e.dispose(); effects.splice(i,1); }
    }
    // 灯光
    for (const L of lights){
      if (!L.active) continue;
      L.t += dt;
      const k = 1 - L.t/L.dur;
      if (k<=0){ L.active = false; L.light.intensity = 0; }
      else L.light.intensity = L.i0*k;
    }
  }

  function init(sc){ scene = sc; initTextures(); }
  function clearAll(){
    for (const p of particles) freeSprite(p.sprite);
    particles.length = 0;
    for (const e of effects){ e.dispose(); }
    effects.length = 0;
  }

  return {init, update, clearAll, tex,
    burst, projectile, beam, lightningBolt, skyStrike, ring, telegraph, telegraphLine,
    zone, aura, shieldBubble, slashArc, tornado, recallBeam, explosion, healBurst, levelUpFx, deathPoof, flash,
    pillar, debris, crackDecal, streaks, ultImpact};
})();
