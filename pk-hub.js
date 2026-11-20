/* 🚚 ขอรถ PK จาก Order Hub · 2026-11-20 (คุณน้อง: ถัง/กล่อง/ปี๊บ/ลัง ต้องขอรถ PK · คำขอเกิดจาก Order Hub แผนส่งรายวัน)
 * ปุ่มลอยที่ 3 ในหน้าแพลนรถ Packing (ซ้อนเหนือ PO รอส่ง) → ลิ้นชักคำขอ → แอดมิน PK เลือกคนขับ+ทะเบียน ยืนยัน
 * → Edge pk-hub: การ์ด LINE ถึงคนขับ PK + แจ้งแอดมิน Bulk + ลงหน้าจัดรถ Bulk (รถ PK) ให้พิมพ์ใบ 5 ส่วน · สถานะเด้งกลับ Order Hub
 * ไฟล์แยก ไม่แตะโค้ดหลักของ pk-daily.html (ใช้แค่ MY_UID / toast / askModal / esc / $ ที่หน้าหลักมีอยู่แล้ว) */
(function () {
  const URL_ = 'https://abihhdjcrbvwlkzwvjio.supabase.co/functions/v1/pk-hub';
  const HB = { rows: [], drv: [], canEdit: false, loaded: false, tab: 'wait', open: false, busy: '', edit: '' };
  const E = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = m => { try { toast(m); } catch (e) { alert(m); } };
  const uid = () => { try { return MY_UID || ''; } catch (e) { return ''; } };
  const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'], MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const dTH = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return E(d); const t = new Date(+m[1], +m[2] - 1, +m[3]); return DOW[t.getDay()] + ' ' + (+m[3]) + ' ' + MON[+m[2] - 1]; };
  const today = () => { const t = new Date(Date.now() + 7 * 3600e3); return t.toISOString().slice(0, 10); };
  const qty = r => (r.qty != null && r.qty !== '' ? Number(r.qty).toLocaleString('en-US', { maximumFractionDigits: 3 }) : '') + (r.unit ? ' ' + r.unit : '');
  const at = s => { if (!s) return ''; const t = new Date(s); return t.getDate() + ' ' + MON[t.getMonth()] + ' ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); };

  const css = `
.fab.hub{bottom:calc(var(--barh,64px) + 30px + 128px);background:linear-gradient(135deg,#7c2d12,#c2410c)}
@media (max-width:520px){.fab.hub{bottom:calc(var(--barh,64px) + 30px + 136px)}}
.hbt{display:flex;gap:6px;flex-wrap:wrap}
.hbt button{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.hbt button.on{background:var(--head);border-color:var(--head);color:var(--head-ink)}
.hbt button b{font-variant-numeric:tabular-nums;margin-left:4px}
.hbd{font-weight:700;font-size:13px;color:var(--muted);margin:6px 0 -4px}
.hbc{border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.hbc.wait{border-left:4px solid #c2410c}.hbc.ok{border-left:4px solid var(--good)}.hbc.reject,.hbc.cancel{border-left:4px solid var(--bad);opacity:.85}
.hbc .h{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.hbc .n{font-weight:700;font-size:15px}.hbc .s{font-size:13px;color:var(--muted)}
.hbc .q{font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.hbc .ch{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:2px 9px;white-space:nowrap}
.ch.wait{background:#ffedd5;color:#9a3412}.ch.ok{background:var(--goodbg);color:var(--good)}.ch.reject,.ch.cancel{background:var(--badbg);color:var(--bad)}
.hbc .nt{font-size:12.5px;color:var(--warn)}
.hbc .dv{font-size:13.5px;background:var(--surface2);border-radius:9px;padding:7px 10px}
.hbf{display:grid;grid-template-columns:1fr 130px;gap:6px;margin-top:4px}
.hbf select,.hbf input{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);min-width:0}
.hbf .w{grid-column:1/-1}
.hba{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.hba .btn{padding:7px 12px;font-size:13.5px}
.hba .btn.no{color:var(--bad)}
.hbe{text-align:center;color:var(--muted);padding:28px 0}`;

  function boot() {
    if (document.getElementById('bHub')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const b = document.createElement('button');
    b.className = 'fab hub'; b.id = 'bHub'; b.type = 'button';
    b.title = 'ขอรถ PK จาก Order Hub · งานถัง/กล่อง/ปี๊บ/ลัง ที่แอดมินขาย Bulk ขอรถ'; b.setAttribute('aria-label', 'ขอรถ PK จาก Order Hub');
    b.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg><span class="fl">ขอรถ Order Hub</span><b id="hbN" aria-live="polite">·</b>';
    b.onclick = () => openD();
    const po = document.getElementById('bPo');
    (po && po.parentNode ? po.parentNode : document.body).insertBefore(b, po ? po.nextSibling : null);
    load();
    setInterval(() => { if (!document.hidden) load(); }, 60000);
  }
  async function load(force) {
    if (!uid()) return;
    try {
      const r = await fetch(URL_ + '?action=list&userId=' + encodeURIComponent(uid()) + '&t=' + Date.now()).then(x => x.json());
      if (r.denied) { const b = document.getElementById('bHub'); if (b) b.hidden = true; return; }
      if (!r.ok) throw new Error(r.error || 'โหลดไม่ได้');
      HB.rows = r.rows || []; HB.drv = r.drv || []; HB.canEdit = !!r.canEdit; HB.loaded = true;
      badge(); if (HB.open && (force || !HB.edit)) draw();
    } catch (e) { if (force) T('❌ ' + (e.message || e)); }
  }
  function badge() {
    const n = HB.rows.filter(r => r.status === 'wait').length, b = document.getElementById('hbN');
    if (b) { b.textContent = n || '0'; b.classList.toggle('on', n > 0); }
  }
  function openD() {
    if (HB.open) return; HB.open = true; HB.edit = '';
    const host = document.createElement('div'); host.id = 'hbHost';
    host.innerHTML = '<div class="scrim" data-hx></div><aside class="drawer pod" role="dialog" aria-modal="true" aria-label="ขอรถ PK จาก Order Hub"><div class="dh"><div><h3>🚚 ขอรถ PK จาก Order Hub</h3><div class="m">งานถัง / กล่อง / ปี๊บ / ลัง ที่แอดมินขาย Bulk ขอรถ · ยืนยันแล้วแจ้งไลน์คนขับ + แอดมิน Bulk และลงหน้าจัดรถ Bulk ให้พิมพ์ใบ 5 ส่วน</div></div><div class="xs"><button class="x" type="button" data-hr title="โหลดใหม่">↻</button><button class="x" type="button" data-hx title="ปิด">✕</button></div></div><div class="db" id="hbBody"></div></aside>';
    document.body.appendChild(host);
    host.addEventListener('click', onClick);
    host.addEventListener('change', onChange);
    document.addEventListener('keydown', onKey);
    draw(); load(true);
  }
  function closeD() { HB.open = false; HB.edit = ''; const h = document.getElementById('hbHost'); if (h) h.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') closeD(); }

  function draw() {
    const body = document.getElementById('hbBody'); if (!body) return;
    if (!HB.loaded) { body.innerHTML = '<div class="hbe">กำลังโหลด…</div>'; return; }
    const cnt = k => HB.rows.filter(r => k === 'no' ? (r.status === 'reject' || r.status === 'cancel') : r.status === k).length;
    let h = '<div class="hbt" role="tablist">' + [['wait', 'รอจัดรถ'], ['ok', 'ยืนยันแล้ว'], ['no', 'ไม่มีรถ / ยกเลิก']].map(([k, l]) =>
      '<button type="button" role="tab" aria-selected="' + (HB.tab === k) + '" class="' + (HB.tab === k ? 'on' : '') + '" data-ht="' + k + '">' + l + '<b>' + cnt(k) + '</b></button>').join('') + '</div>';
    const L = HB.rows.filter(r => HB.tab === 'no' ? (r.status === 'reject' || r.status === 'cancel') : r.status === HB.tab)
      .sort((a, b) => a.ship_date < b.ship_date ? -1 : a.ship_date > b.ship_date ? 1 : String(a.req_at) < String(b.req_at) ? -1 : 1);
    if (!L.length) h += '<div class="hbe">' + (HB.tab === 'wait' ? 'ไม่มีคำขอรอจัดรถ 🎉' : 'ไม่มีรายการ') + '</div>';
    let last = '';
    L.forEach(r => {
      if (r.ship_date !== last) { last = r.ship_date; h += '<div class="hbd">ส่ง ' + dTH(r.ship_date) + (r.ship_date === today() ? ' · วันนี้' : r.ship_date < today() ? ' · เลยแล้ว' : '') + '</div>'; }
      h += cardH(r);
    });
    body.innerHTML = h;
  }
  const ST = { wait: 'รอจัดรถ', ok: 'ยืนยันแล้ว', reject: 'ไม่มีรถ', cancel: 'Order Hub ยกเลิก' };
  function cardH(r) {
    const id = E(r.id), ed = HB.canEdit && HB.edit === r.id;
    let h = '<article class="hbc ' + E(r.status) + '"><div class="h"><div><div class="n">' + E(r.company) + '</div><div class="s">' + E(r.place || '—') + '</div></div>'
      + '<div style="text-align:right"><div class="q">' + E(qty(r)) + '</div><span class="ch ' + E(r.status) + '">' + ST[r.status] + '</span></div></div>'
      + '<div class="s">' + E(r.product || '') + (r.load_date ? ' · โหลด ' + dTH(r.load_date) : '') + (r.bill ? ' · บิล ' + E(r.bill) : '') + (r.co_no ? ' · CO ' + E(r.co_no) : '') + '</div>'
      + [r.plan_note, r.cond, r.req_note].filter(Boolean).map(t => '<div class="nt">📝 ' + E(t) + '</div>').join('')
      + '<div class="s">ขอโดย ' + E(r.req_by || '-') + ' · ' + at(r.req_at) + '</div>';
    if (r.status === 'ok') h += '<div class="dv">🚚 <b>' + E(r.driver_name) + '</b> · ' + E(r.plate) + (r.pk_note ? ' · ' + E(r.pk_note) : '') + '<br><span class="s">ยืนยันโดย ' + E(r.by_name || '') + ' · ' + at(r.by_at) + (r.bulk_job_id ? ' · ลงหน้าจัดรถ Bulk แล้ว' : ' · ⚠️ ยังไม่ลงหน้าจัดรถ Bulk') + '</span></div>';
    if (r.status === 'reject' || r.status === 'cancel') h += '<div class="nt">เหตุผล: ' + E(r.reason || '-') + (r.by_name && r.status === 'reject' ? ' — ' + E(r.by_name) : '') + '</div>';
    if (ed) {
      const cur = r.driver_code || '';
      h += '<div class="hbf"><select data-hd="' + id + '" aria-label="คนขับ"><option value="">— เลือกคนขับ PK —</option>' + HB.drv.map(d =>
        '<option value="' + E(d[0]) + '" data-pl="' + E(d[2]) + '"' + (d[0] === cur ? ' selected' : '') + '>' + E(d[1]) + (d[2] ? ' · ' + E(d[2]) : '') + (d[3] ? '' : ' (ยังไม่ผูก LINE)') + '</option>').join('') + '</select>'
        + '<input data-hp="' + id + '" placeholder="ทะเบียน" aria-label="ทะเบียนรถ" value="' + E(r.plate || '') + '">'
        + '<input class="w" data-hn="' + id + '" placeholder="หมายเหตุถึงคนขับ (ถ้ามี)" aria-label="หมายเหตุ" value="' + E(r.pk_note || '') + '"></div>'
        + '<div class="hba"><button class="btn" type="button" data-ha="x">ยกเลิก</button><button class="btn pri" type="button" data-ha="ok" data-id="' + id + '"' + (HB.busy ? ' disabled' : '') + '>' + (HB.busy === r.id ? 'กำลังส่ง…' : r.status === 'ok' ? 'บันทึก + แจ้งใหม่' : 'ยืนยัน + แจ้งไลน์') + '</button></div>';
    } else if (HB.canEdit) {
      const B = (a, l, c) => '<button class="btn' + (c ? ' ' + c : '') + '" type="button" data-ha="' + a + '" data-id="' + id + '"' + (HB.busy ? ' disabled' : '') + '>' + l + '</button>';
      if (r.status === 'wait') h += '<div class="hba">' + B('no', 'ไม่มีรถ', 'no') + B('ed', 'จัดรถ', 'pri') + '</div>';
      else if (r.status === 'ok') h += '<div class="hba">' + B('cx', 'ยกเลิกรถ', 'no') + B('ed', 'เปลี่ยนคนขับ/ทะเบียน') + '</div>';
      else if (r.status === 'reject') h += '<div class="hba">' + B('re', 'คืนเป็นรอจัดรถ') + '</div>';
    }
    return h + '</article>';
  }
  function onChange(e) {
    const s = e.target.closest('[data-hd]'); if (!s) return;
    const o = s.selectedOptions[0], p = document.querySelector('[data-hp="' + CSS.escape(s.dataset.hd) + '"]');
    if (p && o && o.dataset.pl) p.value = o.dataset.pl;
  }
  async function post(body) {
    const r = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ userId: uid() }, body)) }).then(x => x.json());
    if (!r.ok) throw new Error(r.error || 'ไม่สำเร็จ');
    if (r.row) { const i = HB.rows.findIndex(x => x.id === r.row.id); if (i >= 0) HB.rows[i] = r.row; }
    return r;
  }
  // askModal ของหน้าหลักไม่มีช่องกรอก → ใส่ช่องเหตุผลใน html แล้วเก็บค่าก่อน popup ปิด
  async function ask(o) {
    if (typeof askModal !== 'function') return prompt(o.title + '\nเหตุผล:') || '';
    let v = '';
    const p = askModal(Object.assign({}, o, { html: (o.html || '') + '<textarea id="hbWhy" rows="2" placeholder="' + E(o.input.placeholder) + '" style="width:100%;box-sizing:border-box;font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink)"></textarea>' }));
    const ta = document.getElementById('hbWhy');
    if (ta) { ta.addEventListener('input', () => { v = ta.value; }); setTimeout(() => ta.focus(), 30); }
    return (await p) ? (v.trim() || ' ') : '';
  }
  async function onClick(e) {
    if (e.target.closest('[data-hx]')) return closeD();
    if (e.target.closest('[data-hr]')) return load(true);
    const t = e.target.closest('[data-ht]'); if (t) { HB.tab = t.dataset.ht; HB.edit = ''; return draw(); }
    const a = e.target.closest('[data-ha]'); if (!a || HB.busy) return;
    const act = a.dataset.ha, id = a.dataset.id, r = HB.rows.find(x => x.id === id);
    if (act === 'x') { HB.edit = ''; return draw(); }
    if (act === 'ed') { HB.edit = id; draw(); const s = document.querySelector('[data-hd="' + CSS.escape(id) + '"]'); if (s) s.focus(); return; }
    try {
      if (act === 'ok') {
        const s = document.querySelector('[data-hd="' + CSS.escape(id) + '"]'), p = document.querySelector('[data-hp="' + CSS.escape(id) + '"]'), n = document.querySelector('[data-hn="' + CSS.escape(id) + '"]');
        if (!s.value) { T('เลือกคนขับก่อน'); s.focus(); return; }
        if (!p.value.trim()) { T('ใส่ทะเบียนรถ'); p.focus(); return; }
        HB.busy = id; draw();
        const x = await post({ action: 'confirm', id, driverCode: s.value, plate: p.value.trim(), note: n.value.trim() });
        const ln = x.line || {}, msg = ['✅ ยืนยันแล้ว', ln.driver && ln.driver.sent ? 'แจ้งคนขับแล้ว' : '⚠️ แจ้งคนขับไม่ได้' + (ln.driver && ln.driver.error ? ' (' + ln.driver.error + ')' : ''),
          ln.bulk && ln.bulk.sent ? 'แจ้งแอดมิน Bulk ' + ln.bulk.sent + ' คน' : '', x.bulk && x.bulk.id ? 'ลงหน้าจัดรถ Bulk แล้ว' : '⚠️ ยังไม่ลงหน้าจัดรถ Bulk'].filter(Boolean).join(' · ');
        HB.edit = ''; T(msg);
      } else if (act === 'no' || act === 'cx') {
        const why = await ask({ icon: act === 'no' ? '⛔' : '❌', title: act === 'no' ? 'ตอบว่าไม่มีรถ — ' + (r ? r.company : '') : 'ยกเลิกรถ PK — ' + (r ? r.company : ''), ok: act === 'no' ? 'ส่งกลับ Order Hub' : 'ยกเลิกรถ', cancel: 'ไม่ใช่', danger: 1,
          input: { placeholder: 'เหตุผล (ขึ้นที่ Order Hub + แจ้งแอดมิน Bulk)', required: true },
          html: act === 'cx' ? '<p>ยกเลิกเที่ยวในหน้าจัดรถ Bulk และแจ้งคนขับ ' + E(r && r.driver_name) + ' ทางไลน์</p>' : '' });
        if (!why) return;
        const reason = String(why).trim();
        if (!reason) { T('ใส่เหตุผลก่อน'); return; }
        HB.busy = id; draw();
        await post({ action: act === 'no' ? 'reject' : 'cancel', id, reason });
        T(act === 'no' ? 'ส่งกลับ Order Hub แล้ว · แจ้งแอดมิน Bulk' : 'ยกเลิกรถแล้ว · แจ้งคนขับ + แอดมิน Bulk');
      } else if (act === 're') {
        HB.busy = id; draw();
        await post({ action: 'reopen', id }); T('คืนเป็นรอจัดรถแล้ว');
      }
    } catch (err) { T('❌ ' + (err.message || err)); }
    finally { HB.busy = ''; badge(); draw(); }
  }
  // รอหน้าหลักผ่านด่าน LINE/PIN และโหลด boot เสร็จ (window.__D) ก่อน
  let tries = 0;
  const wait = setInterval(() => { tries++; if (window.__D && uid()) { clearInterval(wait); boot(); } else if (tries > 600) clearInterval(wait); }, 500);
})();
