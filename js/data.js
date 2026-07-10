/* ============================================================
   宝可梦联盟 · 数据定义
   英雄 / 技能 / 装备 / 小兵 / 防御塔 / 野怪
   ============================================================ */
window.DATA = (function(){

const TYPE_COLOR = {
  '电':'#f8c832','火':'#ff7a3c','水':'#4aa0f0','草':'#5cc860','毒':'#a860c8',
  '超':'#f860a0','鬼':'#7060c8','龙':'#8058f8','冰':'#8ce0e0','格斗':'#c84838',
  '飞':'#a8b8f0','一般':'#b8b8a8'
};

/* ---------- 英雄 ----------
   atkType: physical=物攻(atk) / special=特攻(sp)
   height: 模型归一化后的目标身高(游戏单位)
*/
const CHAMPS = [
{
  id:25, key:'pikachu', name:'皮卡丘', title:'闪电游侠', role:'射手', types:['电'],
  atkType:'special', ranged:true, range:46, ms:29, height:4.6,
  hp:555, hpL:86, mp:300, mpL:36, atk:60, atkL:4.6, def:24, defL:3.2, sdef:28, sdefL:3.4, as:0.78, asL:0.032,
  skills:[
    {key:'Q', name:'十万伏特', icon:'⚡', type:'电', pattern:'bolt', cd:[7,6.5,6,5.5,5], mana:55,
     range:62, width:4.5, speed:130, pierce:false, dmg:[75,115,155,195,235], ratio:0.85, vfx:'lightning',
     desc:'向指定方向发射一道十万伏特电流，对命中的第一个敌人造成特攻伤害。'},
    {key:'W', name:'电磁波', icon:'🌐', type:'电', pattern:'aoe', cd:[13,12,11,10,9], mana:70,
     range:52, radius:11, delay:0.55, dmg:[60,95,130,165,200], ratio:0.55, slow:{pct:0.45,dur:2.2}, vfx:'thunderweb',
     desc:'在目标区域释放麻痹电网，造成伤害并使敌人减速45%，持续2.2秒。'},
    {key:'E', name:'电光一闪', icon:'💨', type:'一般', pattern:'dash', cd:[12,11,10,9,8], mana:50,
     range:34, dmg:[40,65,90,115,140], ratio:0.4, empower:{pct:0.5,dur:4}, vfx:'quickdash',
     desc:'向指定方向闪电疾冲，对路径上的敌人造成伤害，并强化下次普攻。'},
    {key:'R', name:'落雷轰鸣', icon:'🌩️', type:'电', pattern:'storm', cd:[95,80,65], mana:100,
     range:58, radius:16, strikes:6, interval:0.34, dmg:[95,150,205], ratio:0.5, slow:{pct:0.3,dur:1}, vfx:'thunderstorm',
     desc:'呼唤雷云在目标区域降下6道天雷，每道对范围内敌人造成特攻伤害并减速。'},
  ]
},
{
  id:6, key:'charizard', name:'喷火龙', title:'烈焰霸主', role:'战士', types:['火','飞'],
  atkType:'physical', ranged:false, range:11, ms:29, height:8.2,
  hp:640, hpL:98, mp:280, mpL:32, atk:66, atkL:5.0, def:30, defL:3.9, sdef:30, sdefL:3.4, as:0.72, asL:0.030,
  skills:[
    {key:'Q', name:'火焰爪', icon:'🔥', type:'火', pattern:'cone', cd:[6,5.5,5,4.5,4], mana:40,
     range:15, angle:1.5, dmg:[70,110,150,190,230], ratio:0.9, dot:{dps:12,dur:2}, vfx:'flameclaw',
     desc:'挥出燃烧的利爪，对前方扇形敌人造成物攻伤害并点燃2秒。'},
    {key:'W', name:'龙之舞', icon:'🐉', type:'龙', pattern:'buff', cd:[16,15,14,13,12], mana:55,
     buff:{as:0.45,ms:0.2,dur:4.5}, vfx:'dragondance',
     desc:'跳起龙之舞，攻速提高45%、移速提高20%，持续4.5秒。'},
    {key:'E', name:'俯冲突袭', icon:'🦅', type:'飞', pattern:'dash', cd:[13,12,11,10,9], mana:60,
     range:38, dmg:[70,105,140,175,210], ratio:0.7, slow:{pct:0.3,dur:1.5}, vfx:'divebomb',
     desc:'展翅俯冲，对路径上的敌人造成伤害并减速30%。'},
    {key:'R', name:'喷射火焰', icon:'☄️', type:'火', pattern:'channelcone', cd:[90,75,60], mana:100,
     range:34, angle:0.9, dur:2.6, tick:0.25, dmg:[38,58,78], ratio:0.28, vfx:'flamethrower',
     desc:'持续2.6秒喷吐烈焰洪流，灼烧前方扇形区域内的所有敌人。'},
  ]
},
{
  id:9, key:'blastoise', name:'水箭龟', title:'重炮堡垒', role:'坦克', types:['水'],
  atkType:'physical', ranged:true, range:36, ms:27, height:7.2,
  hp:700, hpL:108, mp:320, mpL:40, atk:60, atkL:4.2, def:36, defL:4.6, sdef:34, sdefL:4.0, as:0.66, asL:0.024,
  skills:[
    {key:'Q', name:'水炮', icon:'💧', type:'水', pattern:'bolt', cd:[8,7.5,7,6.5,6], mana:60,
     range:56, width:5, speed:100, pierce:false, dmg:[80,120,160,200,240], ratio:0.8, slow:{pct:0.25,dur:1.2}, vfx:'watershot',
     desc:'从炮口射出高压水柱，对命中的第一个敌人造成伤害并减速。'},
    {key:'W', name:'缩入壳中', icon:'🛡️', type:'水', pattern:'buff', cd:[15,14,13,12,11], mana:60,
     shield:[90,140,190,240,290], shieldRatio:0.6, buff:{def:40,sdef:40,dur:3.5}, vfx:'withdraw',
     desc:'缩进坚硬的龟壳，获得护盾并提高双防，持续3.5秒。'},
    {key:'E', name:'激流冲撞', icon:'🌊', type:'水', pattern:'dash', cd:[14,13,12,11,10], mana:70,
     range:32, dmg:[60,95,130,165,200], ratio:0.6, knockup:0.8, vfx:'aquajet',
     desc:'化作激流向前冲撞，击飞路径上的敌人0.8秒。'},
    {key:'R', name:'加农水炮', icon:'🚀', type:'水', pattern:'beam', cd:[100,85,70], mana:100,
     range:110, width:7, delay:0.6, dmg:[220,330,440], ratio:1.0, slow:{pct:0.4,dur:2}, vfx:'hydrocannon',
     desc:'短暂蓄力后发射贯穿战场的巨型水炮，对直线上所有敌人造成巨额伤害。'},
  ]
},
{
  id:3, key:'venusaur', name:'妙蛙花', title:'丛林掌控者', role:'法师', types:['草','毒'],
  atkType:'special', ranged:true, range:44, ms:27, height:6.6,
  hp:620, hpL:92, mp:340, mpL:42, atk:62, atkL:4.6, def:30, defL:3.8, sdef:32, sdefL:3.8, as:0.68, asL:0.024,
  skills:[
    {key:'Q', name:'飞叶快刀', icon:'🍃', type:'草', pattern:'bolt', cd:[6,5.5,5,4.5,4], mana:45,
     range:54, width:6, speed:95, pierce:true, dmg:[60,95,130,165,200], ratio:0.6, vfx:'razorleaf',
     desc:'掷出旋转的锋利叶刃，贯穿直线上的所有敌人。'},
    {key:'W', name:'寄生种子', icon:'🌱', type:'草', pattern:'targeted', cd:[12,11,10,9,8], mana:65,
     range:46, dmg:[30,50,70,90,110], ratio:0.3, dot:{dps:[18,28,38,48,58],dur:4,ratio:0.12}, leech:0.6, vfx:'leechseed',
     desc:'将寄生种子种到敌人身上，4秒内持续吸取生命回复自己。'},
    {key:'E', name:'藤鞭缠绕', icon:'🪢', type:'草', pattern:'bolt', cd:[13,12,11,10,9], mana:70,
     range:50, width:4.5, speed:85, pierce:false, dmg:[65,100,135,170,205], ratio:0.55, root:1.6, vfx:'vinewhip',
     desc:'甩出藤鞭缠住命中的第一个敌人，将其禁锢1.6秒。'},
    {key:'R', name:'日光束', icon:'☀️', type:'草', pattern:'beam', cd:[95,80,65], mana:100,
     range:80, width:9, delay:1.0, dmg:[250,370,490], ratio:1.05, vfx:'solarbeam',
     desc:'汇聚太阳能量1秒后，释放毁灭性的日光束，焚烧直线上所有敌人。'},
  ]
},
{
  id:94, key:'gengar', name:'耿鬼', title:'暗影刺客', role:'刺客', types:['鬼','毒'],
  atkType:'special', ranged:false, range:12, ms:30, height:5.6,
  hp:570, hpL:84, mp:320, mpL:40, atk:64, atkL:5.2, def:24, defL:3.0, sdef:30, sdefL:3.4, as:0.8, asL:0.034,
  skills:[
    {key:'Q', name:'暗影球', icon:'🔮', type:'鬼', pattern:'bolt', cd:[6.5,6,5.5,5,4.5], mana:50,
     range:52, width:5, speed:90, pierce:false, dmg:[80,125,170,215,260], ratio:0.9, vfx:'shadowball',
     desc:'凝聚怨念投出暗影球，对命中的第一个敌人造成高额特攻伤害。'},
    {key:'W', name:'催眠术', icon:'😴', type:'超', pattern:'aoe', cd:[16,15,14,13,12], mana:75,
     range:44, radius:9, delay:0.7, dmg:[40,65,90,115,140], ratio:0.4, stun:1.4, vfx:'hypnosis',
     desc:'散布催眠波纹，使区域内敌人陷入沉睡1.4秒。'},
    {key:'E', name:'黑夜魔影', icon:'🌫️', type:'鬼', pattern:'blink', cd:[14,12.5,11,9.5,8], mana:60,
     range:36, stealth:1.8, buff:{ms:0.25,dur:1.8}, vfx:'shadowsneak',
     desc:'融入暗影瞬移到目标位置，并隐身1.8秒（AI无法锁定）。'},
    {key:'R', name:'暗影重击', icon:'💀', type:'鬼', pattern:'nova', cd:[85,70,55], mana:100,
     radius:20, dmg:[230,340,450], ratio:1.0, missingRatio:0.18, slow:{pct:0.5,dur:1.5}, vfx:'shadownova',
     desc:'释放所有怨念形成暗影风暴，对周围敌人造成巨额伤害（目标已损生命越多伤害越高）。'},
  ]
},
{
  id:65, key:'alakazam', name:'胡地', title:'超能大师', role:'法师', types:['超'],
  atkType:'special', ranged:true, range:48, ms:28, height:6.0,
  hp:530, hpL:78, mp:400, mpL:52, atk:58, atkL:4.4, def:22, defL:2.8, sdef:36, sdefL:4.2, as:0.7, asL:0.026,
  skills:[
    {key:'Q', name:'精神强念', icon:'💫', type:'超', pattern:'targeted', cd:[7,6.5,6,5.5,5], mana:60,
     range:48, dmg:[85,130,175,220,265], ratio:0.85, slow:{pct:0.3,dur:1.2}, vfx:'psybeam',
     desc:'用意念直接冲击目标心智，造成特攻伤害并减速。'},
    {key:'W', name:'折弯汤匙', icon:'🥄', type:'超', pattern:'buff', cd:[15,14,13,12,11], mana:55,
     shield:[80,125,170,215,260], shieldRatio:0.7, buff:{sp:30,dur:4}, vfx:'spoonbend',
     desc:'展开念力屏障获得护盾，并短暂提高特攻。'},
    {key:'E', name:'瞬间移动', icon:'✨', type:'超', pattern:'blink', cd:[16,14,12,10,8], mana:70,
     range:34, vfx:'teleport',
     desc:'瞬间移动到目标位置。'},
    {key:'R', name:'精神干扰', icon:'🌀', type:'超', pattern:'aoe', cd:[90,75,60], mana:110,
     range:56, radius:15, delay:0.8, dmg:[240,360,480], ratio:1.1, silence:1.8, vfx:'psychicblast',
     desc:'撕裂目标区域的精神空间，造成巨额伤害并沉默敌人1.8秒。'},
  ]
},
{
  id:68, key:'machamp', name:'怪力', title:'四臂斗神', role:'斗士', types:['格斗'],
  atkType:'physical', ranged:false, range:9, ms:29, height:6.8,
  hp:680, hpL:104, mp:280, mpL:34, atk:70, atkL:5.4, def:32, defL:4.2, sdef:28, sdefL:3.4, as:0.7, asL:0.03,
  skills:[
    {key:'Q', name:'空手劈', icon:'👊', type:'格斗', pattern:'cone', cd:[6,5.5,5,4.5,4], mana:40,
     range:13, angle:1.6, dmg:[80,125,170,215,260], ratio:1.0, vfx:'karatechop',
     desc:'四臂齐挥劈向前方，对扇形范围敌人造成高额物攻伤害。'},
    {key:'W', name:'健美', icon:'💪', type:'格斗', pattern:'buff', cd:[15,14,13,12,11], mana:50,
     buff:{atk:35,def:30,dur:5}, heal:[40,70,100,130,160], vfx:'bulkup',
     desc:'鼓舞肌肉，回复生命并提高物攻与防御，持续5秒。'},
    {key:'E', name:'过肩摔', icon:'🤼', type:'格斗', pattern:'chase', cd:[13,12,11,10,9], mana:60,
     range:30, dmg:[70,110,150,190,230], ratio:0.8, stun:1.0, vfx:'seismictoss',
     desc:'冲向目标敌人将其过肩摔翻，造成伤害并眩晕1秒。'},
    {key:'R', name:'爆裂拳', icon:'💥', type:'格斗', pattern:'chase', cd:[80,65,50], mana:100,
     range:26, dmg:[260,390,520], ratio:1.3, stun:1.5, vfx:'dynamicpunch',
     desc:'蓄满全力的一击！冲向目标造成毁灭性伤害并眩晕1.5秒。'},
  ]
},
{
  id:131, key:'lapras', name:'拉普拉斯', title:'冰海守护者', role:'辅助', types:['水','冰'],
  atkType:'special', ranged:true, range:42, ms:26, height:7.6,
  hp:700, hpL:106, mp:360, mpL:46, atk:58, atkL:4.0, def:32, defL:4.0, sdef:38, sdefL:4.4, as:0.62, asL:0.02,
  skills:[
    {key:'Q', name:'冰冻光束', icon:'❄️', type:'冰', pattern:'bolt', cd:[7,6.5,6,5.5,5], mana:55,
     range:56, width:4.5, speed:105, pierce:false, dmg:[70,110,150,190,230], ratio:0.75, slow:{pct:0.5,dur:2}, vfx:'icebeam',
     desc:'射出极寒光束，对命中的第一个敌人造成伤害并重度减速。'},
    {key:'W', name:'治愈波动', icon:'💚', type:'水', pattern:'healaoe', cd:[14,13,12,11,10], mana:80,
     radius:22, heal:[70,110,150,190,230], healRatio:0.55, vfx:'healpulse',
     desc:'释放治愈波动，回复周围所有友军的生命。'},
    {key:'E', name:'冲浪', icon:'🌊', type:'水', pattern:'wave', cd:[13,12,11,10,9], mana:70,
     range:44, width:14, speed:65, dmg:[70,110,150,190,230], ratio:0.6, knockup:0.6, vfx:'surf',
     desc:'掀起巨浪向前推进，击飞浪潮中的敌人。'},
    {key:'R', name:'暴风雪', icon:'🌨️', type:'冰', pattern:'zone', cd:[95,80,65], mana:110,
     radius:24, dur:3.5, tick:0.5, dmg:[40,60,80], ratio:0.25, slow:{pct:0.6,dur:0.6}, vfx:'blizzard',
     desc:'以自身为中心召唤暴风雪，持续冻伤并重度减速范围内敌人。'},
  ]
},
{
  id:143, key:'snorlax', name:'卡比兽', title:'贪睡巨墙', role:'坦克', types:['一般'],
  atkType:'physical', ranged:false, range:10, ms:25, height:8.4,
  hp:800, hpL:126, mp:260, mpL:30, atk:64, atkL:4.6, def:34, defL:4.4, sdef:36, sdefL:4.4, as:0.6, asL:0.02,
  skills:[
    {key:'Q', name:'泰山压顶', icon:'🪨', type:'一般', pattern:'leap', cd:[10,9.5,9,8.5,8], mana:55,
     range:26, radius:10, dmg:[80,125,170,215,260], ratio:0.8, slow:{pct:0.4,dur:1.5}, vfx:'bodyslam',
     desc:'跃向目标区域用巨躯压顶，造成伤害并减速。'},
    {key:'W', name:'睡觉', icon:'💤', type:'超', pattern:'channelheal', cd:[18,17,16,15,14], mana:0,
     dur:2.5, healPctPerSec:0.09, vfx:'rest',
     desc:'原地睡2.5秒，每秒回复9%最大生命（移动会打断）。'},
    {key:'E', name:'滚动冲撞', icon:'🌀', type:'一般', pattern:'dash', cd:[14,13,12,11,10], mana:60,
     range:34, dmg:[70,110,150,190,230], ratio:0.7, slow:{pct:0.35,dur:1.5}, vfx:'rollout',
     desc:'蜷成球滚向前方，撞开路径上的敌人。'},
    {key:'R', name:'捶打大地', icon:'🌋', type:'格斗', pattern:'nova', cd:[90,75,60], mana:100,
     radius:19, dmg:[200,300,400], ratio:0.9, knockup:1.1, vfx:'earthshatter',
     desc:'全力捶击大地，掀翻周围所有敌人，将其击飞1.1秒。'},
  ]
},
{
  id:149, key:'dragonite', name:'快龙', title:'神速龙骑', role:'斗士', types:['龙','飞'],
  atkType:'physical', ranged:false, range:10, ms:30, height:7.8,
  hp:660, hpL:100, mp:300, mpL:36, atk:68, atkL:5.2, def:30, defL:3.8, sdef:32, sdefL:3.8, as:0.72, asL:0.03,
  skills:[
    {key:'Q', name:'龙之波动', icon:'🐲', type:'龙', pattern:'bolt', cd:[7,6.5,6,5.5,5], mana:50,
     range:40, width:6, speed:95, pierce:true, dmg:[70,110,150,190,230], ratio:0.75, vfx:'dragonpulse',
     desc:'张口喷出龙形气息波，贯穿直线上的敌人。'},
    {key:'W', name:'神速', icon:'⚡', type:'一般', pattern:'dash', cd:[12,11,10,9,8], mana:55,
     range:36, dmg:[50,80,110,140,170], ratio:0.5, empower:{pct:0.6,dur:4}, vfx:'extremespeed',
     desc:'以神速冲刺，强化下一次普攻造成额外伤害。'},
    {key:'E', name:'龙卷风', icon:'🌪️', type:'龙', pattern:'aoe', cd:[15,14,13,12,11], mana:70,
     range:44, radius:12, delay:0.5, dmg:[60,95,130,165,200], ratio:0.5, pull:8, slow:{pct:0.3,dur:1.2}, vfx:'twister',
     desc:'在目标区域召唤龙卷风，将敌人卷向中心并减速。'},
    {key:'R', name:'逆鳞', icon:'🔥', type:'龙', pattern:'buff', cd:[85,70,55], mana:100,
     buff:{atk:[45,70,95],as:0.5,ms:0.15,lifesteal:0.25,dur:8}, vfx:'outrage',
     desc:'触怒逆鳞进入狂暴状态：物攻、攻速、移速大幅提升并获得25%吸血，持续8秒。'},
  ]
},
{
  id:150, key:'mewtwo', name:'超梦', title:'基因浩劫', role:'法师', types:['超'],
  atkType:'special', ranged:true, range:46, ms:28, height:7.4,
  hp:600, hpL:90, mp:380, mpL:50, atk:64, atkL:5.0, def:26, defL:3.2, sdef:36, sdefL:4.2, as:0.7, asL:0.026,
  skills:[
    {key:'Q', name:'精神波', icon:'🧠', type:'超', pattern:'bolt', cd:[6.5,6,5.5,5,4.5], mana:55,
     range:58, width:5.5, speed:100, pierce:true, dmg:[70,110,150,190,230], ratio:0.8, vfx:'psywave',
     desc:'发射撕裂空间的精神波，贯穿直线上所有敌人。'},
    {key:'W', name:'障壁', icon:'🔷', type:'超', pattern:'buff', cd:[16,15,14,13,12], mana:65,
     shield:[100,155,210,265,320], shieldRatio:0.8, vfx:'barrier',
     desc:'展开六边形念力障壁，获得高额护盾。'},
    {key:'E', name:'念力禁锢', icon:'🕸️', type:'超', pattern:'aoe', cd:[14,13,12,11,10], mana:70,
     range:48, radius:9, delay:0.5, dmg:[50,80,110,140,170], ratio:0.45, root:1.4, vfx:'confine',
     desc:'用念力扭曲目标区域，禁锢其中的敌人1.4秒。'},
    {key:'R', name:'精神爆裂', icon:'☄️', type:'超', pattern:'aoe', cd:[100,85,70], mana:120,
     range:64, radius:17, delay:1.0, dmg:[300,450,600], ratio:1.2, vfx:'psystrike',
     desc:'凝聚基因之力轰击目标区域，1秒后造成毁天灭地的特攻伤害。'},
  ]
},
{
  id:38, key:'ninetales', name:'九尾', title:'妖火巫女', role:'法师', types:['火'],
  atkType:'special', ranged:true, range:46, ms:29, height:6.2,
  hp:570, hpL:84, mp:340, mpL:44, atk:60, atkL:4.6, def:26, defL:3.2, sdef:34, sdefL:4.0, as:0.72, asL:0.028,
  skills:[
    {key:'Q', name:'鬼火连弹', icon:'🔥', type:'火', pattern:'homing', cd:[8,7.5,7,6.5,6], mana:60,
     range:40, count:3, dmg:[45,70,95,120,145], ratio:0.45, vfx:'willowisp',
     desc:'放出3枚鬼火，自动追踪附近的敌人（优先英雄）。'},
    {key:'W', name:'火之漩涡', icon:'🌋', type:'火', pattern:'zone', cd:[14,13,12,11,10], mana:70,
     radius:14, dur:2.5, tick:0.5, dmg:[26,40,54,68,82], ratio:0.2, slow:{pct:0.2,dur:0.5}, vfx:'firespin',
     desc:'以自身为中心卷起火焰漩涡，持续灼烧周围敌人。'},
    {key:'E', name:'妖异之光', icon:'🌙', type:'超', pattern:'bolt', cd:[15,14,13,12,11], mana:70,
     range:48, width:4.5, speed:80, pierce:false, dmg:[60,95,130,165,200], ratio:0.5, charm:1.3, vfx:'fascinate',
     desc:'放出魅惑之光，命中的第一个敌人将神魂颠倒，缓慢走向九尾1.3秒。'},
    {key:'R', name:'大字爆炎', icon:'💥', type:'火', pattern:'aoe', cd:[90,75,60], mana:110,
     range:56, radius:15, delay:0.7, dmg:[250,375,500], ratio:1.1, dot:{dps:30,dur:3}, vfx:'fireblast',
     desc:'掷出"大"字形烈焰轰击目标区域，造成巨额伤害并持续燃烧3秒。'},
  ]
},
];

/* ---------- 召唤师技能 ---------- */
const SUMMONER = {
  heal:  {key:'D', name:'伤药喷雾', icon:'🧪', cd:120, desc:'立刻回复25%最大生命，并短暂加速。'},
  flash: {key:'F', name:'空间转移', icon:'🌀', cd:180, range:20, desc:'向指定方向瞬间移动一小段距离。'},
};

/* ---------- 装备 ----------
   stats: atk/sp/def/sdef/hp/as(攻速%)/ms(移速%)/crit/lifesteal/cdr/hpregen
*/
const ITEMS = [
 {id:'muscle-band',  name:'力量头带', cost:400,  stats:{atk:15}, desc:'物攻 +15'},
 {id:'wise-glasses', name:'博识眼镜', cost:400,  stats:{sp:18},  desc:'特攻 +18'},
 {id:'metal-coat',   name:'金属膜',   cost:400,  stats:{def:18}, desc:'防御 +18'},
 {id:'mystic-water', name:'神秘水滴', cost:400,  stats:{sdef:18},desc:'特防 +18'},
 {id:'quick-claw',   name:'先制之爪', cost:1500, stats:{as:0.28,ms:0.1}, desc:'攻速 +28%，移速 +10%'},
 {id:'charcoal',     name:'木炭',     cost:1200, stats:{sp:35},  desc:'特攻 +35'},
 {id:'black-belt',   name:'黑带',     cost:1400, stats:{atk:28,cdr:0.1}, desc:'物攻 +28，技能冷却 -10%'},
 {id:'twisted-spoon',name:'弯曲的汤匙',cost:1400, stats:{sp:32,cdr:0.1}, desc:'特攻 +32，技能冷却 -10%'},
 {id:'scope-lens',   name:'焦点镜',   cost:1600, stats:{crit:0.25,atk:15}, desc:'暴击率 +25%，物攻 +15'},
 {id:'eviolite',     name:'进化奇石', cost:1500, stats:{def:24,sdef:24,hp:180}, desc:'防御/特防 +24，生命 +180'},
 {id:'exp-share',    name:'学习装置', cost:1000, stats:{}, xpBoost:0.4, desc:'获得的经验值 +40%'},
 {id:'rare-candy',   name:'神奇糖果', cost:1600, stats:{}, consume:'level', desc:'食用后立刻提升1级！(即时生效)'},
 {id:'hyper-potion', name:'厉害伤药', cost:300,  stats:{}, consume:'heal40', desc:'立刻回复40%最大生命 (即时生效)'},
 {id:'choice-band',  name:'讲究头带', cost:3000, stats:{atk:60,ms:0.06}, desc:'物攻 +60，移速 +6%'},
 {id:'choice-specs', name:'讲究眼镜', cost:3000, stats:{sp:70},  desc:'特攻 +70'},
 {id:'choice-scarf', name:'讲究围巾', cost:2800, stats:{as:0.45,ms:0.1}, desc:'攻速 +45%，移速 +10%'},
 {id:'life-orb',     name:'生命宝珠', cost:3200, stats:{atk:32,sp:32,cdr:0.1}, desc:'物攻/特攻 +32，冷却 -10%'},
 {id:'leftovers',    name:'吃剩的东西',cost:2600, stats:{hp:380,hpregen:6}, desc:'生命 +380，每秒回复6点生命'},
 {id:'shell-bell',   name:'贝壳之铃', cost:2400, stats:{atk:22,lifesteal:0.14}, desc:'物攻 +22，攻击吸血 14%'},
 {id:'kings-rock',   name:'王者之证', cost:2500, stats:{atk:30,hp:200}, onhitSlow:{pct:0.2,dur:0.8}, desc:'物攻 +30，生命 +200，普攻使敌人减速'},
 {id:'rocky-helmet', name:'凸凹头盔', cost:2800, stats:{hp:320,def:42}, thorns:0.16, desc:'生命 +320，防御 +42，反弹16%所受普攻伤害'},
 {id:'assault-vest', name:'突击背心', cost:2800, stats:{hp:320,sdef:46}, desc:'生命 +320，特防 +46'},
 {id:'focus-sash',   name:'气势披带', cost:2900, stats:{def:26,sdef:26}, cheatDeath:180, desc:'防御/特防 +26。受到致命伤害时保留1点HP并获得护盾(180秒CD)'},
 {id:'full-restore', name:'全满药',   cost:800,  stats:{}, consume:'full', desc:'完全回复生命与能量 (即时生效)'},
];

/* ---------- 小兵 ---------- */
const MINIONS = {
  melee:  {id:19, name:'小拉达兵', hp:470, hpGrow:24, dmg:13, dmgGrow:1.2, range:5.5, ms:21, gold:21, xp:88,  height:2.6, atkCd:1.2},
  ranged: {id:16, name:'波波兵',   hp:300, hpGrow:16, dmg:17, dmgGrow:1.6, range:28,  ms:21, gold:17, xp:64,  height:2.4, atkCd:1.5, projColor:0xc8b088},
  cannon: {id:81, name:'小磁怪炮车', hp:980, hpGrow:70, dmg:28, dmgGrow:2.4, range:32, ms:19, gold:48, xp:160, height:3.4, atkCd:1.9, projColor:0x88c8ff},
};

/* ---------- 防御塔 / 基地 ---------- */
const TOWERS = {
  outer:{hp:3300, dmg:170, range:36, name:'外塔'},
  inner:{hp:3800, dmg:200, range:36, name:'高地塔'},
  nexus:{hp:4200, dmg:230, range:36, name:'基地塔'},
  def: 70, gold:260, teamGold:90, xp:200,
};
const NEXUS = {hp:5200, name:'大师球基地'};

/* ---------- 野怪 ---------- */
const JUNGLE = {
  bluebuff:{id:103, name:'椰蛋树长老', hp:1900, hpGrow:110, dmg:42, range:8, gold:90, xp:200, height:7,
    buff:{name:'蓝buff·丛林祝福', cdr:0.2, mpregen:8, dur:90, color:0x4aa0f0}},
  redbuff:{id:76, name:'隆隆岩长老', hp:2100, hpGrow:120, dmg:50, range:8, gold:90, xp:200, height:6.4,
    buff:{name:'红buff·岩之怒火', onhitBurn:22, onhitSlow:0.25, dur:90, color:0xff5040}},
  dragon:{id:130, name:'狂暴暴鲤龙', hp:3800, hpGrow:320, dmg:80, range:12, gold:180, teamGold:120, xp:400, height:12,
    stack:{name:'暴鲤龙之魂', dmgAmp:0.05}},
  baron:{id:95, name:'远古大岩蛇', hp:9500, hpGrow:0, dmg:120, range:14, gold:350, teamGold:250, xp:750, height:16,
    buff:{name:'岩蛇男爵之力', atk:45, sp:45, hpregen:10, dur:150, color:0xb060f8}},
};

/* ---------- 全局常量 ---------- */
const CONST = {
  MAP_HALF: 120,
  WAVE_INTERVAL: 32,
  FIRST_WAVE: 12,
  CANNON_EVERY: 3,
  PASSIVE_GOLD: 2.4,
  PASSIVE_GOLD_START: 20,
  START_GOLD: 550,
  KILL_GOLD: 300,
  ASSIST_GOLD: 150,
  KILL_XP: 320,
  XP_RANGE: 30,
  PASSIVE_XP: 7,
  PASSIVE_XP_START: 10,
  RESPAWN_BASE: 7,
  RESPAWN_PER_LVL: 2.4,
  MAX_LEVEL: 18,
  DRAGON_SPAWN: 120,
  DRAGON_RESPAWN: 240,
  BARON_SPAWN: 900,
  BUFF_SPAWN: 90,
  BUFF_RESPAWN: 150,
  MAX_TEAM_CHAMPS: 9,
};

function xpForLevel(l){ return 88 + l*46; }

return {CHAMPS, ITEMS, MINIONS, TOWERS, NEXUS, JUNGLE, SUMMONER, CONST, TYPE_COLOR, xpForLevel};
})();
