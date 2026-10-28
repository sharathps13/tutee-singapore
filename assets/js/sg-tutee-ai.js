/* Tutee AI (assets/css/sg-tutee-ai.css): the page's assistant, opened from the Tutee Connect button at the bottom left.
   It answers in the browser, with no AI service and no key, from three sources, in this order:
     1. the 126 institutions on institutions.html (read once, the first time the chat opens): any institution by name
        or short name, which ones teach a subject, the polytechnics or private colleges, the ones in an area, and a
        side-by-side comparison of two;
     2. topics written from this page (several wordings each, so a question doesn't always get the same answer);
     3. everything else on the page (FAQ, the seven stops, the nine services, the pathway, funding), ranked with BM25
        after the question is normalised (plurals, accents, typos, and synonyms such as "PR" for permanent residence).
   It remembers what the conversation is about, so "and its ranking?" or "what about NTU?" work as follow-ups, keeps
   the chat for the visit (sessionStorage), and never invents fees or figures: below a confidence threshold it says so
   and points to an advisor.
   Questions stay in the browser. The one thing it sends is a callback request: "Request a callback" (or "talk to a
   counsellor", "call me") asks for a name, phone and email, then posts them to this site's /api/enquiry, which adds
   them to the Singapore Leads sheet and emails the team. "cancel" stops it at any point.
   The button is added once the page has loaded; the chat window is only built the first time it is opened. */
(function(){
  if(!document.getElementById('home'))return;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* the round Tutee Connect mark, sharp at every screen density (assets/img/brand, made from the master logo) */
  var ICON='assets/img/brand/tc-icon-48.webp',ICONS='assets/img/brand/tc-icon-48.webp 1x, assets/img/brand/tc-icon-96.webp 2x, assets/img/brand/tc-icon-144.webp 3x, assets/img/brand/tc-icon-192.webp 4x';
  var KEY='tc_sg_ai_chat';
  function pick(a){return a[Math.floor(Math.random()*a.length)];}
  function esc(t){return String(t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  /* ---------- what Tutee AI knows: topics, each with ways of asking and ways of answering ---------- */
  var WA='[WhatsApp +91 73583 64959](https://wa.me/917358364959)';
  var CHIPS=['Request a callback','Which universities can I apply to?','How does the Student\'s Pass work?','Can I work while I study?'];
  var T=[
    {id:'hello',k:['hi','hello','hey','hai','hola','morning','evening','namaste','vanakkam'],a:[
      'Hello! I\'m **Tutee AI**. Ask me anything about studying in Singapore: universities, the Student\'s Pass, costs, funding or work after you graduate.',
      'Hi there! I can help with Singapore universities, applications, the Student\'s Pass, funding and life after graduation. What would you like to know?',
      'Vanakkam, and welcome! What would you like to know about studying in Singapore?'],s:['Which universities can I apply to?','How does the Student\'s Pass work?','Can I work while I study?']},
    {id:'thanks',k:['thanks','thank','thx','great','helpful','awesome','cool','ok','okay'],a:[
      'You\'re welcome! Anything else I can help with?','Happy to help. Ask me anything else, or reserve a free call with an advisor.','Glad that helped! What else would you like to know?'],s:['Reserve a free call','Request a callback','What does it cost?']},
    {id:'about',k:['who','tutee','connect','company','trust','experience','records','agency','consultancy'],a:[
      'Tutee Connect guides students from India and South Asia from choosing a course to their first week in Singapore, with one advisor who stays with you through every step. The first consultation is free.',
      'We\'re Tutee Connect, a study and immigration consultancy. For Singapore we cover nine services, from career consultation and college selection to the Student\'s Pass, financial aid and settling in, all with one advisor.'],
      l:['#services','See our nine services'],s:['What services do you offer?','How does it work, step by step?']},
    {id:'services',k:['services','service','offer','offers','provide','package','packages'],a:[
      'Nine services, one team:\n- **Before you apply:** career consultation, language tests, college selection\n- **Getting in:** documentation, the Student\'s Pass, financial aid\n- **After you land:** settlement, post-landing support, family migration',
      'We help before you apply (career consultation, language tests, college selection), while you get in (documentation, Student\'s Pass, financial aid) and after you land (settlement, post-landing support, family migration).'],
      l:['#services','Open What we do'],s:['Is the consultation free?','How does it work, step by step?']},
    {id:'steps',k:['process','steps','step','how','works','journey','stages','stops','start'],a:[
      'It\'s seven stops, with one advisor flying the whole route with you:\n- Counselling\n- Assessment\n- University documents\n- Finance\n- Visa documents\n- Submission\n- Landing in Singapore',
      'From your first call to your first week there are seven stops: a free counselling session, a profile assessment, university documents, a finance plan, visa documents, submission, and then landing and settling in.'],
      l:['#how','See how it works'],s:['When should I apply?','What do I need to apply?']},
    {id:'unis',k:['university','universities','college','colleges','ranking','rank','best','top','institution','institutions','polytechnic','private','shortlist'],a:[
      'Singapore\'s top four by the EduRank 2026 ranking are **NUS, NTU, SMU and SUTD**. NUS is **#10** and NTU **#12** in the world in the QS 2027 rankings. There are **126 institutions** that can host a Student\'s Pass, including polytechnics, offshore campuses and EduTrust-certified private institutions.',
      '**NUS** (#10 in the world, QS 2027) and **NTU** (#12) lead, with SMU and SUTD close behind. Beyond them are the polytechnics, offshore campuses and EduTrust-certified private institutions: **126** in all that can host a Student\'s Pass.'],
      l:['institutions.html','Browse all 126 institutions'],s:['Tell me about NUS','Which institutions teach nursing?','List the polytechnics']},
    {id:'apply',k:['need','requirements','require','documents','apply','application','eligibility','eligible','admission','admissions','transcripts','sop','gmat'],a:[
      'Most universities ask for:\n- A valid passport and your academic transcripts\n- An English test score (IELTS, TOEFL or PTE Academic)\n- A statement of purpose and references\nSome postgraduate courses, MBAs especially, also ask for a GMAT and work experience.',
      'You\'ll usually need your passport, transcripts, an IELTS, TOEFL or PTE score, a statement of purpose and references. MBAs often add a GMAT and work experience. We check every document line by line before you submit.'],
      l:['#faq','Read the FAQ'],s:['When should I apply?','Do I need IELTS?']},
    {id:'when',k:['when','deadline','deadlines','intake','intakes','august','timeline','early','month','date'],a:[
      'The autonomous universities start in **August**. For August 2027, NUS takes international applications from **mid-December 2026 to mid-February 2027**, and the others open around the same time. Private institutions and polytechnics have more intakes. Start about a year ahead.',
      'Aim to start about a year before you want to begin. NUS\'s window for August 2027 runs from mid-December 2026 to mid-February 2027; private institutions and polytechnics have more than one intake a year.'],
      s:['What do I need to apply?','How does the Student\'s Pass work?']},
    {id:'pass',k:['visa','pass','student','students','solar','ica','permit','approval','ipa','long','take','takes','processing','weeks','days'],a:[
      'After you accept an offer, your institution registers you in **SOLAR** and you apply online.\n- Apply **2 to 3 months** before your course starts\n- ICA usually decides within **a week**, or two if you also need a visa\n- There\'s a processing fee when you apply and an issuance fee when the Pass is issued',
      'The Student\'s Pass is issued by **ICA**. Your university registers you in SOLAR, you complete the application online 2 to 3 months ahead, and a decision usually comes in 1 to 2 weeks. We handle it all the way to your completion formalities in Singapore.'],
      l:['#services','See the Student\'s Pass service'],s:['Is there a visa interview?','Can I work while I study?']},
    {id:'medical',k:['medical','interview','exam','examination','health','biometrics'],a:[
      'There\'s **no visa interview** for the Student\'s Pass. ICA may ask for a medical examination report depending on your case, and you complete formalities in Singapore after you arrive. We prepare you for each step before you fly.',
      'No interview is needed. A medical report may be requested depending on your case, and the final formalities happen after you land. We walk you through each one.'],s:['How does the Student\'s Pass work?']},
    {id:'english',k:['english','ielts','toefl','pte','language','test','score'],a:[
      'Courses are taught in English and Singapore has **no immigration language test**; your university sets the score it needs. Most accept IELTS, TOEFL or PTE Academic, and we coach you for the one your university asks for.',
      'There\'s no language test for immigration. Each university sets its own English requirement (IELTS, TOEFL or PTE Academic), and our language-test service gets you to that score.'],s:['What do I need to apply?']},
    {id:'grant',k:['grant','tuition','moe','bond','subsidy','catch'],a:[
      'The **MOE Tuition Grant** is a Singapore government grant, open to international students, that substantially lowers tuition at the autonomous universities and polytechnics. In return you work for a Singapore-registered employer for **three years** after graduating.',
      'It\'s a government grant that cuts your yearly tuition at the autonomous universities and polytechnics, in exchange for a three-year work bond with a Singapore-registered employer. Your advisor shows you the fees with and without it.'],
      l:['#costs','See funding options'],s:['What does it cost?','Can I get an education loan?']},
    {id:'cost',k:['cost','costs','fee','fees','price','expensive','cheap','afford','budget','living','rent','accommodation','housing'],a:[
      'It depends on your course, housing and lifestyle, and fees change every year, so we don\'t publish figures that go out of date. In your free consultation we build a **personal cost plan** covering tuition, housing, living costs and how to fund them.',
      'Costs vary by course and lifestyle, and are revised yearly. Rather than guess, your advisor prepares an exact cost plan with you, free, including the Tuition Grant, scholarships and loans that could bring it down.'],
      l:['#enquire','Get my cost plan'],s:['What is the Tuition Grant?','Can I get an education loan?']},
    {id:'loan',k:['loan','loans','finance','financing','collateral','emi'],a:[
      'Yes. Through our banking partners (including Auxilo, Avanse, Axis Bank and HDFC Credila) we arrange **collateral and non-collateral** education loans covering tuition, accommodation and living costs, and show you the repayment plan before you sign.',
      'We arrange education loans with our partner banks, with or without collateral, for tuition, housing and living costs. You\'ll see the full repayment plan first.'],
      l:['#costs','See funding'],s:['Are there scholarships?','What is the Tuition Grant?']},
    {id:'scholar',k:['scholarship','scholarships','bursary','bursaries','merit','aid','financial'],a:[
      'Yes: we match you to university scholarships and bursaries alongside the Tuition Grant, and help with the applications, essays included.',
      'We look for merit scholarships and bursaries that fit your profile and help you apply, alongside the Tuition Grant and education loans.'],
      l:['#costs','See funding options'],s:['Can I get an education loan?']},
    {id:'work',k:['work','job','jobs','part','time','part-time','earn','hours','internship'],a:[
      'Only at institutions on the Ministry of Manpower\'s approved list, which includes **NUS, NTU, SMU and the polytechnics**. There you can work up to **16 hours a week** in term, with no limit in official vacations. Most private institutions aren\'t on the list.',
      'Part-time work is allowed only at MOM-approved institutions such as NUS, NTU, SMU and the polytechnics: up to 16 hours a week in term and unlimited in the official vacations. Exchange students can\'t work.'],
      s:['What happens after I graduate?']},
    {id:'after',k:['after','graduate','graduation','post','employment','ep','compass','pr','permanent','residence','settle','stay','ltvp'],a:[
      'Singapore has no dedicated post-study work visa. The usual route:\n- **Long-Term Visit Pass** to look for work (you can\'t work on it)\n- **Employment Pass** once hired: a qualifying salary and 40 points on MOM\'s COMPASS framework\n- **Permanent Residence** can come later',
      'The usual path is Student\'s Pass, then a Long-Term Visit Pass to job-hunt, then an Employment Pass (a qualifying salary and 40 COMPASS points), and Permanent Residence once you\'re established. Try the slider in Your pathway to see what each pass allows.'],
      l:['#pathway','Open Your pathway'],s:['Can my family join me?','Can I work while I study?']},
    {id:'family',k:['family','spouse','wife','husband','children','kids','parents','dependant','dependent'],a:[
      'Not on a Student\'s Pass. Once you hold an Employment Pass or S Pass, your spouse and children under 21 can join on a **Dependant\'s Pass** if you meet the salary criteria; parents can come on a Long-Term Visit Pass at a higher salary level.',
      'Family can visit but not stay while you study. On an Employment Pass or S Pass, a spouse and children under 21 can join on a Dependant\'s Pass, and parents on a Long-Term Visit Pass, subject to salary criteria.'],
      l:['#family','See family migration'],s:['What happens after I graduate?']},
    {id:'why',k:['why','safe','benefits','advantages','choose','worth','reasons'],a:[
      'Singapore pairs globally ranked degrees (**NUS #10, NTU #12**, QS 2027) with short flights home, an English-speaking city, the MOE Tuition Grant and a clear route from Student\'s Pass to Employment Pass.',
      'Top-ranked universities, teaching in English, a government tuition grant, and a short flight from home, plus a clear pathway from studying to working there.'],
      l:['#why','See Why Singapore'],s:['Which universities can I apply to?']},
    {id:'contact',k:['contact','phone','whatsapp','email','advisor','consultation','book','reserve','appointment','free'],a:[
      'The first consultation is free. Reserve a call on the pass in Your free consultation and pick a time, say **request a callback** here, or message us on '+WA+'. You can also email info@tuteeconnect.com.',
      'You can reserve a free call with an advisor (just pick a time slot), say **request a callback** and I\'ll take your details, or chat with us right now on '+WA+'.'],
      l:['#enquire','Reserve my free call'],s:['Request a callback','What happens in the consultation?']},
    {id:'edutrust',k:['edutrust','cpe','certified','certification','accredited','accreditation'],a:[
      '**EduTrust** is the quality certification the Committee for Private Education gives private schools in Singapore. A private institution needs it to take international students on a Student\'s Pass, so every private college on our list has it: **EduTrust (4-year)**, **Provisional (1-year)** or **Star**, the highest.',
      'Private colleges in Singapore must hold **EduTrust** certification, from the Committee for Private Education, to enrol international students. On the institutions page each one shows its grade: 4-year, Provisional (1-year) or Star.'],
      l:['institutions.html','See each institution\'s status'],s:['Private colleges for business','Tell me about SIM']},
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
    [/(work|job)[^?]*(while|during)[^?]*(study|studying|course)|part[- ]?time|\b(can|may) i (work|get a job)\b/,'work'],
    [/who are you|what are you|are you (a )?(bot|human|ai|real)|what can you do/,'self'],
    [/free (call|consultation)|book a call|contact (you|details)|your (phone|number|email)/,'contact']];
  var MORE=['Anything else?','Want me to explain another part?','Ask me another question anytime.',''];

  /* ---------- text: fold accents, drop filler words, stem, map synonyms, forgive typos ---------- */
  function fold(s){s=String(s==null?'':s).toLowerCase();if(s.normalize)s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');return s.replace(/[’']/g,"'");}
  var STOP={};(' a an the is are am be been was were to of in on at for and or i im my me we you your it its do does did can could should would will shall may might must what whats which how where when who why with about from '+
    'this that these those there their they them get got any much many tell please want know like just also some more most than then so if into out up by our us not ok okay really need go going here yes singapore sg study studying student students s mean meaning means explain define definition info information details bring take come make give let use see say find').split(' ').forEach(function(w){STOP[w]=1;});
  var SYN={};
  [['residence','pr permanent residency resident residence settle citizenship citizen migrate migration immigrate immigration'],
   ['work','work working job jobs employment career careers earn earning salary wage hire hiring internship parttime'],
   ['cost','cost costs fee fees tuition price prices expensive cheap affordable afford budget money spend expense expenses'],
   ['housing','rent accommodation housing hostel hall halls dorm dormitory room rooms'],
   ['family','family families partner spouse wife husband child children kid kids dependant dependants dependent dependents parent parents'],
   ['loan','loan loans financing lender lenders credit collateral'],
   ['englishtest','ielts pte toefl duolingo englishtest'],
   ['university','university universities uni unis college colleges campus institution institutions school schools'],
   ['course','course courses program programs programme programmes degree degrees major subject subjects'],
   ['visa','visa visas permit permits pass'],
   ['scholarship','scholarship scholarships bursary bursaries'],
   ['apply','apply application applications admission admissions enrol enroll enrolment offer offers']
  ].forEach(function(p){p[1].split(' ').forEach(function(w){SYN[w]=p[0];});});
  function stem(w){return w.length<5?w:w.replace(/ies$/,'y').replace(/([^s])s$/,'$1').replace(/(ing|ed)$/,function(m){return w.length>6?'':m;});}
  function toks(s){return (fold(String(s).replace(/<[^>]+>/g,' ').replace(/\bIT\b/g,' computing ')).match(/[a-z0-9]+/g)||[])
    .filter(function(t){return !STOP[t];}).map(function(t){return SYN[t]||SYN[stem(t)]||stem(t);});}
  function lev(a,b,max){if(Math.abs(a.length-b.length)>max)return max+1;var prev=[],i,j;for(j=0;j<=b.length;j++)prev[j]=j;
    for(i=1;i<=a.length;i++){var cur=[i],low=i;for(j=1;j<=b.length;j++){cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(cur[j]<low)low=cur[j];}if(low>max)return max+1;prev=cur;}
    return prev[b.length];}

  /* ---------- the institutions: read from institutions.html (same site), the first time the chat opens ---------- */
  var DB=null,dbP=null;
  /* subjects as people ask for them, matched against each institution's programme areas */
  var FIELDS=[['computing',/\b(it|computing|computer|computers|software|coding|programming|data|ai|artificial|cyber|tech|infocomm)\b/,/Information Technology|Data|Computer|Infocomm|Technology/],
    ['business',/\b(business|management|mba|marketing|commerce|bba|hr|human resources?)\b/,/Business|Management|Marketing|Human Resources/],
    ['finance',/\b(finance|accounting|accountancy|banking|economics|fintech)\b/,/Accountancy|Finance/],
    ['engineering',/\b(engineering|engineer|mechanical|electrical|civil|robotics)\b/,/Engineering/],
    ['nursing',/\b(nursing|nurse|nurses)\b/,/Nursing/],
    ['medicine',/\b(medicine|medical|mbbs|doctor|dentistry|dental)\b/,/Medicine|Dentistry/],
    ['health',/\b(health|healthcare|pharmacy|physio|biomedical)\b/,/Health|Nursing|Medicine/],
    ['hospitality',/\b(hospitality|hotel|hotels|tourism|travel|events)\b/,/Hospitality|Tourism/],
    ['culinary',/\b(culinary|chef|cooking|pastry|baking|food)\b/,/Culinary/],
    ['design',/\b(design|designer|fashion|interior|graphic|media|film|animation|games?|gaming|art|arts|music|performing)\b/,/Design|Media|Art|Music|Game|Animation/],
    ['law',/\b(law|legal|llb)\b/,/Law/],
    ['psychology',/\b(psychology|counselling|counseling)\b/,/Psychology/],
    ['education',/\b(education|teaching|teacher|early childhood|preschool)\b/,/Education|Early Childhood/],
    ['aviation',/\b(aviation|pilot|aerospace|airline)\b/,/Aviation/],
    ['logistics',/\b(logistics|supply chain|shipping)\b/,/Logistics/],
    ['architecture',/\b(architecture|architect|built environment)\b/,/Architecture/],
    ['science',/\b(science|sciences|biology|chemistry|physics|biotech)\b/,/Science/],
    ['language',/\b(english course|language course|language school|foundation|preparation|prep)\b/,/Language|School Preparation/]];
  var KINDS=[['Autonomous University',/\b(autonomous|public|government|local) (universit|uni)|\bautonomous\b/],['Polytechnic',/\bpoly(t[a-z]*|s)?\b/],['Offshore Campus',/\b(offshore|foreign|overseas|branch) (campus|campuses|universit)/],
    ['Higher Education',/\bprivate (college|colleges|institution|institutions|school|schools|universit)/],['Arts Institution',/\barts? (institution|school|college|universit)/],['ITE',/\bite\b|technical education/]];
  var AREAS=['central','west','east','north-east','north'];
  function ensureData(){
    if(dbP)return dbP;
    dbP=fetch('institutions.html',{credentials:'same-origin'}).then(function(r){return r.text();}).then(function(h){
      var m=h.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/);DB=m?JSON.parse(m[1]):[];
      DB.forEach(function(u){var names=[u.n].concat(u.aka?u.aka.split(/,\s*/):[]);
        u.short=u.aka?u.aka.split(/,\s*/)[0]:u.n;
        /* each name matches as whole words; a short code that is also an everyday word or initials (SIM, SIT, SP, NP)
           only counts when typed in capitals, so "a local SIM card" is not about the Singapore Institute of Management */
        u.keys=names.map(function(x){var cs=/^[A-Z]{2,4}$/.test(x)&&!/^(NUS|NTU|SMU|SUTD|SUSS|NYP|ITE|MDIS|PSB|JCU|LSBF|SHRM)$/.test(x);
          return cs?{cs:1,re:new RegExp('(^|[^A-Za-z0-9])('+x+')(?![A-Za-z0-9])(?!\\s*cards?\\b)')}:{re:new RegExp('(^|[^a-z0-9])('+fold(x).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?![a-z0-9])')};});});
    }).catch(function(){DB=[];});
    return dbP;
  }
  function instFind(q){if(!DB)return [];var f=' '+fold(q)+' ',hit=[];
    DB.forEach(function(u){var m='';u.keys.forEach(function(k){var x=(k.cs?q:f).match(k.re);if(x&&x[2]&&x[2].length>m.length)m=x[2];});if(m){u.m=fold(m);hit.push(u);}});
    /* a name inside a longer one that also matched ("SP" in "SP Jain", "Kaplan" in "Kaplan Higher Education Academy"):
       keep the longer */
    return hit.filter(function(u){return !hit.some(function(o){return o!==u&&o.m.length>u.m.length&&o.m.indexOf(u.m)>=0;});}).slice(0,4);}
  function qsRank(u){return '#'+String(u.qs).replace(/^=/,'')+(/^=/.test(u.qs)?' (joint)':'');}   /* "=411" is a shared place */
  function instLine(u){return '**'+u.n+'**'+(u.aka&&u.short!==u.n?' ('+u.short+')':'')+': '+u.t.toLowerCase().replace('higher education','private institution')+(u.l?', '+u.l:'');}
  function instAnswer(u,facet){
    var area=u.reg?u.reg.replace(' Region',''):'',tag=u.t==='Higher Education'?'Private institution':u.t;
    if(facet==='rank')return u.qs?'**'+u.short+'** is **'+qsRank(u)+'** in the world in the QS 2027 rankings'+(u.sg?' and #'+u.sg+' in Singapore (EduRank 2026)':'')+'.':'**'+u.n+'** isn\'t in the QS world rankings on this page'+(u.sg?', but it\'s #'+u.sg+' in Singapore (EduRank 2026)':'')+'. Rankings aren\'t everything: an advisor can tell you how it\'s regarded for your subject.';
    if(facet==='web')return u.w?'**'+u.n+'**\'s official site is ['+u.w.replace(/^https?:\/\/(www\.)?/,'')+']('+u.w+').':'I don\'t have a website for **'+u.n+'** on this page. An advisor can send you its details.';
    if(facet==='where')return '**'+u.n+'** is in **'+(u.l||'Singapore')+'**'+(area?' ('+area+' region)':'')+'.';
    if(facet==='work')return u.b==='ICA-listed IHL'?'**'+u.short+'** is an Institute of Higher Learning. Part-time work (up to 16 hours a week in term) is allowed only at institutions on MOM\'s approved list, which includes NUS, NTU, SMU and the polytechnics; your advisor confirms it for '+u.short+'.':'**'+u.n+'** is a private institution ('+u.b+'). Most private institutions are **not** on MOM\'s list for part-time work, so plan your budget without it. Your advisor can confirm.';
    return '**'+u.n+'**'+(u.aka&&u.short!==u.n?' ('+u.short+')':'')+'\n- **Type:** '+tag+'\n'+(u.l?'- **Where:** '+u.l+(area?', '+area+' region':'')+'\n':'')+
      (u.p?'- **Known for:** '+u.p+'\n':'')+(u.qs?'- **Ranking:** '+qsRank(u)+' in the world (QS 2027)'+(u.sg?', #'+u.sg+' in Singapore':'')+'\n':'')+'- **Status:** '+u.b+'\n'+(u.w?'- [Official website]('+u.w+')\n':'')+
      'Heart it on the [institutions page](institutions.html) and it goes into your consultation pass.';
  }
  function instCompare(a,b){return '**'+a.short+' vs '+b.short+':**\n'+[a,b].map(function(u){return '- **'+u.short+':** '+(u.t==='Higher Education'?'private institution':u.t.toLowerCase())+(u.l?' in '+u.l:'')+(u.qs?', QS '+qsRank(u):'')+(u.p?'; known for '+u.p.toLowerCase():'');}).join('\n')+
    '\nWhich fits better depends on your marks, course and budget, which an advisor maps on your [free call](#enquire).';}
  /* public universities first, then polytechnics and campuses, then private colleges, school-preparation centres last */
  var TYPE_ORDER=['Autonomous University','Offshore Campus','Arts Institution','Polytechnic','Higher Education','ITE','Vocational'];
  function instSort(list){return list.slice().sort(function(a,b){return (a.sg||99)-(b.sg||99)||TYPE_ORDER.indexOf(a.t)-TYPE_ORDER.indexOf(b.t)||
    (b.b==='EduTrust Star (4-year)')-(a.b==='EduTrust Star (4-year)')||a.n.localeCompare(b.n);});}
  function instList(list,title,more){var n=list.length;if(!n)return null;
    var top=list.slice(0,6);
    return title+' (**'+n+'** on this page'+(n>6?', the first six shown':'')+'):\n'+top.map(function(u){return '- '+instLine(u);}).join('\n')+(more||'\nSee them all, with filters, on the [institutions page](institutions.html).');}

  /* ---------- the page itself, for anything the topics don't cover: ranked with BM25 ---------- */
  var M=null;
  function strip(h){var d=document.createElement('div');d.innerHTML=h;return d.textContent.replace(/\s+/g,' ').trim();}
  function buildIndex(){
    var docs=[];function add(title,body,answer,where,lbl,ask){docs.push({title:title,body:body,answer:answer,where:where,lbl:lbl,ask:ask});}
    [].forEach.call(document.querySelectorAll('#faqList details'),function(d){var s=d.querySelector('summary');if(!s)return;
      var q=(s.children[1]||s).textContent.trim(),a=d.querySelector('.ans'),lines=[];
      if(a)[].forEach.call(a.children,function(c){if(c.tagName==='UL')[].forEach.call(c.children,function(li){lines.push('- '+li.textContent.trim());});else lines.push(c.textContent.trim());});
      add(q,lines.join(' '),lines.join('\n'),'#faq','Read the FAQ',q);});
    (window.__SVC||[]).forEach(function(s){var d=document.createElement('div');d.innerHTML=s.html;var h=d.querySelector('h3'),p=d.querySelector('.sp-main p');if(!h)return;
      var inc=[].map.call(d.querySelectorAll('.sp-card li'),function(li){return li.textContent.trim();});
      add(h.textContent+' service',(p?p.textContent:'')+' '+inc.join(' '),'**'+h.textContent+'.** '+(p?p.textContent:'')+(inc.length?'\n'+inc.map(function(x){return '- '+x;}).join('\n'):''),'#services','See this service','Tell me about your '+h.textContent.toLowerCase()+' service');});
    [].forEach.call(document.querySelectorAll('.jr-panel'),function(p){var h=p.querySelector('h3'),k=p.querySelector('.jr-kick'),t=p.querySelector('.jr-main > p');if(!h)return;
      var li=[].map.call(p.querySelectorAll('.jr-main li'),function(x){return x.textContent.trim();});
      add(h.textContent+' '+(k?k.textContent:'')+' step',(t?t.textContent:'')+' '+li.join(' '),'**'+h.textContent+'.** '+(t?t.textContent:'')+(li.length?'\n'+li.map(function(x){return '- '+x;}).join('\n'):''),'#how','See how it works','What happens at the '+h.textContent.toLowerCase()+' step?');});
    [].forEach.call(document.querySelectorAll('main > section'),function(sec){if(!sec.id||sec.id==='faq'||sec.id==='how'||sec.id==='enquire')return;
      var h=sec.querySelector('h2');[].forEach.call(sec.querySelectorAll('p, li, h3'),function(p){if(p.closest('.jr-panel,#spContent,.faq-list'))return;var x=p.textContent.replace(/\s+/g,' ').trim();if(x.length<40||x.length>420)return;
        add((h?h.textContent:'')+' '+(p.tagName==='H3'?x:''),x,x,'#'+sec.id,h?h.textContent.trim():'Show me on the page',null);});});
    docs.forEach(function(x){x.t=toks(x.title).concat(toks(x.title),toks(x.body));x.tf={};x.t.forEach(function(t){x.tf[t]=(x.tf[t]||0)+1;});});
    var df={};docs.forEach(function(x){Object.keys(x.tf).forEach(function(t){df[t]=(df[t]||0)+1;});});
    var N=docs.length,avg=docs.reduce(function(a,x){return a+x.t.length;},0)/Math.max(1,N);
    var dict={};Object.keys(df).concat(Object.keys(SYN)).forEach(function(w){dict[w]=1;});T.forEach(function(t){t.k.forEach(function(w){dict[w]=1;});});
    return {docs:docs,df:df,N:N,avg:avg,dict:Object.keys(dict),idf:function(t){return Math.log(1+(N-(df[t]||0)+.5)/((df[t]||0)+.5));}};
  }
  /* an unknown word becomes the closest known one, if it is close enough ("scholarshp", "polytecnic") */
  function fix(t){if(M.df[t]||t.length<4||SYN[t])return t;var max=t.length>=7?2:1,best=null,bd=max+1;
    for(var i=0;i<M.dict.length;i++){var v=M.dict[i];if(Math.abs(v.length-t.length)>max)continue;var d=lev(t,v,max);if(d<bd){bd=d;best=v;if(d===1&&max===1)break;}}
    return best?(SYN[best]||best):t;}
  function search(qt){var k1=1.2,b=.75;
    return M.docs.map(function(x){var s=0,hit=0;qt.forEach(function(t){var f=x.tf[t];if(f){hit++;s+=M.idf(t)*(f*(k1+1))/(f+k1*(1-b+b*x.t.length/M.avg));}});
      if(x.ask&&x.where==='#faq')s*=1.3;return {x:x,s:s,cover:hit/Math.max(1,qt.length)};}).filter(function(r){return r.s>0;}).sort(function(a,z){return z.s-a.s;});}

  /* ---------- answering ---------- */
  var ctx={inst:null,id:null};
  var FACETS=[['rank',/\b(rank|ranking|rankings|ranked|qs|position)\b/],['web',/\b(website|site|link|url|homepage)\b/],['where',/\b(where|location|located|address|area|campus)\b/],['work',/\b(work|part[- ]?time|job)\b/]];
  function topicAnswer(t,lead){return {text:(lead?pick(LEAD):'')+pick(t.a),l:t.l,s:t.s,id:t.id};}
  function answer(raw){
    if(!M)M=buildIndex();
    var q=fold(raw).replace(/[?!.]+$/g,'').trim(),qt=toks(raw).map(fix);
    if(/^(hi|hello|hey|hii+|namaste|vanakkam|good (morning|afternoon|evening)|yo)\b[\s!.]*$/.test(q))return topicAnswer(T[0]);
    if(/^(thanks|thank you|thx|cheers|great|awesome|perfect|cool|ok|okay)\b/.test(q))return topicAnswer(T[1]);
    if(/^(bye|goodbye|see you|that'?s all)\b/.test(q))return {text:'Goodbye, and all the best with your plans! When you\'re ready, [reserve your free call](#enquire) or message us on '+WA+'.',id:'bye'};
    var facet=(FACETS.filter(function(f){return f[1].test(q);})[0]||[])[0]||null;
    /* institutions by name; two of them is a comparison */
    var hits=instFind(raw);
    if(hits.length>=2&&/\b(vs|versus|compare|comparison|or|better|difference|between)\b/.test(q)){ctx={inst:hits[1],id:'inst'};return {text:instCompare(hits[0],hits[1]),s:['Tell me about '+hits[0].short,'Tell me about '+hits[1].short],id:'inst'};}
    if(hits.length===1){ctx={inst:hits[0],id:'inst'};var u=hits[0];
      return {text:instAnswer(u,facet),s:[facet!=='rank'&&u.qs?'What is its ranking?':null,facet!=='where'?'Where is it?':null,facet!=='work'?'Can I work part-time there?':null,'Request a callback'].filter(Boolean).slice(0,3),id:'inst'};}
    if(hits.length>1)return {text:hits.map(function(u){return '- '+instLine(u);}).join('\n')+'\nAsk about any one of them for the details.',s:hits.slice(0,3).map(function(u){return 'Tell me about '+u.short;}),id:'inst'};
    /* a follow-up about the institution just discussed: "and its ranking?", "where is it?" */
    if(ctx.inst&&facet&&qt.length<=3&&(/\b(it|its|there|they|their|and|what about|how about)\b/.test(q)||qt.length<=1)){var c=ctx.inst;
      return {text:instAnswer(c,facet),s:['Tell me about '+c.short,'Request a callback'],id:'inst'};}
    /* whole phrases, where single words would mislead ("how does it work" is not about part-time work) */
    for(var i=0;i<PHR.length;i++)if(PHR[i][0].test(q)){
      if(PHR[i][1]==='self')return {text:'I\'m **Tutee AI**, built from this page and its list of 126 institutions. I can answer questions about universities, applications, the Student\'s Pass, costs, funding and life after graduation. Your questions stay in this browser. For advice on your own profile, say **request a callback** and I\'ll pass your details to an advisor.',s:['Request a callback','Tell me about NUS'],id:'self'};
      var pt=T.filter(function(t){return t.id===PHR[i][1];})[0];if(pt){ctx={inst:null,id:pt.id};return topicAnswer(pt,true);}}
    /* "which institutions teach nursing", "list the polytechnics", "colleges in the west" */
    var listy=/\b(which|what|list|name|show|any|best|good|top|where|recommend|suggest|offer|offers|teach|for|in)\b/.test(q);
    if(DB&&DB.length){
      var field=FIELDS.filter(function(f){return f[1].test(q);})[0],kind=KINDS.filter(function(k){return k[1].test(q);})[0],
        area=AREAS.filter(function(a){return new RegExp('\\b(in|around|near) (the )?'+a+'\\b').test(q);})[0];
      var asksInst=/\b(unis?|universit\w*|colleges?|institutions?|institutes?|schools?|polytechnics?|polys?|campus(es)?|where can i study|study)\b/.test(q);
      /* a kind on its own ("offshore campuses") is a list request, unless the question is about something else
         ("can I work at a polytechnic?") */
      if((kind&&(listy||!/\b(work|job|jobs|cost|fees?|visa|pass|apply|scholarships?|loans?|grant)\b/.test(q)))||(listy&&asksInst&&(field||area))){
        var list=instSort(DB.filter(function(u){return (!field||field[2].test(u.p||''))&&(!kind||u.t===kind[0])&&(!area||fold(u.reg||'').indexOf(area+' region')===0);}));
        var title=(kind?{'Autonomous University':'The autonomous universities','Polytechnic':'The polytechnics','Offshore Campus':'The offshore campuses','Higher Education':'Private institutions','Arts Institution':'The arts institutions','ITE':'The Institute of Technical Education'}[kind[0]]:'Institutions')+
          (field?' known for '+field[0]:'')+(area?' in the '+area+' region':'');
        var out=instList(list,title);ctx={inst:null,id:'list'};
        if(out)return {text:out+(field?'\nThe list goes by each institution\'s main subject areas; NUS, NTU, SMU and SUTD teach far more than theirs, so an advisor checks the exact course for you.':'')+
          (field&&/medicine|nursing|health/.test(field[0])?'\nEntry to medicine and nursing is very competitive; an advisor checks your eligibility first.':''),s:list.slice(0,2).map(function(u){return 'Tell me about '+u.short;}).concat(['Request a callback']),id:'list'};
        return {text:'I couldn\'t find '+title.toLowerCase().replace(/^the /,'')+' in this page\'s list of 126. An advisor can check other options for you, free: [reserve a call](#enquire).',s:['List the polytechnics','Which universities can I apply to?'],id:'list'};
      }
    }
    /* the written topics, by keyword */
    var qw=(fold(raw).match(/[a-z0-9']+/g)||[]).map(function(w){return w.replace(/'s$/,'');}).filter(function(w){return !STOP[w];}).map(function(w){return w.length>=5&&!T.some(function(t){return t.k.indexOf(w)>=0;})?fixTopic(w):w;});
    var best=null,bs=0;
    T.forEach(function(t){var s=0;qw.forEach(function(w){t.k.forEach(function(k){if(w===k)s+=k.length>4?2:1.5;else if(k.length>4&&w.length>4&&(w.indexOf(k)===0||k.indexOf(w)===0))s+=1;});});if(s>bs){bs=s;best=t;}});
    /* the page's passages, ranked: a strong passage beats a weak topic match */
    var scored=qt.length?search(qt):[],top=scored[0],unknown=qt.filter(function(t){return t.length>=4&&!M.df[t]&&!SYN[t];}).length;
    var passageOk=top&&top.s>1.6&&top.cover>=(unknown?.67:.5);
    /* a question mostly about something this page never mentions ("the capital of France") is not forced onto a topic */
    var offPage=qw.filter(function(w){return w.length>=4&&!T.some(function(t){return t.k.indexOf(w)>=0;})&&!M.df[(toks(w)[0]||w)]&&!SYN[w];}).length;
    if(qw.length>=2&&offPage*2>=qw.length)best=null;
    if(best&&bs>=1.5&&!(best.id==='hello'&&qw.length>3)&&!(passageOk&&top.s>4&&bs<2.5)){
      var r=topicAnswer(best,best.id!=='hello'&&best.id!=='thanks');
      if(ctx.id===best.id&&best.id!=='hello'&&best.id!=='thanks')r.text+=' '+pick(MORE);ctx={inst:null,id:best.id};return r;}
    if(passageOk){ctx={inst:null,id:null};
      var more=scored.slice(1).filter(function(s){return s.s>top.s*.5&&s.x.ask&&s.x.ask!==top.x.ask;}).slice(0,2).map(function(s){return s.x.ask;});
      return {text:(top.x.where==='#faq'||top.x.ask?'':pick(['Here\'s what the page says: ','From this page: ','This should help: ']))+top.x.answer,l:[top.x.where,top.x.lbl||'Show me on the page'],s:more.concat(['Reserve a free call']).slice(0,3),id:'page'};}
    ctx={inst:null,id:null};
    return {text:pick(['I don\'t have that on this page, but an advisor can answer it in your free call, or on '+WA+'.',
      'That one\'s best answered by an advisor. Say **request a callback** and I\'ll pass on your details, or message us on '+WA+'.',
      'I\'m not sure about that one. I can help with universities, applications, the Student\'s Pass, costs, funding and work. Or ask an advisor directly on '+WA+'.']),
      l:['#enquire','Reserve my free call'],s:['Request a callback','Which universities can I apply to?','Can I work while I study?'],id:'none'};
  }
  var TOPIC_WORDS=null;
  /* typo matching uses the subject words only: "meaning" must not become the greeting's "morning" */
  function fixTopic(w){if(!TOPIC_WORDS){TOPIC_WORDS=[];T.forEach(function(t){if(t.id!=='hello'&&t.id!=='thanks')t.k.forEach(function(k){if(k.length>=5)TOPIC_WORDS.push(k);});});}
    var max=w.length>=7?2:1,best=w,bd=max+1;TOPIC_WORDS.forEach(function(k){var d=lev(w,k,max);if(d<bd){bd=d;best=k;}});return best;}

  /* ---------- callback requests: the one thing the chat sends (to this site's /api/enquiry) ---------- */
  var LEAD_RE=/^(request a (call ?back|callback)|evaluate my profile|talk to a counsell?or|book a (free )?(consultation|call|counselling call)|call me( back)?|i want to (talk|speak) to (a|someone|someone from your team|a counsell?or|an advisor))\b|\b(talk|speak) to (a |an )?(human|person|counsell?or|advisor|adviser|someone|agent)\b|\bcall ?back\b|\bcall me( back)?\b|\b(someone|somebody|an? (advisor|adviser|counsell?or)) (to )?(call|contact|ring) me\b|\b(contact|ring) me\b/i;
  var EMAIL_RE=/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;
  var stage='idle',lead={name:'',phone:'',email:''};
  function submitLead(){
    var ctl=window.AbortController?new AbortController():null,t=setTimeout(function(){if(ctl)ctl.abort();},25000);
    return fetch('/api/enquiry',{method:'POST',signal:ctl?ctl.signal:undefined,headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({subject:'New Lead from Chatbot!',from_name:'Tutee AI Counsellor',name:lead.name,phone:lead.phone,email:lead.email,
        destination:'Chatbot General Inquiry',form_location:'Tutee AI chat',page:location.host+location.pathname})})
      .then(function(r){return r.json().catch(function(){return {success:false};});}).then(function(r){clearTimeout(t);return r;},function(e){clearTimeout(t);throw e;});
  }
  /* the reply (or a promise of it) while the details are being collected, otherwise null */
  function leadStep(q){
    if(stage!=='idle'&&/^(cancel|stop|no thanks|never ?mind|skip|quit)\b/i.test(q)){stage='idle';return {text:'No problem, I\'ve stopped. What else would you like to know?',s:['Which universities can I apply to?','What does it cost?']};}
    if(stage!=='idle'&&/\?$/.test(q))stage='idle';            /* a question mid-way: answer it instead */
    if(stage==='name'){
      if(q.replace(/[^A-Za-z\u00C0-\u024F]/g,'').length<2)return {text:'Could you type your **full name**? (Or type *cancel*.)'};
      lead.name=q.slice(0,120);stage='phone';
      return {text:'Thanks '+q.split(/\s+/)[0]+'! What\'s the best **phone number** to reach you on? Please include the country code, e.g. +91 98765 43210.'};}
    if(stage==='phone'){var d=q.replace(/\D/g,'');
      if(!/^\+?[\d\s()-]+$/.test(q)||d.length<7||d.length>15)return {text:'That doesn\'t look like a valid phone number. Please enter it with the country code, e.g. +91 98765 43210, or type *cancel*.'};
      if(/^(\+?91|0091)/.test(q.replace(/[\s()-]/g,''))&&!/^[6-9]\d{9}$/.test(d.replace(/^(0091|91)/,'')))return {text:'Indian mobile numbers have 10 digits after +91 and start with 6, 7, 8 or 9. Could you check it, or type *cancel*?'};
      lead.phone=q.slice(0,40);stage='email';return {text:'Got it. Lastly, what\'s your **email address**?'};}
    if(stage==='email'){
      if(!EMAIL_RE.test(q))return {text:'That doesn\'t look like a valid email address. Could you check it, or type *cancel*?'};
      lead.email=q.slice(0,200);stage='idle';
      return submitLead().then(function(res){return res&&res.success
        ?{text:'✅ **Done!** An advisor will contact you within one working day.\n\nAnything else I can help with in the meantime?',s:['What does it cost?','How does the Student\'s Pass work?']}
        :{text:'Sorry, that didn\'t go through. Please use the [consultation form](#enquire) or message us on '+WA+'.'};},
        function(){return {text:'Network error while sending. Please use the [consultation form](#enquire) or message us on '+WA+'.'};});}
    if(LEAD_RE.test(q.trim())){stage='name';lead={name:'',phone:'',email:''};
      return {text:'Happy to set that up. An advisor reviews your profile personally and replies within **one working day**.\n\nWhat\'s your **full name**? (Type *cancel* any time to stop.)'};}
    return null;
  }

  /* ---------- a small, safe markdown: **bold**, *italic*, [text](#id | page.html | https://), "- " lists ---------- */
  function md(text){
    var inline=function(s){return esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,!?]|$)/g,'$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((#[\w-]+|[\w-]+\.html(?:#[\w-]+)?|https:\/\/[^\s)]+)\)/g,function(m,t,h){return '<a href="'+h+'"'+(/^https:/.test(h)?' target="_blank" rel="noopener"':'')+'>'+t+'</a>';});};
    var out=[],ul=null;
    String(text).split('\n').forEach(function(line){var l=line.trim();
      if(/^[-•]\s+/.test(l)){(ul=ul||[]).push('<li>'+inline(l.replace(/^[-•]\s+/,''))+'</li>');return;}
      if(ul){out.push('<ul>'+ul.join('')+'</ul>');ul=null;}if(l)out.push('<p>'+inline(l)+'</p>');});
    if(ul)out.push('<ul>'+ul.join('')+'</ul>');
    return out.join('');
  }

  /* ---------- the button and the window ---------- */
  var btn,box,log,form,input,chips,built=false,open=false,busy=false,history=[];
  try{history=JSON.parse(sessionStorage.getItem(KEY)||'[]');if(!Array.isArray(history))history=[];}catch(e){history=[];}
  function persist(){try{sessionStorage.setItem(KEY,JSON.stringify(history.slice(-30)));}catch(e){}}
  function addButton(){
    btn=document.createElement('button');btn.type='button';btn.className='tai-btn';btn.setAttribute('aria-haspopup','dialog');btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-label','Ask Tutee AI');
    btn.innerHTML='<img src="'+esc(ICON)+'" srcset="'+ICONS+'" alt="" width="40" height="40"><span class="tai-btn-t">Ask Tutee AI</span>';
    btn.addEventListener('click',function(){open?close():show();});
    btn.addEventListener('pointerenter',ensureData,{once:true});
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
    box.innerHTML='<header class="tai-h"><img src="'+esc(ICON)+'" srcset="'+ICONS+'" alt="" width="36" height="36"><div><b>Tutee AI</b><small><i></i>Your Singapore study guide</small></div>'+
      '<button type="button" class="tai-x tai-new" aria-label="Start a new chat" title="New chat"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button>'+
      '<button type="button" class="tai-x tai-close" aria-label="Close chat"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>'+
      '<div class="tai-log" role="log" aria-live="polite"></div><div class="tai-chips" role="group" aria-label="Suggested questions"></div>'+
      '<form class="tai-f"><label class="sr-only" for="taiIn">Your question</label><input id="taiIn" autocomplete="off" maxlength="240" placeholder="Ask me anything..."><button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M2.5 19.5 21.5 12 2.5 4.5 2.5 10.3 15 12 2.5 13.7z"/></svg></button></form>'+
      '<p class="tai-note">Tutee AI can make mistakes; an advisor confirms the details. Questions stay in your browser; only callback details reach our team.</p>';
    document.body.appendChild(box);btn.setAttribute('aria-controls','taiBox');
    log=box.querySelector('.tai-log');form=box.querySelector('form');input=box.querySelector('input');chips=box.querySelector('.tai-chips');
    box.querySelector('.tai-close').addEventListener('click',close);
    box.querySelector('.tai-new').addEventListener('click',function(){history=[];stage='idle';ctx={inst:null,id:null};persist();paint();try{input.focus({preventScroll:true});}catch(e){}});
    box.addEventListener('keydown',function(e){if(e.key==='Escape'){e.stopPropagation();close();}});
    form.addEventListener('submit',function(e){e.preventDefault();ask(input.value);});
    chips.addEventListener('click',function(e){var b=e.target.closest('button');if(b)ask(b.textContent);});
    /* links in answers: in-page ones close the chat on phones so the section shows, then go there */
    log.addEventListener('click',function(e){var a=e.target.closest('a[href^="#"]');if(a&&window.matchMedia('(max-width: 640px)').matches)close();});
    paint();
  }
  function setChips(list){chips.innerHTML='';(list||[]).slice(0,4).forEach(function(t){var b=document.createElement('button');b.type='button';b.textContent=t;chips.appendChild(b);});}
  function add(cls,html){var m=document.createElement('div');m.className='tai-m '+cls;m.innerHTML=html;log.appendChild(m);log.scrollTop=log.scrollHeight;return m;}
  function botHtml(r){return md(r.text)+(r.l?'<a class="tai-go" href="'+esc(r.l[0])+'">'+esc(r.l[1])+' <span aria-hidden="true">→</span></a>':'');}
  function paint(){log.innerHTML='';
    var hello=T[0];add('bot',md(hello.a[0]));
    history.forEach(function(m){if(m.role==='user')add('me','<p>'+esc(m.text)+'</p>');else add('bot',botHtml(m));});
    var last=history[history.length-1];setChips(!history.length?CHIPS:last&&last.role==='bot'?last.s:[]);}
  function ask(q){
    q=String(q||'').trim();if(!q||busy)return;
    if(/^reserve (a|my) free call$/i.test(q)){add('me','<p>'+esc(q)+'</p>');close();var a=document.querySelector('a[href="#enquire"]');if(a)a.click();return;}
    busy=true;input.value='';add('me','<p>'+esc(q)+'</p>');setChips([]);
    history.push({role:'user',text:q});persist();
    var dots=add('bot typing','<span></span><span></span><span></span>'),t0=Date.now();
    /* institution questions need the list; it is usually loaded by now, and never waits more than a moment */
    var ready=DB?Promise.resolve():Promise.race([ensureData(),new Promise(function(r){setTimeout(r,1500);})]);
    ready.then(function(){var r=leadStep(q);if(r===null)r=answer(q);return r;}).then(null,function(){return {text:'Sorry, I tripped over that one. You can always message us on '+WA+'.'};})
      .then(function(r){setTimeout(function(){dots.remove();
        var msg={role:'bot',text:r.text,l:r.l||null,s:r.s||[]};history.push(msg);persist();add('bot',botHtml(msg));setChips(msg.s);busy=false;},
        Math.max(0,(reduce?60:420+Math.min(700,q.length*12))-(Date.now()-t0)));});
  }
  function show(){if(!built)build();ensureData();open=true;box.hidden=false;btn.setAttribute('aria-expanded','true');document.documentElement.classList.add('tai-open');
    requestAnimationFrame(function(){box.classList.add('on');log.scrollTop=log.scrollHeight;});setTimeout(function(){try{input.focus({preventScroll:true});}catch(e){}},reduce?0:220);}
  function close(){open=false;btn.setAttribute('aria-expanded','false');box.classList.remove('on');document.documentElement.classList.remove('tai-open');
    setTimeout(function(){if(!open)box.hidden=true;},reduce?0:260);try{btn.focus({preventScroll:true});}catch(e){}}

  /* for tests and other scripts on the page: ask a question without opening the window */
  window.TuteeAI={answer:function(q){return (DB?Promise.resolve():ensureData()).then(function(){var r=leadStep(q);return r===null?answer(q):r;});},ensureData:ensureData,open:function(){if(btn)show();}};

  function start(){var css=document.createElement('link');css.rel='stylesheet';css.href=new URL('../css/sg-tutee-ai.css?v=5',SRC).href;
    css.onload=addButton;document.head.appendChild(css);}
  var SRC=(document.currentScript&&document.currentScript.src)||location.href;
  if(document.readyState==='complete')setTimeout(start,300);else addEventListener('load',function(){setTimeout(start,300);});
})();
