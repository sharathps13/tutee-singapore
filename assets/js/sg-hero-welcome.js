/* Hero: "Welcome to Singapore" (assets/css/sg-hero-welcome.css).
   - The clock: Singapore time.
   - The greeting turns through English, Malay, Mandarin and Tamil.
   - The moving picture: plays the current theme's looped video over its still, once the page has loaded. The theme
     toggle (sg-landing.js calls window.__heroLoad before switching) keeps the old picture on top until the new one's
     still has loaded, then fades it away. It also leans a little away from the mouse and drifts with the scroll,
     written once per frame and only while the hero is on screen.
   - The study-level chips fill in the boarding pass's class, the main button and the enquiry form's level; the pass
     mirrors the enquiry pass's guess of the visitor's city, so the two passes always show the same trip.
   Nothing moves with reduced motion. */
(function(){
  var sec=document.getElementById('home');if(!sec||!sec.classList.contains('wh'))return;
  var $=function(s,r){return (r||sec).querySelector(s);},$$=function(s,r){return Array.prototype.slice.call((r||sec).querySelectorAll(s));};
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var visible=true,hidden=document.hidden;
  document.addEventListener('visibilitychange',function(){hidden=document.hidden;});

  /* ---------------- clock: Singapore time (UTC+8) ---------------- */
  var clock=$('#jhClock');
  function paintClock(){if(!clock)return;var d=new Date(),h=(d.getUTCHours()+8)%24,m=d.getUTCMinutes();
    clock.textContent='Live in Singapore · '+((h%12)||12)+':'+(m<10?'0':'')+m+' '+(h<12?'am':'pm');}
  paintClock();setInterval(paintClock,20000);

  /* ---------------- the greeting ---------------- */
  var words=$$('.wh-word'),langs=$$('.wh-langs i'),wi=0;
  if(!reduce&&words.length>1)setInterval(function(){
    if(!visible||hidden)return;
    var a=words[wi];wi=(wi+1)%words.length;var b=words[wi];
    a.classList.remove('on');a.classList.add('out');b.classList.remove('out');b.classList.add('on');
    langs.forEach(function(l,i){l.classList.toggle('on',i===wi);});
    setTimeout(function(){a.classList.remove('out');},750);
  },2800);

  /* ---------------- the moving picture ---------------- */
  /* Each panel shows its still (CSS) at once. The video for the current theme is added once the page has loaded, so it
     never competes with the page itself, and fades in over the still when it can play. No video with reduced motion
     or when the visitor has asked to save data; it pauses off screen and in a hidden tab. */
  var day=$('.wh-day'),night=$('.wh-night');
  var conn=navigator.connection||{},lean=conn.saveData||/(^|-)2g$/.test(conn.effectiveType||'');
  var small=window.matchMedia&&matchMedia('(max-width: 600px), (max-width: 1000px) and (max-resolution: 1.49dppx)').matches;
  var loaded=document.readyState==='complete';
  function modeNow(){return document.documentElement.getAttribute('data-mode')==='dark'?'dark':'light';}
  function panel(m){return m==='dark'?night:day;}
  function videoOf(el){return el?el.querySelector('video'):null;}
  function ensureVideo(el){
    if(!el||reduce||lean||!el.getAttribute('data-video'))return null;
    var v=videoOf(el);if(v)return v;
    v=document.createElement('video');v.muted=true;v.defaultMuted=true;v.loop=true;v.playsInline=true;
    v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('aria-hidden','true');v.preload='auto';
    v.addEventListener('playing',function(){v.classList.add('on');});
    v.src=el.getAttribute('data-video')+'-'+(small?'1280':'1920')+'.mp4';
    el.appendChild(v);return v;
  }
  function play(v){if(!v||!visible||hidden)return;var p=v.play();if(p&&p.catch)p.catch(function(){});}
  function sync(){var cur=panel(modeNow());[day,night].forEach(function(el){var v=videoOf(el);if(!v)return;
    if(el===cur&&visible&&!hidden)play(v);else if(!el.classList.contains('leaving'))v.pause();});}
  /* the other theme's still is fetched and decoded quietly a few seconds after load (it is small), so switching
     theme never waits for it */
  var ready={};
  function urlOf(el){var m=/url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(el).backgroundImage||'');return m?m[1]:'';}
  function warm(el){var u=urlOf(el);if(!u)return Promise.resolve();if(ready[u])return ready[u];
    var img=new Image();img.decoding='async';img.src=u;ready[u]=img.decode?img.decode().then(function(){img.__ok=1;},function(){}):new Promise(function(r){img.onload=img.onerror=r;});
    ready[u].img=img;return ready[u];}
  function isWarm(el){var p=ready[urlOf(el)];return !!(p&&p.img&&(p.img.__ok||p.img.complete&&p.img.naturalWidth));}
  function start(){loaded=true;play(ensureVideo(panel(modeNow())));warm(panel(modeNow()));
    var other=panel(modeNow()==='dark'?'light':'dark');if(other&&!lean)(window.requestIdleCallback||setTimeout)(function(){warm(other);},{timeout:4000});}
  if(loaded)setTimeout(start,0);else addEventListener('load',function(){setTimeout(start,150);});
  if('IntersectionObserver' in window)new IntersectionObserver(function(es){visible=es[0].isIntersecting;sync();},{threshold:0}).observe(sec);
  document.addEventListener('visibilitychange',sync);

  /* the theme toggle (sg-landing.js calls this inside its circular reveal, before switching). The new picture's still
     is normally already decoded (above), so the picture simply changes with the rest of the page, inside the reveal.
     Only if it isn't, the old picture stays on top until it is, then fades. The new theme's video starts once the
     reveal is over, so its download and decoding never compete with the reveal. */
  window.__heroLoad=function(mode){
    var cur=modeNow();if(mode===cur||!day||!night)return;
    var oldEl=panel(cur),newEl=panel(mode),ov=videoOf(oldEl);
    [day,night].forEach(function(e){e.classList.remove('holding','leaving');});
    if(loaded)setTimeout(function(){if(modeNow()===mode)play(ensureVideo(newEl));},reduce?0:650);
    if(reduce||isWarm(newEl)){if(ov)ov.pause();return;}
    oldEl.classList.add('holding');
    var done=false;function go(){if(done)return;done=true;oldEl.classList.remove('holding');oldEl.classList.add('leaving');
      setTimeout(function(){oldEl.classList.remove('leaving');if(ov)ov.pause();},950);}
    warm(newEl).then(go,go);
    setTimeout(go,2500);
  };

  /* ---------------- parallax: the mouse, and the scroll ---------------- */
  var pan=$('.wh-pan');
  if(pan&&!reduce){
    var fine=window.matchMedia&&matchMedia('(hover: hover) and (pointer: fine)').matches;
    var tx=0,ty=0,x=0,y=0,raf=0;
    function frame(){raf=0;
      var sy=Math.min(window.scrollY||0,1200)*.18;x+=(tx-x)*.08;y+=(ty-y)*.08;
      pan.style.transform='translate3d('+x.toFixed(2)+'px,'+(y+sy).toFixed(2)+'px,0)';
      if(Math.abs(tx-x)>.1||Math.abs(ty-y)>.1)kick();}
    function kick(){if(!raf&&visible&&!hidden)raf=requestAnimationFrame(frame);}
    if(fine)sec.addEventListener('pointermove',function(e){if(e.pointerType!=='mouse')return;
      tx=-(e.clientX/innerWidth-.5)*22;ty=-(e.clientY/innerHeight-.5)*14;kick();},{passive:true});
    sec.addEventListener('pointerleave',function(){tx=0;ty=0;kick();});
    addEventListener('scroll',kick,{passive:true});
  }

  /* ---------------- the boarding pass ---------------- */
  var pass=$('#jhPass'),cls=$('#jhClass'),fromCode=$('#jhFromCode'),fromName=$('#jhFromName');
  function passLabel(){if(pass&&fromName&&cls)pass.setAttribute('aria-label','Reserve your free call: from '+fromName.textContent+' to Singapore'+(cls.dataset.set?', '+cls.textContent:''));}
  function setText(el,v){if(!el||el.textContent===v)return;el.textContent=v;if(!reduce){el.classList.remove('set');void el.offsetWidth;el.classList.add('set');}}
  /* mirror the enquiry pass (sg-landing.js guesses the city from the time zone, and the form can change it) */
  function syncFrom(){var c=document.getElementById('fromCode'),n=document.getElementById('fromName');
    if(c&&c.textContent.trim())setText(fromCode,c.textContent.trim());if(n&&n.textContent.trim())setText(fromName,n.textContent.trim());passLabel();}
  function watchFrom(){syncFrom();var c=document.getElementById('fromCode'),n=document.getElementById('fromName');
    if(window.MutationObserver)[c,n].forEach(function(el){if(el)new MutationObserver(syncFrom).observe(el,{childList:true,characterData:true,subtree:true});});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(watchFrom,0);});else watchFrom();

  /* ---------------- study-level chips: the pass's class, the main button, and the enquiry form ---------------- */
  var go=$('#jhGo'),goTxt=go?go.querySelector('.t'):null,LABEL={"Bachelor's degree":"Plan my Bachelor's","Master's degree":"Plan my Master's","MBA":"Plan my MBA","Diploma or polytechnic":"Plan my diploma"};
  $$('.wh-pick button').forEach(function(b){b.addEventListener('click',function(){
    var on=b.getAttribute('aria-pressed')!=='true';
    $$('.wh-pick button').forEach(function(x){x.setAttribute('aria-pressed','false');});
    if(on)b.setAttribute('aria-pressed','true');
    var lv=on?b.getAttribute('data-level'):'Not sure yet';
    if(goTxt)goTxt.textContent=on?LABEL[lv]:'Start my journey';
    if(cls){if(on)cls.dataset.set='1';else delete cls.dataset.set;setText(cls,on?b.getAttribute('data-short'):'Your choice');passLabel();}
    var sel=document.getElementById('f-level');
    if(sel){sel.value=lv;try{sel.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){}}
    if(go&&!reduce){go.classList.remove('pop');void go.offsetWidth;go.classList.add('pop');}
  });});
})();
