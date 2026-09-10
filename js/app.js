const STORAGE_KEY = "juniorEnglish685_v1";
const state = loadState();
let listLetter="ALL", listGrade=0, quizGrade=0, quizMode="mix";
let quiz=null, dailyQuiz=null, boss=null;

function loadState(){
  const base={coins:0,streak:0,lastDailyDate:"",lastCompleteDate:"",daily:null,bossClears:0,bestBossScore:0};
  try{return Object.assign(base,JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"))}catch(e){return base}
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
}
function goPage(name,focusSearch=false){
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  document.getElementById(name+"Page").classList.add("active");
  document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
  try{window.scrollTo(0,0)}catch(e){}
  if(name==="words"){renderWords(); if(focusSearch)setTimeout(()=>document.getElementById("searchInput").focus(),100)}
  if(name==="daily")refreshDailySummary();
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
document.getElementById("quizGradeFilters").addEventListener("click",e=>{
  const b=e.target.closest(".grade-chip");if(!b)return;
  quizGrade=+b.dataset.grade;document.querySelectorAll("#quizGradeFilters .grade-chip").forEach(x=>x.classList.toggle("active",x===b));
});
document.getElementById("quizModeFilters").addEventListener("click",e=>{
  const b=e.target.closest(".mode-chip");if(!b)return;
  quizMode=b.dataset.mode;
  document.querySelectorAll("#quizModeFilters .mode-chip").forEach(x=>x.classList.toggle("active",x===b));
});
document.getElementById("searchInput").addEventListener("input",()=>{listLetter="ALL";document.querySelectorAll(".letter").forEach(x=>x.classList.toggle("active",x.dataset.letter==="ALL"));renderWords()});

function renderWords(){
  const q=document.getElementById("searchInput").value.trim().toLowerCase();
  let arr=WORDS.filter(w=>{
    const letterOk=listLetter==="ALL"||w.word[0].toUpperCase()===listLetter;
    const gradeOk=!listGrade||w.grade===listGrade;
    const hay=(w.word+" "+w.kana+" "+w.meaning).toLowerCase();
    return letterOk&&gradeOk&&(!q||hay.includes(q));
  });
  document.getElementById("listSummary").textContent=listLetter==="ALL"?"A–Z":listLetter;
  document.getElementById("wordCount").textContent=`${arr.length}語を表示`;
  const el=document.getElementById("wordList");
  if(!arr.length){el.innerHTML=`<div class="empty">該当する単語がありません。</div>`;return}
  el.innerHTML=arr.map(w=>`<div class="word-card">
    <div class="word-main"><div class="word-en">${esc(w.word)}</div><div class="word-kana">${esc(w.kana)}</div><div class="word-jp">${esc(w.meaning)}</div></div>
    <div class="grade-tag">中${w.grade}目安</div>
  </div>`).join("");
}

function createQuestionPool(count,grade=0,rng=Math.random,direction="mix",choiceCount=4){
  const pool=grade?WORDS.filter(w=>w.grade===grade):WORDS;
  const chosen=sample(pool,count,rng);
  return chosen.map((w,i)=>{
    const reverse=direction==="jp2en"?true:direction==="en2jp"?false:rng()<.5;
    const distractPool=pool.filter(x=>x.word!==w.word);
    let choices;
    if(!reverse){
      choices=sample(distractPool,choiceCount-1,rng).map(x=>x.meaning);
      choices.push(w.meaning);
    }else{
      choices=sample(distractPool,choiceCount-1,rng).map(x=>x.word);
      choices.push(w.word);
    }
    choices=shuffle(choices,rng);
    return {w,reverse,choices,answer:reverse?w.word:w.meaning};
  });
}
function renderQuestion(target,qobj,index,total,score,mode){
  const q=qobj[index];
  const prompt=q.reverse?q.w.meaning:q.w.word;
  const label=q.reverse?"日本語に合う英単語を選ぼう":"英単語の意味を選ぼう";
  target.innerHTML=`<div class="quiz-shell">
    <div class="quiz-meta"><span>${mode==="daily"?"TODAY 50":"10 WORD TEST"}</span><span>${index+1} / ${total}　正解 ${score}</span></div>
    <div class="quiz-progress"><i style="width:${(index/total)*100}%"></i></div>
    <div class="prompt-label">${label}</div>
    <div class="prompt">${esc(prompt)}</div>
    <div class="prompt-kana">${q.reverse?"":""}</div>
    <div class="options">${q.choices.map((c,i)=>`<button class="option" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <div class="feedback"></div>
    <button class="nextbtn">次の問題へ</button>
  </div>`;
  target.querySelectorAll(".option").forEach(btn=>btn.addEventListener("click",()=>answerQuestion(target,q,index,total,mode,btn)));
}
function answerQuestion(target,q,index,total,mode,clicked){
  if(target.dataset.answered==="1")return;target.dataset.answered="1";
  const chosen=clicked.dataset.choice,correct=chosen===q.answer;
  target.querySelectorAll(".option").forEach(b=>{
    b.disabled=true;if(b.dataset.choice===q.answer)b.classList.add("correct");else if(b===clicked)b.classList.add("wrong")
  });
  const fb=target.querySelector(".feedback");
  fb.className="feedback show "+(correct?"ok":"ng");
  fb.innerHTML=(correct?"✓ 正解！":"✕ 不正解")+"<br>"+esc(q.w.word)+" <span style='color:#5277c7'>"+esc(q.w.kana)+"</span> ＝ "+esc(q.w.meaning);
  if(mode==="quiz"){if(correct)quiz.score++}
  else{
    if(correct)dailyQuiz.score++;
    state.daily.pos=index+1;state.daily.score=dailyQuiz.score;saveState();refreshDailySummary();
  }
  const next=target.querySelector(".nextbtn");next.classList.add("show");
  next.textContent=index===total-1?"結果を見る":"次の問題へ";
  next.onclick=()=>{
    target.dataset.answered="0";
    if(mode==="quiz"){quiz.pos++; quiz.pos>=total?finishQuiz():renderQuestion(target,quiz.questions,quiz.pos,total,quiz.score,"quiz")}
    else{dailyQuiz.pos++; state.daily.pos=dailyQuiz.pos;state.daily.score=dailyQuiz.score;saveState(); dailyQuiz.pos>=total?finishDaily():renderQuestion(target,dailyQuiz.questions,dailyQuiz.pos,total,dailyQuiz.score,"daily")}
  }
}
function startQuiz(count){
  const questions=createQuestionPool(count,quizGrade,Math.random,quizMode,4);
  quiz={questions,pos:0,score:0};
  document.getElementById("quizSetup").style.display="none";
  const area=document.getElementById("quizArea");area.style.display="block";area.dataset.answered="0";
  renderQuestion(area,questions,0,count,0,"quiz");
}
function finishQuiz(){
  const area=document.getElementById("quizArea"), pct=Math.round(quiz.score/quiz.questions.length*100);
  let msg=pct===100?"PERFECT！":pct>=80?"かなり覚えています！":pct>=60?"あと少し！": "間違えた単語をもう一度見てみよう。";
  area.innerHTML=`<div class="quiz-shell result"><div class="score-ring"><div><b>${quiz.score}/10</b><span>${pct}%</span></div></div><h3>${msg}</h3><p>10問テストは何度でも挑戦できます。</p><button class="startbtn" onclick="resetQuiz()">もう一度挑戦</button></div>`;
}
function resetQuiz(){document.getElementById("quizArea").style.display="none";document.getElementById("quizSetup").style.display="block";quiz=null}

function hashSeed(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function ensureDaily(){
  const key=localDateKey();
  if(!state.daily||state.daily.date!==key){
    const rng=mulberry32(hashSeed("JUNIOR-ENGLISH-"+key));
    const qs=createQuestionPool(50,0,rng);
    state.daily={date:key,pos:0,score:0,completed:false,reward:0,questions:qs.map(q=>({word:q.w.word,reverse:q.reverse,choices:q.choices,answer:q.answer}))};
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(e){}
  }
  return state.daily;
}
function hydrateDailyQuestions(saved){
  return saved.questions.map(x=>{
    const w=WORDS.find(z=>z.word===x.word);
    return {w,reverse:x.reverse,choices:x.choices,answer:x.answer};
  });
}
function startDaily(){
  const d=ensureDaily();
  if(d.completed){showDailyResult();return}
  dailyQuiz={questions:hydrateDailyQuestions(d),pos:d.pos||0,score:d.score||0};
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
    <h3>${title}</h3><p>今日の50問は完了しました。<br>明日は新しい50問に切り替わります。</p>
    <div class="reward-card">🎁 本日の報酬：+${d.reward||0} COIN</div>
    <button class="startbtn" onclick="goPage('words')">単語一覧で復習する</button>
  </div>`;
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
  const start=document.getElementById("dailyStartBtn");
  if(start)start.textContent=d.completed?"今日の結果を見る":pos>0?`続きから再開（${pos}/50）`:"今日の50問を始める";
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
    startedAt:Date.now(),used:new Set(),locked:false,specialUsed:false,fastCorrect:0,questionStartedAt:0
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
    <div class="boss-q-title">${esc(data.reverse?data.w.meaning:data.w.word)}</div>
    <div class="boss-q-kana"></div>
    <div class="boss-options">${data.choices.map(c=>`<button class="boss-option" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</div>`;
  q.querySelectorAll(".boss-option").forEach(btn=>btn.addEventListener("click",()=>resolveBossAnswer(btn.dataset.choice,btn)));
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
  if(kana)kana.textContent=`${data.w.word}　${data.w.kana}　＝ ${data.w.meaning}`;
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
      <button class="startbtn" onclick="startBossBattle()">もう一度戦う</button>
      <button class="backbtn" style="margin-top:8px;width:100%" onclick="resetBossView()">ボス一覧へ</button>
    </div>`;
    over.classList.add("show");
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
    <button class="startbtn" onclick="startBossBattle()">リトライ</button>
    <button class="backbtn" style="margin-top:8px;width:100%" onclick="goPage('words')">単語を復習する</button>
  </div>`;
  over.classList.add("show");
}


renderWords();
updateHeader();
