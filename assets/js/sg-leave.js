/* "Leaving already?" Once a visitor has touched the enquiry form (clicked into it or typed), and until it is sent:
   - moving the pointer out through the top of the window (towards the tab bar or close button) opens a friendly
     reminder card, once per visit;
   - closing or reloading the tab triggers the browser's own "Leave site?" check. Browsers do not let a page restyle
     or reword that dialog, which is why the styled card above is shown first, while the visitor can still be won back. */
(function(){
  var form=document.getElementById('enq');if(!form)return;
  var engaged=false,shown=false,modal=null;
  function live(){return engaged&&document.body.contains(form);}   /* the form is replaced by the confirmation once sent */
  function engage(){engaged=true;}
  form.addEventListener('focusin',engage);form.addEventListener('input',engage);form.addEventListener('pointerdown',engage);

  window.addEventListener('beforeunload',function(e){if(!live())return;e.preventDefault();e.returnValue='';return '';});

  var css='.lv-wrap{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(5,40,42,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .25s ease}'
    +'.lv-wrap.on{opacity:1}.lv-card{position:relative;width:min(440px,100%);border-radius:22px;overflow:hidden;background:#fff;color:#0F2930;box-shadow:0 30px 80px rgba(0,0,0,.35);transform:translateY(16px) scale(.97);transition:transform .35s cubic-bezier(.16,1,.3,1);font-family:inherit;text-align:center}'
    +'.lv-wrap.on .lv-card{transform:none}.lv-top{padding:26px 24px 20px;background:linear-gradient(135deg,#054041 0%,#0b6466 55%,#8c0304 130%);color:#fff}'
    +'.lv-ic{display:inline-grid;place-items:center;width:58px;height:58px;border-radius:50%;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);font-size:28px;margin-bottom:10px}'
    +'.lv-top h2{margin:0 0 6px;font-size:23px;line-height:1.2;color:#fff}.lv-top p{margin:0;font-size:14.5px;opacity:.9}'
    +'.lv-body{padding:18px 24px 24px}.lv-list{list-style:none;margin:0 0 18px;padding:0;text-align:left;font-size:14.5px}.lv-list li{padding:6px 0 6px 28px;position:relative}'
    +'.lv-list li:before{content:"\\2713";position:absolute;left:0;top:5px;width:20px;height:20px;border-radius:50%;background:#E9F3F4;color:#054041;font-size:12px;font-weight:700;display:grid;place-items:center}'
    +'.lv-go{display:block;width:100%;border:0;border-radius:14px;padding:14px 18px;font:inherit;font-weight:700;font-size:16px;color:#fff;background:linear-gradient(135deg,#A51D2A,#8c0304);cursor:pointer;box-shadow:0 10px 24px rgba(140,3,4,.3)}'
    +'.lv-go:hover{filter:brightness(1.08)}.lv-no{margin-top:10px;background:none;border:0;font:inherit;font-size:13.5px;color:#5B6E72;text-decoration:underline;cursor:pointer}'
    +'.lv-x{position:absolute;top:10px;right:12px;width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;font-size:20px;line-height:1;cursor:pointer}'
    +'@media (prefers-reduced-motion:reduce){.lv-wrap,.lv-card{transition:none}}';

  function close(){if(!modal)return;var m=modal;modal=null;m.classList.remove('on');document.removeEventListener('keydown',onKey);setTimeout(function(){m.remove();},260);}
  function onKey(e){if(e.key==='Escape')close();}
  function finish(){
    close();
    var need=['f-name','f-phone','f-email'].map(function(id){return document.getElementById(id);}).filter(function(i){return i&&!i.value.trim();})[0]||document.getElementById('f-name');
    var sec=document.getElementById('enquire');if(sec)sec.scrollIntoView({behavior:'smooth',block:'start'});
    setTimeout(function(){try{need.focus({preventScroll:true});}catch(e){}},500);
  }
  function show(){
    if(shown||!live())return;shown=true;
    if(!document.getElementById('lv-css')){var s=document.createElement('style');s.id='lv-css';s.textContent=css;document.head.appendChild(s);}
    var first=(document.getElementById('f-name').value.trim().split(/\s+/)[0]||'');
    modal=document.createElement('div');modal.className='lv-wrap';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','lv-h');
    modal.innerHTML='<div class="lv-card"><button class="lv-x" type="button" aria-label="Close">&times;</button>'
      +'<div class="lv-top"><div class="lv-ic" aria-hidden="true">&#9992;&#xFE0F;</div><h2 id="lv-h"></h2><p>Your free Singapore consultation is just a few seconds away.</p></div>'
      +'<div class="lv-body"><ul class="lv-list"><li>A one-to-one call with a Singapore advisor</li><li>Your shortlist, scholarships and visa steps, planned</li><li>No fees, and no obligation</li></ul>'
      +'<button class="lv-go" type="button">Finish my enquiry</button><button class="lv-no" type="button">No thanks, I’ll leave</button></div></div>';
    modal.querySelector('#lv-h').textContent=first?('Wait, '+first+'! Are you sure you want to go?'):'Wait! Are you sure you want to go?';
    modal.addEventListener('click',function(e){if(e.target===modal)close();});
    modal.querySelector('.lv-x').addEventListener('click',close);
    modal.querySelector('.lv-no').addEventListener('click',close);
    modal.querySelector('.lv-go').addEventListener('click',finish);
    document.body.appendChild(modal);document.addEventListener('keydown',onKey);
    requestAnimationFrame(function(){requestAnimationFrame(function(){if(modal)modal.classList.add('on');});});
    modal.querySelector('.lv-go').focus({preventScroll:true});
  }
  /* exit intent: the pointer leaves the page through the top edge */
  document.addEventListener('mouseout',function(e){if(!e.relatedTarget&&e.clientY<=0)show();});
  /* on phones there is no pointer to watch: show it when the visitor switches away and comes back */
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&matchMedia('(pointer:coarse)').matches)show();});
})();
