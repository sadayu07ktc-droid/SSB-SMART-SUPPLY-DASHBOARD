/* wage-export.js — ดาวน์โหลดรายงานค่าแรง 3 แบบ จากแถวที่แสดงอยู่ (VIEW ใน wage.html)
 *   📊 Excel (.xlsx) — ExcelJS: ความกว้างคอลัมน์ · รูปแบบตัวเลข · ตรึงหัวตาราง · แถวรวม · ติดลบสีแดง · ชีตสรุปรายคนขับ
 *   📄 PDF — วาดหน้า A4 แนวนอนด้วย canvas แล้วใส่ jsPDF (ภาษาไทยวาดด้วยฟอนต์เครื่อง ไม่ต้องฝังฟอนต์)
 *   🖼️ JPEG — รูปเดียวยาว (หัว + สรุป + ทุกเที่ยว) ส่งต่อใน LINE ได้
 * ไลบรารีโหลดเมื่อกดเท่านั้น (lazy) · โหลดไม่ได้ → Excel ถอยเป็น CSV
 * ใช้ของจาก wage.html: VIEW, SEARCH, ACTIVE_DEST, fmtD, usedCentral, $, exportCsv */
(function () {
  var LIB = {
    xlsx: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
    pdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
  };
  var loading = {};
  function loadLib(url) {
    if (loading[url]) return loading[url];
    loading[url] = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = url; s.async = true;
      s.onload = res; s.onerror = function () { delete loading[url]; rej(new Error('โหลดไลบรารีไม่ได้ (เน็ต/CDN)')); };
      document.head.appendChild(s);
    });
    return loading[url];
  }

  /* ── ข้อมูลรายงาน: แถวเดียวกับตาราง · ก้อนเงินบวกครบ = สุทธิ ── */
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function r1(v) { return Math.round(num(v) * 10) / 10; }
  var CTX = null;   // { rows, from, to, driver, label } จาก popup เลือกรอบ
  function rows() {
    return (CTX ? CTX.rows : VIEW).map(function (r) {
      var via = !!r.via, other = num(r.tarp) + num(r.wait) + num(r.hardship) + num(r.bonus) + (via ? 0 : num(r.hooklift) + num(r.give));
      var g = String(r.garden || '').trim(), d = String(r.dest || '').trim();
      return {
        date: r.date || '', orderId: r.orderId || '', driver: r.driver || '', plate: r.plate || '',
        veh: r.vehType || r.vehicleType || (r.model ? 'รุ่น ' + r.model : ''),
        place: (g && d && g !== d) ? g + ' → ' + d : (d || g || ''),
        actual: r1(r.distActual), central: num(r.distCentral) > 0 ? r1(r.distCentral) : null, used: r1(r.distUsed),
        by: usedCentral(r) ? 'ค่ากลาง' : 'ระยะจริง',
        liters: r1(r.liters), kmpl: (num(r.liters) > 0 && num(r.distActual) > 0) ? Math.round(num(r.distActual) / num(r.liters) * 100) / 100 : null,
        run: Math.round(num(r.runWage)), load: Math.round(num(r.loadWage)),
        tarp: Math.round(num(r.tarp)), wait: Math.round(num(r.wait)), hardship: Math.round(num(r.hardship)), bonus: Math.round(num(r.bonus)),
        hook: Math.round(num(r.hooklift)), give: Math.round(num(r.give)), via: via,
        other: Math.round(other), fuel: Math.round(num(r.fuelAdj)), net: Math.round(num(r.wage)),
        status: r.locked ? 'จ่ายแล้ว' : 'ยังไม่จ่าย', locked: !!r.locked
      };
    });
  }
  function byDriver(R) {
    var m = {};
    R.forEach(function (r) {
      var k = r.driver || '—', a = m[k] || (m[k] = { driver: k, trips: 0, actual: 0, used: 0, liters: 0, run: 0, load: 0, other: 0, fuel: 0, net: 0, paid: 0, unpaid: 0 });
      a.trips++; a.actual += r.actual; a.used += r.used; a.liters += r.liters; a.run += r.run; a.load += r.load;
      a.other += r.other; a.fuel += r.fuel; a.net += r.net; if (r.locked) a.paid += r.net; else a.unpaid += r.net;
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.net - a.net; });
  }
  function totals(R) {
    var t = { trips: R.length, actual: 0, used: 0, liters: 0, run: 0, load: 0, other: 0, fuel: 0, net: 0, neg: 0 };
    R.forEach(function (r) { t.actual += r.actual; t.used += r.used; t.liters += r.liters; t.run += r.run; t.load += r.load; t.other += r.other; t.fuel += r.fuel; t.net += r.net; if (r.net < 0) t.neg++; });
    return t;
  }
  function dmy(iso) { return iso ? fmtD(iso).replace(/-/g, '/') : ''; }
  function info() {
    if (CTX) return 'รอบ ' + CTX.label + ' (' + dmy(CTX.from) + '–' + dmy(CTX.to) + ') · คนขับ: ' + (CTX.driver || 'ทุกคน');
    var f = $('from').value, t = $('to').value, dv = $('driver').value, bits = [];
    bits.push('ช่วง ' + (f ? dmy(f) : '—') + ' ถึง ' + (t ? dmy(t) : '—'));
    bits.push('คนขับ: ' + (dv || 'ทุกคน'));
    if (ACTIVE_DEST) bits.push('ปลายทาง: ' + ACTIVE_DEST);
    if (SEARCH.trim()) bits.push('ค้นหา: "' + SEARCH.trim() + '"');
    return bits.join(' · ');
  }
  function stamp() { var d = new Date(), p = function (n) { return ('0' + n).slice(-2); }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function fname(ext) {
    if (CTX) return 'รายงานค่าแรง_' + CTX.from + '_ถึง_' + CTX.to + (CTX.driver ? '_' + CTX.driver : '_ทุกคน') + '.' + ext;
    return 'รายงานค่าแรง_' + ($('from').value || 'เริ่ม') + '_ถึง_' + ($('to').value || 'ล่าสุด') + ($('driver').value ? '_' + $('driver').value : '') + '.' + ext;
  }
  // CSV สำรอง (โหลดตัวสร้าง Excel ไม่ได้) — ขอบเขตเดียวกับรายงาน
  function csv() {
    var R = rows(), q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
    var head = ['วันที่', 'ออเดอร์', 'คนขับ', 'ประเภทรถ', 'ทะเบียน', 'สวน / ปลายทาง', 'ระยะจริง', 'ระยะกลาง', 'คิดด้วย', 'น้ำมัน(ล.)', 'ค่าวิ่ง', 'ขึ้น-ลง', 'อื่นๆ', 'ปรับน้ำมัน', 'ค่าแรงสุทธิ', 'สถานะ'];
    var L = [head.map(q).join(',')].concat(R.map(function (r) { return [dmy(r.date), r.orderId, r.driver, r.veh, r.plate, r.place, r.actual, r.central, r.by, r.liters, r.run, r.load, r.other, r.fuel, r.net, r.status].map(q).join(','); }));
    save(new Blob(['\ufeff' + L.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), fname('csv'));
  }
  function save(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }

  /* ════════ 📊 Excel ════════ */
  var GREEN = 'FF1B4332', GOLD = 'FFC9A227', RED = 'FFC8352F', REDBG = 'FFFDECEA', LINE = 'FFD9DEE3', ZEBRA = 'FFF6F8FA';
  var F_BAHT = '#,##0;[Red]-#,##0;0', F_KM = '#,##0.0;[Red]-#,##0.0;0', F_KMPL = '0.00';
  function xlsx() {
    return loadLib(LIB.xlsx).then(function () {
      var R = rows(), T = totals(R), wb = new ExcelJS.Workbook(); wb.creator = 'SSB Smart Supply'; wb.created = new Date();
      var font = { name: 'Tahoma', size: 10 };
      var thin = { style: 'thin', color: { argb: LINE } }, box = { top: thin, left: thin, bottom: thin, right: thin };

      /* ชีต 1: รายละเอียดเที่ยว */
      var ws = wb.addWorksheet('รายละเอียดเที่ยว', {
        views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
        pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .3, right: .3, top: .4, bottom: .4, header: .2, footer: .2 } },
        headerFooter: { oddFooter: '&Lรายงานค่าแรงคนขับ · SSB Smart Supply&Rหน้า &P / &N' }
      });
      var cols = [
        ['วันที่', 'date', 11, 'dd/mm/yyyy'], ['ออเดอร์', 'orderId', 19], ['คนขับ', 'driver', 22], ['ประเภทรถ', 'veh', 10], ['ทะเบียน', 'plate', 13],
        ['สวน / ปลายทาง', 'place', 36], ['ระยะจริง (กม.)', 'actual', 10, F_KM], ['ระยะกลาง (กม.)', 'central', 10, F_KM], ['ระยะที่ใช้คิด (กม.)', 'used', 11, F_KM],
        ['คิดด้วย', 'by', 9], ['น้ำมันเติม (ล.)', 'liters', 10, F_KM], ['กม./ล.', 'kmpl', 8, F_KMPL],
        ['ค่าวิ่ง', 'run', 9, F_BAHT], ['ขึ้น-ลง', 'load', 8, F_BAHT], ['ผ้าใบ', 'tarp', 7, F_BAHT], ['ค่ารอ', 'wait', 7, F_BAHT], ['Hardship', 'hardship', 9, F_BAHT],
        ['ฮุคลิฟท์', 'hook', 9, F_BAHT], ['ให้เพิ่ม', 'give', 9, F_BAHT], ['ปรับน้ำมัน (บ.)', 'fuel', 11, F_BAHT], ['โบนัส', 'bonus', 7, F_BAHT],
        ['ค่าแรงสุทธิ', 'net', 12, F_BAHT], ['สถานะ', 'status', 11]
      ];
      var NC = cols.length, last = String.fromCharCode(64 + NC);
      ws.columns = cols.map(function (c) { return { key: c[1], width: c[2] }; });
      ws.mergeCells('A1:' + last + '1'); ws.mergeCells('A2:' + last + '2');
      var t1 = ws.getCell('A1'); t1.value = 'รายงานค่าแรงคนขับ · SSB Smart Supply'; t1.font = { name: 'Tahoma', size: 15, bold: true, color: { argb: GREEN } };
      var t2 = ws.getCell('A2'); t2.value = info() + ' · ' + T.trips + ' เที่ยว · ค่าแรงรวม ' + T.net.toLocaleString('th-TH') + ' บ. · ออกรายงาน ' + stamp();
      t2.font = { name: 'Tahoma', size: 10, color: { argb: 'FF6B7785' } };
      ws.getRow(1).height = 24;
      var hr = ws.getRow(4); hr.values = cols.map(function (c) { return c[0]; }); hr.height = 30;
      hr.eachCell(function (c) {
        c.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; c.border = { bottom: { style: 'medium', color: { argb: GOLD } } };
      });
      // ฮุคลิฟท์/ให้เพิ่ม ที่แปลงเป็นลิตร = รวมอยู่ในปรับน้ำมันแล้ว → โชว์จาง (ไม่บวกซ้ำ)
      R.forEach(function (r, i) {
        var p = r.date ? r.date.split('-') : null;
        var vals = cols.map(function (c) {
          if (c[1] === 'date') return p ? new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])) : '';   // UTC — ExcelJS เขียนเป็น UTC (เวลาท้องถิ่น +7 จะถอยไปวันก่อน)
          var v = r[c[1]]; return v == null ? '' : v;
        });
        var row = ws.getRow(5 + i); row.values = vals;
        row.eachCell({ includeEmpty: true }, function (c, ci) {
          var def = cols[ci - 1]; c.font = font; c.border = box; c.alignment = { vertical: 'middle' };
          if (def[3]) c.numFmt = def[3];
          if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
          if (typeof c.value === 'number' && c.value < 0) c.font = { name: 'Tahoma', size: 10, color: { argb: RED } };
        });
        if (r.via) ['hook', 'give'].forEach(function (k) { var c = row.getCell(k); if (c.value) { c.font = { name: 'Tahoma', size: 9, italic: true, color: { argb: 'FF9AA5B1' } }; c.note = 'แปลงเป็นลิตร รวมอยู่ใน "ปรับน้ำมัน" แล้ว (ไม่บวกซ้ำ)'; } });
        var by = row.getCell('by'); by.font = { name: 'Tahoma', size: 10, color: { argb: r.by === 'ค่ากลาง' ? 'FF1F8A52' : 'FFB26A00' } };
        var net = row.getCell('net'); net.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: r.net < 0 ? RED : 'FF1A2530' } };
        if (r.net < 0) net.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REDBG } };
        var st = row.getCell('status'); st.font = { name: 'Tahoma', size: 10, color: { argb: r.locked ? 'FF1F8A52' : 'FF6B7785' } };
      });
      // แถวรวม (สูตร SUM + ผลลัพธ์ เปิดไฟล์แล้วเห็นเลขทันที)
      var tr = 5 + R.length, e = tr - 1, tRow = ws.getRow(tr);
      tRow.getCell(1).value = 'รวม ' + T.trips + ' เที่ยว';
      ws.mergeCells('A' + tr + ':F' + tr);
      ['actual', 'used', 'liters', 'run', 'load', 'tarp', 'wait', 'hardship', 'fuel', 'bonus', 'net'].forEach(function (k) {
        var ci = cols.findIndex(function (c) { return c[1] === k; }) + 1, L = String.fromCharCode(64 + ci);
        var sum = R.reduce(function (a, r) { return a + (num(r[k])); }, 0);
        tRow.getCell(ci).value = R.length ? { formula: 'SUM(' + L + '5:' + L + e + ')', result: Math.round(sum * 10) / 10 } : 0;
        tRow.getCell(ci).numFmt = cols[ci - 1][3];
      });
      tRow.height = 22;
      tRow.eachCell({ includeEmpty: true }, function (c, ci) {
        if (ci > NC) return;
        var neg = typeof c.value === 'object' && c.value && c.value.result < 0;
        c.font = { name: 'Tahoma', size: 10.5, bold: true, color: { argb: neg ? RED : GREEN } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F3EC' } };
        c.border = { top: { style: 'medium', color: { argb: GREEN } }, bottom: { style: 'medium', color: { argb: GREEN } } };
        c.alignment = { vertical: 'middle' };
      });
      if (R.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + R.length, column: NC } };
      ws.getCell('A' + (tr + 2)).value = 'หมายเหตุ: ค่าแรงสุทธิ = ค่าวิ่ง + ขึ้น-ลง + ผ้าใบ + ค่ารอ + Hardship + ปรับน้ำมัน + โบนัส · ฮุคลิฟท์/ให้เพิ่มที่เป็นตัวเอียงจาง = แปลงเป็นลิตรรวมอยู่ในปรับน้ำมันแล้ว · ตัวเลขสีแดง = ติดลบ';
      ws.getCell('A' + (tr + 2)).font = { name: 'Tahoma', size: 9, color: { argb: 'FF6B7785' } };

      /* ชีต 2: สรุปรายคนขับ */
      var S = byDriver(R), ss = wb.addWorksheet('สรุปรายคนขับ', { views: [{ state: 'frozen', ySplit: 4 }], pageSetup: { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
      var sc = [['คนขับ', 'driver', 26], ['เที่ยว', 'trips', 8, '#,##0'], ['ระยะจริง (กม.)', 'actual', 12, F_KM], ['ระยะที่ใช้คิด (กม.)', 'used', 13, F_KM], ['น้ำมันเติม (ล.)', 'liters', 12, F_KM],
        ['ค่าวิ่ง', 'run', 11, F_BAHT], ['ขึ้น-ลง', 'load', 10, F_BAHT], ['อื่นๆ', 'other', 10, F_BAHT], ['ปรับน้ำมัน (บ.)', 'fuel', 12, F_BAHT],
        ['ค่าแรงสุทธิ', 'net', 13, F_BAHT], ['จ่ายแล้ว', 'paid', 12, F_BAHT], ['ค้างจ่าย', 'unpaid', 12, F_BAHT]];
      var sl = String.fromCharCode(64 + sc.length);
      ss.columns = sc.map(function (c) { return { key: c[1], width: c[2] }; });
      ss.mergeCells('A1:' + sl + '1'); ss.mergeCells('A2:' + sl + '2');
      ss.getCell('A1').value = 'สรุปค่าแรงรายคนขับ'; ss.getCell('A1').font = { name: 'Tahoma', size: 15, bold: true, color: { argb: GREEN } };
      ss.getCell('A2').value = info() + ' · ออกรายงาน ' + stamp(); ss.getCell('A2').font = { name: 'Tahoma', size: 10, color: { argb: 'FF6B7785' } };
      var sh = ss.getRow(4); sh.values = sc.map(function (c) { return c[0]; }); sh.height = 28;
      sh.eachCell(function (c) { c.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; c.border = { bottom: { style: 'medium', color: { argb: GOLD } } }; });
      S.forEach(function (a, i) {
        var row = ss.getRow(5 + i); row.values = sc.map(function (c) { var v = a[c[1]]; return typeof v === 'number' ? Math.round(v * 10) / 10 : v; });
        row.eachCell({ includeEmpty: true }, function (c, ci) {
          c.font = font; c.border = box; if (sc[ci - 1][3]) c.numFmt = sc[ci - 1][3];
          if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
          if (typeof c.value === 'number' && c.value < 0) c.font = { name: 'Tahoma', size: 10, color: { argb: RED } };
        });
        row.getCell('net').font = { name: 'Tahoma', size: 10, bold: true, color: { argb: a.net < 0 ? RED : 'FF1A2530' } };
      });
      var st2 = 5 + S.length, sRow = ss.getRow(st2); sRow.getCell(1).value = 'รวม ' + S.length + ' คน';
      sc.forEach(function (c, i) {
        if (i === 0) return; var L = String.fromCharCode(65 + i), sum = S.reduce(function (x, a) { return x + a[c[1]]; }, 0);
        sRow.getCell(i + 1).value = S.length ? { formula: 'SUM(' + L + '5:' + L + (st2 - 1) + ')', result: Math.round(sum * 10) / 10 } : 0; sRow.getCell(i + 1).numFmt = c[3];
      });
      sRow.eachCell({ includeEmpty: true }, function (c, ci) {
        if (ci > sc.length) return; var neg = typeof c.value === 'object' && c.value && c.value.result < 0;
        c.font = { name: 'Tahoma', size: 10.5, bold: true, color: { argb: neg ? RED : GREEN } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F3EC' } };
        c.border = { top: { style: 'medium', color: { argb: GREEN } }, bottom: { style: 'medium', color: { argb: GREEN } } };
      });
      return wb.xlsx.writeBuffer().then(function (buf) { save(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fname('xlsx')); });
    });
  }

  /* ════════ 📄 PDF / 🖼️ JPEG — วาดรายงานบน canvas (A4 แนวนอน 150 dpi) ════════ */
  var W = 1754, H = 1240, M = 56, ROWH = 30;
  var FONT = '"Leelawadee UI","Noto Sans Thai","Segoe UI",Tahoma,sans-serif';
  var C = { green: '#1B4332', gold: '#C9A227', ink: '#1a2530', mute: '#6b7785', line: '#e2e6ea', zebra: '#f6f8fa', red: '#c8352f', redbg: '#fdecea', ok: '#1f8a52', warn: '#b26a00', totbg: '#e8f3ec' };
  var DCOLS = [
    { k: 'date', t: 'วันที่', w: 112 }, { k: 'orderId', t: 'ออเดอร์', w: 168 }, { k: 'driver', t: 'คนขับ', w: 170 }, { k: 'plate', t: 'ทะเบียน', w: 100 },
    { k: 'place', t: 'สวน / ปลายทาง', w: 0 }, { k: 'actual', t: 'ระยะจริง', w: 78, n: 1 }, { k: 'central', t: 'ระยะกลาง', w: 82, n: 1 }, { k: 'by', t: 'คิดด้วย', w: 76 },
    { k: 'liters', t: 'น้ำมัน ล.', w: 74, n: 1 }, { k: 'run', t: 'ค่าวิ่ง', w: 76, n: 0 }, { k: 'load', t: 'ขึ้น-ลง', w: 68, n: 0 }, { k: 'other', t: 'อื่นๆ', w: 64, n: 0 },
    { k: 'fuel', t: 'ปรับน้ำมัน', w: 88, n: 0 }, { k: 'net', t: 'สุทธิ', w: 96, n: 0, b: 1 }, { k: 'status', t: 'สถานะ', w: 86 }
  ];
  var SCOLS = [
    { k: 'driver', t: 'คนขับ', w: 0 }, { k: 'trips', t: 'เที่ยว', w: 80, n: 0 }, { k: 'actual', t: 'ระยะจริง กม.', w: 120, n: 1 }, { k: 'used', t: 'ระยะใช้คิด กม.', w: 130, n: 1 },
    { k: 'liters', t: 'น้ำมัน ล.', w: 105, n: 1 }, { k: 'run', t: 'ค่าวิ่ง', w: 110, n: 0 }, { k: 'load', t: 'ขึ้น-ลง', w: 100, n: 0 }, { k: 'other', t: 'อื่นๆ', w: 95, n: 0 },
    { k: 'fuel', t: 'ปรับน้ำมัน', w: 115, n: 0 }, { k: 'net', t: 'ค่าแรงสุทธิ', w: 130, n: 0, b: 1 }, { k: 'unpaid', t: 'ค้างจ่าย', w: 115, n: 0 }
  ];
  function fit(cols) { var fixed = cols.reduce(function (a, c) { return a + c.w; }, 0), flex = cols.filter(function (c) { return !c.w; }); flex.forEach(function (c) { c.w = Math.max(120, (W - 2 * M - fixed) / flex.length); }); return cols; }
  fit(DCOLS); fit(SCOLS);
  function fmtN(v, dp) { if (v == null || v === '') return '—'; return Number(v).toLocaleString('th-TH', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function ell(x, s, w) { s = String(s == null ? '' : s); if (x.measureText(s).width <= w) return s; while (s.length > 1 && x.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }
  function page(h) { var c = document.createElement('canvas'); c.width = W; c.height = h || H; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, c.height); x.textBaseline = 'middle'; return { c: c, x: x }; }
  function head(x, T, pageNo, pages) {
    x.fillStyle = C.green; x.fillRect(0, 0, W, 108); x.fillStyle = C.gold; x.fillRect(0, 108, W, 5);
    x.fillStyle = '#fff'; x.font = '700 34px ' + FONT; x.textAlign = 'left'; x.fillText('รายงานค่าแรงคนขับ', M, 42);
    x.font = '400 19px ' + FONT; x.fillStyle = '#d7e6dc'; x.fillText(ell(x, 'SSB Smart Supply · ' + info(), W - 2 * M - 360), M, 82);
    x.textAlign = 'right'; x.font = '400 17px ' + FONT; x.fillText('ออกรายงาน ' + stamp(), W - M, 42);
    if (pages) x.fillText('หน้า ' + pageNo + ' / ' + pages, W - M, 82);
    x.textAlign = 'left'; return 138;
  }
  function kpis(x, T, y) {
    var items = [['จำนวนเที่ยว', fmtN(T.trips, 0), ''], ['ค่าแรงรวม', fmtN(T.net, 0), ' บ.'], ['เฉลี่ย/เที่ยว', fmtN(T.trips ? T.net / T.trips : 0, 0), ' บ.'],
      ['ระยะทางรวม (จริง)', fmtN(T.actual, 1), ' กม.'], ['น้ำมันรวม', fmtN(T.liters, 1), ' ล.'], ['เที่ยวติดลบ', fmtN(T.neg, 0), ' เที่ยว']];
    var gap = 14, w = (W - 2 * M - gap * (items.length - 1)) / items.length;
    items.forEach(function (it, i) {
      var bx = M + i * (w + gap); x.fillStyle = C.zebra; x.fillRect(bx, y, w, 84); x.fillStyle = i === 1 ? C.ok : C.line; x.fillRect(bx, y, 4, 84);
      x.fillStyle = C.mute; x.font = '400 17px ' + FONT; x.fillText(it[0], bx + 18, y + 24);
      var neg = (i === 1 && T.net < 0) || (i === 5 && T.neg > 0);
      x.fillStyle = neg ? C.red : C.ink; x.font = '700 30px ' + FONT; x.fillText(it[1], bx + 18, y + 58);
      var vw = x.measureText(it[1]).width; x.font = '400 17px ' + FONT; x.fillStyle = C.mute; x.fillText(it[2], bx + 18 + vw, y + 60);
    });
    return y + 84 + 26;
  }
  function title(x, s, y) { x.fillStyle = C.green; x.font = '700 21px ' + FONT; x.fillText(s, M, y + 12); return y + 34; }
  function thead(x, cols, y) {
    x.fillStyle = C.green; x.fillRect(M, y, W - 2 * M, ROWH + 4); var cx = M;
    x.font = '700 16px ' + FONT; x.fillStyle = '#fff';
    cols.forEach(function (c) { x.textAlign = c.n != null ? 'right' : 'left'; x.fillText(c.t, c.n != null ? cx + c.w - 8 : cx + 8, y + (ROWH + 4) / 2); cx += c.w; });
    x.textAlign = 'left'; return y + ROWH + 4;
  }
  function trow(x, cols, r, y, i, total) {
    if (total) { x.fillStyle = C.totbg; x.fillRect(M, y, W - 2 * M, ROWH + 4); x.fillStyle = C.green; x.fillRect(M, y, W - 2 * M, 2); }
    else if (i % 2) { x.fillStyle = C.zebra; x.fillRect(M, y, W - 2 * M, ROWH); }
    if (!total && r.net < 0) { var nc = 0, cx0 = M; cols.forEach(function (c) { if (c.k === 'net') nc = cx0; cx0 += c.w; }); if (nc) { x.fillStyle = C.redbg; x.fillRect(nc, y, cols.find(function (c) { return c.k === 'net'; }).w, ROWH); } }
    var cx = M, hh = total ? ROWH + 4 : ROWH;
    cols.forEach(function (c) {
      var v = r[c.k], s, col = C.ink, bold = c.b || total;
      if (c.k === 'date') s = dmy(v);
      else if (c.n != null) { s = (v == null || v === '') ? (total ? '' : '—') : fmtN(v, c.n); if (Number(v) < 0) col = C.red; }
      else s = v == null ? '' : v;
      if (c.k === 'by') col = v === 'ค่ากลาง' ? C.ok : C.warn;
      if (c.k === 'status') col = r.locked ? C.ok : C.mute;
      x.font = (bold ? '700 ' : '400 ') + '16px ' + FONT; x.fillStyle = total && col === C.ink ? C.green : col;
      x.textAlign = c.n != null ? 'right' : 'left';
      x.fillText(ell(x, s, c.w - 14), c.n != null ? cx + c.w - 8 : cx + 8, y + hh / 2);
      cx += c.w;
    });
    x.textAlign = 'left'; x.fillStyle = C.line; x.fillRect(M, y + hh - 1, W - 2 * M, 1);
    return y + hh;
  }
  function foot(x, h) {
    x.fillStyle = C.mute; x.font = '400 14px ' + FONT;
    x.fillText('สุทธิ = ค่าวิ่ง + ขึ้น-ลง + อื่นๆ (ผ้าใบ/ค่ารอ/Hardship/โบนัส) + ปรับน้ำมัน · ฮุคลิฟท์/ให้เพิ่มแปลงเป็นลิตรอยู่ในปรับน้ำมันแล้ว · สีแดง = ติดลบ', M, h - 28);
  }
  function sumTotalRow(S) { var t = { driver: 'รวม ' + S.length + ' คน' }; SCOLS.forEach(function (c) { if (c.n != null) t[c.k] = S.reduce(function (a, s) { return a + num(s[c.k]); }, 0); }); return t; }
  function detTotalRow(R, T) { return { date: '', orderId: 'รวม ' + T.trips + ' เที่ยว', actual: T.actual, liters: T.liters, run: T.run, load: T.load, other: T.other, fuel: T.fuel, net: T.net }; }

  // PDF: หน้า 1 = KPI + สรุปรายคนขับ (+เริ่มรายเที่ยวถ้าเหลือที่) · หน้าต่อไป = รายเที่ยว
  function buildPages() {
    var R = rows(), T = totals(R), S = byDriver(R), pages = [], cur, y, bottom = H - 60;
    function newPage() { cur = page(); pages.push(cur); y = head(cur.x, T, pages.length, 0); }
    newPage(); y = kpis(cur.x, T, y);
    y = title(cur.x, 'สรุปรายคนขับ', y); y = thead(cur.x, SCOLS, y);
    S.forEach(function (s, i) { if (y + ROWH > bottom) { newPage(); y = title(cur.x, 'สรุปรายคนขับ (ต่อ)', y); y = thead(cur.x, SCOLS, y); } y = trow(cur.x, SCOLS, s, y, i); });
    y = trow(cur.x, SCOLS, sumTotalRow(S), y, 0, true) + 26;
    if (y + 34 + ROWH * 4 > bottom) newPage();
    y = title(cur.x, 'รายละเอียดทุกเที่ยว', y); y = thead(cur.x, DCOLS, y);
    R.forEach(function (r, i) { if (y + ROWH > bottom) { newPage(); y = title(cur.x, 'รายละเอียดทุกเที่ยว (ต่อ)', y); y = thead(cur.x, DCOLS, y); } y = trow(cur.x, DCOLS, r, y, i); });
    if (y + ROWH + 4 > bottom) { newPage(); y = thead(cur.x, DCOLS, y); }
    trow(cur.x, DCOLS, detTotalRow(R, T), y, 0, true);
    pages.forEach(function (p, i) { head(p.x, T, i + 1, pages.length); foot(p.x, H); });   // วาดหัวใหม่ให้มี "หน้า x / y"
    return pages;
  }
  function pdf() {
    return Promise.all([loadLib(LIB.pdf), document.fonts ? document.fonts.ready : null]).then(function () {
      var pages = buildPages(), doc = new window.jspdf.jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
      pages.forEach(function (p, i) { if (i) doc.addPage(); doc.addImage(p.c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 297, 210); });
      doc.save(fname('pdf'));
    });
  }
  // JPEG: รูปเดียวยาว (ไม่แบ่งหน้า) · สูงเกิน 32,000 px (≈ 1,000 เที่ยว) ให้ใช้ PDF แทน
  function jpeg() {
    return (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
      var R = rows(), T = totals(R), S = byDriver(R);
      var h = 138 + 110 + 34 + (ROWH + 4) + S.length * ROWH + (ROWH + 4) + 26 + 34 + (ROWH + 4) + R.length * ROWH + (ROWH + 4) + 70;
      if (h > 32000) throw new Error('เที่ยวเยอะเกินรูปเดียว (' + R.length + ' เที่ยว) — ใช้ PDF แทน หรือกรองให้น้อยลง');
      var p = page(h), x = p.x, y = head(x, T, 0, 0);
      y = kpis(x, T, y); y = title(x, 'สรุปรายคนขับ', y); y = thead(x, SCOLS, y);
      S.forEach(function (s, i) { y = trow(x, SCOLS, s, y, i); }); y = trow(x, SCOLS, sumTotalRow(S), y, 0, true) + 26;
      y = title(x, 'รายละเอียดทุกเที่ยว', y); y = thead(x, DCOLS, y);
      R.forEach(function (r, i) { y = trow(x, DCOLS, r, y, i); }); trow(x, DCOLS, detTotalRow(R, T), y, 0, true);
      foot(x, h);
      return new Promise(function (res) { p.c.toBlob(function (b) { save(b, fname('jpg')); res(); }, 'image/jpeg', 0.92); });
    });
  }

  /* ── ปุ่ม ⬇️ ดาวน์โหลด ▾ ── */
  var busy = false;
  function run(kind, btn) {
    if (busy) return Promise.resolve(false); if (!(CTX ? CTX.rows : VIEW).length) { alert('ไม่มีเที่ยวในรอบที่เลือก'); return Promise.resolve(false); }
    var b = btn || $('dlBtn'), label = b.textContent; busy = true; b.disabled = true;
    b.textContent = { xlsx: 'กำลังสร้าง Excel…', pdf: 'กำลังสร้าง PDF…', jpg: 'กำลังสร้างรูป…' }[kind];
    var job = kind === 'xlsx' ? xlsx().catch(function (e) { if (/ไลบรารี/.test(e.message)) { csv(); alert('โหลดตัวสร้าง Excel ไม่ได้ — ดาวน์โหลดเป็น CSV แทน'); return; } throw e; })
      : kind === 'pdf' ? pdf() : jpeg();
    return job.then(function () { return true; }, function (e) { alert('❌ สร้างไฟล์ไม่สำเร็จ: ' + (e && e.message || e)); return false; })
      .then(function (ok) { busy = false; b.disabled = false; b.textContent = label; return ok; });
  }

  /* ════════ popup เลือกรอบจ่าย (เดือน × รอบ 1–15 / 16–สิ้นเดือน / ทั้งเดือน) + คนขับ ════════
   *   ดึงรายงานช่วงนั้นเอง (ไม่ขึ้นกับตัวกรองบนหน้า) · แคชต่อช่วง · โชว์ยอดก่อนกดดาวน์โหลด */
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var FMT = { xlsx: '📊 Excel', pdf: '📄 PDF', jpg: '🖼️ JPEG' };
  var XM = { fmt: 'xlsx', month: '', round: 'h1', driver: '', cache: {}, seq: 0, data: null };
  function pad(n) { return ('0' + n).slice(-2); }
  function lastDay(ym) { var p = ym.split('-'); return new Date(+p[0], +p[1], 0).getDate(); }
  function range() {
    var ld = lastDay(XM.month), a = XM.round === 'h2' ? 16 : 1, b = XM.round === 'h1' ? 15 : ld;
    var mm = +XM.month.split('-')[1], yy = XM.month.split('-')[0];
    var lbl = (XM.round === 'full' ? 'ทั้งเดือน ' : (XM.round === 'h1' ? 'รอบ 1 · ' : 'รอบ 2 · ')) + a + '–' + b + ' ' + TH_M[mm - 1] + ' ' + yy;
    return { from: XM.month + '-' + pad(a), to: XM.month + '-' + pad(b), label: lbl, ld: ld };
  }
  function defaults() {   // วันนี้ ≤ 15 → รอบ 2 ของเดือนก่อน (รอบที่เพิ่งจบ) · หลัง 15 → รอบ 1 ของเดือนนี้
    var d = new Date();
    if (d.getDate() <= 15) { var p = new Date(d.getFullYear(), d.getMonth() - 1, 1); XM.month = p.getFullYear() + '-' + pad(p.getMonth() + 1); XM.round = 'h2'; }
    else { XM.month = d.getFullYear() + '-' + pad(d.getMonth() + 1); XM.round = 'h1'; }
  }
  function css() {
    if ($('xmCss')) return;
    var s = document.createElement('style'); s.id = 'xmCss';
    s.textContent = '.xm-ov{position:fixed;inset:0;z-index:60;background:rgba(10,20,15,.45);display:flex;align-items:center;justify-content:center;padding:16px;animation:xmIn .18s ease-out}'
      + '.xm-ov[hidden]{display:none}'
      + '.xm{width:100%;max-width:440px;background:var(--card);color:var(--txt);border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);padding:18px 18px 16px;max-height:calc(100vh - 32px);overflow:auto}'
      + '.xm-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.xm-h b{font-size:16px}'
      + '.xm-x{border:0;background:transparent;color:var(--txt2);font-size:18px;cursor:pointer;border-radius:8px;width:32px;height:32px}.xm-x:hover{background:var(--card2)}'
      + '.xm-sec{margin-bottom:13px}.xm-lb{display:block;font-size:12px;color:var(--txt2);margin-bottom:6px}'
      + '.xm-chips{display:flex;flex-wrap:wrap;gap:6px}'
      + '.xm-chip{border:1px solid var(--line2);background:var(--card);color:var(--txt);font:inherit;font-size:13px;padding:7px 12px;border-radius:999px;cursor:pointer;line-height:1.3;text-align:left}'
      + '.xm-chip small{display:block;font-size:11px;color:var(--txt2)}'
      + '.xm-chip[aria-pressed=true]{background:var(--primary);border-color:var(--primary);color:#fff}.xm-chip[aria-pressed=true] small{color:rgba(255,255,255,.85)}'
      + '.xm-chip:focus-visible,.xm-x:focus-visible,.xm-nav:focus-visible{outline:2px solid var(--primary);outline-offset:2px}'
      + '.xm-mrow{display:flex;gap:6px;align-items:center}.xm-mrow input{flex:1;margin:0}'
      + '.xm-nav{border:1px solid var(--line2);background:var(--card);color:var(--txt);border-radius:9px;width:36px;height:36px;font-size:16px;cursor:pointer}'
      + '.xm select{width:100%;margin:0}'
      + '.xm-prev{background:var(--card2);border-radius:10px;padding:10px 12px;font-size:13px;min-height:44px;display:flex;flex-direction:column;justify-content:center;gap:3px}'
      + '.xm-prev .big{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}.xm-prev .neg{color:var(--danger)}'
      + '.xm-bar{height:3px;background:var(--line);border-radius:2px;overflow:hidden;margin-bottom:4px}.xm-bar i{display:block;height:100%;width:40%;background:var(--primary);animation:ldslide 1.1s ease-in-out infinite}'
      + '.xm-f{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}'
      + '@keyframes xmIn{from{opacity:0}to{opacity:1}}@media(prefers-reduced-motion:reduce){.xm-ov{animation:none}.xm-bar i{animation-duration:3s}}';
    document.head.appendChild(s);
  }
  function build() {
    if ($('xmOv')) return; css();
    var ov = document.createElement('div'); ov.id = 'xmOv'; ov.className = 'xm-ov'; ov.hidden = true;
    ov.innerHTML = '<div class="xm" role="dialog" aria-modal="true" aria-labelledby="xmT">'
      + '<div class="xm-h"><b id="xmT">ดาวน์โหลดรายงานค่าแรง</b><button class="xm-x" id="xmX" aria-label="ปิด">✕</button></div>'
      + '<div class="xm-sec"><span class="xm-lb">รูปแบบไฟล์</span><div class="xm-chips" id="xmFmt"></div></div>'
      + '<div class="xm-sec"><label class="xm-lb" for="xmMonth">เดือน</label><div class="xm-mrow"><button class="xm-nav" id="xmPrevM" aria-label="เดือนก่อน">‹</button><input type="month" id="xmMonth"><button class="xm-nav" id="xmNextM" aria-label="เดือนถัดไป">›</button></div></div>'
      + '<div class="xm-sec"><span class="xm-lb">รอบจ่าย</span><div class="xm-chips" id="xmRound"></div></div>'
      + '<div class="xm-sec"><label class="xm-lb" for="xmDrv">คนขับ</label><select id="xmDrv"><option value="">ทุกคน</option></select></div>'
      + '<div class="xm-prev" id="xmPv" role="status" aria-live="polite"></div>'
      + '<div class="xm-f"><button class="btn ghost" id="xmCancel">ยกเลิก</button><button class="btn" id="xmGo">⬇️ ดาวน์โหลด</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    $('xmX').onclick = closeModal; $('xmCancel').onclick = closeModal;
    $('xmFmt').onclick = function (e) { var c = e.target.closest('[data-v]'); if (c) { XM.fmt = c.dataset.v; paint(); } };
    $('xmRound').onclick = function (e) { var c = e.target.closest('[data-v]'); if (c) { XM.round = c.dataset.v; paint(); fetchRange(); } };
    $('xmMonth').onchange = function () { if (this.value) { XM.month = this.value; paint(); fetchRange(); } };
    $('xmPrevM').onclick = function () { shiftM(-1); }; $('xmNextM').onclick = function () { shiftM(1); };
    $('xmDrv').onchange = function () { XM.driver = this.value; preview(); };
    $('xmGo').onclick = go;
  }
  function shiftM(n) { var p = XM.month.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1); XM.month = d.getFullYear() + '-' + pad(d.getMonth() + 1); paint(); fetchRange(); }
  function chip(v, on, html) { return '<button class="xm-chip" data-v="' + v + '" aria-pressed="' + on + '">' + html + '</button>'; }
  function paint() {
    var r = range(), mm = TH_M[+XM.month.split('-')[1] - 1];
    $('xmFmt').innerHTML = Object.keys(FMT).map(function (k) { return chip(k, XM.fmt === k, FMT[k]); }).join('');
    $('xmMonth').value = XM.month;
    $('xmRound').innerHTML = chip('h1', XM.round === 'h1', 'รอบ 1<small>1–15 ' + mm + '</small>') + chip('h2', XM.round === 'h2', 'รอบ 2<small>16–' + r.ld + ' ' + mm + '</small>') + chip('full', XM.round === 'full', 'ทั้งเดือน<small>1–' + r.ld + ' ' + mm + '</small>');
    $('xmGo').textContent = '⬇️ ดาวน์โหลด ' + FMT[XM.fmt].replace(/^\S+\s/, '');
  }
  function fetchRange() {
    var r = range(), key = r.from + '|' + r.to, my = ++XM.seq;
    if (XM.cache[key]) { XM.data = XM.cache[key]; fillDrivers(); preview(); return; }
    XM.data = null; $('xmGo').disabled = true;
    $('xmPv').innerHTML = '<div class="xm-bar" aria-hidden="true"><i></i></div><span style="color:var(--txt2)">กำลังดึงข้อมูล ' + r.label + '…</span>';
    api({ action: 'getWageReport', userId: MY_UID, from: r.from, to: r.to, driver: '' }).then(function (d) {
      if (my !== XM.seq) return;   // เปลี่ยนรอบไปแล้ว ทิ้งผลเก่า
      if (!d || !d.ok) throw new Error(d && (d.error || (d.denied ? 'ไม่มีสิทธิ์' : '')) || 'หลังบ้านตอบผิดพลาด');
      XM.cache[key] = XM.data = d.rows || []; fillDrivers(); preview();
    }).catch(function (e) {
      if (my !== XM.seq) return;
      $('xmPv').innerHTML = '<span class="neg">ดึงข้อมูลไม่สำเร็จ (' + (e && e.name === 'AbortError' ? 'หลังบ้านไม่ตอบใน 90 วินาที' : (e && e.message || e)) + ')</span> <button class="xm-chip" id="xmRetry" style="margin-top:6px;align-self:flex-start">↻ ลองใหม่</button>';
      $('xmRetry').onclick = fetchRange; $('xmGo').disabled = true;
    });
  }
  function fillDrivers() {
    var cnt = {}; (XM.data || []).forEach(function (r) { var k = r.driver || '—'; cnt[k] = (cnt[k] || 0) + 1; });
    var names = Object.keys(cnt).sort(function (a, b) { return a.localeCompare(b, 'th'); });
    if (XM.driver && !cnt[XM.driver]) XM.driver = '';
    $('xmDrv').innerHTML = '<option value="">ทุกคน (' + names.length + ' คน)</option>' + names.map(function (n) { return '<option value="' + n.replace(/"/g, '&quot;') + '"' + (n === XM.driver ? ' selected' : '') + '>' + n + ' · ' + cnt[n] + ' เที่ยว</option>'; }).join('');
  }
  function picked() { return (XM.data || []).filter(function (r) { return !XM.driver || (r.driver || '—') === XM.driver; }); }
  function preview() {
    var R = picked(), r = range(), tot = 0, neg = 0, unpaid = 0;
    R.forEach(function (x) { var w = num(x.wage); tot += w; if (w < 0) neg++; if (!x.locked) unpaid++; });
    $('xmGo').disabled = !R.length;
    $('xmPv').innerHTML = !R.length ? '<span style="color:var(--txt2)">ไม่มีเที่ยวใน ' + r.label + (XM.driver ? ' ของ ' + XM.driver : '') + '</span>'
      : '<span style="color:var(--txt2)">' + r.label + ' · ' + (XM.driver || 'ทุกคน') + '</span>'
      + '<span><span class="big">' + R.length + '</span> เที่ยว · ค่าแรงรวม <span class="big' + (tot < 0 ? ' neg' : '') + '">' + Math.round(tot).toLocaleString('th-TH') + '</span> บ.</span>'
      + '<span style="font-size:12px;color:var(--txt2)">ยังไม่จ่าย ' + unpaid + ' เที่ยว' + (neg ? ' · <span class="neg">ติดลบ ' + neg + ' เที่ยว</span>' : '') + '</span>';
  }
  var lastFocus = null;
  function openModal(fmt) {
    if (typeof MY_UID === 'undefined' || !MY_UID) { alert('ยังไม่ได้เข้าสู่ระบบ'); return; }
    build(); if (!XM.month) defaults(); if (fmt) XM.fmt = fmt;
    lastFocus = document.activeElement; $('xmOv').hidden = false; paint(); fetchRange();
    setTimeout(function () { var c = $('xmRound').querySelector('[aria-pressed=true]'); if (c) c.focus(); }, 30);
  }
  function closeModal() { var o = $('xmOv'); if (!o || o.hidden) return; o.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function go() {
    var R = picked(), r = range(); if (!R.length) return;
    CTX = { rows: R, from: r.from, to: r.to, driver: XM.driver, label: r.label };
    run(XM.fmt, $('xmGo')).then(function (ok) { CTX = null; if (ok) closeModal(); });
  }

  function init() {
    var b = $('dlBtn'), m = $('dlMenu'); if (!b || !m) return;
    b.onclick = function (e) {
      e.stopPropagation(); m.hidden = !m.hidden; if (m.hidden) return;
      // เปิดไปฝั่งที่มีที่ (ปุ่มอยู่ขวาสุดบนจอกว้าง / ตกลงซ้ายบนจอแคบ) กันเมนูล้นจอ
      var r = b.getBoundingClientRect(), mw = m.offsetWidth || 250;
      if (r.left + mw > window.innerWidth - 8) { m.style.left = 'auto'; m.style.right = '0'; } else { m.style.left = '0'; m.style.right = 'auto'; }
    };
    m.addEventListener('click', function (e) { var it = e.target.closest('[data-f]'); if (!it) return; m.hidden = true; openModal(it.dataset.f); });   // เลือกรูปแบบ → popup เลือกรอบ/คนขับ
    document.addEventListener('click', function (e) { if (!m.hidden && !e.target.closest('.dlwrap')) m.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { m.hidden = true; closeModal(); } });
  }
  window.wageExport = { run: run, rows: rows, open: openModal };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
