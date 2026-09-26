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

function showToast(msg, type = 'success') {
  const e = $('toast'); if (!e) return;
  e.hidden = false; e.textContent = (type === 'error' ? 'Error: ' : '') + msg; e.className = type === 'error' ? 'status-err' : '';
  clearTimeout(showToast.t); showToast.t = setTimeout(() => { e.hidden = true; }, 3200);
}
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

let supabase, accessToken, myRole, myId;

async function call(action, payload = {}) {
  const r = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action, payload }),
  });
  const data = await r.json().catch(() => ({}));
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
async function loadUsers() {
  const tbody = $('users-tbody');
  tbody.innerHTML = '<tr><td colspan="6">Memuat…</td></tr>';
  try {
    const { users } = await call('users.list');
    if (!users.length) { tbody.innerHTML = '<tr><td colspan="6">Belum ada user.</td></tr>'; return; }
    tbody.innerHTML = users.map(u => {
      const isMe = u.id === myId;
      const roleCell = (myRole === 'owner' && !isMe)
        ? `<select data-act="role" data-id="${u.id}">
             <option value="user"${u.role === 'user' ? ' selected' : ''}>User</option>
             <option value="admin"${u.role === 'admin' ? ' selected' : ''}>Admin</option>
             <option value="owner"${u.role === 'owner' ? ' selected' : ''}>Developer</option>
           </select>`
        : `<span class="badge badge-${u.role}">${roleLabel(u.role)}</span>`;
      const actions = isMe ? '<span style="color:var(--muted)">Ini kamu</span>' : `
        <button type="button" class="btn" data-act="ban" data-id="${u.id}" data-banned="${!u.banned}">${u.banned ? 'Unban' : 'Ban'}</button>
        ${myRole === 'owner' && u.role !== 'owner' ? `<button type="button" class="btn danger" data-act="delete" data-id="${u.id}">Hapus</button>` : ''}
      `;
      return `<tr>
        <td>${esc(u.username || '—')}</td>
        <td>${esc(u.display_name || '—')}</td>
        <td>${roleCell}</td>
        <td>${u.banned ? '<span class="badge badge-pending">Banned</span>' : (u.is_vip ? '<span class="badge badge-owner">VVIP</span>' : '<span class="badge badge-done">Aktif</span>')}</td>
        <td>${fmtDate(u.created_at)}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">${actions}</td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('[data-act="ban"]').forEach(b => b.onclick = async () => {
      const willBan = b.dataset.banned === 'true';
      if (!confirm(`Yakin ${willBan ? 'ban' : 'unban'} user ini?`)) return;
      try { await call('users.ban', { id: b.dataset.id, banned: willBan }); showToast('Berhasil diperbarui.'); loadUsers(); }
      catch (e) { showToast(e.message, 'error'); }
    });
    tbody.querySelectorAll('[data-act="delete"]').forEach(b => b.onclick = async () => {
      if (!confirm('Hapus user ini secara permanen? Tindakan ini tidak bisa dibatalkan.')) return;
      try { await call('users.delete', { id: b.dataset.id }); showToast('User dihapus.'); loadUsers(); }
      catch (e) { showToast(e.message, 'error'); }
    });
    tbody.querySelectorAll('[data-act="role"]').forEach(s => s.onchange = async () => {
      const prev = s.querySelector('option[selected]')?.value;
      if (!confirm(`Ubah role user ini jadi "${roleLabel(s.value)}"?`)) { s.value = prev; return; }
      try { await call('users.setRole', { id: s.dataset.id, role: s.value }); showToast('Role diperbarui.'); loadUsers(); }
      catch (e) { showToast(e.message, 'error'); loadUsers(); }
    });
  } catch (e) { tbody.innerHTML = `<tr><td colspan="6">Gagal memuat: ${esc(e.message)}</td></tr>`; }
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
      try { await call('tools.toggle', { slug, [key]: next }); showToast('Tool diperbarui.'); loadTools(); }
      catch (e) { showToast(e.message, 'error'); btn.disabled = false; }
    });
    tbody.querySelectorAll('[data-act="delete"]').forEach(b => b.onclick = async () => {
      if (!confirm('Hapus tool custom ini? Card-nya akan hilang dari dashboard user.')) return;
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
    const { reports } = await call('reports.list', { kind: kind || undefined, status: status || undefined });
    if (!reports.length) { tbody.innerHTML = '<tr><td colspan="5">Tidak ada data.</td></tr>'; return; }
    tbody.innerHTML = reports.map(r => `<tr>
        <td>${esc(r.username || '—')}</td>
        <td>${r.kind === 'bug' ? 'Bug' : 'Saran'}</td>
        <td style="max-width:320px;white-space:pre-wrap">${esc(r.message)}</td>
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
      if (!confirm('Hapus pengumuman ini?')) return;
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
  $('ann-overlay').hidden = false; $('ann-modal').hidden = false;
}
function closeAnnModal() { $('ann-overlay').hidden = true; $('ann-modal').hidden = true; }
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
      document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      $('sec-' + btn.dataset.section).classList.add('active');
      SECTION_LOADERS[btn.dataset.section]?.();
    };
  });
  $('ann-new').onclick = () => openAnnModal();
  $('ann-overlay').onclick = closeAnnModal;
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
  $('reports-filter-kind').onchange = loadReports;
  $('reports-filter-status').onchange = loadReports;
  $('tool-new').onclick = () => openToolModal();
  $('tool-overlay').onclick = closeToolModal;
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
  $('tool-overlay').hidden = false; $('tool-modal').hidden = false;
}
function closeToolModal() { $('tool-overlay').hidden = true; $('tool-modal').hidden = true; }
function toolMsg(text) { $('tool-msg').hidden = false; $('tool-msg').textContent = text; $('tool-msg').className = 'status-err'; }

/* ---------- Boot: the gate here is UX only — every action above is re-checked
   server-side against the caller's own profiles.role in api/admin.js, which
   is the actual security boundary. ---------- */
async function boot() {
  try {
    supabase = await loadSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { showGate('Belum Login', 'Login dulu di NexaKit Pro, lalu buka Admin Panel dari menu atas.'); return; }
    accessToken = session.access_token;
    myId = session.user.id;

    let stats;
    try { stats = await call('stats'); }
    catch (e) {
      if (e.status === 403) showGate('Akses Ditolak', 'Akun kamu tidak punya akses ke Admin Panel.');
      else if (e.status === 401) showGate('Sesi Berakhir', 'Silakan login ulang di NexaKit Pro.');
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
