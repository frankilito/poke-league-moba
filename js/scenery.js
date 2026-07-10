/* ============================================================
   宝可梦联盟 · 场景生态模块
   高草丛/花海/蘑菇/莓果树/精灵球道具/河道活水/荷叶/木桥/围栏
   营地水晶/巢穴岩圈/基地旗帜/云朵/飞鸟/萤火虫/野生宝可梦
   ============================================================ */
window.SCENERY = (function(){
const HALF = 120;
// 游荡的野生宝可梦: 巴大蝶/走路草/呆呆兽/鲤鱼王/伊布
const AMBIENT_IDS = [12, 43, 79, 129, 133];

let scene = null;
const wanderers = [];   // 野生宝可梦
const birds = [];       // 高空飞鸟
const clouds = [];
const fireflies = [];
const lilies = [];
const karps = [];       // 鲤鱼王(河里跳)
const crystals = [];
const petals = [];      // 樱花花瓣
const sakuraSpots = [];
let waterMat = null, waterTex = null;
let T = 0;

/* ============================================================
   高精度程序化模型(顶点抖动 + 面片着色 + 单网格合并)
   ============================================================ */
const propMat = new THREE.MeshLambertMaterial({vertexColors:true});
const dummyO = new THREE.Object3D();

// 位置哈希抖动:重复顶点位移一致,不会撕裂面
function jitterGeo(geo, amt, seed){
  const p = geo.attributes.position;
  for (let i=0;i<p.count;i++){
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const h1 = Math.sin(x*127.1+y*311.7+z*74.7+seed)*43758.5453;
    const h2 = Math.sin(x*269.5+y*183.3+z*246.1+seed)*28001.83;
    const h3 = Math.sin(x*113.5+y*271.9+z*124.6+seed)*41414.41;
    p.setXYZ(i, x+(h1-Math.floor(h1)-0.5)*amt, y+(h2-Math.floor(h2)-0.5)*amt, z+(h3-Math.floor(h3)-0.5)*amt);
  }
}
// 变换 + 按面上色(带明暗抖动),返回非索引几何
function part(geo, color, o){
  o = o||{};
  const g = geo.index? geo.toNonIndexed() : geo;
  dummyO.position.set(o.p? o.p[0]:0, o.p? o.p[1]:0, o.p? o.p[2]:0);
  dummyO.rotation.set(o.r? o.r[0]:0, o.r? o.r[1]:0, o.r? o.r[2]:0);
  const s = o.s||[1,1,1];
  dummyO.scale.set(s[0], s[1], s[2]);
  dummyO.updateMatrix();
  g.applyMatrix4(dummyO.matrix);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const cols = new Float32Array(n*3);
  for (let i=0;i<n;i+=3){
    const v = 0.84+Math.random()*0.3;
    for (let k=0;k<3;k++){
      cols[(i+k)*3]=Math.min(1,c.r*v); cols[(i+k)*3+1]=Math.min(1,c.g*v); cols[(i+k)*3+2]=Math.min(1,c.b*v);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols,3));
  return g;
}
function mergeParts(parts){
  let total = 0;
  parts.forEach(g=>total += g.attributes.position.count);
  const pos = new Float32Array(total*3), col = new Float32Array(total*3);
  let off = 0;
  for (const g of parts){
    pos.set(g.attributes.position.array, off);
    col.set(g.attributes.color.array, off);
    off += g.attributes.position.count*3;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color', new THREE.BufferAttribute(col,3));
  geo.computeVertexNormals();
  return geo;
}
const rnd = (a,b)=>a+Math.random()*(b-a);

/* kind: oak | sakura | pine | rock */
function makeProp(kind, h){
  const parts = [];
  if (kind==='rock'){
    const n = 1+Math.floor(Math.random()*2);
    for (let i=0;i<n;i++){
      const r = h*rnd(0.4,0.62);
      const g = new THREE.IcosahedronGeometry(r, 1);
      jitterGeo(g, r*0.45, Math.random()*100);
      const gray = rnd(0.46,0.62);
      parts.push(part(g, new THREE.Color(gray*1.0, gray, gray*1.08),
        {p:[rnd(-h*0.22,h*0.22), r*rnd(0.35,0.5), rnd(-h*0.22,h*0.22)], s:[1, rnd(0.55,0.85), 1], r:[0,Math.random()*3,0]}));
    }
    if (Math.random()<0.55){ // 青苔
      const mg = new THREE.IcosahedronGeometry(h*0.32, 1);
      jitterGeo(mg, h*0.13, Math.random()*100);
      parts.push(part(mg, 0x4a8a3f, {p:[rnd(-h*0.12,h*0.12), h*0.5, rnd(-h*0.12,h*0.12)], s:[1,0.45,1]}));
    }
  }
  else if (kind==='pine'){
    const trunkG = new THREE.CylinderGeometry(h*0.045, h*0.08, h*0.34, 7, 2);
    jitterGeo(trunkG, h*0.022, rnd(0,99));
    parts.push(part(trunkG, 0x6a4a2c, {p:[0, h*0.17, 0]}));
    const layers = 4+Math.floor(Math.random()*2);
    for (let i=0;i<layers;i++){
      const k = i/(layers-1);
      const r = h*(0.32 - 0.22*k)*rnd(0.9,1.12);
      const cg = new THREE.ConeGeometry(r, h*0.32, 9, 2);
      jitterGeo(cg, r*0.24, rnd(0,99));
      parts.push(part(cg, new THREE.Color().setHSL(0.36+Math.random()*0.04, 0.52, 0.19+k*0.1),
        {p:[rnd(-1,1)*h*0.015, h*(0.3+0.155*i), rnd(-1,1)*h*0.015], r:[0,Math.random()*3,0]}));
    }
  }
  else { // oak / sakura
    const sakura = kind==='sakura';
    const trunkG = new THREE.CylinderGeometry(h*0.055, h*0.105, h*0.52, 8, 3);
    jitterGeo(trunkG, h*0.04, rnd(0,99));
    parts.push(part(trunkG, sakura? 0x5c4238 : 0x7a5230, {p:[0, h*0.26, 0]}));
    // 斜出的枝干
    for (let b=0;b<2;b++){
      const brG = new THREE.CylinderGeometry(h*0.02, h*0.038, h*0.3, 6);
      jitterGeo(brG, h*0.015, rnd(0,99));
      const a = rnd(0,6.3);
      parts.push(part(brG, sakura? 0x5c4238 : 0x7a5230,
        {p:[Math.cos(a)*h*0.14, h*0.5, Math.sin(a)*h*0.14], r:[rnd(0.4,0.8)*Math.sin(a), 0, rnd(0.4,0.8)*Math.cos(a)]}));
    }
    // 团状树冠(多球)
    const blobs = 4+Math.floor(Math.random()*3);
    for (let i=0;i<blobs;i++){
      const r = h*rnd(0.17,0.27);
      const bg = new THREE.IcosahedronGeometry(r, 1);
      jitterGeo(bg, r*0.32, rnd(0,99));
      const a = i/blobs*Math.PI*2 + rnd(0,1);
      const rr = i===0? 0 : h*rnd(0.1,0.2);
      const col = sakura
        ? new THREE.Color().setHSL(rnd(0.9,0.96), 0.58, rnd(0.72,0.82))
        : new THREE.Color().setHSL(rnd(0.29,0.36), 0.5, rnd(0.28,0.42));
      parts.push(part(bg, col,
        {p:[Math.cos(a)*rr, h*(i===0? 0.72 : rnd(0.56,0.72)), Math.sin(a)*rr], s:[1, rnd(0.8,1), 1]}));
    }
  }
  const mesh = new THREE.Mesh(mergeParts(parts), propMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/* ---------- 区域检测 ---------- */
function onMid(x,z){ return Math.abs(x+z) < 16; }
function onRiver(x,z){ return Math.abs(x-z) < 15; }
function onEdgeLane(x,z){ return Math.abs(x) > 84 || Math.abs(z) > 84; }
const KEEP_OUT = [[-60,-10],[-10,60],[60,10],[10,-60],[-45,-45],[45,45],[-97,97],[97,-97],[-108,108],[108,-108]];
function nearKeepOut(x,z,r){ return KEEP_OUT.some(([cx,cz])=>Math.hypot(x-cx,z-cz) < (r||14)); }
function jungleSpot(){
  for (let i=0;i<60;i++){
    const x = (Math.random()*2-1)*88, z = (Math.random()*2-1)*88;
    if (onMid(x,z)||onRiver(x,z)||onEdgeLane(x,z)||nearKeepOut(x,z)) continue;
    return [x,z];
  }
  return null;
}
function riverSpot(offset){
  const t = (Math.random()*2-1)*88;
  const o = offset!=null? offset : (Math.random()-0.5)*8;
  return [t + o, t - o];
}

/* ============================================================
   植被(InstancedMesh 高性能)
   ============================================================ */
function buildGrass(){
  // 宝可梦经典高草丛:成片的深绿色草簇
  const geo = new THREE.ConeGeometry(0.9, 2.4, 5);
  geo.translate(0, 1.2, 0);
  const mat = new THREE.MeshLambertMaterial({color:0xffffff});
  const N = 300;
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.castShadow = false; mesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let i = 0;
  // 40 片草丛区,每片 6-9 簇
  for (let p=0; p<44 && i<N; p++){
    const spot = jungleSpot(); if (!spot) continue;
    const [px,pz] = spot;
    const n = 6 + Math.floor(Math.random()*4);
    for (let k=0; k<n && i<N; k++){
      const a = Math.random()*Math.PI*2, r = Math.sqrt(Math.random())*4.2;
      dummy.position.set(px+Math.cos(a)*r, 0, pz+Math.sin(a)*r);
      const s = 0.7+Math.random()*0.9;
      dummy.scale.set(s, s*(0.8+Math.random()*0.6), s);
      dummy.rotation.y = Math.random()*Math.PI;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.33+Math.random()*0.05, 0.55, 0.22+Math.random()*0.14);
      mesh.setColorAt(i, col);
      i++;
    }
  }
  mesh.count = i;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
}

function buildFlowers(){
  const N = 220;
  const headGeo = new THREE.SphereGeometry(0.32, 6, 5);
  const stemGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.7, 4);
  stemGeo.translate(0, 0.35, 0);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({color:0xffffff}), N);
  const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshLambertMaterial({color:0x3f7a3a}), N);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const palette = [0xff5a6a, 0xffd94a, 0xff8ac8, 0xffffff, 0x7ab8ff, 0xffa040, 0xc890ff];
  let i = 0;
  for (let p=0; p<34 && i<N; p++){
    const spot = jungleSpot(); if (!spot) continue;
    const [px,pz] = spot;
    const n = 5 + Math.floor(Math.random()*5);
    const c = palette[Math.floor(Math.random()*palette.length)];
    for (let k=0; k<n && i<N; k++){
      const a = Math.random()*Math.PI*2, r = Math.sqrt(Math.random())*3.4;
      const x = px+Math.cos(a)*r, z = pz+Math.sin(a)*r;
      const s = 0.7+Math.random()*0.7;
      dummy.position.set(x, 0.7*s, z);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
      col.set(Math.random()<0.75? c : palette[Math.floor(Math.random()*palette.length)]);
      heads.setColorAt(i, col);
      dummy.position.set(x, 0, z);
      dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);
      i++;
    }
  }
  heads.count = stems.count = i;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  scene.add(heads); scene.add(stems);
}

function buildMushrooms(){
  const N = 60;
  const capGeo = new THREE.SphereGeometry(0.55, 8, 5, 0, Math.PI*2, 0, Math.PI/2);
  capGeo.translate(0, 0.55, 0);
  const stemGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.6, 6);
  stemGeo.translate(0, 0.3, 0);
  const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshLambertMaterial({color:0xffffff}), N);
  const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshLambertMaterial({color:0xf0e8d8}), N);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let i = 0;
  for (let p=0; p<20 && i<N; p++){
    const spot = jungleSpot(); if (!spot) continue;
    const [px,pz] = spot;
    for (let k=0; k<2+Math.floor(Math.random()*2) && i<N; k++){
      const x = px+(Math.random()-0.5)*3, z = pz+(Math.random()-0.5)*3;
      const s = 0.8+Math.random()*1.4;
      dummy.position.set(x, 0, z);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      caps.setMatrixAt(i, dummy.matrix);
      stems.setMatrixAt(i, dummy.matrix);
      col.set(Math.random()<0.5? 0xd84545 : Math.random()<0.5? 0xba68c8 : 0xe8a030);
      caps.setColorAt(i, col);
      i++;
    }
  }
  caps.count = stems.count = i;
  if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
  scene.add(caps); scene.add(stems);
}

/* 树木+莓果树+樱花树+岩石(高精度程序化模型) */
function buildMoreTrees(){
  const berryCols = [0xff5a6a, 0x7ab8ff, 0xffd94a, 0xff8ac8];
  let placed = 0, guard = 0;
  while (placed < 62 && guard++ < 1200){
    const spot = jungleSpot(); if (!spot) continue;
    const [x,z] = spot;
    const roll = Math.random();
    const kind = roll<0.18? 'rock' : roll<0.36? 'pine' : roll<0.52? 'sakura' : 'oak';
    const h = kind==='rock'? 2.5+Math.random()*3 : 8+Math.random()*7;
    const g = makeProp(kind, h);
    g.position.set(x, 0, z);
    g.rotation.y = Math.random()*7;
    scene.add(g);
    if (kind==='sakura') sakuraSpots.push([x,z]);
    // 部分橡树挂莓果
    if (kind==='oak' && Math.random() < 0.35){
      const c = berryCols[Math.floor(Math.random()*berryCols.length)];
      const berryGeo = new THREE.SphereGeometry(0.42, 8, 6);
      const berryMat = new THREE.MeshLambertMaterial({color:c});
      for (let b=0; b<6; b++){
        const m = new THREE.Mesh(berryGeo, berryMat);
        const a = Math.random()*Math.PI*2;
        m.position.set(Math.cos(a)*(1.2+Math.random()*1.6), h*0.55+Math.random()*h*0.3, Math.sin(a)*(1.2+Math.random()*1.6));
        g.add(m);
      }
    }
    placed++;
  }
}

/* 散落的精灵球道具 */
function buildPokeballProps(){
  const mats = {
    red: new THREE.MeshLambertMaterial({color:0xd83a3a}),
    blue: new THREE.MeshLambertMaterial({color:0x3a6cd8}),
    yellow: new THREE.MeshLambertMaterial({color:0xd8b03a}),
    white: new THREE.MeshLambertMaterial({color:0xf2f2f2}),
    black: new THREE.MeshLambertMaterial({color:0x222228}),
  };
  const topCols = ['red','red','blue','yellow'];
  for (let i=0;i<22;i++){
    const spot = jungleSpot(); if (!spot) continue;
    const [x,z] = spot;
    const g = new THREE.Group();
    const r = 0.55+Math.random()*0.35;
    const top = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI*2, 0, Math.PI/2), mats[topCols[i%4]]);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI*2, Math.PI/2, Math.PI/2), mats.white);
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, r*0.14, 6, 16), mats.black);
    band.rotation.x = Math.PI/2;
    const btn = new THREE.Mesh(new THREE.SphereGeometry(r*0.22, 8, 6), mats.white);
    btn.position.set(0,0,r*0.95);
    g.add(top,bot,band,btn);
    g.position.set(x, r*0.75, z);
    g.rotation.set((Math.random()-0.5)*0.7, Math.random()*7, (Math.random()-0.5)*0.7);
    g.traverse(o=>{ if(o.isMesh) o.castShadow = true; });
    scene.add(g);
  }
}

/* ============================================================
   河道: 活水/荷叶/踏石/木桥/岸边
   ============================================================ */
function buildRiver(){
  // 波光水面(对角放置的长条,贴图滚动)
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(90,170,230,0.55)'; g.fillRect(0,0,256,64);
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
  for (let i=0;i<10;i++){
    g.beginPath();
    const y = Math.random()*64;
    g.moveTo(Math.random()*40, y);
    for (let x=0;x<256;x+=24) g.quadraticCurveTo(x+12, y+(Math.random()-0.5)*10, x+24, y);
    g.stroke();
  }
  waterTex = new THREE.CanvasTexture(cv);
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(9, 1);
  waterMat = new THREE.MeshBasicMaterial({map:waterTex, transparent:true, opacity:0.6, depthWrite:false});
  const water = new THREE.Mesh(new THREE.PlaneGeometry(294, 15), waterMat);
  water.rotation.x = -Math.PI/2;
  water.rotation.z = -Math.PI/4;
  water.position.y = 0.16;
  scene.add(water);

  // 荷叶
  const lilyGeo = new THREE.CircleGeometry(1.1, 9, 0.5, Math.PI*1.8);
  const lilyMat = new THREE.MeshLambertMaterial({color:0x4a9848, side:THREE.DoubleSide});
  for (let i=0;i<16;i++){
    const [x,z] = riverSpot();
    if (Math.hypot(x,z) < 14) continue;
    const m = new THREE.Mesh(lilyGeo, lilyMat);
    m.rotation.x = -Math.PI/2;
    m.rotation.z = Math.random()*7;
    m.position.set(x, 0.3, z);
    const s = 0.7+Math.random()*0.9;
    m.scale.setScalar(s);
    scene.add(m);
    lilies.push({m, ph:Math.random()*7});
    // 少数荷叶开花
    if (Math.random()<0.3){
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.36,6,5), new THREE.MeshLambertMaterial({color:0xff8ac8}));
      f.position.set(x, 0.65, z);
      scene.add(f);
    }
  }
  // 中央石板广场(中路渡口)
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.5, 0.5, 24),
    new THREE.MeshLambertMaterial({color:0xb8b0a0}));
  plaza.position.set(0, 0.1, 0);
  plaza.receiveShadow = true;
  scene.add(plaza);
  // 广场精灵球纹样
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(6, 0.35, 6, 32),
    new THREE.MeshLambertMaterial({color:0x8a8276}));
  ringM.rotation.x = Math.PI/2; ringM.position.y = 0.42;
  scene.add(ringM);

  // 两座木桥(野区过河点)
  for (const s of [-1, 1]){
    const bx = 32*s, bz = 32*s;
    const bridge = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.7, 6.4),
      new THREE.MeshLambertMaterial({color:0x9a6a3a}));
    deck.position.y = 1.1;
    bridge.add(deck);
    // 桥板条纹
    const slatMat = new THREE.MeshLambertMaterial({color:0x7a5028});
    for (let k=-8; k<=8; k+=2){
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 6.6), slatMat);
      slat.position.set(k, 1.5, 0);
      bridge.add(slat);
    }
    // 栏杆
    for (const zz of [-3, 3]){
      const rail = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 0.3), slatMat);
      rail.position.set(0, 2.6, zz);
      bridge.add(rail);
      for (const xx of [-8,-4,0,4,8]){
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.8, 0.36), slatMat);
        post.position.set(xx, 1.8, zz);
        bridge.add(post);
      }
    }
    bridge.position.set(bx, 0, bz);
    bridge.rotation.y = Math.PI/4;   // 垂直于河道
    bridge.traverse(o=>{ if(o.isMesh){ o.castShadow = true; }});
    scene.add(bridge);
  }
  // 岸边小石头
  const pebbleGeo = new THREE.DodecahedronGeometry(0.5);
  const pebbleMat = new THREE.MeshLambertMaterial({color:0x9a958a});
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, 60);
  const dummy = new THREE.Object3D();
  for (let i=0;i<60;i++){
    const [x,z] = riverSpot(9 + Math.random()*3 * (Math.random()<0.5?-1:1));
    dummy.position.set(x, 0.2, z);
    dummy.scale.setScalar(0.5+Math.random()*1.3);
    dummy.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
  }
  scene.add(pebbles);
}

/* ============================================================
   营地水晶 / 巢穴岩圈 / 基地装饰 / 围栏
   ============================================================ */
function buildCamps(){
  // buff营地发光水晶
  const camps = [[-60,-10,0x4aa0f0],[-10,60,0xff5040],[60,10,0x4aa0f0],[10,-60,0xff5040]];
  for (const [x,z,c] of camps){
    const cry = new THREE.Mesh(new THREE.OctahedronGeometry(1.7),
      new THREE.MeshLambertMaterial({color:c, emissive:new THREE.Color(c).multiplyScalar(0.45)}));
    cry.position.set(x+5, 2.4, z+5);
    scene.add(cry);
    crystals.push({m:cry, ph:Math.random()*7, y0:2.4});
    // 小水晶簇
    for (let k=0;k<3;k++){
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.5+Math.random()*0.4),
        cry.material);
      s.position.set(x+5+(Math.random()-0.5)*4, 0.7, z+5+(Math.random()-0.5)*4);
      scene.add(s);
    }
  }
  // 龙坑/男爵坑:岩石环 + 骨头/尖刺
  for (const [cx,cz,boss] of [[-45,-45,'baron'],[45,45,'dragon']]){
    for (let k=0;k<9;k++){
      const a = k/9*Math.PI*2;
      if (Math.abs(Math.cos(a-Math.PI/4)) > 0.86) continue; // 朝河道留口
      const rock = makeProp('rock', 4.5+Math.random()*4);
      rock.position.set(cx+Math.cos(a)*13, 0, cz+Math.sin(a)*13);
      rock.rotation.y = Math.random()*7;
      scene.add(rock);
    }
    // 尖刺石
    const spikeMat = new THREE.MeshLambertMaterial({color: boss==='baron'? 0x8a70b8 : 0xc8a050});
    for (let k=0;k<5;k++){
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.5+Math.random()*2.5, 5), spikeMat);
      const a = Math.random()*Math.PI*2, r = 6+Math.random()*5;
      spike.position.set(cx+Math.cos(a)*r, 1.6, cz+Math.sin(a)*r);
      spike.rotation.set((Math.random()-0.5)*0.5, 0, (Math.random()-0.5)*0.5);
      spike.castShadow = true;
      scene.add(spike);
    }
  }
}

function bannerTexture(team){
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = team==='blue'? '#2a56b8' : '#c03028';
  g.fillRect(0,0,64,96);
  g.fillStyle = 'rgba(255,255,255,0.15)';
  g.fillRect(0,0,64,10);
  // 精灵球徽记
  g.beginPath(); g.arc(32,48,18,0,7);
  g.fillStyle = '#fff'; g.fill();
  g.fillStyle = team==='blue'? '#2a56b8' : '#c03028';
  g.beginPath(); g.arc(32,48,18,Math.PI,Math.PI*2); g.fill();
  g.strokeStyle = '#222'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(14,48); g.lineTo(50,48); g.stroke();
  g.beginPath(); g.arc(32,48,5,0,7); g.fillStyle='#fff'; g.fill(); g.stroke();
  return new THREE.CanvasTexture(cv);
}

function buildBases(){
  for (const team of ['blue','red']){
    const mir = team==='blue'? 1 : -1;
    const bx = -97*mir, bz = 97*mir;
    // 旗帜
    const tex = bannerTexture(team);
    for (const [ox,oz] of [[16,2],[2,16],[22,-8],[-8,22]]){
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,13,6),
        new THREE.MeshLambertMaterial({color:0x6a5a48}));
      pole.position.set(bx+ox*mir, 6.5, bz-oz*mir);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.4,5),
        new THREE.MeshLambertMaterial({map:tex, side:THREE.DoubleSide}));
      flag.position.set(1.9, 4.4, 0);
      pole.add(flag);
      pole.castShadow = true;
      scene.add(pole);
    }
    // 泉水池
    const f = team==='blue'? new THREE.Vector3(-108,0,108) : new THREE.Vector3(108,0,-108);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.6, 0.8, 20),
      new THREE.MeshLambertMaterial({color:0xd8d4c8}));
    pool.position.set(f.x, 0.2, f.z);
    scene.add(pool);
    const poolWater = new THREE.Mesh(new THREE.CircleGeometry(8.2, 20),
      new THREE.MeshBasicMaterial({color: team==='blue'? 0x6ab8ff : 0xff9a88, transparent:true, opacity:0.55}));
    poolWater.rotation.x = -Math.PI/2;
    poolWater.position.set(f.x, 0.65, f.z);
    scene.add(poolWater);
    // 基地石灯笼
    for (const [ox,oz] of [[30,10],[10,30]]){
      const lam = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7,1,2.6,6), new THREE.MeshLambertMaterial({color:0x8a8a90}));
      base.position.y = 1.3;
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.6,1.4,1.6), new THREE.MeshLambertMaterial({color:0x8a8a90}));
      head.position.y = 3.2;
      const glow = new THREE.Mesh(new THREE.BoxGeometry(1.0,0.8,1.0),
        new THREE.MeshBasicMaterial({color: team==='blue'? 0x9fd0ff : 0xffc090}));
      glow.position.y = 3.2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5,1,4), new THREE.MeshLambertMaterial({color:0x6a6a72}));
      roof.position.y = 4.3; roof.rotation.y = Math.PI/4;
      lam.add(base, head, glow, roof);
      lam.position.set(bx+ox*mir, 0, bz-oz*mir);
      lam.traverse(o=>{ if(o.isMesh) o.castShadow = true; });
      scene.add(lam);
    }
  }
}

function buildFences(){
  const woodMat = new THREE.MeshLambertMaterial({color:0x9a7048});
  function fenceSeg(x, z, rotY){
    const g = new THREE.Group();
    for (const dx of [-2.4, 2.4]){
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.22,1.9,5), woodMat);
      post.position.set(dx, 0.95, 0);
      g.add(post);
    }
    for (const y of [0.8, 1.5]){
      const rail = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.22, 0.22), woodMat);
      rail.position.y = y;
      g.add(rail);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.traverse(o=>{ if(o.isMesh) o.castShadow = true; });
    scene.add(g);
  }
  // 基地外围栏(面向场内的四分之一圆弧,留出兵线口)
  for (const mir of [1,-1]){
    for (let k=1;k<=5;k++){
      if (k===3) continue;                      // 中路口
      const a = (k/6)*(Math.PI/2);
      const x = -97*mir + Math.cos(a)*34*mir;
      const z = 97*mir - Math.sin(a)*34*mir;
      fenceSeg(x, z, Math.atan2(-Math.cos(a)*mir, Math.sin(a)*mir) + Math.PI/2);
    }
  }
}

/* ============================================================
   天空:云 / 飞鸟
   ============================================================ */
function buildSky(){
  for (let i=0;i<9;i++){
    const m = new THREE.SpriteMaterial({map:FX.tex.soft, color:0xffffff, transparent:true,
      opacity:0.35+Math.random()*0.2, depthWrite:false});
    const s = new THREE.Sprite(m);
    s.position.set((Math.random()*2-1)*150, 55+Math.random()*28, (Math.random()*2-1)*150);
    s.scale.set(34+Math.random()*30, 13+Math.random()*9, 1);
    scene.add(s);
    clouds.push({s, v:0.8+Math.random()*1.4});
  }
}
function buildBirds(){
  for (let i=0;i<3;i++){
    const inst = ENT.instantiate(16, 2.6); // 波波
    const a = Math.random()*Math.PI*2;
    inst.group.position.set((Math.random()*2-1)*100, 26+Math.random()*8, (Math.random()*2-1)*100);
    scene.add(inst.group);
    birds.push({g:inst.group, mixer:inst.mixer, dir:a, speed:9+Math.random()*4, ph:Math.random()*7});
  }
}

/* ---------- 萤火虫/光尘 ---------- */
function buildFireflies(){
  for (let i=0;i<40;i++){
    const spot = jungleSpot(); if (!spot) continue;
    const [x,z] = spot;
    const m = new THREE.SpriteMaterial({map:FX.tex.glow, color: Math.random()<0.6? 0xbfff9a : 0x9adfff,
      transparent:true, opacity:0.8, blending:THREE.AdditiveBlending, depthWrite:false});
    const s = new THREE.Sprite(m);
    s.scale.setScalar(0.7+Math.random()*0.7);
    scene.add(s);
    fireflies.push({s, x, z, ph:Math.random()*7, sp:0.5+Math.random()*0.8, r:1.5+Math.random()*2.5});
  }
}

/* ============================================================
   野生宝可梦(纯装饰,游荡/悬浮/跳跃)
   ============================================================ */
function buildWildlife(){
  const specs = [
    {id:43, n:3, h:2.6, area:'jungle', speed:2.2},            // 走路草
    {id:133, n:2, h:3.0, area:'jungle', speed:3.4},           // 伊布
    {id:79, n:2, h:3.4, area:'bank', speed:1.2},              // 呆呆兽
    {id:12, n:3, h:3.6, area:'jungle', speed:2.8, fly:true},  // 巴大蝶
  ];
  for (const sp of specs){
    for (let i=0;i<sp.n;i++){
      let x, z;
      if (sp.area==='bank'){ [x,z] = riverSpot(11); }
      else { const s = jungleSpot(); if (!s) continue; [x,z] = s; }
      const inst = ENT.instantiate(sp.id, sp.h);
      inst.group.position.set(x, 0, z);
      scene.add(inst.group);
      wanderers.push({g:inst.group, mixer:inst.mixer, hx:x, hz:z, tx:x, tz:z,
        speed:sp.speed, fly:sp.fly, wait:Math.random()*3, ph:Math.random()*7, area:sp.area});
    }
  }
  // 河里的鲤鱼王(定时跃出水面)
  for (let i=0;i<3;i++){
    const [x,z] = riverSpot(0);
    if (Math.hypot(x,z) < 16) continue;
    const inst = ENT.instantiate(129, 3.2);
    inst.group.position.set(x, -2.6, z);
    scene.add(inst.group);
    karps.push({g:inst.group, mixer:inst.mixer, x, z, t:Math.random()*8, jumping:false, jt:0});
  }
}

/* ============================================================
   构建入口 / 每帧更新
   ============================================================ */
/* ---------- 樱花花瓣飘落 ---------- */
function buildPetals(){
  if (!sakuraSpots.length) return;
  for (let i=0;i<26;i++){
    const [sx,sz] = sakuraSpots[Math.floor(Math.random()*sakuraSpots.length)];
    const m = new THREE.SpriteMaterial({map:FX.tex.leaf, color:0xffb7d0, transparent:true,
      opacity:0.9, depthWrite:false, rotation:Math.random()*3});
    const s = new THREE.Sprite(m);
    s.scale.setScalar(0.55+Math.random()*0.4);
    scene.add(s);
    petals.push({s, x:sx, z:sz, y:rnd(3,9), ph:Math.random()*7, sp:rnd(0.8,1.6)});
  }
}

function build(sc){
  scene = sc;
  buildGrass();
  buildFlowers();
  buildMushrooms();
  buildMoreTrees();
  buildPokeballProps();
  buildRiver();
  buildCamps();
  buildBases();
  buildFences();
  buildSky();
  buildBirds();
  buildFireflies();
  buildWildlife();
  buildPetals();
}

function update(dt){
  T += dt;
  // 水面滚动
  if (waterTex){ waterTex.offset.x += dt*0.06; }
  // 荷叶起伏
  for (const l of lilies){ l.m.position.y = 0.3 + Math.sin(T*1.4+l.ph)*0.08; }
  // 水晶悬浮旋转
  for (const c of crystals){
    c.m.rotation.y += dt*1.2;
    c.m.position.y = c.y0 + Math.sin(T*2+c.ph)*0.4;
  }
  // 云
  for (const c of clouds){
    c.s.position.x += c.v*dt;
    if (c.s.position.x > 165) c.s.position.x = -165;
  }
  // 萤火虫
  for (const f of fireflies){
    f.s.position.set(
      f.x + Math.cos(T*f.sp+f.ph)*f.r,
      1.6 + Math.sin(T*f.sp*1.7+f.ph)*1.2,
      f.z + Math.sin(T*f.sp*0.8+f.ph)*f.r);
    f.s.material.opacity = 0.45 + Math.sin(T*3+f.ph*2)*0.35;
  }
  // 飞鸟
  for (const b of birds){
    b.dir += Math.sin(T*0.3+b.ph)*dt*0.25;
    b.g.position.x += Math.sin(b.dir)*b.speed*dt;
    b.g.position.z += Math.cos(b.dir)*b.speed*dt;
    b.g.position.y = 26 + Math.sin(T*1.5+b.ph)*2.5;
    b.g.rotation.y = b.dir;
    if (Math.abs(b.g.position.x) > 150) b.g.position.x *= -0.95;
    if (Math.abs(b.g.position.z) > 150) b.g.position.z *= -0.95;
    if (b.mixer) b.mixer.update(dt);
  }
  // 野生宝可梦游荡
  for (const w of wanderers){
    if (w.mixer) w.mixer.update(dt);
    if (w.wait > 0){ w.wait -= dt; }
    else {
      const dx = w.tx - w.g.position.x, dz = w.tz - w.g.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5){
        w.wait = 1.5 + Math.random()*4;
        // 选新目标(限制在家附近,避开车道/河)
        for (let k=0;k<8;k++){
          const nx = w.hx + (Math.random()*2-1)*13;
          const nz = w.hz + (Math.random()*2-1)*13;
          if (w.area!=='bank' && (onMid(nx,nz)||onRiver(nx,nz))) continue;
          if (nearKeepOut(nx,nz,12)) continue;
          if (Math.abs(nx)>92||Math.abs(nz)>92) continue;
          w.tx = nx; w.tz = nz; break;
        }
      } else {
        w.g.position.x += dx/d*w.speed*dt;
        w.g.position.z += dz/d*w.speed*dt;
        w.g.rotation.y = Math.atan2(dx, dz);
      }
    }
    w.g.position.y = w.fly? 2.2 + Math.sin(T*2.2+w.ph)*0.8
      : (w.wait<=0? Math.abs(Math.sin(T*7+w.ph))*0.25 : 0);
  }
  // 樱花花瓣
  for (const p of petals){
    p.y -= p.sp*dt;
    if (p.y < 0.2){
      p.y = rnd(5,9);
      const [sx,sz] = sakuraSpots[Math.floor(Math.random()*sakuraSpots.length)];
      p.x = sx; p.z = sz;
    }
    p.s.position.set(p.x + Math.sin(T*1.3+p.ph)*2.2, p.y, p.z + Math.cos(T*0.9+p.ph)*2.2);
    p.s.material.rotation += dt*1.5;
  }
  // 鲤鱼王跳跃
  for (const k of karps){
    if (k.mixer) k.mixer.update(dt);
    if (!k.jumping){
      k.t -= dt;
      if (k.t <= 0){
        k.jumping = true; k.jt = 0;
        FX.burst({x:k.x, y:0, z:k.z}, {count:8, tex:'bubble', color:0x9fd8ff, size:1.4, speed:5, up:1.6, life:0.6, yOff:0.3});
      }
    } else {
      k.jt += dt;
      const p = k.jt/1.1;
      if (p >= 1){
        k.jumping = false;
        k.t = 5 + Math.random()*7;
        k.g.position.y = -2.6;
        FX.burst({x:k.x, y:0, z:k.z}, {count:10, tex:'bubble', color:0x9fd8ff, size:1.6, speed:7, up:1.4, life:0.6, yOff:0.3});
      } else {
        k.g.position.y = -2.4 + Math.sin(p*Math.PI)*7;
        k.g.rotation.z = Math.sin(p*Math.PI*2)*0.7;
        k.g.rotation.y += dt*3;
      }
    }
  }
}

return {build, update, AMBIENT_IDS, makeProp};
})();
