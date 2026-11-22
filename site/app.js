const $ = id => document.getElementById(id);
const positions = ['Standalone','Beginning','Middle','End'];
const arabicPositions = ['مُنفَصِل','أَوَّل الكَلِمَة','وَسَط الكَلِمَة','آخِر الكَلِمَة'];
const storageKey = 'arabic-writing-studio-v1';
let state = {name:'',date:'',trace:true,index:0,ink:{}};
try { Object.assign(state, JSON.parse(localStorage.getItem(storageKey)) || {}); } catch {}
let index = Math.max(0, Math.min(27, Number(state.index) || 0));
let boards = [];
let playing;

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    $('save-status').textContent = 'Saved on this device';
  } catch {
    $('save-status').textContent = 'Autosave unavailable. Download a PDF before closing.';
  }
}

function progress() {
  const count = Object.values(state.ink).filter(strokes => strokes.length).length;
  $('progress-text').textContent = count + ' of 224 boards practiced';
  $('progress').value = count;
  [...$('alphabet').children].forEach((button,i) => {
    button.dataset.done = Array.from({length:8},(_,p) => state.ink[i+'-'+p]?.length).every(Boolean);
  });
}

function drawBoard(canvas, strokes, model, trace, word) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,w,h);
  for (const [y,color,dash] of [[.28,'#cfdfdf',[w*.012,w*.01]],[.69,'#9bb8b7',[]]]) {
    ctx.beginPath();
    ctx.strokeStyle=color;
    ctx.lineWidth=w*.002;
    ctx.setLineDash(dash);
    ctx.moveTo(w*.04,h*y);
    ctx.lineTo(w*.96,h*y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (trace) {
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = (h*(word?.55:.68)) + 'px Naskh, serif';
    ctx.fillStyle = '#c9d7d7';
    ctx.fillText(model,w*.86,h*.69,w*.75);
  }
  ctx.fillStyle = ctx.strokeStyle = '#153b53';
  ctx.lineWidth = w*.0085;
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.length === 1) {
      ctx.beginPath();
      ctx.arc(stroke[0][0]*w,stroke[0][1]*h,ctx.lineWidth/2,0,Math.PI*2);
      ctx.fill();
    } else if (stroke.length) {
      ctx.beginPath();
      stroke.forEach(([x,y],i) => i ? ctx.lineTo(x*w,y*h) : ctx.moveTo(x*w,y*h));
      ctx.stroke();
    }
  }
}

function makeBoard(position, word, model, meaning) {
  const key = index+'-'+(position*2+Number(word));
  const label = word ? 'Write the word' : 'Write the letter';
  const block = document.createElement('div');
  block.className = 'writing';
  block.innerHTML = '<div class="writing-head"><span><span class="model ar" lang="ar" dir="rtl"></span> <bdi class="meaning" dir="ltr"></bdi></span><strong dir="ltr"></strong></div><div class="pad"><canvas width="1000" height="400"></canvas></div><div class="board-actions" dir="ltr"><button>Undo</button><button>Clear</button></div>';
  block.querySelector('.model').textContent = model;
  block.querySelector('.meaning').textContent = meaning;
  block.querySelector('strong').textContent = label;
  const canvas = block.querySelector('canvas');
  canvas.setAttribute('aria-label', positions[position]+' · '+label+' · '+model);
  const [undo,clear] = block.querySelectorAll('button');
  undo.setAttribute('aria-label','Undo stroke · '+positions[position]+' · '+label);
  clear.setAttribute('aria-label','Clear board · '+positions[position]+' · '+label);
  let active = null;
  let pending = [];
  function paint() {
    const strokes = state.ink[key] || [];
    drawBoard(canvas, active === null ? strokes : [...strokes,pending], model,state.trace,word);
    undo.disabled = clear.disabled = !strokes.length || active !== null;
  }
  function point(event) {
    const r = canvas.getBoundingClientRect();
    const clamp = n => Math.max(0,Math.min(1,n));
    return [clamp((event.clientX-r.left)/r.width),clamp((event.clientY-r.top)/r.height)];
  }
  canvas.addEventListener('pointerdown',event => {
    if (active !== null || event.button !== 0) return;
    active = event.pointerId;
    if (event.pointerType === 'pen') lastPen = performance.now();
    canvas.setPointerCapture(active);
    pending = [point(event)];
    paint();
  });
  canvas.addEventListener('pointermove',event => {
    if (event.pointerId !== active) return;
    if (event.pointerType === 'pen') lastPen = performance.now();
    const samples = event.getCoalescedEvents?.() || [];
    for (const sample of samples.length ? samples : [event]) pending.push(point(sample));
    paint();
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) {
    canvas.addEventListener(type,event => {
      if (event.pointerId !== active) return;
      if (event.pointerType === 'pen') lastPen = performance.now();
      if (type === 'pointerup') {
        const end = point(event);
        const last = pending.at(-1);
        if (last[0] !== end[0] || last[1] !== end[1]) pending.push(end);
        (state.ink[key] ||= []).push(pending);
      }
      active = null;
      pending = [];
      save(); progress(); paint();
    });
  }
  undo.onclick = () => { state.ink[key].pop(); save(); progress(); paint(); };
  clear.onclick = () => {
    if (!confirm('Clear this handwriting board?')) return;
    delete state.ink[key]; save(); progress(); paint();
  };
  boards.push(paint);
  paint();
  return block;
}
let lastPen = -Infinity;
document.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch' && event.target instanceof HTMLCanvasElement && performance.now()-lastPen < 650) {
    event.stopPropagation();
  }
}, true);

function render() {
  const item = letters[index];
  $('glyph').textContent = item.letter;
  $('count').textContent = 'LETTER '+(index+1)+' OF 28';
  $('letter-title').textContent = item.english;
  $('arabic-name').textContent = item.name;
  $('joining').textContent = item.joins
    ? 'This letter can join on both sides. Its actual shape depends on the neighboring letters.'
    : 'This letter can join to the letter before it, and it leaves a gap before the next letter.';
  $('audio-status').hidden = true;
  [...$('alphabet').children].forEach((button,i) => button.setAttribute('aria-current',String(index===i)));
  boards = [];
  $('boards').replaceChildren(...positions.map((position,i) => {
    const card = document.createElement('section');
    card.className = 'position';
    card.innerHTML = '<h3><span class="ar" lang="ar"></span><span dir="ltr"></span></h3>';
    card.querySelector('.ar').textContent = arabicPositions[i];
    card.querySelector('[dir=ltr]').textContent = position;
    card.append(makeBoard(i,false,item.forms[i],''),makeBoard(i,true,...item.words[i]));
    return card;
  }));
  $('prev').disabled = index===0;
  $('next').disabled = index===27;
}

function select(i) {
  if (i<0 || i>=letters.length || index===i) return;
  window.speechSynthesis?.cancel();
  playing?.pause();
  index = state.index = i;
  render(); save();
  $('letter-title').focus({preventScroll:true});
  $('glyph').scrollIntoView({block:'nearest'});
}

function announceAudio(message) {
  $('audio-status').textContent = message;
  $('audio-status').hidden = false;
}
function speak(kind) {
  const item = letters[index];
  const spoken = kind === 'name' ? item.name : (index===0 ? 'أَ' : item.letter+'َ');
  const engine = window.speechSynthesis;
  engine?.cancel();
  playing?.pause();
  $('audio-status').hidden = true;
  const key = (index+1)+'-'+kind;
  const file = window.pronunciationFiles?.[key];
  if (file) {
    playing = new Audio(file);
    playing.play().catch(() => announceAudio('Recording unavailable. Check the audio files.'));
    return;
  }
  const voice = engine?.getVoices().find(voice => /^ar(?:[-_]|$)/i.test(voice.lang));
  if (!voice) {
    announceAudio('Arabic audio needs an Arabic speech voice. Enable one in your device settings or try another device.');
    return;
  }
  const phrase = new SpeechSynthesisUtterance(spoken);
  phrase.voice = voice;
  phrase.lang = voice.lang;
  phrase.rate = .8;
  phrase.onerror = event => {
    if (!['interrupted','canceled'].includes(event.error)) announceAudio('Arabic playback failed. Try this button again.');
  };
  engine.speak(phrase);
}

for (const [i,item] of letters.entries()) {
  const button = document.createElement('button');
  button.lang = 'ar';
  button.textContent = item.letter;
  button.setAttribute('aria-label', item.english+' · '+item.letter);
  button.onclick = () => select(i);
  $('alphabet').append(button);
}
if (!state.date) {
  const now = new Date();
  state.date = new Date(now.valueOf()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
for (const field of ['name','date']) {
  $(field).value = state[field];
  $(field).addEventListener('input', () => { state[field] = $(field).value; save(); });
}
$('trace').checked = state.trace;
$('trace').onchange = () => { state.trace = $('trace').checked; boards.forEach(paint=>paint()); save(); };
$('prev').onclick = () => select(index-1);
$('next').onclick = () => select(index+1);
$('listen-name').onclick = () => speak('name');
$('listen-sound').onclick = () => speak('sound');
window.speechSynthesis?.getVoices();
$('export').onclick = async () => {
  const button = $('export');
  button.disabled = true;
  button.textContent = 'Preparing PDF…';
  try { await downloadHomework(structuredClone(state)); }
  catch { alert('The PDF could not be created. Your boards are still open. Try downloading again.'); }
  finally { button.disabled = false; button.textContent = 'Download homework PDF'; }
};
render(); progress(); save();
document.fonts.ready.then(() => boards.forEach(paint=>paint()));
