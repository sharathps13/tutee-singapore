
(function(){
  var D=JSON.parse(document.getElementById('data').textContent),doc=document.documentElement,HOME='index.html';
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var LABEL={'Autonomous University':'Public university','Polytechnic':'Polytechnic','ITE':'ITE','Offshore Campus':'Offshore campus','Arts Institution':'Arts institution','Higher Education':'Private (degree)','Vocational':'Private (diploma)'};
  var INFO={
    'National University of Singapore':['NUS','Singapore\'s oldest and largest university','Founded in 1905, NUS is a comprehensive research university on a large campus at Kent Ridge, with faculties ranging from medicine and law to computing.'],
    'Nanyang Technological University':['NTU','A leading research university in Asia','NTU is known for engineering, science and Nanyang Business School, and has one of the largest campuses in Singapore, in the green west of the island.'],
    'Singapore Management University':['SMU','The city-campus university','Small, seminar-style classes in the heart of the city, focused on business, accountancy, economics, computing and law.'],
    'Singapore University of Technology and Design':['SUTD','Design-centred technology university','Set up in collaboration with MIT, SUTD blends engineering, architecture and design through hands-on, project-based learning.'],
    'Singapore University of Social Sciences':['SUSS','Applied learning in the social sciences','Practice-focused degrees in social sciences, business and law, with strong links to Singapore\'s public and community sectors.'],
    'Singapore Institute of Technology':['SIT','The university of applied learning','Industry-linked degrees with built-in work attachments, based on the new Punggol campus.'],
    'LASALLE College of the Arts':['LASALLE','Contemporary arts in the city centre','Degrees in design, media, fine art and performance, as part of the University of the Arts Singapore.'],
    'Nanyang Academy of Fine Arts':['NAFA','Singapore\'s oldest arts institution','Founded in 1938, NAFA teaches visual and performing arts and design, as part of the University of the Arts Singapore.']};
var HEART='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>';
  /* ---------- shortlist (shared with the landing page's consultation form) ---------- */
  var SL=(function(){var KEY='tc-shortlist',subs=[];
    function get(){try{var v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(function(x){return x&&x.n;}):[];}catch(e){return [];}}
    function set(l){try{localStorage.setItem(KEY,JSON.stringify(l.slice(0,12)));}catch(e){}subs.forEach(function(f){f(get());});}
    function toggle(n,sh){var l=get(),i=-1;l.forEach(function(x,k){if(x.n===n)i=k;});if(i>-1)l.splice(i,1);else{if(l.length>=12)return null;l.push({n:n,s:sh||''});}set(l);return i<0;}
    addEventListener('storage',function(e){if(e.key===KEY)subs.forEach(function(f){f(get());});});
    return {get:get,set:set,toggle:toggle,on:function(f){subs.push(f);}};})();
  function paintHearts(){var l=SL.get();[].forEach.call(document.querySelectorAll('.sl-heart,.sl-btn'),function(h){var on=l.some(function(x){return x.n===h.dataset.n;});
    h.setAttribute('aria-pressed',on?'true':'false');if(h.classList.contains('sl-heart'))h.setAttribute('aria-label',(on?'Remove ':'Add ')+h.dataset.n+(on?' from':' to')+' my shortlist');});}
  var ARROW='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  var PIN='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" style="vertical-align:-2px;margin-right:3px"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  function chips(p){return '<div class="chips">'+(p||'').split(/,\s*/).filter(Boolean).map(function(x){return '<span>'+esc(x)+'</span>';}).join('')+'</div>';}
  var curList=[];D.forEach(function(u,i){u.k=i;});
  var R=D.filter(function(u){return u.sg;}).sort(function(a,b){return a.sg-b.sg;}),O=D.filter(function(u){return !u.sg;});

  /* #1 and #2 */
  document.getElementById('feat').innerHTML=R.slice(0,2).map(function(u,i){var f=INFO[u.n]||[u.n,'',''];
    return '<article class="feat rv clk'+(i?' flip':'')+'" data-k="'+u.k+'"><div class="side"><div><small>In Singapore</small><div class="rank" aria-label="Rank '+u.sg+'">'+u.sg+'<sup>'+(u.sg===1?'st':'nd')+'</sup></div></div>'+
      '<div class="medal"><i>#'+esc(u.qs)+'</i><span><b>In the world</b>QS World University Rankings 2027</span></div></div>'+
      '<div class="body"><span class="tagline">'+esc(f[1])+'</span><h3>'+esc(u.n)+' <span style="color:var(--soft);font-size:.6em">('+f[0]+')</span></h3><p>'+esc(f[2])+'</p>'+
      '<dl class="facts"><div><dt>Type</dt><dd>'+LABEL[u.t]+'</dd></div><div><dt>Campus</dt><dd>'+esc(u.l)+'</dd></div><div><dt>Student\'s Pass</dt><dd>'+esc(u.b)+'</dd></div><div><dt>Tuition Grant</dt><dd>Eligible</dd></div></dl>'+chips(u.p)+
      '<div class="acts"><button type="button" class="btn pri" data-k="'+u.k+'">Quick facts about '+f[0]+'</button><button type="button" class="btn sl-btn" data-n="'+esc(u.n)+'" data-s="'+esc(f[0])+'" aria-pressed="false">'+HEART+'<span class="a">Add to shortlist</span><span class="r">Shortlisted</span></button></div></div></article>';}).join('');

  /* #3 to #8 */
  document.getElementById('ladder').innerHTML=R.slice(2).map(function(u){var f=INFO[u.n]||[u.n,'',''];
    return '<article class="rung rv clk" data-k="'+u.k+'" tabindex="0" role="button" aria-haspopup="dialog" aria-label="'+esc(u.n)+': quick facts"><div class="n">'+u.sg+'<small>in SG</small></div><div><h3>'+esc(u.n)+'</h3><div class="meta"><span>'+LABEL[u.t]+'</span><span>'+PIN+esc(u.l)+'</span></div><p>'+esc(f[2])+'</p>'+chips(u.p)+'<span class="peek">Quick facts <span aria-hidden="true">→</span></span></div>'+
      '<button type="button" class="sl-heart go" data-n="'+esc(u.n)+'" data-s="'+esc(f[0])+'" aria-pressed="false" aria-label="Add '+esc(u.n)+' to my shortlist">'+HEART+'</button></article>';}).join('');

  /* the rest */
  var TABS=[['Polytechnic','Polytechnics','Publicly funded, practice-based three-year diplomas, and a popular route into the local universities.'],
    ['ITE','ITE','The Institute of Technical Education: hands-on technical and vocational courses.'],
    ['Offshore Campus','Offshore campuses','Singapore campuses of overseas universities and schools, awarding the home institution\'s qualification.'],
    ['Higher Education','Private: degrees','EduTrust-certified private institutions, many delivering degrees with UK and Australian partner universities.'],
    ['Vocational','Private: diplomas','EduTrust-certified private schools offering diplomas and certificates, from hospitality and business to languages.']];
  function cnt(t){return O.filter(function(u){return u.t===t;}).length;}
  var tabs=document.getElementById('tabs'),cur=TABS[0][0],PAGE=innerWidth<640?12:20,shown=PAGE;
  tabs.innerHTML=TABS.map(function(t,i){return '<button type="button" role="tab" class="tab" data-t="'+t[0]+'" aria-selected="'+(i===0)+'">'+t[1]+'<small>'+cnt(t[0])+'</small></button>';}).join('');
  function sel(t){cur=t;[].forEach.call(tabs.children,function(b){b.setAttribute('aria-selected',b.dataset.t===t?'true':'false');});shown=PAGE;render();}
  tabs.addEventListener('click',function(e){var b=e.target.closest('.tab');if(b)sel(b.dataset.t);});
  var q=document.getElementById('q'),list=document.getElementById('list'),more=document.getElementById('more'),empty=document.getElementById('empty'),td=document.getElementById('tdesc'),t0=0;
  O.forEach(function(u){u.s=(u.n+' '+u.l+' '+u.p).toLowerCase();});
  q.addEventListener('input',function(){clearTimeout(t0);t0=setTimeout(function(){shown=PAGE;render();},120);});
  more.addEventListener('click',function(){shown=1e4;render();});
  function render(){
    var term=q.value.trim().toLowerCase(),tab=TABS.filter(function(t){return t[0]===cur;})[0];
    td.textContent=tab[2];
    var l=curList=O.filter(function(u){return u.t===cur&&(!term||u.s.indexOf(term)>-1);}).sort(function(a,b){return a.n.localeCompare(b.n);});
    list.innerHTML=l.slice(0,shown).map(function(u){return '<li><button type="button" class="it" data-k="'+u.k+'" aria-haspopup="dialog"><b>'+esc(u.n)+'</b><span class="a">'+esc(u.l)+'</span><span class="f">'+esc(u.p)+'</span><span class="i" aria-hidden="true">i</span></button><button type="button" class="sl-heart" data-n="'+esc(u.n)+'" data-s="'+esc(mono(u))+'" aria-pressed="false" aria-label="Add '+esc(u.n)+' to my shortlist">'+HEART+'</button></li>';}).join('');paintHearts();
    empty.hidden=l.length>0;more.parentNode.hidden=l.length<=shown;more.textContent='Show all '+l.length;
  }
  render();


  /* ---------- quick-facts popup ---------- */
  var FOUNDED={'National University of Singapore':'1905','Nanyang Technological University':'1991 (roots in 1955)','Singapore Management University':'2000','Singapore University of Technology and Design':'2009','Singapore University of Social Sciences':'2017 as a university','Singapore Institute of Technology':'2009','LASALLE College of the Arts':'1984','Nanyang Academy of Fine Arts':'1938'};
  var COL={'Autonomous University':'#B1202D','Polytechnic':'#14707C','ITE':'#2E7D5B','Offshore Campus':'#9A6410','Arts Institution':'#8E1823','Higher Education':'#2F5F6B','Vocational':'#4E6267'};
  var TYPE={
    'Autonomous University':['One of Singapore\'s six publicly funded autonomous universities.','Bachelor\'s, master\'s and PhD','Available for eligible courses','In return, a three-year work bond in Singapore','Allowed','Up to 16 hours a week in term, MOM-approved institution'],
    'Polytechnic':['One of Singapore\'s five publicly funded polytechnics, teaching practice-based diplomas that lead to work or on to a local university.','Diplomas, usually three years','Available for eligible courses','In return, a three-year work bond in Singapore','Allowed','Up to 16 hours a week in term, MOM-approved institution'],
    'ITE':['The Institute of Technical Education, Singapore\'s public provider of hands-on technical and vocational education, across three college campuses.','Nitec and Higher Nitec certificates, and technical diplomas','Ask your advisor','Depends on the course','Ask your advisor','We confirm the current rules for your course'],
    'Offshore Campus':['The Singapore campus of an overseas institution. You study here and graduate with the home institution\'s qualification.','The home institution\'s degrees and postgraduate programmes','Not available','The MOE grant covers local public institutions only','Depends on the institution','We confirm the current rules for your course'],
    'Arts Institution':['A specialist arts institution, part of the University of the Arts Singapore.','Diplomas and degrees','Available for many courses','In return, a three-year work bond in Singapore','Ask your advisor','We confirm the current rules for your course'],
    'Higher Education':['An EduTrust-certified private institution. Many of its degrees are awarded by overseas partner universities, often from the UK or Australia.','Diplomas, plus degrees with overseas partner universities','Not available','The MOE grant covers public institutions only','Usually not allowed','Most private institutions are not on MOM\'s approved list'],
    'Vocational':['An EduTrust-certified private school focused on certificates and diplomas for a specific career or skill.','Certificates and diplomas','Not available','The MOE grant covers public institutions only','Usually not allowed','Most private institutions are not on MOM\'s approved list']};
  var BASIS={'ICA-listed IHL':'Listed by ICA as an institution of higher learning that can host Student\'s Pass holders.',
    'EduTrust (4-year)':'Holds full EduTrust certification for four years, which lets a private institution enrol international students.',
    'EduTrust Star (4-year)':'Holds EduTrust Star, the highest tier of the certification, awarded for excellence.',
    'EduTrust Provisional (1-year)':'Holds a one-year provisional EduTrust certification. It allows international enrolment but is reviewed sooner, so your advisor double-checks it.',
    'Publicly funded (UAS)':'Publicly funded through the University of the Arts Singapore. Your advisor confirms its current status.'};
  var qf=document.getElementById('qf'),ctx=[],pos=0,lastFocus=null;
  function mono(u){var f=INFO[u.n];if(f)return f[0].length<=4?f[0]:f[0].slice(0,3);var m=(u.aka||'').match(/\b[A-Z][A-Z0-9-]{1,5}\b/);if(m&&m[0].length<=5)return m[0];
    return u.n.replace(/[()\-]/g,' ').split(/\s+/).filter(function(w){return /^[A-Z]/.test(w)&&!/^(Of|The|And|For)$/.test(w);}).slice(0,3).map(function(w){return w[0];}).join('');}
  function fill(u){
    var T=TYPE[u.t],f=INFO[u.n],ranked=!!u.sg,h=document.getElementById('qf-h');
    h.style.setProperty('--c',ranked?(u.sg===2?'#8E1823':(u.sg===1?'#14535F':COL[u.t])):COL[u.t]);
    var aka=u.aka&&!f?'<div class="qf-aka">Also known as '+esc(u.aka)+'</div>':(f?'<div class="qf-aka">'+esc(f[1])+'</div>':'');
    var badges='<div class="qf-badges">'+(ranked?'<span class="r">#'+u.sg+' in Singapore</span>':'<span>Not ranked</span>')+(u.qs?'<span class="g">#'+esc(u.qs.replace('=',''))+(u.qs.charAt(0)==='='?' (joint)':'')+' in the world · QS 2027</span>':'')+'<span>'+LABEL[u.t]+'</span></div>';
    document.getElementById('qf-hd').innerHTML='<div class="qf-top"><span class="qf-crest" aria-hidden="true">'+esc(mono(u))+'</span><div><span class="qf-k">'+(ranked?'Singapore ranking 2026':'Quick facts')+'</span><h2 id="qf-t">'+esc(u.n)+'</h2>'+aka+'</div></div>'+badges;
    var area=esc(u.l)+(u.reg?'<small>'+esc(u.reg)+'</small>':'');
    var g='<dl class="qf-g">'+(f?'<div><dt>Founded</dt><dd>'+FOUNDED[u.n]+'</dd></div>':'')+'<div'+(f?'':' class="w"')+'><dt>'+(f?'Campus':'Area')+'</dt><dd>'+area+'</dd></div>'+
      '<div class="w st"><dt>Study levels</dt><dd>'+T[1]+'</dd></div>'+
      '<div><dt>MOE Tuition Grant</dt><dd>'+T[2]+'<small>'+T[3]+'</small></dd></div>'+
      '<div><dt>Part-time work</dt><dd>'+T[4]+'<small>'+T[5]+'</small></dd></div>'+
      '<div class="w bs"><dt>Student\'s Pass basis</dt><dd>'+esc(u.b)+'<small>'+(BASIS[u.b]||'')+'</small></dd></div>'+
      (u.uen?'<div class="w uen"><dt>Registration number (UEN)</dt><dd>'+esc(u.uen)+'<small>Registered with the Committee for Private Education.</small></dd></div>':'')+'</dl>';
    document.getElementById('qf-b').innerHTML='<div class="qf-l"><p>'+esc(f?f[2]:T[0])+'</p><h3>Popular fields</h3>'+chips(u.p)+'</div>'+g;
    qf.classList.remove('tight','tighter','tightest','tiniest','scrolls');fit();
    var short=f?f[0]:null;
    document.getElementById('qf-a').innerHTML='<button type="button" class="btn sl-btn" data-n="'+esc(u.n)+'" data-s="'+esc(short||mono(u))+'" aria-pressed="false">'+HEART+'<span class="a">Add to shortlist</span><span class="r">Shortlisted</span></button>'+
      '<a class="btn pri" href="'+HOME+'#enquire">'+(short?'Ask about '+esc(short):'Ask an advisor')+'</a>';paintHearts();
    document.getElementById('qf-p').disabled=pos<=0;document.getElementById('qf-n').disabled=pos>=ctx.length-1;
    document.getElementById('qf-b').scrollTop=0;
  }
  function over(){var b=document.getElementById('qf-b'),f=qf.querySelector('.qf-f');return b.scrollHeight>b.clientHeight+1||f.scrollHeight>f.clientHeight+2;}
  function fit(){if(!qf.open)return;var L=['tight','tighter','tightest','tiniest','scrolls'];for(var i=0;i<L.length&&over();i++)qf.classList.add(L[i]);}
  addEventListener('resize',function(){if(qf.open){qf.classList.remove('tight','tighter','tightest','tiniest','scrolls');fit();}});
  function openQF(k,list){ctx=list;pos=Math.max(0,list.map(function(u){return u.k;}).indexOf(k));fill(ctx[pos]);
    if(!qf.open){lastFocus=document.activeElement;doc.classList.add('qf-lock');if(qf.showModal)qf.showModal();else qf.setAttribute('open','');fit();}}
  function closeQF(){qf.close?qf.close():qf.removeAttribute('open');}
  qf.addEventListener('close',function(){doc.classList.remove('qf-lock');if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});});
  document.getElementById('qf-x').addEventListener('click',closeQF);
  qf.addEventListener('click',function(e){if(e.target===qf)closeQF();});
  document.getElementById('qf-p').addEventListener('click',function(){if(pos>0){pos--;fill(ctx[pos]);}});
  document.getElementById('qf-n').addEventListener('click',function(){if(pos<ctx.length-1){pos++;fill(ctx[pos]);}});
  qf.addEventListener('keydown',function(e){if(e.key==='ArrowRight'&&pos<ctx.length-1){pos++;fill(ctx[pos]);}if(e.key==='ArrowLeft'&&pos>0){pos--;fill(ctx[pos]);}});
  document.getElementById('ranked').addEventListener('click',function(e){if(e.target.closest('a,.sl-heart,.sl-btn,#gs'))return;var c=e.target.closest('[data-k]');if(c)openQF(+c.dataset.k,R);});
  document.getElementById('ladder').addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('rung')){e.preventDefault();openQF(+e.target.dataset.k,R);}});
  list.addEventListener('click',function(e){var b=e.target.closest('.it');if(b)openQF(+b.dataset.k,curList);});


  /* ---------- search across all 126, instant: every keystroke re-ranks the list ---------- */
  var SYN={computing:['comput','information technology','infocomm','data & ai','software'],computer:['comput','information technology','infocomm'],it:['information technology','infocomm'],ai:['data & ai','artificial'],data:['data & ai','data'],
    health:['health','nursing','medicine','pharm'],medicine:['medicine','health'],medical:['medicine','health','nursing'],nursing:['nursing','health'],design:['design','architecture','animation','media'],art:['arts','design','music','performing'],arts:['arts','design','music','performing'],
    business:['business','management','accountancy','marketing','finance'],finance:['finance','accountancy'],engineering:['engineering'],law:['law'],hotel:['hospitality'],hospitality:['hospitality','culinary'],cooking:['culinary'],chef:['culinary'],
    psychology:['psychology'],music:['music'],film:['media'],media:['media'],aviation:['aviation'],teaching:['education','early childhood'],english:['language'],language:['language']};
  /* extra course keywords for the public institutions, so a course search finds them (search only, not displayed) */
  var KW={'National University of Singapore':'computing computer science information systems data ai law medicine nursing pharmacy dentistry engineering business science design architecture music economics',
    'Nanyang Technological University':'computing computer science data ai engineering business science medicine art design media communication education',
    'Singapore Management University':'business accountancy finance law economics computing information systems data social sciences',
    'Singapore University of Technology and Design':'engineering architecture design computing computer science ai data',
    'Singapore Institute of Technology':'engineering health nursing computing infocomm hospitality design food',
    'Singapore University of Social Sciences':'social sciences business law education psychology human resources',
    'Nanyang Polytechnic':'nursing health computing infocomm design media chemical engineering','Ngee Ann Polytechnic':'nursing health computing infocomm design film media',
    'Republic Polytechnic':'hospitality sports computing infocomm','Singapore Polytechnic':'computing infocomm media design maritime','Temasek Polytechnic':'hospitality computing infocomm design media'};
  D.forEach(function(u){var f=INFO[u.n];u.sh=f?f[0]:mono(u);
    u.tier=u.sg?40-u.sg*2:(u.t==='Polytechnic'?14:(u.t==='Arts Institution'||u.t==='Offshore Campus'?8:(u.t==='ITE'?6:0)));
    u.hn=u.n.toLowerCase();u.ha=((u.aka||'')+' '+u.sh).toLowerCase();u.hf=((u.p||'')+' '+(KW[u.n]||'')).toLowerCase();u.hl=(u.l+' '+(u.reg||'')).toLowerCase();u.ht=(LABEL[u.t]||'').toLowerCase();
    u.hw=u.hn.split(/[^a-z0-9]+/).filter(Boolean);});
  function variants(t){var v=[t];for(var k in SYN){if(k===t||(t.length>=4&&k.indexOf(t)===0))v=v.concat(SYN[k]);}return v;}
  function scoreTok(u,t){var best=0,vs=variants(t);
    if(u.sh.toLowerCase()===t)best=140;
    for(var i=0;i<vs.length;i++){var v=vs[i],sc=0;
      if(u.hn.indexOf(v)===0)sc=i?60:110;else if(u.hw.some(function(w){return w.indexOf(v)===0;}))sc=i?44:80;else if(u.hn.indexOf(v)>-1)sc=i?36:55;
      else if(u.ha.indexOf(v)>-1)sc=50;else if(u.hf.indexOf(v)>-1)sc=i?28:34;else if(u.hl.indexOf(v)>-1)sc=22;else if(u.ht.indexOf(v)>-1)sc=16;
      if(sc>best)best=sc;}
    return best;}
  function hl(name,toks){var lo=name.toLowerCase(),marks=[];toks.forEach(function(t){var i=lo.indexOf(t);if(i>-1)marks.push([i,i+t.length]);});
    if(!marks.length)return esc(name);marks.sort(function(a,b){return a[0]-b[0];});var out='',p=0;
    marks.forEach(function(m){if(m[0]<p)return;out+=esc(name.slice(p,m[0]))+'<mark>'+esc(name.slice(m[0],m[1]))+'</mark>';p=m[1];});return out+esc(name.slice(p));}
  var gq=document.getElementById('gq'),gres=document.getElementById('gres'),gcount=document.getElementById('gcount'),gall=document.getElementById('gall'),gList=[],gShow=8,GHINT=gcount.textContent;
  function gsearch(){var raw=gq.value.trim().toLowerCase(),toks=raw.split(/\s+/).filter(Boolean);
    if(!toks.length){gList=[];gres.innerHTML='';gcount.textContent=GHINT;gall.hidden=true;document.getElementById('gs').classList.remove('has');return;}
    var out=[];for(var i=0;i<D.length;i++){var u=D[i],tot=0,ok=true;
      for(var j=0;j<toks.length;j++){var sc=scoreTok(u,toks[j]);if(!sc){ok=false;break;}tot+=sc;}
      if(ok)out.push([tot+u.tier+(u.qs?6:0),u]);}
    out.sort(function(a,b){return b[0]-a[0]||a[1].n.localeCompare(b[1].n);});gList=out.map(function(x){return x[1];});
    document.getElementById('gs').classList.add('has');
    gcount.textContent=gList.length?gList.length+(gList.length===1?' match':' matches')+', best first':'No institution matches "'+gq.value.trim()+'". Try a course or an area instead.';
    gres.innerHTML=gList.slice(0,gShow).map(function(u,i){return '<li style="--d:'+Math.min(i,8)*25+'ms"><button type="button" class="gr" data-k="'+u.k+'"><span class="gr-c" style="--c:'+(COL[u.t]||'#14535F')+'">'+esc(u.sh.slice(0,5))+'</span>'+
      '<span class="gr-t"><b>'+hl(u.n,toks)+'</b><small>'+esc(LABEL[u.t])+' · '+esc(u.l)+(u.p?' · '+esc(u.p):'')+'</small></span>'+
      (u.sg?'<span class="gr-r">#'+u.sg+' in SG</span>':'')+(u.qs?'<span class="gr-r g">#'+esc(u.qs.replace('=',''))+' world</span>':'')+'</button>'+
      '<button type="button" class="sl-heart" data-n="'+esc(u.n)+'" data-s="'+esc(u.sh)+'" aria-pressed="false" aria-label="Add '+esc(u.n)+' to my shortlist">'+HEART+'</button></li>';}).join('');
    gall.hidden=gList.length<=gShow;gall.textContent='Show all '+gList.length+' matches';paintHearts();}
  gq.addEventListener('input',function(){gShow=8;gsearch();});
  gall.addEventListener('click',function(){gShow=1e4;gsearch();});
  gres.addEventListener('click',function(e){var b=e.target.closest('.gr');if(b)openQF(+b.dataset.k,gList);});
  document.querySelector('.gs-quick').addEventListener('click',function(e){var b=e.target.closest('button[data-q]');if(!b)return;gq.value=b.dataset.q;gShow=8;gsearch();gq.focus({preventScroll:true});});
  addEventListener('keydown',function(e){if(e.key==='/'&&!/input|textarea|select/i.test((document.activeElement||{}).tagName||'')&&!qf.open){e.preventDefault();gq.focus();gq.scrollIntoView({block:'center',behavior:'smooth'});}});
  (function(){var m=location.search.match(/[?&]q=([^&]+)/);if(m){try{gq.value=decodeURIComponent(m[1].replace(/\+/g,' '));}catch(e){}gsearch();
    setTimeout(function(){document.getElementById('gs').scrollIntoView({block:'start'});},60);}})();

  /* ---------- shortlist: hearts everywhere, a floating button and a drawer ---------- */
  var fab=document.getElementById('cartFab'),cart=document.getElementById('cart'),cl=document.getElementById('cartL'),cn=document.getElementById('cartN');
  function paintCart(){var l=SL.get();cn.textContent=l.length;fab.hidden=!l.length&&!cart.open;
    document.getElementById('cartE').hidden=!!l.length;document.getElementById('cartGo').classList.toggle('off',!l.length);document.getElementById('cartClear').hidden=!l.length;
    cl.innerHTML=l.map(function(x,i){var u=D.filter(function(d){return d.n===x.n;})[0];
      return '<li><span class="ci-n">'+(i+1)+'</span><div class="ci-t"><b>'+esc(x.n)+'</b><small>'+(u?esc(LABEL[u.t])+(u.sg?' · #'+u.sg+' in Singapore':'')+(u.qs?' · #'+esc(u.qs.replace('=',''))+' in the world':''):'')+'</small></div>'+
        '<span class="ci-m"><button type="button" data-mv="-1" data-i="'+i+'" aria-label="Move up"'+(i?'':' disabled')+'>↑</button><button type="button" data-mv="1" data-i="'+i+'" aria-label="Move down"'+(i<l.length-1?'':' disabled')+'>↓</button><button type="button" data-rm="'+i+'" aria-label="Remove '+esc(x.n)+'">×</button></span></li>';}).join('');}
  SL.on(function(){paintHearts();paintCart();});
  var toast=document.createElement('div');toast.className='sl-toast';toast.setAttribute('role','status');document.body.appendChild(toast);var tt=0;
  document.addEventListener('click',function(e){var h=e.target.closest('.sl-heart,.sl-btn');if(!h)return;e.preventDefault();e.stopPropagation();
    var on=SL.toggle(h.dataset.n,h.dataset.s);if(on===null){toast.textContent='Your shortlist holds up to 12. Remove one to add another.';}
    else{toast.textContent=(on?'Added ':'Removed ')+(h.dataset.s||h.dataset.n)+(on?' to':' from')+' your shortlist';h.classList.remove('pop');void h.offsetWidth;h.classList.add('pop');
      if(on){fab.classList.remove('bump');void fab.offsetWidth;fab.classList.add('bump');}}
    toast.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){toast.classList.remove('on');},2600);},true);
  fab.addEventListener('click',function(){paintCart();if(cart.showModal)cart.showModal();else cart.setAttribute('open','');doc.classList.add('qf-lock');});
  cart.addEventListener('close',function(){doc.classList.remove('qf-lock');paintCart();});
  cart.addEventListener('click',function(e){if(e.target===cart){cart.close();return;}var l=SL.get(),b=e.target.closest('button');if(!b)return;
    if(b.dataset.mv){var i=+b.dataset.i,j=i+(+b.dataset.mv);if(j<0||j>=l.length)return;var t=l[i];l[i]=l[j];l[j]=t;SL.set(l);var nb=cl.querySelector('[data-i="'+j+'"][data-mv="'+b.dataset.mv+'"]')||cl.querySelector('[data-i="'+j+'"]');if(nb)nb.focus();}
    else if(b.dataset.rm){l.splice(+b.dataset.rm,1);SL.set(l);}});
  document.getElementById('cartX').addEventListener('click',function(){cart.close();});
  document.getElementById('cartClear').addEventListener('click',function(){SL.set([]);});
  paintHearts();paintCart();
  /* hero jump links */
  var jp=document.getElementById('jump');
  jp.innerHTML='<a class="hot" href="#ranked"><span>Ranked in Singapore</span><b>'+R.length+'</b></a>'+
    [['Polytechnic','Polytechnics and ITE',cnt('Polytechnic')+cnt('ITE')],['Offshore Campus','Offshore campuses',cnt('Offshore Campus')],['Higher Education','Private institutions',cnt('Higher Education')+cnt('Vocational')]]
    .map(function(x){return '<a href="#others" data-t="'+x[0]+'"><span>'+x[1]+'</span><b>'+x[2]+'</b></a>';}).join('');
  jp.addEventListener('click',function(e){var a=e.target.closest('a[data-t]');if(a)sel(a.dataset.t);});

  var rv=document.querySelectorAll('.rv');
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px'});
    [].forEach.call(rv,function(el,i){if(el.classList.contains('rung'))el.style.transitionDelay=(i%2)*90+'ms';io.observe(el);});}
  else [].forEach.call(rv,function(el){el.classList.add('in');});
  setTimeout(function(){[].forEach.call(rv,function(el){if(el.getBoundingClientRect().top<innerHeight)el.classList.add('in');});},1200);

  document.getElementById('tt').addEventListener('click',function(){var m=doc.getAttribute('data-mode')==='dark'?'light':'dark';
    function go(){doc.setAttribute('data-mode',m);}
    if(document.startViewTransition&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.startViewTransition(go);else go();
    try{localStorage.setItem('tc-mode',m);}catch(e){}});
})();
