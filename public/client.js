const socket = io();

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
  progressFill: document.getElementById('progressFill'),
  progressLabel: document.getElementById('progressLabel'),

  logList: document.getElementById('logList'),
  muteBtn: document.getElementById('muteBtn')
};

// ---- AUDIO ----
let sfxMuted = false;
let lastLowHealthAt = 0; // rate-limit voor lowhealth sfx

function playSfx(file){
  if (sfxMuted) return;
  const a = new Audio('assets/sfx/' + file);
  a.volume = 0.4;
  a.play().catch(()=>{});
}

el.muteBtn.addEventListener('click', () => {
  sfxMuted = !sfxMuted;
  el.muteBtn.textContent = sfxMuted ? '🔊 Geluid aan' : '🔇 Geluid uit';
});

// ---- VISUALS ----
function setGhostImg(file){ el.ghostSprite.src = 'assets/' + file; }

function maybePlayLowHealth(){
  const now = Date.now();
  if (now - lastLowHealthAt > 10000) { // max 1x per 10s
    playSfx('lowhealth.wav');
    lastLowHealthAt = now;
  }
}

// ---- STATE UPDATES ----
socket.on('state', (s)=>{
  // Stats en mood
  const p = s.pet;
  el.name.textContent = p.name;
  el.mood.textContent = p.mood;
  el.hunger.value = p.hunger;
  el.energy.value = p.energy;
  el.happiness.value = p.happiness;
  el.lastAction.textContent = s.lastAction;

  // Attention-icoon + lowhealth sfx
  if (p.attention) {
    el.attentionIcon.hidden = false;
    maybePlayLowHealth();
  } else {
    el.attentionIcon.hidden = true;
  }

  // Actie → afbeelding + sfx
  const a = s.lastAction || '';
  if (a.includes('AI: feed')) {
    setGhostImg('ghost_feed.png');
    playSfx('feed_nom.wav');
  } else if (a.includes('AI: sleep')) {
    setGhostImg('ghost_sleep.png');
    playSfx('sleep_snore.wav');
  } else if (a.includes('AI: play')) {
    setGhostImg('ghost_play.png');
    playSfx('play_chime.wav');
  } else if (a.includes('AI: trick')) {
    setGhostImg('ghost_trick.png');
    playSfx('trick_spooky.wav');
  } else if (a.includes('survival ✅')) {
    // laat een vrolijke pose zien (play of idle) en success sfx
    setGhostImg('ghost_play.png');
    playSfx('play_chime.wav'); // alternatief: aparte success-sfx
  } else if (a.includes('survival ❌')) {
    setGhostImg('ghost_trick.png');
    playSfx('error_sad.wav');  // + eventueel lowhealth extra, maar niet dubbel
  } else {
    setGhostImg('ghost_idle.png');
  }

  // Survival UI
  const sv = s.survival || {};
  el.goalUsd.textContent = `$${sv.hourlyGoalUsd ?? 0}`;
  el.lastUsd.textContent = `$${Math.round(sv.lastHourVolumeUsd || 0)}`;
  el.survStatus.textContent = sv.lastCheckPassed === null ? '—' : (sv.lastCheckPassed ? '✅ Gehaald' : '❌ Gemist');
  el.streak.textContent = sv.streak || 0;

  const t = Math.max(0, sv.nextCheckETA || 0);
  const mm = String(Math.floor(t/60)).padStart(2,'0');
  const ss = String(t%60).padStart(2,'0');
  el.countdown.textContent = `${mm}:${ss}`;

  const pct = Math.min(100, Math.round((sv.progress || 0)*100));
  el.progressFill.style.width = pct + '%';
  el.progressLabel.textContent = pct + '%';

  // Log
  el.logList.innerHTML = '';
  (s.log || []).forEach(item=>{
    const li = document.createElement('li');
    li.textContent = item;
    el.logList.appendChild(li);
  });
});
