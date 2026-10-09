/* Custom drop-down menus (assets/css/sg-select.css) for every <select> on the page.
   Progressive enhancement: the native <select> stays in the form (visually hidden) and remains the source of truth,
   so submitting, validation and any script that reads or sets .value keep working. A button shows the current choice
   and opens a list (role="listbox") floating above the page, so a container's rounded corners never clip it.
   Keyboard: Enter / Space / Alt+Down open; arrows, Home, End and type-ahead move; Enter selects; Esc and Tab close.
   Without the script, the native drop-downs simply work as before. */
(function(){
  var sels=Array.prototype.slice.call(document.querySelectorAll('select'));if(!sels.length)return;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var proto=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value'),protoIdx=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'selectedIndex');
  var open=null,uid=0;

  /* what each option looks like: an icon (or a code badge) and a short line under its name */
  function ic(p){return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';}
  var I={cap:ic('<path d="M22 9 12 4 2 9l10 5 10-5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>'),book:ic('<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v14h-6"/>'),
    brief:ic('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'),tool:ic('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
    flask:ic('<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-2.5L14 9V3"/><path d="M7 15h10"/>'),help:ic('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>'),
    sunrise:ic('<path d="M12 3v3M4.9 7.9l2.1 2.1M19.1 7.9 17 10M2 18h20M6 18a6 6 0 0 1 12 0"/>'),sun:ic('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    sunset:ic('<path d="M12 10V3M8 6l4 4 4-4M2 18h20M6 18a6 6 0 0 1 12 0M4.9 13.9 6.3 15M19.1 13.9 17.7 15"/>'),cal:ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/>'),
    clock:ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')};
  var CC={'+91':'India','+971':'United Arab Emirates','+974':'Qatar','+968':'Oman','+966':'Saudi Arabia','+965':'Kuwait','+973':'Bahrain','+94':'Sri Lanka','+977':'Nepal','+880':'Bangladesh','+960':'Maldives',
    '+60':'Malaysia','+62':'Indonesia','+63':'Philippines','+84':'Vietnam','+44':'United Kingdom','+254':'Kenya','+234':'Nigeria','+65':'Singapore','+1':'USA or Canada','+61':'Australia'};
  var LV={"Not sure yet":[I.help,'We\'ll help you decide'],"Bachelor's degree":[I.cap,'Undergraduate degree'],"Master's degree":[I.book,'Postgraduate degree'],"MBA":[I.brief,'Business school'],
    "Diploma or polytechnic":[I.tool,'Polytechnic or private institution'],"PhD":[I.flask,'Research degree']};
  var DIAL={'+91':'in','+971':'ae','+974':'qa','+968':'om','+966':'sa','+965':'kw','+973':'bh','+94':'lk','+977':'np','+880':'bd','+960':'mv','+60':'my','+62':'id','+63':'ph','+84':'vn','+44':'gb','+254':'ke','+234':'ng','+65':'sg','+1':'us','+61':'au'};
  var CITY={IN:'in',MAA:'in',BLR:'in',HYD:'in',BOM:'in',DEL:'in',COK:'in',CCU:'in',PNQ:'in',AMD:'in',CJB:'in',TRV:'in',DXB:'ae',AUH:'ae',SHJ:'ae',DOH:'qa',MCT:'om',RUH:'sa',JED:'sa',KWI:'kw',BAH:'bh',
    CMB:'lk',KTM:'np',DAC:'bd',MLE:'mv',KUL:'my',CGK:'id',MNL:'ph',SGN:'vn',LHR:'gb',NBO:'ke',LOS:'ng'};
  var CNAME={in:'India',ae:'UAE',qa:'Qatar',om:'Oman',sa:'Saudi Arabia',kw:'Kuwait',bh:'Bahrain',lk:'Sri Lanka',np:'Nepal',bd:'Bangladesh',mv:'Maldives',my:'Malaysia',id:'Indonesia',ph:'Philippines',vn:'Vietnam',gb:'United Kingdom',ke:'Kenya',ng:'Nigeria'};
  var FLAGS=(document.querySelector('script[src*="sg-select"]')||{}).src||'';FLAGS=FLAGS?FLAGS.replace(/js\/sg-select\.js.*$/,'img/flags/'):'assets/img/flags/';
  function look(sel,o){var v=o.value,t=o.textContent,g=o.parentNode.tagName==='OPTGROUP'?o.parentNode.label:'';
    if(sel.id==='f-origin'){var fc=CITY[v];return {flag:fc,icon:fc?null:I.help,main:t,sub:v==='IN'?'Anywhere in India':v==='ANY'?'Somewhere else':(CNAME[fc]||g)+' · '+v};}
    if(sel.id==='f-cc')return {flag:DIAL[v],main:CC[v]||v,sub:v,short:v,wide:1};
    if(sel.id==='f-level'){var l=LV[t]||[I.cap,''];return {icon:l[0],main:t,sub:l[1]};}
    if(sel.id==='f-slot'){if(!v)return {icon:I.clock,main:t,sub:'Choose when we call you'};var m=t.split(', ');
      return {icon:/Morning/.test(t)?I.sunrise:/Afternoon/.test(t)?I.sun:/Evening/.test(t)?I.sunset:I.cal,main:m[0],sub:m[1]||'Saturday or Sunday',short:t};}
    return {main:t};}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function lead(L){if(L.flag)return '<span class="dd-f"><img src="'+FLAGS+L.flag+'.svg" alt="" width="28" height="21" loading="lazy" decoding="async"></span>';return L.icon?'<span class="dd-i">'+L.icon+'</span>':L.badge?'<span class="dd-b">'+esc(L.badge)+'</span>':'';}

  function enhance(sel){
    var bare=!!sel.closest('.city-pick');          /* the "Flying from" city: its label already shows the choice */
    var wrap=document.createElement('span');wrap.className='dd'+(bare?' dd-bare':'');
    sel.parentNode.insertBefore(wrap,sel);wrap.appendChild(sel);
    sel.classList.add('dd-native');sel.tabIndex=-1;sel.setAttribute('aria-hidden','true');
    var id='dd'+(++uid),btn=document.createElement('button');btn.type='button';btn.className='dd-btn';btn.id=id+'b';
    btn.setAttribute('aria-haspopup','listbox');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls',id+'l');
    var lab=sel.getAttribute('aria-label')||(sel.id&&document.querySelector('label[for="'+sel.id+'"]')||{}).textContent||'';
    if(lab)btn.setAttribute('aria-label',lab.trim());
    btn.innerHTML='<span class="dd-v"></span><svg class="dd-c" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    wrap.appendChild(btn);
    /* the visible label now points at the button */
    if(sel.id){var l=document.querySelector('label[for="'+sel.id+'"]');if(l){l.setAttribute('for',id+'b');l.id=l.id||id+'lab';btn.setAttribute('aria-labelledby',l.id+' '+id+'b');btn.removeAttribute('aria-label');}}
    var list=document.createElement('ul');list.className='dd-list'+(sel.options.length>12?' dd-long':'');list.id=id+'l';list.setAttribute('role','listbox');list.tabIndex=-1;
    if(lab)list.setAttribute('aria-label',lab.trim());
    var items=[];
    Array.prototype.forEach.call(sel.children,function(ch){
      if(ch.tagName==='OPTGROUP'){var h=document.createElement('li');h.className='dd-g';h.setAttribute('role','presentation');h.textContent=ch.label;list.appendChild(h);
        Array.prototype.forEach.call(ch.children,add);}else add(ch);});
    function add(o){var li=document.createElement('li'),L=look(sel,o);li.className='dd-o';li.setAttribute('role','option');li.id=id+'o'+items.length;
      li.innerHTML=lead(L)+'<span class="dd-t"><b>'+esc(L.main)+'</b>'+(L.sub?'<small>'+esc(L.sub)+'</small>':'')+'</span>';
      li.setAttribute('aria-label',o.textContent);li.dataset.k=(L.main+' '+o.textContent).toLowerCase();li.dataset.v=o.value;if(o.value==='')li.classList.add('dd-ph');items.push(li);list.appendChild(li);}
    if(sel.id==='f-cc')list.classList.add('dd-wide');
    list.hidden=true;document.body.appendChild(list);
    var cur=-1;
    function refresh(){var i=sel.selectedIndex,o=sel.options[i],L=o?look(sel,o):{main:''};
      btn.querySelector('.dd-v').innerHTML=(bare?'':lead(L))+'<span>'+esc(L.short||(o?o.textContent:''))+'</span>';
      btn.classList.toggle('dd-empty',!o||o.value==='');
      items.forEach(function(li,k){li.setAttribute('aria-selected',k===i?'true':'false');});}
    /* scripts that set .value or .selectedIndex directly (the hero's study chips, the city guess) update the button too */
    try{Object.defineProperty(sel,'value',{configurable:true,get:function(){return proto.get.call(sel);},set:function(v){proto.set.call(sel,v);refresh();}});
      Object.defineProperty(sel,'selectedIndex',{configurable:true,get:function(){return protoIdx.get.call(sel);},set:function(v){protoIdx.set.call(sel,v);refresh();}});}catch(e){}
    sel.addEventListener('change',refresh);
    function mark(i){if(cur>=0&&items[cur])items[cur].classList.remove('dd-a');cur=Math.max(0,Math.min(items.length-1,i));var li=items[cur];
      li.classList.add('dd-a');list.setAttribute('aria-activedescendant',li.id);
      var t=li.offsetTop,b=t+li.offsetHeight;if(t<list.scrollTop)list.scrollTop=t-6;else if(b>list.scrollTop+list.clientHeight)list.scrollTop=b-list.clientHeight+6;}
    function place(){var r=btn.getBoundingClientRect(),vh=window.innerHeight,vw=window.innerWidth;
      var w=Math.min(vw-16,Math.max(r.width,bare?270:list.classList.contains('dd-wide')?280:290)),left=Math.min(Math.max(8,r.left),vw-w-8);
      var keep=list.scrollTop;list.style.width=w+'px';list.style.left=left+'px';
      var full=list.__full||(list.__full=(function(){var m=list.style.maxHeight;list.style.maxHeight='none';var s=list.scrollHeight;list.style.maxHeight=m;return s;})());var h=Math.min(full,list.classList.contains('dd-long')?320:300),below=vh-r.bottom-10,above=r.top-10;
      var up=below<h&&above>below;list.classList.toggle('dd-up',up);
      if(up){list.style.top='';list.style.bottom=(vh-r.top+6)+'px';list.style.maxHeight=Math.min(h,above)+'px';}
      else{list.style.bottom='';list.style.top=(r.bottom+6)+'px';list.style.maxHeight=Math.min(h,Math.max(140,below))+'px';}list.scrollTop=keep;}
    function show(){if(open&&open!==api)open.close(false);open=api;refresh();list.hidden=false;place();btn.setAttribute('aria-expanded','true');wrap.classList.add('dd-open');
      mark(Math.max(0,sel.selectedIndex));requestAnimationFrame(function(){list.classList.add('on');});list.focus({preventScroll:true});}
    function close(focus){if(open===api)open=null;list.classList.remove('on');btn.setAttribute('aria-expanded','false');wrap.classList.remove('dd-open');
      setTimeout(function(){if(open!==api)list.hidden=true;},reduce?0:160);if(focus!==false)btn.focus({preventScroll:true});}
    function choose(i){var o=sel.options[i];if(!o)return;if(sel.selectedIndex!==i){protoIdx.set.call(sel,i);refresh();
      sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}));}close();}
    var api={close:close,place:place};
    btn.addEventListener('click',function(){open===api?close():show();});
    btn.addEventListener('keydown',function(e){if(e.key==='ArrowDown'||e.key==='ArrowUp'||(e.altKey&&e.key==='ArrowDown')){e.preventDefault();show();}});
    list.addEventListener('mousedown',function(e){e.preventDefault();});
    list.addEventListener('click',function(e){var li=e.target.closest('.dd-o');if(li)choose(items.indexOf(li));});
    list.addEventListener('mousemove',function(e){var li=e.target.closest('.dd-o');if(li&&items.indexOf(li)!==cur)mark(items.indexOf(li));});
    var typed='',tt=0;
    list.addEventListener('keydown',function(e){var k=e.key;
      if(k==='ArrowDown'){e.preventDefault();mark(cur+1);}else if(k==='ArrowUp'){e.preventDefault();mark(cur-1);}
      else if(k==='Home'){e.preventDefault();mark(0);}else if(k==='End'){e.preventDefault();mark(items.length-1);}
      else if(k==='PageDown'){e.preventDefault();mark(cur+8);}else if(k==='PageUp'){e.preventDefault();mark(cur-8);}
      else if(k==='Enter'||k===' '){e.preventDefault();choose(cur);}
      else if(k==='Escape'){e.preventDefault();close();}
      else if(k==='Tab'){close(false);}
      else if(k.length===1&&/\S/.test(k)){typed+=k.toLowerCase();clearTimeout(tt);tt=setTimeout(function(){typed='';},600);
        for(var n=0;n<items.length;n++){var j=(cur+(typed.length===1?1:0)+n)%items.length;if(items[j].dataset.k.indexOf(typed)===0||items[j].dataset.k.indexOf(' '+typed)>=0){mark(j);break;}}}});
    list.addEventListener('blur',function(){setTimeout(function(){if(open===api&&document.activeElement!==list&&document.activeElement!==btn)close(false);},0);});
    refresh();
  }
  sels.forEach(enhance);
  document.addEventListener('pointerdown',function(e){if(open&&!e.target.closest('.dd-list,.dd-btn'))open.close(false);},true);
  addEventListener('resize',function(){if(open)open.place();},{passive:true});
  addEventListener('scroll',function(e){if(open&&!(e.target&&e.target.classList&&e.target.classList.contains('dd-list')))open.place();},{passive:true,capture:true});
})();
