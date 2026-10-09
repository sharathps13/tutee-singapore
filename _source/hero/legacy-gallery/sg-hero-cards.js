/* Hero (assets/css/sg-hero-cards.css).
   - The gallery: four photographs as tall panels (not links). One is open, the others fold into labelled strips
     (stacked rows on phones). It moves on every 6 seconds; a thin line filling along the open photograph is the timer
     (its animationend moves it on), so pausing it, by hover, focus, a hidden tab or the hero leaving the screen,
     pauses everything with no timers left running. Click or tap a strip to open it, swipe, use the arrow keys, or
     Tab through the panels (each opens as it is focused).
   - The boarding pass: the study-level chips fill in its class, and it mirrors the enquiry pass's guess of the
     visitor's city, so the two passes always show the same trip.
   With reduced motion the deck starts paused and moves without animation. */
(function(){
  var sec=document.getElementById('home');if(!sec||!sec.classList.contains('jh'))return;
  var $=function(s,r){return (r||sec).querySelector(s);},$$=function(s,r){return Array.prototype.slice.call((r||sec).querySelectorAll(s));};
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- clock: Singapore time (UTC+8) ---------------- */
  var clock=$('#jhClock');
  function paintClock(){if(!clock)return;var d=new Date(),h=(d.getUTCHours()+8)%24,m=d.getUTCMinutes();
    clock.textContent='Live in Singapore · '+((h%12)||12)+':'+(m<10?'0':'')+m+' '+(h<12?'am':'pm');}
  paintClock();setInterval(paintClock,20000);

  /* ---------------- the boarding pass ---------------- */
  var pass=$('#jhPass'),cls=$('#jhClass'),fromCode=$('#jhFromCode'),fromName=$('#jhFromName');
  function passLabel(){if(pass)pass.setAttribute('aria-label','Reserve your free call: from '+fromName.textContent+' to Singapore'+(cls.dataset.set?', '+cls.textContent:''));}
  function setText(el,v){if(!el||el.textContent===v)return;el.textContent=v;if(!reduce){el.classList.remove('set');void el.offsetWidth;el.classList.add('set');}}
  /* mirror the enquiry pass (sg-landing.js guesses the city from the time zone, and the form can change it) */
  function syncFrom(){var c=document.getElementById('fromCode'),n=document.getElementById('fromName');
    if(c&&c.textContent.trim())setText(fromCode,c.textContent.trim());if(n&&n.textContent.trim())setText(fromName,n.textContent.trim());passLabel();}
  function watchFrom(){syncFrom();var c=document.getElementById('fromCode'),n=document.getElementById('fromName');
    if(window.MutationObserver)[c,n].forEach(function(el){if(el)new MutationObserver(syncFrom).observe(el,{childList:true,characterData:true,subtree:true});});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(watchFrom,0);});else watchFrom();

  /* ---------------- study-level chips: the pass's class, the main button, and the enquiry form ---------------- */
  var go=$('#jhGo'),goTxt=go?go.querySelector('.t'):null,LABEL={"Bachelor's degree":"Plan my Bachelor's","Master's degree":"Plan my Master's","MBA":"Plan my MBA","Diploma or polytechnic":"Plan my diploma"};
  $$('.jh-pick button').forEach(function(b){b.addEventListener('click',function(){
    var on=b.getAttribute('aria-pressed')!=='true';
    $$('.jh-pick button').forEach(function(x){x.setAttribute('aria-pressed','false');});
    if(on)b.setAttribute('aria-pressed','true');
    var lv=on?b.getAttribute('data-level'):'Not sure yet';
    if(goTxt)goTxt.textContent=on?LABEL[lv]:'Start my journey';
    if(cls){if(on)cls.dataset.set='1';else delete cls.dataset.set;setText(cls,on?b.getAttribute('data-short'):'Your choice');passLabel();}
    var sel=document.getElementById('f-level');
    if(sel){sel.value=lv;try{sel.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){}}
    if(go&&!reduce){go.classList.remove('pop');void go.offsetWidth;go.classList.add('pop');}
  });});

  /* ---------------- the gallery ---------------- */
  var deck=$('#jhDeck'),cards=$$('.jh-card');
  if(!deck||cards.length<2)return;
  var order=cards.map(function(c,i){return i;});
  if(reduce)sec.classList.add('paused');
  function front(){return order[0];}
  /* the timer: a thin line filling along the bottom of the open photograph; its animationend moves the gallery on */
  var bars=cards.map(function(c){var t=document.createElement('i');t.className='jh-time';t.setAttribute('aria-hidden','true');c.appendChild(t);
    t.addEventListener('animationend',function(){if(t.classList.contains('run'))next();});return t;});
  /* the timer restarts on the next frame rather than by forcing a reflow (a forced reflow at start-up meant laying
     out the whole page before its first paint) */
  var restartRaf=0;
  function paint(){
    order.forEach(function(ci,p){cards[ci].setAttribute('data-p',String(p));cards[ci].setAttribute('aria-current',p===0?'true':'false');});
    bars.forEach(function(b){b.classList.remove('run');});
    var bar=bars[front()];cancelAnimationFrame(restartRaf);
    restartRaf=requestAnimationFrame(function(){restartRaf=requestAnimationFrame(function(){bar.classList.add('run');});});
  }
  /* the open panel is order[0] (data-p="0"); the CSS folds the rest */
  function next(){order.push(order.shift());paint();}
  function prev(){order.unshift(order.pop());paint();}
  function show(ci){if(ci===front())return;var k=order.indexOf(ci);order=order.slice(k).concat(order.slice(0,k));paint();}
  /* hover or focus inside the deck holds it; so does the hero being off screen */
  function setHold(on){sec.classList.toggle('hold',on);}
  var over=false,focusIn=false;
  deck.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse'){over=true;setHold(true);}});
  deck.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse'){over=false;setHold(focusIn);}});
  sec.addEventListener('focusin',function(e){if(e.target.closest('.jh-deck')){focusIn=true;setHold(true);}});
  sec.addEventListener('focusout',function(e){if(!e.relatedTarget||!e.relatedTarget.closest||!e.relatedTarget.closest('.jh-deck')){focusIn=false;setHold(over);}});
  if('IntersectionObserver' in window)new IntersectionObserver(function(es){sec.classList.toggle('off',!es[0].isIntersecting);},{threshold:.15}).observe(deck);

  /* panels: a click or tap on a folded strip opens it; Tab opens each in turn. The photographs lead nowhere else. */
  var swiped=false;
  cards.forEach(function(c,ci){
    c.addEventListener('focus',function(){var kb=true;try{kb=c.matches(':focus-visible');}catch(e){}if(kb)show(ci);});
    c.addEventListener('click',function(){if(!swiped)show(ci);swiped=false;});
  });

  /* a sideways swipe on the gallery moves one photograph along */
  var sx=null,sy=0;
  deck.addEventListener('pointerdown',function(e){if(e.button>0)return;sx=e.clientX;sy=e.clientY;swiped=false;});
  deck.addEventListener('pointerup',function(e){if(sx===null)return;var dx=e.clientX-sx,dy=e.clientY-sy;sx=null;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3){swiped=true;if(dx<0)next();else prev();}});
  deck.addEventListener('pointercancel',function(){sx=null;});

  document.addEventListener('keydown',function(e){
    if(!e.target.closest||!e.target.closest('.jh-deck'))return;
    if(e.key==='ArrowRight'){e.preventDefault();next();}else if(e.key==='ArrowLeft'){e.preventDefault();prev();}
  });

  paint();
})();
