/* script.js — ES module, performance-minded, accessible
   - State is encapsulated in `state` object
   - DOM updates done with DocumentFragment and requestAnimationFrame where helpful
*/

const FILE_URL = '/mnt/data/file-3.txt';
const STORAGE_KEY = `german-wordwall:${FILE_URL}`;
const BOOKMARKS_KEY = `german-wordwall:bookmarks:${FILE_URL}`;

const state = {
  themes: [],
  cards: [],
  index: 0,
  bookmarks: {},
  showBookmarks: false,
  examMode: true
};

// Cached elements
let el = {};

function q(id){ return document.getElementById(id); }

/* ----------------- setVh ----------------- */
function setVh() {
      document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
    }
    setVh();
    // update on resize/orientationchange
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);

/* ----------------- Utilities ----------------- */
function safeParseJSON(s, fallback) {
  try{
    const v = JSON.parse(s);
    // treat null or non-object results as missing and return fallback
    if(v && typeof v === 'object') return v;
    return fallback;
  }catch(e){ return fallback; }
}

function saveIndex(){ try{ localStorage.setItem(STORAGE_KEY, String(state.index)); }catch(e){} }
function restoreIndex(total){ try{ const v=localStorage.getItem(STORAGE_KEY); if(!v) return 0; const n=parseInt(v,10); if(Number.isInteger(n) && n>=0 && n<total) return n;}catch(e){} return 0; }

function loadBookmarks(){ state.bookmarks = safeParseJSON(localStorage.getItem(BOOKMARKS_KEY), {}); }
function saveBookmarks(){ try{ localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(state.bookmarks)); }catch(e){} }

function cardId(c){ return `${(c.theme||'')}|${c.g}|${c.e}`; }

function shuffleArray(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } }

/* ----------------- Parsing ----------------- */
function rtfToText(raw){
  return raw
    .replace(/\\par[d]?/g,'\n')
    .replace(/\\'[0-9a-fA-F]{2}/g,'')
    .replace(/\\[a-zA-Z]+\d* ?/g,'')
    .replace(/[{}]/g,'')
    .replace(/\r/g,'\n');
}

function parseNewFormat(text){
  const rawLines = text.replace(/\r/g,'\n').split('\n');
  const lines = rawLines.map(l=>l.trim()).filter(Boolean);
  const themes = [];
  let currentTheme=null, lastItem=null;
  for(const line of lines){
    let l=line.replace(/^\*\s?/,'').trim();
    const satzMatch = l.match(/^Satz\s*[:：]?\s*(.+)$/i);
    if(satzMatch && lastItem){ lastItem.satz = satzMatch[1].trim(); continue; }
    const translMatch = l.match(/^Translation\s*[:：]?\s*(.+)$/i);
    if(translMatch && lastItem){ lastItem.satz_en = translMatch[1].trim(); continue; }
    const vocabMatch = l.match(/^(?:\d+\.\s*)?(.+?)\s*-\s*(.+)$/);
    if(vocabMatch){ if(!currentTheme){ currentTheme = { title:'Misc', items:[] }; themes.push(currentTheme); } lastItem = { g: vocabMatch[1].trim(), e: vocabMatch[2].trim(), satz:'', satz_en:'' }; currentTheme.items.push(lastItem); continue; }
    const themeMatch = l.match(/^(\d+)\.\s*(.+)$/);
    if(themeMatch){ currentTheme = { title: themeMatch[2].trim(), items:[] }; themes.push(currentTheme); lastItem=null; continue; }
    // ignore otherwise
  }
  return themes;
}

function flatten(themes){ const out=[]; themes.forEach(t=> t.items.forEach(w=> out.push({ theme: t.title, ...w }))); return out; }

/* ----------------- Choices / Exam ----------------- */
function buildChoicesForCard(card){ const correct = card.e; const pool = state.cards.map(c=>c.e).filter(t=>t && t!==correct); shuffleArray(pool); const wrongs = pool.slice(0,2); const choices = [{text:correct, correct:true}, ...wrongs.map(w=>({text:w, correct:false}))]; shuffleArray(choices); return choices; }

/* ----------------- Rendering ----------------- */
function renderCards(){
  const root = el.cardsRoot;
  root.innerHTML='';
  const list = state.showBookmarks ? state.cards.filter(c=>state.bookmarks[cardId(c)]) : state.cards;
  const frag = document.createDocumentFragment();
  list.forEach((c,i)=>{
    const card = document.createElement('article');
    card.className='card';
    card.dataset.index = i;
    card.setAttribute('role','group');
    card.style.transform = `translateY(${(i-state.index)*110}%)`;

    const starred = !!state.bookmarks[cardId(c)];

    card.innerHTML = `
      <header class="card__theme">
        <h2 class="title">${escapeHTML(c.theme)}</h2>
        <button class="card__bookmark btn" aria-pressed="${starred}" title="Toggle bookmark" data-id="${escapeAttr(cardId(c))}"> ${starred? '★':'☆'} </button>
      </header>
      <div class="card__content">
        <h3 class="word--german">${escapeHTML(c.g)}</h3>
        <div class="examples" aria-hidden="true">
        <div class="word--english" aria-hidden="false">${escapeHTML(c.e)}</div>
          <div><strong>Satz:</strong> ${escapeHTML(c.satz)}</div>
          <div style="margin-top:8px"><strong>EN:</strong> ${escapeHTML(c.satz_en)}</div>
        </div>
        <div class="choice-row" aria-hidden="${!state.examMode}"></div>
      </div>
    `;

    // per-card click handler removed — a single delegated handler on `el.cardsRoot`
    // (and the hint-button handler) manage toggling examples.

    frag.appendChild(card);
  });
  root.appendChild(frag);

  // after DOM insertion bind controls in batch
  bindCardControls();
  updateUI();
}

function bindCardControls(){
  // bookmark buttons
  el.cardsRoot.querySelectorAll('.card__bookmark').forEach(btn => {
    if(btn.dataset.bound) return; // avoid duplicate
    btn.dataset.bound = '1';
    btn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const id = btn.dataset.id;
      if(state.bookmarks[id]){ delete state.bookmarks[id]; btn.setAttribute('aria-pressed','false'); btn.textContent='☆'; }
      else { state.bookmarks[id]=true; btn.setAttribute('aria-pressed','true'); btn.textContent='★'; }
      saveBookmarks();
    });
  });

  // build choices if examMode
  if(state.examMode){
    const cards = Array.from(el.cardsRoot.querySelectorAll('.card'));
    cards.forEach(cardEl => {
      const idx = Number(cardEl.dataset.index);
      const list = state.showBookmarks ? state.cards.filter(c=>state.bookmarks[cardId(c)]) : state.cards;
      const cardData = list[idx];
      const row = cardEl.querySelector('.choice-row');
      if(!row) return;
      row.innerHTML='';
      const choices = buildChoicesForCard(cardData);
      choices.forEach(ch => {
        const b = document.createElement('button');
        b.className = 'choice-btn btn';
        b.textContent = ch.text;
        b.dataset.correct = ch.correct ? '1' : '0';
        b.setAttribute('aria-pressed','false');
        b.addEventListener('click', (ev)=>{ ev.stopPropagation(); evaluateChoice(b); });
        row.appendChild(b);
      });
    });
  }
}

function evaluateChoice(btn){
  const row = btn.closest('.choice-row');
  const buttons = Array.from(row.querySelectorAll('.choice-btn'));
  buttons.forEach(b=>{ b.disabled = true; b.setAttribute('aria-pressed', 'true'); });
  if(btn.dataset.correct === '1'){
    btn.classList.add('correct');
    // score tracking
    state.scores = state.scores || { correct:0, wrong:0 };
    state.scores.correct++;
    saveScores();
    announceLive('Correct');
    updateScoreChip();
  } else {
    btn.classList.add('wrong');
    const correctBtn = buttons.find(b=>b.dataset.correct==='1');
    if(correctBtn) correctBtn.classList.add('correct-border');
    state.scores = state.scores || { correct:0, wrong:0 };
    state.scores.wrong++;
    saveScores();
    announceLive('Incorrect');
    updateScoreChip();
  }
}

/* ----------------- Score persistence ----------------- */
function saveScores(){ try{ localStorage.setItem(`german-wordwall:scores:${FILE_URL}`, JSON.stringify(state.scores||{correct:0,wrong:0})); }catch(e){} }
function loadScores(){ try{ state.scores = JSON.parse(localStorage.getItem(`german-wordwall:scores:${FILE_URL}`)) || {correct:0,wrong:0}; }catch(e){ state.scores={correct:0,wrong:0}; } }
function updateScoreChip(){ const chip = document.getElementById('scoreChip'); if(!chip) return; const s=state.scores||{correct:0,wrong:0}; chip.textContent = `${s.correct} ✅ / ${s.wrong} ❌`; }

/* ----------------- Live region ----------------- */
function announceLive(msg){ const r = document.getElementById('liveRegion'); if(!r) return; r.textContent = msg; setTimeout(()=>{ r.textContent=''; }, 1200); }

/* ----------------- Export / Import Bookmarks ----------------- */
function exportBookmarks(){ try{ const data = JSON.stringify(state.bookmarks||{}); const blob = new Blob([data],{type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'bookmarks.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }catch(e){ console.error(e); } }

function importBookmarksFile(file){ const reader = new FileReader(); reader.onload = (e)=>{ try{ const obj = JSON.parse(e.target.result); if(typeof obj === 'object'){ state.bookmarks = obj; saveBookmarks(); renderCards(); announceLive('Bookmarks imported'); } }catch(err){ alert('Invalid JSON file'); } }; reader.readAsText(file); }


/* ----------------- UI Helpers ----------------- */
function updateUI(){
  requestAnimationFrame(()=>{
    const list = state.showBookmarks ? state.cards.filter(c=>state.bookmarks[cardId(c)]) : state.cards;
    const total = list.length || 1;
    el.countChip.textContent = `${Math.min(state.index+1, total)}/${total}`;
    el.progressFill.style.width = (total?((state.index+1)/total*100):0) + '%';
    // update card transforms and visibility
    const nodes = Array.from(el.cardsRoot.querySelectorAll('.card'));
    nodes.forEach(node => {
      const i = Number(node.dataset.index);
      const offset = i - state.index;
      node.style.transform = `translateY(${offset*110}%)`;
      node.style.opacity = Math.abs(offset) > 2 ? '0' : '1';
    });
  });
}

function setIndex(i){
  const total = state.showBookmarks ? state.cards.filter(c=>state.bookmarks[cardId(c)]).length : state.cards.length;
  if(!total){ state.index = 0; return; }
  state.index = ((i % total) + total) % total;
  saveIndex();
  updateUI();
}
function next(){ setIndex(state.index+1); }
function prev(){ setIndex(state.index-1); }

/* ----------------- Controls binding ----------------- */
function bindControls(){
  el.nextBtn.addEventListener('click', next);
  el.prevBtn.addEventListener('click', prev);
  el.shuffleBtn.addEventListener('click', ()=>{ shuffleArray(state.cards); state.index=0; saveIndex(); renderCards(); });
  el.toggleBookmarksBtn.addEventListener('click', ()=>{ state.showBookmarks = !state.showBookmarks; el.toggleBookmarksBtn.textContent = state.showBookmarks? 'All' : 'Bookmarks'; state.index=0; saveIndex(); renderCards(); });
  el.examBtn.addEventListener('click', ()=>{ state.examMode = !state.examMode; el.examBtn.textContent = state.examMode? 'Hide Exam' : 'Show Exam'; state.index=0; saveIndex(); renderCards(); });
  // export/import
  el.exportBtn.addEventListener('click', ()=>{ exportBookmarks(); });
  el.importBtn.addEventListener('click', ()=>{ el.importFile.click(); });
  el.importFile.addEventListener('change', (ev)=>{ const f = ev.target.files && ev.target.files[0]; if(f) importBookmarksFile(f); el.importFile.value=''; });
  document.addEventListener('keydown', (e)=>{ if(e.key==='ArrowDown') next(); if(e.key==='ArrowUp') prev(); if(['1','2','3'].includes(e.key)){ // try submit to visible card
      const visible = el.cardsRoot.querySelector('.card');
    }
  });

    // hint button should reveal examples for the current visible card (show, not toggle)
  if(el.hint){
    function showExamplesForCurrent(){
      const cards = Array.from(el.cardsRoot.querySelectorAll('.card'));
      let card = cards.find(n => Number(n.dataset.index) === Number(state.index));
      if(!card) card = cards[0];
      if(!card) return;
      const examples = card.querySelector('.examples');
      if(!examples) return;
      const visible = examples.getAttribute('aria-hidden') === 'true';
      examples.setAttribute('aria-hidden',String(!visible));
    }

    el.hint.addEventListener('click', (ev)=>{ ev.preventDefault(); showExamplesForCurrent(); });
    el.hint.addEventListener('keydown', (ev)=>{
      if(ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar'){
        ev.preventDefault(); showExamplesForCurrent();
      }
    });
  }

  // global click on card root: toggle examples when tapping anywhere on a card
  el.cardsRoot.addEventListener('click', (ev)=>{
    const card = ev.target.closest && ev.target.closest('.card');
    if(!card) return;
    // ignore clicks on bookmark or choice buttons
    if(ev.target.closest('.card__bookmark') || ev.target.closest('.choice-btn')) return;
    const examples = card.querySelector('.examples');
    if(!examples) return;
    const visible = examples.getAttribute('aria-hidden') === 'false';
    examples.setAttribute('aria-hidden', String(!visible));
  });

  // touch / pointer swipe handling: vertical swipe up -> next, swipe down -> prev
  (function attachSwipeHandlers(){
    let startY = null, startX = null, startTime = 0;
    const threshold = 40; // pixels
    const restraint = 80; // max horizontal movement
    const allowedTime = 500; // ms

    let activePointerId = null;
    let dragging = false;

    function onStart(e){
      // ignore swipes that start on interactive controls
      const t = (e.target && e.target.closest) ? e.target : null;
      if(t && t.closest && t.closest('.btn')) return;
      startTime = Date.now();
      dragging = false;
      if(e.type === 'pointerdown'){
        activePointerId = e.pointerId;
        startY = e.clientY; startX = e.clientX;
      } else if(e.type === 'touchstart'){
        const t0 = e.touches && e.touches[0];
        if(!t0) return;
        startY = t0.clientY; startX = t0.clientX;
      } else if(e.type === 'mousedown'){
        startY = e.clientY; startX = e.clientX;
      }
    }

    function onMove(e){
      let clientY = null, clientX = null;
      if(e.type === 'pointermove'){
        if(activePointerId != null && e.pointerId !== activePointerId) return;
        clientY = e.clientY; clientX = e.clientX;
      } else if(e.type === 'touchmove'){
        const t0 = e.touches && e.touches[0]; if(!t0) return; clientY = t0.clientY; clientX = t0.clientX;
      } else if(e.type === 'mousemove'){
        clientY = e.clientY; clientX = e.clientX;
      }
      if(startY === null) return;
      const dy = startY - clientY;
      const dx = Math.abs((startX||0) - (clientX||0));
      // if vertical movement dominates, prevent native scroll and mark dragging
      if(Math.abs(dy) > 10 && Math.abs(dy) > dx){
        dragging = true;
        // preventDefault to stop native scrolling when dragging vertically
        try{ e.preventDefault(); }catch(err){}
      }
    }

    function onEnd(e){
      let endY = null, endX = null;
      if(e.type === 'pointerup' || e.type === 'pointercancel'){
        if(activePointerId != null && e.pointerId !== activePointerId) return;
        endY = e.clientY; endX = e.clientX; activePointerId = null;
      } else if(e.type === 'touchend' || e.type === 'touchcancel'){
        const t0 = e.changedTouches && e.changedTouches[0]; if(!t0) return; endY = t0.clientY; endX = t0.clientX;
      } else if(e.type === 'mouseup'){
        endY = e.clientY; endX = e.clientX;
      }
      if(startY === null) return;
      const distY = startY - (endY||0);
      const distX = Math.abs((startX||0) - (endX||0));
      const elapsed = Date.now() - startTime;
      startY = null; startX = null; startTime = 0;
      // if not dragging, ignore
      if(!dragging) return;
      if(elapsed > allowedTime) return;
      if(distX > restraint) return;
      if(Math.abs(distY) >= threshold){ if(distY > 0) next(); else prev(); }
      dragging = false;
    }

    // attach listeners (non-passive where we may call preventDefault)
    if(window.PointerEvent){
      el.cardsRoot.addEventListener('pointerdown', onStart);
      // track moves and end on window so we capture drags that leave the element
      window.addEventListener('pointermove', onMove, {passive:false});
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    } else {
      el.cardsRoot.addEventListener('touchstart', onStart, {passive:false});
      el.cardsRoot.addEventListener('touchmove', onMove, {passive:false});
      el.cardsRoot.addEventListener('touchend', onEnd);
      el.cardsRoot.addEventListener('touchcancel', onEnd);
      // mouse fallback
      el.cardsRoot.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
    }
  })();
}

/* ----------------- Fetch + initialize ----------------- */
async function loadFile(){
  try{
    const res = await fetch(FILE_URL);
    const raw = await res.text();
    const plain = rtfToText(raw);
    state.themes = parseNewFormat(plain);
    state.cards = flatten(state.themes);
    loadBookmarks();
    state.index = restoreIndex(state.cards.length || 1);
  }catch(e){ console.error('file load error', e); state.cards = []; }
  if(!state.cards.length) state.cards = [{ theme:'Sample', g:'Hallo', e:'Hello', satz:'', satz_en:'' }];
  renderCards();
}

/* ----------------- Escape helpers (small) ----------------- */
function escapeHTML(s){ if(!s) return ''; return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function escapeAttr(s){ return (s||'').replaceAll('"','\"'); }

/* ----------------- Init ----------------- */
function init(){
  el.cardsRoot = q('cardsRoot');
  el.countChip = q('countChip');
  el.hint = q('hint');
  el.progressFill = q('progressFill');
  el.nextBtn = q('nextBtn');
  el.prevBtn = q('prevBtn');
  el.shuffleBtn = q('shuffleBtn');
  el.toggleBookmarksBtn = q('toggleBookmarksBtn');
  el.examBtn = q('examBtn');
  el.exportBtn = q('exportBtn');
  el.importBtn = q('importBtn');
  el.importFile = q('importFile');
  el.scoreChip = q('scoreChip');

  loadScores();
  updateScoreChip();

  bindControls();
  loadFile();
}

// start when DOM ready
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
