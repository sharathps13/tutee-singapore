/* Hero: a live 3D Marina Bay you can turn, scrub through the day and explore.
   This file is the light part: the clock, the study-level picker, the pins and card, the camera and its framing.
   The scene itself (three.js and the Blender model, see _source/hero3d/) is sg-hero3d-scene.js, imported once the page
   has loaded. Without WebGL2, or with Save-Data on, the section keeps the Marina Bay Sands photo. */
(function(){
  var sec=document.getElementById('home');if(!sec||!sec.classList.contains('h3d'))return;
  var doc=document.documentElement,$=function(s,r){return (r||sec).querySelector(s);},$$=function(s,r){return Array.prototype.slice.call((r||sec).querySelectorAll(s));};
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  sec.classList.add('js-on');
  var canvas=$('#h3dCanvas'),pinsBox=$('#h3dPins'),card=$('#h3dCard'),range=$('#h3dTime'),out=$('#h3dTimeOut'),liveBtn=$('#h3dLiveBtn'),clock=$('#h3dClock'),hint=$('#h3dHint');

  /* ---------------- time of day: follows the real clock in Singapore (UTC+8) ---------------- */
  function sgtHour(){var d=new Date();return ((d.getUTCHours()+8)%24)+d.getUTCMinutes()/60;}
  function fmt(h){h=((h%24)+24)%24;var H=Math.floor(h),M=Math.round((h-H)*60);if(M===60){M=0;H=(H+1)%24;}
    return ((H%12)||12)+':'+(M<10?'0':'')+M+' '+(H<12?'am':'pm');}
  var live=true,hour=sgtHour(),target=hour;
  /* a saved dark mode opens on Singapore at night (unless it is already night there) */
  function isNightHour(h){return h<6.9||h>19.3;}
  if(doc.getAttribute('data-mode')==='dark'&&!isNightHour(hour)){live=false;hour=target=20.75;}
  function wrapD(a,b){var d=b-a;while(d>12)d-=24;while(d<-12)d+=24;return d;}
  function sun(h){
    var a=(h-6.95)/12.25*Math.PI,se=Math.sin(a)*.93,ce=Math.sqrt(Math.max(0,1-se*se));
    var x=Math.cos(a)*ce,z=.3*ce,l=Math.hypot(x,se,z)||1;
    var night=sstep(.03,-.13,se),dusk=(1-sstep(.06,.42,se))*(1-night);
    return {dir:[x/l,se/l,z/l],night:night,dusk:dusk};
  }
  function sstep(a,b,x){var t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);}

  function paintClock(){
    var s=fmt(live?sgtHour():hour);
    if(clock)clock.textContent=(live?'Live in Singapore · ':'Singapore at ')+s;
    if(out)out.textContent=s;
    sec.classList.toggle('is-live',live);
    if(liveBtn)liveBtn.hidden=live;
  }
  var nightOn=null;
  function paintNight(n){var on=nightOn?n>.4:n>.6;if(on!==nightOn){nightOn=on;sec.classList.toggle('is-night',on);}}

  /* ---------------- study-level picker: pre-fills the enquiry pass ---------------- */
  var go=$('#h3dGo'),goTxt=go?go.querySelector('.t'):null,LABEL={"Bachelor's degree":"Plan my Bachelor's","Master's degree":"Plan my Master's","MBA":"Plan my MBA","Diploma or polytechnic":"Plan my diploma"};
  $$('.h3d-pick button').forEach(function(b){b.addEventListener('click',function(){
    var on=b.getAttribute('aria-pressed')!=='true';
    $$('.h3d-pick button').forEach(function(x){x.setAttribute('aria-pressed','false');});
    if(on)b.setAttribute('aria-pressed','true');
    var lv=on?b.getAttribute('data-level'):'Not sure yet';
    if(goTxt)goTxt.textContent=on?LABEL[lv]:'Start my journey';
    var sel=document.getElementById('f-level');
    if(sel){sel.value=lv;try{sel.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){}}
    if(go){go.classList.remove('pop');void go.offsetWidth;go.classList.add('pop');}
  });});

  /* ---------------- landmarks and their pins ---------------- */
  var PINS={
    study:{at:[-11,9.5,-30.5],hi:0,cam:{yaw:-2.42,pitch:.15,k:.55,t:[-10,4.5,-27]},
      k:'Study',h:'Asia’s top-ranked universities',p:'NUS is #10 and NTU #12 in the QS 2027 rankings, and 126 institutions in Singapore can host a Student’s Pass.',a:'#universities',l:'Browse universities'},
    fund:{at:[-1.2,24,-3],hi:1,cam:{yaw:-2.8,pitch:.13,k:.95,t:[-1,9.5,-3]},
      k:'Fund',h:'The MOE Tuition Grant',p:'A government grant open to international students that substantially lowers tuition, in return for a three-year work bond.',a:'#costs',l:'See funding options'},
    work:{at:[-24,29,38],hi:2,cam:{yaw:-3.3,pitch:.16,k:.8,t:[-24,12,38]},
      k:'Work',h:'Work while you study',p:'Up to 16 hours a week in term at MOM-approved institutions, then a clear route from Student’s Pass to Employment Pass.',a:'#pathway',l:'See the pathway'},
    live:{at:[18,8,14],hi:3,cam:{yaw:-1.75,pitch:.2,k:.6,t:[19,3.5,10]},
      k:'Live',h:'An English-speaking city',p:'Every course is taught in English and there is no immigration language test. Your university sets the entry score.',a:'#why',l:'Why Singapore'}
  };
  var pinEls={};$$('.h3d-pin').forEach(function(b){pinEls[b.getAttribute('data-pin')]=b;});
  var active=null,hover=null,HI=[0,0,0,0],cardW=340,cardH=240;

  function openPin(id,fromKey){
    if(active===id){closePin();return;}
    active=id;var P=PINS[id];
    Object.keys(pinEls).forEach(function(k){pinEls[k].setAttribute('aria-expanded',k===id?'true':'false');pinEls[k].classList.toggle('on',k===id);});
    card.querySelector('.k').textContent=P.k;card.querySelector('h2').textContent=P.h;card.querySelector('p').textContent=P.p;
    var a=card.querySelector('a');a.setAttribute('href',P.a);a.querySelector('span').textContent=P.l;
    card.hidden=false;card.classList.remove('in');cardW=card.offsetWidth;cardH=card.offsetHeight;card.classList.add('in');   /* measured once, here */
    /* the landmark lights up and the card opens beside its pin; the camera stays put, so nothing jumps under the pointer */
    cardFresh=true;interacted();kick();
    if(fromKey)setTimeout(function(){a.focus({preventScroll:true});},30);
  }
  function closePin(refocus){
    if(!active)return;var was=active;active=null;card.hidden=true;
    Object.keys(pinEls).forEach(function(k){pinEls[k].setAttribute('aria-expanded','false');pinEls[k].classList.remove('on');});
    if(refocus&&pinEls[was])pinEls[was].focus({preventScroll:true});kick();
  }
  Object.keys(pinEls).forEach(function(k){var b=pinEls[k];
    b.addEventListener('click',function(e){openPin(k,e.detail===0);});
    b.addEventListener('pointerenter',function(){hover=k;kick();});
    b.addEventListener('pointerleave',function(){if(hover===k)hover=null;kick();});
    b.addEventListener('focus',function(){hover=k;kick();});b.addEventListener('blur',function(){if(hover===k)hover=null;kick();});});
  card.querySelector('.h3d-x').addEventListener('click',function(){closePin(true);});
  card.querySelector('a').addEventListener('click',function(){closePin(false);});
  sec.addEventListener('keydown',function(e){if(e.key==='Escape'&&active){e.stopPropagation();closePin(true);}});
  document.addEventListener('pointerdown',function(e){if(active&&!card.contains(e.target)&&!e.target.closest('.h3d-pin')&&!sec.contains(e.target))closePin(false);});

  /* ---------------- time scrubber ---------------- */
  if(range){range.value=String(Math.round(hour*4)/4);
    range.addEventListener('input',function(){live=false;dragT=true;target=+range.value;interacted();paintClock();kick();});
    range.addEventListener('change',function(){dragT=false;});}
  if(liveBtn)liveBtn.addEventListener('click',function(){live=true;target=sgtHour();if(range)range.value=String(Math.round(target*4)/4);paintClock();kick();});
  /* the page's theme toggle also turns the city to night or day */
  var lastMode=doc.getAttribute('data-mode');
  if(window.MutationObserver)new MutationObserver(function(){
    var m=doc.getAttribute('data-mode'),now=sgtHour(),nightNow=isNightHour(now);
    if(m===lastMode)return;lastMode=m;
    if((m==='dark')===nightNow){live=true;target=now;}else{live=false;target=m==='dark'?20.75:17.4;}
    if(range)range.value=String(Math.round(target*4)/4);paintClock();kick();
  }).observe(doc,{attributes:true,attributeFilter:['data-mode']});
  setInterval(function(){if(live){target=sgtHour();if(range&&!dragT)range.value=String(Math.round(target*4)/4);}paintClock();},20000);
  paintClock();paintNight(sun(hour).night);

  /* ---------------- the 3D scene (sg-hero3d-scene.js, three.js + the Blender model) ---------------- */
  var SRC=(document.currentScript&&document.currentScript.src)||location.href;
  var scene3d=null,ready=false,capName=null;
  function fallback(){sec.classList.add('no-gl');sec.classList.remove('gl-on');}
  var conn=navigator.connection||{};
  if(!('WebGL2RenderingContext' in window)||conn.saveData){fallback();return;}
  /* Starts at once: sg-theme.js has already preloaded the modules and the model from <head>, in parallel with the page,
     and the poster (a frame of this same scene) covers the hero until the first complete frame is ready. Shaders are
     compiled off the main thread and one frame is drawn while the canvas is still hidden (warm), so the hand-over from
     poster to live scene is a clean fade, never a half-built city. */
  function boot(){
    import(new URL('sg-hero3d-scene.js?v=10',SRC).href)
      .then(function(m){T.mod=performance.now();return m.createScene(canvas,{mobile:lowEnd,base:new URL('../3d/',SRC).href});})
      .then(function(s){T.built=performance.now();scene3d=s;s.setTier(tier);size();return s.warm(snapshot(performance.now()));})
      .then(function(){T.warm=performance.now();ready=true;kick();})
      .catch(function(e){if(window.console)console.warn('hero 3d:',e);fallback();});
  }
  var lowEnd=window.matchMedia&&matchMedia('(pointer: coarse)').matches||(navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=4;
  var tier=lowEnd?1:2,T={};   /* T: load milestones, for ?h3ddebug */
  boot();
  canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();ready=false;fallback();});
  /* ---------------- camera: an orbit around the bay, framed around the copy ---------------- */
  /* the view from the Esplanade side: the ArtScience lotus in front of Marina Bay Sands, Gardens behind, the CBD right */
  var Y0=-2.68,cam={yaw:Y0,pitch:.11,dist:130,t:[-2,8,3]},home,vel=0,velP=0,overHero=false;
  var W=1,H=1,narrow=false,F=1.42,shift=[0,0],copyEl=$('.h3d-copy');
  /* landmark extents the opening view must show in full */
  var KEYS=[[-11,3,-30.5],[-1.2,21,14.6],[-1.2,21,-21],[-8,0,0],[17,4,15]];
  function layout(){
    narrow=window.matchMedia?matchMedia('(max-width:819px),(max-aspect-ratio:19/20)').matches:W<820;
    F=narrow?1.2:1.42;
    home={yaw:Y0,pitch:narrow?.13:.11,dist:130,t:[-2,8,3]};
    /* the free area: beside the copy on wide screens, above it on narrow ones (clear of the nav and the time dock) */
    var vh=Math.min(H,window.innerHeight||H),x0=34,x1=W-34,y0=128,y1=H-178;
    copyBox=null;
    if(!narrow&&copyEl){var cr=copyEl.getBoundingClientRect(),sr=canvas.getBoundingClientRect();x0=cr.right-sr.left+24;x1=W-24;y0=150;y1=vh-130;
      copyBox=[cr.left-sr.left-20,cr.top-sr.top-20,cr.right-sr.left+10,cr.bottom-sr.top+20];}
    if(x1-x0<200)x0=x1-200;
    /* pull the camera back until the landmarks fit, then slide the lens so they sit in the middle of that area */
    var b;for(var d=70;d<=330;d+=4){home.dist=d;b=bounds(home);if((b[2]-b[0])*H<=(x1-x0)&&(b[3]-b[1])*H<=(y1-y0))break;}
    shift=[((x0+x1)/2-W/2)/H-(b[0]+b[2])/2,(H/2-(y0+y1)/2)/H-(b[1]+b[3])/2];
    if(!camSet){camSet=true;cam={yaw:home.yaw,pitch:home.pitch,dist:home.dist,t:home.t.slice()};}
    /* how far a drag may swing the view before a tower blocks it (worked out by the scene, once per framing) */
    /* sight lines along both edges of the free area and its middle, as offsets at the target (in units of distance) */
    var edge=function(x){return Math.round(((x-W/2)/H-shift[0])/F*.9*100)/100;},offs=[edge(x0),edge((x0+x1)/2),edge(x1)];
    var key=home.dist+'|'+home.pitch+'|'+offs.join();
    if(scene3d&&scene3d.yawRange&&key!==yawKey){yawKey=key;var yr=scene3d.yawRange(home,Y0,1.15,offs);yawLo=yr[0];yawHi=yr[1];}
  }
  var yawLo=Y0-1.15,yawHi=Y0+1.15,yawKey='';
  function bounds(c){var B=basis(c),r=[1e9,1e9,-1e9,-1e9];KEYS.forEach(function(p){var v=[p[0]-B.o[0],p[1]-B.o[1],p[2]-B.o[2]],z=v[0]*B.f[0]+v[1]*B.f[1]+v[2]*B.f[2];
    var x=(v[0]*B.r[0]+v[1]*B.r[1]+v[2]*B.r[2])/z*F,y=(v[0]*B.u[0]+v[1]*B.u[1]+v[2]*B.u[2])/z*F;r[0]=Math.min(r[0],x);r[2]=Math.max(r[2],x);r[1]=Math.min(r[1],y);r[3]=Math.max(r[3],y);});return r;}
  var camSet=false,copyBox=null;
  function basis(c){
    var cp=Math.cos(c.pitch),o=[c.t[0]+c.dist*cp*Math.cos(c.yaw),c.t[1]+c.dist*Math.sin(c.pitch),c.t[2]+c.dist*cp*Math.sin(c.yaw)];
    var f=norm([c.t[0]-o[0],c.t[1]-o[1],c.t[2]-o[2]]),r=norm([-f[2],0,f[0]]),u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
    return {o:o,f:f,r:r,u:u};
  }
  function norm(v){var l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}
  function project(B,p){var v=[p[0]-B.o[0],p[1]-B.o[1],p[2]-B.o[2]],z=v[0]*B.f[0]+v[1]*B.f[1]+v[2]*B.f[2];if(z<.1)return null;
    var x=(v[0]*B.r[0]+v[1]*B.r[1]+v[2]*B.r[2])/z*F+shift[0],y=(v[0]*B.u[0]+v[1]*B.u[1]+v[2]*B.u[2])/z*F+shift[1];
    return [x*H+W/2,H/2-y*H];}

  /* ---------------- drag to look around (horizontal on touch, so the page still scrolls) ---------------- */
  var drag=null,dragT=false,lastAct=0,hinted=false;
  function interacted(){lastAct=performance.now();if(!hinted){hinted=true;sec.classList.add('explored');}}
  sec.addEventListener('pointerdown',function(e){
    if(!ready||e.button>0||e.target.closest('a,button,input,label,select,.h3d-card,.h3d-copy,.h3d-dock'))return;
    drag={x:e.clientX,y:e.clientY,id:e.pointerId,on:e.pointerType==='mouse',touch:e.pointerType!=='mouse'};
    if(drag.on){try{sec.setPointerCapture(e.pointerId);}catch(err){}sec.classList.add('dragging');}
  });
  sec.addEventListener('pointermove',function(e){
    if(!drag||e.pointerId!==drag.id){if(e.pointerType==='mouse'&&ready&&!reduce){px=(e.clientX/W)*2-1;py=(e.clientY/H)*2-1;kick();}return;}
    var dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.on){if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.2){drag.on=true;try{sec.setPointerCapture(e.pointerId);}catch(err){}sec.classList.add('dragging');}else if(Math.abs(dy)>10){drag=null;return;}else return;}
    drag.x=e.clientX;drag.y=e.clientY;
    /* deltas accumulate until the next frame uses them, so a fast drag never loses movement */
    vel+=dx*.0042;velP+=drag.touch?0:dy*.0024;aimOff();interacted();kick();
  });
  function endDrag(){if(!drag)return;drag=null;sec.classList.remove('dragging');}
  sec.addEventListener('pointerup',endDrag);sec.addEventListener('pointercancel',endDrag);
  sec.addEventListener('lostpointercapture',endDrag);
  function aimOff(){if(active)closePin(false);}
  var px=0,py=0,ppx=0,ppy=0;

  /* ---------------- sizing and adaptive resolution ---------------- */
  /* budget = rendered pixels; it follows the GPU (see the frame loop) and never exceeds the screen's own resolution */
  var budget=window.innerWidth<820?4.2e5:(lowEnd?7e5:1.1e6),maxBudget=2.6e6,minBudget=1.4e5,ratio=1;
  function size(){
    var r=canvas.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);layout();
    if(!scene3d)return;
    var dpr=Math.min(window.devicePixelRatio||1,narrow?1.75:1.5),nr=Math.min(dpr,Math.sqrt(budget/(W*H)));
    ratio=nr;scene3d.resize(W,H,ratio);
  }
  if(window.ResizeObserver)new ResizeObserver(function(){size();kick();}).observe(canvas);else addEventListener('resize',function(){size();kick();});
  size();

  /* ---------------- frame loop: runs only while the hero is on screen and the page is still ---------------- */
  var vis=true,scrollT=0,raf=0,last=0,t0=performance.now(),firstDone=false,clockT=0,lastDraw=0,justDrew=false;
  var vsync=16.7,good=0,bad=0,pinPos={},cardFresh=false;   /* vsync: the display's frame interval, learned in pace() */
  /* the screen's refresh interval, measured while only the poster is up (nothing heavy draws yet), so a 50 Hz, 48 Hz
     or battery-saving 30 Hz screen is never mistaken for a slow GPU and the scene isn't degraded for nothing.
     Until it is known, 60 Hz is assumed. */
  var refresh=16.7;
  (function probe(){var p=[],l=0;function f(t){if(l&&t-l<50)p.push(t-l);l=t;
    if(p.length<30)requestAnimationFrame(f);else{p.sort(function(a,b){return a-b;});refresh=Math.max(4,Math.min(34,p[7]));vsync=refresh;}}
    requestAnimationFrame(f);})();
  if('IntersectionObserver' in window)new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)kick();},{threshold:0}).observe(sec);
  addEventListener('scroll',function(){scrollT=performance.now();},{passive:true});
  document.addEventListener('visibilitychange',function(){if(!document.hidden){last=0;kick();}});
  sec.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse')overHero=true;});
  sec.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse'){overHero=false;px=py=0;}});
  function kick(){if(!raf&&ready&&vis&&!document.hidden)raf=requestAnimationFrame(frame);}

  function ease(a,b,k){return a+(b-a)*k;}
  /* the state one frame needs, also used to warm the renderer before it is shown */
  function snapshot(now){
    var c={yaw:cam.yaw+ppx*.035,pitch:cam.pitch-ppy*.02,dist:cam.dist,t:cam.t};
    return {t:reduce?40:(now-t0)/1000,hour:hour,sun:sun(hour),cam:basis(c),F:F,shift:shift,hi:HI};
  }
  /* 60 fps is the target. Frames arrive in whole display intervals (16.7 ms at 60 Hz, 10 ms at 100 Hz, 8.3 at 120 Hz),
     so the target is the slowest whole multiple of the display's interval that is still 60 fps or better. The interval
     is learned from the quickest quarter of frames (never above the screen's measured refresh, so a struggling device
     can't fool it, and a screen slower than 60 Hz is taken as it is: no GPU can beat its refresh). When
     frames run late the renderer draws fewer pixels; at its floor it drops a quality tier (MSAA, shadow resolution,
     bloom). After a sustained run of on-time frames it climbs back, slowly. */
  var gaps=[];
  function pace(gap){
    gaps.push(gap);if(gaps.length<24)return;
    var g=gaps.slice().sort(function(a,b){return a-b;}),avg=0;for(var i=0;i<g.length;i++)avg+=g[i];avg/=g.length;gaps.length=0;
    vsync=Math.max(4,Math.min(vsync,refresh,g[Math.floor(g.length*.25)]));
    var target=Math.max(1,Math.floor(16.9/vsync))*vsync;
    /* two slow windows in a row before stepping down (one hitch is not a slow GPU); two good ones to step back up */
    if(avg>target*1.2){good=0;if(++bad>=2){bad=0;
      if(budget>minBudget){budget=Math.max(minBudget,budget*.8);size();}
      else if(tier>0){tier--;scene3d.setTier(tier);}}}
    else if(avg<target*1.05){bad=0;if(++good>=2){good=0;if(budget<maxBudget){budget=Math.min(maxBudget,budget*1.2);size();}else if(tier<(lowEnd?1:2)){tier++;scene3d.setTier(tier);}}}
    else good=bad=0;
  }  function frame(now){
    raf=0;if(!ready||!vis||document.hidden)return;
    /* the gap between a draw and the next frame callback is what that draw cost (a gap over 250 ms is a hidden tab) */
    /* (gaps over 100 ms are a throttled or hidden page, never the GPU: not counted) */
    if(justDrew){justDrew=false;var gap=now-lastDraw;if(gap<100)pace(gap);}
    var dt=Math.min(.05,(now-(last||now))/1000);last=now;
    var moving=false;
    /* a moving page gets the whole frame budget: hold the last image until scrolling settles */
    if(now-scrollT<160&&firstDone){raf=requestAnimationFrame(frame);return;}
    /* time of day */
    var dh=wrapD(hour,target);if(Math.abs(dh)>.002){hour+=dh*(reduce?1:Math.min(1,dt*(dragT?14:3.2)));hour=(hour+24)%24;moving=true;}else hour=target;
    /* camera: inertia from a drag; later, a slow drift home and a very gentle sway (never while the pointer is over the hero) */
    if(Math.abs(vel)>1e-4||Math.abs(velP)>1e-4){cam.yaw+=vel;cam.pitch+=velP;vel*=drag?0:Math.pow(.0009,dt);velP*=drag?0:Math.pow(.0009,dt);moving=true;}
    else if(!drag&&(!lastAct||now-lastAct>7000)){var k=Math.min(1,dt*.4);
      var gy=home.yaw+(reduce||overHero?0:Math.sin(now/9000)*.05);
      var ny=ease(cam.yaw,gy,k),np=ease(cam.pitch,home.pitch,k),nd=ease(cam.dist,home.dist,k);
      if(Math.abs(ny-cam.yaw)+Math.abs(np-cam.pitch)+Math.abs(nd-cam.dist)>1e-5)moving=true;
      cam.yaw=ny;cam.pitch=np;cam.dist=nd;for(var i=0;i<3;i++){var v=ease(cam.t[i],home.t[i],k);if(Math.abs(v-cam.t[i])>1e-5)moving=true;cam.t[i]=v;}}
    cam.yaw=Math.max(yawLo,Math.min(yawHi,cam.yaw));cam.pitch=Math.max(.04,Math.min(.42,cam.pitch));
    ppx=ease(ppx,reduce?0:px,Math.min(1,dt*3));ppy=ease(ppy,reduce?0:py,Math.min(1,dt*3));
    if(Math.abs(px-ppx)+Math.abs(py-ppy)>.002)moving=true;
    /* highlights */
    var want=[0,0,0,0];var hk=hover||active;if(hk)want[PINS[hk].hi]=1;
    for(var j=0;j<4;j++){var nv=ease(HI[j],want[j],Math.min(1,dt*6));if(Math.abs(nv-HI[j])>.002)moving=true;HI[j]=nv;}

    var st=snapshot(now);
    scene3d.render(st);
    if(capName){var cn=capName;capName=null;canvas.toBlob(function(bl){fetch('/__save?name='+encodeURIComponent(cn),{method:'POST',body:bl});},'image/webp',.8);}
    lastDraw=now;justDrew=true;
    if(!firstDone){firstDone=true;T.shown=now;sec.classList.add('gl-on');}
    paintNight(st.sun.night);
    if(!live&&now-clockT>120){clockT=now;paintClock();}
    placePins(st.cam);
    /* every frame at the display's rate; reduced motion draws only when something changes */
    if(moving||drag||!reduce)raf=requestAnimationFrame(frame);
  }

  /* ?h3ddebug in the URL exposes a handle for tuning the view from the console */
  if(/h3ddebug/.test(location.search))window.__h3d={
    set:function(o){if(o.hour!=null){live=false;hour=target=o.hour;}if(o.home)for(var k in o.home)home[k]=o.home[k];if(o.cam)for(var c in o.cam)cam[c]=o.cam[c];if(o.F)F=o.F;if(o.shift)shift=o.shift;if(o.budget){budget=o.budget;size();}if(o.tier!=null&&scene3d){tier=o.tier;scene3d.setTier(tier);}kick();},
    get:function(){return {cam:cam,home:home,F:F,shift:shift,budget:budget,ratio:ratio,tier:tier,vsync:vsync,yaw:[yawLo,yawHi],w:canvas.width,h:canvas.height,ready:ready,T:T};},scene:function(){return scene3d;},
    /* dev only: save the next frame (via the local preview server's /__save) as a poster */
    capture:function(n){capName=n;kick();}};
  /* pins follow their landmarks; transforms are written only when a pin actually moves */
  function placePins(B){
    Object.keys(PINS).forEach(function(k){var el=pinEls[k];if(!el)return;var q=project(B,PINS[k].at),p=pinPos[k]||(pinPos[k]={x:-1,y:-1,off:null,flip:null});
      var flip=!!q&&q[0]>W-(narrow?150:230);if(flip!==p.flip){p.flip=flip;el.classList.toggle('flip',flip);}
      var off=!q||q[0]<20||q[0]>W-20||q[1]<96||q[1]>H-(narrow?160:10)||!!(copyBox&&q[0]+170>copyBox[0]&&q[0]<copyBox[2]&&q[1]>copyBox[1]&&q[1]<copyBox[3]);
      if(off!==p.off){p.off=off;el.classList.toggle('off',off);}
      if(off)return;
      var moved=Math.abs(q[0]-p.x)>.3||Math.abs(q[1]-p.y)>.3;
      if(moved){p.x=q[0];p.y=q[1];el.style.transform='translate3d('+q[0].toFixed(1)+'px,'+q[1].toFixed(1)+'px,0)';}
      /* the open card sits beside its pin on the roomier side, clear of the copy (sizes cached when it opened) */
      if(k===active&&!narrow&&(moved||cardFresh)){cardFresh=false;var vh=Math.min(H,window.innerHeight||H),minX=copyBox?copyBox[2]+8:16,fl=p.flip;
        var cx=q[0]<(minX+W)/2?q[0]+(fl?40:200):q[0]-cardW-(fl?200:40);cx=Math.min(W-cardW-16,Math.max(minX,cx));
        var cy=Math.min(vh-cardH-16,Math.max(96,q[1]-cardH*.35));card.style.transform='translate3d('+cx.toFixed(0)+'px,'+cy.toFixed(0)+'px,0)';}
    });
  }})();
