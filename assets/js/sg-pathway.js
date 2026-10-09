/* "Your pathway" (assets/css/sg-pathway.css): a wallet of four passes and a slider through the years.
   The slider is a native range (0-300, one hundred per step), so it drags, takes the keyboard and is announced like
   any slider. While it is dragged the cards follow the finger exactly: each pass in turn lifts off the top of the
   stack, gets its stamp and tucks in behind. Let go and it settles on the nearest pass. The stops, the arrow keys,
   a tap on a card and a swipe on the cards all glide to a pass. Every frame only writes transforms and opacity,
   and nothing reads layout. */
(function(){
  var sec=document.getElementById('pathway'),stage=document.getElementById('pwStage');if(!sec||!stage)return;
  var cards=Array.prototype.slice.call(stage.querySelectorAll('.pw-card')),range=document.getElementById('pwRange'),
    fill=document.getElementById('pwFill'),now=document.getElementById('pwNow'),
    stops=Array.prototype.slice.call(document.querySelectorAll('#pwStops button')),
    marks=Array.prototype.slice.call(stage.querySelectorAll('.pw-track b')),
    rows=Array.prototype.slice.call(document.querySelectorAll('#pwRights li'));
  if(!range||cards.length!==4)return;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MAX=cards.length-1,NOW=["a Student's Pass","a Long-Term Visit Pass","an Employment Pass","Permanent Residence"],
    WHEN=['While you study','After graduating','Your first job','Once established'];
  var RIGHTS=cards.map(function(c){return c.getAttribute('data-r').split(';').map(function(p){p=p.split('|');return {st:p[0],t:p[1]};});});
  sec.classList.add('pw-js');
  cards.forEach(function(c,i){c.tabIndex=0;c.setAttribute('aria-label',WHEN[i]+': '+c.querySelector('h3').textContent);});

  /* where a card sits for its distance d from the pass in hand (d<0: already used, d>0: still to come) */
  function place(c,d){
    var x,y,r,s,z,dim,cv,st,k=narrow?.45:1;
    if(d>=0){x=d*22*k;y=d*18*k;r=d*2.4*k;s=1-d*.05;z=100-d*10;dim=Math.min(d,1)*.35;cv=Math.max(0,1-d*1.6);st=0;}
    else{var p=-d,q=Math.min(p,1),k=p-q,arc=Math.sin(q*Math.PI);
      x=-q*16-arc*34-k*10;y=-arc*120-q*52-k*16;r=-q*5-arc*3-k*2;s=1-q*.07-k*.03;
      z=q<.5?110:60-p*10;dim=q*.25+k*.12;cv=1;st=Math.min(1,q*1.6);}
    /* write only what changed: a new stacking order or a changed variable restyles the card, so those are rounded
       and skipped when equal (z only changes as cards pass each other) */
    /* opacity is written straight onto the few elements that fade (not as inherited variables, which would restyle
       everything inside the card on every frame) */
    var w=c.__w,tf='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) rotate('+r.toFixed(2)+'deg) scale('+s.toFixed(3)+')',
      zi=String(Math.round(z/10)*10),di=dim.toFixed(2),cc=cv.toFixed(2),ss=st.toFixed(2);
    if(w.tf!==tf)c.style.transform=w.tf=tf;
    if(w.z!==zi)c.style.zIndex=w.z=zi;
    if(w.d!==di)w.dim.style.opacity=w.d=di;
    if(w.c!==cc)w.body.style.opacity=w.c=cc;
    if(w.s!==ss&&w.stamp){w.s=ss;w.stamp.style.opacity=ss;w.stamp.style.transform='rotate(-9deg) scale('+(1.6-st*.6).toFixed(3)+')';}
  }
  /* each card's words go in one wrapper (laid out as the card was), so fading them is one write, not five */
  cards.forEach(function(c){var stamp=c.querySelector('.pw-stamp'),body=document.createElement('div');body.className='pw-body';
    Array.prototype.slice.call(c.children).forEach(function(k){if(k!==stamp)body.appendChild(k);});c.insertBefore(body,c.firstChild);
    var dim=document.createElement('i');dim.className='pw-dim';dim.setAttribute('aria-hidden','true');c.appendChild(dim);
    c.__w={dim:dim,stamp:stamp,body:body};});
  /* phones: the passes still to come peek out less, so the stack stays inside the screen and clear of the slider */
  var nmq=window.matchMedia&&matchMedia('(max-width: 640px)'),narrow=!!(nmq&&nmq.matches);
  if(nmq&&nmq.addEventListener)nmq.addEventListener('change',function(){narrow=nmq.matches;cards.forEach(function(c){c.__w.tf=null;});render(v);});
  var shown=-1,v=0;
  function render(val){
    v=Math.max(0,Math.min(MAX,val));
    cards.forEach(function(c,i){place(c,i-v);});
    fill.style.setProperty('--f',(v/MAX).toFixed(4));
    var s=Math.round(v);if(s!==shown)settle(s);
  }
  /* the pass in hand changed: the panel, the stops and what a screen reader hears */
  function settle(s){
    var first=shown<0;shown=s;stage.setAttribute('data-s',String(s));
    now.textContent=NOW[s];
    range.setAttribute('aria-valuetext',WHEN[s]+': '+cards[s].querySelector('h3').textContent);
    stops.forEach(function(b,i){b.setAttribute('aria-pressed',i===s?'true':'false');});
    marks.forEach(function(m,i){m.classList.toggle('on',i<=s);});
    cards.forEach(function(c,i){c.setAttribute('aria-current',i===s?'step':'false');});
    rows.forEach(function(li,k){var r=RIGHTS[s][k],em=li.querySelector('em');
      if(li.getAttribute('data-st')===r.st&&em.textContent===r.t)return;
      li.setAttribute('data-st',r.st);em.textContent=r.t;
      if(!first&&!reduce&&em.animate)em.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.16,1,.3,1)'});
    });
  }
  /* glide to a pass */
  var raf=0;
  function go(to){
    to=Math.max(0,Math.min(MAX,to));cancelAnimationFrame(raf);
    var from=v,dist=to-from;range.value=String(Math.round(to*100));
    if(reduce||!dist){render(to);return;}
    var dur=Math.min(900,380+Math.abs(dist)*220),t0=0;
    raf=requestAnimationFrame(function step(t){if(!t0)t0=t;var p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);
      render(from+dist*e);if(p<1)raf=requestAnimationFrame(step);});
  }
  function touched(){sec.classList.add('pw-touched');}

  /* the slider: follow while dragging, settle on release */
  /* a click (or tap) on the track jumps the slider straight to that point; the cards glide there instead of
     snapping. Dragging the handle still follows the finger exactly. */
  var downAt=0,glideTo=null;
  range.addEventListener('pointerdown',function(){downAt=performance.now();glideTo=null;});
  range.addEventListener('input',function(){touched();var val=+range.value/100;
    if(downAt&&performance.now()-downAt<180&&Math.abs(val-v)>.35){glideTo=Math.round(val);downAt=0;go(glideTo);return;}
    downAt=0;if(glideTo!==null&&Math.abs(val-glideTo)<.02)return;glideTo=null;cancelAnimationFrame(raf);render(val);});
  range.addEventListener('change',function(){var s=Math.round(+range.value/100);if(glideTo!==null&&s===glideTo)return;glideTo=null;go(s);});
  range.addEventListener('keydown',function(e){
    var k=e.key,s=Math.round(v);
    if(k==='ArrowRight'||k==='ArrowUp'||k==='PageUp')s++;else if(k==='ArrowLeft'||k==='ArrowDown'||k==='PageDown')s--;
    else if(k==='Home')s=0;else if(k==='End')s=MAX;else return;
    e.preventDefault();touched();go(s);
  });
  stops.forEach(function(b,i){b.addEventListener('click',function(){touched();go(i);});});

  /* the cards: a tap (or Enter) brings that pass into hand; a sideways swipe moves one pass along */
  var sx=null,sy=0,swiped=false;
  cards.forEach(function(c,i){
    c.addEventListener('click',function(){if(swiped){swiped=false;return;}touched();go(i===Math.round(v)?Math.min(MAX,i+1):i);});
    c.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();touched();go(i===Math.round(v)?Math.min(MAX,i+1):i);}});
  });
  var wallet=stage.querySelector('.pw-cards');
  /* swipe (finger or mouse drag) on the cards: they follow the finger, then settle on the next or previous pass */
  var v0=0,dragging=false;
  wallet.addEventListener('pointerdown',function(e){if(e.button>0)return;sx=e.clientX;sy=e.clientY;swiped=false;dragging=false;v0=v;});
  wallet.addEventListener('pointermove',function(e){if(sx===null)return;var dx=e.clientX-sx,dy=e.clientY-sy;
    if(!dragging){if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.2){dragging=true;cancelAnimationFrame(raf);touched();}else return;}
    render(Math.max(0,Math.min(MAX,v0-dx/(wallet.clientWidth*.8))));});
  wallet.addEventListener('pointerup',function(e){if(sx===null)return;var dx=e.clientX-sx,dy=e.clientY-sy;sx=null;
    if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.2){swiped=true;go(Math.round(v0)+(dx<0?1:-1));}else if(dragging){swiped=true;go(Math.round(v));}dragging=false;});
  wallet.addEventListener('pointercancel',function(){if(dragging)go(Math.round(v));sx=null;dragging=false;});

  /* the printed background only turns while the section is on screen */
  if('IntersectionObserver' in window)new IntersectionObserver(function(es){sec.classList.toggle('pw-on',es[0].isIntersecting);}).observe(sec);

  render(0);
})();
