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
  var EDGE = 'https://abihhdjcrbvwlkzwvjio.supabase.co/functions/v1/ssb-read';
  var ACTIONS = { getOrderList: 1, getRampDaily: 1, getRampOrders: 1, getGardenDaily: 1, getScheduleBoard: 1, getWageBreakdown: 1, getWageReport: 1 };
  window.ssbFetch = async function (url, init) {
    try {
      var method = String((init && init.method) || 'GET').toUpperCase();
      var u = new URL(url, location.href);
      if (method === 'GET' && ACTIONS[u.searchParams.get('action')]) {
        var ac = new AbortController(), tm = setTimeout(function () { ac.abort(); }, 10000);
        var r = await fetch(EDGE + '?' + u.searchParams.toString(), { signal: ac.signal });
        var t = await r.text(); clearTimeout(tm);
        var j = JSON.parse(t);
        if (j && j.ok) return new Response(t, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    } catch (e) { try { console.warn('ssb-read → GAS', e); } catch (_) {} }
    return fetch(url, init);
  };
})();
