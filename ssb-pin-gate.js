/* ssb-pin-gate.js — ใส่ PIN ก่อนเข้าดูหน้าตั้งค่าต้นทุน (wage-settings / cost-base / central-distance) · 2026-10-09
 *   ใช้:  if (await ssbPinGate(MY_UID)) load();
 *   เข้าได้เฉพาะ DEV (app_config ADMIN_PERM_EDITORS) + PIN 6 หลักชุดเดียวกับหน้า "สิทธิ์แอดมิน" (admins.html)
 *   ตรวจ PIN จริงที่ Edge admin-perms (pinCheck · ผิด 5 ครั้ง = ล็อก 15 นาที) — หน้าเว็บไม่เก็บ PIN
 *   ผ่านแล้วจำในแท็บนี้ 15 นาที (sessionStorage · ใช้ต่อเนื่องจะต่อเวลาเอง) → สลับ 3 หน้านี้ไม่ต้องใส่ซ้ำ
 *   ⚠️ ล็อกระดับหน้าจอ: หน้าไม่โหลดข้อมูลจนกว่าจะผ่าน (API ข้อมูลยังเช็คแค่ว่าเป็นแอดมิน)
 */
(function () {
  var EDGE = 'https://abihhdjcrbvwlkzwvjio.supabase.co/functions/v1/admin-perms';
  var KEY = 'ssb_pin_gate_v1', TTL = 15 * 60 * 1000;
  var DASH = 'https://sadayu07ktc-droid.github.io/SSB-SMART-SUPPLY-DASHBOARD/';

  function remembered(uid) {
    try { var s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return !!(s && s.uid === uid && s.until > Date.now()); } catch (e) { return false; }
  }
  function remember(uid) { try { sessionStorage.setItem(KEY, JSON.stringify({ uid: uid, until: Date.now() + TTL })); } catch (e) {} }

  function css() {
    if (document.getElementById('pg-css')) return;
    var st = document.createElement('style'); st.id = 'pg-css';
    st.textContent =
      ':root{--pg-bg:#eef3ef;--pg-card:#fff;--pg-ink:#1b2a22;--pg-mut:#66756c;--pg-line:#d6e0d9;--pg-acc:#1B4332;--pg-gold:#C9A227;--pg-err:#c8352f}' +
      '@media(prefers-color-scheme:dark){:root{--pg-bg:#0e1612;--pg-card:#16211b;--pg-ink:#e4ece7;--pg-mut:#94a59a;--pg-line:#2a3a31;--pg-acc:#3f9a6d;--pg-gold:#d9b54a;--pg-err:#ef6f68}}' +
      '#pg-wrap{position:fixed;inset:0;z-index:99999;background:var(--pg-bg);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,"Segoe UI","Noto Sans Thai",sans-serif}' +
      '#pg-box{width:100%;max-width:340px;background:var(--pg-card);border:1px solid var(--pg-line);border-top:4px solid var(--pg-gold);border-radius:16px;padding:24px 20px 20px;text-align:center;box-shadow:0 10px 30px -18px rgba(0,0,0,.4)}' +
      '#pg-box .ic{font-size:34px;line-height:1}#pg-box h2{margin:10px 0 4px;font-size:18px;color:var(--pg-ink)}' +
      '#pg-box p{margin:0 0 16px;font-size:13px;color:var(--pg-mut);line-height:1.6}' +
      '#pg-pin{width:100%;box-sizing:border-box;text-align:center;font-size:26px;letter-spacing:10px;padding:10px 8px;border:1.5px solid var(--pg-line);border-radius:12px;background:transparent;color:var(--pg-ink);outline:none;font-variant-numeric:tabular-nums}' +
      '#pg-pin:focus{border-color:var(--pg-acc)}#pg-pin::placeholder{letter-spacing:6px;color:var(--pg-mut);opacity:.5;font-size:20px}' +
      '#pg-err{min-height:20px;margin:8px 0 4px;font-size:13px;color:var(--pg-err)}' +
      '.pg-btn{display:block;width:100%;box-sizing:border-box;border:0;border-radius:12px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none;margin-top:8px;font-family:inherit}' +
      '.pg-ok{background:var(--pg-acc);color:#fff}.pg-ok:disabled{opacity:.6;cursor:default}' +
      '.pg-back{background:transparent;color:var(--pg-mut);border:1px solid var(--pg-line)}' +
      '.pg-btn:focus-visible,#pg-pin:focus-visible{outline:2px solid var(--pg-gold);outline-offset:2px}';
    document.head.appendChild(st);
  }
  function show(html) {
    css();
    var w = document.getElementById('pg-wrap');
    if (!w) { w = document.createElement('div'); w.id = 'pg-wrap'; document.body.appendChild(w); }
    w.innerHTML = '<div id="pg-box" role="dialog" aria-modal="true">' + html + '</div>';
    return w;
  }
  function back() { if (history.length > 1) history.back(); else location.href = DASH; }
  function msgBox(icon, title, text, extra) {
    var w = show('<div class="ic">' + icon + '</div><h2>' + title + '</h2><p>' + text + '</p>' + (extra || '') +
      '<button type="button" class="pg-btn pg-back" id="pg-back">‹ กลับ</button>');
    w.querySelector('#pg-back').onclick = back;
  }

  window.ssbPinGate = async function (uid) {
    uid = String(uid || '').trim();
    if (!uid) { msgBox('🔒', 'เข้าไม่ได้', 'ไม่พบบัญชี LINE'); return false; }
    if (remembered(uid)) { remember(uid); return true; }
    show('<div class="ic">🔐</div><h2>กำลังตรวจสิทธิ์</h2><p>รอสักครู่…</p>');
    var info = null;
    try { info = await fetch(EDGE + '?action=getPermInfo&userId=' + encodeURIComponent(uid)).then(function (r) { return r.json(); }); } catch (e) {}
    if (!info || !info.ok) { msgBox('⚠️', 'ตรวจสิทธิ์ไม่สำเร็จ', 'เชื่อมต่อไม่ได้ ลองเปิดหน้านี้ใหม่อีกครั้ง'); return false; }
    if (!info.canEdit) { msgBox('🔒', 'เฉพาะผู้ได้รับสิทธิ์', 'หน้านี้ดูได้เฉพาะ DEV ที่มี PIN<br>ถ้าต้องการข้อมูล กรุณาติดต่อผู้ดูแลระบบ'); return false; }
    if (!info.pinSet) {
      msgBox('🔐', 'ยังไม่ได้ตั้ง PIN', 'ตั้ง PIN 6 หลักที่หน้า "สิทธิ์แอดมิน" ก่อน แล้วกลับมาเปิดหน้านี้',
        '<a class="pg-btn pg-ok" href="' + DASH + 'admins.html">ไปตั้ง PIN</a>');
      return false;
    }
    return await new Promise(function (resolve) {
      var w = show('<div class="ic">🔐</div><h2>ใส่ PIN 6 หลัก</h2><p>หน้านี้มีข้อมูลต้นทุน/ค่าแรง<br>ใส่ PIN ชุดเดียวกับหน้าสิทธิ์แอดมิน</p>' +
        '<input id="pg-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••••" aria-label="PIN 6 หลัก">' +
        '<div id="pg-err" role="alert">' + (info.lockMin ? 'ใส่ PIN ผิดหลายครั้ง — ล็อกอีก ' + info.lockMin + ' นาที' : '') + '</div>' +
        '<button type="button" class="pg-btn pg-ok" id="pg-ok">ปลดล็อก</button>' +
        '<button type="button" class="pg-btn pg-back" id="pg-back">‹ กลับ</button>');
      var inp = w.querySelector('#pg-pin'), ok = w.querySelector('#pg-ok'), err = w.querySelector('#pg-err');
      w.querySelector('#pg-back').onclick = back;
      inp.addEventListener('input', function () { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); if (inp.value.length === 6) submit(); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      ok.onclick = submit;
      setTimeout(function () { try { inp.focus(); } catch (e) {} }, 50);
      var busy = false;
      async function submit() {
        if (busy) return;
        var pin = inp.value;
        if (!/^\d{6}$/.test(pin)) { err.textContent = 'กรุณาใส่ตัวเลข 6 หลัก'; return; }
        busy = true; ok.disabled = true; ok.textContent = 'กำลังตรวจ…'; err.textContent = '';
        var d = null;
        try {
          d = await fetch(EDGE, { method: 'POST', body: JSON.stringify({ action: 'pinCheck', userId: uid, pin: pin }) }).then(function (r) { return r.json(); });
        } catch (e) { d = { ok: false, error: 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง' }; }
        busy = false; ok.disabled = false; ok.textContent = 'ปลดล็อก';
        if (d && d.ok) { remember(uid); w.remove(); resolve(true); return; }
        inp.value = ''; err.textContent = (d && d.error) || 'PIN ไม่ถูกต้อง'; inp.focus();
      }
    });
  };
})();
