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
const grid = $q('tool-grid'), search = $q('tool-search'), tabs = $q('category-tabs');
const userName = $q('user-name');
const authForm = $q('auth-form'), authMode = $q('auth-mode'), authError = $q('auth-error');
const authSubmitButton = authForm.querySelector('button[type="submit"]');
const loginTab = document.querySelector('[data-mode="login"]');
const registerTab = document.querySelector('[data-mode="register"]');
const categories=[['all','All'],['downloader','Downloader'],['maker','Maker'],['image','Image'],['utility','Utility']];
function cat(t){if(['tiktok','instagram','spotify','terabox','youtube','facebook','twitter','capcut','savefrom','lahelu'].includes(t.slug))return 'downloader';if(['brat','iqc','sertifikat-tolol','lobby-ml','lobby-ff','fakedana','fakedev'].includes(t.slug))return 'maker';if(['img2link','remove-background','image-enhancer'].includes(t.slug))return 'image';return 'utility'}
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
  authSubmitButton.textContent=mode==='login'?'Masuk':'Daftar';
  [loginTab,registerTab].forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  authError.textContent='';
}
function showAuth(){auth.hidden=false;app.hidden=true}
function showApp(u){window.nexakitUser=u;auth.hidden=true;app.hidden=false;userName.textContent=u;renderCards();const hashTool=toolFromHash(),savedTool=sessionStorage.getItem('nexakit-active-tool');if(hashTool)openTool(hashTool.slug);else if(savedTool&&tools.some(t=>t.slug===savedTool))openTool(savedTool);else openDashboard();loadProfileIntoUI()}
async function loadProfileIntoUI(){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return;
  const {data,error}=await supabase.from('profiles').select('display_name,avatar_url,is_vip').eq('id',user.id).single();
  if(error||!data)return;
  const name=data.display_name||window.nexakitUser;
  userName.textContent=name;
  const roleLabel=document.getElementById('role-label');
  if(roleLabel)roleLabel.textContent=data.is_vip?'VVIP':'Member';
  if(data.avatar_url){
    const prevImg=document.getElementById('avatar-preview-img'),prevFallback=document.getElementById('avatar-preview-fallback');
    if(prevImg){prevImg.src=data.avatar_url;prevImg.hidden=false;if(prevFallback)prevFallback.hidden=true}
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
  }
};
function renderCards(){
  const q=(search.value||'').trim().toLowerCase();
  const active=tabs.querySelector('.segmented-btn.active')?.dataset.cat||'all';
  const list=tools.filter(t=>(active==='all'||cat(t)===active)&&(!q||`${t.name} ${t.title} ${t.description}`.toLowerCase().includes(q)));
  grid.innerHTML=list.length?list.map(t=>`<li><button type="button" data-slug="${esc(t.slug)}"><span>${esc(t.title)}</span><span>${esc(t.description)}</span>${t.tag?`<span>${esc(t.tag)}</span>`:''}</button></li>`).join(''):'<li>Tool tidak ditemukan.</li>';
  grid.querySelectorAll('button[data-slug]').forEach(b=>b.onclick=()=>openTool(b.dataset.slug));
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
function openTool(slug){
  const t=tools.find(x=>x.slug===slug);if(!t)return;
  activeTool=t;
  sessionStorage.setItem('nexakit-active-tool',t.slug);
  const nextHash=toolHash(t);
  if(location.hash!==nextHash)history.replaceState(null,'',location.pathname+location.search+nextHash);
  render(t);
  $q('workspace-name').textContent=t.title;
  $q('workspace-desc').textContent=t.description;
  resetHealthCheck(t);
  dashboard.hidden=true;workspace.hidden=false;
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
  // ponytail: previously this just returned a generic sentence with no way
  // to see the real cause on a phone (no devtools). Common real causes for
  // "gagal" with no other keyword match: signups disabled or captcha
  // protection turned on in Supabase Auth settings — both only visible via
  // this raw message, so show it instead of hiding it.
  const fallback=mode==='register'?'Pendaftaran gagal.':'Login gagal.';
  return error?.message?`${fallback} (${error.message})`:`${fallback} Periksa data lalu coba lagi.`;
}
async function authSubmit(e){
  e.preventDefault();
  const mode=authForm.dataset.mode||'login';
  const u=$q('auth-username').value.trim();
  const p=$q('auth-password').value;
  authError.textContent='';
  if(!validUsername(u)){authError.textContent='Username harus 3–24 karakter dan hanya boleh huruf, angka, titik, garis bawah, atau strip.';return}
  if(p.length<6){authError.textContent='Password minimal 6 karakter.';return}
  
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
 const e=$q('network-status'); if(!e)return;
 e.hidden=navigator.onLine;
}
window.addEventListener('online',updateNetworkState);
window.addEventListener('offline',updateNetworkState);
document.addEventListener('keydown',e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
   e.preventDefault(); if(!$q('dashboard-view').hidden) $q('tool-search')?.focus();
 }
 if(e.key==='Escape' && !$q('settings-modal').hidden) $q('settings-close')?.click();
});
async function init(){
  tabs.innerHTML=categories.map(([id,label])=>`<button data-cat="${id}" type="button">${label}</button>`).join('');
  tabs.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{tabs.querySelectorAll('[data-cat]').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderCards()});
  search.addEventListener('input',renderCards);
  loginTab.onclick=()=>setMode('login');registerTab.onclick=()=>setMode('register');
  authForm.addEventListener('submit',authSubmit);
  const togglePass=$q('toggle-pass');
  if(togglePass)togglePass.onclick=()=>togglePassword('auth-password','toggle-pass');
  $q('logout').onclick=logout;
  $q('back-tools').onclick=openDashboard;
  $q('menu-feedback').onclick=()=>{const tpl=`Halo Admin NexaKit Pro%0A%0AJenis: (Saran/Kritik/Request Fitur/Bug)%0ATool terkait: %0ADeskripsi: %0A%0ADikirim dari menu NexaKit Pro`;window.open(`https://wa.me/6285722707676?text=${tpl}`,'_blank','noopener')};
  $q('menu-settings').onclick=()=>{window.NEXAKIT_openSettings()};
  localStorage.removeItem('nexakit-auth-v1');localStorage.removeItem('nexakit-session-v1');
  setMode('login');
  try{
    supabase=await loadSupabase();
    const {data:{session}}=await supabase.auth.getSession();
    if(session?.user){const u=session.user.user_metadata?.username||session.user.email?.split('@')[0]||'Member';showApp(u)}else showAuth();
    supabase.auth.onAuthStateChange((_event,session)=>{if(session?.user){const u=session.user.user_metadata?.username||session.user.email?.split('@')[0]||'Member';showApp(u)}else if(!auth.hidden){showAuth()}});
  }catch(error){console.error(error);showAuth();authError.textContent=error.name==='AbortError'?'Koneksi Supabase timeout. Coba refresh atau cek deployment Vercel.':'Authentication belum terhubung. Pastikan environment Supabase sudah dikonfigurasi.'}
  finally { const boot=$q('boot-screen'); if(boot){boot.classList.add('is-hidden');setTimeout(()=>boot.remove(),450)} updateNetworkState(); }
}
init();
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(error=>console.warn('Service worker registration failed:',error)));
