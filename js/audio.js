/* ============================================================
   宝可梦联盟 · 音频模块
   WebAudio 合成音效 + 宝可梦叫声(ogg)
   ============================================================ */
window.AUDIO = (function(){
  let ctx = null, master = null, sfxGain = null, criesGain = null, musicGain = null;
  let enabled = true, musicOn = true, musicTimer = null;
  const cryCache = {};

  function ensure(){
    if (ctx) return true;
    try{
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 1.0; sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.24; musicGain.connect(master);
      return true;
    }catch(e){ return false; }
  }
  function resume(){ if (ensure() && ctx.state==='suspended') ctx.resume(); }

  function tone(freq, dur, type, vol, t0, slide){
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime + (t0||0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type||'square'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,slide), t+dur);
    g.gain.setValueAtTime(vol||0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+dur+0.05);
  }
  function noise(dur, vol, t0, filterFreq){
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime + (t0||0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = (Math.random()*2-1) * (1-i/len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value = filterFreq||2000;
    const g = ctx.createGain(); g.gain.value = vol||0.2;
    src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t);
  }

  const SFX = {
    click(){ tone(660,0.06,'square',0.08); },
    move(){ tone(440,0.05,'sine',0.05,0,520); },
    hit(){ noise(0.08,0.12,0,1800); tone(180,0.07,'triangle',0.1,0,120); },
    crit(){ noise(0.12,0.2,0,2400); tone(320,0.12,'sawtooth',0.14,0,90); },
    cast(){ tone(520,0.12,'sine',0.1,0,880); noise(0.1,0.06,0,3000); },
    dash(){ noise(0.18,0.12,0,4000); tone(300,0.18,'sine',0.06,0,900); },
    explosion(){ noise(0.5,0.3,0,900); tone(90,0.4,'sine',0.25,0,40); },
    thunder(){ noise(0.35,0.32,0,5000); tone(120,0.3,'sawtooth',0.16,0.02,50); },
    freeze(){ tone(1200,0.2,'sine',0.08,0,400); tone(900,0.2,'sine',0.06,0.06,300); },
    heal(){ tone(523,0.12,'sine',0.1); tone(659,0.12,'sine',0.1,0.09); tone(784,0.2,'sine',0.1,0.18); },
    shield(){ tone(392,0.25,'triangle',0.1,0,392); tone(587,0.25,'triangle',0.07,0.05); },
    levelup(){ [523,659,784,1046].forEach((f,i)=>tone(f,0.14,'square',0.09,i*0.08)); },
    gold(){ tone(1318,0.07,'square',0.06); tone(1760,0.1,'square',0.05,0.05); },
    buy(){ tone(880,0.08,'square',0.08); tone(1174,0.12,'square',0.08,0.07); },
    error(){ tone(220,0.15,'square',0.1); tone(180,0.2,'square',0.1,0.1); },
    kill(){ tone(150,0.15,'sawtooth',0.16,0,80); [660,880].forEach((f,i)=>tone(f,0.12,'square',0.1,0.1+i*0.09)); },
    death(){ [440,370,311,220].forEach((f,i)=>tone(f,0.22,'triangle',0.12,i*0.15)); },
    towerHit(){ noise(0.15,0.2,0,1200); tone(140,0.15,'square',0.12,0,70); },
    towerDown(){ noise(0.8,0.32,0,700); [220,180,140,90].forEach((f,i)=>tone(f,0.3,'sawtooth',0.14,i*0.12)); },
    recall(){ [392,494,587,784].forEach((f,i)=>tone(f,0.3,'sine',0.07,i*0.22)); },
    flash(){ tone(1400,0.15,'sine',0.1,0,300); noise(0.12,0.1,0,6000); },
    ping(){ tone(987,0.12,'sine',0.1); tone(987,0.1,'sine',0.07,0.12); },
    victory(){ [523,523,523,659,784,1046].forEach((f,i)=>tone(f,0.22,'square',0.12,i*0.16)); },
    defeat(){ [392,349,311,262,196].forEach((f,i)=>tone(f,0.35,'triangle',0.12,i*0.25)); },
    announce(){ tone(587,0.15,'square',0.1); tone(880,0.25,'square',0.1,0.12); },
    ultcut(){
      noise(0.7,0.35,0,420);
      tone(50,0.8,'sine',0.32,0,38);
      tone(180,0.55,'sawtooth',0.12,0.04,960);
      tone(700,0.18,'square',0.1,0.5,1400);
      tone(1100,0.3,'square',0.08,0.6,500);
    },
  };

  function play(name){ if (enabled && SFX[name]) SFX[name](); }

  function playCry(pokeId, vol){
    if (!enabled) return;
    try{
      let a = cryCache[pokeId];
      if (!a){ a = new Audio('assets/cries/'+pokeId+'.ogg'); cryCache[pokeId] = a; }
      const c = a.cloneNode();
      c.volume = Math.min(1, vol==null?0.35:vol);
      c.play().catch(()=>{});
    }catch(e){}
  }

  /* 简易战斗背景音乐:宝可梦风格的琶音循环 */
  const MELODY = [0,4,7,12, 7,4, 0,4,7,12, 14,12, 5,9,12,17, 12,9, 7,11,14,19, 14,11];
  let melIdx = 0;
  function musicStep(){
    if (!musicOn || !enabled || !ctx) return;
    const base = 196; // G3
    const semi = MELODY[melIdx % MELODY.length]; melIdx++;
    const f = base * Math.pow(2, semi/12);
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type='triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.42);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t+0.5);
    if (melIdx % 2 === 0){
      const b = ctx.createOscillator(), bg = ctx.createGain();
      b.type='sine'; b.frequency.value = f/4;
      bg.gain.setValueAtTime(0.1, t); bg.gain.exponentialRampToValueAtTime(0.001, t+0.5);
      b.connect(bg); bg.connect(musicGain); b.start(t); b.stop(t+0.55);
    }
  }
  function startMusic(){
    if (musicTimer || !ensure()) return;
    musicTimer = setInterval(musicStep, 230);
  }
  function stopMusic(){ if (musicTimer){ clearInterval(musicTimer); musicTimer = null; } }

  return {
    play, playCry, resume, startMusic, stopMusic,
    setEnabled(v){ enabled = v; if(!v) stopMusic(); else if(musicOn) startMusic(); },
    setMusic(v){ musicOn = v; if(v) startMusic(); else stopMusic(); },
    setVolume(v){ if (ensure()) master.gain.value = v; },
    get enabled(){ return enabled; },
    get musicOn(){ return musicOn; },
  };
})();
