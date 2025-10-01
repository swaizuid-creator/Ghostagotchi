// Ghostagotchi – Fused Survival & Schema AI
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// ---- Configuration via Environment Variables ----
const PORT = process.env.PORT || 3000;
const DEX_PAIR_URL = process.env.DEX_PAIR_URL || ""; // e.g., https://api.dexscreener.com/latest/dex/pairs/solana/<pairId>

// ---- Check Interval ----
const CHECK_MINUTES = Number(process.env.CHECK_MINUTES || 60);

// ---- Dynamic Goals (SOL) ----
const GOAL_MODE = (process.env.GOAL_MODE || 'RAMP').toUpperCase(); // "RAMP" or "LADDER"
const GOAL_BASE_SOL = Number(process.env.GOAL_BASE_SOL || 0.10); 
const GOAL_MIN_SOL  = Number(process.env.GOAL_MIN_SOL  || 0.05);
const GOAL_MAX_SOL  = Number(process.env.GOAL_MAX_SOL  || 50);

const GOAL_UP_PCT   = Number(process.env.GOAL_UP_PCT   || 0.15); 
const GOAL_DOWN_PCT = Number(process.env.GOAL_DOWN_PCT || 0.10); 

const LADDER_STR = process.env.GOAL_STEP_SOL_LIST || "0.10,0.15,0.20,0.30,0.45,0.60,0.90,1.30,2.00";
const GOAL_STEPS = LADDER_STR.split(',').map(s=>Number(s.trim())).filter(n=>Number.isFinite(n) && n>0);

// ---- AI Actions & Schema ----
const ACTIONS = {
  sleep: { label: 'sleep', sprite: 'ghost_sleep.png', duration: 180, perSec: { hunger:+0.05, energy:+0.35, happiness:+0.02 } },
  play:  { label: 'play', sprite: 'ghost_play.png', duration: 60,  perSec: { hunger:+0.08, energy:-0.12, happiness:+0.30 } },
  feed:  { label: 'feed', sprite: 'ghost_feed.png', duration: 30,  perSec: { hunger:-0.80, energy:+0.05, happiness:+0.10 } }, // Negative: reduces hunger
  trick: { label: 'trick',sprite: 'ghost_trick.png',duration: 40,  perSec: { hunger:+0.04, energy:-0.06, happiness:+0.22 } },
  rest:  { label: 'rest', sprite: 'ghost_idle.png', duration: 45,  perSec: { hunger:+0.03, energy:+0.12, happiness:+0.05 } }
};
const PLAYLIST = ['sleep','play','feed','trick','play','rest'];
const LOG_MAX = 30; // Max number of log entries
const HYPE_COOLDOWN = 60*5; // 5 minutes

// ---- GHOST LIFECYCLE CONFIGURATION (NEW) ----
// Threshold is the minimum successful hours (ageHours) to reach this stage
// Sensitivity adjusts the rate of stat decay (1.5 = 50% faster decay/more vulnerable)
const GHOST_STAGES = [
    { name: 'Baby',  threshold: 0,     sprite: 'ghost_baby.png',  sensitivity: 1.5 },  // Start
    { name: 'Kid',   threshold: 12,    sprite: 'ghost_kid.png',    sensitivity: 1.2 },  // After 12 successful hours
    { name: 'Teen',  threshold: 48,    sprite: 'ghost_teen.png',   sensitivity: 1.0 },  // After 48 successful hours (2 days)
    { name: 'Adult', threshold: 168,   sprite: 'ghost_adult.png',  sensitivity: 0.8 }  // After 168 successful hours (1 week)
];


// ---- Initialization & Server ----
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

// ---- STATE & AI Schema Variables ----
let nowSec = Math.floor(Date.now()/1000);
let current = null; // Current action
let queue = [];   // Action queue
const hypeMap = new Map(); // Cooldown for hype

const state = {
  pet: { 
    name: 'Ghostagotchi', 
    mood: 'cheerful', 
    hunger: 50, 
    energy: 70, 
    happiness: 80, 
    hype: 50, // Set initial hype higher
    attention: false 
  },
  // GHOST LIFECYCLE STATE (NEW)
  ghost: {
    stage: GHOST_STAGES[0].name,     
    ageHours: 0,      
    baseSprite: GHOST_STAGES[0].sprite,
  },
  tick: 0,
  lastAction: 'idle',
  log: [],
  survival: {
    hourlyGoalSol: GOAL_BASE_SOL,
    lastCheckAt: null,
    lastHourVolumeSol: 0,
    lastCheckPassed: null,
    progress: 0,
    streak: 0,
    nextCheckETA: CHECK_MINUTES * 60,
    goalMode: GOAL_MODE,
    goalIndex: 0,
    nextGoalOnPassSol: null,
    nextGoalOnFailSol: null
  },
  // timeline: [] // REMOVED
};

// ---- Helpers ----
function clamp(n, min=0, max=100){ return Math.max(min, Math.min(max, n)); }
function roundSol(x){ return Math.round(x*1000)/1000; } // 3 decimals
function broadcast(){ 
  // state.timeline = buildPublicTimeline(); // REMOVED
  io.emit('state', state); 
}

function addLog(msg){
  const time = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}); // English time format
  state.log.unshift(`[${time}] ${msg}`);
  if (state.log.length > LOG_MAX) state.log.pop();
}

// Update pet-stats and mood for Survival Checks & Community Events
function applyMood(action){
  const p = state.pet;
  state.lastAction = action;
  switch(action){
    case 'survival ✅':  p.happiness = clamp(p.happiness + 10); p.energy = clamp(p.energy + 7);   p.mood='cheerful'; break;
    case 'survival ❌':  p.happiness = clamp(p.happiness - 12); p.energy = clamp(p.energy - 12);  p.hunger = clamp(p.hunger + 10); p.mood='spooky'; break;
    case 'community 🚀': p.happiness = clamp(p.happiness + 5); p.mood = 'excited'; break;
    case 'community 💎': p.happiness = clamp(p.happiness + 15); p.mood = 'grateful'; break;
  }
}
function updateAttentionFlag(){
  const p = state.pet;
  p.attention = (p.hunger >= 80) || (p.energy <= 20) || (p.happiness <= 20);
}

// ---- AI Schema Logic ----
function buildQueue(minAheadSec = 10*60) {
  const lastEnd = queue.length ? queue[queue.length-1].endAt : (current ? current.endsAt : nowSec);
  let t = lastEnd;
  let i = 0;
  while ((t - nowSec) < minAheadSec) {
    const key = PLAYLIST[i % PLAYLIST.length];
    const dur = ACTIONS[key].duration;
    queue.push({ key, startAt: t, endAt: t+dur });
    t += dur;
    i++;
  }
}

function startAction(key) {
  const def = ACTIONS[key];
  current = { key, startedAt: nowSec, endsAt: nowSec+def.duration };
  state.lastAction = `AI: ${key}`;
  addLog(`🤖 AI started ${def.label}`);
}

function tickStats() {
  if (!current) return;
  
  // Apply STAGE SENSITIVITY (NEW)
  const currentStage = GHOST_STAGES.find(s => s.name === state.ghost.stage) || GHOST_STAGES[0];
  const sensitivity = currentStage.sensitivity;
  const eff = ACTIONS[current.key].perSec;
  
  // Adjust stat changes based on sensitivity factor
  state.pet.hunger    = clamp(state.pet.hunger + (eff.hunger * sensitivity));
  state.pet.energy    = clamp(state.pet.energy + (eff.energy * sensitivity));
  state.pet.happiness = clamp(state.pet.happiness + (eff.happiness * sensitivity));

  // Mood adjustment based on current action
  if (current.key === 'sleep') state.pet.mood = 'rested';
  else if (current.key === 'play') state.pet.mood = 'playful';
  else if (current.key === 'feed') state.pet.mood = 'satisfied';
  else if (current.key === 'trick') state.pet.mood = 'spooky';
  else state.pet.mood = 'chill';
}

function maybeAdvance() {
  if (!current || nowSec < current.endsAt) return;
  addLog(`✅ done: ${ACTIONS[current.key].label}`);
  if (queue.length===0) buildQueue();
  const next = queue.shift();
  startAction(next.key);
}

/* function buildPublicTimeline() {  // REMOVED
  const items = [];
  if (current) items.push({ key: current.key, startAt: current.startedAt, endAt: current.endsAt, now: nowSec });
  queue.slice(0,7).forEach(q=>items.push({ key:q.key,startAt:q.startAt,endAt:q.endAt }));
  return items;
} */

// ---- Dexscreener → 1H volume in SOL ----
async function fetchHourlyVolumeSol(){
  if (!DEX_PAIR_URL){
    // DEMO: 0–2 SOL
    return roundSol(Math.random()*2);
  }
  try{
    const res = await fetch(DEX_PAIR_URL, { headers: { 'Accept':'application/json' }});
    const data = await res.json();
    const pair = Array.isArray(data.pairs) ? data.pairs[0] : null;
    if (!pair) return 0;

    const usdVol =
      (pair.volume && (Number(pair.volume.h1) || Number(pair.volume['1h']) || 0)) ||
      Number(pair.h1VolumeUsd || 0) || 0;

    let solUsd = 0;
    if (pair.quoteToken && (pair.quoteToken.symbol || '').toUpperCase() === 'SOL') {
      solUsd = Number(pair.quoteToken.priceUsd || 0);
    }
    if (!solUsd && Number(pair.priceUsd) && Number(pair.priceNative)) {
      solUsd = Number(pair.priceUsd) / Number(pair.priceNative);
    }

    return solUsd > 0 ? roundSol(usdVol / solUsd) : 0;
  }catch(e){
    console.error('Dex API error:', e.message);
    return 0;
  }
}

// ---- Dynamic Goal Logic ----
function nextGoalAfterPass(curr){
  if (GOAL_MODE === 'LADDER' && GOAL_STEPS.length){
    const s = state.survival;
    const idx = Math.min(s.goalIndex + 1, GOAL_STEPS.length - 1);
    return GOAL_STEPS[idx];
  } else {
    return clamp(roundSol(curr * (1 + GOAL_UP_PCT)), GOAL_MIN_SOL, GOAL_MAX_SOL);
  }
}
function nextGoalAfterFail(curr){
  if (GOAL_MODE === 'LADDER' && GOAL_STEPS.length){
    const s = state.survival;
    const idx = Math.max(s.goalIndex - 1, 0);
    return GOAL_STEPS[idx];
  } else {
    return clamp(roundSol(curr * (1 - GOAL_DOWN_PCT)), GOAL_MIN_SOL, GOAL_MAX_SOL);
  }
}
function commitGoalAfterPass(curr){
  if (GOAL_MODE === 'LADDER' && GOAL_STEPS.length){
    state.survival.goalIndex = Math.min(state.survival.goalIndex + 1, GOAL_STEPS.length - 1);
    return GOAL_STEPS[state.survival.goalIndex];
  } else {
    return clamp(roundSol(curr * (1 + GOAL_UP_PCT)), GOAL_MIN_SOL, GOAL_MAX_SOL);
  }
}
function commitGoalAfterFail(curr){
  if (GOAL_MODE === 'LADDER' && GOAL_STEPS.length){
    state.survival.goalIndex = Math.max(state.survival.goalIndex - 1, 0);
    return GOAL_STEPS[state.survival.goalIndex];
  } else {
    return clamp(roundSol(curr * (1 - GOAL_DOWN_PCT)), GOAL_MIN_SOL, GOAL_MAX_SOL);
  }
}
function refreshPreviews(){
  const s = state.survival;
  s.nextGoalOnPassSol = nextGoalAfterPass(s.hourlyGoalSol);
  s.nextGoalOnFailSol = nextGoalAfterFail(s.hourlyGoalSol);
}

// ---- Survival Check & Lifecycle Update (UPDATED) ----
async function survivalCheck(){
  const s = state.survival;
  const solVol = await fetchHourlyVolumeSol();

  s.lastHourVolumeSol = roundSol(solVol);
  s.lastCheckAt = new Date().toISOString();
  s.nextCheckETA = CHECK_MINUTES * 60;
  s.progress = Math.max(0, Math.min(1, solVol / s.hourlyGoalSol));

  const passed = solVol >= s.hourlyGoalSol;
  s.lastCheckPassed = passed;

  if (passed){
    s.streak += 1;
    state.ghost.ageHours += 1; // INCREASE AGE ON SUCCESS
    applyMood('survival ✅');
    addLog(`✅ Survival goal passed: ${roundSol(solVol)} ◎ / ${s.hourlyGoalSol} ◎ (streak ${s.streak})`);
    s.hourlyGoalSol = commitGoalAfterPass(s.hourlyGoalSol);
  }else{
    s.streak = 0;
    state.ghost.ageHours = Math.max(0, state.ghost.ageHours - 2); // AGE DECREASE ON FAILURE
    applyMood('survival ❌');
    addLog(`❌ Survival goal missed: ${roundSol(solVol)} ◎ / ${s.hourlyGoalSol} ◎`);
    s.hourlyGoalSol = commitGoalAfterFail(s.hourlyGoalSol);
  }
  
  // --- STAGE CHECK LOGIC (NEW) ---
  let currentStage = GHOST_STAGES[0];
  for (const stage of GHOST_STAGES) {
    if (state.ghost.ageHours >= stage.threshold) {
      currentStage = stage;
    }
  }

  if (state.ghost.stage !== currentStage.name) {
    addLog(`🎊 Ghost evolved into ${currentStage.name}!`);
    state.ghost.stage = currentStage.name;
  }
  state.ghost.baseSprite = currentStage.sprite;
  // --- END STAGE CHECK ---

  refreshPreviews();
  broadcast();
}

// ---- INIT ----
// Initialize AI schema
if (!current) { startAction('sleep'); buildQueue(); } 

// Initialize ladder-index (if LADDER mode is chosen)
if (GOAL_MODE === 'LADDER' && GOAL_STEPS.length) {
  const g = state.survival.hourlyGoalSol;
  let idx = 0, bestDiff = Infinity;
  GOAL_STEPS.forEach((v,i) => { const d = Math.abs(v-g); if (d < bestDiff){ bestDiff = d; idx = i; } });
  state.survival.goalIndex = idx;
  state.survival.hourlyGoalSol = GOAL_STEPS[idx];
}
refreshPreviews();


// ---- Main Loop (1 second) ----
setInterval(()=>{
  nowSec = Math.floor(Date.now()/1000);
  
  // 1. AI Schema Tick
  tickStats();
  maybeAdvance();
  buildQueue();

  // 2. Pet Status Updates
  updateAttentionFlag();
  state.tick += 1;

  // 3. Hype Decay (NEW)
  state.pet.hype = clamp(state.pet.hype-0.05, 0, 100); 
  
  // 4. Survival ETA
  if (state.survival.nextCheckETA > 0) state.survival.nextCheckETA -= 1;
  
  broadcast();
}, 1000);

// ---- Survival Timer ----
setTimeout(()=>{ survivalCheck(); setInterval(survivalCheck, CHECK_MINUTES*60*1000); }, 10*1000);

// ---- Sockets & Community Events ----
io.on('connection', (socket)=>{ 
  addLog(`👥 New user joined`);
  socket.emit('state', state); 

  socket.on('hype',()=>{
    const last = hypeMap.get(socket.id)||0;
    if (nowSec-last < HYPE_COOLDOWN) {
      socket.emit('toast','⏳ Wait a bit before boosting again!');
      return;
    }
    hypeMap.set(socket.id, nowSec);
    state.pet.hype = clamp(state.pet.hype+20,0,100);
    applyMood('community 🚀'); 
    addLog(`🚀 Community hype boost! Ghost feels excited!`);
    broadcast();
  });

  socket.on('gift',()=>{
    applyMood('community 💎');
    addLog(`💎 Someone gifted SOL! Ghost feels grateful!`);
    broadcast();
  });
});

server.listen(PORT, ()=>{
  console.log(`Ghostagotchi live on http://localhost:${PORT}`);
  if (!DEX_PAIR_URL) console.log('DEMO MODE active (DEX_PAIR_URL not set).');
});