/* Runs in <head> before first paint: the page theme is set only by the toggle (saved in localStorage), never by the OS.
   On the home page (data-hero) it also preloads the hero's still for that theme, at the size the stylesheet picks
   (assets/css/sg-hero-welcome.css; the names, sizes and media queries must match). */
(function(){var m="light";try{var s=localStorage.getItem("tc-mode");if(s==="dark"||s==="light")m=s;}catch(e){}document.documentElement.setAttribute("data-mode",m);
  var me=document.currentScript;if(!me||!me.getAttribute("data-hero"))return;
  var p=m==="dark"?["hero-night-","1280","1920"]:["hero-day-","1280","1920"],base=me.src.replace(/js\/sg-theme\.js.*$/,"img/hero/"+p[0]);
  [[p[1],"(max-width: 600px), (max-width: 1000px) and (max-resolution: 1.49dppx)"],[p[2],"(min-width: 1001px), (min-width: 601px) and (min-resolution: 1.5dppx)"]].forEach(function(v){
    var l=document.createElement("link");l.rel="preload";l.as="image";l.href=base+v[0]+".webp";l.media=v[1];l.setAttribute("fetchpriority","high");document.head.appendChild(l);});
})();
