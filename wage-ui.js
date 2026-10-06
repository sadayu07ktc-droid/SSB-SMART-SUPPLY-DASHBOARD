/* wage-ui.js — กล่องยืนยัน / กรอกข้อความ / แจ้งเตือน แบบเดียวกับธีมหน้า (แทน confirm/prompt/alert ของเบราว์เซอร์)
 *   await uiConfirm({title, msg, okText, cancelText, icon, danger}) → true/false
 *   await uiPrompt({title, msg, value, placeholder, okText})         → ข้อความ / null (ยกเลิก)
 *   await uiAlert(msg, {title, icon})                                → ปิดแล้วไปต่อ
 *   uiProfile({name, picture, uid, status}) — ปุ่มโปรไฟล์ + ออกจากระบบ มุมขวาบน (.bar) · ดูท้ายไฟล์
 *   toast(msg)  (ถ้าหน้ายังไม่มี) — แถบแจ้งสั้นๆ หายเอง · ✅=สำเร็จ ❌=ผิดพลาด ⚠️=เตือน
 * ใช้ตัวแปรสีของหน้า (--card --txt --txt2 --line --primary --danger) · ปุ่ม Esc = ยกเลิก · Enter = ตกลง · แตะพื้นหลัง = ยกเลิก */
(function () {
  var css = '.uim-ov{position:fixed;inset:0;z-index:200;background:rgba(10,20,15,.45);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .16s}'
    + '.uim-ov.on{opacity:1}'
    + '.uim{width:100%;max-width:400px;background:var(--card,#fff);color:var(--txt,#1a2530);border:1px solid var(--line,#e2e6ea);border-radius:18px;box-shadow:0 22px 60px rgba(0,0,0,.3);padding:20px 20px 16px;transform:translateY(8px) scale(.98);transition:transform .16s}'
    + '.uim-ov.on .uim{transform:none}'
    + '.uim-ic{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--card2,#f6f8fa);margin-bottom:10px}'
    + '.uim-ic.danger{background:rgba(200,53,47,.12)}'
    + '.uim h3{margin:0 0 6px;font-size:16px;font-weight:800;line-height:1.4}'
    + '.uim p{margin:0;font-size:13.5px;color:var(--txt2,#6b7785);line-height:1.6;white-space:pre-line}'
    + '.uim input{width:100%;box-sizing:border-box;margin-top:12px;padding:10px 12px;border:1px solid var(--line2,#cfd5db);border-radius:10px;background:var(--card2,#f6f8fa);color:var(--txt,#1a2530);font:inherit;font-size:14px}'
    + '.uim input::placeholder{color:var(--txt2,#6b7785);opacity:.7}'
    + '.uim input:focus{outline:2px solid var(--primary,#1f8a52);outline-offset:1px}'
    + '.uim-f{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}'
    + '.uim-b{border:0;border-radius:10px;padding:9px 18px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer}'
    + '.uim-b.ok{background:var(--primary,#1f8a52);color:#fff}.uim-b.ok.danger{background:var(--danger,#c8352f)}'
    + '.uim-b.no{background:transparent;color:var(--txt2,#6b7785);border:1px solid var(--line2,#cfd5db);font-weight:600}'
    + '.uim-b:focus-visible{outline:2px solid var(--primary,#1f8a52);outline-offset:2px}'
    + '.uit{position:fixed;left:50%;top:16px;transform:translate(-50%,-12px);z-index:210;max-width:calc(100vw - 32px);background:var(--txt,#1a2530);color:var(--card,#fff);padding:10px 18px;border-radius:999px;font-size:13.5px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.25);opacity:0;transition:.2s;pointer-events:none}'
    + '.uit.on{opacity:1;transform:translate(-50%,0)}.uit.ok{background:var(--primary,#1f8a52);color:#fff}.uit.err{background:var(--danger,#c8352f);color:#fff}'
    + '@media(prefers-reduced-motion:reduce){.uim-ov,.uim,.uit{transition:none}}';
  function addCss() { if (document.getElementById('uimCss')) return; var s = document.createElement('style'); s.id = 'uimCss'; s.textContent = css; document.head.appendChild(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function open(o) {
    addCss();
    return new Promise(function (resolve) {
      var last = document.activeElement, ov = document.createElement('div');
      ov.className = 'uim-ov';
      ov.innerHTML = '<div class="uim" role="' + (o.kind === 'alert' ? 'alertdialog' : 'dialog') + '" aria-modal="true" aria-labelledby="uimT" aria-describedby="uimM">'
        + (o.icon ? '<div class="uim-ic' + (o.danger ? ' danger' : '') + '" aria-hidden="true">' + o.icon + '</div>' : '')
        + '<h3 id="uimT">' + esc(o.title || '') + '</h3>'
        + (o.msg ? '<p id="uimM">' + esc(o.msg) + '</p>' : '')
        + (o.kind === 'prompt' ? '<input id="uimIn" type="text" value="' + esc(o.value || '') + '" placeholder="' + esc(o.placeholder || '') + '" aria-label="' + esc(o.title || '') + '">' : '')
        + '<div class="uim-f">' + (o.kind === 'alert' ? '' : '<button class="uim-b no" data-r="0">' + esc(o.cancelText || 'ยกเลิก') + '</button>')
        + '<button class="uim-b ok' + (o.danger ? ' danger' : '') + '" data-r="1">' + esc(o.okText || 'ตกลง') + '</button></div></div>';
      document.body.appendChild(ov);
      setTimeout(function () { ov.classList.add('on'); }, 10);   // ไม่ใช้ rAF — แท็บพื้นหลัง/WebView บางตัวไม่ยิง ทำให้กล่องจางค้าง
      var inp = ov.querySelector('#uimIn');
      setTimeout(function () { if (inp) { inp.focus(); inp.select(); } else ov.querySelector('.uim-b.ok').focus(); }, 30);
      function done(ok) {
        document.removeEventListener('keydown', key, true);
        var val = o.kind === 'prompt' ? (ok ? inp.value : null) : (o.kind === 'alert' ? undefined : !!ok);
        ov.classList.remove('on'); setTimeout(function () { ov.remove(); }, 170);
        if (last && last.focus) try { last.focus(); } catch (e) {}
        resolve(val);
      }
      function key(e) {
        if (e.key === 'Escape') { e.preventDefault(); done(o.kind === 'alert'); }
        else if (e.key === 'Enter' && (inp ? document.activeElement === inp : true) && document.activeElement.dataset.r !== '0') { e.preventDefault(); done(true); }
        else if (e.key === 'Tab') {   // วนโฟกัสอยู่ในกล่อง
          var f = [].slice.call(ov.querySelectorAll('input,button')), i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      }
      document.addEventListener('keydown', key, true);
      ov.addEventListener('click', function (e) { var b = e.target.closest('[data-r]'); if (b) return done(b.dataset.r === '1'); if (e.target === ov) done(o.kind === 'alert'); });
    });
  }
  window.uiConfirm = function (o) { o = o || {}; return open({ kind: 'confirm', title: o.title || 'ยืนยัน', msg: o.msg, okText: o.okText, cancelText: o.cancelText, icon: o.icon || (o.danger ? '🗑️' : '❓'), danger: o.danger }); };
  window.uiPrompt = function (o) { o = o || {}; return open({ kind: 'prompt', title: o.title || 'กรอกข้อมูล', msg: o.msg, value: o.value, placeholder: o.placeholder, okText: o.okText || 'บันทึก', icon: o.icon || '✏️' }); };
  window.uiAlert = function (msg, o) {
    o = o || {}; var s = String(msg || ''), bad = /^❌|ไม่สำเร็จ|ผิดพลาด/.test(s), warn = /^⚠️/.test(s);
    var icon = o.icon || (bad ? '❌' : warn ? '⚠️' : /^✅/.test(s) ? '✅' : 'ℹ️');
    var body = s.replace(/^(❌|⚠️|✅|ℹ️)\s*/, ''), title = o.title || (bad ? 'ทำไม่สำเร็จ' : warn ? 'โปรดตรวจสอบ' : 'แจ้งเตือน');
    return open({ kind: 'alert', title: title, msg: body, okText: o.okText || 'ตกลง', icon: icon, danger: bad });
  };
  if (typeof window.toast !== 'function') {
    var tm = null;
    window.toast = function (msg) {
      addCss(); var t = document.getElementById('uit'); if (!t) { t = document.createElement('div'); t.id = 'uit'; t.className = 'uit'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
      var s = String(msg || ''); t.textContent = s; t.className = 'uit' + (/^❌|ไม่สำเร็จ/.test(s) ? ' err' : /^✅/.test(s) ? ' ok' : '');
      setTimeout(function () { t.classList.add('on'); }, 10); clearTimeout(tm); tm = setTimeout(function () { t.classList.remove('on'); }, 2600);
    };
  }
})();

/* ── 👤 ปุ่มโปรไฟล์ + ออกจากระบบ (มุมขวาบนของ .bar) ──────────────────────────────
 *   uiProfile({name, picture, uid, status})  → วาด/อัปเดตชิป · status: 'admin' | 'denied' | 'checking' | 'guest'(ยังไม่ login)
 *   uiProfile.set({status:'denied'})        → อัปเดตบางค่า
 *   ออกจากระบบ: liff.logout() แล้วโหลดหน้าใหม่ (ตัด ?uid= ออก) → LINE ให้เลือกบัญชีใหม่
 *   เปิดในแอป LINE = ออกจากระบบไม่ได้ (ผูกกับบัญชี LINE ในเครื่อง) → บอกให้เปิดในเบราว์เซอร์ */
(function () {
  var P = { name: '', picture: '', uid: '', status: 'checking' };
  var css = '.upf{position:relative;margin-left:auto;flex:none}'
    + '.upf-chip{display:flex;align-items:center;gap:8px;border:1px solid var(--line2,#cfd5db);background:var(--card,#fff);color:var(--txt,#1a2530);border-radius:999px;padding:4px 12px 4px 4px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;max-width:220px}'
    + '.upf-chip:hover{border-color:var(--primary,#1f8a52)}.upf-chip:focus-visible{outline:2px solid var(--primary,#1f8a52);outline-offset:2px}'
    + '.upf-av{width:30px;height:30px;border-radius:50%;object-fit:cover;flex:none;background:var(--primary,#1f8a52);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}'
    + '.upf-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.upf-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--txt2,#6b7785)}.upf-dot.admin{background:var(--primary,#1f8a52)}.upf-dot.denied{background:var(--danger,#c8352f)}'
    + '.upf-pop{position:absolute;right:0;top:calc(100% + 8px);z-index:150;width:280px;max-width:calc(100vw - 24px);background:var(--card,#fff);color:var(--txt,#1a2530);border:1px solid var(--line2,#cfd5db);border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.22);padding:14px}'
    + '.upf-pop[hidden]{display:none}'
    + '.upf-hd{display:flex;align-items:center;gap:10px;margin-bottom:10px}.upf-hd .upf-av{width:44px;height:44px;font-size:18px}'
    + '.upf-hd b{display:block;font-size:14.5px;line-height:1.3}'
    + '.upf-tag{display:inline-block;margin-top:3px;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;background:var(--card2,#f6f8fa);color:var(--txt2,#6b7785)}'
    + '.upf-tag.admin{background:rgba(31,138,82,.13);color:var(--primary,#1f8a52)}.upf-tag.denied{background:rgba(200,53,47,.12);color:var(--danger,#c8352f)}'
    + '.upf-uid{display:flex;align-items:center;gap:6px;background:var(--card2,#f6f8fa);border-radius:9px;padding:7px 9px;font-size:11.5px;color:var(--txt2,#6b7785);margin-bottom:10px}'
    + '.upf-uid code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;font-family:Consolas,monospace;color:var(--txt,#1a2530)}'
    + '.upf-note{font-size:11.5px;color:var(--txt2,#6b7785);line-height:1.55;margin:0 0 10px}'
    + '.upf-b{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--txt,#1a2530);font:inherit;font-size:13.5px;font-weight:600;padding:9px 10px;border-radius:9px;cursor:pointer}'
    + '.upf-b:hover,.upf-b:focus-visible{background:var(--card2,#f6f8fa);outline:none}.upf-b.out{color:var(--danger,#c8352f)}'
    + '.upf-sm{border:1px solid var(--line2,#cfd5db);background:var(--card,#fff);color:var(--txt,#1a2530);border-radius:7px;padding:3px 8px;font:inherit;font-size:11px;cursor:pointer;flex:none}'
    + '@media(max-width:560px){.upf-nm{display:none}.upf-chip{padding:4px}}';
  function addCss() { if (document.getElementById('upfCss')) return; var s = document.createElement('style'); s.id = 'upfCss'; s.textContent = css; document.head.appendChild(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function av(cls) { var n = (P.name || '?').trim(); return P.picture ? '<img class="upf-av ' + (cls || '') + '" src="' + esc(P.picture) + '" alt="" referrerpolicy="no-referrer">' : '<span class="upf-av ' + (cls || '') + '" aria-hidden="true">' + esc(n.charAt(0) || '?') + '</span>'; }
  var TAG = { admin: 'แอดมิน', denied: 'ไม่มีสิทธิ์แอดมิน', checking: 'กำลังตรวจสิทธิ์…', guest: 'ยังไม่เข้าสู่ระบบ' };
  function inLine() { try { return !!(window.liff && liff.isInClient && liff.isInClient()); } catch (e) { return false; } }
  function draw() {
    addCss();
    var bar = document.querySelector('.bar'); if (!bar) return;
    var box = document.getElementById('upf');
    if (!box) { box = document.createElement('div'); box.id = 'upf'; box.className = 'upf'; bar.appendChild(box); }
    var open = !!(box.querySelector('.upf-pop') && !box.querySelector('.upf-pop').hidden);
    if (P.status === 'guest') {
      box.innerHTML = '<button class="upf-chip" id="upfLogin" type="button"><span class="upf-av" aria-hidden="true">👤</span><span class="upf-nm">เข้าสู่ระบบ LINE</span></button>';
      box.querySelector('#upfLogin').onclick = function () { try { liff.login({ redirectUri: location.href }); } catch (e) { (window.uiAlert || alert)('เข้าสู่ระบบไม่ได้: ' + e); } };
      return;
    }
    var deniedNote = P.status === 'denied' ? '<p class="upf-note">บัญชีนี้ยังไม่ได้เป็นแอดมิน — คัดลอก UID ส่งให้แอดมินเพิ่มสิทธิ์ หรือออกจากระบบแล้วเข้าด้วยบัญชีแอดมิน</p>' : '';
    var lineNote = inLine() ? '<p class="upf-note">เปิดอยู่ในแอป LINE — ใช้บัญชี LINE ของเครื่องนี้เสมอ ถ้าจะสลับบัญชี ให้เปิดลิงก์นี้ในเบราว์เซอร์</p>' : '';
    box.innerHTML = '<button class="upf-chip" id="upfBtn" type="button" aria-haspopup="dialog" aria-expanded="' + open + '" title="โปรไฟล์ · ' + esc(P.name) + '">' + av() + '<span class="upf-nm">' + esc(P.name || 'บัญชี LINE') + '</span><span class="upf-dot ' + P.status + '" aria-hidden="true"></span></button>'
      + '<div class="upf-pop" id="upfPop" role="dialog" aria-label="โปรไฟล์"' + (open ? '' : ' hidden') + '>'
      + '<div class="upf-hd">' + av() + '<div><b>' + esc(P.name || 'บัญชี LINE') + '</b><span class="upf-tag ' + P.status + '">' + (TAG[P.status] || '') + '</span></div></div>'
      + (P.uid ? '<div class="upf-uid">UID <code title="' + esc(P.uid) + '">' + esc(P.uid) + '</code><button class="upf-sm" id="upfCopy" type="button">คัดลอก</button></div>' : '')
      + deniedNote + lineNote
      + (inLine() ? '' : '<button class="upf-b out" id="upfOut" type="button">↪ ออกจากระบบ</button>')
      + '</div>';
    var btn = box.querySelector('#upfBtn'), pop = box.querySelector('#upfPop');
    btn.onclick = function (e) { e.stopPropagation(); pop.hidden = !pop.hidden; btn.setAttribute('aria-expanded', String(!pop.hidden)); };
    var cp = box.querySelector('#upfCopy');
    if (cp) cp.onclick = function () {
      var done = function () { cp.textContent = 'คัดลอกแล้ว ✓'; setTimeout(function () { cp.textContent = 'คัดลอก'; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(P.uid).then(done, function () { window.prompt && prompt('คัดลอก UID', P.uid); });
      else { var ta = document.createElement('textarea'); ta.value = P.uid; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
    };
    var out = box.querySelector('#upfOut');
    if (out) out.onclick = async function () {
      var ok = window.uiConfirm ? await uiConfirm({ title: 'ออกจากระบบ?', msg: 'ออกจากบัญชี LINE "' + (P.name || '') + '" ในเบราว์เซอร์นี้\nเข้าใหม่ได้ด้วยบัญชีอื่น', okText: 'ออกจากระบบ', icon: '↪', danger: true }) : confirm('ออกจากระบบ?');
      if (!ok) return;
      try { if (window.liff && liff.isLoggedIn && liff.isLoggedIn()) liff.logout(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      var u = new URL(location.href); u.searchParams.delete('uid'); u.searchParams.set('t', Date.now());   // ตัด ?uid= ที่ใส่มาเอง + กันแคช
      location.replace(u.toString());
    };
  }
  document.addEventListener('click', function (e) { var p = document.getElementById('upfPop'); if (p && !p.hidden && !e.target.closest('#upf')) { p.hidden = true; var b = document.getElementById('upfBtn'); if (b) b.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var p = document.getElementById('upfPop'); if (p && !p.hidden) { p.hidden = true; var b = document.getElementById('upfBtn'); if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); } } } });
  window.uiProfile = function (o) { Object.keys(o || {}).forEach(function (k) { if (o[k] != null) P[k] = o[k]; }); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', draw, { once: true }); else draw(); };
  window.uiProfile.set = window.uiProfile;
})();
