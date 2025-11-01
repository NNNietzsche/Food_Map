/****************************************************
 * 打卡任务中心（重构版）
 * - 等级/积分系统（动画进度）
 * - 每日任务（进度条/完成禁用）
 * - 连续与长期任务（首达奖励）
 * - 成就徽章
 * - 与地图/收藏页联动（CustomEvent）
 ****************************************************/
const STORAGE = {
    POINTS: 'km_points_v1',
    CHECKIN: 'km_checkin_v1',          // { totalDays, lastDate, streak, log: [{date,note}] }
    DAILY: 'km_daily_v1',              // { 'YYYY-MM-DD': { viewed:[], favCount, viewedDone, favDone, checkinDone } }
    FAV_DATES: 'km_fav_dates_v1',      // { shopName: 'YYYY-MM-DD' } 跨天累计收藏
    SHOP_CHECKINS: 'shop_checkins_v1', // { 'YYYY-MM-DD': { [shopName]: true } } 每店每日打卡
    LONGTERM: 'km_longterm_v2'         // { key: true } 长期任务是否已领奖
};

function todayStr(){ return new Date().toISOString().slice(0,10); }
function load(k,f){ try{ return JSON.parse(localStorage.getItem(k)) ?? f; }catch{ return f; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

/* ====== 状态读取 ====== */
let points   = load(STORAGE.POINTS, 0);
let checkin  = load(STORAGE.CHECKIN, { totalDays:0, lastDate:'', streak:0, log:[] });
let daily    = load(STORAGE.DAILY, {});
let favDates = load(STORAGE.FAV_DATES, {});
let shopCheckins = load(STORAGE.SHOP_CHECKINS, {});
let longMem  = load(STORAGE.LONGTERM, {});

const today = todayStr();
if(!daily[today]) daily[today] = { viewed:[], favCount:0, viewedDone:false, favDone:false, checkinDone:false };
save(STORAGE.DAILY, daily);

/* ====== 等级系统（可按需调整阈值） ====== */
const LV_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000]; // Lv1~Lv10
function calcLevel(p){
    let lv=1, next=LV_THRESHOLDS[lv];
    for(let i=1;i<LV_THRESHOLDS.length;i++){
        if(p >= LV_THRESHOLDS[i]) lv = i+1;
    }
    const curBase = LV_THRESHOLDS[lv-1] ?? 0;
    const nextBase = LV_THRESHOLDS[lv] ?? (curBase+1000); // Max level后仍给个虚拟区间
    const progress = Math.max(0, Math.min(1, (p - curBase) / (nextBase - curBase)));
    const toNext = Math.max(0, Math.ceil((nextBase - p)));
    return { lv, progress, toNext };
}

/* ====== 工具：近7天内日期数组 ====== */
function lastNDates(n){
    const res=[]; const d=new Date();
    for(let i=0;i<n;i++){
        const dd=new Date(d); dd.setDate(d.getDate()-i);
        res.push(dd.toISOString().slice(0,10));
    }
    return res;
}

/* ====== UI 工具 ====== */
function setProgress(el, ratio){
    requestAnimationFrame(()=>{ el.style.width = (Math.max(0,Math.min(1,ratio))*100).toFixed(0)+'%'; });
}
function showScorePopup(text){
    const wrap = document.getElementById('score-pop-container');
    const el = document.createElement('div');
    el.className = 'score-pop';
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(()=>{ el.classList.add('show'); }, 20);
    setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(),200); }, 1200);
}
function toast(msg){
    const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t);
    setTimeout(()=>t.classList.add('show'),50);
    setTimeout(()=>{t.classList.remove('show'); setTimeout(()=>t.remove(),500);},2200);
}

/* ====== 汇总今日状态 ====== */
function todayCheckinCount(){
    const rec = shopCheckins[today] || {};
    return Object.keys(rec).length; // 今日打卡了几个店
}
function dailyCheckinDone(){
    return todayCheckinCount() > 0; // 今日有任意店完成打卡即视作今日打卡完成
}

/* ====== 渲染头部（等级/积分） ====== */
function renderHeader(){
    const { lv, progress, toNext } = calcLevel(points);
    document.getElementById('level').textContent = `Lv.${lv}`;
    document.getElementById('points').textContent = points;
    document.getElementById('points-to-next').textContent = toNext;
    setProgress(document.getElementById('level-bar-fill'), progress);
}

/* ====== 每日任务 ====== */
function renderDailyTasks(){
    const rec = daily[today];
    // 与地图页/收藏页联动后的“自动判定”
    rec.checkinDone = dailyCheckinDone();
    if(rec.viewed.length >= 10) rec.viewedDone = true;
    if(rec.favCount   >= 5)  rec.favDone   = true;
    save(STORAGE.DAILY, daily);

    const list = document.getElementById('daily-list');
    const doneNum = (rec.checkinDone?1:0)+(rec.viewedDone?1:0)+(rec.favDone?1:0);
    document.getElementById('today-summary').textContent = `（已完成 ${doneNum}/3）`;

    const items = [
        {
            key: 'd_checkin',
            title: '今日打卡任意店铺',
            reward: '+5分（在地图页完成）',
            ratio: rec.checkinDone ? 1 : 0,
            right: rec.checkinDone
                ? `<button class="task-btn disabled" disabled>✅ 已完成</button>`
                : `<button class="task-btn primary" onclick="window.location.href='index.html'">去打卡</button>`,
            done: rec.checkinDone
        },
        {
            key: 'd_view10',
            title: '浏览 10 家不同店铺',
            reward: `进度 ${Math.min(rec.viewed.length,10)}/10 · +1分`,
            ratio: Math.min(rec.viewed.length,10)/10,
            right: rec.viewedDone
                ? `<button class="task-btn disabled" disabled>✅ 已完成</button>`
                : `<button class="task-btn primary-light" onclick="window.location.href='index.html'">去浏览</button>`,
            done: rec.viewedDone
        },

    ];

    list.innerHTML = items.map(it=>`
    <li class="task-card ${it.done?'done task-done':''}">
      <div class="task-info">
        <div class="task-title">${it.title}</div>
        <div class="progress-text">${it.reward}</div>
        <div class="progressbar"><span style="width:${(it.ratio*100).toFixed(0)}%"></span></div>
      </div>
      ${it.right}
    </li>
  `).join('');
}

/* ====== 连续/长期任务（首达奖励） ====== */
function renderLongterm(){
    const list = document.getElementById('longterm-list');

    // 统计：近7天有几天打卡了至少1家店
    const last7 = lastNDates(7);
    const daysWithCheckin = last7.filter(d => shopCheckins[d] && Object.keys(shopCheckins[d]).length>0).length;

    // 统计：累计打卡天数（从 CHECKIN.totalDays 推断）
    const totalDays = checkin.totalDays || daysWithCheckin; // 兼容旧数据

    // 统计：累计收藏
    const favTotal = Object.keys(favDates || {}).length;

    const tasks = [
        { key:'streak7',  title:'连续 7 天每日打卡',   goal:7,  cur:checkin.streak||daysWithCheckin, reward:'+50分' , prize:50 },
        { key:'days20',   title:'累计打卡 20 天',      goal:20, cur:totalDays,                      reward:'+10分' , prize:10 },
        { key:'days50',   title:'累计打卡 50 天',      goal:50, cur:totalDays,                      reward:'+30分' , prize:30 },
        { key:'fav10',    title:'累计收藏 10 家',      goal:10, cur:favTotal,                       reward:'+5分'  , prize:5  },
        { key:'fav50',    title:'累计收藏 50 家',      goal:50, cur:favTotal,                       reward:'+30分' , prize:30 }
    ];

    list.innerHTML = tasks.map(t=>{
        const done = t.cur >= t.goal;
        const firstTime = done && !longMem[t.key];
        if(firstTime){
            longMem[t.key]=true; save(STORAGE.LONGTERM, longMem);
            points += t.prize;   save(STORAGE.POINTS, points);
            showScorePopup(`+${t.prize}`);
            toast(`🎉 达成：${t.title}，奖励 ${t.reward}`);
            renderHeader(); // 更新等级条
        }
        const ratio = Math.min(1, t.cur/t.goal);
        return `
      <li class="task-card ${done?'done task-done':''}">
        <div class="task-info">
          <div class="task-title">${t.title}</div>
          <div class="progress-text">${Math.min(t.cur,t.goal)}/${t.goal} · ${t.reward}</div>
          <div class="progressbar"><span style="width:${(ratio*100).toFixed(0)}%"></span></div>
        </div>
        <button class="task-btn ${done?'disabled':'primary-light'}" ${done?'disabled':''}>
          ${done?'已完成':'进行中'}
        </button>
      </li>
    `;
    }).join('');
}

/* ====== 成就徽章 ====== */
function renderAchievements(){
    const row = document.getElementById('achievements');
    const badges = [];

    // 基础成就
    if((checkin.totalDays||0) >= 5)  badges.push('🥉 连续成长 5 日');
    if((checkin.totalDays||0) >= 20) badges.push('🥈 坚持 20 日');
    if((checkin.totalDays||0) >= 30) badges.push('🥇 坚持 30 日');
    if((checkin.streak||0) >= 7)     badges.push('🏆 连续 7 天');
    if(points >= 200)                 badges.push('💰 积分 200+');
    if(points >= 500)                 badges.push('💎 积分 500+');

    row.innerHTML = badges.length
        ? badges.map(b=>`<span class="badge">${b}</span>`).join('')
        : '<span class="muted">暂无成就，去打卡开始你的旅程吧！</span>';
}

/* ====== 历史记录 ====== */
function renderLog(){
    const list = document.getElementById('checkin-log');
    const log = (checkin.log || []).slice(0,15);
    list.innerHTML = log.length
        ? log.map(i=>`<li>📅 ${i.date} - ${i.note}</li>`).join('')
        : '<li class="muted">暂无记录</li>';
}

/* ====== 跨页联动：监听任务更新 ====== */
window.addEventListener('taskUpdate', (e)=>{
    // 其他页面（index/favorites）可派发该事件以实时刷新
    // e.detail.type: 'shopCheckin' | 'favorite' | 'view'
    points   = load(STORAGE.POINTS, points);
    checkin  = load(STORAGE.CHECKIN, checkin);
    daily    = load(STORAGE.DAILY, daily);
    favDates = load(STORAGE.FAV_DATES, favDates);
    shopCheckins = load(STORAGE.SHOP_CHECKINS, shopCheckins);

    renderHeader();
    renderDailyTasks();
    renderLongterm();
    renderAchievements();
    renderLog();
});

/* ====== 初始化渲染 ====== */
(function init(){
    renderHeader();
    renderDailyTasks();
    renderLongterm();
    renderAchievements();
    renderLog();
})();
