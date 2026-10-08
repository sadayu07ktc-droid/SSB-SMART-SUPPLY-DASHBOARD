/* ssb-ui.js — กล่องยืนยัน/ถาม/แจ้ง ของแดชบอร์ด แทน confirm()/prompt()/alert() ของเบราว์เซอร์ · 2026-10-08
 *   ใช้ดีไซน์เดียวกับ Modal หน้าเจ้าของสวน (หัวเขียวเข้ม + เส้นทอง) · สีมาจากตัวแปรธีมของแต่ละหน้า (มีค่าสำรอง)
 *
 *   if (!(await ssbConfirm({ title:'ลบออเดอร์?', msg:'กู้คืนไม่ได้', okText:'ลบ', danger:true }))) return;
 *   const why = await ssbPrompt({ title:'ยกเลิกออเดอร์', msg:'ระบุเหตุผล', placeholder:'ไม่ใส่ก็ได้' });   // null = กดยกเลิก
 *   await ssbAlert({ title:'ไม่มีข้อมูล', msg:'...' });
 *   msg ขึ้นบรรทัดใหม่ด้วย \n ได้ · Esc / แตะพื้นหลัง = ยกเลิก · Enter ในช่องพิมพ์ = ตกลง */
(function () {
  var css = '' +
    '.sui{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(9,22,17,.5);opacity:0;pointer-events:none;transition:opacity .18s}' +
    '.sui.on{opacity:1;pointer-events:auto}' +
    '.sui-card{width:420px;max-width:100%;max-height:86vh;display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#15241D);border:1px solid var(--line,#E1E7E0);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.3);transform:translateY(12px) scale(.98);transition:transform .2s cubic-bezier(.32,.72,0,1);overflow:hidden;font-family:inherit}' +
    '.sui.on .sui-card{transform:none}' +
    '.sui-head{display:flex;align-items:center;gap:10px;padding:14px 18px;background:var(--pine-deep,#0F2E22);color:#EAF3EF;border-bottom:3px solid var(--gold,#C9A227)}' +
    '.sui-head .ic{font-size:18px;flex:none}' +
    '.sui-head h3{font-size:15px;font-weight:700;flex:1;margin:0;line-height:1.35}' +
    '.sui-head.danger{background:#7A2620;border-bottom-color:#E0A39C}' +
    '.sui-msg{padding:14px 18px 4px;font-size:13.5px;color:var(--ink-soft,#5B6B63);line-height:1.55;white-space:pre-line}' +
    '.sui-msg:empty{display:none}' +
    '.sui-msg .warn{display:block;margin-top:10px;padding:9px 11px;border-radius:10px;background:#FBEED3;color:#7A5410;font-size:12.5px}' +
    '.sui-body{padding:8px 18px 4px}' +
    '.sui-body:empty{display:none}' +
    '.sui-input{width:100%;padding:11px 13px;border:1.5px solid var(--line-strong,#CDD6CD);border-radius:11px;font-size:14px;background:var(--surface-2,#F6F8F5);color:var(--ink,#15241D);font-family:inherit;box-sizing:border-box;resize:vertical;min-height:44px}' +
    '.sui-input::placeholder{color:var(--ink-faint,#8A988F);font-size:13px}' +
    '.sui-input:focus{outline:none;border-color:var(--pine,#1B4332)}' +
    '.sui-foot{display:flex;gap:9px;padding:14px 18px;margin-top:8px;border-top:1px solid var(--line,#E1E7E0)}' +
    '.sui-btn{flex:1;padding:11px;border-radius:11px;font-size:14px;font-weight:600;cursor:pointer;border:1px solid transparent;font-family:inherit;transition:background .12s}' +
    '.sui-btn:focus-visible{outline:2px solid var(--gold,#C9A227);outline-offset:2px}' +
    '.sui-btn.ghost{background:var(--surface-2,#F6F8F5);border-color:var(--line-strong,#CDD6CD);color:var(--ink-soft,#5B6B63)}' +
    '.sui-btn.ghost:hover{background:var(--surface-3,#EDF2ED)}' +
    '.sui-btn.go{background:var(--pine,#1B4332);color:#fff}' +
    '.sui-btn.go:hover{background:var(--pine-deep,#0F2E22)}' +
    '.sui-btn.danger{background:#C0392B;color:#fff}' +
    '.sui-btn.danger:hover{background:#A5352A}' +
    '@media (prefers-reduced-motion:reduce){.sui,.sui-card{transition:none}}';
  var el = null, resolveFn = null, lastFocus = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function build() {
    if (el) return el;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    el = document.createElement('div'); el.className = 'sui';
    el.innerHTML = '<div class="sui-card" role="dialog" aria-modal="true" aria-labelledby="suiTitle">' +
      '<div class="sui-head" id="suiHead"><span class="ic" id="suiIc"></span><h3 id="suiTitle"></h3></div>' +
      '<div class="sui-msg" id="suiMsg"></div><div class="sui-body" id="suiBody"></div>' +
      '<div class="sui-foot"><button type="button" class="sui-btn ghost" id="suiNo">ยกเลิก</button><button type="button" class="sui-btn go" id="suiOk">ตกลง</button></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) { if (e.target === el) close(null); });
    document.addEventListener('keydown', function (e) { if (el.classList.contains('on') && e.key === 'Escape') { e.preventDefault(); close(null); } });
    return el;
  }
  function close(v) {
    if (!el) return;
    el.classList.remove('on');
    var r = resolveFn; resolveFn = null;
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
    if (r) r(v);
  }
  function open(o, kind) {
    return new Promise(function (res) {
      if (resolveFn) resolveFn(kind === 'prompt' ? null : false);   // กล่องเก่าค้าง → ปิดเป็นยกเลิก
      build(); resolveFn = res; lastFocus = document.activeElement;
      var danger = !!o.danger;
      el.querySelector('#suiHead').className = 'sui-head' + (danger ? ' danger' : '');
      el.querySelector('#suiIc').textContent = o.icon || (danger ? '⚠️' : kind === 'prompt' ? '✏️' : kind === 'alert' ? 'ℹ️' : '❓');
      el.querySelector('#suiTitle').textContent = o.title || '';
      el.querySelector('#suiMsg').innerHTML = esc(o.msg || '') + (o.warn ? '<span class="warn">' + esc(o.warn) + '</span>' : '');
      var body = el.querySelector('#suiBody'), inp = null;
      body.innerHTML = '';
      if (kind === 'prompt') {
        inp = document.createElement(o.multiline ? 'textarea' : 'input');
        inp.className = 'sui-input'; inp.placeholder = o.placeholder || ''; inp.value = o.value || ''; inp.autocomplete = 'off';
        if (o.multiline) inp.rows = 3;
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !(o.multiline && e.shiftKey)) { e.preventDefault(); close(inp.value); } });
        body.appendChild(inp);
      }
      var ok = el.querySelector('#suiOk'), no = el.querySelector('#suiNo');
      ok.textContent = o.okText || (kind === 'alert' ? 'รับทราบ' : 'ยืนยัน');
      ok.className = 'sui-btn ' + (danger ? 'danger' : 'go');
      no.textContent = o.cancelText || 'ยกเลิก';
      no.style.display = kind === 'alert' ? 'none' : '';
      ok.onclick = function () { close(kind === 'prompt' ? inp.value : true); };
      no.onclick = function () { close(kind === 'prompt' ? null : false); };
      requestAnimationFrame(function () { el.classList.add('on'); setTimeout(function () { (inp || (danger ? no : ok)).focus(); }, 60); });
    });
  }
  window.ssbConfirm = function (o) { return open(o || {}, 'confirm').then(function (v) { return v === true; }); };
  window.ssbPrompt = function (o) { return open(o || {}, 'prompt'); };
  window.ssbAlert = function (o) { return open(o || {}, 'alert').then(function () {}); };
})();
