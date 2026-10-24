(function(){
  var base='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/';
  ['all.min.css','v4-shims.min.css'].forEach(function(file){
    var link=document.createElement('link');
    link.rel='stylesheet';
    link.href=base+file;
    document.head.appendChild(link);
  });
})();
