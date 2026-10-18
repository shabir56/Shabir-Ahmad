(function(){
  // Star field (seeded so it looks the same on every visit)
  var box=document.getElementById('stars'),s=7;
  function r(){s=(s*16807)%2147483647;return s/2147483647}
  for(var i=0;i<85;i++){
    var d=document.createElement('i');d.className='star';
    var z=r()<.15?2.5:1.5;
    d.style.cssText='left:'+(r()*100)+'%;top:'+(r()*78)+'%;width:'+z+'px;height:'+z+'px;animation-delay:-'+(r()*4)+'s;animation-duration:'+(3+r()*4)+'s';
    box.appendChild(d);
  }
  document.getElementById('yr').textContent=new Date().getFullYear();
  // Placeholder links: say so instead of jumping to the top
  document.querySelectorAll('a.btn[href="#"]').forEach(function(a){
    var t=a.textContent;
    a.addEventListener('click',function(e){
      e.preventDefault();a.textContent='Link coming soon';
      setTimeout(function(){a.textContent=t},2000);
    });
  });
})();
