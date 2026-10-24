(function(){try{
  // Rebrand migration: carry an existing saved theme forward under the new
  // key once, then rely on the new key from here on. Runs on every load but
  // is a no-op after the first (the old key is gone after migrating).
  if(localStorage.getItem('nextgen1-theme')==null){
    var old=localStorage.getItem('nexakit-theme');
    if(old!=null)localStorage.setItem('nextgen1-theme',old);
  }
  localStorage.removeItem('nexakit-theme');
  var t=localStorage.getItem('nextgen1-theme');
  if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'; // ignore garbage values
  document.documentElement.dataset.theme=t;
}catch(e){}})();
