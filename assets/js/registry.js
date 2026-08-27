/* Single source of truth for NexaKit Pro tool discovery and routing. */
const TOOLS = Object.freeze([
  {id:'tt',slug:'tiktok',name:'TikTok',title:'TikTok Downloader',description:'Download video TikTok tanpa watermark',category:'downloader',path:'/tools/tiktok/',type:'tiktok'},
  {id:'ig',slug:'instagram',name:'Instagram',title:'Instagram Downloader',description:'Unduh video & foto Instagram HD',category:'downloader',path:'/tools/instagram/',type:'generic-downloader',provider:'ig',paramKey:'url'},
  {id:'spotify',slug:'spotify',name:'Spotify',title:'Spotify Downloader',description:'Unduh musik Spotify ke MP3',category:'downloader',path:'/tools/spotify/',type:'generic-downloader',provider:'spotify',paramKey:'url'},
  {id:'terabox',slug:'terabox',name:'Terabox',title:'Terabox Downloader',description:'Ambil file dari share Terabox',category:'downloader',path:'/tools/terabox/',type:'generic-downloader',provider:'terabox',paramKey:'url'},
  {id:'yt_engine',slug:'youtube',name:'YouTube',title:'YouTube Downloader',description:'Unduh MP4 360p-1080p atau MP3 dari YouTube',category:'downloader',path:'/tools/youtube/',type:'youtube'},
  {id:'fb',slug:'facebook',name:'Facebook',title:'Facebook Downloader',description:'Unduh video Facebook tanpa watermark',category:'downloader',path:'/tools/facebook/',type:'generic-downloader',provider:'fb',paramKey:'url'},
  {id:'tw',slug:'twitter',name:'Twitter / X',title:'Twitter/X Downloader',description:'Unduh video & foto dari Twitter/X',category:'downloader',path:'/tools/twitter/',type:'generic-downloader',provider:'tw',paramKey:'url'},
  {id:'capcut',slug:'capcut',name:'CapCut',title:'CapCut Downloader',description:'Unduh video template/hasil CapCut',category:'downloader',path:'/tools/capcut/',type:'generic-downloader',provider:'capcut',paramKey:'url'},
  {id:'savefrom',slug:'savefrom',name:'SaveFrom',title:'SaveFrom Downloader',description:'Unduh media dari banyak platform',category:'downloader',path:'/tools/savefrom/',type:'generic-downloader',provider:'savefrom',paramKey:'url'},
  {id:'lahelu',slug:'lahelu',name:'Lahelu',title:'Lahelu Downloader',description:'Unduh video/gambar dari Lahelu',category:'downloader',path:'/tools/lahelu/',type:'generic-downloader',provider:'lahelu',paramKey:'url'},
  {id:'brat_gen',slug:'brat',name:'Brat Generator',title:'Brat Generator',description:'Buat stiker BRAT static & animated',category:'maker',path:'/tools/brat/',type:'brat',provider:'brat'},
  {id:'iqc',slug:'iqc',name:'iPhone Quote Create',title:'iPhone Quote Create',description:'Buat kartu quote ala iPhone Notes',category:'maker',path:'/tools/iqc/',type:'iqc'},
  {id:'sertifikat_tolol',slug:'sertifikat-tolol',name:'Sertifikat Tolol',title:'Sertifikat Tolol',description:'Buat sertifikat meme kocak',category:'maker',path:'/tools/sertifikat-tolol/',type:'image-generator',provider:'sertifikat',paramKey:'text'},
  {id:'lobby_ml',slug:'lobby-ml',name:'Fake Lobby ML',title:'Fake Lobby ML',description:'Buat SS Lobby Mobile Legends',category:'maker',path:'/tools/lobby-ml/',type:'lobby-ml',provider:'lobbyml'},
  {id:'lobby_ff',slug:'lobby-ff',name:'Fake Lobby FF',title:'Fake Lobby FF',description:'Buat SS Lobby Free Fire',category:'maker',path:'/tools/lobby-ff/',type:'image-generator',provider:'lobbyff',paramKey:'nickname'},
  {id:'fakedana',slug:'fakedana',name:'Fake Saldo DANA',title:'Fake Saldo DANA',description:'Buat gambar saldo DANA palsu',category:'maker',path:'/tools/fakedana/',type:'image-generator',provider:'fakedana',paramKey:'nominal'},
  {id:'fakedev',slug:'fakedev',name:'FakeDev Profile',title:'FakeDev Profile',description:'Generator kartu profil developer',category:'maker',path:'/tools/fakedev/',type:'fakedev',provider:'fakedev'},
  {id:'img2link',slug:'img2link',name:'Foto To Link',title:'Foto To Link',description:'Upload gambar menjadi URL ImgBB',category:'tools',path:'/tools/img2link/',type:'img2link'},
  {id:'rmbg',slug:'remove-background',name:'Remove Background',title:'Remove Background',description:'Hapus background foto',category:'tools',path:'/tools/remove-background/',type:'remove-bg'},
  {id:'enh',slug:'image-enhancer',name:'Image Enhancer',title:'Image Enhancer',description:'Tingkatkan kualitas foto HD',category:'tools',path:'/tools/image-enhancer/',type:'image-enhancer'}
]);
function getToolBySlug(slug){return TOOLS.find(t=>t.slug===slug)||null;}
function getToolById(id){return TOOLS.find(t=>t.id===id)||null;}
function getRelatedTools(currentId,limit=4){const c=getToolById(currentId);const pool=TOOLS.filter(t=>t.id!==currentId);return (c?pool.filter(t=>t.category===c.category).concat(pool.filter(t=>t.category!==c.category)):pool).slice(0,limit);}
