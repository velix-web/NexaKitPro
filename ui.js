/* NextGen 1 — shared UI helpers (classic script, exposes window.NG1UI).
   Loaded before app.js/auth.js/admin.js on both pages so every modal behaves
   the same: focus moves in, Tab stays inside, Escape closes, and focus goes
   back to whatever opened it. */
(function () {
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var stack = []; // open modals, topmost last

  function visibleFocusables(panel) {
    return Array.prototype.filter.call(panel.querySelectorAll(FOCUSABLE), function (el) {
      return !el.closest('[hidden]') && el.offsetParent !== null;
    });
  }

  function onKeydown(e) {
    var top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === 'Escape') { e.preventDefault(); top.close(); return; }
    if (e.key !== 'Tab') return;
    var f = visibleFocusables(top.panel);
    if (!f.length) { e.preventDefault(); top.panel.focus(); return; }
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === top.panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKeydown);

  // openModal(panel, overlay, {onClose, initialFocus}) -> close()
  function openModal(panel, overlay, opts) {
    opts = opts || {};
    var opener = document.activeElement;
    panel.setAttribute('role', panel.getAttribute('role') || 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.tabIndex = -1;
    if (overlay) overlay.hidden = false;
    panel.hidden = false;
    document.body.classList.add('modal-open');
    var closed = false;
    var entry = {
      panel: panel,
      close: function () {
        if (closed) return;
        closed = true;
        panel.hidden = true;
        if (overlay) overlay.hidden = true;
        stack = stack.filter(function (x) { return x !== entry; });
        if (!stack.length) document.body.classList.remove('modal-open');
        if (opener && opener.focus && document.contains(opener)) opener.focus();
        if (opts.onClose) opts.onClose();
      }
    };
    stack.push(entry);
    if (overlay) overlay.onclick = entry.close;
    var target = (opts.initialFocus && panel.querySelector(opts.initialFocus)) || visibleFocusables(panel)[0] || panel;
    setTimeout(function () { target.focus(); }, 0);
    return entry.close;
  }

  // confirm({title, message, confirmLabel, cancelLabel, danger}) -> Promise<boolean>
  // Replaces window.confirm so destructive actions are clearly styled and the
  // dialog is keyboard/screen-reader friendly.
  function confirmDialog(o) {
    o = o || {};
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      var panel = document.createElement('div');
      panel.className = 'modal-panel modal-confirm';
      panel.setAttribute('role', 'alertdialog');
      panel.setAttribute('aria-labelledby', 'ng1-confirm-title');
      panel.setAttribute('aria-describedby', 'ng1-confirm-msg');
      var h = document.createElement('h2'); h.id = 'ng1-confirm-title'; h.textContent = o.title || 'Konfirmasi';
      var p = document.createElement('p'); p.id = 'ng1-confirm-msg'; p.textContent = o.message || '';
      var row = document.createElement('div'); row.className = 'modal-actions';
      var no = document.createElement('button'); no.type = 'button'; no.className = 'btn'; no.textContent = o.cancelLabel || 'Batal';
      var yes = document.createElement('button'); yes.type = 'button'; yes.className = 'btn ' + (o.danger ? 'danger-solid' : 'primary'); yes.textContent = o.confirmLabel || 'Lanjutkan';
      row.appendChild(no); row.appendChild(yes);
      panel.appendChild(h); panel.appendChild(p); panel.appendChild(row);
      document.body.appendChild(overlay); document.body.appendChild(panel);
      var answer = false;
      var close = openModal(panel, overlay, {
        // Destructive confirms focus "Batal" first so Enter can't delete by accident.
        initialFocus: o.danger ? '.btn:not(.danger-solid)' : '.primary',
        onClose: function () { overlay.remove(); panel.remove(); resolve(answer); }
      });
      no.onclick = close;
      yes.onclick = function () { answer = true; close(); };
    });
  }

  // Toast on a caller-owned #toast element (role=status, polite live region).
  function toast(el, msg, type, ms) {
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.className = type === 'error' ? 'toast-error' : 'toast-ok';
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.hidden = true; }, ms || 3200);
  }

  window.NG1UI = { openModal: openModal, confirm: confirmDialog, toast: toast };
})();
