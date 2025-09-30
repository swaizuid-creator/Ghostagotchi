// Ghostagotchi – AI-only Survival met SOL-gebaseerde doelen + "Next goal" preview
// - 1H volume via Dexscreener
// - Doelen in SOL (niet USD)
// - Dynamische doelen (RAMP of LADDER)
// - Realtime via Socket.IO
// - Vooruitblik: nextGoalOnPassSol / nextGoalOnFailSol

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

// ---- Dexscreener ----
const DEX_PAIR_URL = process.env.DEX_PAIR_URL || ""; // bijv: https://api.dexscreener.com/latest/dex/pairs/solana/<pairId>

// ---- Check interval ----
const CHECK_MINUTES = Number(process.env.CHECK_MINUTES || 60);

// ---- Dynamic goals (SOL) ----
const GOAL_MODE = (process.env.GOAL_MODE || 'RAMP').toUpperCase(); // "RAMP" of "LADDER"

// Basis en grenzen in SOL
const GOAL_BASE_SOL = Number(process.env.GOAL_BASE_SOL || 0.10); // start ~0.1 SOL
const GOAL_MIN_SOL  = Number(process.env.GOAL_MIN_SOL  || 0.05);
const GOAL_MAX_SOL  = Number(process.env.GOAL_MAX_SOL  || 50);

// Ramp parameters
const GOAL_UP_PCT   = Number(process.env.GOAL_UP_PCT   || 0.15); // +15% bij ✅
const GOAL_DOWN_PCT = Number(process.env.GOAL_DOWN_PCT || 0.10); // -10% bij ❌

// Ladder (komma-gescheiden lijst in SOL)
const LADDER_STR = process.env.GOAL_STEP_SOL_LIST || "0.10,0.15,0.20,0.30,0.45,0.60,0.90,1.30,2.00";
const GOAL_STEPS = LADDER_STR.split(',').map(s=>Number(s.trim())).filter(n=>Number.isFinite(n) && n>0);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

// ---- STATE ----
const state = {
  pet: { name: 'Ghostagotchi', mood: 'cheerful', hunger: 25, energy: 80, happiness: 70, attention: false },
  tick: 0,
  lastAction: 'idle',
  log: [],
  survival: {
    hourlyGoalSol: clamp(GOAL_BASE_SOL, GOAL_MIN_SOL, GOAL_MAX_SOL),
    lastCheckAt: null,
    lastHourVolumeSol: 0,
    lastCheckPassed: null,
    progress: 0,
    streak: 0,
    nextCheckETA: CHECK_MINUTES * 60,
    goalMode: GOAL_MODE,
    goalIndex: 0,                    // gebruikt in LADDER
    nextGoalOnPassSol: null,         // preview bij ✅
    nextGoalOnFailSol: null          // preview bij ❌
  }
};

// Initialiseer ladder-index dichtst bij huidige goal + previews
if (GOAL_MODE === 'LADDER' && GOAL_STEPS.length) {
  const g = state.survival.hourlyGoalSol;
  let idx = 0, bestDiff = Infinity;
  GOAL_STEPS.forEach((v,i) => { const d = Math.abs(v-g); if (d < bestDiff){ bestDiff = d; idx = i; } });
  state.survival.goalIndex = idx;
  state.survival.hourlyGoalSol = GOAL_STEPS[idx];
}
refreshPreviews(); // vul nextGoalOnPassSol/FailSol op basis van huidige goal

// ---- Helpers ----
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function roundSol(x){ return Math.round(x*1000)/1000; } // 3 dec.
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
    case 'AI: feed':     p.hunger = clamp(p.hunger - 35, 0, 100); p.happiness = clamp(p.happiness + 10, 0, 100); p.energy = clamp(p.energy + 5, 0, 100); p.mood='satisfied'; break;
    case 'AI: sleep':    p.energy = clamp(p.energy + 35, 0, 100); p.hunger = clamp(p.hunger + 10, 0, 100); p.mood='rested'; break;
    case 'AI: play':     p.happiness = clamp(p.happiness + 25, 0, 100); p.energy = clamp(p.energy - 10, 0, 100); p.hunger = clamp(p.hunger + 10, 0, 100); p.mood='playful'; break;
    case 'AI: trick':    p.happiness = clamp(p.happiness + 8, 0, 100);  p.energy = clamp(p.energy - 5, 0, 100);  p.mood='spooky'; break;
    case 'survival ✅':  p.happiness = clamp(p.happiness + 10, 0, 100); p.energy = clamp(p.energy + 7, 0, 100);   p.mood='cheerful'; break;
    case 'survival ❌':  p.happiness = clamp(p.happiness - 12, 0, 100); p.energy = clamp(p.energy - 12, 0, 100);  p.hunger = clamp(p.hunger + 10, 0, 100); p.mood='spooky'; break;
  }
}
function aiChoose(){
  const { hunger, energy, happiness } = state.pet;
  if (hunger >= 70) return 'AI: feed';
  if (energy <= 30) return 'AI: sleep';
  if (happiness <= 40) return 'AI: play';
  return Math.random() < 0.2 ? 'AI: trick' : 'AI: play';
}
function updateAttentionFlag(){
  const p = state.pet;
  p.attention = (p.hunger >= 80) || (p.energy <= 20) || (p.happiness <= 20);
}

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

// ---- Dynamic goal logic (in SOL) ----
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
    applyMood('survival ✅');
    addLog(`✅ Survival goal gehaald: ${roundSol(solVol)} ◎ / ${s.hourlyGoalSol} ◎ (streak ${s.streak})`);
    s.hourlyGoalSol = commitGoalAfterPass(s.hourlyGoalSol);
  }else{
    s.streak = 0;
    applyMood('survival ❌');
    addLog(`❌ Survival goal gemist: ${roundSol(solVol)} ◎ / ${s.hourlyGoalSol} ◎`);
    s.hourlyGoalSol = commitGoalAfterFail(s.hourlyGoalSol);
  }

  // Na commit: previews voor de komende periode
  refreshPreviews();
  broadcast();
}

// ---- Timers ----
setInterval(()=>{
  if (state.survival.nextCheckETA > 0) state.survival.nextCheckETA -= 1;
  broadcast();
}, 1000);

setTimeout(()=>{ survivalCheck(); setInterval(survivalCheck, CHECK_MINUTES*60*1000); }, 10*1000);

// Natuurlijk AI-tempo + aging
function scheduleAIAction(){
  const delay = 12000 + Math.random()*8000; // 12–20s
  setTimeout(()=>{
    const action = aiChoose();
    applyMood(action);
    addLog(`🤖 ${action}`);
    updateAttentionFlag();
    broadcast();
    scheduleAIAction();
  }, delay);
}
scheduleAIAction();

setInterval(()=>{
  const p = state.pet;
  p.hunger = clamp(p.hunger + 3, 0, 100);
  p.energy = clamp(p.energy - 2, 0, 100);
  p.happiness = clamp(p.happiness - 1, 0, 100);
  updateAttentionFlag();
  broadcast();
}, 5000);

// ---- Sockets ----
io.on('connection', (socket)=>{ socket.emit('state', state); });

server.listen(PORT, ()=>{
  console.log(`Ghostagotchi live op http://localhost:${PORT}`);
  if (!DEX_PAIR_URL) console.log('DEMOMODUS actief (DEX_PAIR_URL niet gezet).');
});
