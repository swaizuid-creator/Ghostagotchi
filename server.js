// Ghostagotchi – AI-only Survival (zonder voting) + attention flag
// ✔ Realtime via Socket.IO
// ✔ Survival-check op Dexscreener 1H volume (of DEMO-modus zonder pair)
// ✔ Voortgangsbalk + countdown + event-log
// ✔ Attention: gaat aan bij kritieke stats (voor client-side lowhealth sfx)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

// Dexscreener pair endpoint; leeg = DEMO-modus (random volume)
const DEX_PAIR_URL = process.env.DEX_PAIR_URL || "";

// Survival drempel per uur (USD)
const HOURLY_USD_GOAL = Number(process.env.HOURLY_USD_GOAL || 200);

// Check-interval (minuten). Voor testen 2–5; live 60.
const CHECK_MINUTES = Number(process.env.CHECK_MINUTES || 60);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

// --- STATE ---
const state = {
  pet: {
    name: 'Ghostagotchi',
    mood: 'cheerful',
    hunger: 25,      // 0 = vol, 100 = uitgehongerd
    energy: 80,      // 0 = uitgeput, 100 = uitgerust
    happiness: 70,   // 0 = somber, 100 = blij
    attention: false // true bij kritieke waarden
  },
  tick: 0,
  lastAction: 'idle',
  log: [],

  survival: {
    hourlyGoalUsd: HOURLY_USD_GOAL,
    lastCheckAt: null,
    lastHourVolumeUsd: 0,
    lastCheckPassed: null,
    progress: 0,          // 0..1
    streak: 0,
    nextCheckETA: CHECK_MINUTES * 60 // seconden
  }
};

// --- HELPERS ---
function clamp(n, min=0, max=100){ return Math.max(min, Math.min(max, n)); }
function broadcast(){ io.emit('state', state); }
function addLog(msg){
  const time = new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
  state.log.unshift(`[${time}] ${msg}`);
  if (state.log.length > 30) state.log.pop();
}
function applyMood(action){
  const p = state.pet;
  state.lastAction = action;
  switch(action){
    case 'AI: feed':     p.hunger = clamp(p.hunger - 35); p.happiness = clamp(p.happiness + 10); p.energy = clamp(p.energy + 5); p.mood='satisfied'; break;
    case 'AI: sleep':    p.energy = clamp(p.energy + 35); p.hunger = clamp(p.hunger + 10); p.mood='rested'; break;
    case 'AI: play':     p.happiness = clamp(p.happiness + 25); p.energy = clamp(p.energy - 10); p.hunger = clamp(p.hunger + 10); p.mood='playful'; break;
    case 'AI: trick':    p.happiness = clamp(p.happiness + 8);  p.energy = clamp(p.energy - 5);  p.mood='spooky'; break;
    case 'survival ✅':  p.happiness = clamp(p.happiness + 10); p.energy = clamp(p.energy + 7);   p.mood='cheerful'; break;
    case 'survival ❌':  p.happiness = clamp(p.happiness - 12); p.energy = clamp(p.energy - 12);  p.hunger = clamp(p.hunger + 10); p.mood='spooky'; break;
  }
}

function aiChoose(){
  const { hunger, energy, happiness } = state.pet;
  if (hunger >= 70) return 'AI: feed';
  if (energy <= 30) return 'AI: sleep';
  if (happiness <= 40) return 'AI: play';
  return Math.random() < 0.2 ? 'AI: trick' : 'AI: play';
}

// Dexscreener: 1H volume
async function fetchHourlyVolumeUsd(){
  if (!DEX_PAIR_URL){
    // DEMO: willekeurig volume 0–400
    return Math.floor(Math.random()*401);
  }
  try{
    const res = await fetch(DEX_PAIR_URL, { headers: { 'Accept':'application/json' }});
    const data = await res.json();
    const pair = Array.isArray(data.pairs) ? data.pairs[0] : null;
    if (!pair) return 0;

    // Veelvoorkomende velden bij Dexscreener; kies wat beschikbaar is
    const v = (pair.volume && (Number(pair.volume.h1) || Number(pair.volume['1h']) || 0))
           || Number(pair.h1VolumeUsd || 0) || 0;
    return Number.isFinite(v) ? v : 0;
  }catch(e){
    console.error('Dex API error:', e.message);
    return 0;
  }
}

async function survivalCheck(){
  const usd = await fetchHourlyVolumeUsd();
  const s   = state.survival;

  s.lastHourVolumeUsd = usd;
  s.lastCheckAt = new Date().toISOString();
  s.nextCheckETA = CHECK_MINUTES * 60;
  s.progress = Math.max(0, Math.min(1, usd / s.hourlyGoalUsd));

  const passed = usd >= s.hourlyGoalUsd;
  s.lastCheckPassed = passed;

  if (passed){
    s.streak += 1;
    applyMood('survival ✅');
    addLog(`✅ Survival goal gehaald: $${Math.round(usd)} / $${s.hourlyGoalUsd} (streak ${s.streak})`);
  }else{
    s.streak = 0;
    applyMood('survival ❌');
    addLog(`❌ Survival goal gemist: $${Math.round(usd)} / $${s.hourlyGoalUsd}`);
  }
  broadcast();
}

// Attention flag bepalen
function updateAttentionFlag(){
  const p = state.pet;
  p.attention = (p.hunger >= 80) || (p.energy <= 20) || (p.happiness <= 20);
}

// Countdown elke seconde
setInterval(()=>{
  if (state.survival.nextCheckETA > 0) state.survival.nextCheckETA -= 1;
  broadcast();
}, 1000);

// Eerste check snel, daarna interval
setTimeout(()=>{ survivalCheck(); setInterval(survivalCheck, CHECK_MINUTES*60*1000); }, 10*1000);

// Basis game-loop: veroudering + AI-actie
setInterval(()=>{
  state.tick++;
  const p = state.pet;

  // elke 5s natuurlijke verloop; effectief ~1 min = 12 ticks
  p.hunger = clamp(p.hunger + 3);
  p.energy = clamp(p.energy - 2);
  p.happiness = clamp(p.happiness - 1);

  updateAttentionFlag();

  if (state.tick % 2 === 0){  // elke 10s
    const action = aiChoose();
    applyMood(action);
    addLog(`🤖 ${action}`);
    updateAttentionFlag();
  }
  broadcast();
}, 5000);

// SOCKETS
io.on('connection', (socket)=>{
  socket.emit('state', state);
});

server.listen(PORT, ()=>{
  console.log(`Ghostagotchi live op http://localhost:${PORT}`);
  if (!DEX_PAIR_URL) console.log('DEMOMODUS actief (DEX_PAIR_URL niet gezet).');
});
