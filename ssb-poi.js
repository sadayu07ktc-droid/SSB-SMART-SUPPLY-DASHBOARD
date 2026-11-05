// เลขหมุด DTC (ST-…) ต่อท้ายชื่อสถานที่ จาง ๆ กันสื่อสารผิดเพราะชื่อคล้ายกัน · Edge poi-ids · คุณน้อง 5 พ.ย. 69
//   ssbPoi.load(uid) → โหลดครั้งเดียว · ssbPoi.of(ชื่อ) → ["ST-…"] · ssbPoi.tag(ชื่อ) → HTML (ไม่มีหมุด/ยังโหลดไม่เสร็จ = ว่าง)
window.ssbPoi = (function () {
  const URL_ = 'https://abihhdjcrbvwlkzwvjio.supabase.co/functions/v1/poi-ids';
  let ids = {}, busy = null;
  const key = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  const of = name => ids[key(name)] || [];
  return {
    load(uid) {
      if (!busy) busy = fetch(URL_ + '?userId=' + encodeURIComponent(uid)).then(r => r.json()).then(d => { if (d.ok) ids = d.ids || {}; }).catch(() => {});
      return busy;
    },
    of,
    text: name => of(name).join(' / '),
    tag(name) {
      const a = of(name); if (!a.length) return '';
      const t = a.length > 1 ? 'ชื่อนี้มีหมุด DTC ' + a.length + ' จุด' : 'เลขหมุด DTC';
      return ' <span title="' + t + '" style="font-size:10.5px;font-weight:400;color:var(--txt2);opacity:.75;white-space:nowrap;letter-spacing:.01em">' + a.join(' / ') + '</span>';
    }
  };
})();
