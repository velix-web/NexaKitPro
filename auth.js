/* ============================================================
   AUTH + ROUTING — Supabase logic, unchanged behaviourally.
   ============================================================ */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const CONFIG_ENDPOINT = '/api/supabase-config';
const tools = TOOLS;
const render = window.NEXAKIT_render;
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
  try{localStorage.setItem('nexakit-theme',theme)}catch{}
  document.querySelectorAll('[data-theme-toggle]').forEach(b=>{
    b.setAttribute('aria-pressed',String(theme==='dark'));
    const icon=b.querySelector('.theme-toggle-icon');if(icon)icon.innerHTML=theme==='dark'?ICON_SUN:ICON_MOON;
  });
}
function initTheme(){
  applyTheme(document.documentElement.dataset.theme||'light'); // head script already set it; this just syncs the buttons
  document.querySelectorAll('[data-theme-toggle]').forEach(b=>b.onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
}
function usernameEmail(username){return `${username.toLowerCase()}@users.nexakitpro.local`}
function validUsername(u){return /^[a-zA-Z0-9._-]{3,24}$/.test(u)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function setMode(mode){
  authForm.dataset.mode=mode;
  authMode.textContent=mode==='login'?'Masuk':'Daftar';
  $q('auth-subtitle').textContent=mode==='login'?'Masuk untuk membuka semua tools NexaKit Pro.':'Buat akun NexaKit Pro dengan username dan password.';
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
function showApp(u){window.nexakitUser=u;auth.hidden=true;app.hidden=false;userName.textContent=u;renderCards();const hashTool=toolFromHash(),savedTool=sessionStorage.getItem('nexakit-active-tool');if(hashTool)openTool(hashTool.slug);else if(savedTool&&tools.some(t=>t.slug===savedTool))openTool(savedTool);else openDashboard();loadProfileIntoUI();loadAnnouncement()}
const ROLE_LABEL={user:'Member',admin:'Admin',owner:'Developer'};
async function loadProfileIntoUI(){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return;
  const {data,error}=await supabase.from('profiles').select('display_name,avatar_url,is_vip,role,banned').eq('id',user.id).single();
  if(error||!data)return;
  if(data.banned){
    // Client-side enforcement only — see README for the known gap: the
    // downloader/maker API routes don't check auth yet, so a banned user's
    // browser session is blocked here, but a direct API call isn't (todo).
    await logout();
    authError.textContent='Akun kamu telah dinonaktifkan oleh admin.';
    return;
  }
  const name=data.display_name||window.nexakitUser;
  window.nexakitRole=data.role||'user';
  window.nexakitEntitledToVvip=!!data.is_vip||data.role==='admin'||data.role==='owner';
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
      const msg=data.is_vip?'Halo Admin NexaKit Pro, saya user VVIP, mau tanya-tanya.':'Halo Admin NexaKit Pro, saya mau upgrade ke VVIP. Gimana caranya?';
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
window.nexakitApi={
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
      user_id:user.id,username:window.nexakitUser||user.user_metadata?.username||null,
      kind:kind==='suggestion'?'suggestion':'bug',message:message.trim().slice(0,1000)
    });
    if(error)throw Error(error.message||'Gagal mengirim.');
  }
};
const icon=window.NEXAKIT_ICON;
const ICON_ARROW_RIGHT='<i class="fa fa-arrow-right" aria-hidden="true"></i>';
// Reveal on scroll — cheap, no library, and the observer disconnects per node once shown.
const reveal=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-in');reveal.unobserve(e.target)}}),{rootMargin:'0px 0px -40px 0px'});
function renderCards(){
  // ponytail: was reading a `.segmented-btn.active` class the tab buttons
  // never had (they get `.active` directly on the `[data-cat]` button), so
  // this always fell through to 'all' — category tabs silently did nothing.
  const active=tabs.querySelector('[data-cat].active')?.dataset.cat||'all';
  // ponytail: 'vvip' was in the tab list but cat(t) never returns it for any
  // tool — vvip_only is an admin-configurable DB flag per slug, not a fixed
  // category, so it can't live inside cat()'s static slug lists. The VVIP
  // tab now matches directly against tool_status instead, on top of
  // whatever base category(ies) that tool already has.
  const list=tools.filter(t=>active==='all'||(active==='vvip'?!!toolStatusMap[t.slug]?.vvip_only:cat(t)===active));
  grid.innerHTML=list.length?list.map((t,i)=>{
    const c=cat(t);
    const st=toolStatusMap[t.slug];
    const blocked=st&&(st.enabled===false||st.maintenance);
    const locked=st?.vvip_only&&!window.nexakitEntitledToVvip;
    const badge=locked?'<span class="tool-tag tool-tag-vvip"><i class="fa-solid fa-crown" aria-hidden="true"></i> VVIP</span>'
      :blocked?`<span class="tool-tag tool-tag-blocked">${st.maintenance?'MAINTENANCE':'OFF'}</span>`
      :(t.tag?`<span class="tool-tag">${esc(t.tag)}</span>`:'');
    return `<li style="--i:${i}"><button type="button" class="tool-card${blocked?' is-blocked':''}${locked?' is-locked':''}" data-slug="${esc(t.slug)}" data-cat="${c}">`+
    `<span class="tool-icon" aria-hidden="true">${icon(t.icon)}</span>`+
    badge+
    `<span class="tool-copy"><span class="tool-title">${esc(t.title)}</span><span class="tool-desc">${esc(t.description)}</span></span>`+
    `<span class="tool-arrow" aria-hidden="true">${locked?'<i class="fa-solid fa-lock" aria-hidden="true"></i>':ICON_ARROW_RIGHT}</span></button></li>`}).join(''):'<li class="empty-state"><strong>Belum ada tool</strong><span>Coba kategori lain.</span></li>';
  grid.querySelectorAll('button[data-slug]').forEach(b=>b.onclick=()=>openTool(b.dataset.slug));
  grid.querySelectorAll('li').forEach(li=>reveal.observe(li));
  renderVvipSection(active);
}
function renderVvipSection(active){
  const section=$q('vvip-section'),vgrid=$q('vvip-grid');
  if(!section||!vgrid)return;
  // Shown on the 'all' view only — the VVIP tab itself already filters the
  // main grid to the same tools, so repeating them there would be redundant.
  if(active!=='all'){section.hidden=true;vgrid.innerHTML='';return}
  const vvipTools=tools.filter(t=>!!toolStatusMap[t.slug]?.vvip_only);
  if(!vvipTools.length){section.hidden=true;vgrid.innerHTML='';return}
  section.hidden=false;
  vgrid.innerHTML=vvipTools.map((t,i)=>{
    const st=toolStatusMap[t.slug];
    const blocked=st&&(st.enabled===false||st.maintenance);
    const locked=!window.nexakitEntitledToVvip;
    return `<li style="--i:${i}"><button type="button" class="tool-card tool-card-vvip${blocked?' is-blocked':''}${locked?' is-locked':''}" data-slug="${esc(t.slug)}">`+
    `<span class="tool-icon" aria-hidden="true">${icon(t.icon)}</span>`+
    `<span class="tool-tag tool-tag-vvip"><i class="fa-solid fa-crown" aria-hidden="true"></i> VVIP</span>`+
    `<span class="tool-copy"><span class="tool-title">${esc(t.title)}</span><span class="tool-desc">${esc(t.description)}</span></span>`+
    `<span class="tool-arrow" aria-hidden="true">${locked?'<i class="fa-solid fa-lock" aria-hidden="true"></i>':ICON_ARROW_RIGHT}</span></button></li>`;
  }).join('');
  vgrid.querySelectorAll('button[data-slug]').forEach(b=>b.onclick=()=>openTool(b.dataset.slug));
}
function toolHash(t){return '#'+String(t?.title||t?.name||t?.slug||'tool').trim().replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toUpperCase()}
function toolFromHash(){
  const raw=decodeURIComponent((location.hash||'').replace(/^#/,'')).trim().toLowerCase();
  if(!raw)return null;
  return tools.find(t=>toolHash(t).slice(1).toLowerCase()===raw || t.slug.toLowerCase()===raw) || null;
}
function openDashboard(){
  dashboard.hidden=false;workspace.hidden=true;
  sessionStorage.removeItem('nexakit-active-tool');
  if(location.hash)history.replaceState(null,'',location.pathname+location.search);
  document.title='NexaKit Pro — Semua Tools';
}
let healthTool=null;
const HEALTH_SOURCES={
 tiktok:'TikWM API',
 ig:'NexRay API', spotify:'NexRay API', terabox:'NexRay API', enhancer:'NexRay API',
 fakedana:'NexRay API', lobbyml:'NexRay API', lobbyff:'NexRay API', ytmp4:'NexRay API', ytmp3:'NexRay API',
 fb:'Siputzx API', tw:'Siputzx API', capcut:'Siputzx API', savefrom:'Siputzx API', lahelu:'Siputzx API',
 brat:'Siputzx API', sertifikat:'Siputzx API', fakedev:'Ikyyxd API',
 iqc:'FazzCode API', img2link:'ImgBB API', 'remove-bg':'Remove.bg API', 'image-enhancer':'NexRay API'
};
const HEALTH_PROVIDERS={
 tiktok:'tiktok', youtube:'ytmp4', iqc:null, img2link:null, 'remove-bg':null
};
function healthSourceName(t){return HEALTH_SOURCES[t.provider||t.slug] || HEALTH_SOURCES[t.slug] || 'API Endpoint'}
function healthProviderKey(t){return HEALTH_PROVIDERS[t.slug] || t.provider || null}
function resetHealthCheck(t){
 healthTool=t;
 $q('health-provider').textContent=healthSourceName(t);
 $q('health-status').textContent='Belum diuji';$q('health-status').className='';
}
$q('health-check').onclick=async()=>{
 if(!healthTool)return;
 const btn=$q('health-check');btn.disabled=true;
 $q('health-status').textContent='Mengecek…';$q('health-status').className='';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
 try{
  const key=healthProviderKey(healthTool);
  if(!key) throw Error('Endpoint check not configured');
  await fetch(`/api/proxy?provider=${encodeURIComponent(key)}`,{signal:controller.signal});
  clearTimeout(timer);
  $q('health-status').textContent='Aktif';$q('health-status').className='status-ok';
 }catch(e){
  clearTimeout(timer);
  $q('health-status').textContent='Tidak merespons';$q('health-status').className='status-err';
 }finally{btn.disabled=false}
};
let toolStatusMap={};
async function loadToolStatus(){
  if(!supabase)return;
  try{
    const {data}=await supabase.from('tool_status').select('slug,enabled,maintenance,vvip_only');
    toolStatusMap=Object.fromEntries((data||[]).map(r=>[r.slug,r]));
  }catch{}
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
function openTool(slug){
  const t=tools.find(x=>x.slug===slug);if(!t)return;
  activeTool=t;
  sessionStorage.setItem('nexakit-active-tool',t.slug);
  const nextHash=toolHash(t);
  if(location.hash!==nextHash)history.replaceState(null,'',location.pathname+location.search+nextHash);
  $q('workspace-name').textContent=t.title;
  $q('workspace-desc').textContent=t.description;
  dashboard.hidden=true;workspace.hidden=false;
  document.title=t.title+' — NexaKit Pro';
  const st=toolStatusMap[t.slug];
  if(st?.vvip_only&&!window.nexakitEntitledToVvip){
    $q('tool-area').innerHTML=`<p class="tool-blocked tool-blocked-vvip"><i class="fa-solid fa-crown" aria-hidden="true"></i> Tool ini khusus member VVIP.</p><p><button type="button" id="tool-vvip-upgrade">Upgrade ke VVIP</button></p>`;
    $q('health-provider').textContent='—';$q('health-status').textContent='Tidak tersedia';
    $q('workspace-status').textContent='Khusus VVIP';
    $q('tool-vvip-upgrade').onclick=()=>window.open(`https://wa.me/6285722707676?text=${encodeURIComponent('Halo Admin NexaKit Pro, saya mau upgrade ke VVIP. Gimana caranya?')}`,'_blank','noopener');
    return;
  }
  if(st&&(st.enabled===false||st.maintenance)){
    $q('tool-area').innerHTML=`<p class="tool-blocked"><i class="fa fa-wrench" aria-hidden="true"></i> Tool ini sedang ${st.maintenance?'maintenance':'dinonaktifkan sementara'}. Coba lagi nanti.</p>`;
    $q('health-provider').textContent='—';$q('health-status').textContent='Tidak tersedia';
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
  else if(t && window.nexakitUser) openTool(t.slug);
  else if(!location.hash && window.nexakitUser) openDashboard();
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
window.nexakitAuthedFetch=async function(url,opts={}){
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
  window.nexakitUser=null;
  try{await supabase.auth.signOut()}catch(error){console.error(error)}
  showAuth();setMode('login');authForm.reset();authError.textContent='';
}
function togglePassword(inputIds,buttonId){const button=$q(buttonId);if(!button)return;const inputs=(Array.isArray(inputIds)?inputIds:[inputIds]).map($q).filter(Boolean);if(!inputs.length)return;const visible=inputs[0].type==='password';inputs.forEach(i=>i.type=visible?'text':'password');button.textContent=visible?'Sembunyikan password':'Lihat password'}
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
document.addEventListener('keydown',e=>{
 if(e.key==='Escape' && !$q('settings-modal').hidden) $q('settings-close')?.click();
});
async function loadAnnouncement(){
  const banner=$q('announcement-banner');if(!banner||!supabase)return;
  try{
    const {data,error}=await supabase.from('announcements').select('id,title,body').eq('active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(error||!data)return;
    let dismissed=[];try{dismissed=JSON.parse(localStorage.getItem('nexakit-dismissed-ann')||'[]')}catch{}
    if(dismissed.includes(data.id))return;
    $q('announcement-title').textContent=data.title;
    $q('announcement-body').textContent=data.body;
    banner.hidden=false;
    $q('announcement-dismiss').onclick=()=>{
      banner.hidden=true;
      dismissed.push(data.id);
      try{localStorage.setItem('nexakit-dismissed-ann',JSON.stringify(dismissed.slice(-20)))}catch{}
    };
  }catch{}
}
async function init(){
  initTheme();
  tabs.innerHTML=categories.map(([id,label,ic],i)=>{
    const iconHtml=ic==='crown'?'<i class="fa-solid fa-crown" aria-hidden="true"></i>':`<i class="fa fa-${ic}" aria-hidden="true"></i>`;
    return `<button data-cat="${id}" type="button"${i===0?' class="active"':''}>${iconHtml} ${label}</button>`;
  }).join('');
  tabs.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{tabs.querySelectorAll('[data-cat]').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderCards()});
  loginTab.onclick=()=>setMode('login');registerTab.onclick=()=>setMode('register');
  authForm.addEventListener('submit',authSubmit);
  const togglePass=$q('toggle-pass');
  if(togglePass)togglePass.onclick=()=>togglePassword(['auth-password','auth-confirm-password'],'toggle-pass');
  $q('logout').onclick=logout;
  $q('back-tools').onclick=openDashboard;
  $q('menu-feedback').onclick=()=>{window.NEXAKIT_openFeedback()};
  $q('menu-settings').onclick=()=>{window.NEXAKIT_openSettings()};
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
