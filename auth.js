/* ============================================================
   AUTH + ROUTING — Supabase logic, unchanged behaviourally.
   ============================================================ */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const CONFIG_ENDPOINT = '/api/supabase-config';
const tools = TOOLS;
const render = window.NEXTGEN1_render;
const $q = id => document.getElementById(id);
const app = $q('app-shell'), auth = $q('auth-screen');
const dashboard = $q('dashboard-view'), workspace = $q('workspace-view');
const grid = $q('tool-grid'), tabs = $q('category-tabs');
const userName = $q('user-name');
const authForm = $q('auth-form'), authMode = $q('auth-mode'), authError = $q('auth-error');
const authSubmitButton = authForm.querySelector('button[type="submit"]');
const loginTab = document.querySelector('[data-mode="login"]');
const registerTab = document.querySelector('[data-mode="register"]');
const categories=[['all','All','th-large'],['downloader','Downloader','download'],['maker','Maker','magic'],
['tools','Tools','wrench'],['vault','Vault','archive'],['external','External','external-link'],['vvip','VVIP','crown']];
function cat(t){
 if(t._customCategory)return t._customCategory;
 if(['ff-stalk','ml-stalk','tiktok-stalk','instagram-stalk','github-stalk','nexadrama',
     'youtube-stalk','twitter-stalk','threads-stalk','snackvideo-stalk','roblox-stalk',
     'pinterest-stalk','genshin-stalk','komikindo'].includes(t.slug))return 'external';
 if(['shortlink','website-screenshot'].includes(t.slug))return 'tools';
 if(['terabox','savefrom'].includes(t.slug))return 'vault';
 if(['bypass-link','react-wa'].includes(t.slug))return 'external';
 if(['tiktok','instagram','spotify','youtube','facebook','twitter','capcut','lahelu'].includes(t.slug))return 'downloader';
 if(['brat','iqc','sertifikat-tolol','lobby-ml','lobby-ff','fakedana','fakedev',
     'fakebank-jago','fakegopay','fakeovo','ektp','afinitas','nulis','smeme','ustadz'].includes(t.slug))return 'maker';
 return 'tools';
}
const ICON_MOON='<i class="fa fa-moon-o" aria-hidden="true"></i>';
const ICON_SUN='<i class="fa fa-sun-o" aria-hidden="true"></i>';
function applyTheme(theme){
  document.documentElement.dataset.theme=theme;
  try{localStorage.setItem('nextgen1-theme',theme)}catch{}
  document.querySelectorAll('[data-theme-toggle]').forEach(b=>{
    b.setAttribute('aria-pressed',String(theme==='dark'));
    const icon=b.querySelector('.theme-toggle-icon');if(icon)icon.innerHTML=theme==='dark'?ICON_SUN:ICON_MOON;
  });
}
function initTheme(){
  applyTheme(document.documentElement.dataset.theme||'light'); // head script already set it; this just syncs the buttons
  document.querySelectorAll('[data-theme-toggle]').forEach(b=>b.onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
}
// DO NOT rename this domain as part of the NextGen 1 rebrand: it is the
// synthetic email every existing Supabase Auth account was created with, so
// changing it would make every existing user's login fail. It is never shown.
function usernameEmail(username){return `${username.toLowerCase()}@users.nexakitpro.local`}
function validUsername(u){return /^[a-zA-Z0-9._-]{3,24}$/.test(u)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function setMode(mode){
  authForm.dataset.mode=mode;
  authMode.textContent=mode==='login'?'Masuk':'Daftar';
  $q('auth-subtitle').textContent=mode==='login'?'Masuk untuk membuka semua tools NextGen 1.':'Buat akun NextGen 1 dengan username dan password.';
  $q('auth-password').autocomplete=mode==='login'?'current-password':'new-password';
  const confirmWrap=$q('auth-confirm-wrap');
  if(confirmWrap)confirmWrap.hidden=mode!=='register';
  const confirmPassword=$q('auth-confirm-password');
  if(confirmPassword&&mode!=='register')confirmPassword.value='';
  const consentWrap=$q('auth-consent-wrap');
  if(consentWrap)consentWrap.hidden=mode!=='register';
  const consentBox=$q('auth-consent');
  if(consentBox)consentBox.checked=false;
  authSubmitButton.textContent=mode==='login'?'Masuk':'Daftar';
  [loginTab,registerTab].forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  authError.textContent='';
}
function showAuth(){auth.hidden=false;app.hidden=true}
function showApp(u){window.nextgen1User=u;auth.hidden=true;app.hidden=false;userName.textContent=u;renderCards();const hashTool=toolFromHash(),savedTool=sessionStorage.getItem('nextgen1-active-tool');if(hashTool)openTool(hashTool.slug);else if(savedTool&&tools.some(t=>t.slug===savedTool))openTool(savedTool);else openDashboard();loadProfileIntoUI();loadAnnouncement()}
const ROLE_LABEL={user:'Member',admin:'Admin',owner:'Developer'};
async function loadProfileIntoUI(){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return;
  const {data,error}=await supabase.from('profiles').select('display_name,avatar_url,is_vip,role,banned').eq('id',user.id).single();
  if(error||!data)return;
  if(data.banned){
    // This is a UX nicety, not the real enforcement boundary — logging a
    // banned user out as soon as their profile reloads avoids a dead
    // session. The actual authorization is server-side: every tool API
    // route re-checks the caller's banned/role/VVIP status on every request
    // (see api/_auth.js), so a direct API call is rejected regardless of
    // what happens here.
    await logout();
    authError.textContent='Akun kamu telah dinonaktifkan oleh admin.';
    return;
  }
  const name=data.display_name||window.nextgen1User;
  window.nextgen1Role=data.role||'user';
  window.nextgen1EntitledToVvip=!!data.is_vip||data.role==='admin'||data.role==='owner';
  renderCards();
  userName.textContent=name;
  const displayRole=data.is_vip&&data.role!=='admin'&&data.role!=='owner'?'VVIP':(ROLE_LABEL[data.role]||'Member');
  const roleLabel=document.getElementById('role-label');
  if(roleLabel)roleLabel.textContent=displayRole;
  const statusRoleText=$q('status-role-text');if(statusRoleText)statusRoleText.textContent=displayRole;
  const statusRoleChip=$q('status-role-chip');
  if(statusRoleChip)statusRoleChip.classList.toggle('status-chip-vip',displayRole==='VVIP');
  const vvipBtn=$q('status-vvip-btn');
  if(vvipBtn){
    vvipBtn.classList.toggle('status-chip-vip',!!data.is_vip);
    $q('status-vvip-text').textContent=data.is_vip?'VVIP':'Upgrade VVIP';
    vvipBtn.onclick=()=>{
      const msg=data.is_vip?'Halo Admin NextGen 1, saya user VVIP, mau tanya-tanya.':'Halo Admin NextGen 1, saya mau upgrade ke VVIP. Gimana caranya?';
      window.open(`https://wa.me/6285722707676?text=${encodeURIComponent(msg)}`,'_blank','noopener');
    };
  }
  const adminLink=$q('admin-panel-link');
  if(adminLink)adminLink.hidden=!(data.role==='admin'||data.role==='owner');
  const initial=(name||'?').trim().charAt(0).toUpperCase()||'?';
  const prevFallback=document.getElementById('avatar-preview-fallback');
  if(prevFallback)prevFallback.textContent=initial;
  const statusFallback=$q('status-avatar-fallback');
  if(statusFallback)statusFallback.textContent=initial;
  if(data.avatar_url){
    const prevImg=document.getElementById('avatar-preview-img');
    if(prevImg){prevImg.src=data.avatar_url;prevImg.hidden=false;if(prevFallback)prevFallback.hidden=true}
    const statusImg=$q('status-avatar-img');
    if(statusImg){statusImg.src=data.avatar_url;statusImg.hidden=false;if(statusFallback)statusFallback.hidden=true}
  }
  const nameInput=document.getElementById('settings-name');
  if(nameInput)nameInput.value=name;
}
window.nextgen1Api={
  async updateProfile({display_name,avatar_url}){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)throw Error('Sesi kamu sudah habis, silakan login lagi.');
    const fallbackUsername=(user.user_metadata?.username||user.email?.split('@')[0]||'member').replace(/[^A-Za-z0-9._-]/g,'').slice(0,24)||'member';
    const patch={id:user.id,username:fallbackUsername};
    if(display_name!==undefined)patch.display_name=display_name;
    if(avatar_url!==undefined)patch.avatar_url=avatar_url;
    const {error}=await supabase.from('profiles').upsert(patch,{onConflict:'id'});
    if(error)throw Error(error.message||'Gagal menyimpan profil.');
  },
  async changePassword(newPassword){
    if(!newPassword||newPassword.length<6)throw Error('Password minimal 6 karakter.');
    const {error}=await supabase.auth.updateUser({password:newPassword});
    if(error)throw Error(error.message||'Gagal mengganti password.');
  },
  async submitFeedback({kind,message}){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)throw Error('Sesi kamu sudah habis, silakan login lagi.');
    if(!message||!message.trim())throw Error('Pesan tidak boleh kosong.');
    const {error}=await supabase.from('feedback').insert({
      user_id:user.id,username:window.nextgen1User||user.user_metadata?.username||null,
      kind:kind==='suggestion'?'suggestion':'bug',message:message.trim().slice(0,1000)
    });
    if(error)throw Error(error.message||'Gagal mengirim.');
  }
};
const icon=window.NEXTGEN1_ICON;
const ICON_ARROW_RIGHT='<i class="fa fa-arrow-right" aria-hidden="true"></i>';
let searchQuery='';
function toolMatches(t,q){
  if(!q)return true;
  const hay=`${t.title} ${t.description} ${t.slug} ${t.tag||''}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w=>hay.includes(w));
}
function cardHtml(t,extraClass){
  const c=cat(t),st=toolStatusMap[t.slug];
  const blocked=st&&(st.enabled===false||st.maintenance);
  const locked=!!st?.vvip_only&&!window.nextgen1EntitledToVvip;
  const badge=locked?'<span class="tool-tag tool-tag-vvip"><i class="fa-solid fa-crown" aria-hidden="true"></i> VVIP</span>'
    :blocked?`<span class="tool-tag tool-tag-blocked">${st.maintenance?'MAINTENANCE':'OFF'}</span>`
    :st?.vvip_only?'<span class="tool-tag tool-tag-vvip"><i class="fa-solid fa-crown" aria-hidden="true"></i> VVIP</span>'
    :(t.tag?`<span class="tool-tag">${esc(t.tag)}</span>`:'');
  const hint=locked?' (khusus VVIP)':blocked?(st.maintenance?' (maintenance)':' (nonaktif)'):'';
  return `<li><button type="button" class="tool-card${extraClass?' '+extraClass:''}${blocked?' is-blocked':''}${locked?' is-locked':''}" data-slug="${esc(t.slug)}" data-cat="${esc(c)}" aria-label="${esc(t.title)}${hint}">`+
    `<span class="tool-icon" aria-hidden="true">${icon(t.icon)}</span>`+
    badge+
    `<span class="tool-copy"><span class="tool-title">${esc(t.title)}</span><span class="tool-desc">${esc(t.description)}</span></span>`+
    `<span class="tool-arrow" aria-hidden="true">${locked?'<i class="fa-solid fa-lock" aria-hidden="true"></i>':ICON_ARROW_RIGHT}</span></button></li>`;
}
function bindCards(root){
  root.querySelectorAll('button[data-slug]').forEach(b=>b.onclick=()=>openTool(b.dataset.slug,{push:true}));
  // Stagger is driven by a CSS custom property set through the CSSOM — an
  // inline style="" ATTRIBUTE would be blocked by our CSP (no unsafe-inline).
  root.querySelectorAll('li').forEach((li,i)=>li.style.setProperty('--i',Math.min(i,14)));
}
function renderCards(){
  const active=tabs.querySelector('[data-cat][aria-selected="true"]')?.dataset.cat||'all';
  // 'vvip' isn't a fixed category — vvip_only is an admin-configurable DB flag
  // per slug, so that tab matches directly against tool_status.
  const list=tools.filter(t=>(active==='all'||(active==='vvip'?!!toolStatusMap[t.slug]?.vvip_only:cat(t)===active))&&toolMatches(t,searchQuery));
  grid.setAttribute('aria-busy','false');
  grid.innerHTML=list.length?list.map(t=>cardHtml(t)).join(''):
    `<li class="empty-state"><i class="fa fa-search" aria-hidden="true"></i><strong>${searchQuery?'Tidak ada tool yang cocok':'Belum ada tool'}</strong><span>${searchQuery?`Tidak ada hasil untuk “${esc(searchQuery)}”. Coba kata kunci lain.`:'Coba kategori lain.'}</span></li>`;
  bindCards(grid);
  const count=$q('tool-count');
  if(count){
    const note=toolStatusOk?'':' · Status tool belum termuat, label VVIP/maintenance mungkin belum tampil (server tetap memverifikasi).';
    count.textContent=`${list.length} tool${searchQuery?` untuk “${searchQuery}”`:''}${note}`;
    count.classList.toggle('is-warning',!toolStatusOk);
  }
  renderVvipSection(active);
}
function renderVvipSection(active){
  const section=$q('vvip-section'),vgrid=$q('vvip-grid');
  if(!section||!vgrid)return;
  // Only on the unfiltered 'all' view — the VVIP tab already shows the same
  // tools, and a search narrows the main grid on its own.
  const vvipTools=tools.filter(t=>!!toolStatusMap[t.slug]?.vvip_only);
  if(active!=='all'||searchQuery||!vvipTools.length){section.hidden=true;vgrid.innerHTML='';return}
  section.hidden=false;
  vgrid.innerHTML=vvipTools.map(t=>cardHtml(t,'tool-card-vvip')).join('');
  bindCards(vgrid);
}
function toolHash(t){return '#'+String(t?.title||t?.name||t?.slug||'tool').trim().replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toUpperCase()}
function toolFromHash(){
  const raw=decodeURIComponent((location.hash||'').replace(/^#/,'')).trim().toLowerCase();
  if(!raw)return null;
  return tools.find(t=>toolHash(t).slice(1).toLowerCase()===raw || t.slug.toLowerCase()===raw) || null;
}
function openDashboard(){
  dashboard.hidden=false;workspace.hidden=true;
  sessionStorage.removeItem('nextgen1-active-tool');
  if(location.hash)history.replaceState(null,'',location.pathname+location.search);
  document.title='NextGen 1 — Semua Tools';
}
let healthTool=null;
const SRC_NEXRAY='NexRay API',SRC_SIPUTZX='Siputzx API',SRC_FAZZ='FazzCode API',SRC_KYZZ='Kyzznekoo API';
const HEALTH_SOURCES={
 tiktok:'TikWM API',
 ig:SRC_NEXRAY, spotify:SRC_NEXRAY, terabox:SRC_NEXRAY, enhancer:SRC_NEXRAY, fakedana:SRC_NEXRAY,
 lobbyml:SRC_NEXRAY, lobbyff:SRC_NEXRAY, ytmp4:SRC_NEXRAY, ytmp3:SRC_NEXRAY, fakebankjago:SRC_NEXRAY,
 youtubestalk:SRC_NEXRAY, twitterstalk:SRC_NEXRAY, threadsstalk:SRC_NEXRAY, snackvideostalk:SRC_NEXRAY,
 robloxstalk:SRC_NEXRAY, pintereststalk:SRC_NEXRAY, genshinstalk:SRC_NEXRAY, nulis:SRC_NEXRAY, smeme:SRC_NEXRAY, ustadz:SRC_NEXRAY,
 fb:SRC_SIPUTZX, tw:SRC_SIPUTZX, capcut:SRC_SIPUTZX, savefrom:SRC_SIPUTZX, lahelu:SRC_SIPUTZX, brat:SRC_SIPUTZX, sertifikat:SRC_SIPUTZX,
 fakedev:'Ikyyxd API', ffstalk:SRC_FAZZ, mlstalk:SRC_FAZZ, tiktokstalk:SRC_FAZZ, igstalk:SRC_FAZZ, githubstalk:SRC_FAZZ,
 fakegopay:SRC_KYZZ, fakeovo:SRC_KYZZ, ektp:SRC_KYZZ, afinitas:SRC_KYZZ,
 react:'Faa API', bypass:'Albyoffc API', komikindo:'TheresaV API', nexadrama:SRC_FAZZ,
 iqc:SRC_FAZZ, img2link:'ImgBB API', 'remove-background':'Remove.bg API', 'image-enhancer':SRC_NEXRAY,
 shortlink:'kua.lat', 'website-screenshot':'Pikwy API'
};
function healthSourceName(t){return HEALTH_SOURCES[t.slug] || HEALTH_SOURCES[t.provider] || 'API Endpoint'}
// "Cek status" used to fire a bare request at /api/proxy with no token or
// slug and then show "Aktif" for ANY HTTP response (it never looked at
// res.ok), so it reported a healthy tool even when the call had been
// rejected. It now re-reads the authoritative tool_status row — the thing
// that actually decides whether this tool is usable right now — which also
// refreshes a tab that was left open while an admin changed something.
function describeStatus(t){
  const st=toolStatusMap[t.slug];
  if(!st)return {text:'Aktif',cls:'status-ok'};
  if(st.maintenance)return {text:'Maintenance',cls:'status-err'};
  if(st.enabled===false)return {text:'Dinonaktifkan',cls:'status-err'};
  if(st.vvip_only)return window.nextgen1EntitledToVvip?{text:'Aktif · khusus VVIP',cls:'status-ok'}:{text:'Khusus VVIP',cls:'status-err'};
  return {text:'Aktif',cls:'status-ok'};
}
function isBlockedFor(t){
  const st=toolStatusMap[t.slug];
  return !!st&&(st.enabled===false||st.maintenance||(st.vvip_only&&!window.nextgen1EntitledToVvip));
}
function resetHealthCheck(t){
 healthTool=t;
 $q('health-provider').textContent=healthSourceName(t);
 const d=describeStatus(t);$q('health-status').textContent=d.text;$q('health-status').className=d.cls;
}
$q('health-check').onclick=async()=>{
  if(!healthTool)return;
  const btn=$q('health-check'),out=$q('health-status');
  btn.disabled=true;out.textContent='Mengecek…';out.className='';
  const [ok]=await Promise.all([loadToolStatus(),loadProfileIntoUI()]);
  btn.disabled=false;
  if(!ok){out.textContent='Gagal memuat status — coba lagi';out.className='status-err';return}
  const d=describeStatus(healthTool);out.textContent=d.text;out.className=d.cls;
  renderCards();
  // Swap between the tool form and the blocked panel if availability changed.
  const showingBlocked=!!$q('tool-area').querySelector('.tool-blocked');
  if(showingBlocked!==isBlockedFor(healthTool))openTool(healthTool.slug);
};
let toolStatusMap={};
let toolStatusOk=false,toolStatusAt=0;
async function loadToolStatus(){
  if(!supabase)return false;
  try{
    const {data,error}=await supabase.from('tool_status').select('slug,enabled,maintenance,vvip_only');
    if(error||!Array.isArray(data))throw error||Error('bad response');
    toolStatusMap=Object.fromEntries(data.map(r=>[r.slug,r]));
    toolStatusOk=true;toolStatusAt=Date.now();
    return true;
  }catch{toolStatusOk=false;return false}
}
async function loadCustomTools(){
  if(!supabase)return;
  try{
    const {data}=await supabase.from('custom_tools').select('*').order('sort_order');
    (data||[]).forEach(row=>{
      if(tools.some(t=>t.slug===row.slug))return; // a built-in tool already owns this slug
      tools.push({
        id:row.slug,slug:row.slug,name:row.title,title:row.title,description:row.description||'',
        type:row.type,provider:row.provider,paramKey:row.param_key,tag:row.tag||'',icon:row.icon||'wrench',
        _customCategory:row.category,_custom:true
      });
    });
  }catch{}
}
function openTool(slug,opts){
  const t=tools.find(x=>x.slug===slug);if(!t)return;
  activeTool=t;healthTool=t;
  sessionStorage.setItem('nextgen1-active-tool',t.slug);
  const nextHash=toolHash(t);
  if(location.hash!==nextHash){
    // A real click from the dashboard gets its own history entry so the
    // browser Back button returns to the dashboard instead of leaving the
    // site; restores / hash changes just rewrite the current entry.
    if(opts?.push&&workspace.hidden)history.pushState({ng1:1},'',location.pathname+location.search+nextHash);
    else history.replaceState(history.state,'',location.pathname+location.search+nextHash);
  }
  $q('workspace-name').textContent=t.title;
  $q('workspace-crumb').textContent=t.title;
  $q('workspace-desc').textContent=t.description;
  const wasHidden=workspace.hidden;
  dashboard.hidden=true;workspace.hidden=false;
  if(wasHidden){window.scrollTo(0,0);$q('workspace-name').tabIndex=-1;$q('workspace-name').focus({preventScroll:true})}
  document.title=t.title+' — NextGen 1';
  const st=toolStatusMap[t.slug];
  if(st?.vvip_only&&!window.nextgen1EntitledToVvip){
    $q('tool-area').innerHTML=`<div class="state-card tool-blocked tool-blocked-vvip"><i class="fa-solid fa-crown state-icon" aria-hidden="true"></i><h2>Khusus member VVIP</h2><p>Tool ini hanya bisa dipakai akun VVIP. Hubungi admin untuk upgrade.</p><button type="button" id="tool-vvip-upgrade" class="btn primary">Upgrade ke VVIP</button></div>`;
    $q('health-provider').textContent=healthSourceName(t);{const d=describeStatus(t);$q('health-status').textContent=d.text;$q('health-status').className=d.cls}
    $q('workspace-status').textContent='Khusus VVIP';
    $q('tool-vvip-upgrade').onclick=()=>window.open(`https://wa.me/6285722707676?text=${encodeURIComponent('Halo Admin NextGen 1, saya mau upgrade ke VVIP. Gimana caranya?')}`,'_blank','noopener');
    return;
  }
  if(st&&(st.enabled===false||st.maintenance)){
    $q('tool-area').innerHTML=`<div class="state-card tool-blocked"><i class="fa fa-wrench state-icon" aria-hidden="true"></i><h2>${st.maintenance?'Sedang maintenance':'Dinonaktifkan sementara'}</h2><p>Tool ini belum bisa dipakai saat ini. Coba lagi nanti atau cek status lagi.</p></div>`;
    $q('health-provider').textContent=healthSourceName(t);{const d=describeStatus(t);$q('health-status').textContent=d.text;$q('health-status').className=d.cls}
    $q('workspace-status').textContent='Tidak tersedia';
    return;
  }
  render(t);
  resetHealthCheck(t);
  logToolUsage(t.slug);
}
function logToolUsage(slug){
  if(!supabase)return;
  supabase.auth.getUser().then(({data:{user}})=>{
   if(!user)return;
   supabase.from('tool_usage').insert({tool_slug:slug,user_id:user.id}).then(()=>{},()=>{});
  }).catch(()=>{});
}
let activeTool=TOOLS[0];
window.addEventListener('hashchange',()=>{
  const t=toolFromHash();
  if(t && !workspace.hidden) openTool(t.slug);
  else if(t && window.nextgen1User) openTool(t.slug);
  else if(!location.hash && window.nextgen1User) openDashboard();
});
function setAuthBusy(b){
  authSubmitButton.disabled=b;
  authSubmitButton.textContent=b?'Memproses…':(authForm.dataset.mode==='login'?'Masuk':'Daftar');
  authForm.setAttribute('aria-busy',String(b));
}
function friendlyAuthError(error,mode){
  const m=String(error?.message||'').toLowerCase();
  if(m.includes('invalid login credentials'))return 'Username atau password salah.';
  if(m.includes('user already registered')||m.includes('already been registered')||m.includes('duplicate'))return 'Username sudah terdaftar. Silakan pilih username lain.';
  if(m.includes('email rate limit'))return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  if(m.includes('password'))return 'Password tidak memenuhi aturan Supabase.';
  if(m.includes('network')||m.includes('fetch'))return 'Tidak dapat terhubung ke server. Periksa koneksi internet.';
  const fallback=mode==='register'?'Pendaftaran gagal.':'Login gagal.';
  // ponytail: previously this fell through to showing ANY raw Supabase
  // error message verbatim, so a phone with no devtools could still see
  // the real cause. That's still useful for the two known configuration
  // causes below (safe to surface — they describe server settings, not
  // account data) but arbitrary raw error text stays generic instead:
  // it's the kind of "error-message information leakage" a security
  // review flags, for no real debugging benefit on the common paths above.
  if(m.includes('signups not allowed')||m.includes('captcha'))return `${fallback} (${error.message})`;
  return `${fallback} Periksa data lalu coba lagi.`;
}
function clearFieldErrors(){['auth-username','auth-password','auth-confirm-password'].forEach(id=>{const el=$q(id);if(el){el.classList.remove('field-error');el.removeAttribute('aria-invalid')}})}
function markFieldError(id){const el=$q(id);if(!el)return;el.classList.add('field-error');el.setAttribute('aria-invalid','true');el.focus();el.addEventListener('input',()=>{el.classList.remove('field-error');el.removeAttribute('aria-invalid')},{once:true})}
async function authSubmit(e){
  e.preventDefault();
  const mode=authForm.dataset.mode||'login';
  const u=$q('auth-username').value.trim();
  const p=$q('auth-password').value;
  authError.textContent='';
  clearFieldErrors();
  if(!validUsername(u)){authError.textContent='Username harus 3–24 karakter dan hanya boleh huruf, angka, titik, garis bawah, atau strip.';markFieldError('auth-username');return}
  if(p.length<6){authError.textContent='Password minimal 6 karakter.';markFieldError('auth-password');return}
  if(mode==='register'&&p!==$q('auth-confirm-password').value){authError.textContent='Konfirmasi password tidak cocok.';markFieldError('auth-confirm-password');return}
  if(mode==='register'&&!$q('auth-consent').checked){authError.textContent='Kamu harus menyetujui Syarat & Ketentuan dan Kebijakan Privasi dulu.';$q('auth-consent').focus();return}
  
  setAuthBusy(true);
  try{
    const email=usernameEmail(u);
    if(mode==='register'){
      const {data,error}=await supabase.auth.signUp({email,password:p,options:{data:{username:u}}});
      if(error)throw error;
      if(!data.session){
        authError.textContent='Akun berhasil dibuat, tetapi konfirmasi email aktif di Supabase. Untuk mode username-only, nonaktifkan Confirm email di Authentication → Providers → Email.';
        return;
      }
      await notifyAuth('register',u);
      showApp(u);
    }else{
      const {data,error}=await supabase.auth.signInWithPassword({email,password:p});
      if(error)throw error;
      const resolved=data.user?.user_metadata?.username||u;
      await notifyAuth('login',resolved);
      showApp(resolved);
    }
  }catch(error){console.error(error);authError.textContent=friendlyAuthError(error,mode)}
  finally{setAuthBusy(false)}
}
async function notifyAuth(event,username){
  try{await fetch('/api/telegram-notify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,username})})}catch{}
}
// Every tool-execution API route now requires a valid Supabase session —
// this is the one place that attaches the bearer token, so app.js's tool
// code never has to touch tokens directly. Only ever used for OUR OWN
// same-origin /api/* endpoints (see app.js's safeJson) — never for a
// third-party URL, which would otherwise leak the user's access token to
// that third party.
window.nextgen1AuthedFetch=async function(url,opts={}){
  if(!supabase)throw Error('Autentikasi belum siap, silakan refresh halaman.');
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token){
    await logout();
    throw Error('Sesi kamu sudah habis, silakan login lagi.');
  }
  const headers={...(opts.headers||{}),Authorization:`Bearer ${session.access_token}`};
  const res=await fetch(url,{...opts,headers});
  if(res.status===401){
    await logout();
    authError.textContent='Sesi kamu sudah habis, silakan login lagi.';
    throw Error('Sesi kamu sudah habis, silakan login lagi.');
  }
  return res;
};
async function logout(){
  window.nextgen1User=null;
  try{await supabase.auth.signOut()}catch(error){console.error(error)}
  showAuth();setMode('login');authForm.reset();authError.textContent='';
}
function togglePassword(inputIds,buttonId){const button=$q(buttonId);if(!button)return;const inputs=(Array.isArray(inputIds)?inputIds:[inputIds]).map($q).filter(Boolean);if(!inputs.length)return;const visible=inputs[0].type==='password';inputs.forEach(i=>i.type=visible?'text':'password');button.textContent=visible?'Sembunyikan password':'Lihat password';button.setAttribute('aria-pressed',String(visible))}
async function loadSupabase(){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  let r;
  try{
    r=await fetch(CONFIG_ENDPOINT,{cache:'no-store',signal:controller.signal});
  }finally{clearTimeout(timeout)}
  if(!r.ok)throw new Error('Supabase configuration unavailable');
  const cfg=await r.json();
  if(!cfg.url||!cfg.publishableKey)throw new Error('Supabase environment variables are missing');
  return createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
let supabase;
function updateNetworkState(){
 const e=$q('network-status'); if(e)e.hidden=navigator.onLine;
 const chip=$q('status-online-chip'),text=$q('status-online-text');
 if(chip&&text){chip.classList.toggle('is-offline',!navigator.onLine);text.textContent=navigator.onLine?'Online':'Offline'}
}
function detectDevice(){return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)?(/iPad|Tablet/i.test(navigator.userAgent)?'Tablet':'Mobile'):'Desktop'}
function detectBrowser(){
 const ua=navigator.userAgent;
 if(/Edg\//.test(ua))return 'Edge';
 if(/OPR\//.test(ua))return 'Opera';
 if(/Firefox\//.test(ua))return 'Firefox';
 if(/Chrome\//.test(ua)&&!/Chromium/.test(ua))return 'Chrome';
 if(/Safari\//.test(ua)&&!/Chrome/.test(ua))return 'Safari';
 return 'Browser';
}
async function initStatusBar(){
 const deviceEl=$q('status-device');if(deviceEl)deviceEl.textContent=detectDevice();
 const browserEl=$q('status-browser');if(browserEl)browserEl.textContent=detectBrowser();
 try{
  const r=await fetch('/api/whoami',{cache:'no-store'});
  if(r.ok){const {country}=await r.json();const el=$q('status-country');if(el)el.textContent=country||'Tidak diketahui'}
 }catch{}
 if('getBattery' in navigator){
  try{
   const bat=await navigator.getBattery();
   const chip=$q('status-battery-chip'),text=$q('status-battery-text');
   if(chip&&text){
    const update=()=>{text.textContent=Math.round(bat.level*100)+'%'+(bat.charging?' (mengisi)':'');chip.hidden=false};
    update();bat.addEventListener('levelchange',update);bat.addEventListener('chargingchange',update);
   }
  }catch{}
 }
}
window.addEventListener('online',updateNetworkState);
window.addEventListener('offline',updateNetworkState);
async function loadAnnouncement(){
  const banner=$q('announcement-banner');if(!banner||!supabase)return;
  try{
    const {data,error}=await supabase.from('announcements').select('id,title,body').eq('active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(error||!data)return;
    // Rebrand migration: carry forward once, then only use the new key.
    try{if(localStorage.getItem('nextgen1-dismissed-ann')==null){const old=localStorage.getItem('nexakit-dismissed-ann');if(old!=null)localStorage.setItem('nextgen1-dismissed-ann',old)}localStorage.removeItem('nexakit-dismissed-ann')}catch{}
    let dismissed;try{dismissed=JSON.parse(localStorage.getItem('nextgen1-dismissed-ann')||'[]')}catch{dismissed=null}
    // Valid JSON of the wrong shape (e.g. a lone number) would throw on
    // .includes()/.push() just as badly as a parse failure.
    if(!Array.isArray(dismissed)){dismissed=[];try{localStorage.removeItem('nextgen1-dismissed-ann')}catch{}}
    if(dismissed.includes(data.id))return;
    $q('announcement-title').textContent=data.title;
    $q('announcement-body').textContent=data.body;
    banner.hidden=false;
    $q('announcement-dismiss').onclick=()=>{
      banner.hidden=true;
      dismissed.push(data.id);
      try{localStorage.setItem('nextgen1-dismissed-ann',JSON.stringify(dismissed.slice(-20)))}catch{}
    };
  }catch{}
}
async function init(){
  initTheme();
  tabs.innerHTML=categories.map(([id,label,ic],i)=>{
    const iconHtml=ic==='crown'?'<i class="fa-solid fa-crown" aria-hidden="true"></i>':`<i class="fa fa-${ic}" aria-hidden="true"></i>`;
    return `<button data-cat="${id}" type="button" role="tab" aria-selected="${i===0}" tabindex="${i===0?0:-1}"${i===0?' class="active"':''}>${iconHtml} ${label}</button>`;
  }).join('');
  const selectTab=b=>{tabs.querySelectorAll('[data-cat]').forEach(x=>{const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-selected',String(on));x.tabIndex=on?0:-1});renderCards()};
  tabs.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>selectTab(b));
  tabs.addEventListener('keydown',e=>{
    const all=[...tabs.querySelectorAll('[data-cat]')],i=all.indexOf(document.activeElement);
    if(i<0)return;
    let n=-1;
    if(e.key==='ArrowRight')n=(i+1)%all.length;else if(e.key==='ArrowLeft')n=(i-1+all.length)%all.length;
    else if(e.key==='Home')n=0;else if(e.key==='End')n=all.length-1;
    if(n<0)return;
    e.preventDefault();all[n].focus();selectTab(all[n]);
  });
  const searchEl=$q('tool-search'),clearEl=$q('tool-search-clear');
  if(searchEl){
    let t;
    searchEl.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{searchQuery=searchEl.value.trim();if(clearEl)clearEl.hidden=!searchQuery;renderCards()},120)});
    if(clearEl)clearEl.onclick=()=>{searchEl.value='';searchQuery='';clearEl.hidden=true;renderCards();searchEl.focus()};
    document.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!dashboard.hidden){e.preventDefault();searchEl.focus();searchEl.select()}
    });
  }
  // The dashboard is loaded once per session, so a tab left open could show
  // stale VVIP/maintenance labels after an admin change. Re-read the status
  // when the tab becomes visible again (throttled) instead of requiring a
  // manual refresh.
  document.addEventListener('visibilitychange',async()=>{
    if(document.visibilityState!=='visible'||!window.nextgen1User||Date.now()-toolStatusAt<30000)return;
    // Re-read BOTH the tool flags and the caller's own profile: if an owner just
    // granted/revoked VVIP (or banned this account) the open tab used to keep the
    // old entitlement until a manual reload. The server was already
    // authoritative; this just makes the UI match it. loadProfileIntoUI also logs
    // out a freshly banned user and re-renders the cards itself.
    await Promise.all([loadToolStatus(),loadProfileIntoUI()]);
    renderCards();
  });
  loginTab.onclick=()=>setMode('login');registerTab.onclick=()=>setMode('register');
  authForm.addEventListener('submit',authSubmit);
  const togglePass=$q('toggle-pass');
  if(togglePass)togglePass.onclick=()=>togglePassword(['auth-password','auth-confirm-password'],'toggle-pass');
  $q('logout').onclick=logout;
  $q('back-tools').onclick=()=>{if(history.state?.ng1)history.back();else openDashboard()};
  $q('menu-feedback').onclick=()=>{window.NEXTGEN1_openFeedback()};
  $q('menu-settings').onclick=()=>{window.NEXTGEN1_openSettings()};
  $q('brand-home').onclick=()=>{if(!app.hidden)openDashboard()};
  const footerYear=$q('footer-year');if(footerYear)footerYear.textContent=new Date().getFullYear();
  localStorage.removeItem('nexakit-auth-v1');localStorage.removeItem('nexakit-session-v1');
  initStatusBar();
  setMode('login');
  try{
    supabase=await loadSupabase();
    const [,,{data:{session}}]=await Promise.all([loadToolStatus(),loadCustomTools(),supabase.auth.getSession()]);
    if(session?.user){const u=session.user.user_metadata?.username||session.user.email?.split('@')[0]||'Member';showApp(u)}else showAuth();
    supabase.auth.onAuthStateChange((_event,session)=>{if(session?.user){const u=session.user.user_metadata?.username||session.user.email?.split('@')[0]||'Member';showApp(u)}else if(!auth.hidden){showAuth()}});
  }catch(error){console.error(error);showAuth();authError.textContent=error.name==='AbortError'?'Koneksi Supabase timeout. Coba refresh atau cek deployment Vercel.':'Authentication belum terhubung. Pastikan environment Supabase sudah dikonfigurasi.'}
  finally { const boot=$q('boot-screen'); if(boot){boot.classList.add('is-hidden');setTimeout(()=>boot.remove(),450)} updateNetworkState(); }
}
init();
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(error=>console.warn('Service worker registration failed:',error)));
