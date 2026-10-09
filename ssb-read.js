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
  var EDGE_ONLY = { getWageStored: 1, getPermInfo: 1 };
  // action ที่ช้าเพราะรอระบบนอก (DTC ประวัติ/สรุป GPS 5–15 วิ) → รอ Edge นานกว่าค่าเริ่ม 10 วิ ก่อนถอยไป GAS
  var TIMEOUT = { getDriverRounds: 30000, getSummary: 30000, getDtcTodayChart: 60000 };   // กราฟระยะวิ่งจริง: ประวัติ GPS ทุกคัน ~30 วิ (GAS ~180 วิ)
  window.ssbFetch = async function (url, init) {
    try {
      var method = String((init && init.method) || 'GET').toUpperCase();
      var u = new URL(url, location.href);
      if (method === 'GET' && ACTIONS[u.searchParams.get('action')]) {
        var ac = new AbortController(), tm = setTimeout(function () { ac.abort(); }, TIMEOUT[u.searchParams.get('action')] || 10000);
        var r = await fetch(BASE + ACTIONS[u.searchParams.get('action')] + '?' + u.searchParams.toString(), { signal: ac.signal });
        var t = await r.text(); clearTimeout(tm);
        var j = JSON.parse(t);
        if (j && j.ok) return new Response(t, { status: 200, headers: { 'Content-Type': 'application/json' } });
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
 *   ทุกหน้าอยู่โดเมนเดียวกัน (sadayu07ktc-droid.github.io) → ใช้ localStorage ร่วมกันได้
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
})();
