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
    // หน้าติดตามสถานะออเดอร์ (repo Order_Status โหลดไฟล์นี้ข้าม repo)
    getOrderTracker: 'order-tracker',
    // หน้าจัดการคนขับ (repo ManageDrivers โหลดไฟล์นี้ข้าม repo · รีเฟรชทุก 30 วิ)
    getDrivers: 'manage-drivers', getDriverRounds: 'manage-drivers',
    // ลิ้นชักคนขับ (หน้าจัดการคนขับ)
    getDriverHistory: 'driver-drawer', getLegs: 'driver-drawer', getTripStats: 'driver-drawer', getSummary: 'driver-drawer',
    // หน้ากราฟ (repo pages_chart_daily)
    getOrderCostChart: 'chart-data', getDtcSummaryChart: 'chart-data', getDtcTodayChart: 'chart-today' };
  var EDGE_ONLY = { getWageStored: 1 };
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
})();
