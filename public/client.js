const socket = io();

/* ====== CONFIG: zet hier je trade/pair link ====== */
const TRADE_URL = 'https://pump.fun/<JOUW_TOKEN_OF_LINK>';
/* ================================================ */

const el = {
  name: document.getElementById('name'),
  mood: document.getElementById('mood'),
  hunger: document.getElementById('hunger'),
  energy: document.getElementById('energy'),
  happiness: document.getElementById('happiness'),
  lastAction: document.getElementById('lastAction'),
  ghostSprite: document.getElementById('ghostSprite'),
  attentionIcon: document.getElementById('attentionIcon'),

  goalUsd: document.getElementById('goalUsd'),
  lastUsd: document.getElementById('lastUsd'),
  survStatus: document.getElementById('survStatus'),
  streak: document.getElementById('streak'),
  countdown: document.getElementById('countdown'),
  progressBar: document.getElementById('progressBar'),
  progressFill: document.getElementById('progressFill'),
  progressLabel: document.getElementById('progressLabel'),

  hype: document.getElementById('hype'),
  logList: document.getElementById('logList'),

  muteBtn: document.getElementById('muteBtn'),
  vol: document.getElementById('vol'),

  // CTA/QR/Callout
  ctaBtn: document.getElementById('ctaBtn'),
  copyLink: document.getElementById('copyLink'),
  toggleQR: document.getElementById('toggleQR'),
  qrBox: document.getElementById('qrBox'),
  qrImg: document.getElementById('qrImg'),
  callout: document.getElementById('callout'),
  calloutTrade: document.getElementById('calloutTrade'),

  confettiLayer: document.getElementById('confettiLayer')
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

document.addEventListener('keydown',(e)=>{
  if (e.key.toLowerCase()==='m'){ // hotkey: M = mute
    sfxMuted = !sfxMuted;
    if (el.muteBtn) el.muteBtn.textContent = sfxMuted ? '🔊 Geluid aan' : '🔇 Geluid uit';
  }
});

// === VISUAL HELPERS ===
function setGhostImg(file){ el.ghostSprite.src = 'assets/' + file; }

function maybePlayLowHealth(){
  const now = Date.now();
  if (now - lastLowHealthAt > 10000) { // max 1x per 10s
    playSfx('lowhealth.wav');
    lastLowHealthAt = now;
  }
}

// Confetti
let confettiLockUntil = 0;
function confetti(){
  const layer = el.confettiLayer;
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

// Hype text
function hypeText(st){
  return st>=6?'🔥 INSANE' : st>=3?'🚀 Hype' : st>=1?'⚡ Warm-up' : '–';
}

// === SOCKET STATE ===
socket.on('state', (s)=>{
  // Pet stats
  const p = s.pet;
  el.name.textContent = p.name;
  el.mood.textContent = p.mood;
  el.hunger.value = p.hunger;
  el.energy.value = p.energy;
  el.happiness.value = p.happiness;
  el.lastAction.textContent = s.lastAction;

  // Attention
  if (p.attention) {
    el.attentionIcon.hidden = false;
    maybePlayLowHealth();
  } else {
    el.attentionIcon.hidden = true;
  }

  // Actie → sprite + sfx
  const a = s.lastAction || '';
  if (a.includes('AI: feed')) {
    setGhostImg('ghost_feed.png'); playSfx('feed_nom.wav');
  } else if (a.includes('AI: sleep')) {
    setGhostImg('ghost_sleep.png'); playSfx('sleep_snore.wav');
  } else if (a.includes('AI: play')) {
    setGhostImg('ghost_play.png');  playSfx('play_chime.wav');
  } else if (a.includes('AI: trick')) {
    setGhostImg('ghost_trick.png'); playSfx('trick_spooky.wav');
  } else if (a.includes('survival ✅')) {
    setGhostImg('ghost_play.png');  playSfx('play_chime.wav');
    if (Date.now() > confettiLockUntil){ confetti(); confettiLockUntil = Date.now()+5000; }
  } else if (a.includes('survival ❌')) {
    setGhostImg('ghost_trick.png'); playSfx('error_sad.wav');
  } else {
    setGhostImg('ghost_idle.png');
  }

  // Survival UI
  const sv = s.survival || {};
  const usd = Math.round(sv.lastHourVolumeUsd || 0);
  el.goalUsd.textContent = `$${sv.hourlyGoalUsd ?? 0}`;
  el.lastUsd.textContent = `$${usd}`;
  el.survStatus.textContent = sv.lastCheckPassed === null ? '—' : (sv.lastCheckPassed ? '✅ Gehaald' : '❌ Gemist');
  el.survStatus.className = sv.lastCheckPassed ? 'good' : 'bad';
  el.streak.textContent = sv.streak || 0;
  el.hype.textContent = hypeText(sv.streak||0);

  const t = Math.max(0, sv.nextCheckETA || 0);
  const mm = String(Math.floor(t/60)).padStart(2,'0');
  const ss = String(t%60).padStart(2,'0');
  el.countdown.textContent = `${mm}:${ss}`;

  const pct = Math.min(100, Math.round((sv.progress || 0)*100));
  el.progressFill.style.width = pct + '%';
  el.progressLabel.textContent = pct + '%';

  // Near goal glow/pulse + callout
  if (pct >= 80 && pct < 100) {
    el.progressBar.classList.add('glow','pulse');
  } else {
    el.progressBar.classList.remove('glow','pulse');
  }
  if (pct < 50) el.callout.hidden = false; else el.callout.hidden = true;

  // Log (laatste eerst)
  el.logList.innerHTML = '';
  (s.log || []).forEach(item=>{
    const li = document.createElement('li');
    li.textContent = item;
    el.logList.appendChild(li);
  });
});
