/**************** Konamon Map — Fixed Sidebar & Apple-like close ****************/

const STORAGE = {
    FAVS: 'km_favs_v1',
    SHOP_CHECKINS: 'km_shop_checkins_v1',
    POINTS: 'km_points_v1'
};

const todayStr = () => new Date().toISOString().slice(0,10);
const load = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let favs = load(STORAGE.FAVS, []);
let shopCheckins = load(STORAGE.SHOP_CHECKINS, {});
let points = load(STORAGE.POINTS, 0);

let userLatLng = null;
let detailOpen = false;

/* ===== 地图 ===== */
const map = L.map('map', { zoomControl:true }).setView([34.6937,135.5023], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; OpenStreetMap'
}).addTo(map);

/* 点击地图空白处 => 关闭详情（Apple Maps 风格） */
map.on('click', () => { if (detailOpen) closeDetail(); });

/* ===== Toast ===== */
function toast(msg){
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(()=>t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),250); }, 2200);
}

/* ===== 定位 ===== */
let userMarker=null;
function getUserLocation(center=false){
    if(!navigator.geolocation){ toast('⚠️ 不支持定位'); return; }
    navigator.geolocation.getCurrentPosition(
        pos=>{
            userLatLng=[pos.coords.latitude, pos.coords.longitude];
            if(!userMarker){
                userMarker=L.circleMarker(userLatLng,{radius:8,color:'#ff7043',fillColor:'#ff8a50',fillOpacity:.85})
                    .addTo(map).bindTooltip('現在地');
            }else{ userMarker.setLatLng(userLatLng); }
            if(center){ map.flyTo(userLatLng, 15, {duration:.4}); }
            refreshNearbyList();
        },
        ()=>toast('📡 定位失败，请检查权限'),
        {enableHighAccuracy:true, timeout:9000}
    );
}
getUserLocation(true);

/* ===== 工具 ===== */
function haversineKm([a,b],[c,d]){
    const R=6371, toRad=x=>x*Math.PI/180;
    const dLat=toRad(c-a), dLng=toRad(d-b);
    const s=Math.sin(dLat/2)**2 + Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(s));
}
function getIcon(shop){
    let f='icon_default.png';
    if(shop.category.includes('たこ焼き')) f='icon_takoyaki.png';
    else if(shop.category.includes('お好み焼き')) f='icon_okonomiyaki.png';
    else if(shop.category.includes('串カツ')) f='icon_kushikatsu.png';
    return L.icon({iconUrl:`img/${f}`,iconSize:[32,32],iconAnchor:[16,32]});
}

/* ===== 标注 ===== */
const markerGroup = L.featureGroup().addTo(map);
function createMarkers(){
    markerGroup.clearLayers();
    (window.shops||[]).forEach(shop=>{
        const m = L.marker(shop.coords, {icon:getIcon(shop)}).addTo(markerGroup);
        // 防止冒泡到地图（避免点标记立刻触发地图 click 造成关闭）
        m.on('click', (e)=>{ L.DomEvent.stopPropagation(e); openDetail(shop); });
    });
}
createMarkers();

/* ===== 附近列表（侧边栏） ===== */
function nearbyShops(limit=6){
    const s = window.shops || [];
    if(!userLatLng) return s.slice(0,limit);
    return s.map(x=>({...x, dist:haversineKm(userLatLng,x.coords)}))
        .sort((a,b)=>a.dist-b.dist)
        .slice(0, limit);
}

function cardHTML(shop){
    const distLine = (typeof shop.dist === 'number') ? `距離：約${shop.dist.toFixed(2)} km ／ ` : '';
    return `
    <div><b>${shop.name}</b></div>
    <div class="shop-meta">${distLine}⭐${shop.rating}</div>
    <div>${(shop.tags||[]).slice(0,4).map(t=>`<span class="tag-pill">${t}</span>`).join('')}</div>
  `;
}

function refreshNearbyList(){
    const list = document.getElementById('shop-list');
    const data = nearbyShops(6);
    list.innerHTML = `<h3>📍 近くの店舗（${data.length}件）</h3>`;
    data.forEach(shop=>{
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.innerHTML = cardHTML(shop);
        card.addEventListener('click', (ev)=>{
            ev.stopPropagation();   // 点击卡片不触发地图关闭
            openDetail(shop);
        });
        list.appendChild(card);
    });
}

/* ===== 详情面板 ===== */
const panel = document.getElementById('shop-detail');
const content = document.getElementById('detail-content');

/* 阻止在面板内点击触发地图 click */
L.DomEvent.disableClickPropagation(panel);

function isFav(name){ return favs.includes(name); }
function toggleFav(name){
    if(isFav(name)){ favs=favs.filter(x=>x!==name); toast('💔 已取消收藏'); }
    else{ favs.push(name); toast('💖 已收藏'); }
    save(STORAGE.FAVS, favs);
}
function hasCheckedInToday(name){
    const t=todayStr(); return !!(shopCheckins[t] && shopCheckins[t][name]);
}
function markCheckin(shop){
    const t=todayStr();
    if(!shopCheckins[t]) shopCheckins[t] = {};
    if(shopCheckins[t][shop.name]) return false;
    shopCheckins[t][shop.name] = true;
    save(STORAGE.SHOP_CHECKINS, shopCheckins);
    points += 5; save(STORAGE.POINTS, points);
    toast(`🏆 已为「${shop.name}」打卡 +5分`);
    return true;
}

function openDetail(shop){
    detailOpen = true;
    panel.classList.remove('hidden','slide-down');
    content.innerHTML = ''; // 清空旧内容
    map.flyTo(shop.coords, 16, {duration:.35});

    const fav = isFav(shop.name);
    const checked = hasCheckedInToday(shop.name);

    content.innerHTML = `
    <div class="detail-title">
      <h2>${shop.name}</h2>
      <button class="close-btn" id="detail-close">✕</button>
    </div>
    <div class="detail-section">
      <div>⭐${shop.rating}　${shop.category}</div>
      <p>${shop.details||''}</p>
      <div>🕒 ${shop.hours||'-'}</div>
      <div style="margin-top:6px">${(shop.tags||[]).map(t=>`<span class="tag-pill">${t}</span>`).join(' ')}</div>
    </div>
    ${(shop.reviews&&shop.reviews.length)?`
      <div class="detail-section">
        <h4>💬 ユーザー評価</h4>
        ${shop.reviews.map(r=>`<div><b>${r.user}</b>：${r.text}</div>`).join('')}
      </div>`:''}
    ${(shop.activity)?`
      <div class="detail-section">
        <h4>🎉 活动</h4>
        <div>${shop.activity}</div>
      </div>`:''}
    <div class="action-row">
      <button id="checkin-btn" class="primary"${checked?' disabled':''}>
        ${checked?'✅ 今日已打卡':'🏆 打卡店铺（+5分）'}
      </button>
      <button id="fav-btn" class="${fav?'secondary':'primary'}">
        ${fav?'★ 取消收藏':'☆ 收藏此店'}
      </button>
    </div>
  `;

    // 绑定按钮
    document.getElementById('detail-close').onclick = (e)=>{ e.stopPropagation(); closeDetail(); };
    document.getElementById('checkin-btn').onclick = (e)=>{
        e.stopPropagation();
        if(!hasCheckedInToday(shop.name)){ markCheckin(shop); openDetail(shop); }
    };
    document.getElementById('fav-btn').onclick = (e)=>{
        e.stopPropagation();
        toggleFav(shop.name); openDetail(shop);
    };

    panel.classList.add('slide-up');
}

/* 关闭详情：X / 地图空白 / ESC */
function closeDetail(){
    if(!detailOpen) return;
    detailOpen = false;
    panel.classList.remove('slide-up');
    panel.classList.add('slide-down');
    setTimeout(()=>{
        content.innerHTML = '';
        panel.classList.add('hidden');
        panel.classList.remove('slide-down');
    }, 280);
}
document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape') closeDetail();
});

/* ===== 搜索 ===== */
document.getElementById('search-btn').addEventListener('click', ()=>{
    const kw = document.getElementById('search-input').value.trim().toLowerCase();
    const res = (window.shops||[]).filter(s =>
        (s.name+s.details+(s.tags||[]).join()).toLowerCase().includes(kw)
    );
    const list = document.getElementById('shop-list');
    list.innerHTML = `<h3>🔍 検索結果（${res.length}件）</h3>`;
    res.slice(0,12).forEach(shop=>{
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.innerHTML = cardHTML(shop);
        card.onclick = (ev)=>{ ev.stopPropagation(); openDetail(shop); };
        list.appendChild(card);
    });
});

/* ===== 悬浮定位按钮 ===== */
window.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('locate-btn');
    btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        if(userLatLng){ map.flyTo(userLatLng, 16, {duration:.45}); toast('🎯 已回到当前位置'); }
        else{ toast('📡 重新获取定位中…'); getUserLocation(true); }
    });
});

/* 初始渲染 */
refreshNearbyList();
