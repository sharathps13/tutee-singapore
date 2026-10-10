/* Live news ticker (assets/css/sg-news.css). Nothing is fetched at load: the first time the visitor reaches the band,
   it asks /api/news (netlify/functions/news.mjs) for the latest study-in-Singapore headlines, writes them in and
   starts the glide. If the news can't be reached (offline, a preview without the function), it shows links to the
   official news pages instead, so the band is never empty. The glide pauses on hover, focus,
   off screen and in a hidden tab, and never runs with reduced motion. */
(function(){
  var band=document.getElementById('newsBand'),track=document.getElementById('nbTrack');
  if(!band||!track)return;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var OFFICIAL=[
    {title:'Live headlines are on their way. Meanwhile, the official news pages:',source:'Update',link:null},
    {title:"ICA newsroom: Student's Pass and immigration announcements",source:'ICA',link:'https://www.ica.gov.sg/news-and-publications/newsroom'},
    {title:'MOE press releases: grants and higher education',source:'MOE',link:'https://www.moe.gov.sg/news/press-releases'},
    {title:'MOM newsroom: work passes and employment rules',source:'MOM',link:'https://www.mom.gov.sg/newsroom'}
  ];
  function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function ago(iso){if(!iso)return '';var s=(Date.now()-Date.parse(iso))/1000;if(!(s>=0))return '';
    if(s<3600)return Math.max(1,Math.round(s/60))+' min ago';if(s<86400)return Math.round(s/3600)+'h ago';var d=Math.round(s/86400);return d===1?'yesterday':d+' days ago';}
  function items(list,copy){return list.map(function(n){
    return '<li'+(copy?' aria-hidden="true"':'')+'><span class="nb-src">'+esc(n.source||'News')+'</span>'+
      (n.link?'<a href="'+esc(n.link)+'" target="_blank" rel="noopener"'+(copy?' tabindex="-1"':'')+'>'+esc(n.title)+'</a>':'<span>'+esc(n.title)+'</span>')+
      (n.date?'<span class="nb-time">'+ago(n.date)+'</span>':'')+'</li>';}).join('');}
  function show(list){
    track.classList.remove('run');
    track.innerHTML=items(list,false)+(reduce?'':items(list,true));
    if(reduce)return;
    /* a steady reading speed (about 55px a second), whatever the number of headlines or the screen width */
    requestAnimationFrame(function(){var w=track.scrollWidth/2;track.style.setProperty('--nb-d',Math.max(30,Math.round(w/55))+'s');track.classList.add('run');});
  }
  var started=false;
  function start(){if(started)return;started=true;band.classList.add('nb-in-view');
    var live=/^https?:$/.test(location.protocol);
    if(!live||!window.fetch){show(OFFICIAL);return;}
    var done=false,t=setTimeout(function(){if(!done){done=true;show(OFFICIAL);}},9000);
    fetch('/api/news',{headers:{Accept:'application/json'}}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
      .then(function(d){if(done)return;done=true;clearTimeout(t);var ok=d&&d.success&&d.items&&d.items.length;show(ok?d.items:OFFICIAL);if(!ok)retry();});
  }
  /* the live news could not be reached: try again every minute while the band is on screen, up to five times */
  var tries=0;function retry(){if(++tries>5)return;setTimeout(function(){if(band.classList.contains('nb-off')||document.hidden){tries--;retry();return;}
    fetch('/api/news',{headers:{Accept:'application/json'}}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
      .then(function(d){if(d&&d.success&&d.items&&d.items.length)show(d.items);else retry();});},60000);}
  if('IntersectionObserver' in window){
    /* starts once the band is properly on screen (not merely loaded below the fold); afterwards it only pauses off screen */
    new IntersectionObserver(function(es){var e=es[0];if(e.isIntersecting&&e.intersectionRatio>=.5)start();band.classList.toggle('nb-off',!e.isIntersecting);},{threshold:[0,.5]}).observe(band);
  }else start();
  document.addEventListener('visibilitychange',function(){band.classList.toggle('nb-off',document.hidden);});
})();
