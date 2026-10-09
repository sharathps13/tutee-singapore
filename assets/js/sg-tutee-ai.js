/* Tutee AI (assets/css/sg-tutee-ai.css): a chat assistant, opened from the Tutee Connect button at the bottom left.
   It answers questions about this page: first from a set of topics written from the page's own content (each with
   several wordings, so the same question gets a slightly different answer each time), then, for anything else, by
   searching the page's FAQ and sections for the closest passage. It runs entirely in the browser: nothing typed here
   leaves the page. It never invents fees or figures; for anything personal it points to the free consultation.
   The button is added once the page has loaded; the chat window is only built the first time it is opened. */
(function(){
  if(!document.getElementById('home'))return;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ICON=(document.querySelector('.ph-brand img')||{}).src||'assets/img/tutee-connect-icon.png';
  function pick(a){return a[Math.floor(Math.random()*a.length)];}
  function esc(t){return String(t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  /* ---------- what Tutee AI knows: topics, each with ways of asking and ways of answering ---------- */
  var WA='<a href="https://wa.me/917358364959" target="_blank" rel="noopener">WhatsApp +91 73583 64959</a>';
  var T=[
    {id:'hello',k:['hi','hello','hey','hai','hola','morning','evening','namaste','vanakkam'],a:[
      'Hello! I\'m Tutee AI. Ask me anything about studying in Singapore: universities, the Student\'s Pass, costs, funding or work after you graduate.',
      'Hi there! I can help with Singapore universities, applications, the Student\'s Pass, funding and life after graduation. What would you like to know?',
      'Vanakkam, and welcome! What would you like to know about studying in Singapore?'],s:['Which universities can I apply to?','How does the Student\'s Pass work?','Can I work while I study?']},
    {id:'thanks',k:['thanks','thank','thx','great','helpful','awesome','cool','ok','okay'],a:[
      'You\'re welcome! Anything else I can help with?','Happy to help. Ask me anything else, or reserve a free call with an advisor.','Glad that helped! What else would you like to know?'],s:['Reserve a free call','What does it cost?']},
    {id:'about',k:['who','tutee','connect','company','trust','experience','records','agency','consultancy'],a:[
      'Tutee Connect guides students from India and South Asia from choosing a course to their first week in Singapore, with one advisor who stays with you through every step. The first consultation is free.',
      'We\'re Tutee Connect, a study and immigration consultancy. For Singapore we cover nine services, from career consultation and college selection to the Student\'s Pass, financial aid and settling in, all with one advisor.'],
      l:['#services','See our nine services'],s:['What services do you offer?','How does it work, step by step?']},
    {id:'services',k:['services','service','offer','offers','provide','package','packages'],a:[
      'Nine services, one team: career consultation, language tests, college selection, documentation, the Student\'s Pass, financial aid, end-to-end settlement, post-landing support and family migration.',
      'We help before you apply (career consultation, language tests, college selection), while you get in (documentation, Student\'s Pass, financial aid) and after you land (settlement, post-landing support, family migration).'],
      l:['#services','Open What we do'],s:['Is the consultation free?','How does it work, step by step?']},
    {id:'steps',k:['process','steps','step','how','works','journey','stages','stops','start'],a:[
      'It\'s seven stops: counselling, assessment, university documents, finance, visa documents, submission, and landing in Singapore. One advisor flies the whole route with you.',
      'From your first call to your first week there are seven stops: a free counselling session, a profile assessment, university documents, a finance plan, visa documents, submission, and then landing and settling in.'],
      l:['#how','See how it works'],s:['When should I apply?','What do I need to apply?']},
    {id:'unis',k:['university','universities','college','colleges','nus','ntu','smu','sutd','ranking','rank','best','top','institution','institutions','polytechnic','private','shortlist'],a:[
      'Singapore\'s top four by the EduRank 2026 ranking are NUS, NTU, SMU and SUTD. NUS is #10 and NTU #12 in the world in the QS 2027 rankings. There are 126 institutions that can host a Student\'s Pass, including polytechnics, offshore campuses and EduTrust-certified private institutions.',
      'NUS (#10 in the world, QS 2027) and NTU (#12) lead, with SMU and SUTD close behind. Beyond them are the polytechnics, offshore campuses and 106 EduTrust-certified private institutions: 126 in all that can host a Student\'s Pass.'],
      l:['institutions.html','Browse all 126 institutions'],s:['What is the Tuition Grant?','Can I work part-time while studying?']},
    {id:'apply',k:['need','requirements','require','documents','apply','application','eligibility','eligible','admission','admissions','transcripts','sop','gmat'],a:[
      'Most universities ask for a valid passport, your academic transcripts, an English test score (IELTS, TOEFL or PTE Academic), a statement of purpose and references. Some postgraduate courses, MBAs especially, also ask for a GMAT and work experience.',
      'You\'ll usually need your passport, transcripts, an IELTS, TOEFL or PTE score, a statement of purpose and references. MBAs often add a GMAT and work experience. We check every document line by line before you submit.'],
      l:['#faq','Read the FAQ'],s:['When should I apply?','Do I need IELTS?']},
    {id:'when',k:['when','deadline','deadlines','intake','intakes','august','timeline','early','month','date'],a:[
      'The autonomous universities start in August. For August 2027, NUS takes international applications from mid-December 2026 to mid-February 2027, and the others open around the same time. Private institutions and polytechnics have more intakes. Start about a year ahead.',
      'Aim to start about a year before you want to begin. NUS\'s window for August 2027 runs from mid-December 2026 to mid-February 2027; private institutions and polytechnics have more than one intake a year.'],
      s:['What do I need to apply?','How does the Student\'s Pass work?']},
    {id:'pass',k:['visa','pass','student','students','solar','ica','permit','approval','ipa','long','take','takes','processing','weeks','days'],a:[
      'After you accept an offer, your institution registers you in SOLAR and you apply online. Apply 2 to 3 months before your course starts; ICA usually decides within a week, or two if you also need a visa. There\'s a processing fee when you apply and an issuance fee when the Pass is issued.',
      'The Student\'s Pass is issued by ICA. Your university registers you in SOLAR, you complete the application online 2 to 3 months ahead, and a decision usually comes in 1 to 2 weeks. We handle it all the way to your completion formalities in Singapore.'],
      l:['#services','See the Student\'s Pass service'],s:['Is there a visa interview?','How long does it take?']},
    {id:'medical',k:['medical','interview','exam','examination','health','biometrics'],a:[
      'There\'s no visa interview for the Student\'s Pass. ICA may ask for a medical examination report depending on your case, and you complete formalities in Singapore after you arrive. We prepare you for each step before you fly.',
      'No interview is needed. A medical report may be requested depending on your case, and the final formalities happen after you land. We walk you through each one.'],s:['How does the Student\'s Pass work?']},
    {id:'english',k:['english','ielts','toefl','pte','language','test','score'],a:[
      'Courses are taught in English and Singapore has no immigration language test; your university sets the score it needs. Most accept IELTS, TOEFL or PTE Academic, and we coach you for the one your university asks for.',
      'There\'s no language test for immigration. Each university sets its own English requirement (IELTS, TOEFL or PTE Academic), and our language-test service gets you to that score.'],s:['What do I need to apply?']},
    {id:'grant',k:['grant','tuition','moe','bond','subsidy','catch'],a:[
      'The MOE Tuition Grant is a Singapore government grant, open to international students, that substantially lowers tuition at the autonomous universities and polytechnics. In return you work for a Singapore-registered employer for three years after graduating.',
      'It\'s a government grant that cuts your yearly tuition at the autonomous universities and polytechnics, in exchange for a three-year work bond with a Singapore-registered employer. Your advisor shows you the fees with and without it.'],
      l:['#costs','See funding options'],s:['What does it cost?','Can I get an education loan?']},
    {id:'cost',k:['cost','costs','fee','fees','price','expensive','cheap','afford','budget','living','rent','accommodation','housing'],a:[
      'It depends on your course, housing and lifestyle, and fees change every year, so we don\'t publish figures that go out of date. In your free consultation we build a personal cost plan covering tuition, housing, living costs and how to fund them.',
      'Costs vary by course and lifestyle, and are revised yearly. Rather than guess, your advisor prepares an exact cost plan with you, free, including the Tuition Grant, scholarships and loans that could bring it down.'],
      l:['#enquire','Get my cost plan'],s:['What is the Tuition Grant?','Can I get an education loan?']},
    {id:'loan',k:['loan','loans','bank','finance','financing','collateral','emi'],a:[
      'Yes. Through our banking partners (including Auxilo, Avanse, Axis Bank and HDFC Credila) we arrange collateral and non-collateral education loans covering tuition, accommodation and living costs, and show you the repayment plan before you sign.',
      'We arrange education loans with our partner banks, with or without collateral, for tuition, housing and living costs. You\'ll see the full repayment plan first.'],
      l:['#costs','See funding'],s:['Are there scholarships?','What is the Tuition Grant?']},
    {id:'scholar',k:['scholarship','scholarships','bursary','bursaries','merit','aid','financial'],a:[
      'Yes: we match you to university scholarships and bursaries alongside the Tuition Grant, and help with the applications, essays included.',
      'We look for merit scholarships and bursaries that fit your profile and help you apply, alongside the Tuition Grant and education loans.'],
      l:['#costs','See funding options'],s:['Can I get an education loan?']},
    {id:'work',k:['work','job','jobs','part','time','part-time','earn','hours','internship'],a:[
      'Only at institutions on the Ministry of Manpower\'s approved list, which includes NUS, NTU, SMU and the polytechnics. There you can work up to 16 hours a week in term, with no limit in official vacations. Most private institutions aren\'t on the list.',
      'Part-time work is allowed only at MOM-approved institutions such as NUS, NTU, SMU and the polytechnics: up to 16 hours a week in term and unlimited in the official vacations. Exchange students can\'t work.'],
      s:['What happens after I graduate?']},
    {id:'after',k:['after','graduate','graduation','post','study','employment','ep','compass','pr','permanent','residence','settle','stay','ltvp'],a:[
      'Singapore has no dedicated post-study work visa. Graduates of an Institute of Higher Learning can apply for a Long-Term Visit Pass to look for work, then move to an Employment Pass once hired; that needs a qualifying salary and 40 points on MOM\'s COMPASS framework. Permanent Residence can come later.',
      'The usual path is Student\'s Pass, then a Long-Term Visit Pass to job-hunt, then an Employment Pass (a qualifying salary and 40 COMPASS points), and Permanent Residence once you\'re established. Try the slider in Your pathway to see what each pass allows.'],
      l:['#pathway','Open Your pathway'],s:['Can my family join me?','Can I work while I study?']},
    {id:'family',k:['family','spouse','wife','husband','children','kids','parents','dependant','dependent'],a:[
      'Not on a Student\'s Pass. Once you hold an Employment Pass or S Pass, your spouse and children under 21 can join on a Dependant\'s Pass if you meet the salary criteria; parents can come on a Long-Term Visit Pass at a higher salary level.',
      'Family can visit but not stay while you study. On an Employment Pass or S Pass, a spouse and children under 21 can join on a Dependant\'s Pass, and parents on a Long-Term Visit Pass, subject to salary criteria.'],
      l:['#family','See family migration'],s:['What happens after I graduate?']},
    {id:'why',k:['why','safe','benefits','advantages','choose','worth','reasons'],a:[
      'Singapore pairs globally ranked degrees (NUS #10, NTU #12, QS 2027) with short flights home, an English-speaking city, the MOE Tuition Grant and a clear route from Student\'s Pass to Employment Pass.',
      'Top-ranked universities, teaching in English, a government tuition grant, and a short flight from home, plus a clear pathway from studying to working there.'],
      l:['#why','See Why Singapore'],s:['Which universities can I apply to?']},
    {id:'contact',k:['contact','call','phone','whatsapp','email','talk','advisor','counsellor','consultation','book','reserve','appointment','free','speak'],a:[
      'The first consultation is free. Reserve a call on the pass in Your free consultation and pick a time, or message us on '+WA+'. You can also email info@tuteeconnect.com.',
      'You can reserve a free call with an advisor (just pick a time slot), or chat with us right now on '+WA+'.'],
      l:['#enquire','Reserve my free call'],s:['What happens in the consultation?']},
    {id:'other',k:['usa','uk','canada','australia','zealand','ireland','germany','france','finland','poland','malaysia','uae','mauritius','abroad','countries','country'],a:[
      'Besides Singapore, Tutee Connect helps students with the USA, UK, Canada, Australia, New Zealand, Ireland, Germany, France, Finland, Poland, Malaysia, the UAE and Mauritius. Your advisor can compare them with Singapore for you.',
      'We also cover the USA, UK, Canada, Australia, New Zealand, Ireland, Germany, France, Finland, Poland, Malaysia, the UAE and Mauritius. Ask for a comparison in your free call.'],
      l:['#enquire','Ask an advisor'],s:['Why Singapore?']}
  ];
  var LEAD=['','','Good question. ','Here\'s the short version: ','Sure. '];
  var PHR=[[/how (does|do|will|would) (it|this|the process|you|tutee|your service)[^?]*work|step[- ]by[- ]step|the process|what are the steps/,'steps'],
    [/\bwhen\b[^?]*(apply|start|join|intake|begin)|deadline|last date|which intake/,'when'],
    [/after (i |you )?graduat|post[- ]study|stay (on|back) after|permanent resid|\bpr\b/,'after'],
    [/how much|what (does|will) it cost|is it (expensive|costly|affordable)/,'cost'],
    [/(work|job)[^?]*(while|during)[^?]*(study|studying|course)|part[- ]?time/,'work'],
    [/who are you|what are you|are you (a )?(bot|human|ai)/,'about'],
    [/free (call|consultation)|talk to (an? )?(advisor|human|person|someone)|book a call|contact/,'contact']];
  var MORE=['Anything else?','Want me to explain another part?','Ask me another question anytime.',''];
  var STOP=' a an the is are am be to of in on at for and or i my me we you your it do does can could should would will what which how where with about from this that there get any much many tell please want know'.split(' ');
  function words(t){return (t.toLowerCase().replace(/[’]/g,"'").match(/[a-z0-9']+/g)||[]).map(function(w){return w.replace(/'s$/,'');});}

  /* the page itself, for questions outside the topics: FAQ answers, then section text, as passages to match */
  var PAGE=null;
  function pageIndex(){if(PAGE)return PAGE;PAGE=[];
    [].forEach.call(document.querySelectorAll('#faqList details'),function(d){var s=d.querySelector('summary');if(!s)return;
      var q=s.textContent.replace(/^(Admissions|Student's Pass|Money|Work and after)/,'').trim(),body=d.textContent.replace(s.textContent,'').replace(/\s+/g,' ').trim();
      PAGE.push({t:q+' '+body,say:body,where:'#faq',lbl:'From the FAQ: '+q});});
    [].forEach.call(document.querySelectorAll('main > section'),function(sec){if(!sec.id||sec.id==='faq')return;
      var h=sec.querySelector('h2');[].forEach.call(sec.querySelectorAll('p, li, h3'),function(p){var x=p.textContent.replace(/\s+/g,' ').trim();if(x.length<40||x.length>420)return;
        PAGE.push({t:x+' '+(h?h.textContent:''),say:x,where:'#'+sec.id,lbl:h?h.textContent.trim():''});});});
    return PAGE;}
  function score(qw,text){var tw=words(text),set={},n=0;tw.forEach(function(w){set[w]=1;});qw.forEach(function(w){if(set[w])n+=w.length>4?1.4:1;});return n;}

  function answer(q){
    var qw=words(q).filter(function(w){return STOP.indexOf(w)<0;});
    /* whole phrases first, where single words would mislead ("how does it work" is not about part-time work) */
    var low=q.toLowerCase();
    for(var i=0;i<PHR.length;i++)if(PHR[i][0].test(low)){var pt=T.filter(function(t){return t.id===PHR[i][1];})[0];
      if(pt)return {html:pick(LEAD)+pick(pt.a),l:pt.l,s:pt.s,id:pt.id};}
    var best=null,bs=0;
    T.forEach(function(t){var s=0;qw.forEach(function(w){t.k.forEach(function(k){if(w===k)s+=k.length>4?2:1.5;else if(k.length>4&&w.length>4&&(w.indexOf(k)===0||k.indexOf(w)===0))s+=1;});});if(s>bs){bs=s;best=t;}});
    if(best&&bs>=1.5&&!(best.id==='hello'&&qw.length>3))return {html:(best.id==='hello'||best.id==='thanks'?'':pick(LEAD))+pick(best.a),l:best.l,s:best.s,id:best.id};
    var P=pageIndex(),pb=null,ps=0;P.forEach(function(p){var s=score(qw,p.t);if(s>ps){ps=s;pb=p;}});
    if(pb&&ps>=2)return {html:pick(['Here\'s what the page says: ','From this page: ','This should help: '])+esc(pb.say),l:[pb.where,pb.lbl||'Show me on the page'],s:['Reserve a free call']};
    return {html:pick(['I don\'t have that on this page yet, but an advisor can answer it in your free call, or on '+WA+'.',
      'That one\'s best answered by an advisor. Reserve a free call, or message us on '+WA+'.',
      'I\'m not sure about that one. I can help with universities, applications, the Student\'s Pass, costs, funding and work. Or ask an advisor directly on '+WA+'.']),
      l:['#enquire','Reserve my free call'],s:['Which universities can I apply to?','What does it cost?','Can I work while I study?']};
  }

  /* ---------- the button and the window ---------- */
  var btn,box,log,form,input,chips,built=false,open=false,last=null;
  function addButton(){
    btn=document.createElement('button');btn.type='button';btn.className='tai-btn';btn.setAttribute('aria-haspopup','dialog');btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-label','Ask Tutee AI');
    btn.innerHTML='<img src="'+esc(ICON)+'" alt="" width="40" height="40"><span class="tai-btn-t">Ask Tutee AI</span>';
    btn.addEventListener('click',function(){open?close():show();});
    document.body.appendChild(btn);
    /* phones: the button sits in the bottom action bar instead of floating over the page */
    var bar=document.getElementById('mBar'),mm=window.matchMedia&&matchMedia('(max-width: 760px)');
    function dock(){if(!bar||!mm)return;if(mm.matches){bar.insertBefore(btn,bar.firstChild);bar.classList.add('has-tai');btn.classList.add('tai-in-bar');}
      else{document.body.appendChild(btn);bar.classList.remove('has-tai');btn.classList.remove('tai-in-bar');}}
    dock();if(mm&&mm.addEventListener)mm.addEventListener('change',dock);
    requestAnimationFrame(function(){btn.classList.add('in');});
  }
  function build(){built=true;
    box=document.createElement('div');box.className='tai';box.id='taiBox';box.setAttribute('role','dialog');box.setAttribute('aria-label','Tutee AI chat');box.hidden=true;
    box.innerHTML='<header class="tai-h"><img src="'+esc(ICON)+'" alt="" width="36" height="36"><div><b>Tutee AI</b><small><i></i>Answers from this page, instantly</small></div>'+
      '<button type="button" class="tai-x" aria-label="Close chat"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>'+
      '<div class="tai-log" role="log" aria-live="polite"></div><div class="tai-chips" role="group" aria-label="Suggested questions"></div>'+
      '<form class="tai-f"><label class="sr-only" for="taiIn">Your question</label><input id="taiIn" autocomplete="off" maxlength="240" placeholder="Ask about universities, visas, costs..."><button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.5 19.5 21.5 12 2.5 4.5 2.5 10.3 15 12 2.5 13.7z"/></svg></button></form>'+
      '<p class="tai-note">Tutee AI answers from this page. For advice on your own case, talk to an advisor.</p>';
    document.body.appendChild(box);btn.setAttribute('aria-controls','taiBox');
    log=box.querySelector('.tai-log');form=box.querySelector('form');input=box.querySelector('input');chips=box.querySelector('.tai-chips');
    box.querySelector('.tai-x').addEventListener('click',close);
    box.addEventListener('keydown',function(e){if(e.key==='Escape'){e.stopPropagation();close();}});
    form.addEventListener('submit',function(e){e.preventDefault();var q=input.value.trim();if(!q)return;input.value='';ask(q);});
    chips.addEventListener('click',function(e){var b=e.target.closest('button');if(b)ask(b.textContent);});
    /* links in answers: in-page ones close the chat on phones so the section shows, then go there */
    log.addEventListener('click',function(e){var a=e.target.closest('a[href^="#"]');if(a&&window.matchMedia('(max-width: 640px)').matches)close();});
    say(pick(T[0].a),null,T[0].s);
  }
  function setChips(list){chips.innerHTML='';(list||[]).slice(0,3).forEach(function(t){var b=document.createElement('button');b.type='button';b.textContent=t;chips.appendChild(b);});}
  function add(cls,html){var m=document.createElement('div');m.className='tai-m '+cls;m.innerHTML=html;log.appendChild(m);log.scrollTop=log.scrollHeight;return m;}
  function say(html,link,sug){var h='<p>'+html+'</p>';if(link)h+='<a class="tai-go" href="'+esc(link[0])+'">'+esc(link[1])+' <span aria-hidden="true">→</span></a>';add('bot',h);setChips(sug);}
  function ask(q){
    if(/^reserve (a|my) free call$/i.test(q.trim())){add('me','<p>'+esc(q)+'</p>');close();var a=document.querySelector('a[href="#enquire"]');if(a)a.click();return;}
    add('me','<p>'+esc(q)+'</p>');setChips([]);
    var r=answer(q);if(last&&r.id&&r.id===last&&r.id!=='hello'&&r.id!=='thanks')r.html+=' '+pick(MORE);last=r.id||null;
    var dots=add('bot typing','<span></span><span></span><span></span>');
    setTimeout(function(){dots.remove();say(r.html,r.l,r.s);},reduce?60:420+Math.min(700,q.length*12));
  }
  function show(){if(!built)build();open=true;box.hidden=false;btn.setAttribute('aria-expanded','true');document.documentElement.classList.add('tai-open');
    requestAnimationFrame(function(){box.classList.add('on');});setTimeout(function(){try{input.focus({preventScroll:true});}catch(e){}},reduce?0:220);}
  function close(){open=false;btn.setAttribute('aria-expanded','false');box.classList.remove('on');document.documentElement.classList.remove('tai-open');
    setTimeout(function(){if(!open)box.hidden=true;},reduce?0:260);try{btn.focus({preventScroll:true});}catch(e){}}

  function start(){var css=document.createElement('link');css.rel='stylesheet';css.href=new URL('../css/sg-tutee-ai.css?v=3',(document.currentScript&&document.currentScript.src)||SRC).href;
    css.onload=addButton;document.head.appendChild(css);}
  var SRC=(document.currentScript&&document.currentScript.src)||location.href;
  if(document.readyState==='complete')setTimeout(start,300);else addEventListener('load',function(){setTimeout(start,300);});
})();
