/* ssb-read.js — อ่านข้อมูลหน้าแอดมินจาก Supabase Edge Function "ssb-read" ก่อน (เร็วกว่า GAS 3–8 เท่า) · 2026-10-07
 *
 *   ใช้แทน fetch() ตรงๆ:  const r = await ssbFetch(GAS_URL + '?action=getRampDaily&userId=...');  แล้ว r.json() เหมือนเดิม
 *   • action ที่ ssb-read รองรับ + เป็น GET → ยิง Supabase ด้วยพารามิเตอร์ชุดเดียวกัน
 *   • ตอบ ok:true → คืนผลนั้น (หน้าตา Response เหมือน fetch)
 *   • ไม่ตอบใน 10 วิ / พัง / ok:false / ไม่มีสิทธิ์ → ถอยไปเรียก GAS ตัวเดิมเหมือนไม่เคยมีตัวนี้
 *   action อื่น / POST → ส่งไป GAS ตรงๆ
 *   ผลลัพธ์เทียบกับ GAS แล้วตรงทุกฟิลด์ (parity test) — ถ้าแก้สูตรฝั่ง GAS ต้องแก้ ssb-read ให้ตรงกันด้วย
 *   โค้ดฝั่ง Supabase: D:\SSB Smart Supply\supabase\functions\ssb-read\index.ts */
(function () {
  var BASE = 'https://abihhdjcrbvwlkzwvjio.supabase.co/functions/v1/';
  // action → Edge Function ที่ตอบ (ส่วนใหญ่ ssb-read · ลิ้นชักค่าแรงแยกตัวเล็ก wage-stored)
  var ACTIONS = { getOrderList: 'ssb-read', getRampDaily: 'ssb-read', getRampOrders: 'ssb-read', getGardenDaily: 'ssb-read',
    getScheduleBoard: 'ssb-read', getWageBreakdown: 'ssb-read', getWageReport: 'ssb-read', getWageStored: 'wage-stored', getUser: 'get-user',
    // ชุด 2 (หน้าแอดมิน) → ssb-admin
    getWageSettings: 'ssb-admin', getWageConfig: 'ssb-admin', getWageOrders: 'ssb-admin', getCostBase: 'ssb-admin',
    getCentralDistances: 'ssb-admin', getDpWaitTimes: 'ssb-admin', getAdminList: 'ssb-admin', getGardenList: 'ssb-admin',
    // ลิ้นชักรายละเอียดสวน (garden.html) · ปุ่มบันทึกในหน้านั้นยิง garden-admin เอง
    getGardenDetail: 'garden-admin',
    // ชุดคำนวณค่าแรง (wage-settings.html) · ปุ่มบันทึกหน้าตั้งค่าแอดมินยิง admin-writes ผ่าน ssbPost
    getWageTemplates: 'admin-writes',
    // ลิ้นชักค่าแรง "เทียบกับตั้งค่าปัจจุบัน" คิดสด (wage.html) → Edge wage-calc (พอร์ต computeTripWage · parity 107/107) · 2026-10-16
    getWageMonitor: 'wage-calc',
    // สวิตช์ตรวจสิทธิ์เข้าดูแดชบอร์ด (admins.html)
    getDashAuth: 'admin-perms', getPermInfo: 'admin-perms',
    // หน้าแจ้งเตือนแอดมิน (repo admin_notifications)
    getAdminNotifications: 'admin-notify',
    // หน้าติดตามสถานะออเดอร์ (repo Order_Status โหลดไฟล์นี้ข้าม repo)
    getOrderTracker: 'order-tracker',
    // หน้าจัดการคนขับ (repo ManageDrivers โหลดไฟล์นี้ข้าม repo · รีเฟรชทุก 30 วิ)
    getDrivers: 'manage-drivers', getDriverRounds: 'manage-drivers',
    // ลิ้นชักคนขับ (หน้าจัดการคนขับ)
    getDriverHistory: 'driver-drawer', getLegs: 'driver-drawer', getTripStats: 'driver-drawer', getSummary: 'driver-drawer',
    // หน้ากราฟ (repo pages_chart_daily)
    getOrderCostChart: 'chart-data', getDtcSummaryChart: 'chart-data', getDtcTodayChart: 'chart-today',
    // ตัวอ่านเล็กๆ หน้าสถานะออเดอร์ + หน้าจัดการผู้ใช้ (repo Order_Status / User_Management)
    getPkSummary: 'ssb-misc', getPkWaiting: 'ssb-misc', getRampList: 'ssb-misc', getReassignDrivers: 'ssb-misc', getUsers: 'ssb-misc' };
  // getWageReport: แยกกลุ่ม ไร่/Bulk/Packing ตามสิทธิ์แอดมิน (2026-10-14) — GAS ไม่กรองกลุ่ม ห้ามถอยไป GAS
  var EDGE_ONLY = { getWageStored: 1, getPermInfo: 1, getWageReport: 1 };
  // action ที่ช้าเพราะรอระบบนอก (DTC ประวัติ/สรุป GPS 5–15 วิ) → รอ Edge นานกว่าค่าเริ่ม 10 วิ ก่อนถอยไป GAS
  var TIMEOUT = { getWageMonitor: 30000, getDriverRounds: 30000, getSummary: 30000, getDtcTodayChart: 60000 };   // กราฟระยะวิ่งจริง: ประวัติ GPS ทุกคัน ~30 วิ (GAS ~180 วิ)
  window.ssbFetch = async function (url, init) {
    try {
      var method = String((init && init.method) || 'GET').toUpperCase();
      var u = new URL(url, location.href);
      if (method === 'GET' && ACTIONS[u.searchParams.get('action')]) {
        var ac = new AbortController(), tm = setTimeout(function () { ac.abort(); }, TIMEOUT[u.searchParams.get('action')] || 10000);
        var r = await fetch(BASE + ACTIONS[u.searchParams.get('action')] + '?' + u.searchParams.toString(), { signal: ac.signal });
        var t = await r.text(); clearTimeout(tm);
        var j = JSON.parse(t);
        if (j && (j.ok || EDGE_ONLY[u.searchParams.get('action')])) return new Response(t, { status: 200, headers: { 'Content-Type': 'application/json' } });   // edge-only: ส่งคำตอบ Edge (เช่น denied) ตรงๆ
      }
    } catch (e) { try { console.warn('ssb-read → GAS', e); } catch (_) {} }
    // action ที่มีแต่ฝั่ง Supabase (GAS ไม่รู้จัก) → ไม่ต้องถอยไป GAS ให้เสียเวลา
    try { if (EDGE_ONLY[new URL(url, location.href).searchParams.get('action')]) return new Response('{"ok":false,"error":"edge unavailable"}', { status: 200, headers: { 'Content-Type': 'application/json' } }); } catch (_) {}
    return fetch(url, init);
  };

  /* ✍️ ปุ่มบันทึกที่ "ไม่ส่ง LINE" → Edge ก่อน · 2026-10-08
   *   const d = await ssbPost('orders-admin', GAS_URL, { action:'deleteOrder', userId, orderId });
   *   Edge ตอบกลับมา (สำเร็จหรือไม่ก็ตาม) = ใช้ผลนั้น · เน็ตหลุด/เกินเวลา/ตอบไม่ใช่ JSON → ส่ง GAS เดิม
   *   ⚠️ ใช้เฉพาะ action ที่ยิงซ้ำแล้วไม่เสียหาย (ไม่ส่ง LINE · เขียนค่าเดิมซ้ำได้ / ลบซ้ำ = แค่ "ไม่พบ")
   *      ปุ่มที่ส่ง LINE ห้ามใช้ตัวนี้ — ถอยไป GAS อาจแจ้งซ้ำ */
  window.ssbPost = async function (fn, gasUrl, body, timeoutMs) {
    try {
      var ac = new AbortController(), tm = setTimeout(function () { ac.abort(); }, timeoutMs || 15000);
      var r = await fetch(BASE + fn, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ac.signal });
      var t = await r.text(); clearTimeout(tm);
      return JSON.parse(t);
    } catch (e) { try { console.warn(fn + ' → GAS', e); } catch (_) {} }
    var g = await fetch(gasUrl, { method: 'POST', body: JSON.stringify(body) });
    return g.json();
  };
})();

/* ── 🔑 ล็อกอินครั้งเดียว ใช้ได้ทุกหน้า (SSO) · 2026-10-08 ──────────────────────────────
 *   ปัญหาเดิม: แต่ละหน้ามี LIFF ของตัวเอง → ต้องล็อกอิน LINE ใหม่ทุกหน้า และบางหน้าได้บัญชีคนละตัว
 *   ทุกหน้าอยู่โดเมนเดียวกัน (ssb-supply.pages.dev · สำรอง sadayu07ktc-droid.github.io) → ใช้ localStorage ร่วมกันได้
 *   • หน้าแดชบอร์ดหลัก (index.html) = ตัว "ออกบัตร": ล็อกอิน LINE + ตรวจสิทธิ์ผ่าน → ssbSession.set(...)
 *   • หน้าอื่นที่โหลดไฟล์นี้ (ต่อจาก LIFF SDK): มีบัตร → liff.isLoggedIn()=true, liff.getProfile()=บัญชีในบัตร
 *     ไม่ต้องเด้งล็อกอินซ้ำ · ไม่มีบัตร → ทำงานแบบ LIFF เดิมทุกอย่าง
 *   • ออกจากระบบที่แดชบอร์ด → ssbSession.clear() (ทุกหน้าเลิกใช้บัตร) · บัตรหมดอายุเอง 7 วัน
 *   • หน้าไหนไม่อยากใช้บัตร: ใส่ <script>window.SSB_SSO_OFF=1</script> ก่อนโหลดไฟล์นี้ */
(function () {
  var KEY = 'ssb_session_v1', TTL = 7 * 24 * 3600 * 1000;
  window.ssbSession = {
    get: function () {
      try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.uid && Date.now() - (s.t || 0) < TTL) return s; } catch (e) {}
      return null;
    },
    set: function (p) {
      try { localStorage.setItem(KEY, JSON.stringify({ uid: p.uid, name: p.name || '', pic: p.pic || '', role: p.role || '', t: Date.now() })); } catch (e) {}
    },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
  var isIssuer = /\/SSB-SMART-SUPPLY-DASHBOARD\/(index\.html)?$/.test(location.pathname);   // แดชบอร์ดหลักล็อกอินจริงเสมอ
  // 🔁 เปลี่ยนบัญชี (2026-11-19): ลิงก์ที่มี ?login=1 → ทิ้งบัตร + ทิ้งล็อกอิน LINE ที่ค้างในเบราว์เซอร์ → หน้าจะให้ล็อกอิน LINE ใหม่
  //   ใช้เมื่อเครื่องนี้มีบัตรของคนอื่นค้าง (เช่น เปิดลิงก์ที่ส่งให้แอดมินบนเครื่อง DEV / คอมส่วนกลาง)
  try {
    var qs = new URLSearchParams(location.search);
    if (qs.get('login') === '1') {
      window.ssbSession.clear();
      for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && k.indexOf('LIFF_STORE') === 0) localStorage.removeItem(k); }
      localStorage.removeItem('ssb_admin_pin_v1');
      qs.delete('login'); var q = qs.toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);   // ตัดออก กันวนตอน LINE เด้งกลับ
      return;
    }
  } catch (e) {}
  var s = window.ssbSession.get(), L = window.liff;
  if (!s || isIssuer || window.SSB_SSO_OFF || !L || L.__ssbSso) return;
  L.__ssbSso = true;
  var realInit = L.init.bind(L);
  L.init = function (cfg) {   // init จริงไว้ (ฟีเจอร์อื่นของ LIFF ยังใช้ได้) แต่พังก็ไม่เป็นไร เพราะมีบัตรแล้ว
    try { return Promise.resolve(realInit(cfg)).catch(function (e) { console.warn('liff.init (มีบัตร SSO แล้ว ข้ามได้)', e); }); }
    catch (e) { return Promise.resolve(); }
  };
  L.isLoggedIn = function () { return true; };
  L.login = function () {};
  L.getProfile = function () { return Promise.resolve({ userId: s.uid, displayName: s.name, pictureUrl: s.pic, statusMessage: '' }); };
  // 👤 ป้ายกลางล่าง (ไม่บังปุ่มออกจากระบบในเมนูซ้าย / ปุ่มลอยขวา) "ชื่อ · เปลี่ยนบัญชี" — หน้านี้ไม่ถามล็อกอินเพราะใช้บัตรที่ค้างในเบราว์เซอร์ จึงต้องโชว์ว่าเป็นบัญชีใคร
  var chip = function () {
    if (document.getElementById('ssbWho')) return;
    var b = document.createElement('div'); b.id = 'ssbWho';
    b.setAttribute('style', 'position:fixed;left:50%;transform:translateX(-50%);bottom:10px;z-index:2147483000;display:flex;align-items:center;gap:6px;max-width:calc(100vw - 20px);padding:5px 6px 5px 10px;border-radius:999px;background:rgba(27,67,50,.92);color:#fff;font:12px/1.2 system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.2)');
    var n = document.createElement('span'); n.textContent = '👤 ' + (s.name || 'ไม่ทราบชื่อ');
    n.setAttribute('style', 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw');
    var sw = document.createElement('button'); sw.type = 'button'; sw.textContent = 'เปลี่ยนบัญชี';
    sw.setAttribute('style', 'border:0;border-radius:999px;padding:4px 9px;background:#C9A227;color:#1B4332;font-weight:600;font-size:12px;font-family:inherit;cursor:pointer');
    var x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'ซ่อน');
    x.setAttribute('style', 'border:0;background:transparent;color:#fff;font-size:16px;line-height:1;cursor:pointer;padding:0 4px;opacity:.75');
    sw.onclick = function () {
      if (!confirm('ตอนนี้ใช้บัญชี "' + (s.name || s.uid) + '"\nออกแล้วล็อกอิน LINE ด้วยบัญชีของคุณเอง?')) return;
      var u = new URL(location.href); u.searchParams.set('login', '1'); location.href = u.toString();
    };
    x.onclick = function () { b.remove(); };
    b.appendChild(n); b.appendChild(sw); b.appendChild(x);
    var st = document.createElement('style'); st.textContent = '@media print{#ssbWho{display:none!important}}';
    (document.head || document.body).appendChild(st);
    document.body.appendChild(b);
  };
  if (document.body) chip(); else document.addEventListener('DOMContentLoaded', chip);
})();

/* ── 🌓 ปุ่มธีมสี สว่าง/มืด ใช้ร่วมทุกหน้า · 2026-11-19 ──────────────────────────────────
 *   เดิม: หน้าเปลี่ยนสีตามโหมดของเครื่อง (prefers-color-scheme) อย่างเดียว → Windows ตั้งแอปสว่าง = หน้าเว็บสว่างเสมอ
 *   ใช้: <html data-ssb-theme> + ปุ่ม <button data-ssb-theme-btn></button> ที่ไหนก็ได้ในหน้า (ไฟล์นี้เติมไอคอน/ข้อความ/คลิกให้)
 *   ทำงาน: เลือกแล้วจำใน localStorage (ssb_theme_v1 ใช้ร่วมทุกหน้า) → ตั้ง <html data-theme> + บังคับกฎ CSS
 *          @media (prefers-color-scheme: dark/light) ให้ "ติด/ไม่ติด" ตามที่เลือก (หน้าไม่ต้องแก้ CSS เดิม)
 *   ยังไม่เคยเลือก = ตามเครื่องเหมือนเดิม */
(function () {
  var KEY = 'ssb_theme_v1', root = document.documentElement;
  if (!root.hasAttribute('data-ssb-theme')) return;
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  var seen = [];   // [{rule, orig}] ถือ reference ไว้ → คืนค่าเดิมได้
  var pick = function () { try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : ''; } catch (e) { return ''; } };
  var eff = function () { var p = pick(); return p || (mq && mq.matches ? 'dark' : 'light'); };
  var RX = /\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi;
  var fix = function (rule, mode) {
    var rec = null;
    for (var i = 0; i < seen.length; i++) if (seen[i].rule === rule) { rec = seen[i]; break; }
    if (!rec) { if (!/prefers-color-scheme/i.test(rule.media.mediaText)) return; rec = { rule: rule, orig: rule.media.mediaText }; seen.push(rec); }
    var t = rec.orig;
    if (mode) {
      var only = t.replace(RX, '').replace(/\s+/g, '') === '';
      if (only) { var hit = (t.match(/dark|light/i) || [''])[0].toLowerCase() === mode; t = hit ? 'all' : 'not all'; }
      else t = t.replace(RX, function (_, w) { return w.toLowerCase() === mode ? '(min-width: 0px)' : '(max-width: 0px)'; });
    }
    if (rule.media.mediaText !== t) rule.media.mediaText = t;
  };
  var walk = function (rules, mode) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.media && r.cssRules) fix(r, mode);   // CSSMediaRule
      if (r.cssRules) try { walk(r.cssRules, mode); } catch (e) {}
    }
  };
  var apply = function () {
    var mode = pick();
    if (mode) root.setAttribute('data-theme', mode); else root.removeAttribute('data-theme');
    for (var i = 0; i < document.styleSheets.length; i++) { try { walk(document.styleSheets[i].cssRules, mode); } catch (e) {} }   // ฟอนต์ Google (ข้ามโดเมน) อ่านไม่ได้ ข้าม
    var dark = eff() === 'dark';
    var bs = document.querySelectorAll('[data-ssb-theme-btn]');
    for (var j = 0; j < bs.length; j++) {
      var b = bs[j];
      if (!b.__ssbT) { b.__ssbT = 1; b.type = 'button'; b.addEventListener('click', function () { window.ssbTheme.set(eff() === 'dark' ? 'light' : 'dark'); }); }
      var ico = dark
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
      var lab = dark ? 'ธีมสว่าง' : 'ธีมมืด';
      b.innerHTML = ico + '<span>' + lab + '</span>';
      b.title = 'เปลี่ยนเป็น' + lab; b.setAttribute('aria-label', 'เปลี่ยนเป็น' + lab);
    }
  };
  window.ssbTheme = {
    get: eff,
    set: function (m) { try { if (m) localStorage.setItem(KEY, m); else localStorage.removeItem(KEY); } catch (e) {} apply(); }
  };
  apply();
  document.addEventListener('DOMContentLoaded', apply);
  window.addEventListener('load', apply);
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });   // เปลี่ยนจากอีกแท็บ → แท็บนี้ตาม
  try {   // <style>/<link> ที่สคริปต์เติมทีหลัง (เช่น กล่อง PIN) ก็บังคับด้วย
    var tm = 0;
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) for (var k = 0; k < ms[i].addedNodes.length; k++) {
        var n = ms[i].addedNodes[k];
        if (n.nodeName === 'STYLE' || n.nodeName === 'LINK' || (n.querySelector && n.querySelector('[data-ssb-theme-btn],style'))) {
          if (n.nodeName === 'LINK') n.addEventListener('load', apply);
          clearTimeout(tm); tm = setTimeout(apply, 0); return;
        }
      }
    }).observe(root, { childList: true, subtree: true });
  } catch (e) {}
})();
