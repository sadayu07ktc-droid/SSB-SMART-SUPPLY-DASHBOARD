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
    getScheduleBoard: 'ssb-read', getWageBreakdown: 'ssb-read', getWageReport: 'ssb-read', getWageStored: 'wage-stored' };
  var EDGE_ONLY = { getWageStored: 1 };
  window.ssbFetch = async function (url, init) {
    try {
      var method = String((init && init.method) || 'GET').toUpperCase();
      var u = new URL(url, location.href);
      if (method === 'GET' && ACTIONS[u.searchParams.get('action')]) {
        var ac = new AbortController(), tm = setTimeout(function () { ac.abort(); }, 10000);
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
