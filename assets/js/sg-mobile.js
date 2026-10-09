/* Phones (assets/css/sg-mobile.css): the student stories read down the page, three first and the rest behind a
   "More stories" button; and while the enquiry pass is on screen the bottom bar steps aside, so the whole pass shows. */
(function(){
  var mq=window.matchMedia&&matchMedia('(max-width: 640px)');if(!mq)return;
  var rail=document.getElementById('vRail');
  if(rail&&rail.children.length>2){
    var wrap=document.createElement('div');wrap.className='v-more';
    var b=document.createElement('button');b.type='button';b.textContent='More stories ('+(rail.children.length-2)+')';
    b.setAttribute('aria-controls','vRail');b.setAttribute('aria-expanded','false');
    b.addEventListener('click',function(){rail.classList.add('all');b.setAttribute('aria-expanded','true');wrap.hidden=true;
      var f=rail.children[2];if(f){f.setAttribute('tabindex','-1');try{f.focus({preventScroll:true});}catch(e){}}});
    wrap.appendChild(b);rail.parentNode.insertBefore(wrap,rail.nextSibling);
    var sync=function(){wrap.style.display=mq.matches?'':'none';};sync();if(mq.addEventListener)mq.addEventListener('change',sync);
  }
  /* funding: each way to pay opens on a tap; the Tuition Grant is open to begin with */
  var funds=Array.prototype.slice.call(document.querySelectorAll('.fund-grid .fund'));
  funds.forEach(function(f,i){var h=f.querySelector('h3');if(!h)return;if(i===0)f.classList.add('open');
    var ch=document.createElement('span');ch.className='fund-chev';ch.setAttribute('aria-hidden','true');h.parentNode.insertBefore(ch,h.nextSibling);
    var aria=function(){if(mq.matches){f.setAttribute('role','button');f.tabIndex=0;f.setAttribute('aria-expanded',f.classList.contains('open')?'true':'false');}
      else{f.removeAttribute('role');f.removeAttribute('tabindex');f.removeAttribute('aria-expanded');}};aria();if(mq.addEventListener)mq.addEventListener('change',aria);
    /* one way to pay open at a time: opening one closes the others */
    function t(){if(!mq.matches)return;var o=!f.classList.contains('open');
      funds.forEach(function(g){if(g!==f&&g.classList.contains('open')){g.classList.remove('open');g.setAttribute('aria-expanded','false');}});
      f.classList.toggle('open',o);f.setAttribute('aria-expanded',o?'true':'false');}
    f.addEventListener('click',function(e){if(e.target.closest('a'))return;t();});
    f.addEventListener('keydown',function(e){if(mq.matches&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t();}});});
  /* universities: a switch between the top four and the kinds of institution */
  var uni=document.getElementById('universities'),top4=uni&&uni.querySelector('.top4');
  if(top4){var seg=document.createElement('div');seg.className='uni-seg';seg.setAttribute('role','tablist');seg.setAttribute('aria-label','Show');
    seg.innerHTML='<button type="button" role="tab" aria-selected="true">Top 4 universities</button><button type="button" role="tab" aria-selected="false">All 126 by type</button>';
    top4.parentNode.insertBefore(seg,top4);var bs=seg.querySelectorAll('button');
    [0,1].forEach(function(k){bs[k].addEventListener('click',function(){bs[0].setAttribute('aria-selected',k?'false':'true');bs[1].setAttribute('aria-selected',k?'true':'false');uni.classList.toggle('seg-types',k===1);});});}
  /* swipe a card sideways to move to the next or previous one (How it works, What we do) */
  function swipe(el,step){if(!el)return;var x0=null,y0=0;
    el.addEventListener('touchstart',function(e){if(!mq.matches||e.touches.length>1)return;x0=e.touches[0].clientX;y0=e.touches[0].clientY;},{passive:true});
    el.addEventListener('touchend',function(e){if(x0===null)return;var t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;x0=null;
      if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4)step(dx<0?1:-1);},{passive:true});}
  var stops=Array.prototype.slice.call(document.querySelectorAll('.jr-stop'));
  swipe(document.querySelector('.jr-stage'),function(d){var i=stops.findIndex(function(b){return b.getAttribute('aria-selected')==='true';});var n=stops[i+d];if(n)n.click();});
  var stage=document.querySelector('.jr-stage');if(stage){var hint=document.createElement('p');hint.className='jr-swipe';hint.textContent='Swipe the card, or tap a stop';stage.parentNode.insertBefore(hint,stage.nextSibling);}
  swipe(document.getElementById('svcPanel'),function(d){var b=document.getElementById(d>0?'spNext':'spPrev');if(b)b.click();});
  var pass=document.getElementById('ticket');
  if(pass&&'IntersectionObserver' in window)new IntersectionObserver(function(es){
    document.documentElement.classList.toggle('pass-in',es[0].isIntersecting&&es[0].intersectionRatio>.25);},{threshold:[0,.25,.5]}).observe(pass);
})();
