/* Quiet background motion for the plain-background sections, each a hint of the section's subject
   (styles in assets/css/sg-bgfx.css). Nothing happens at load: the first time a section comes near the screen its
   decoration (and, once, the stylesheet) is added; it then animates only while the section is on screen.
   Not with reduced motion, not without IntersectionObserver; lite mode (slow devices) hides it. */
(function(){
  if(!('IntersectionObserver' in window))return;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var SRC=(document.currentScript&&document.currentScript.src)||location.href;
  function rep(n,f){var h='';for(var i=0;i<n;i++)h+=f(i);return h;}
  var FX={
    /* services: a soft light that follows the stage you're looking at (before you apply, getting in, after you land),
       taking that stage's colour, over a faint dot grid; see watchPhase below */
    services:function(){return '<div class="fx-sv-grid"></div><div class="fx-sv-glow"><i class="g1"></i><i class="g2"></i><i class="g3"></i></div><div class="fx-sv-warm"></div>';},
    /* universities: places on a campus map pinging in turn */
    universities:function(){var P=[[14,30],[30,70],[52,22],[68,62],[86,34],[78,84],[8,78]];
      return '<div class="fx-map"></div>'+P.map(function(p,i){return '<span class="fx-ping" style="left:'+p[0]+'%;top:'+p[1]+'%;--i:'+i+'"></span>';}).join('');},
    /* funding: a budget building up */
    costs:function(){var H=[38,52,46,64,58,76,70,88,100];
      return '<div class="fx-bars">'+H.map(function(h,i){return '<i style="--h:'+h+'%;--i:'+i+'"></i>';}).join('')+'</div>'+
        rep(3,function(i){return '<span class="fx-coin" style="right:'+(8+i*9)+'%;top:'+(14+i*6)+'%;--i:'+i+'"></span>';});},
    /* student stories: words of thanks rising */
    stories:function(){var P=[[4,40],[22,8],[46,52],[70,12],[88,46]];
      return P.map(function(p,i){return '<span class="fx-quote" style="left:'+p[0]+'%;top:'+p[1]+'%;--i:'+i+'">“</span>';}).join('');},
    /* institutions page: the ranking sits on the same campus map; the full list is a search, so a lens drifts over it */
    ranked:function(){return FX.universities();},
    others:function(){return rep(3,function(i){return '<span class="fx-lens" style="--i:'+i+'"></span>';});},
    /* FAQ: questions turning into answers */
    faq:function(){var P=[[6,18],[90,14],[12,70],[86,62],[30,88],[70,86]];
      return P.map(function(p,i){return '<span class="fx-qa" style="left:'+p[0]+'%;top:'+p[1]+'%;--i:'+i+'"><b>?</b><s>✓</s></span>';}).join('');},
    /* family: two soft lights, warm and teal, drifting slowly towards each other */
    family:function(){return '<span class="fx-glow a"></span><span class="fx-glow b"></span>';},
    /* the consultation: a paper plane gliding along a dashed route, now and then */
    enquire:function(){return '<svg class="fx-route" viewBox="0 0 1000 600" preserveAspectRatio="none"><path d="M-20 520 C 260 380, 520 470, 1020 90" fill="none" stroke-dasharray="2 12" stroke-linecap="round"/></svg>'+
      '<span class="fx-jet"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M2.5 19.5 21.5 12 2.5 4.5 2.5 10.3 15 12 2.5 13.7z"/></svg></span><span class="fx-glow a"></span>';},
    /* the footer: a faint dot map with a slow light passing over it */
    footer:function(){return '<div class="fx-dots"></div><span class="fx-glow b"></span>';}
  };
  /* the services light moves to the stage of the selected service (three per stage) */
  function watchPhase(d){
    var tabs=Array.prototype.slice.call(document.querySelectorAll('#services .svc-tab')),list=document.querySelector('#services .svc-list');
    function set(){var i=0;tabs.forEach(function(t,k){if(t.getAttribute('aria-selected')==='true')i=k;});d.setAttribute('data-phase',String(Math.min(2,Math.floor(i/3))));}
    set();if(list&&window.MutationObserver)new MutationObserver(set).observe(list,{attributes:true,subtree:true,attributeFilter:['aria-selected']});
  }
  var cssOn=false;
  function css(){if(cssOn)return;cssOn=true;var l=document.createElement('link');l.rel='stylesheet';l.href=new URL('../css/sg-bgfx.css?v=5',SRC).href;document.head.appendChild(l);}
  var run=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle('fx-run',e.isIntersecting);});});
  var near=new IntersectionObserver(function(es){es.forEach(function(e){
    if(!e.isIntersecting)return;near.unobserve(e.target);var s=e.target,make=FX[s.id];if(!make)return;
    css();var d=document.createElement('div');d.className='bgfx fx-'+s.id;d.setAttribute('aria-hidden','true');d.innerHTML=make();
    s.classList.add('fx-host');s.insertBefore(d,s.firstChild);run.observe(s);
    if(s.id==='services')watchPhase(d);
    requestAnimationFrame(function(){requestAnimationFrame(function(){s.classList.add('fx-in');});});
  });},{rootMargin:'400px 0px'});
  Object.keys(FX).forEach(function(id){var s=document.getElementById(id);if(!s&&id==='footer'){s=document.querySelector('body > footer');if(s)s.id=s.id||'footer';}if(s)near.observe(s);});
})();
