/* ============================================================
   FEATURE LOGIC ONLY — visuals live entirely in the <style>
   block above; nothing here decides how anything looks.
   ============================================================ */
/* Icon set: Font Awesome (solid names run through the v4 shim unchanged;
   platform tools use real Brand icons — 'name:brand' picks the fa-brands style). */
const I={
 drive:'cloud-download',scissors:'cut',layers:'clone',laugh:'smile-o',type:'font',
 unlink:'chain-broken',note:'sticky-note-o',award:'certificate',gamepad:'gamepad',
 flame:'fire',wallet:'money',idcard:'id-card-o',link:'link',eraser:'eraser',sparkles:'magic',
 upload:'upload',book:'book',heart:'heart',at:'at',star:'star',video:'video-camera',
 pen:'pencil',image:'picture-o',
 tiktok:'tiktok:brand',instagram:'instagram:brand',spotify:'spotify:brand',
 youtube:'youtube:brand',facebook:'facebook:brand',twitter:'x-twitter:brand',whatsapp:'whatsapp:brand',
 github:'github:brand',desktop:'desktop',film:'film'
};
const svgIcon=n=>{
 const raw=I[n]||'th-large';
 const [name,kind]=raw.split(':');
 return `<i class="${kind==='brand'?'fa-brands':'fa'} fa-${name}" aria-hidden="true"></i>`;
};
window.NEXAKIT_ICON=svgIcon;
const TOOLS=[
{id:'tt',slug:'tiktok',name:'TikTok',title:'TikTok Downloader',description:'Download video TikTok tanpa watermark',type:'tiktok',tag:'MP4/MP3',icon:'tiktok'},
{id:'ig',slug:'instagram',name:'Instagram',title:'Instagram Downloader',description:'Unduh video & foto Instagram HD',type:'generic-downloader',provider:'ig',paramKey:'url',tag:'HD',icon:'instagram'},
{id:'spotify',slug:'spotify',name:'Spotify',title:'Spotify Downloader',description:'Unduh musik Spotify ke MP3',type:'generic-downloader',provider:'spotify',paramKey:'url',tag:'MP3',icon:'spotify'},
{id:'terabox',slug:'terabox',name:'Terabox',title:'Terabox Downloader',description:'Ambil file dari share Terabox',type:'generic-downloader',provider:'terabox',paramKey:'url',tag:'FILE',icon:'drive'},
{id:'yt_engine',slug:'youtube',name:'YouTube',title:'YouTube Downloader',description:'Unduh MP4 360p-1080p atau MP3 dari YouTube',type:'youtube',tag:'MP4/MP3',icon:'youtube'},
{id:'fb',slug:'facebook',name:'Facebook',title:'Facebook Downloader',description:'Unduh video Facebook tanpa watermark',type:'generic-downloader',provider:'fb',paramKey:'url',tag:'MP4',icon:'facebook'},
{id:'tw',slug:'twitter',name:'Twitter / X',title:'Twitter/X Downloader',description:'Unduh video & foto dari Twitter/X',type:'generic-downloader',provider:'tw',paramKey:'url',tag:'MP4/JPG',icon:'twitter'},
{id:'capcut',slug:'capcut',name:'CapCut',title:'CapCut Downloader',description:'Unduh video template/hasil CapCut',type:'generic-downloader',provider:'capcut',paramKey:'url',tag:'MP4',icon:'scissors'},
{id:'savefrom',slug:'savefrom',name:'SaveFrom',title:'SaveFrom Downloader',description:'Unduh media dari banyak platform',type:'generic-downloader',provider:'savefrom',paramKey:'url',tag:'MULTI',icon:'layers'},
{id:'lahelu',slug:'lahelu',name:'Lahelu',title:'Lahelu Downloader',description:'Unduh video/gambar dari Lahelu',type:'generic-downloader',provider:'lahelu',paramKey:'url',tag:'MEDIA',icon:'laugh'},
{id:'brat_gen',slug:'brat',name:'Brat Generator',title:'Brat Generator',description:'Buat stiker BRAT: static, animated, video bounce, atau stacked 3 baris',type:'brat',provider:'brat',tag:'PNG/GIF/MP4',icon:'type'},
{id:'bypass_link',slug:'bypass-link',name:'Bypass Link',title:'Bypass Link',description:'Lewatin shortlink/link pengaman jadi link asli',type:'bypass',tag:'LINK',icon:'unlink'},
{id:'react_wa',slug:'react-wa',name:'React Channel WA',title:'React Channel WA',description:'React postingan channel WhatsApp pakai emoji',type:'react',tag:'WA',icon:'whatsapp'},
{id:'iqc',slug:'iqc',name:'iPhone Quote Create',title:'iPhone Quote Create',description:'Buat kartu quote ala iPhone Notes',type:'iqc',tag:'IMAGE',icon:'note'},
{id:'sertifikat_tolol',slug:'sertifikat-tolol',name:'Sertifikat Tolol',title:'Sertifikat Tolol',description:'Buat sertifikat meme kocak',type:'image-generator',provider:'sertifikat',paramKey:'text',tag:'IMAGE',icon:'award'},
{id:'lobby_ml',slug:'lobby-ml',name:'Fake Lobby ML',title:'Fake Lobby ML',description:'Buat SS Lobby Mobile Legends',type:'lobby-ml',provider:'lobbyml',tag:'IMAGE',icon:'gamepad'},
{id:'lobby_ff',slug:'lobby-ff',name:'Fake Lobby FF',title:'Fake Lobby FF',description:'Buat SS Lobby Free Fire',type:'image-generator',provider:'lobbyff',paramKey:'nickname',tag:'IMAGE',icon:'flame'},
{id:'fakedana',slug:'fakedana',name:'Fake Saldo DANA',title:'Fake Saldo DANA',description:'Buat gambar saldo DANA palsu',type:'image-generator',provider:'fakedana',paramKey:'nominal',tag:'IMAGE',icon:'wallet'},
{id:'fakedev',slug:'fakedev',name:'FakeDev Profile',title:'FakeDev Profile',description:'Generator kartu profil developer',type:'fakedev',provider:'fakedev',tag:'IMAGE',icon:'idcard'},
{id:'img2link',slug:'img2link',name:'Foto To Link',title:'Foto To Link',description:'Upload gambar menjadi URL ImgBB',type:'img2link',tag:'LINK',icon:'link'},
{id:'rmbg',slug:'remove-background',name:'Remove Background',title:'Remove Background',description:'Hapus background foto',type:'remove-bg',tag:'PNG',icon:'eraser'},
{id:'enh',slug:'image-enhancer',name:'Image Enhancer',title:'Image Enhancer',description:'Tingkatkan kualitas foto HD',type:'image-enhancer',tag:'HD',icon:'sparkles'},
{id:'ffstalk',slug:'ff-stalk',name:'FF Stalk',title:'FF Stalk',description:'Cek info akun Free Fire dari User ID',type:'profile-lookup',provider:'ffstalk',paramKey:'uid',inputLabel:'User ID Free Fire',placeholder:'cth: 123456789',tag:'INFO',icon:'flame'},
{id:'mlstalk',slug:'ml-stalk',name:'ML Stalk',title:'ML Stalk',description:'Cek info akun Mobile Legends dari User ID + Server',type:'profile-lookup',provider:'mlstalk',paramKey:'id',paramKey2:'server',inputLabel:'User ID',placeholder:'cth: 123456789',inputLabel2:'Server ID',placeholder2:'cth: 1234',tag:'INFO',icon:'gamepad'},
{id:'tiktokstalk',slug:'tiktok-stalk',name:'TikTok Stalk',title:'TikTok Stalk',description:'Cek info profil TikTok dari username',type:'profile-lookup',provider:'tiktokstalk',paramKey:'username',inputLabel:'Username TikTok',placeholder:'tanpa @, cth: nexakit',tag:'INFO',icon:'tiktok'},
{id:'igstalk',slug:'instagram-stalk',name:'Instagram Stalk',title:'Instagram Stalk',description:'Cek info profil Instagram dari username',type:'profile-lookup',provider:'igstalk',paramKey:'username',inputLabel:'Username Instagram',placeholder:'tanpa @, cth: nexakit',tag:'INFO',icon:'instagram'},
{id:'githubstalk',slug:'github-stalk',name:'GitHub Stalk',title:'GitHub Stalk',description:'Cek info profil GitHub dari username',type:'profile-lookup',provider:'githubstalk',paramKey:'q',inputLabel:'Username GitHub',placeholder:'cth: octocat',tag:'INFO',icon:'github'},
{id:'shortlink',slug:'shortlink',name:'Shortlink',title:'Shortlink',description:'Pendekin link jadi lebih ringkas',type:'shortlink',tag:'LINK',icon:'link'},
{id:'ssweb',slug:'website-screenshot',name:'Website Screenshot',title:'Website Screenshot',description:'Ambil screenshot full-page dari URL manapun',type:'ssweb',tag:'PNG',icon:'desktop'},
{id:'nexadrama',slug:'nexadrama',name:'NexaDrama',title:'NexaDrama',description:'Nonton & download drama pendek, lengkap sama episode-nya',type:'nexadrama',tag:'STREAM',icon:'film'},
// New batch. Upstream param names are our best guess (see api/proxy.js) —
// test each after deploy since these hosts weren't reachable to verify.
{id:'fakebankjago',slug:'fakebank-jago',name:'Fake Saldo Jago',title:'Fake Saldo Jago',description:'Buat gambar saldo Bank Jago palsu',type:'image-generator',provider:'fakebankjago',paramKey:'nominal',tag:'IMAGE',icon:'wallet'},
{id:'fakegopay',slug:'fakegopay',name:'Fake Saldo GoPay',title:'Fake Saldo GoPay',description:'Buat gambar saldo GoPay palsu',type:'image-generator',provider:'fakegopay',paramKey:'nominal',tag:'IMAGE',icon:'wallet'},
{id:'komikindo',slug:'komikindo',name:'Komikindo Manga',title:'Komikindo Manga',description:'Cari & baca info manga dari Komikindo, lengkap link download chapter',type:'komikindo',tag:'MANGA',icon:'book'},
{id:'fakeovo',slug:'fakeovo',name:'Fake Saldo OVO',title:'Fake Saldo OVO',description:'Buat gambar saldo OVO palsu',type:'image-generator',provider:'fakeovo',paramKey:'nominal',tag:'IMAGE',icon:'wallet'},
{id:'ektp',slug:'ektp',name:'KTP Generator',title:'KTP Generator',description:'Template KTP meme buat konten iseng — bukan dokumen resmi',type:'image-generator',provider:'ektp',paramKey:'nama',tag:'IMAGE',icon:'idcard'},
{id:'afinitas',slug:'afinitas',name:'Kalkulator Afinitas',title:'Kalkulator Afinitas',description:'Cek persentase kecocokan dua nama, buat konten iseng',type:'image-generator',provider:'afinitas',paramKey:'nama1',paramKey2:'nama2',inputLabel:'Nama Pertama',placeholder:'cth: Andi',inputLabel2:'Nama Kedua',placeholder2:'cth: Budi',tag:'IMAGE',icon:'heart'},
{id:'youtubestalk',slug:'youtube-stalk',name:'YouTube Stalk',title:'YouTube Stalk',description:'Cek info channel YouTube dari username',type:'profile-lookup',provider:'youtubestalk',paramKey:'username',inputLabel:'Username/Handle YouTube',placeholder:'cth: mrbeast',tag:'INFO',icon:'youtube'},
{id:'twitterstalk',slug:'twitter-stalk',name:'Twitter Stalk',title:'Twitter Stalk',description:'Cek info profil Twitter/X dari username',type:'profile-lookup',provider:'twitterstalk',paramKey:'username',inputLabel:'Username Twitter/X',placeholder:'tanpa @, cth: elonmusk',tag:'INFO',icon:'twitter'},
{id:'threadsstalk',slug:'threads-stalk',name:'Threads Stalk',title:'Threads Stalk',description:'Cek info profil Threads dari username',type:'profile-lookup',provider:'threadsstalk',paramKey:'username',inputLabel:'Username Threads',placeholder:'tanpa @, cth: zuck',tag:'INFO',icon:'at'},
{id:'snackvideostalk',slug:'snackvideo-stalk',name:'SnackVideo Stalk',title:'SnackVideo Stalk',description:'Cek info profil SnackVideo dari username',type:'profile-lookup',provider:'snackvideostalk',paramKey:'username',inputLabel:'Username SnackVideo',placeholder:'cth: nexakit',tag:'INFO',icon:'video'},
{id:'robloxstalk',slug:'roblox-stalk',name:'Roblox Stalk',title:'Roblox Stalk',description:'Cek info akun Roblox dari username',type:'profile-lookup',provider:'robloxstalk',paramKey:'username',inputLabel:'Username Roblox',placeholder:'cth: builderman',tag:'INFO',icon:'gamepad'},
{id:'pintereststalk',slug:'pinterest-stalk',name:'Pinterest Stalk',title:'Pinterest Stalk',description:'Cek info profil Pinterest dari username',type:'profile-lookup',provider:'pintereststalk',paramKey:'username',inputLabel:'Username Pinterest',placeholder:'cth: nexakit',tag:'INFO',icon:'image'},
{id:'genshinstalk',slug:'genshin-stalk',name:'Genshin Stalk',title:'Genshin Stalk',description:'Cek info akun Genshin Impact dari UID',type:'profile-lookup',provider:'genshinstalk',paramKey:'uid',inputLabel:'UID Genshin Impact',placeholder:'cth: 800000000',tag:'INFO',icon:'star'},
{id:'nulis',slug:'nulis',name:'Nulis Generator',title:'Nulis Generator',description:'Buat gambar tulisan tangan dari teks',type:'image-generator',provider:'nulis',paramKey:'text',tag:'IMAGE',icon:'pen'},
{id:'smeme',slug:'smeme',name:'Simple Meme',title:'Simple Meme',description:'Buat meme sederhana dari teks',type:'image-generator',provider:'smeme',paramKey:'text',tag:'IMAGE',icon:'laugh'},
{id:'ustadz',slug:'ustadz',name:'Kata Ustadz',title:'Kata Ustadz',description:'Buat kartu kata mutiara ala ceramah ustadz',type:'image-generator',provider:'ustadz',paramKey:'text',tag:'IMAGE',icon:'note'}
];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function isHttpUrl(value){try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:'}catch{return false}}
function setBusy(b,label='Memproses…'){const e=$('workspace-status');if(e)e.textContent=b?label:(navigator.onLine?'Siap digunakan':'Offline');document.querySelectorAll('#tool-area button,#tool-area input,#tool-area textarea,#tool-area select').forEach(el=>el.disabled=b)}
function showToast(msg,type='success'){const e=$('toast');e.hidden=false;e.textContent=(type==='error'?'Error: ':'')+msg;clearTimeout(showToast.t);showToast.t=setTimeout(()=>{e.hidden=true},3000)}
// Every tool-execution route now requires login — routed through
// window.nexakitAuthedFetch (auth.js) for our own /api/* paths only, so a
// third-party URL (e.g. YouTube's oembed endpoint) never gets our token.
async function safeJson(url,opt){if(!navigator.onLine)throw Error('Nggak ada koneksi internet nih, coba cek lagi ya.');const useAuth=url.startsWith('/api/');let r;try{r=useAuth?await window.nexakitAuthedFetch(url,opt):await fetch(url,opt)}catch(e){throw Error(e?.message||'Gagal terhubung ke server.')}const text=await r.text();if(!r.ok||!text){let msg;try{msg=JSON.parse(text).error}catch{}throw Error(msg||'Server lagi bermasalah, coba lagi sebentar ya.')}try{return JSON.parse(text)}catch{throw Error('Responsnya aneh nih, coba lagi ya.')}}
async function downloadFile(url,name='nexakit-download'){setBusy(true,'Menyiapkan download…');try{const useAuth=url.startsWith('/api/');const r=useAuth?await window.nexakitAuthedFetch(url,{mode:'cors',credentials:'omit'}):await fetch(url,{mode:'cors',credentials:'omit'});if(!r.ok)throw 0;const b=await r.blob();const o=URL.createObjectURL(b),a=document.createElement('a');a.href=o;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(o),60000);showToast('Download siap')}catch{const a=document.createElement('a');a.href=url;a.download=name;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();showToast('Download dibuka oleh browser.')}finally{setBusy(false)}}
function resultLoading(){return '<div class="skeleton-result" aria-busy="true" aria-live="polite"><span class="sr-only">Memuat hasil…</span><div class="skel-block skel-media"></div><div class="skel-block skel-line" style="width:72%"></div><div class="skel-block skel-line" style="width:46%"></div></div>'}
function resultError(e){return `<p>${esc(e?.message||'Waduh, ada yang error. Coba lagi sebentar ya.')}</p>`}
function radioValue(name){return document.querySelector(`input[name="${name}"]:checked`)?.value}
function onRadioGroup(name,cb){document.querySelectorAll(`input[name="${name}"]`).forEach(r=>r.addEventListener('change',cb))}
// ponytail: bypass/react return JSON, not an image, and their exact field
// names aren't confirmed yet — best-effort surface a link if one of the
// common field names holds one, but always show the raw JSON too so the
// feature is visibly working even before that field name gets confirmed.
function findUrlField(o,depth){
  if(depth>2||!o||typeof o!=='object')return null;
  for(const k of ['result','url','link','data']){
    const v=o[k];
    if(typeof v==='string'&&/^https?:\/\//.test(v))return v;
    if(v&&typeof v==='object'){const nested=findUrlField(v,(depth||0)+1);if(nested)return nested}
  }
  return null;
}
function renderApiJson(json){
  const link=findUrlField(json,0);
  return `${link?`<p><a href="${esc(link)}" target="_blank" rel="noopener">Buka Hasil</a></p>`:''}<pre>${esc(JSON.stringify(json,null,2))}</pre>`;
}
function uploadPreview(file,id){if(!file)return;const img=$(id);if(!img)return;const r=new FileReader();r.onload=e=>{img.src=e.target.result;img.hidden=false};r.readAsDataURL(file)}
// Drag & drop + click-to-browse over a hidden native input (keeps a11y, kills the native button).
function dropzone(id,label='Pilih gambar'){return `<label class="dropzone" for="${id}" data-dropzone><span class="dz-icon" aria-hidden="true">${svgIcon('upload')}</span><span class="dz-text"><b>${esc(label)}</b><small>atau tarik & lepas file ke sini</small></span><input id="${id}" type="file" accept="image/*"></label>`}
function initDropzones(root=document){root.querySelectorAll('[data-dropzone]').forEach(dz=>{
 if(dz.dataset.dzReady)return;dz.dataset.dzReady='1';
 const input=dz.querySelector('input[type=file]');
 const name=()=>{const f=input.files[0];const s=dz.querySelector('.dz-text b');if(f&&s)s.textContent=f.name.length>28?f.name.slice(0,25)+'…':f.name};
 ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('is-over')}));
 ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('is-over')}));
 dz.addEventListener('drop',e=>{const f=e.dataTransfer?.files?.[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))});
 input.addEventListener('change',name);
})}
window.NEXAKIT_initDropzones=initDropzones;
async function uploadToImgBB(file,slug){const f=new FormData();f.append('image',file);if(slug)f.append('slug',slug);const j=await safeJson('/api/imgbb-upload',{method:'POST',body:f});if(j.success)return j.data.url;throw Error('Gagal unggah foto ke ImgBB.')}

let tiktokData=null,tiktokFormat='hd',ytInfo=null;
function initTiktok(){const input=$('tiktok-url'),btn=$('preview-tiktok'),box=$('result-container'),content=$('result-content'),history=$('dl-history-container');
 function historyKey(){return `nexakit-history-tiktok:${window.nexakitUser||'guest'}`}
 function renderHistory(){const items=JSON.parse(localStorage.getItem(historyKey())||'[]');history.innerHTML=`<p><b>Recent downloads</b> <button id="clear-history" type="button">Bersihkan</button></p>`+(items.length?'<ul>'+items.map(h=>`<li><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.title)}</a></li>`).join('')+'</ul>':'<p>Belum ada history TikTok. Download pertama akan muncul di sini.</p>');$('clear-history')?.addEventListener('click',()=>{localStorage.removeItem(historyKey());renderHistory()})}
 function addHistory(x){const a=JSON.parse(localStorage.getItem(historyKey())||'[]');a.unshift(x);localStorage.setItem(historyKey(),JSON.stringify(a.slice(0,8)));renderHistory()}
 function render(){const d=tiktokData;const formats=[{id:'hd',name:'MP4 HD',url:d.hdplay||d.play},{id:'sd',name:'MP4 Standar',url:d.play},{id:'wm',name:'MP4 Watermark',url:d.wmplay},{id:'mp3',name:'MP3 Audio',url:d.music}].filter(x=>x.url);if(!formats.some(x=>x.id===tiktokFormat))tiktokFormat=formats[0]?.id;const s=formats.find(x=>x.id===tiktokFormat);content.innerHTML=`<video src="${esc(d.play||d.hdplay)}" controls playsinline></video><p>@${esc(d.author?.unique_id||d.author?.nickname||'tiktok')} — ${esc(d.title||'(Tanpa judul)')}</p><p>Plays: ${Number(d.play_count)||0} · Likes: ${Number(d.digg_count)||0} · Komen: ${Number(d.comment_count)||0} · Share: ${Number(d.share_count)||0}</p><p><label for="tiktok-format">Format</label><select id="tiktok-format">${formats.map(f=>`<option value="${f.id}"${f.id===tiktokFormat?' selected':''}>${f.name}</option>`).join('')}</select></p><button id="download-tiktok" type="button">Download ${esc(s?.name||'')}</button>`;$('tiktok-format').onchange=e=>{tiktokFormat=e.target.value;render()};$('download-tiktok')?.addEventListener('click',async()=>{const url=formats.find(x=>x.id===tiktokFormat)?.url;if(url){await downloadFile(url,`nexakit-tiktok-${Date.now()}.${tiktokFormat==='mp3'?'mp3':'mp4'}`);addHistory({title:d.title||'TikTok Video',url})}})}
 async function run(){box.hidden=false;content.innerHTML=resultLoading();setBusy(true,'Mengambil preview…');try{const v=input.value.trim();if(!v)throw Error('Link TikTok tidak boleh kosong.');if(!isHttpUrl(v))throw Error('Link TikTok tidak valid.');const j=await safeJson('/api/proxy?provider=tiktok&slug=tiktok&url='+encodeURIComponent(v));if(j.code!==0||!j.data)throw Error('Videonya nggak ketemu, coba cek lagi linknya.');tiktokData=j.data;tiktokFormat=tiktokData.hdplay?'hd':'sd';render();renderHistory()}catch(e){content.innerHTML=resultError(e)}finally{setBusy(false)}}
 btn.onclick=run;input.onkeydown=e=>{if(e.key==='Enter')run()};renderHistory()}
function initYoutube(){const input=$('youtube-url'),btn=$('preview-youtube'),box=$('result-container'),content=$('result-content');async function run(){const v=input.value.trim();box.hidden=false;content.innerHTML=resultLoading();setBusy(true,'Mengambil info video…');try{if(!v)throw Error('Link YouTube tidak boleh kosong.');if(!isHttpUrl(v))throw Error('Link YouTube tidak valid.');const id=(v.match(/[?&]v=([^&]+)/)||v.match(/youtu\.be\/([^?]+)/)||v.match(/shorts\/([^?]+)/))?.[1];if(!id)throw Error('Link YouTube tidak valid.');const o=await safeJson('https://www.youtube.com/oembed?url='+encodeURIComponent(v)+'&format=json');ytInfo={url:v,id,title:o.title,author:o.author_name,thumb:`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`};render()}catch(e){content.innerHTML=resultError(e)}finally{setBusy(false)}}function render(){content.innerHTML=`<img src="${esc(ytInfo.thumb)}" alt="Thumbnail"><p>${esc(ytInfo.author)} — ${esc(ytInfo.title)}</p><p>Video</p><p>${['360','480','720','1080'].map(q=>`<button data-q="${q}" type="button">MP4 ${q}p</button>`).join(' ')}</p><p>Audio</p><p><button id="yt-mp3" type="button">MP3 Audio</button></p>`;content.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>downloadYoutube('mp4',b.dataset.q,b));$('yt-mp3').onclick=()=>downloadYoutube('mp3','',$('yt-mp3'))}async function downloadYoutube(type,q,b){const old=b.textContent;b.disabled=true;b.textContent='Menyiapkan…';try{const ep=type==='mp4'?`/api/proxy?provider=ytmp4&slug=youtube&resolusi=${encodeURIComponent(q)}&url=${encodeURIComponent(ytInfo.url)}`:`/api/proxy?provider=ytmp3&slug=youtube&url=${encodeURIComponent(ytInfo.url)}`;const j=await safeJson(ep);const u=j.url||j.result||j.data?.url||j.data?.downloadUrl;if(!u)throw Error('URL download tidak tersedia dari server.');await downloadFile(u,`nexakit-youtube-${q||'mp3'}-${Date.now()}.${type==='mp4'?'mp4':'mp3'}`)}catch(e){showToast(e.message,'error')}finally{b.disabled=false;b.textContent=old}}btn.onclick=run;input.onkeydown=e=>{if(e.key==='Enter')run()}}
function initProfileLookup(tool){
 const form=$('tool-form'),input=$('pl-input'),input2=tool.paramKey2?$('pl-input2'):null,box=$('result-container'),content=$('result-content');
 form.onsubmit=async e=>{
  e.preventDefault();
  const v=input.value.trim();
  box.hidden=false;content.innerHTML=resultLoading();setBusy(true,'Mencari…');
  try{
   if(!v)throw Error(`${tool.inputLabel||'Input'} belum diisi nih.`);
   let url=`/api/proxy?provider=${encodeURIComponent(tool.provider)}&slug=${encodeURIComponent(tool.slug)}&${tool.paramKey}=${encodeURIComponent(v)}`;
   if(input2){
    const v2=input2.value.trim();
    if(!v2)throw Error(`${tool.inputLabel2||'Input kedua'} belum diisi nih.`);
    url+=`&${tool.paramKey2}=${encodeURIComponent(v2)}`;
   }
   const j=await safeJson(url);
   const d=(j.result&&typeof j.result==='object'&&!Array.isArray(j.result))?j.result:(j.data&&typeof j.data==='object'?j.data:j);
   if(j.success===false||!d||typeof d!=='object')throw Error(j.error||j.message||'Data tidak ditemukan.');
   content.innerHTML=renderProfileCard(d);
  }catch(e){content.innerHTML=resultError(e)}
  finally{setBusy(false)}
 };
}
function renderProfileCard(d){
 const avatar=d.avatar||d.photo||d.profile_pic||d.avatar_url||d.image||d.picture;
 const name=d.name||d.username||d.nickname||d.nickName||d.login||d.full_name||'Hasil';
 const skip=new Set(['avatar','photo','profile_pic','avatar_url','image','picture','name','username']);
 const rows=Object.entries(d).filter(([k,v])=>!skip.has(k)&&v!=null&&typeof v!=='object')
  .map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`).join('');
 return `<div class="profile-card">${avatar?`<img src="${esc(avatar)}" alt="${esc(name)}" class="profile-avatar">`:''}<h3>${esc(name)}</h3>${rows?`<table class="profile-table">${rows}</table>`:'<p>Data ditemukan, tapi formatnya tidak umum.</p>'}</div>`;
}
function initShortlink(){
 const form=$('tool-form'),input=$('sl-input'),box=$('result-container'),content=$('result-content');
 form.onsubmit=async e=>{
  e.preventDefault();
  const v=input.value.trim();
  box.hidden=false;content.innerHTML=resultLoading();setBusy(true,'Memendekkan link…');
  try{
   if(!v)throw Error('Link-nya belum diisi nih.');
   if(!isHttpUrl(v))throw Error('Link-nya kelihatannya belum valid, pastiin pakai http:// atau https://.');
   const j=await safeJson(`/api/shortlink?url=${encodeURIComponent(v)}`);
   if(j.success===false||!j.result)throw Error(j.error||'Gagal memendekkan link.');
   content.innerHTML=`<p class="short-result"><input id="sl-output" readonly value="${esc(j.result)}"><button type="button" id="sl-copy">Salin</button></p>`;
   $('sl-copy').onclick=()=>{navigator.clipboard.writeText(j.result).then(()=>showToast('Link tersalin!')).catch(()=>{})};
  }catch(e){content.innerHTML=resultError(e)}
  finally{setBusy(false)}
 };
}
function initSsweb(){
 const form=$('tool-form'),input=$('ss-input'),box=$('result-container'),content=$('result-content');
 form.onsubmit=async e=>{
  e.preventDefault();
  const v=input.value.trim();
  box.hidden=false;content.innerHTML=resultLoading();setBusy(true,'Mengambil screenshot, bisa sampai 30 detik…');
  try{
   if(!v)throw Error('URL-nya belum diisi nih.');
   if(!isHttpUrl(v))throw Error('URL-nya kelihatannya belum valid, pastiin pakai http:// atau https://.');
   const j=await safeJson(`/api/ssweb?url=${encodeURIComponent(v)}`);
   if(j.success===false||!j.result)throw Error(j.error||'Gagal mengambil screenshot.');
   await renderImageResult(content,j.result,`nexakit-screenshot-${Date.now()}.png`,`Screenshot ${v}`);
  }catch(e){content.innerHTML=resultError(e)}
  finally{setBusy(false)}
 };
}function initNexaDrama(){
 $('drama-search-btn').onclick=()=>{
  const q=$('drama-search-input').value.trim();
  if(q)loadDramaList('dramasearch',{q});else loadDramaHome();
 };
 $('drama-search-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('drama-search-btn').click()}});
 loadDramaHome();
}
function extractDramaList(j){
 const raw=Array.isArray(j.result)?j.result:Array.isArray(j.data)?j.data:Array.isArray(j)?j:[];
 return raw.map(d=>({
  id:d.id??d.book_id??d.bookId??d.slug??d.code,
  title:d.title??d.name??d.book_name??'Tanpa Judul',
  poster:d.poster??d.cover??d.thumbnail??d.image??d.cover_url,
 })).filter(d=>d.id!=null);
}
function renderDramaGrid(list){
 const body=$('drama-body');
 if(!list.length){body.innerHTML='<p>Drama tidak ditemukan.</p>';return}
 body.innerHTML=`<div class="drama-grid">${list.map(d=>`<button type="button" class="drama-card" data-id="${esc(d.id)}">${d.poster?`<img src="${esc(d.poster)}" alt="${esc(d.title)}" loading="lazy">`:'<span class="drama-noposter"><i class="fa fa-film" aria-hidden="true"></i></span>'}<span>${esc(d.title)}</span></button>`).join('')}</div>`;
 body.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>loadDramaDetail(b.dataset.id));
}
async function loadDramaHome(){
 const body=$('drama-body');body.innerHTML=resultLoading();
 try{renderDramaGrid(extractDramaList(await safeJson('/api/proxy?provider=dramahome&slug=nexadrama')))}
 catch(e){body.innerHTML=resultError(e)}
}
async function loadDramaList(provider,params){
 const body=$('drama-body');body.innerHTML=resultLoading();
 try{renderDramaGrid(extractDramaList(await safeJson(`/api/proxy?provider=${provider}&slug=nexadrama&${new URLSearchParams(params)}`)))}
 catch(e){body.innerHTML=resultError(e)}
}
async function loadDramaDetail(id){
 const body=$('drama-body');body.innerHTML=resultLoading();
 try{
  const j=await safeJson(`/api/proxy?provider=dramadetail&slug=nexadrama&id=${encodeURIComponent(id)}`);
  const d=(j.result&&typeof j.result==='object'&&!Array.isArray(j.result))?j.result:(j.data||j);
  const title=d.title??d.name??'Tanpa Judul';
  const poster=d.poster??d.cover??d.thumbnail??d.image;
  const synopsis=d.synopsis??d.description??d.desc??'';
  const epsRaw=Array.isArray(d.episodes)?d.episodes:Array.isArray(d.episode_list)?d.episode_list:Array.isArray(d.chapters)?d.chapters:[];
  const episodes=epsRaw.length?epsRaw.map((e,i)=>({num:e.episode??e.number??e.ep??(i+1),id:e.id??e.episode??e.number??(i+1)}))
   :(typeof d.total_episode==='number'?Array.from({length:d.total_episode},(_,i)=>({num:i+1,id:i+1})):[]);
  body.innerHTML=`<button type="button" class="drama-back" id="drama-back-home">&larr; Semua Drama</button>
   <div class="drama-detail">${poster?`<img src="${esc(poster)}" alt="${esc(title)}" class="drama-detail-poster">`:''}<h3>${esc(title)}</h3>
   ${synopsis?`<p class="drama-synopsis">${esc(synopsis)}</p>`:''}
   <div class="eyebrow" style="margin:14px 0 8px;display:block">EPISODE</div>
   <div class="drama-eps">${episodes.length?episodes.map(e=>`<button type="button" class="drama-ep-btn" data-ep="${esc(e.id)}">${esc(e.num)}</button>`).join(''):'<p>Info episode tidak tersedia.</p>'}</div></div>`;
  $('drama-back-home').onclick=loadDramaHome;
  body.querySelectorAll('[data-ep]').forEach(b=>b.onclick=()=>loadDramaStream(id,b.dataset.ep,title));
 }catch(e){body.innerHTML=resultError(e)+'<p><button type="button" class="drama-back" id="drama-back-home2">&larr; Semua Drama</button></p>';$('drama-back-home2').onclick=loadDramaHome}
}
async function loadDramaStream(id,episode,title){
 const body=$('drama-body');body.innerHTML=resultLoading();
 try{
  const j=await safeJson(`/api/proxy?provider=dramastream&slug=nexadrama&id=${encodeURIComponent(id)}&episode=${encodeURIComponent(episode)}`);
  const d=(j.result&&typeof j.result==='object'&&!Array.isArray(j.result))?j.result:(j.data||j);
  const stream=d.url??d.stream_url??d.video??d.video_url??d.link??(typeof j.result==='string'?j.result:null);
  if(!stream)throw Error('Link streaming tidak ditemukan.');
  body.innerHTML=`<button type="button" class="drama-back" id="drama-back-detail">&larr; ${esc(title||'Detail')}</button>
   <video src="${esc(stream)}" controls playsinline style="width:100%;border-radius:var(--r-lg);display:block"></video>
   <p><button type="button" id="drama-download">Download Episode</button></p>`;
  $('drama-back-detail').onclick=()=>loadDramaDetail(id);
  $('drama-download').onclick=()=>downloadFile(stream,`nexadrama-${id}-ep${episode}.mp4`);
 }catch(e){body.innerHTML=resultError(e)+'<p><button type="button" class="drama-back" id="drama-back-detail2">&larr; Kembali</button></p>';$('drama-back-detail2').onclick=()=>loadDramaDetail(id)}
}
// Komikindo manga browser — same search/grid/detail shape as NexaDrama
// above (reuses its drama-grid/drama-card/drama-back CSS classes, since the
// list->detail pattern is identical, just manga instead of drama). Field
// names in extractMangaList/loadMangaDetail are guessed defensively with
// `??` fallbacks since the upstream host wasn't reachable to confirm its
// exact response shape — check these once real data comes back and tell me
// if a field needs adjusting.
function initKomikindo(){
 $('drama-search-btn').onclick=()=>{
  const q=$('drama-search-input').value.trim();
  if(q)loadMangaList('komikindosearch',{q});else loadMangaLatest();
 };
 $('drama-search-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('drama-search-btn').click()}});
 loadMangaLatest();
}
function extractMangaList(j){
 const raw=Array.isArray(j.result)?j.result:Array.isArray(j.data)?j.data:Array.isArray(j)?j:[];
 return raw.map(m=>({
  id:m.id??m.slug??m.endpoint??m.komik_id,
  title:m.title??m.name??m.judul??'Tanpa Judul',
  poster:m.poster??m.cover??m.thumbnail??m.image,
 })).filter(m=>m.id!=null);
}
async function loadMangaLatest(){
 const body=$('drama-body');body.innerHTML=resultLoading();
 try{renderMangaGrid(extractMangaList(await safeJson('/api/proxy?provider=komikindolatest&slug=komikindo')))}
 catch(e){body.innerHTML=resultError(e)}
}
async function loadMangaList(provider,params){
 const body=$('drama-body');body.innerHTML=resultLoading();
 try{renderMangaGrid(extractMangaList(await safeJson(`/api/proxy?provider=${provider}&slug=komikindo&${new URLSearchParams(params)}`)))}
 catch(e){body.innerHTML=resultError(e)}
}
// renderDramaGrid calls loadDramaDetail(id) on click — swap that binding for
// manga since it's the same markup/CSS but a different detail loader.
function renderMangaGrid(list){
 renderDramaGrid(list);
 $('drama-body').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>loadMangaDetail(b.dataset.id));
}
async function loadMangaDetail(id){
 const body=$('drama-body');body.innerHTML=resultLoading();
 try{
  const j=await safeJson(`/api/proxy?provider=komikindoinfo&slug=komikindo&id=${encodeURIComponent(id)}`);
  const d=(j.result&&typeof j.result==='object'&&!Array.isArray(j.result))?j.result:(j.data||j);
  const title=d.title??d.name??d.judul??'Tanpa Judul';
  const poster=d.poster??d.cover??d.thumbnail??d.image;
  const synopsis=d.synopsis??d.description??d.sinopsis??'';
  const chRaw=Array.isArray(d.chapters)?d.chapters:Array.isArray(d.chapter_list)?d.chapter_list:[];
  const chapters=chRaw.map((c,i)=>({num:c.chapter??c.number??c.title??(i+1),id:c.id??c.chapter??c.slug??(i+1)}));
  body.innerHTML=`<button type="button" class="drama-back" id="manga-back-home">&larr; Semua Manga</button>
   <div class="drama-detail">${poster?`<img src="${esc(poster)}" alt="${esc(title)}" class="drama-detail-poster">`:''}<h3>${esc(title)}</h3>
   ${synopsis?`<p class="drama-synopsis">${esc(synopsis)}</p>`:''}
   <div class="eyebrow" style="margin:14px 0 8px;display:block">CHAPTER</div>
   <div class="drama-eps">${chapters.length?chapters.map(c=>`<button type="button" class="drama-ep-btn" data-ch="${esc(c.id)}">${esc(c.num)}</button>`).join(''):'<p>Info chapter tidak tersedia.</p>'}</div></div>`;
  $('manga-back-home').onclick=loadMangaLatest;
  body.querySelectorAll('[data-ch]').forEach(b=>b.onclick=()=>loadMangaChapter(id,b.dataset.ch,title));
 }catch(e){body.innerHTML=resultError(e)+'<p><button type="button" class="drama-back" id="manga-back-home2">&larr; Semua Manga</button></p>';$('manga-back-home2').onclick=loadMangaLatest}
}
async function loadMangaChapter(id,chapter,title){
 const body=$('drama-body');body.innerHTML=resultLoading();
 try{
  const j=await safeJson(`/api/proxy?provider=komikindodownload&slug=komikindo&id=${encodeURIComponent(id)}&chapter=${encodeURIComponent(chapter)}`);
  const d=(j.result&&typeof j.result==='object'&&!Array.isArray(j.result))?j.result:(j.data||j);
  const pages=Array.isArray(d)?d:Array.isArray(d.pages)?d.pages:Array.isArray(d.images)?d.images:[];
  const directLink=!pages.length?(d.url??d.download??d.link??(typeof j.result==='string'?j.result:null)):null;
  body.innerHTML=`<button type="button" class="drama-back" id="manga-back-detail">&larr; ${esc(title||'Detail')}</button>`+
   (pages.length?`<div class="manga-pages">${pages.map(p=>`<img src="${esc(typeof p==='string'?p:p.url??p.image)}" alt="Halaman" loading="lazy">`).join('')}</div>`
    :directLink?`<p><a href="${esc(directLink)}" target="_blank" rel="noopener">Buka link download chapter</a></p>`
    :'<p>Halaman/chapter tidak ditemukan.</p>');
  $('manga-back-detail').onclick=()=>loadMangaDetail(id);
 }catch(e){body.innerHTML=resultError(e)+'<p><button type="button" class="drama-back" id="manga-back-detail2">&larr; Kembali</button></p>';$('manga-back-detail2').onclick=()=>loadMangaDetail(id)}
}
function initGeneric(tool){const form=$('tool-form'),input=$('tool-input'),box=$('result-container'),content=$('result-content');form.onsubmit=async e=>{e.preventDefault();const v=input.value.trim();box.hidden=false;content.innerHTML=resultLoading();setBusy(true,'Mengambil media…');try{if(!v)throw Error('Link-nya belum diisi nih.');if(!isHttpUrl(v))throw Error('Link-nya kelihatannya belum valid, pastiin pakai http:// atau https://.');const j=await safeJson(`/api/proxy?provider=${encodeURIComponent(tool.provider)}&slug=${encodeURIComponent(tool.slug)}&${tool.paramKey}=${encodeURIComponent(v)}`);let u,title;if(Array.isArray(j.result)&&j.result.length){u=j.result[0].url||j.result[0].link;title=j.result[0].title||j.result[0].caption}else if(Array.isArray(j.data)&&j.data.length){u=j.data[0]?.url||j.data[0]?.link||j.data[0];title=j.data[0]?.title||j.data[0]?.caption}else{u=j.result||j.url||j.link||j.data?.url||j.data?.downloadUrl;title=j.title||j.caption||j.data?.title}if(!u||typeof u!=='string')throw Error(j.error||j.message||'Gagal mendapatkan media.');const video=/\.(mp4|mov|webm)(\?|$)/i.test(u)||tool.id==='ig';const audio=!video&&(/\.(mp3|wav|m4a)(\?|$)/i.test(u)||tool.id==='spotify');let media=video?`<video src="${esc(u)}" controls playsinline></video>`:audio?`<audio src="${esc(u)}" controls></audio>`:`<img src="${esc(u)}" alt="Preview">`;content.innerHTML=media+(title?`<p><b>Info:</b> ${esc(title)}</p>`:'')+`<p><button id="download-result" type="button">Download</button></p>`;$('download-result').onclick=()=>downloadFile(u,`nexakit-${tool.slug}-${Date.now()}`)}catch(e){content.innerHTML=resultError(e)}finally{setBusy(false)}}}
function initImageTool(type){const input=$('image-file'),btn=$('tool-submit'),box=$('result-container'),content=$('result-content');input.addEventListener('change',()=>uploadPreview(input.files[0],'file-preview'));btn.onclick=async e=>{e.preventDefault();box.hidden=false;content.innerHTML=resultLoading();setBusy(true,'Memproses gambar…');try{const file=input.files[0];if(!file)throw Error('Pilih gambar terlebih dahulu.');if(type==='remove-bg'){const f=new FormData();f.append('image_file',file);f.append('size','auto');const r=await window.nexakitAuthedFetch('/api/remove-bg',{method:'POST',body:f});if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Gagal menghapus background.')}const blob=await r.blob(),u=URL.createObjectURL(blob);content.innerHTML=`<img src="${u}" alt="Hasil Remove Background"><p><a href="${u}" download="removebg-result.png">Unduh PNG</a></p>`}else if(type==='img2link'){const u=await uploadToImgBB(file,'img2link');content.innerHTML=`<img src="${esc(u)}" alt="Uploaded image"><p><input value="${esc(u)}" readonly></p><p><button id="copy-url" type="button">Salin Link</button></p>`;$('copy-url').onclick=()=>navigator.clipboard.writeText(u).then(()=>showToast('Link tersalin'))}else{const up=await uploadToImgBB(file,'image-enhancer');const u=`/api/proxy?provider=enhancer&slug=image-enhancer&url=${encodeURIComponent(up)}`;content.innerHTML=`<p>Sebelum</p><img src="${esc(up)}" alt="Sebelum"><p>Sesudah</p><img src="${esc(u)}" alt="Sesudah"><p><button id="download-image-result" type="button">Unduh Hasil</button></p>`;$('download-image-result').onclick=()=>downloadFile(u,`nexakit-enhanced-${Date.now()}.png`)}}catch(e){content.innerHTML=resultError(e)}finally{setBusy(false)}}}
function stampWatermark(ctx,w,h,text){
 ctx.save();ctx.globalAlpha=.4;ctx.fillStyle='#ff2d55';
 ctx.font=`bold ${Math.max(13,Math.round(w/16))}px Inter,system-ui,sans-serif`;
 ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.translate(w/2,h/2);ctx.rotate(-Math.PI/9);
 ctx.fillText(text,0,0);
 ctx.restore();
}
async function renderImageResult(content,u,name,altText,watermark){
 altText=altText||'Hasil';
 try{
  const r=await window.nexakitAuthedFetch(u);if(!r.ok)throw 0;
  const blob=await r.blob();
  let fullUrl=URL.createObjectURL(blob);
  let previewSrc=fullUrl;
  if(blob.type!=='image/gif'&&'createImageBitmap' in window){
   try{
    const bmp=await createImageBitmap(blob);
    if(watermark){
     const full=document.createElement('canvas');full.width=bmp.width;full.height=bmp.height;
     const fctx=full.getContext('2d');fctx.drawImage(bmp,0,0);stampWatermark(fctx,full.width,full.height,watermark);
     const fullBlob=await new Promise(res=>full.toBlob(res,'image/png'));
     if(fullBlob){URL.revokeObjectURL(fullUrl);fullUrl=URL.createObjectURL(fullBlob)}
    }
    const scale=Math.min(1,480/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(bmp.width*scale));c.height=Math.max(1,Math.round(bmp.height*scale));
    const cctx=c.getContext('2d');cctx.drawImage(bmp,0,0,c.width,c.height);
    if(watermark)stampWatermark(cctx,c.width,c.height,watermark);
    previewSrc=c.toDataURL('image/jpeg',.6);
   }catch{}
  }
  content.innerHTML=`<img src="${previewSrc}" alt="${esc(altText)}"><p><button id="maker-download" type="button">Simpan ukuran penuh</button></p>`;
  $('maker-download').onclick=()=>downloadFile(fullUrl,name);
 }catch{
  content.innerHTML=`<img src="${esc(u)}" alt="${esc(altText)}"><p><button id="maker-download" type="button">Simpan Gambar</button></p>`;
  $('maker-download').onclick=()=>downloadFile(u,name);
 }
}
function initMaker(tool){const form=$('maker-form'),box=$('result-container'),content=$('result-content');form.onsubmit=async e=>{e.preventDefault();box.hidden=false;content.innerHTML=resultLoading();setBusy(true,'Membuat gambar…');try{let u,name='nexakit-result.png';if(tool.type==='bypass'){const link=$('bypass-url').value.trim();if(!link)throw Error('Masukkan link yang mau di-bypass.');if(!isHttpUrl(link))throw Error('Link tidak valid.');const j=await safeJson(`/api/proxy?provider=bypass&slug=bypass-link&url=${encodeURIComponent(link)}`);content.innerHTML=renderApiJson(j);return}if(tool.type==='react'){const link=$('react-url').value.trim(),emoji=$('react-emoji').value.trim()||'👍';if(!link)throw Error('Masukkan link postingan channel.');if(!isHttpUrl(link))throw Error('Link tidak valid.');const j=await safeJson(`/api/proxy?provider=react&slug=react-wa&url=${encodeURIComponent(link)}&emoji=${encodeURIComponent(emoji)}`);content.innerHTML=renderApiJson(j);return}if(tool.type==='brat'){const variant=radioValue('brat-variant');if(variant==='brat3'){const top=$('brat3-top').value.trim(),mid=$('brat3-mid').value.trim(),bottom=$('brat3-bottom').value.trim();if(!top||!mid||!bottom)throw Error('Baris atas, tengah, dan bawah wajib diisi.');const r=await window.nexakitAuthedFetch('/api/brat3',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({top,mid,bottom})});if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Gagal membuat gambar.')}const blob=await r.blob();u=URL.createObjectURL(blob);name=`nexakit-brat3-${Date.now()}.png`;content.innerHTML=`<img src="${u}" alt="Hasil"><p><button id="maker-download" type="button">Simpan Gambar</button></p>`;$('maker-download').onclick=()=>downloadFile(u,name);return}if(variant==='bratvid'){const text=$('maker-text').value.trim();if(!text)throw Error('Masukkan teks untuk Brat Video.');const theme='white',format='mp4';setBusy(true,'Merender video, bisa sampai 30 detik…');const r=await window.nexakitAuthedFetch('/api/bratvid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,theme,format})});if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Gagal membuat video.')}const blob=await r.blob();u=URL.createObjectURL(blob);name=`nexakit-bratvid-${Date.now()}.${format}`;content.innerHTML=`<video src="${u}" controls playsinline loop></video><p><button id="maker-download" type="button">Simpan Video</button></p>`;$('maker-download').onclick=()=>downloadFile(u,name);return}const text=$('maker-text').value.trim();if(!text)throw Error('Masukkan teks untuk Brat.');const animated=variant==='animated',delay=$('brat-delay').value||500;u=`/api/proxy?provider=brat&slug=brat&text=${encodeURIComponent(text)}${animated?'&isAnimated=true&delay='+encodeURIComponent(delay):''}`;name=`nexakit-brat-${Date.now()}.${animated?'gif':'png'}`}else if(tool.type==='iqc'){const text=$('maker-text').value.trim(),time=$('maker-time').value.trim();if(!text)throw Error('Masukkan quote.');u=`/api/iqc-text?text=${encodeURIComponent(text)}&time=${encodeURIComponent(time||Date.now())}`;name=`nexakit-iqc-${Date.now()}.png`}else if(tool.type==='lobby-ml'){const nick=$('maker-text').value.trim(),file=$('maker-file').files[0];if(!nick||!file)throw Error('Nickname dan avatar wajib diisi.');const av=await uploadToImgBB(file,'lobby-ml');u=`/api/proxy?provider=lobbyml&slug=lobby-ml&nickname=${encodeURIComponent(nick)}&avatar=${encodeURIComponent(av)}`;name=`nexakit-lobby-ml-${Date.now()}.png`}else if(tool.type==='fakedev'){const n=$('maker-name').value.trim(),bio=$('maker-bio').value.trim(),file=$('maker-file').files[0];if(!n||!bio||!file)throw Error('Nama, bio, dan avatar wajib diisi.');const av=await uploadToImgBB(file,'fakedev');u=`/api/proxy?provider=fakedev&slug=fakedev&nama=${encodeURIComponent(n)}&bio=${encodeURIComponent(bio)}&image=${encodeURIComponent(av)}`;name=`nexakit-fakedev-${Date.now()}.png`}else{let v,extra='';if(tool.paramKey2){const v1=$('maker-name1').value.trim(),v2=$('maker-name2').value.trim();if(!v1||!v2)throw Error('Kedua input wajib diisi.');v=v1;extra=`&${encodeURIComponent(tool.paramKey2)}=${encodeURIComponent(v2)}`}else{v=$('maker-text').value.trim();if(!v)throw Error('Input wajib diisi.');if(tool.paramKey==='nominal'){v=v.replace(/\D/g,'');if(!v)throw Error('Nominal saldo harus diisi dengan angka.');}}u=`/api/proxy?provider=${encodeURIComponent(tool.provider)}&slug=${encodeURIComponent(tool.slug)}&${encodeURIComponent(tool.paramKey)}=${encodeURIComponent(v)}${extra}`;name=`nexakit-${tool.slug}-${Date.now()}.png`}await renderImageResult(content,u,name,`Hasil ${tool.title}`,['fakedana','fakebankjago','fakegopay','fakeovo'].includes(tool.provider)?'CONTOH — BUKAN BUKTI TRANSAKSI ASLI':null)}catch(e){content.innerHTML=resultError(e)}finally{setBusy(false)}};if(tool.type==='brat'){const sync=()=>{const v=radioValue('brat-variant')||'static';$('brat-text-wrap').hidden=v==='brat3';$('brat-delay-wrap').hidden=v!=='animated';$('brat3-wrap').hidden=v!=='brat3'};onRadioGroup('brat-variant',sync);sync()}}

const area=$('tool-area');
let activeTool=TOOLS[0];
function clearView(){area.innerHTML='';$('result-container').hidden=true;$('result-content').innerHTML='';$('dl-history-container').innerHTML=''}
function base(title,desc,form){area.innerHTML=`<div class="tool-form-card"><div class="tool-form-heading"><span class="eyebrow">TOOL INPUT</span><h3>${esc(title)}</h3>${desc?`<p>${esc(desc)}</p>`:''}</div><div class="tool-form-body">${form}</div></div>`;initDropzones(area)}
function render(tool){clearView();
 if(tool.type==='tiktok'){base('Link TikTok','',`<p><input id="tiktok-url" type="url" placeholder="Tempel link TikTok..."></p><button id="preview-tiktok" type="button">Preview</button>`);initTiktok();return}
 if(tool.type==='youtube'){base('Link YouTube','',`<p><input id="youtube-url" type="url" placeholder="Tempel link YouTube..."></p><button id="preview-youtube" type="button">Preview</button>`);initYoutube();return}
 if(tool.type==='generic-downloader'){base('Link '+tool.name,'',`<form id="tool-form"><p><input id="tool-input" type="url" placeholder="Tempel link ${esc(tool.name)}..."></p><button type="submit">Preview</button></form>`);initGeneric(tool);return}
 if(tool.type==='profile-lookup'){
  const field2=tool.paramKey2?`<p><label for="pl-input2">${esc(tool.inputLabel2)}</label><input id="pl-input2" placeholder="${esc(tool.placeholder2||'')}"></p>`:'';
  base(tool.title,'',`<form id="tool-form"><p><label for="pl-input">${esc(tool.inputLabel||'Input')}</label><input id="pl-input" placeholder="${esc(tool.placeholder||'')}"></p>${field2}<button type="submit">Cari</button></form>`);
  initProfileLookup(tool);return;
 }
 if(tool.type==='shortlink'){base(tool.title,'',`<form id="tool-form"><p><label for="sl-input">Link asli</label><input id="sl-input" type="url" placeholder="https://..."></p><button type="submit">Pendekin</button></form>`);initShortlink();return}
 if(tool.type==='ssweb'){base(tool.title,'',`<form id="tool-form"><p><label for="ss-input">URL Website</label><input id="ss-input" type="url" placeholder="https://..."></p><button type="submit">Screenshot</button></form>`);initSsweb();return}
 if(tool.type==='nexadrama'){
  base(tool.title,tool.description,`<div id="drama-app"><div id="drama-search-row"><input id="drama-search-input" type="search" placeholder="Cari judul drama..."><button type="button" id="drama-search-btn">Cari</button></div><div id="drama-body"></div></div>`);
  initNexaDrama();return;
 }
 if(tool.type==='komikindo'){
  base(tool.title,tool.description,`<div id="drama-app"><div id="drama-search-row"><input id="drama-search-input" type="search" placeholder="Cari judul manga..."><button type="button" id="drama-search-btn">Cari</button></div><div id="drama-body"></div></div>`);
  initKomikindo();return;
 }
 if(['remove-bg','img2link','image-enhancer'].includes(tool.type)){const action=tool.type==='remove-bg'?'Remove Background':tool.type==='img2link'?'Upload':'Enhance';base(tool.title,'',`<form><p>${dropzone('image-file')}</p><p><img id="file-preview" hidden alt="Preview"></p><button id="tool-submit" type="submit">${action}</button></form>`);initImageTool(tool.type);return}
 let form='';
 if(tool.type==='bypass')form=`<form id="maker-form"><p><input id="bypass-url" type="url" placeholder="Tempel link yang mau di-bypass..." required></p><button type="submit">Bypass</button></form>`;
 else if(tool.type==='react')form=`<form id="maker-form"><p><input id="react-url" type="url" placeholder="Link postingan channel WhatsApp..." required></p><p><input id="react-emoji" placeholder="Emoji, cth: 👍" maxlength="8"></p><button type="submit">React</button></form>`;
 else if(tool.type==='brat')form=`<form id="maker-form"><p><label>Jenis</label><span class="pill-radio-group"><label class="pill-radio"><input type="radio" name="brat-variant" value="static" checked><span>Static (PNG)</span></label><label class="pill-radio"><input type="radio" name="brat-variant" value="animated"><span>Animated (GIF)</span></label><label class="pill-radio"><input type="radio" name="brat-variant" value="bratvid"><span>Video Bounce</span></label><label class="pill-radio"><input type="radio" name="brat-variant" value="brat3"><span>Stacked 3 Baris</span></label></span></p><p id="brat-text-wrap"><label for="maker-text">Teks</label><input id="maker-text" placeholder="Tulis teks..." maxlength="80"></p><p id="brat-delay-wrap" hidden><label for="brat-delay">Delay animasi</label><input id="brat-delay" type="number" min="100" step="100" value="500" placeholder="Delay (ms), cth: 500"></p><p id="brat3-wrap" hidden><label for="brat3-top">Baris atas</label><input id="brat3-top" placeholder="Baris atas (abu-abu)" maxlength="60"><label for="brat3-mid">Baris tengah</label><input id="brat3-mid" placeholder="Baris tengah (hitam, besar)" maxlength="60"><label for="brat3-bottom">Baris bawah</label><input id="brat3-bottom" placeholder="Baris bawah (abu-abu)" maxlength="60"></p><button type="submit">Buat</button></form>`;
 else if(tool.type==='iqc')form=`<form id="maker-form"><p><label for="maker-text">Quote</label><textarea id="maker-text" placeholder="Tulis quote..."></textarea></p><p><label for="maker-time">Waktu (opsional)</label><input id="maker-time" type="time"></p><button type="submit">Buat</button></form>`;
 else if(tool.type==='lobby-ml')form=`<form id="maker-form"><p><label for="maker-text">Nickname</label><input id="maker-text" placeholder="Nickname"></p><p><label for="maker-file">Avatar</label>${dropzone('maker-file','Pilih avatar')}</p><button type="submit">Buat</button></form>`;
 else if(tool.type==='fakedev')form=`<form id="maker-form"><p><label for="maker-name">Nama</label><input id="maker-name" placeholder="Nama"></p><p><label for="maker-bio">Bio</label><textarea id="maker-bio" placeholder="Bio"></textarea></p><p><label for="maker-file">Avatar</label>${dropzone('maker-file','Pilih avatar')}</p><button type="submit">Buat</button></form>`;
 else if(tool.paramKey2)form=`<form id="maker-form"><p><label for="maker-name1">${esc(tool.inputLabel||'Input 1')}</label><input id="maker-name1" placeholder="${esc(tool.placeholder||'')}"></p><p><label for="maker-name2">${esc(tool.inputLabel2||'Input 2')}</label><input id="maker-name2" placeholder="${esc(tool.placeholder2||'')}"></p><button type="submit">Buat</button></form>`;
 else form=`<form id="maker-form"><p><input id="maker-text" ${tool.paramKey==='nominal'?'inputmode="numeric" pattern="[0-9]*"':''} placeholder="${esc(tool.paramKey==='nominal'?'Nominal, cth: 500000':tool.title+' input')}"></p><button type="submit">Buat</button></form>`;
 base(tool.title,tool.description,form);initMaker(tool)
}
window.NEXAKIT_render=render;
window.addEventListener('online',()=>setBusy(false));
window.addEventListener('offline',()=>setBusy(false));

// Settings dialog (backdrop click or close button dismisses it)
function openSettings(){$('settings-overlay').hidden=false;$('settings-modal').hidden=false;initDropzones($('settings-modal'))}
function closeSettings(){$('settings-overlay').hidden=true;$('settings-modal').hidden=true}
window.NEXAKIT_openSettings=openSettings;
$('settings-overlay').onclick=closeSettings;
$('settings-close').onclick=closeSettings;
function settingsMsg(text,type){const e=$('settings-msg');e.hidden=false;e.textContent=(type==='error'?'Error: ':'')+text;e.className=type==='error'?'status-err':'status-ok'}
$('settings-save-profile').onclick=async()=>{
 const btn=$('settings-save-profile');btn.disabled=true;
 try{await window.nexakitApi.updateProfile({display_name:$('settings-name').value.trim()||window.nexakitUser});settingsMsg('Profil tersimpan.','ok');$('user-name').textContent=$('settings-name').value.trim()||window.nexakitUser}
 catch(e){settingsMsg(e.message,'error')}
 finally{btn.disabled=false}
};
$('settings-save-pass').onclick=async()=>{
 const btn=$('settings-save-pass'),pass=$('settings-newpass').value;btn.disabled=true;
 try{await window.nexakitApi.changePassword(pass);settingsMsg('Password berhasil diganti.','ok');$('settings-newpass').value=''}
 catch(e){settingsMsg(e.message,'error')}
 finally{btn.disabled=false}
};
$('avatar-input').addEventListener('change',async()=>{
 const file=$('avatar-input').files[0];if(!file)return;
 if(!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)){settingsMsg('Gunakan JPG, PNG, WEBP, atau GIF.','error');return}
 if(file.size>5*1024*1024){settingsMsg('Foto maksimal 5 MB.','error');return}
 try{
  const dataUrl=await new Promise((resolve,reject)=>{const img=new Image(),reader=new FileReader();reader.onerror=()=>reject(Error('Gagal membaca file.'));reader.onload=()=>{img.onload=()=>{const max=480,scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.78))};img.onerror=()=>reject(Error('File gambar tidak valid.'));img.src=reader.result};reader.readAsDataURL(file)});
  $('avatar-preview-img').src=dataUrl;$('avatar-preview-img').hidden=false;$('avatar-preview-fallback').hidden=true;
  await window.nexakitApi.updateProfile({avatar_url:dataUrl});
  settingsMsg('Foto profil tersimpan.','ok');
 }catch(e){settingsMsg(e.message||'Gagal menyimpan foto.','error')}
});

// Feedback dialog — same overlay/close pattern as Settings above.
function openFeedback(){$('feedback-overlay').hidden=false;$('feedback-modal').hidden=false;$('feedback-msg').hidden=true;$('feedback-wa').href=waFeedbackLink()}
function closeFeedback(){$('feedback-overlay').hidden=true;$('feedback-modal').hidden=true}
function waFeedbackLink(kind,msg){
 const tpl=`Halo Admin NexaKit Pro%0A%0AJenis: ${encodeURIComponent(kind||'(Saran/Kritik/Request Fitur/Bug)')}%0ADeskripsi: ${encodeURIComponent(msg||'')}%0A%0ADikirim dari menu NexaKit Pro`;
 return `https://wa.me/6285722707676?text=${tpl}`;
}
window.NEXAKIT_openFeedback=openFeedback;
$('feedback-overlay').onclick=closeFeedback;
$('feedback-close').onclick=closeFeedback;
function feedbackMsg(text,type){const e=$('feedback-msg');e.hidden=false;e.textContent=(type==='error'?'Error: ':'')+text;e.className=type==='error'?'status-err':'status-ok'}
$('feedback-submit').onclick=async()=>{
 const btn=$('feedback-submit'),kind=$('feedback-kind').value,message=$('feedback-message').value.trim();
 $('feedback-wa').href=waFeedbackLink(kind,message);
 if(!message){feedbackMsg('Tulis dulu detailnya ya.','error');return}
 btn.disabled=true;
 try{await window.nexakitApi.submitFeedback({kind,message});feedbackMsg('Terkirim, makasih! Tim kami akan cek.','ok');$('feedback-message').value=''}
 catch(e){feedbackMsg(e.message+' Coba chat WhatsApp di bawah ini sebagai alternatif.','error')}
 finally{btn.disabled=false}
};
