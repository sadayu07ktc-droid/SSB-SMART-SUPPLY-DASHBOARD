/* wage-ui.js — กล่องยืนยัน / กรอกข้อความ / แจ้งเตือน แบบเดียวกับธีมหน้า (แทน confirm/prompt/alert ของเบราว์เซอร์)
 *   await uiConfirm({title, msg, okText, cancelText, icon, danger}) → true/false
 *   await uiPrompt({title, msg, value, placeholder, okText})         → ข้อความ / null (ยกเลิก)
 *   await uiAlert(msg, {title, icon})                                → ปิดแล้วไปต่อ
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
