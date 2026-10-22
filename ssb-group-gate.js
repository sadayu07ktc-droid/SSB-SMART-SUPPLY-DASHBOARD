/* ssb-group-gate.js — หน้าเลือกกลุ่ม (ไร่ / Bulk / Packing) + PIN ส่วนตัวแอดมิน ก่อนเข้าเมนู · 2026-10-14
 *   ใช้:  const g = await ssbGroupGate(uid, { title:'ออเดอร์ทั้งหมด', key:'orders', name, picture });
 *         g = 'ไร่' | 'Bulk' | 'Packing' (ผ่าน PIN แล้ว) · null = ไม่ใช่แอดมิน/ออกจากหน้า
 *   ป้ายบนหัวหน้า (กดเพื่อเปลี่ยนกลุ่ม):  ssbGroupChip(el, g, function(){ ...เรียก ssbGroupGate ใหม่... })
 *   ต้องโหลด ssb-pin-gate.js ก่อน (ssbAdminPinInfo / ssbAdminPin)
 *   สิทธิ์ = admin-perms getPinInfo.groups: DEV ทุกกลุ่ม · ADMIN=ไร่ · ADMIN_BULK=Bulk · ADMIN_PK=Packing · MANAGER/EXECUTIVE=ทุกกลุ่ม
 *   opts.off = { Bulk:'ยังไม่เปิดใช้' } → การ์ดนั้นกดไม่ได้ (เช่น ฟอร์มที่ยังไม่มี)
 *   กลุ่มของออเดอร์: ssbOrderGroup(jobType) → Packing/Bulk/ไร่ (ปาล์ม = ไร่)
 */
(function () {
  var G = {
    'ไร่': { ic: '🌴', t: 'ไร่', d: 'งานรับปาล์ม · สวน/ลาน' },
    Bulk: { ic: '🏭', t: 'Bulk', d: 'งานกลุ่ม Bulk' },
    Packing: { ic: '📦', t: 'Packing', d: 'งานกลุ่ม Packing' }
  };
  var ORDER = ['ไร่', 'Bulk', 'Packing'];
  window.SSB_GROUPS = G;
  window.ssbOrderGroup = function (jobType) {
    var s = String(jobType || '');
    return /packing/i.test(s) ? 'Packing' : /bulk/i.test(s) ? 'Bulk' : 'ไร่';
  };
  var INFO = {};   // uid → getPinInfo (โหลดครั้งเดียวต่อหน้า)

  function css() {
    if (document.getElementById('gg-css')) return;
    var st = document.createElement('style'); st.id = 'gg-css';
    st.textContent =
      ':root{--gg-bg:#eef2ef;--gg-card:#fff;--gg-ink:#1b2a22;--gg-mut:#66756c;--gg-line:#dbe3dd;--gg-acc:#1B4332;--gg-acc2:#2D6A4F;--gg-tint:rgba(45,106,79,.1)}' +
      '@media(prefers-color-scheme:dark){:root{--gg-bg:#0e1612;--gg-card:#16211b;--gg-ink:#e4ece7;--gg-mut:#94a59a;--gg-line:#2a3a31;--gg-acc:#5fbf8c;--gg-acc2:#5fbf8c;--gg-tint:rgba(95,191,140,.14)}}' +
      '#gg-wrap{position:fixed;inset:0;z-index:99990;background:var(--gg-bg);overflow-y:auto;font-family:-apple-system,"Segoe UI","Noto Sans Thai","IBM Plex Sans Thai",sans-serif;color:var(--gg-ink)}' +
      '#gg-in{max-width:780px;margin:0 auto;padding:18px 16px 32px}' +
      '.gg-top{display:flex;align-items:center;gap:10px;margin-bottom:16px}' +
      '.gg-back{width:38px;height:38px;border-radius:10px;border:1px solid var(--gg-line);background:var(--gg-card);color:var(--gg-ink);font-size:18px;cursor:pointer;flex:none}' +
      '.gg-title{font-size:17px;font-weight:700;margin:0}.gg-sub2{font-size:12px;color:var(--gg-mut)}' +
      '.gg-hi{display:flex;align-items:center;gap:13px;margin:4px 2px 18px}' +
      '.gg-av{width:52px;height:52px;border-radius:50%;object-fit:cover;background:var(--gg-card);border:1px solid var(--gg-line);flex:none;display:flex;align-items:center;justify-content:center;font-size:22px}' +
      '.gg-hi h2{margin:0;font-size:18px;font-weight:700}.gg-hi p{margin:2px 0 0;font-size:13px;color:var(--gg-mut)}' +
      '.gg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}' +
      '.gg-c{position:relative;text-align:left;display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-height:168px;padding:20px 20px 18px;border:1px solid var(--gg-line);border-radius:16px;background:var(--gg-card);color:var(--gg-ink);font:inherit;cursor:pointer;box-shadow:0 1px 3px rgba(20,40,30,.05);transition:border-color .15s,box-shadow .15s,transform .1s}' +
      '.gg-c:hover{border-color:var(--gg-acc2)}.gg-c:active{transform:scale(.985)}' +
      '.gg-c:focus-visible{outline:2px solid var(--gg-acc2);outline-offset:2px}' +
      '.gg-c.last{border:1.5px solid var(--gg-acc2);box-shadow:0 0 0 3px var(--gg-tint)}' +
      '.gg-c.lock{cursor:not-allowed;opacity:.5;box-shadow:none}.gg-c.lock:hover{border-color:var(--gg-line)}' +
      '.gg-i{width:56px;height:56px;border-radius:14px;background:var(--gg-tint);display:flex;align-items:center;justify-content:center;font-size:27px;margin-bottom:8px}' +
      '.gg-c b{font-size:19px;font-weight:700}.gg-c small{font-size:13px;color:var(--gg-mut)}' +
      '.gg-c em{font-style:normal;font-size:12px;font-weight:700;color:var(--gg-acc2);margin-top:auto;padding-top:6px}' +
      '.gg-note{font-size:12px;color:var(--gg-mut);margin:16px 2px 0}.gg-msg{text-align:center;color:var(--gg-mut);padding:40px 16px;font-size:14px}' +
      '.gg-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--gg-acc2);background:var(--gg-card);color:var(--gg-acc2);border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}' +
      '.gg-chip span{font-weight:400;color:var(--gg-mut)}.gg-chip:focus-visible{outline:2px solid var(--gg-acc2);outline-offset:2px}';
    document.head.appendChild(st);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lastOf(key) { try { return localStorage.getItem('ssb_grp_' + key) || ''; } catch (e) { return ''; } }
  function setLast(key, g) { try { localStorage.setItem('ssb_grp_' + key, g); } catch (e) {} }
  function back() { if (history.length > 1) history.back(); else location.href = '/SSB-SMART-SUPPLY-DASHBOARD/'; }

  window.ssbGroupInfo = async function (uid) {
    uid = String(uid || '').trim();
    if (!INFO[uid]) INFO[uid] = await window.ssbAdminPinInfo(uid);
    return INFO[uid];
  };

  window.ssbGroupGate = async function (uid, opts) {
    opts = opts || {};
    css();
    var w = document.getElementById('gg-wrap');
    if (!w) { w = document.createElement('div'); w.id = 'gg-wrap'; document.body.appendChild(w); }
    w.hidden = false;
    var hi = opts.name ? 'สวัสดี ' + esc(opts.name) : 'เลือกกลุ่ม';
    var av = opts.picture ? '<img class="gg-av" alt="" src="' + esc(opts.picture) + '">' : '<div class="gg-av">👤</div>';
    w.innerHTML = '<div id="gg-in"><div class="gg-top"><button type="button" class="gg-back" id="gg-back" aria-label="กลับ">←</button>' +
      '<div><h1 class="gg-title">' + esc(opts.title || 'เลือกกลุ่ม') + '</h1><div class="gg-sub2">SSB Smart Supply</div></div></div>' +
      '<div class="gg-hi">' + av + '<div><h2>' + hi + '</h2><p>เลือกกลุ่มงานก่อนเข้าเมนู</p></div></div>' +
      '<div class="gg-grid" id="gg-grid"><div class="gg-msg">กำลังตรวจสิทธิ์…</div></div><p class="gg-note" id="gg-note"></p></div>';
    w.querySelector('#gg-back').onclick = back;
    var info = null;
    try { info = await window.ssbGroupInfo(uid); } catch (e) {}
    var grid = w.querySelector('#gg-grid');
    if (!info || !info.ok) { grid.innerHTML = '<div class="gg-msg">ตรวจสิทธิ์ไม่สำเร็จ — ลองเปิดหน้านี้ใหม่</div>'; return null; }
    if (!info.isAdmin) { grid.innerHTML = '<div class="gg-msg">🔒 เมนูนี้สำหรับแอดมินเท่านั้น</div>'; return null; }
    var allow = info.groups || [], off = opts.off || {}, last = lastOf(opts.key || 'x');
    return await new Promise(function (resolve) {
      grid.innerHTML = ORDER.map(function (k) {
        var g = G[k], ok = allow.indexOf(k) >= 0 && !off[k], isLast = ok && k === last;
        var sub = allow.indexOf(k) < 0 ? '🔒 ไม่มีสิทธิ์กลุ่มนี้' : off[k] ? '⏳ ' + esc(off[k]) : esc((opts.desc && opts.desc[k]) || g.d);
        return '<button type="button" class="gg-c' + (ok ? '' : ' lock') + (isLast ? ' last' : '') + '" data-g="' + k + '"' + (ok ? '' : ' disabled aria-disabled="true"') + '>' +
          '<span class="gg-i" aria-hidden="true">' + g.ic + '</span><b>' + g.t + '</b><small>' + sub + '</small>' + (isLast ? '<em>ใช้ล่าสุด</em>' : '') + '</button>';
      }).join('');
      w.querySelector('#gg-note').textContent = allow.length === 3 ? 'คุณเข้าได้ทุกกลุ่ม' : 'คุณเข้าได้เฉพาะกลุ่ม ' + allow.join(', ') + ' (ตามประเภทแอดมิน)';
      grid.onclick = async function (e) {
        var b = e.target.closest('.gg-c'); if (!b || b.disabled) return;
        var k = b.getAttribute('data-g');
        if (!(await window.ssbAdminPin(uid, { text: opts.title || '' }))) return;
        setLast(opts.key || 'x', k);
        w.hidden = true; w.innerHTML = '';
        resolve(k);
      };
    });
  };

  window.ssbGroupChip = function (el, g, onChange) {
    css();
    if (!el || !G[g]) return;
    el.innerHTML = '<button type="button" class="gg-chip" title="เปลี่ยนกลุ่ม">' + G[g].ic + ' ' + G[g].t + ' <span>· เปลี่ยน</span></button>';
    el.firstChild.onclick = function () { if (onChange) onChange(); };
  };
})();
