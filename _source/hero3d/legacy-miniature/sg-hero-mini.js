/* Hero: "Singapore in miniature". A path-traced model of Marina Bay (see _source/hero3d/render_miniature.py) that
   turns when it is dragged, by scrubbing through pre-rendered turntable frames.

   What makes it instant: the home frame is a CSS background, preloaded from <head> (sg-theme.js), so the hero is complete
   before any script runs. This file then fetches the other frames once the page has loaded (coarse to fine, so a few
   frames already allow a turn), decodes them off the main thread (createImageBitmap) and draws two neighbouring frames
   into a canvas, cross-faded, so the turn is smooth between the rendered angles. Nothing animates when nothing moves:
   the draw loop only runs while the model is turning or fading. With Save-Data or a 2G connection the frames load only
   when someone actually reaches for the model. */
(function(){
  var sec=document.getElementById('home');if(!sec||!sec.classList.contains('mh'))return;
  var doc=document.documentElement,$=function(s,r){return (r||sec).querySelector(s);},$$=function(s,r){return Array.prototype.slice.call((r||sec).querySelectorAll(s));};
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  sec.classList.add('js-on');
  var model=$('#mhModel'),canvas=$('#mhCanvas'),ctx=canvas.getContext('2d'),clock=$('#mhClock'),hint=$('#mhHint');
  var tags=$$('.mh-tag'),segs=$$('.mh-seg button');

  /* ---------------- clock: Singapore time (UTC+8) ---------------- */
  function sgtHour(){var d=new Date();return ((d.getUTCHours()+8)%24)+d.getUTCMinutes()/60;}
  function isNightHour(h){return h<6.9||h>19.3;}
  function fmt(h){var H=Math.floor(h),M=Math.round((h-H)*60);if(M===60){M=0;H=(H+1)%24;}return ((H%12)||12)+':'+(M<10?'0':'')+M+' '+(H<12?'am':'pm');}
  function paintClock(){if(clock)clock.textContent='Live in Singapore · '+fmt(sgtHour());}
  paintClock();setInterval(paintClock,20000);

  /* ---------------- study-level picker: pre-fills the enquiry pass ---------------- */
  var go=$('#mhGo'),goTxt=go?go.querySelector('.t'):null,LABEL={"Bachelor's degree":"Plan my Bachelor's","Master's degree":"Plan my Master's","MBA":"Plan my MBA","Diploma or polytechnic":"Plan my diploma"};
  $$('.mh-pick button').forEach(function(b){b.addEventListener('click',function(){
    var on=b.getAttribute('aria-pressed')!=='true';
    $$('.mh-pick button').forEach(function(x){x.setAttribute('aria-pressed','false');});
    if(on)b.setAttribute('aria-pressed','true');
    var lv=on?b.getAttribute('data-level'):'Not sure yet';
    if(goTxt)goTxt.textContent=on?LABEL[lv]:'Start my journey';
    var sel=document.getElementById('f-level');
    if(sel){sel.value=lv;try{sel.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){}}
    if(go&&!reduce){go.classList.remove('pop');void go.offsetWidth;go.classList.add('pop');}
  });});

  /* ---------------- day or night: Singapore's clock and the page theme, or the visitor's choice ---------------- */
  var mode=doc.getAttribute('data-sgt')==='night'?'night':'day',fade=null,pend=null;
  function paintMode(){sec.classList.toggle('is-night',mode==='night');segs.forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-mode')===mode?'true':'false');});}
  function setMode(m){
    if(m===mode)return;var was=mode;mode=m;paintMode();
    if(!data)return;
    if(cvOn){fade=null;pend=pend||was;}   /* pend: the set actually on screen */
    want(mode,true);kick();
  }
  paintMode();
  segs.forEach(function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-mode'));});});
  if(window.MutationObserver)new MutationObserver(function(){
    setMode(doc.getAttribute('data-mode')==='dark'||isNightHour(sgtHour())?'night':'day');
  }).observe(doc,{attributes:true,attributeFilter:['data-mode']});

  /* ---------------- frames ---------------- */
  var SRC=(document.currentScript&&document.currentScript.src)||location.href,BASE=new URL('../hero/',SRC).href;
  var phone=window.matchMedia&&matchMedia('(max-width:819px)').matches;
  var conn=navigator.connection||{},slow=!!conn.saveData||/(^|-)2g$/.test(conn.effectiveType||'');
  var data=null,N=0,HOME=0,set={day:[],night:[]},queue=[],busy=0,started={};
  function url(m,i){return BASE+m+'-'+(i<10?'0':'')+i+(phone?'-m':'')+'.webp';}
  function decode(u){
    if(window.createImageBitmap&&window.fetch)return fetch(u).then(function(r){if(!r.ok)throw new Error(r.status);return r.blob();}).then(function(b){return createImageBitmap(b);});
    return new Promise(function(ok,no){var im=new Image();im.onload=function(){ok(im);};im.onerror=no;im.src=u;});
  }
  /* coarse to fine from the home frame: home, both ends, the middles, then every frame */
  function order(){var o=[HOME],seen={};seen[HOME]=1;
    for(var step=N-1;step>=1;step=Math.floor(step/2))for(var i=0;i<N;i+=step)if(!seen[i]){seen[i]=1;o.push(i);}
    for(var j=0;j<N;j++)if(!seen[j])o.push(j);return o;}
  function want(m,first){
    if(started[m])return;started[m]=1;
    /* the frame on screen first, so a day/night switch lands where the model is */
    var o=order(),cur=Math.round(pos);if(first){o.splice(o.indexOf(cur),1);o.unshift(cur);}
    o.forEach(function(i){queue.push([m,i]);});pump();
  }
  function pump(){
    while(busy<3&&queue.length){
      var q=queue.shift();if(set[q[0]][q[1]])continue;busy++;
      (function(m,i){decode(url(m,i)).then(function(bm){set[m][i]=bm;busy--;pump();
        if(m===mode){if(!cvOn&&(i===Math.round(pos)))showCanvas();kick();}
        if(m===mode&&!introDone&&loadedAll(m))intro();
      },function(){busy--;pump();});})(q[0],q[1]);
    }
  }
  function loadedAll(m){for(var i=0;i<N;i++)if(!set[m][i])return false;return true;}
  function nearest(m,i){var s=set[m];if(s[i])return s[i];for(var d=1;d<N;d++){if(s[i-d])return s[i-d];if(s[i+d])return s[i+d];}return null;}

  /* ---------------- drawing ---------------- */
  var cvOn=false,W=0,H=0;
  function size(){
    var r=model.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    var cap=data?(phone?data.pw:data.w):1e4;           /* never wider than the frames themselves */
    var w=Math.max(1,Math.round(Math.min(r.width*dpr,cap))),h=Math.max(1,Math.round(w*r.height/Math.max(1,r.width)));
    if(w!==W||h!==H){W=canvas.width=w;H=canvas.height=h;draw();}
  }
  function showCanvas(){draw();cvOn=true;sec.classList.add('cv-on');}
  function paint(m,p,alpha){
    var i=Math.max(0,Math.min(N-1,Math.floor(p))),t=p-i,a=nearest(m,i),b=t>.01&&i<N-1?nearest(m,i+1):null;
    if(!a)return false;
    ctx.globalAlpha=alpha;ctx.drawImage(a,0,0,W,H);
    if(b&&b!==a){ctx.globalAlpha=alpha*t;ctx.drawImage(b,0,0,W,H);}
    return true;
  }
  /* a day/night switch keeps the current picture until the other set has a frame here, then cross-fades to it */
  function draw(){
    if(!data||!W)return;
    ctx.globalAlpha=1;ctx.clearRect(0,0,W,H);
    if(pend){if(nearest(mode,Math.round(pos))){if(!reduce)fade={from:pend,t0:performance.now()};pend=null;}else{paint(pend,pos,1);ctx.globalAlpha=1;placeTags();return;}}
    if(fade){var f=Math.min(1,(performance.now()-fade.t0)/420);paint(fade.from,pos,1);paint(mode,pos,f);if(f>=1)fade=null;}
    else paint(mode,pos,1);
    ctx.globalAlpha=1;placeTags();
  }

  /* ---------------- labels follow their landmark ---------------- */
  var tagState=tags.map(function(){return {};});
  function placeTags(){
    if(!data)return;
    var i=Math.max(0,Math.min(N-1,Math.floor(pos))),t=pos-i,A=data.labels[i],B=data.labels[Math.min(N-1,i+1)],R=data.labels[Math.round(pos)];
    tags.forEach(function(el,k){
      var key=el.getAttribute('data-k'),a=A[key],b=B[key];if(!a)return;
      var x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,v=R[key][2]===1,s=tagState[k];
      var al=x>.72?'end':x<.28?'start':'';
      var xs=x.toFixed(4),ys=y.toFixed(4);
      if(s.x!==xs){s.x=xs;el.style.setProperty('--x',xs);}
      if(s.y!==ys){s.y=ys;el.style.setProperty('--y',ys);}
      if(s.v!==v){s.v=v;el.classList.toggle('off',!v);if(!v&&el===document.activeElement)model.focus({preventScroll:true});}
      if(s.al!==al){s.al=al;el.classList.toggle('end',al==='end');el.classList.toggle('start',al==='start');}
    });
  }

  /* ---------------- turning: drag, keys, a hint of it on hover ---------------- */
  var pos=0,target=0,vel=0,raf=0,last=0,drag=null,touched=false,introDone=false,intro0=0;
  function clamp(p){return Math.max(0,Math.min(N-1,p));}
  function kick(){if(!raf)raf=requestAnimationFrame(step);}
  function step(now){
    raf=0;var dt=Math.min(.05,last?(now-last)/1000:.016);last=now;
    if(intro0){var u=(now-intro0)/2600;if(u>=1){intro0=0;target=HOME;}else target=HOME+Math.sin(u*Math.PI*2)*2.2*Math.sin(u*Math.PI);}
    if(!drag&&Math.abs(vel)>.01){target=clamp(target+vel*dt);vel*=Math.pow(.02,dt);if(target===0||target===N-1)vel=0;}else if(!drag)vel=0;
    var k=reduce?1:1-Math.pow(.0001,dt);pos+=(target-pos)*k;if(Math.abs(target-pos)<.002)pos=target;
    draw();
    if(pos!==target||drag||Math.abs(vel)>.01||intro0||fade)raf=requestAnimationFrame(step);else last=0;
  }
  function interact(){touched=true;intro0=0;sec.classList.add('turned');if(!started[mode])want(mode);}
  var SENS=1;   /* frames per pixel = SENS * (N-1) / (model width * .9): a full drag across the model turns it end to end */
  model.addEventListener('pointerdown',function(e){
    if(!data||e.button>0)return;
    drag={x:e.clientX,y:e.clientY,id:e.pointerId,p:target,on:e.pointerType==='mouse',lx:e.clientX,lt:performance.now(),v:0};
    if(drag.on){try{model.setPointerCapture(e.pointerId);}catch(err){}sec.classList.add('dragging');}
    interact();
  });
  model.addEventListener('pointermove',function(e){
    if(!drag||e.pointerId!==drag.id){
      /* mouse hover leans the model a little toward the pointer, until someone actually turns it */
      if(e.pointerType==='mouse'&&data&&!touched&&!reduce&&!intro0){var r=model.getBoundingClientRect();target=clamp(HOME+((e.clientX-r.left)/r.width-.5)*-3);kick();}
      return;}
    var dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.on){if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.2){drag.on=true;try{model.setPointerCapture(e.pointerId);}catch(err){}sec.classList.add('dragging');}else if(Math.abs(dy)>10){drag=null;return;}else return;}
    var per=SENS*(N-1)/(model.clientWidth*.9),now=performance.now();
    target=clamp(drag.p-dx*per);
    var dtm=Math.max(1,now-drag.lt);drag.v=drag.v*.6+(-(e.clientX-drag.lx)*per/dtm*1000)*.4;drag.lx=e.clientX;drag.lt=now;
    kick();
  });
  function endDrag(){if(!drag)return;if(drag.on&&!reduce&&performance.now()-drag.lt<90)vel=Math.max(-14,Math.min(14,drag.v));drag=null;sec.classList.remove('dragging');kick();}
  model.addEventListener('pointerup',endDrag);model.addEventListener('pointercancel',endDrag);model.addEventListener('lostpointercapture',endDrag);
  model.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse'&&!touched&&data&&!drag){target=HOME;kick();}});
  model.addEventListener('keydown',function(e){
    if(!data)return;var d=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0;
    if(e.key==='Home'){target=HOME;}else if(d){target=clamp(Math.round(target)+d);}else return;
    e.preventDefault();interact();kick();
  });
  /* a single slow sway once every angle is in, to show the model turns (not with reduced motion, not once touched) */
  function intro(){introDone=true;if(reduce||touched)return;
    if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){if(es[0].isIntersecting&&!touched){intro0=performance.now();kick();}io.disconnect();});io.observe(model);}}

  /* ---------------- start: after the page has loaded, so nothing here competes with it ---------------- */
  function boot(){
    fetch(BASE+'frames.json').then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){
      data=d;N=d.frames;HOME=d.home;pos=target=HOME;
      model.setAttribute('tabindex','0');model.setAttribute('aria-roledescription','turnable model');
      model.setAttribute('aria-label',model.getAttribute('aria-label')+'. Drag, or use the left and right arrow keys, to turn it.');
      if(window.ResizeObserver)new ResizeObserver(size).observe(model);else addEventListener('resize',size);
      size();placeTags();
      if(!slow)want(mode);
      else{var lazy=function(){want(mode);};model.addEventListener('pointerenter',lazy,{once:true});model.addEventListener('touchstart',lazy,{once:true,passive:true});model.addEventListener('focus',lazy,{once:true});}
    }).catch(function(){sec.classList.add('no-turn');});
  }
  if(!window.fetch){sec.classList.add('no-turn');return;}
  var idle=window.requestIdleCallback||function(f){return setTimeout(f,200);};
  if(document.readyState==='complete')idle(boot,{timeout:1200});else addEventListener('load',function(){idle(boot,{timeout:1200});});
})();
