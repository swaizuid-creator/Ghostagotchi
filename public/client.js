const socket = io();

/* ====== Zet hier je trade/pair link ====== */
const TRADE_URL = 'https://pump.fun/<JOUW_TOKEN_OF_LINK>';
/* ======================================== */

const el = {
  // Hero & stats
  name: document.getElementById('name'),
  mood: document.getElementById('mood'),
  moodEmoji: document.getElementById('moodEmoji'),
  hunger: document.getElementById('hunger'),
  energy: document.getElementById('energy'),
  happiness: document.getElementById('happiness'),
  lastAction: document.getElementById('lastAction'),
  ghostSprite: document.getElementById('ghostSprite'),
  attentionIcon: document.getElementById('attentionIcon'),

  // Survival
  goal: document.getElementById('goalUsd'),   // id blijven hergebruiken, nu SOL
  last: document.getElementById('lastUsd'),
  nextPass: document.getElementById('nextPass'),
  nextFail: document.getElementById('nextFail'),
  survStatus: document.getElementById('survStatus'),
  streak: document.getElementById('streak'),
  hype: document.getElementById('hype'),
  countdown: document.getElementById('countdown'),
  progressBar: document.getElementById('progressBar'),
  progressFill: document.getElementById('progressFill'),
  progressLabel: document.getElementById('progressLabel'),

  // Log
  logList: document.getElementById('logList'),

  // Controls
  muteBtn: document.getElementById('muteBtn'),
  vol: document.getElementById('vol'),

  // CTA & QR & callout
  ctaBtn: document.getElementById('ctaBtn'),
  copyLink: document.getElementById('copyLink'),
  toggleQR: document.getElementById('toggleQR'),
  qrBox: document.getElementById('qrBox'),
  qrImg: document.getElementById('qrImg'),
  callout: document.getElementById('callout'),
  calloutTrade: document.getElementById('calloutTrade'),

  // Overlays
  confettiLayer: document.getElementById('confettiLayer'),
  toast: document.getElementById('toast'),
  bubble: document.getElementById('chatBubble')
};

// === CTA init ===
if (el.ctaBtn) el.ctaBtn.href = TRADE_URL;
if (el.calloutTrade) el.calloutTrade.href = TRADE_URL;
if (el.copyLink){
  el.copyLink.onclick = async ()=>{
    await navigator.clipboard.writeText(TRADE_URL);
    el.copyLink.textContent = 'Gekopieerd ✅';
    setTimeout(()=>el.copyLink.textContent='Kopieer link',1500);
  };
}
if (el.toggleQR){
  el.toggleQR.onclick = ()=>{
    if (el.qrBox.hidden){
      el.qrImg.src = `https://chart.googleapis.com/chart?cht=qr&chs=180x180&chl=${encodeURIComponent(TRADE_URL)}`;
      el.qrBox.hidden = false;
      el.toggleQR.textContent = 'QR verbergen';
    } else {
      el.qrBox.hidden = true;
      el.toggleQR.textContent = 'QR tonen';
    }
  };
}

// === AUDIO ===
let sfxMuted = false;
let globalVol = 0.4;
let lastLowHealthAt = 0;

if (el.muteBtn){
  el.muteBtn.addEventListener('click', () => {
    sfxMuted = !sfxMuted;
    el.muteBtn.textContent = sfxMuted ? '🔊 Geluid aan' : '🔇 Geluid uit';
  });
}
if (el.vol){
  el.vol.oninput = ()=>{ globalVol = (Number(el.vol.value)||0)/100; };
}

function playSfx(file){
  if (sfxMuted) return;
  const a = new Audio('assets/sfx/' + file);
  a.volume = globalVol;
  a.play().catch(()=>{});
}

// === VISUAL HELPERS ===
function setGhostImg(file){ el.ghostSprite.src = 'assets/' + file; }
function maybePlayLowHealth(){
  const now = Date.now();
  if (now - lastLowHealthAt > 10000) { playSfx('lowhealth.wav'); lastLowHealthAt = now; }
}
let confettiLockUntil = 0;
function confetti(){
  const layer = el.confettiLayer;
  if (!layer) return;
  const EMO = ['🎉','🧡','🎃','👻','✨'];
  for (let i=0;i<24;i++){
    const p = document.createElement('i');
    p.textContent = EMO[Math.floor(Math.random()*EMO.length)];
    p.style.left = Math.random()*100+'%';
    p.style.fontSize = (16+Math.random()*22)+'px';
    p.style.animationDelay = (Math.random()*0.6)+'s';
    layer.appendChild(p);
    setTimeout(()=>p.remove(), 1900);
  }
}
function toast(msg){
  if (!el.toast) return;
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  setTimeout(()=> el.toast.classList.remove('show'), 2200);
}
function hypeText(st){ return st>=6?'🔥 INSANE' : st>=3?'🚀 Hype' : st>=1?'⚡ Warm-up' : '–'; }
function moodEmoji(mood){
  const m = (mood||'').toLowerCase();
  if (m.includes('rested') || m.includes('sleep')) return '😴';
  if (m.includes('play'))   return '😄';
  if (m.includes('spooky')) return '👻';
  if (m.includes('satisfied') || m.includes('cheer')) return '🙂';
  if (m.includes('sick') || m.includes('sad')) return '😵';
  return '🙂';
}
// Smooth animatie voor <progress>
function animateProgress(elm, to, duration=400){
  const from = Number(elm.value)||0;
  const start = performance.now();
  const diff = to - from;
  function step(t){
    const k = Math.min(1, (t - start)/duration);
    elm.value = from + diff * k;
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
// Logregels → icoontjes
function decorateLog(text){
  const map = [
    {k:'AI: feed',     r:'🍗  AI: feed'},
    {k:'AI: sleep',    r:'😴  AI: sleep'},
    {k:'AI: play',     r:'🎮  AI: play'},
    {k:'AI: trick',    r:'🎲  AI: trick'},
    {k:'Survival goal gehaald', r:'✅  Survival goal gehaald'},
    {k:'Survival goal gemist',  r:'❌  Survival goal gemist'},
  ];
  let out = text;
  map.forEach(m=>{ if (out.includes(m.k)) out = out.replace(m.k, m.r); });
  return out;
}
function highlightCTA(){
  const b = document.getElementById('ctaBtn');
  if (!b) return;
  b.classList.add('highlight');
  setTimeout(()=> b.classList.remove('highlight'), 1200);
}
// Random chat bubble
const BUBBLES_BASE = ['Feed meeee 🍗','I feel spooky 👻','Hype train? 🚂','Let’s play! 🎮','Sleepy time… 😴'];
function bubbleMessage(state){
  if (state.pet.hunger >= 80)  return 'So hungry… 🍽️';
  if (state.pet.energy <= 20)  return 'Zzzz… need sleep 😴';
  if (state.pet.happiness <= 25) return 'Need fun! 🎲';
  return BUBBLES_BASE[Math.floor(Math.random()*BUBBLES_BASE.length)];
}
function showBubble(msg){
  const b = document.getElementById('chatBubble');
  if (!b) return;
  b.textContent = msg;
  b.hidden = false;
  setTimeout(()=> b.hidden = true, 2500);
}
setInterval(()=>{ if (window._latestState) showBubble(bubbleMessage(window._latestState)); }, 25000 + Math.random()*20000);

// Helpers
const fmtSOL = (x)=> `\u25CE${Number(x).toFixed(3)}`; // ◎ met 3 decimalen

// === SOCKET STATE ===
let lastPct = 0;
socket.on('state', (s)=>{
  window._latestState = s;

  // Pet
  const p = s.pet;
  el.name.textContent = p.name;
  el.mood.textContent = p.mood;
  if (el.moodEmoji) el.moodEmoji.textContent = moodEmoji(p.mood);
  animateProgress(el.hunger, p.hunger);
  animateProgress(el.energy, p.energy);
  animateProgress(el.happiness, p.happiness);
  el.lastAction.textContent = s.lastAction;

  if (p.attention) { el.attentionIcon.hidden = false; maybePlayLowHealth(); }
  else { el.attentionIcon.hidden = true; }

  // Actie → sprite + sfx
  const a = s.lastAction || '';
  if (a.includes('AI: feed'))      { setGhostImg('ghost_feed.png');  playSfx('feed_nom.wav'); }
  else if (a.includes('AI: sleep')){ setGhostImg('ghost_sleep.png'); playSfx('sleep_snore.wav'); }
  else if (a.includes('AI: play')) { setGhostImg('ghost_play.png');  playSfx('play_chime.wav'); }
  else if (a.includes('AI: trick')){ setGhostImg('ghost_trick.png'); playSfx('trick_spooky.wav'); }
  else if (a.includes('survival ✅')) { setGhostImg('ghost_play.png'); playSfx('play_chime.wav'); if (Date.now()>confettiLockUntil){ confetti(); confettiLockUntil=Date.now()+5000; } toast('✅ Hour cleared!'); highlightCTA(); }
  else if (a.includes('survival ❌')) { setGhostImg('ghost_trick.png'); playSfx('error_sad.wav'); toast('❌ Missed the goal…'); }
  else { setGhostImg('ghost_idle.png'); }

  // Survival UI (SOL)
  const sv = s.survival || {};
  const sol = Number(sv.lastHourVolumeSol || 0);

  el.goal.textContent = fmtSOL(sv.hourlyGoalSol ?? 0);
  el.last.textContent = fmtSOL(sol);
  el.survStatus.textContent = sv.lastCheckPassed === null ? '—' : (sv.lastCheckPassed ? '✅ Gehaald' : '❌ Gemist');
  el.survStatus.className = sv.lastCheckPassed ? 'good' : 'bad';
  el.streak.textContent = sv.streak || 0;
  el.hype.textContent = hypeText(sv.streak||0);

  // Next goal previews
  el.nextPass.textContent = fmtSOL(sv.nextGoalOnPassSol ?? 0);
  el.nextFail.textContent = fmtSOL(sv.nextGoalOnFailSol ?? 0);

  const t = Math.max(0, sv.nextCheckETA || 0);
  const mm = String(Math.floor(t/60)).padStart(2,'0');
  const ss = String(t%60).padStart(2,'0');
  el.countdown.textContent = `${mm}:${ss}`;

  const pct = Math.min(100, Math.round((sv.progress || 0)*100));
  el.progressFill.style.width = pct + '%';
  el.progressLabel.textContent = pct + '%';

  // Glow/pulse + callout
  if (pct >= 80 && pct < 90)  { el.progressBar.classList.add('glow'); el.progressBar.classList.remove('pulse','pulse-fast'); }
  else if (pct >= 90 && pct < 100) { el.progressBar.classList.add('glow','pulse-fast'); el.progressBar.classList.remove('pulse'); }
  else if (pct === 100)       { el.progressBar.classList.add('glow'); el.progressBar.classList.remove('pulse','pulse-fast'); }
  else                        { el.progressBar.classList.remove('glow','pulse','pulse-fast'); }

  el.callout.hidden = !(pct < 50);

  if (pct - lastPct >= 10) highlightCTA();
  lastPct = pct;

  // Log
  el.logList.innerHTML = '';
  (s.log || []).forEach(item=>{
    const li = document.createElement('li');
    li.textContent = decorateLog(item);
    el.logList.appendChild(li);
  });

  // Achievements
  if (sv.lastCheckPassed){
    if (sv.streak === 1) toast('🔥 Streak 1 — we’re alive!');
    if (sv.streak === 3) toast('🚀 Streak 3 — Hype mode!');
    if (sv.streak === 6) toast('👑 Streak 6 — INSANE!');
  }
});