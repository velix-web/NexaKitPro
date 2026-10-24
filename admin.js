import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const roleLabel = r => r === 'owner' ? 'Developer' : r === 'admin' ? 'Admin' : 'User';
const fmtDate = iso => { try { return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso || '—'; } };
// Explicit ✓/✕ pill instead of a bare <input type=checkbox> — the site-wide
// `input{width:100%;min-height:48px;...}` rule (meant for text fields)
// was stretching checkboxes into blank unstyled boxes with no visible
// checked state, so there was no way to tell on/off apart at a glance.
// A <button> sidesteps that rule entirely instead of fighting it with overrides.
function togglePill(key, slug, isOn, label) {
  return `<button type="button" class="toggle-pill ${isOn ? 'is-on' : 'is-off'}" data-toggle="${key}" data-slug="${esc(slug)}" data-val="${isOn}">`
    + `<i class="fa-solid ${isOn ? 'fa-check' : 'fa-xmark'}" aria-hidden="true"></i> ${esc(label)}</button>`;
}

function showToast(msg, type = 'success') { NG1UI.toast($('toast'), msg, type); }
const ask = o => NG1UI.confirm(o);
function showGate(title, msg) {
  $('admin-shell').hidden = true;
  $('admin-gate').hidden = false;
  $('admin-gate-title').textContent = title;
  $('admin-gate-msg').textContent = msg;
}

async function loadSupabase() {
  const r = await fetch('/api/supabase-config', { cache: 'no-store' });
  if (!r.ok) throw new Error('Supabase configuration unavailable');
  const cfg = await r.json();
  if (!cfg.url || !cfg.publishableKey) throw new Error('Supabase environment variables are missing');
  return createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
}

let supabase, myRole, myId;

// The access token is read fresh from the Supabase session on every call
// (the client auto-refreshes it). It used to be captured once at page load,
// so after the ~1h token lifetime every admin action silently failed with
// 401 until the page was reloaded.
async function call(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { showGate('Sesi Berakhir', 'Silakan login ulang di NextGen 1.'); throw Object.assign(new Error('Sesi berakhir.'), { status: 401 }); }
  let r;
  try {
    r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, payload }),
      signal: AbortSignal.timeout(20000),
    });
  } catch { throw new Error('Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.'); }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) showGate('Sesi Berakhir', 'Silakan login ulang di NextGen 1.');
  if (!r.ok) throw Object.assign(new Error(data.error || `Error ${r.status}`), { status: r.status });
  return data;
}

/* ---------- Dashboard ---------- */
async function loadDashboard() {
  try {
    const s = await call('stats');
    $('stat-users').textContent = s.totalUsers;
    $('stat-usage').textContent = s.totalUsage;
    $('stat-bugs').textContent = s.pendingBugs;
    $('stat-suggestions').textContent = s.pendingSuggestions;
  } catch (e) { showToast(e.message, 'error'); }
}

/* ---------- Users ---------- */
const usersState = { q: '', offset: 0 };

function userRow(u) {
  const isMe = u.id === myId;
  const privileged = u.role !== 'user';            // admin/owner already have VVIP through their role
  const roleCell = (myRole === 'owner' && !isMe)
    ? `<select data-act="role" data-id="${esc(u.id)}" data-prev="${esc(u.role)}" aria-label="Role ${esc(u.username)}">
         <option value="user"${u.role === 'user' ? ' selected' : ''}>User</option>
         <option value="admin"${u.role === 'admin' ? ' selected' : ''}>Admin</option>
         <option value="owner"${u.role === 'owner' ? ' selected' : ''}>Developer</option>
       </select>`
    : `<span class="badge badge-${esc(u.role)}">${roleLabel(u.role)}</span>`;
  // Only the Owner can change VVIP (enforced again server-side). Admin/Owner rows
  // show "Otomatis" instead of a toggle: a flag on them would do nothing.
  const vipCell = privileged
    ? '<span class="badge badge-admin" title="Akses VVIP otomatis lewat role">Otomatis</span>'
    : (myRole === 'owner'
        ? `<button type="button" class="toggle-pill ${u.is_vip ? 'is-on' : 'is-off'}" data-act="vip" data-id="${esc(u.id)}" data-vip="${!u.is_vip}" aria-label="${u.is_vip ? 'Cabut' : 'Beri'} VVIP untuk ${esc(u.username)}"><i class="fa ${u.is_vip ? 'fa-check' : 'fa-xmark'}" aria-hidden="true"></i> ${u.is_vip ? 'VVIP' : 'Biasa'}</button>`
        : (u.is_vip ? '<span class="badge badge-owner">VVIP</span>' : '<span class="badge badge-user">Biasa</span>'));
  // Same hierarchy as the server: admins moderate users, only an Owner touches an admin, nobody bans an Owner.
  const canBan = !isMe && u.role !== 'owner' && (myRole === 'owner' || u.role === 'user');
  const actions = isMe ? '<span class="muted">Ini kamu</span>' : `
    ${canBan ? `<button type="button" class="btn" data-act="ban" data-id="${esc(u.id)}" data-banned="${!u.banned}">${u.banned ? 'Unban' : 'Ban'}</button>` : ''}
    ${myRole === 'owner' && u.role !== 'owner' ? `<button type="button" class="btn danger" data-act="delete" data-id="${esc(u.id)}">Hapus</button>` : ''}`;
  return `<tr data-row="${esc(u.id)}">
    <td>${esc(u.username || '—')}</td>
    <td>${esc(u.display_name || '—')}</td>
    <td>${roleCell}</td>
    <td>${u.banned ? '<span class="badge badge-pending">Banned</span>' : '<span class="badge badge-done">Aktif</span>'}</td>
    <td>${vipCell}</td>
    <td>${fmtDate(u.created_at)}</td>
    <td><div class="row-actions">${actions}</div></td>
  </tr>`;
}

async function loadUsers({ append = false } = {}) {
  const tbody = $('users-tbody'), more = $('users-more');
  if (!append) { usersState.offset = 0; tbody.innerHTML = '<tr><td colspan="7">Memuat…</td></tr>'; more.hidden = true; }
  more.disabled = true;
  try {
    const { users, hasMore } = await call('users.list', { q: usersState.q || undefined, offset: usersState.offset });
    if (!append && !users.length) { tbody.innerHTML = `<tr><td colspan="7">${usersState.q ? 'Tidak ada user yang cocok.' : 'Belum ada user.'}</td></tr>`; return; }
    const html = users.map(userRow).join('');
    if (append) tbody.insertAdjacentHTML('beforeend', html); else tbody.innerHTML = html;
    usersState.offset += users.length;
    more.hidden = !hasMore;
  } catch (e) { if (!append) tbody.innerHTML = `<tr><td colspan="7">Gagal memuat: ${esc(e.message)} <button type="button" class="btn btn-sm" id="users-retry">Coba lagi</button></td></tr>`; else showToast(e.message, 'error'); }
  finally { more.disabled = false; }
}

// Re-render a single row from the server after an action (cheaper and less
// disruptive than reloading page 1 and losing the user's scroll/pagination).
async function refreshUserRow(id) {
  const row = $('users-tbody').querySelector(`tr[data-row="${CSS.escape(id)}"]`);
  try { const { user } = await call('users.detail', { id }); if (row) row.outerHTML = userRow(user); }
  catch { loadUsers(); }
}

// One delegated set of listeners (not re-bound on every render).
function initUsers() {
  const tbody = $('users-tbody');
  tbody.addEventListener('click', async ev => {
    if (ev.target.closest('#users-retry')) { loadUsers(); return; }
    const b = ev.target.closest('button[data-act]'); if (!b || b.disabled) return;
    const id = b.dataset.id;
    try {
      if (b.dataset.act === 'ban') {
        const willBan = b.dataset.banned === 'true';
        if (!await ask({ title: willBan ? 'Ban user ini?' : 'Unban user ini?', message: willBan ? 'User tidak akan bisa login atau memakai tool sampai di-unban.' : 'User akan bisa login dan memakai tool lagi.', confirmLabel: willBan ? 'Ya, ban' : 'Ya, unban', danger: willBan })) return;
        b.disabled = true; await call('users.ban', { id, banned: willBan }); showToast('Berhasil diperbarui.'); await refreshUserRow(id);
      } else if (b.dataset.act === 'delete') {
        if (!await ask({ title: 'Hapus user permanen?', message: 'Akun dan datanya dihapus selamanya. Tindakan ini tidak bisa dibatalkan.', confirmLabel: 'Hapus permanen', danger: true })) return;
        b.disabled = true; await call('users.delete', { id }); showToast('User dihapus.'); b.closest('tr')?.remove();
      } else if (b.dataset.act === 'vip') {
        const grant = b.dataset.vip === 'true';
        if (!await ask({ title: grant ? 'Jadikan VVIP?' : 'Cabut VVIP?', message: grant ? 'User ini langsung bisa memakai semua tool VVIP.' : 'User ini tidak bisa lagi memakai tool VVIP.', confirmLabel: grant ? 'Jadikan VVIP' : 'Cabut VVIP', danger: !grant })) return;
        b.disabled = true; await call('users.setVip', { id, vip: grant }); showToast(grant ? 'VVIP diberikan.' : 'VVIP dicabut.'); await refreshUserRow(id);
      }
    } catch (e) { showToast(e.message, 'error'); await refreshUserRow(id); }
  });
  tbody.addEventListener('change', async ev => {
    const s = ev.target.closest('select[data-act="role"]'); if (!s) return;
    const prev = s.dataset.prev;
    if (!await ask({ title: 'Ubah role?', message: `Role user ini akan menjadi "${roleLabel(s.value)}".`, confirmLabel: 'Ubah role', danger: s.value !== 'user' })) { s.value = prev; return; }
    try { await call('users.setRole', { id: s.dataset.id, role: s.value }); showToast('Role diperbarui.'); }
    catch (e) { showToast(e.message, 'error'); }
    await refreshUserRow(s.dataset.id);
  });
  $('users-search-form').addEventListener('submit', e => { e.preventDefault(); usersState.q = $('users-search').value.trim(); loadUsers(); });
  $('users-more').onclick = () => loadUsers({ append: true });
}

/* ---------- Tools ---------- */
async function loadTools() {
  const tbody = $('tools-tbody');
  tbody.innerHTML = '<tr><td colspan="5">Memuat…</td></tr>';
  try {
    const { tools } = await call('tools.list');
    if (!tools.length) { tbody.innerHTML = '<tr><td colspan="5">Belum ada tool.</td></tr>'; return; }
    tbody.innerHTML = tools.map(t => `<tr>
        <td>${esc(t.title)}${t.custom ? ' <span class="badge badge-admin">custom</span>' : ''}</td>
        <td>${togglePill('enabled', t.slug, t.enabled, t.enabled ? 'Aktif' : 'Nonaktif')}</td>
        <td>${togglePill('maintenance', t.slug, t.maintenance, t.maintenance ? 'Maintenance' : 'Normal')}</td>
        <td>${togglePill('vvipOnly', t.slug, t.vvipOnly, t.vvipOnly ? 'VVIP' : 'Semua')}</td>
        <td>${t.custom ? `<button type="button" class="btn danger" data-act="delete" data-id="${t.id}">Hapus</button>` : ''}</td>
      </tr>`).join('');
    tbody.querySelectorAll('button[data-toggle]').forEach(btn => btn.onclick = async () => {
      const key = btn.dataset.toggle, slug = btn.dataset.slug, next = btn.dataset.val !== 'true';
      btn.disabled = true;
      try { await call('tools.toggle', { slug, [key]: next }); showToast('Tool diperbarui.'); }
      catch (e) { showToast(e.message, 'error'); }
      loadTools(); // always resync with the server, success or not — never leave stale pills
    });
    tbody.querySelectorAll('[data-act="delete"]').forEach(b => b.onclick = async () => {
      if (!await ask({ title: 'Hapus tool custom?', message: 'Card-nya akan hilang dari dashboard semua user.', confirmLabel: 'Hapus tool', danger: true })) return;
      try { await call('tools.delete', { id: b.dataset.id }); showToast('Tool dihapus.'); loadTools(); }
      catch (e) { showToast(e.message, 'error'); }
    });
  } catch (e) { tbody.innerHTML = `<tr><td colspan="5">Gagal memuat: ${esc(e.message)}</td></tr>`; }
}

/* ---------- Reports ---------- */
async function loadReports() {
  const tbody = $('reports-tbody');
  tbody.innerHTML = '<tr><td colspan="5">Memuat…</td></tr>';
  const kind = $('reports-filter-kind').value, status = $('reports-filter-status').value;
  try {
    const { reports, hasMore } = await call('reports.list', { kind: kind || undefined, status: status || undefined });
    if (!reports.length) { tbody.innerHTML = '<tr><td colspan="5">Tidak ada data.</td></tr>'; $('reports-note').hidden = true; return; }
    $('reports-note').hidden = !hasMore;
    tbody.innerHTML = reports.map(r => `<tr>
        <td>${esc(r.username || '—')}</td>
        <td>${r.kind === 'bug' ? 'Bug' : 'Saran'}</td>
        <td class="cell-wrap">${esc(r.message)}</td>
        <td><select data-act="status" data-id="${r.id}">
          <option value="pending"${r.status === 'pending' ? ' selected' : ''}>Pending</option>
          <option value="reviewed"${r.status === 'reviewed' ? ' selected' : ''}>Reviewed</option>
          <option value="done"${r.status === 'done' ? ' selected' : ''}>Done</option>
        </select></td>
        <td>${fmtDate(r.created_at)}</td>
      </tr>`).join('');
    tbody.querySelectorAll('[data-act="status"]').forEach(s => s.onchange = async () => {
      try { await call('reports.setStatus', { id: s.dataset.id, status: s.value }); showToast('Status diperbarui.'); }
      catch (e) { showToast(e.message, 'error'); }
    });
  } catch (e) { tbody.innerHTML = `<tr><td colspan="5">Gagal memuat: ${esc(e.message)}</td></tr>`; }
}

/* ---------- Announcements ---------- */
async function loadAnnouncements() {
  const list = $('ann-list');
  list.innerHTML = '<p class="hint">Memuat…</p>';
  try {
    const { announcements } = await call('announcements.list');
    if (!announcements.length) { list.innerHTML = '<p class="hint">Belum ada pengumuman.</p>'; return; }
    list.innerHTML = announcements.map(a => `<div class="ann-card">
        <h3>${esc(a.title)} ${a.active ? '' : '<span class="badge badge-pending">Nonaktif</span>'}</h3>
        <p>${esc(a.body)}</p>
        <div class="row">
          <button type="button" class="btn" data-act="edit" data-id="${a.id}" data-title="${esc(a.title)}" data-body="${esc(a.body)}">Edit</button>
          <button type="button" class="btn" data-act="toggle" data-id="${a.id}" data-active="${!a.active}">${a.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
          <button type="button" class="btn danger" data-act="delete" data-id="${a.id}">Hapus</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('[data-act="edit"]').forEach(b => b.onclick = () => openAnnModal(b.dataset));
    list.querySelectorAll('[data-act="toggle"]').forEach(b => b.onclick = async () => {
      try { await call('announcements.toggle', { id: b.dataset.id, active: b.dataset.active === 'true' }); loadAnnouncements(); }
      catch (e) { showToast(e.message, 'error'); }
    });
    list.querySelectorAll('[data-act="delete"]').forEach(b => b.onclick = async () => {
      if (!await ask({ title: 'Hapus pengumuman?', message: 'Pengumuman ini akan hilang dari semua user.', confirmLabel: 'Hapus', danger: true })) return;
      try { await call('announcements.delete', { id: b.dataset.id }); loadAnnouncements(); }
      catch (e) { showToast(e.message, 'error'); }
    });
  } catch (e) { list.innerHTML = `<p class="hint">Gagal memuat: ${esc(e.message)}</p>`; }
}
function openAnnModal(data = {}) {
  $('ann-modal-title').textContent = data.id ? 'Edit Pengumuman' : 'Pengumuman Baru';
  $('ann-id').value = data.id || '';
  $('ann-title').value = data.title || '';
  $('ann-body').value = data.body || '';
  $('ann-msg').hidden = true;
  closeAnnFn = NG1UI.openModal($('ann-modal'), $('ann-overlay'), { initialFocus: '#ann-title' });
}
let closeAnnFn = null, closeToolFn = null;
function closeAnnModal() { if (closeAnnFn) closeAnnFn(); }
function annMsg(text) { $('ann-msg').hidden = false; $('ann-msg').textContent = text; $('ann-msg').className = 'status-err'; }

/* ---------- Logs ---------- */
async function loadLogs() {
  const tbody = $('logs-tbody');
  tbody.innerHTML = '<tr><td colspan="4">Memuat…</td></tr>';
  try {
    const { logs } = await call('logs.list');
    if (!logs.length) { tbody.innerHTML = '<tr><td colspan="4">Belum ada aktivitas.</td></tr>'; return; }
    tbody.innerHTML = logs.map(l => `<tr><td>${fmtDate(l.created_at)}</td><td>${esc(l.actor_username || '—')}</td><td>${esc(l.action)}</td><td>${esc(l.target || '—')}</td></tr>`).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="4">Gagal memuat: ${esc(e.message)}</td></tr>`; }
}

/* ---------- Nav ---------- */
const SECTION_LOADERS = { dashboard: loadDashboard, users: loadUsers, tools: loadTools, reports: loadReports, announcements: loadAnnouncements, logs: loadLogs, settings: () => {} };
function wireNav() {
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.admin-nav-btn').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
      btn.classList.add('active'); btn.setAttribute('aria-current', 'page');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      $('sec-' + btn.dataset.section).classList.add('active');
      SECTION_LOADERS[btn.dataset.section]?.();
    };
  });
  $('ann-new').onclick = () => openAnnModal();
  $('ann-close').onclick = closeAnnModal;
  $('ann-save').onclick = async () => {
    const id = $('ann-id').value, title = $('ann-title').value.trim(), body = $('ann-body').value.trim();
    if (!title || !body) { annMsg('Judul dan isi wajib diisi.'); return; }
    try {
      if (id) await call('announcements.update', { id, title, body });
      else await call('announcements.create', { title, body });
      closeAnnModal(); loadAnnouncements();
    } catch (e) { annMsg(e.message); }
  };
  initUsers();
  $('reports-filter-kind').onchange = loadReports;
  $('reports-filter-status').onchange = loadReports;
  $('tool-new').onclick = () => openToolModal();
  $('tool-close').onclick = closeToolModal;
  $('tool-save').onclick = async () => {
    const title = $('tool-title').value.trim();
    if (!title) { toolMsg('Judul wajib diisi.'); return; }
    const payload = {
      title, description: $('tool-desc').value.trim(), tag: $('tool-tag').value.trim(),
      icon: $('tool-icon').value, category: $('tool-category').value, type: $('tool-type').value,
      provider: $('tool-provider').value, paramKey: $('tool-paramkey').value.trim() || 'url',
    };
    try { await call('tools.create', payload); closeToolModal(); loadTools(); showToast('Tool baru dibuat.'); }
    catch (e) { toolMsg(e.message); }
  };
}
function openToolModal() {
  $('tool-title').value = ''; $('tool-desc').value = ''; $('tool-tag').value = ''; $('tool-paramkey').value = 'url';
  $('tool-msg').hidden = true;
  closeToolFn = NG1UI.openModal($('tool-modal'), $('tool-overlay'), { initialFocus: '#tool-title' });
}
function closeToolModal() { if (closeToolFn) closeToolFn(); }
function toolMsg(text) { $('tool-msg').hidden = false; $('tool-msg').textContent = text; $('tool-msg').className = 'status-err'; }

/* ---------- Boot: the gate here is UX only — every action above is re-checked
   server-side against the caller's own profiles.role in api/admin.js, which
   is the actual security boundary. ---------- */
async function boot() {
  try {
    supabase = await loadSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { showGate('Belum Login', 'Login dulu di NextGen 1, lalu buka Admin Panel dari menu atas.'); return; }
    myId = session.user.id;

    let stats;
    try { stats = await call('stats'); }
    catch (e) {
      if (e.status === 403) showGate('Akses Ditolak', 'Akun kamu tidak punya akses ke Admin Panel.');
      else if (e.status === 401) showGate('Sesi Berakhir', 'Silakan login ulang di NextGen 1.');
      else showGate('Gagal Memuat', e.message);
      return;
    }

    const { data: me } = await supabase.from('profiles').select('username,role').eq('id', myId).single();
    myRole = me?.role || 'user';
    $('admin-role-tag').textContent = roleLabel(myRole);
    $('settings-whoami').textContent = `${me?.username || '—'} (${roleLabel(myRole)})`;

    $('admin-gate').hidden = true;
    $('admin-shell').hidden = false;
    $('stat-users').textContent = stats.totalUsers;
    $('stat-usage').textContent = stats.totalUsage;
    $('stat-bugs').textContent = stats.pendingBugs;
    $('stat-suggestions').textContent = stats.pendingSuggestions;
    wireNav();
  } catch (e) {
    console.error(e);
    showGate('Terjadi Kesalahan', e.message || 'Gagal memuat admin panel.');
  }
}
boot();
