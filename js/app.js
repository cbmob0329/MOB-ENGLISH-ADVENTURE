const STORAGE_KEY = "juniorEnglish1535_v10";
const LEGACY_KEYS = ["juniorEnglish1535_v9","juniorEnglish1535_v8","juniorEnglish1535_v7"];
const state = loadState();
let listLetter="ALL", listGrade=0, listMastery="all", quizGrade=0, quizMode="mix", quizGenre="all", dailyGenre="all", dailyMode="mix";
let quiz=null, reviewQuiz=null, dailyQuiz=null, boss=null;

function loadState(){
  const base={coins:0,streak:0,lastDailyDate:"",lastCompleteDate:"",daily:null,bossClears:0,bestBossScore:0,mastery:{}};
  try{
    let raw=localStorage.getItem(STORAGE_KEY);
    if(!raw){for(const key of LEGACY_KEYS){raw=localStorage.getItem(key);if(raw)break}}
    const merged=Object.assign(base,raw?JSON.parse(raw):{});
    if(!merged.mastery||typeof merged.mastery!=="object")merged.mastery={};
    return merged;
  }catch(e){return base}
}
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }catch(e){}
  updateHeader();
}
function localDateKey(){
  const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function updateHeader(){
  document.getElementById("coinCount").textContent=state.coins||0;
  document.getElementById("streakCount").textContent=state.streak||0;
  document.getElementById("totalWords").textContent=WORDS.length;
  refreshDailySummary();
  updateMasteryUI();
}
function goPage(name,focusSearch=false){
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  document.getElementById(name+"Page").classList.add("active");
  document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
  try{window.scrollTo(0,0)}catch(e){}
  if(name==="words"){renderWords(); if(focusSearch)setTimeout(()=>document.getElementById("searchInput").focus(),100)}
  if(name==="daily")refreshDailySummary();
  if(name==="review")renderReviewPage();
  if(name!=="boss")stopBossTimer();
}
function toast(msg){
  const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");
  clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove("show"),1800);
}
function shuffle(arr,rnd=Math.random){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function sample(arr,n,rnd=Math.random){return shuffle(arr,rnd).slice(0,Math.min(n,arr.length))}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function canSpeakEnglish(){return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window}
let englishVoice=null;
function chooseEnglishVoice(){
  if(!canSpeakEnglish())return null;
  const voices=window.speechSynthesis.getVoices()||[];
  englishVoice =
    voices.find(v=>/^en-US$/i.test(v.lang)&&/Samantha|Karen|Ava|Daniel|Alex|Google US English/i.test(v.name)) ||
    voices.find(v=>/^en-US$/i.test(v.lang)) ||
    voices.find(v=>/^en-GB$/i.test(v.lang)) ||
    voices.find(v=>/^en/i.test(v.lang)) || null;
  return englishVoice;
}
if(canSpeakEnglish()){
  chooseEnglishVoice();
  window.speechSynthesis.onvoiceschanged=chooseEnglishVoice;
}
function speakEnglish(text){
  if(!text)return;
  if(!canSpeakEnglish()){toast("このブラウザでは音声読み上げに対応していません");return}
  try{
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(String(text));
    u.lang="en-US";u.rate=.78;u.pitch=1;u.volume=1;
    const v=englishVoice||chooseEnglishVoice();if(v)u.voice=v;
    window.speechSynthesis.speak(u);
  }catch(e){toast("音声を再生できませんでした")}
}
function bindSpeakButtons(root=document){
  root.querySelectorAll("[data-speak]").forEach(btn=>{
    if(btn.dataset.speakBound==="1")return;
    btn.dataset.speakBound="1";
    btn.addEventListener("click",e=>{
      e.preventDefault();e.stopPropagation();
      speakEnglish(btn.dataset.speak||"");
    });
  });
}
function modeName(mode){
  return mode==="en2jp"?"英語 → 意味":
    mode==="jp2en"?"意味 → 英語":
    mode==="listen2jp"?"音声 → 意味":
    mode==="listen2en"?"音声 → 英単語":
    mode==="spell_jp2en"?"意味 → スペル":
    mode==="spell_listen2en"?"音声 → スペル":"ミックス";
}
function isSpellingType(type){return type==="spell_jp2en"||type==="spell_listen2en"}
function normalizeSpelling(value){
  return String(value??"")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g,"'")
    .replace(/\s+/g," ");
}

function getMastery(word){
  const m=state.mastery&&state.mastery[word];return m&&typeof m==="object"?m:null;
}
function masteryStatus(word){return getMastery(word)?.status||"neutral"}
function recordWordResult(w,correct,source="test"){
  if(!w||!w.word)return;const key=w.word;if(!state.mastery)state.mastery={};let m=state.mastery[key];
  if(!correct){if(!m)m={status:"weak",correctStreak:0,wrongCount:0,reviewCorrect:0,lastSource:"",lastAt:""};m.status="weak";m.correctStreak=0;m.wrongCount=(m.wrongCount||0)+1;m.lastSource=source;m.lastAt=new Date().toISOString();state.mastery[key]=m;return}
  if(!m)return;
  if(m.status==="weak"||m.status==="learning"){m.correctStreak=(m.correctStreak||0)+1;m.reviewCorrect=(m.reviewCorrect||0)+1;m.status=m.correctStreak>=3?"mastered":"learning"}else if(m.status==="mastered"){m.correctStreak=(m.correctStreak||3)+1}
  m.lastSource=source;m.lastAt=new Date().toISOString();state.mastery[key]=m;
}
function masteryCounts(){const c={weak:0,learning:0,mastered:0};Object.values(state.mastery||{}).forEach(m=>{if(m&&c[m.status]!==undefined)c[m.status]++});return c}
function masteryLabel(status){return status==="weak"?"苦手":status==="learning"?"復習中":status==="mastered"?"習得済み":""}
function masteryBadgeHTML(word){const status=masteryStatus(word);return status==="neutral"?"":`<span class="mastery-badge ${status}">${masteryLabel(status)}</span>`}
function updateMasteryUI(){const c=masteryCounts();const ids={homeWeakCount:c.weak,reviewWeakCount:c.weak,reviewLearningCount:c.learning,reviewMasteredCount:c.mastered};Object.entries(ids).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v})}
function buildMistake(q,chosen){return {word:q.w.word,kana:q.w.kana,meaning:q.w.meaning,reverse:!!q.reverse,chosen:chosen??"未回答",answer:q.answer}}
function renderMistakeResult(items=[],compact=false){
  if(!items.length)return compact?"":`<div class="all-correct-card">🎉 間違えた問題はありません！</div>`;
  const cards=items.map(m=>`<div class="mistake-card"><div><span class="mistake-word">${esc(m.word)}</span><span class="mistake-kana">${esc(m.kana||"")}</span></div><div class="mistake-meaning">${esc(m.meaning||"")}</div><div class="mistake-answer"><div class="mine">あなたの答え：<span class="spell-result-value">${esc(m.chosen||"未回答")}</span></div><div class="correct-answer">正解：${esc(m.answer||"")}</div></div><button class="result-speak" data-speak="${esc(m.word)}">🔊 発音</button></div>`).join("");
  if(compact)return `<div class="boss-result-mistakes"><div style="font-size:10px;font-weight:1000;margin-bottom:5px">間違えた問題 ${items.length}</div>${cards}</div>`;
  return `<div class="result-detail"><h4>間違えた問題 ${items.length}問</h4><div class="mistake-list">${cards}</div><div class="review-result-note">この単語は自動で「苦手単語」に登録されました。</div></div>`;
}

const GENRES=[
  {id:"all",icon:"🌈",name:"すべて"},
  {id:"daily",icon:"🏠",name:"日常編"},
  {id:"school",icon:"🏫",name:"学校・勉強編"},
  {id:"travel",icon:"✈️",name:"旅行・交通編"},
  {id:"food",icon:"🍴",name:"食べ物・料理編"},
  {id:"people",icon:"👨‍👩‍👧",name:"人・家族編"},
  {id:"hobby",icon:"⚽",name:"趣味・スポーツ編"},
  {id:"nature",icon:"🌿",name:"自然・生き物編"},
  {id:"health",icon:"🩺",name:"健康・からだ編"},
  {id:"home",icon:"🛋️",name:"家・持ち物編"},
  {id:"jobs",icon:"💼",name:"仕事・職業編"},
  {id:"society",icon:"🌏",name:"社会・文化編"},
  {id:"science",icon:"🔬",name:"科学・技術編"},
  {id:"time",icon:"🕒",name:"時間・行事編"},
  {id:"feelings",icon:"🙂",name:"感情・性格編"},
  {id:"general",icon:"🧠",name:"一般常識編"}
];
function genreName(id){return (GENRES.find(g=>g.id===id)||GENRES[0]).name}
function wordInGenre(w,id){return id==="all" || (w.tags||[]).includes(id)}
function getWordPool(grade=0,genre="all"){
  let pool=WORDS.filter(w=>(!grade||w.grade===grade)&&wordInGenre(w,genre));
  if(pool.length<10) pool=WORDS.filter(w=>!grade||w.grade===grade);
  return pool;
}
function renderGenreFilters(id,selected){
  const el=document.getElementById(id); if(!el)return;
  el.innerHTML=GENRES.map(g=>`<button class="genre-chip ${g.id===selected?"active":""}" data-genre="${g.id}"><span class="genre-icon">${g.icon}</span><span>${g.name}</span></button>`).join("");
}

const letters=["ALL",..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
document.getElementById("letters").innerHTML=letters.map(l=>`<button class="letter ${l==="ALL"?"active":""}" data-letter="${l}">${l==="ALL"?"ALL":l}</button>`).join("");
document.getElementById("letters").addEventListener("click",e=>{
  const b=e.target.closest(".letter");if(!b)return;
  listLetter=b.dataset.letter;
  document.querySelectorAll(".letter").forEach(x=>x.classList.toggle("active",x===b));renderWords();
});
document.getElementById("wordGradeFilters").addEventListener("click",e=>{
  const b=e.target.closest(".grade-chip");if(!b)return;
  listGrade=+b.dataset.grade;document.querySelectorAll("#wordGradeFilters .grade-chip").forEach(x=>x.classList.toggle("active",x===b));renderWords();
});
document.getElementById("wordMasteryFilters").addEventListener("click",e=>{
  const b=e.target.closest(".grade-chip");if(!b)return;listMastery=b.dataset.mastery;document.querySelectorAll("#wordMasteryFilters .grade-chip").forEach(x=>x.classList.toggle("active",x===b));renderWords();
});
document.getElementById("quizGradeFilters").addEventListener("click",e=>{
  const b=e.target.closest(".grade-chip");if(!b)return;
  quizGrade=+b.dataset.grade;document.querySelectorAll("#quizGradeFilters .grade-chip").forEach(x=>x.classList.toggle("active",x===b));
});
document.getElementById("quizModeFilters").addEventListener("click",e=>{
  const b=e.target.closest(".mode-chip");if(!b)return;
  quizMode=b.dataset.mode;
  document.querySelectorAll("#quizModeFilters .mode-chip").forEach(x=>x.classList.toggle("active",x===b));
});
document.getElementById("dailyModeFilters").addEventListener("click",e=>{
  const b=e.target.closest(".mode-chip");if(!b)return;
  const current=state.daily;
  if(current&&current.date===localDateKey()&&((current.pos||0)>0||current.completed)){
    dailyMode=current.mode||"mix";
    document.querySelectorAll("#dailyModeFilters .mode-chip").forEach(x=>x.classList.toggle("active",x.dataset.mode===dailyMode));
    toast(`今日の50問は「${modeName(dailyMode)}」で開始済みです`);return;
  }
  dailyMode=b.dataset.mode;
  state.daily=null;ensureDaily(dailyGenre,dailyMode);saveState();
  document.querySelectorAll("#dailyModeFilters .mode-chip").forEach(x=>x.classList.toggle("active",x===b));
  refreshDailySummary();
});

renderGenreFilters("quizGenreFilters",quizGenre);
renderGenreFilters("dailyGenreFilters",dailyGenre);
document.getElementById("quizGenreFilters").addEventListener("click",e=>{
  const b=e.target.closest(".genre-chip");if(!b)return;
  quizGenre=b.dataset.genre;renderGenreFilters("quizGenreFilters",quizGenre);
});
document.getElementById("dailyGenreFilters").addEventListener("click",e=>{
  const b=e.target.closest(".genre-chip");if(!b)return;
  const current=state.daily;
  if(current&&current.date===localDateKey()&&((current.pos||0)>0||current.completed)){
    dailyGenre=current.genre||"all";renderGenreFilters("dailyGenreFilters",dailyGenre);
    toast(`今日の50問は「${genreName(dailyGenre)}」で開始済みです`);return;
  }
  dailyGenre=b.dataset.genre;
  state.daily=null;ensureDaily(dailyGenre,dailyMode);saveState();
  renderGenreFilters("dailyGenreFilters",dailyGenre);refreshDailySummary();
});
document.getElementById("searchInput").addEventListener("input",()=>{listLetter="ALL";document.querySelectorAll(".letter").forEach(x=>x.classList.toggle("active",x.dataset.letter==="ALL"));renderWords()});

function renderWords(){
  const q=document.getElementById("searchInput").value.trim().toLowerCase();
  let arr=WORDS.filter(w=>{const letterOk=listLetter==="ALL"||w.word[0].toUpperCase()===listLetter;const gradeOk=!listGrade||w.grade===listGrade;const masteryOk=listMastery==="all"||masteryStatus(w.word)===listMastery;const hay=(w.word+" "+w.kana+" "+w.meaning).toLowerCase();return letterOk&&gradeOk&&masteryOk&&(!q||hay.includes(q))});
  document.getElementById("listSummary").textContent=listLetter==="ALL"?"A–Z":listLetter;document.getElementById("wordCount").textContent=`${arr.length}語を表示`;const el=document.getElementById("wordList");if(!arr.length){el.innerHTML=`<div class="empty">該当する単語がありません。</div>`;return}
  el.innerHTML=arr.map(w=>`<div class="word-card"><div class="word-main"><div class="word-en">${esc(w.word)}</div><div class="word-kana">${esc(w.kana)}</div><div class="word-jp">${esc(w.meaning)}</div></div><div class="word-side"><button class="word-speak" data-speak="${esc(w.word)}" aria-label="${esc(w.word)}の発音">🔊</button><div class="grade-tag">中${w.grade}目安</div>${masteryBadgeHTML(w.word)}</div></div>`).join("");
  bindSpeakButtons(el);
}
function createQuestionsFromWords(chosen,direction="mix",choiceCount=4,pool=WORDS,rng=Math.random){
  const selectTypes=["en2jp","jp2en","listen2jp","listen2en"];
  return chosen.map(w=>{
    const type=direction==="mix"?selectTypes[Math.floor(rng()*selectTypes.length)]:direction;
    const spelling=isSpellingType(type);
    const answerEnglish=type==="jp2en"||type==="listen2en"||spelling;
    const distractPool=pool.filter(x=>x.word!==w.word);
    let choices=[];
    if(!spelling){
      choices=answerEnglish?sample(distractPool,choiceCount-1,rng).map(x=>x.word):sample(distractPool,choiceCount-1,rng).map(x=>x.meaning);
      choices.push(answerEnglish?w.word:w.meaning);
      choices=shuffle(choices,rng);
    }
    return {
      w,type,
      reverse:type==="jp2en",
      listening:type==="listen2jp"||type==="listen2en"||type==="spell_listen2en",
      spelling,
      choices,
      answer:answerEnglish?w.word:w.meaning
    };
  });
}
function createQuestionPool(count,grade=0,rng=Math.random,direction="mix",choiceCount=4,genre="all"){
  const pool=getWordPool(grade,genre),chosen=sample(pool,count,rng);
  return createQuestionsFromWords(chosen,direction,choiceCount,pool,rng);
}
function renderQuestion(target,qobj,index,total,score,mode){
  const q=qobj[index];
  const type=q.type||(q.listening?(q.answer===q.w.word?"listen2en":"listen2jp"):(q.reverse?"jp2en":"en2jp"));
  const spelling=isSpellingType(type);
  const listening=type==="listen2jp"||type==="listen2en"||type==="spell_listen2en";
  const prompt=type==="jp2en"||type==="spell_jp2en"?q.w.meaning:q.w.word;
  const label=type==="jp2en"?"日本語に合う英単語を選ぼう":
    type==="listen2jp"?"音声を聞いて意味を選ぼう":
    type==="listen2en"?"音声を聞いて英単語を選ぼう":
    type==="spell_jp2en"?"日本語の意味を見て英単語を入力しよう":
    type==="spell_listen2en"?"音声を聞いて英単語を入力しよう":"英単語の意味を選ぼう";
  const title=mode==="daily"?"TODAY 50":mode==="review"?"WEAK WORD REVIEW":"10 WORD TEST";
  const genre=mode==="daily"?genreName(state.daily?.genre||dailyGenre):mode==="quiz"?genreName(quiz?.genre||quizGenre):"苦手復習";

  let promptHTML="";
  if(type==="spell_listen2en"){
    promptHTML=`<div class="spelling-audio-prompt"><div class="listen-icon">🎧</div><button class="speak-btn" data-speak="${esc(q.w.word)}">🔊 音声を聞く</button><div class="listen-copy">聞こえた単語を入力</div></div>`;
  }else if(listening){
    promptHTML=`<div class="listening-prompt"><div class="listen-icon">🎧</div><button class="speak-btn" data-speak="${esc(q.w.word)}">🔊 音声を聞く</button><div class="listen-copy">何度でも再生できます</div></div>`;
  }else{
    promptHTML=`<div class="prompt">${esc(prompt)}</div>${type==="en2jp"?`<div style="text-align:center"><button class="result-speak" data-speak="${esc(q.w.word)}">🔊 発音</button></div>`:""}`;
  }

  const answerHTML=spelling
    ? `<form class="spelling-wrap" id="spellingForm">
        <div class="spelling-box">
          <input id="spellingInput" class="spelling-input" type="text" inputmode="text"
            autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"
            enterkeyhint="done" placeholder="英単語を入力" aria-label="英単語を入力">
          <div class="spelling-actions">
            <button type="button" class="spell-hint-btn" id="spellHintBtn">💡 ヒント</button>
            <button type="submit" class="spell-submit-btn">決定</button>
          </div>
          <div class="spell-hint" id="spellHint"></div>
        </div>
      </form>`
    : `<div class="options">${q.choices.map(c=>`<button class="option" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</div>`;

  target.innerHTML=`<div class="quiz-shell">
    <div class="quiz-meta"><span>${title} · ${genre}</span><span>${index+1} / ${total}　正解 ${score}</span></div>
    <div class="quiz-progress"><i style="width:${(index/total)*100}%"></i></div>
    <div class="prompt-label">${label}</div>
    ${promptHTML}
    <div class="prompt-kana"></div>
    ${answerHTML}
    <div class="feedback"></div>
    <button class="nextbtn">次の問題へ</button>
  </div>`;

  if(spelling){
    const form=target.querySelector("#spellingForm");
    const input=target.querySelector("#spellingInput");
    const hintBtn=target.querySelector("#spellHintBtn");
    form.addEventListener("submit",e=>{
      e.preventDefault();
      submitSpelling(target,q,index,total,mode);
    });
    hintBtn.addEventListener("click",()=>{
      const hint=target.querySelector("#spellHint");
      hint.textContent=`最初の文字：${q.w.word.charAt(0).toUpperCase()}`;
      hintBtn.disabled=true;
      if(input)input.focus();
    });
  }else{
    target.querySelectorAll(".option").forEach(btn=>btn.addEventListener("click",()=>answerQuestion(target,q,index,total,mode,btn)));
  }
  bindSpeakButtons(target);
}

function registerQuestionResult(q,correct,chosen,mode){
  recordWordResult(q.w,correct,mode);
  if(mode==="quiz"){
    if(correct)quiz.score++;
    else quiz.mistakes.push(buildMistake(q,chosen));
  }else if(mode==="review"){
    if(correct)reviewQuiz.score++;
    else reviewQuiz.mistakes.push(buildMistake(q,chosen));
  }else{
    if(correct)dailyQuiz.score++;
    else dailyQuiz.mistakes.push(buildMistake(q,chosen));
  }
}

function setQuestionFeedback(target,q,correct){
  const fb=target.querySelector(".feedback");
  fb.className="feedback show "+(correct?"ok":"ng");
  fb.innerHTML=(correct?"✓ 正解！":"✕ 不正解")+`<br><div class="audio-answer-row"><span><span class="spell-result-value">${esc(q.w.word)}</span> <span style="color:#5277c7">${esc(q.w.kana)}</span> ＝ ${esc(q.w.meaning)}</span><button class="result-speak" data-speak="${esc(q.w.word)}">🔊</button></div>`;
  bindSpeakButtons(fb);
}

function showNextQuestionButton(target,index,total,mode){
  const next=target.querySelector(".nextbtn");
  next.classList.add("show");
  next.textContent=index===total-1?"結果を見る":"次の問題へ";
  next.onclick=()=>{
    target.dataset.answered="0";
    if(mode==="quiz"){
      quiz.pos++;
      quiz.pos>=total?finishQuiz():renderQuestion(target,quiz.questions,quiz.pos,total,quiz.score,"quiz");
    }else if(mode==="review"){
      reviewQuiz.pos++;
      reviewQuiz.pos>=total?finishReviewQuiz():renderQuestion(target,reviewQuiz.questions,reviewQuiz.pos,total,reviewQuiz.score,"review");
    }else{
      dailyQuiz.pos++;
      state.daily.pos=dailyQuiz.pos;
      state.daily.score=dailyQuiz.score;
      state.daily.mistakes=dailyQuiz.mistakes;
      saveState();
      dailyQuiz.pos>=total?finishDaily():renderQuestion(target,dailyQuiz.questions,dailyQuiz.pos,total,dailyQuiz.score,"daily");
    }
  };
}

function persistCurrentQuestionProgress(index,mode){
  if(mode==="daily"){
    state.daily.pos=index+1;
    state.daily.score=dailyQuiz.score;
    state.daily.mistakes=dailyQuiz.mistakes;
  }
  saveState();
}

function answerQuestion(target,q,index,total,mode,clicked){
  if(target.dataset.answered==="1")return;
  target.dataset.answered="1";
  const chosen=clicked.dataset.choice;
  const correct=chosen===q.answer;

  target.querySelectorAll(".option").forEach(b=>{
    b.disabled=true;
    if(b.dataset.choice===q.answer)b.classList.add("correct");
    else if(b===clicked)b.classList.add("wrong");
  });

  setQuestionFeedback(target,q,correct);
  registerQuestionResult(q,correct,chosen,mode);
  persistCurrentQuestionProgress(index,mode);
  showNextQuestionButton(target,index,total,mode);
}

function submitSpelling(target,q,index,total,mode){
  if(target.dataset.answered==="1")return;
  const input=target.querySelector("#spellingInput");
  if(!input)return;
  const chosen=input.value.trim();
  if(!chosen){
    input.focus();
    toast("英単語を入力してください");
    return;
  }

  target.dataset.answered="1";
  const correct=normalizeSpelling(chosen)===normalizeSpelling(q.answer);
  input.disabled=true;
  input.classList.add(correct?"correct":"wrong");
  const submit=target.querySelector(".spell-submit-btn");
  const hint=target.querySelector("#spellHintBtn");
  if(submit)submit.disabled=true;
  if(hint)hint.disabled=true;

  setQuestionFeedback(target,q,correct);
  registerQuestionResult(q,correct,chosen,mode);
  persistCurrentQuestionProgress(index,mode);
  showNextQuestionButton(target,index,total,mode);
}
function startQuiz(count){const questions=createQuestionPool(count,quizGrade,Math.random,quizMode,4,quizGenre);quiz={questions,pos:0,score:0,genre:quizGenre,mode:quizMode,mistakes:[]};document.getElementById("quizSetup").style.display="none";const area=document.getElementById("quizArea");area.style.display="block";area.dataset.answered="0";renderQuestion(area,questions,0,questions.length,0,"quiz")}
function finishQuiz(){const area=document.getElementById("quizArea"),total=quiz.questions.length,pct=Math.round(quiz.score/total*100);let msg=pct===100?"PERFECT！":pct>=80?"かなり覚えています！":pct>=60?"あと少し！":"間違えた単語をもう一度見てみよう。";area.innerHTML=`<div class="quiz-shell result"><div class="score-ring"><div><b>${quiz.score}/${total}</b><span>${pct}%</span></div></div><h3>${msg}</h3><p>${genreName(quiz.genre||"all")}・${modeName(quiz.mode||"mix")}のテスト結果です。</p>${renderMistakeResult(quiz.mistakes)}<button class="startbtn" onclick="resetQuiz()">もう一度挑戦</button>${quiz.mistakes.length?`<button class="review-secondary" onclick="goPage('review')">苦手単語を復習する</button>`:""}</div>`;bindSpeakButtons(area);renderWords();updateMasteryUI()}
function resetQuiz(){document.getElementById("quizArea").style.display="none";document.getElementById("quizSetup").style.display="block";quiz=null}
function renderReviewPage(){
  const c=masteryCounts();updateMasteryUI();const weak=WORDS.filter(w=>masteryStatus(w.word)==="weak");const list=document.getElementById("reviewWordList"),count=document.getElementById("reviewListCount");if(count)count.textContent=`${weak.length}語`;if(list)list.innerHTML=weak.length?weak.slice(0,100).map(w=>`<div class="review-item"><div><div class="en">${esc(w.word)}</div><div class="kana">${esc(w.kana)}</div><div class="jp">${esc(w.meaning)}</div></div><div class="word-side"><button class="word-speak" data-speak="${esc(w.word)}">🔊</button>${masteryBadgeHTML(w.word)}</div></div>`).join(""):`<div class="empty">現在「苦手」の単語はありません。テストで間違えると自動でここに追加されます。</div>`;const weakBtn=document.getElementById("weakQuizBtn"),learningBtn=document.getElementById("learningQuizBtn");if(weakBtn){weakBtn.disabled=c.weak===0;weakBtn.textContent=c.weak?`苦手単語だけ復習（${Math.min(10,c.weak)}問）`:"苦手単語はありません"}if(learningBtn){learningBtn.disabled=(c.weak+c.learning)===0;learningBtn.textContent=(c.weak+c.learning)?`苦手＋復習中をまとめて復習（最大10問）`:"復習対象の単語はありません"}bindSpeakButtons(document.getElementById("reviewWordList"));
}
function startReviewQuiz(includeLearning=false){let pool=WORDS.filter(w=>{const st=masteryStatus(w.word);return st==="weak"||(includeLearning&&st==="learning")});if(!pool.length){toast("復習対象の単語がありません");return}pool.sort((a,b)=>(masteryStatus(a.word)==="weak"?0:1)-(masteryStatus(b.word)==="weak"?0:1));const chosen=sample(pool,Math.min(10,pool.length));const questions=createQuestionsFromWords(chosen,"mix",4,WORDS,Math.random);reviewQuiz={questions,pos:0,score:0,mistakes:[],includeLearning};document.getElementById("reviewSetup").style.display="none";document.querySelector("#reviewPage .section-title").style.display="none";document.getElementById("reviewWordList").style.display="none";const area=document.getElementById("reviewQuizArea");area.style.display="block";area.dataset.answered="0";renderQuestion(area,questions,0,questions.length,0,"review")}
function finishReviewQuiz(){const area=document.getElementById("reviewQuizArea"),total=reviewQuiz.questions.length,pct=Math.round(reviewQuiz.score/total*100);area.innerHTML=`<div class="quiz-shell result"><div class="score-ring"><div><b>${reviewQuiz.score}/${total}</b><span>${pct}%</span></div></div><h3>${pct===100?"復習完了！":"復習結果"}</h3><p>正解した苦手単語は「復習中」へ進みます。3回連続正解で「習得済み」です。</p>${renderMistakeResult(reviewQuiz.mistakes)}<button class="startbtn" onclick="resetReviewQuiz()">苦手単語画面へ戻る</button></div>`;bindSpeakButtons(area);renderWords();updateMasteryUI()}
function resetReviewQuiz(){reviewQuiz=null;document.getElementById("reviewQuizArea").style.display="none";document.getElementById("reviewQuizArea").innerHTML="";document.getElementById("reviewSetup").style.display="block";document.querySelector("#reviewPage .section-title").style.display="flex";document.getElementById("reviewWordList").style.display="grid";renderReviewPage()}

function hashSeed(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function ensureDaily(requestedGenre=null,requestedMode=null){
  const key=localDateKey();
  const chosen=requestedGenre||dailyGenre||"all";
  const chosenMode=requestedMode||dailyMode||"mix";
  if(!state.daily||state.daily.date!==key){
    const rng=mulberry32(hashSeed("JUNIOR-ENGLISH-"+key+"-"+chosen+"-"+chosenMode));
    const qs=createQuestionPool(50,0,rng,chosenMode,4,chosen);
    state.daily={date:key,genre:chosen,mode:chosenMode,pos:0,score:0,completed:false,reward:0,mistakes:[],questions:qs.map(q=>({word:q.w.word,type:q.type,reverse:q.reverse,listening:q.listening,spelling:q.spelling,choices:q.choices,answer:q.answer}))};
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(e){}
  }
  if(!Array.isArray(state.daily.mistakes))state.daily.mistakes=[];
  dailyGenre=state.daily.genre||"all";dailyMode=state.daily.mode||"mix";
  return state.daily;
}
function hydrateDailyQuestions(saved){
  return saved.questions.map(x=>{
    const w=WORDS.find(z=>z.word===x.word);
    const type=x.type||(x.reverse?"jp2en":"en2jp");return {w,type,reverse:!!x.reverse,listening:!!x.listening||type==="spell_listen2en",spelling:!!x.spelling||isSpellingType(type),choices:Array.isArray(x.choices)?x.choices:[],answer:x.answer};
  });
}
function startDaily(){
  const d=ensureDaily(dailyGenre,dailyMode);
  if(d.completed){showDailyResult();return}
  dailyQuiz={questions:hydrateDailyQuestions(d),pos:d.pos||0,score:d.score||0,mistakes:[...(d.mistakes||[])]};
  document.getElementById("dailySetup").style.display="none";
  const area=document.getElementById("dailyArea");area.style.display="block";area.dataset.answered="0";
  renderQuestion(area,dailyQuiz.questions,dailyQuiz.pos,50,dailyQuiz.score,"daily");
}
function calcReward(score){return score===50?150:score>=45?100:score>=40?50:0}
function dayDiff(a,b){
  if(!a||!b)return 999;
  const A=new Date(a+"T00:00:00"),B=new Date(b+"T00:00:00");return Math.round((B-A)/86400000)
}
function finishDaily(){
  const d=ensureDaily(); if(d.completed){showDailyResult();return}
  d.completed=true;d.pos=50;d.score=dailyQuiz.score;d.reward=calcReward(d.score);
  state.coins=(state.coins||0)+d.reward;
  const today=localDateKey(), diff=dayDiff(state.lastCompleteDate,today);
  state.streak=diff===1?(state.streak||0)+1:(state.lastCompleteDate===today?state.streak:1);
  state.lastCompleteDate=today;state.lastDailyDate=today;
  saveState();showDailyResult();if(d.reward)toast(`🪙 +${d.reward} COIN GET!`);
}
function showDailyResult(){
  const d=ensureDaily(),area=document.getElementById("dailyArea");
  document.getElementById("dailySetup").style.display="none";area.style.display="block";
  const pct=Math.round((d.score||0)/50*100);
  let title=d.score===50?"PERFECT DAY！":d.score>=45?"GREAT！":d.score>=40?"CLEAR！":"FINISH！";
  area.innerHTML=`<div class="quiz-shell result">
    <div class="score-ring"><div><b>${d.score}/50</b><span>${pct}%</span></div></div>
    <h3>${title}</h3><p>${genreName(d.genre||"all")}・${modeName(d.mode||"mix")}の50問を完了しました。<br>明日は別ジャンルや問題タイプも選べます。</p>
    <div class="reward-card">🎁 本日の報酬：+${d.reward||0} COIN</div>
    ${renderMistakeResult(d.mistakes||[])}
    <button class="startbtn" onclick="goPage('review')">苦手単語を復習する</button>
    <button class="review-secondary" onclick="goPage('words')">単語一覧を見る</button>
  </div>`;
  bindSpeakButtons(area);
}
function refreshDailySummary(){
  const d=ensureDaily();
  const pos=Math.min(d.pos||0,50),score=d.score||0;
  document.getElementById("dailyDone").textContent=`${pos}/50`;
  document.getElementById("dailyScoreMini").textContent=score;
  document.getElementById("dailyRewardMini").textContent=d.completed?`+${d.reward}`:"MAX 150";
  document.getElementById("dailyDate").textContent=d.date.replaceAll("-"," / ");
  document.getElementById("homeDailyBar").style.width=(pos/50*100)+"%";
  document.getElementById("learnedToday").textContent=pos;
  document.getElementById("homeAccuracy").textContent=pos?Math.round(score/pos*100)+"%":"--";
  dailyGenre=d.genre||"all";dailyMode=d.mode||"mix";
  renderGenreFilters("dailyGenreFilters",dailyGenre);
  document.querySelectorAll("#dailyModeFilters .mode-chip").forEach(x=>x.classList.toggle("active",x.dataset.mode===dailyMode));
  const start=document.getElementById("dailyStartBtn");
  if(start)start.textContent=d.completed?`今日の結果を見る（${genreName(dailyGenre)}）`:pos>0?`続きから再開（${pos}/50・${genreName(dailyGenre)}）`:`${genreName(dailyGenre)}で50問を始める`;
  document.getElementById("homeRewardText").textContent=d.completed?`本日 +${d.reward} COIN 獲得済み`:"最大 +150 COIN";
}

let bossTimer=null;

function stopBossTimer(){
  if(bossTimer){clearInterval(bossTimer);bossTimer=null}
}

function resetBossView(){
  stopBossTimer();
  boss=null;
  const setup=document.getElementById("bossSetup"),battle=document.getElementById("bossBattle");
  if(setup)setup.style.display="block";
  if(battle){battle.style.display="none";battle.innerHTML=""}
}

function startBossBattle(){
  stopBossTimer();
  boss={
    playerHP:10,bossHP:20,maxPlayerHP:10,maxBossHP:20,
    correct:0,miss:0,specialCorrect:0,questions:0,
    startedAt:Date.now(),used:new Set(),locked:false,specialUsed:false,fastCorrect:0,questionStartedAt:0,mistakes:[]
  };
  document.getElementById("bossSetup").style.display="none";
  const battle=document.getElementById("bossBattle");
  battle.style.display="block";
  battle.innerHTML=`<div class="boss-arena" id="bossArena">
    <div class="battle-message" id="battleMsg"></div>
    <div class="battle-top">
      <div style="min-width:54px"><div class="fighter-label">YOU</div><div class="hp-text" id="playerHPText">HP 10 / 10</div></div>
      <div class="hp-wrap"><div class="hp-track"><div class="hp-fill" id="playerHPBar" style="width:100%"></div></div></div>
    </div>
    <div class="battle-top" style="margin-top:8px">
      <div style="min-width:54px"><div class="fighter-label">SLIME</div><div class="hp-text" id="bossHPText">HP 20 / 20</div></div>
      <div class="hp-wrap"><div class="hp-track"><div class="hp-fill enemy" id="bossHPBar" style="width:100%"></div></div></div>
    </div>
    <div class="battle-stage" id="battleStage">
      <div class="player-unit" id="playerUnit">
        <div class="player-avatar"><div class="player-sword"></div></div><div class="battle-shadow"></div>
      </div>
      <div class="slash" id="slashFx"></div>
      <div class="enemy-unit" id="enemyUnit">
        <div class="slime"><div class="slime-mouth"></div></div><div class="battle-shadow"></div>
      </div>
    </div>
    <div class="boss-question" id="bossQuestion"></div>
    <div class="battle-overlay" id="battleOverlay"></div>
  </div>`;
  updateBossHP();
  renderBossTurnChoice();
}

function updateBossHP(){
  const p=Math.max(0,boss.playerHP),e=Math.max(0,boss.bossHP);
  const pbar=document.getElementById("playerHPBar"),ebar=document.getElementById("bossHPBar");
  if(pbar)pbar.style.width=(p/boss.maxPlayerHP*100)+"%";
  if(ebar)ebar.style.width=(e/boss.maxBossHP*100)+"%";
  const pt=document.getElementById("playerHPText"),et=document.getElementById("bossHPText");
  if(pt)pt.textContent=`HP ${p} / ${boss.maxPlayerHP}`;
  if(et)et.textContent=`HP ${e} / ${boss.maxBossHP}`;
}

function renderBossTurnChoice(){
  stopBossTimer();
  if(!boss||boss.playerHP<=0||boss.bossHP<=0)return;
  boss.locked=false;
  const q=document.getElementById("bossQuestion");
  q.className="boss-question";
  q.innerHTML=`<div class="boss-q-head"><span>CHOOSE ATTACK</span><span>敵HP ${boss.bossHP}</span></div>
    <div class="boss-q-title" style="font-size:19px;margin-top:18px">攻撃方法を選ぼう</div>
    <div class="boss-actions">
      <button class="attack-btn" onclick="startBossQuestion(false)">⚔️ 通常攻撃<small>1.5秒以内 +2 / それ以降 +1</small></button>
      <button class="special-btn" onclick="startBossQuestion(true)" ${boss.specialUsed?"disabled":""}>${boss.specialUsed?"✓ 必殺 使用済み":"💥 必殺"}<small>${boss.specialUsed?"このバトルでは使用不可":"1回限定 / 難問6択 / +4 DAMAGE"}</small></button>
    </div>
    <div class="boss-rule">1問3秒。必殺は1バトルにつき1回だけ使用できます。</div>`;
}

function pickBossWord(special){
  let pool;
  if(special){
    pool=WORDS.filter(w=>w.grade>=2);
  }else{
    const grade=Math.random()<0.85?1:2;
    pool=WORDS.filter(w=>w.grade===grade);
  }
  let available=pool.filter(w=>!boss.used.has(w.word));
  if(available.length<10){boss.used.clear();available=pool}
  const w=available[Math.floor(Math.random()*available.length)];
  boss.used.add(w.word);
  return w;
}

function createBossQuestion(special){
  const w=pickBossWord(special);
  const direction=special?(Math.random()<.5?"en2jp":"jp2en"):"en2jp";
  const reverse=direction==="jp2en";
  const pool=special?WORDS.filter(x=>x.grade>=2):WORDS.filter(x=>x.grade===w.grade);
  const distract=pool.filter(x=>x.word!==w.word);
  const count=special?6:4;
  let choices=reverse?sample(distract,count-1).map(x=>x.word):sample(distract,count-1).map(x=>x.meaning);
  choices.push(reverse?w.word:w.meaning);
  choices=shuffle(choices);
  return {w,reverse,choices,answer:reverse?w.word:w.meaning,special};
}

function startBossQuestion(special){
  if(!boss||boss.locked)return;
  if(special&&boss.specialUsed)return;
  if(special)boss.specialUsed=true;
  boss.locked=true;
  const data=createBossQuestion(special);
  boss.current=data;boss.questions++;boss.questionStartedAt=performance.now();
  const q=document.getElementById("bossQuestion");
  q.className="boss-question"+(special?" special-q":"");
  q.innerHTML=`<div class="boss-q-head"><span>${special?"💥 SPECIAL / 6 CHOICES":"⚔️ NORMAL / 1.5s FAST HIT"}</span><span>3.0 sec</span></div>
    <div class="timer-track"><div class="timer-fill" id="bossTimerFill"></div></div>
    <div class="prompt-label">${data.reverse?"日本語に合う英単語":"英単語の意味"}</div>
    <div class="boss-q-title">${esc(data.reverse?data.w.meaning:data.w.word)}${!data.reverse?`<button class="boss-audio-btn" data-speak="${esc(data.w.word)}" aria-label="発音">🔊</button>`:""}</div>
    <div class="boss-q-kana"></div>
    <div class="boss-options">${data.choices.map(c=>`<button class="boss-option" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</div>`;
  q.querySelectorAll(".boss-option").forEach(btn=>btn.addEventListener("click",()=>resolveBossAnswer(btn.dataset.choice,btn)));
  bindSpeakButtons(q);
  runBossTimer();
}

function runBossTimer(){
  stopBossTimer();
  const start=performance.now(),duration=3000;
  bossTimer=setInterval(()=>{
    if(!boss||!boss.locked){stopBossTimer();return}
    const elapsed=performance.now()-start;
    const remain=Math.max(0,1-elapsed/duration);
    const fill=document.getElementById("bossTimerFill");
    if(fill){
      fill.style.width=(remain*100)+"%";
      if(!boss.current.special)fill.classList.toggle("slow",elapsed>1500);
    }
    const label=document.querySelector("#bossQuestion .boss-q-head span:last-child");
    if(label)label.textContent=(Math.max(0,(duration-elapsed)/1000)).toFixed(1)+" sec";
    if(elapsed>=duration){
      stopBossTimer();
      resolveBossAnswer(null,null,true);
    }
  },50);
}

function resolveBossAnswer(choice,clicked,timedOut=false){
  if(!boss||!boss.locked)return;
  stopBossTimer();
  boss.locked=false;
  const data=boss.current;
  const correct=!timedOut&&choice===data.answer;
  document.querySelectorAll("#bossQuestion .boss-option").forEach(b=>{
    b.disabled=true;
    if(b.dataset.choice===data.answer)b.classList.add("correct");
    else if(b===clicked)b.classList.add("wrong");
  });
  const kana=document.querySelector("#bossQuestion .boss-q-kana");
  if(kana){kana.innerHTML=`${esc(data.w.word)}　${esc(data.w.kana)}　＝ ${esc(data.w.meaning)} <button class="result-speak" data-speak="${esc(data.w.word)}">🔊</button>`;bindSpeakButtons(kana)}
  recordWordResult(data.w,correct,"boss");
  if(!correct)boss.mistakes.push(buildMistake(data,timedOut?"TIME UP":choice||"未回答"));
  saveState();
  if(correct){
    boss.correct++;
    const answerMs=Math.max(0,performance.now()-(boss.questionStartedAt||performance.now()));
    let damage=1;
    if(data.special){
      damage=4;
      boss.specialCorrect++;
    }else if(answerMs<=1500){
      damage=2;
      boss.fastCorrect++;
    }
    boss.bossHP=Math.max(0,boss.bossHP-damage);
    playerAttackAnimation(damage,data.special);
    showBattleMessage(data.special?"SPECIAL HIT!":damage===2?"FAST HIT! 2 DAMAGE":"HIT! 1 DAMAGE");
  }else{
    boss.miss++;
    boss.playerHP=Math.max(0,boss.playerHP-1);
    enemyAttackAnimation();
    showBattleMessage(timedOut?"TIME UP!":"MISS!");
  }
  updateBossHP();
  setTimeout(()=>{
    if(!boss)return;
    if(boss.bossHP<=0){finishBossVictory()}
    else if(boss.playerHP<=0){finishBossDefeat()}
    else{renderBossTurnChoice()}
  },780);
}

function showBattleMessage(msg){
  const el=document.getElementById("battleMsg");if(!el)return;
  el.textContent=msg;el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),650);
}

function spawnDamage(targetId,text,special=false){
  const target=document.getElementById(targetId),stage=document.getElementById("battleStage");
  if(!target||!stage)return;
  const d=document.createElement("div");d.className="damage-pop"+(special?" special":"");d.textContent=text;
  const tr=target.getBoundingClientRect(),sr=stage.getBoundingClientRect();
  d.style.left=(tr.left-sr.left+tr.width/2-18)+"px";d.style.top=(tr.top-sr.top+15)+"px";
  stage.appendChild(d);setTimeout(()=>d.remove(),800);
}

function playerAttackAnimation(damage,special){
  const p=document.getElementById("playerUnit"),e=document.getElementById("enemyUnit"),slash=document.getElementById("slashFx"),arena=document.getElementById("bossArena");
  if(p){p.classList.remove("attack");void p.offsetWidth;p.classList.add("attack");setTimeout(()=>p.classList.remove("attack"),430)}
  if(slash){slash.classList.remove("fly");void slash.offsetWidth;slash.classList.add("fly");setTimeout(()=>slash.classList.remove("fly"),430)}
  setTimeout(()=>{
    if(e){e.classList.remove("hit");void e.offsetWidth;e.classList.add("hit");setTimeout(()=>e.classList.remove("hit"),430)}
    if(arena){arena.classList.remove("screen-shake");void arena.offsetWidth;arena.classList.add("screen-shake");setTimeout(()=>arena.classList.remove("screen-shake"),380)}
    spawnDamage("enemyUnit","-"+damage,special);
  },220);
}

function enemyAttackAnimation(){
  const e=document.getElementById("enemyUnit"),p=document.getElementById("playerUnit"),arena=document.getElementById("bossArena");
  if(e){e.classList.remove("attack");void e.offsetWidth;e.classList.add("attack");setTimeout(()=>e.classList.remove("attack"),460)}
  setTimeout(()=>{
    if(p){p.classList.remove("hit");void p.offsetWidth;p.classList.add("hit");setTimeout(()=>p.classList.remove("hit"),430)}
    if(arena){arena.classList.remove("screen-shake");void arena.offsetWidth;arena.classList.add("screen-shake");setTimeout(()=>arena.classList.remove("screen-shake"),380)}
    spawnDamage("playerUnit","-1",false);
  },220);
}

function bossScore(){
  if(!boss)return 0;
  const elapsed=Math.max(1,Math.round((Date.now()-boss.startedAt)/1000));
  return Math.max(0,1000 + boss.playerHP*200 + boss.correct*90 + boss.fastCorrect*100 + boss.specialCorrect*220 - boss.miss*60 - elapsed*4);
}

function animateScore(el,finalScore){
  const start=performance.now(),duration=950;
  function tick(now){
    const t=Math.min(1,(now-start)/duration),v=Math.floor(finalScore*(1-Math.pow(1-t,3)));
    el.textContent=v.toLocaleString();
    if(t<1)requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function finishBossVictory(){
  stopBossTimer();
  const enemy=document.getElementById("enemyUnit");
  if(enemy)enemy.classList.add("defeated");
  const finalScore=bossScore();
  state.bossClears=(state.bossClears||0)+1;
  state.bestBossScore=Math.max(state.bestBossScore||0,finalScore);
  saveState();
  setTimeout(()=>{
    const over=document.getElementById("battleOverlay");if(!over)return;
    over.innerHTML=`<div class="victory-box">
      <div style="font-size:38px">🏆</div>
      <div class="victory-title">SLIME CLEAR!</div>
      <div class="score-label">BATTLE SCORE</div>
      <div class="score-big" id="bossScoreValue">0</div>
      <div class="score-breakdown">
        <div><b>${boss.playerHP}</b><span>HP LEFT</span></div>
        <div><b>${boss.fastCorrect}</b><span>FAST HIT</span></div>
        <div><b>${boss.specialCorrect}</b><span>SPECIAL HIT</span></div>
      </div>
      <div style="font-size:11px;color:#747b88;font-weight:850">正解 ${boss.correct}問 ／ BEST SCORE：${Math.max(state.bestBossScore||0,finalScore).toLocaleString()}</div>
      ${renderMistakeResult(boss.mistakes,true)}
      <button class="startbtn" onclick="startBossBattle()">もう一度戦う</button>
      <button class="backbtn" style="margin-top:8px;width:100%" onclick="resetBossView()">ボス一覧へ</button>
    </div>`;
    over.classList.add("show");bindSpeakButtons(over);
    animateScore(document.getElementById("bossScoreValue"),finalScore);
  },900);
}

function finishBossDefeat(){
  stopBossTimer();
  const over=document.getElementById("battleOverlay");if(!over)return;
  over.innerHTML=`<div class="victory-box">
    <div style="font-size:35px">💫</div>
    <div class="defeat-title">BATTLE FAILED</div>
    <p style="font-size:12px;color:#747b88;line-height:1.6">HPが0になりました。<br>中1単語を復習して再挑戦しよう。</p>
    <div class="score-breakdown">
      <div><b>${boss.correct}</b><span>CORRECT</span></div>
      <div><b>${boss.miss}</b><span>MISS / TIME</span></div>
      <div><b>${20-boss.bossHP}</b><span>DAMAGE</span></div>
    </div>
    ${renderMistakeResult(boss.mistakes,true)}
    <button class="startbtn" onclick="startBossBattle()">リトライ</button>
    <button class="backbtn" style="margin-top:8px;width:100%" onclick="goPage('review')">苦手単語を復習する</button>
  </div>`;
  over.classList.add("show");bindSpeakButtons(over);
}


renderWords();
updateHeader();
