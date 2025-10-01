const socket = io();

/* ====== Set your trade/pair link here ====== */
const TRADE_URL = 'https://pump.fun/<YOUR_TOKEN_OR_LINK>'; // VERVANG DIT!
// Use a SOL address for the 'Gift' button (e.g., a donation address)
const GIFT_ADDRESS = 'solana:3a9PFxBxZU7kB8Sd95gud361t9LecuB54a1VrZjR6JnD'; // VERVANG DIT!
/* =========================================== */

const SHOW_STREAK_TOAST = false; 

// Select all relevant elements.
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

    // NIEUW: Levenscyclus elementen
    ghostStage: document.getElementById('ghostStage'), 
    ghostAge: document.getElementById('ghostAge'),

    // Survival
    goal: document.getElementById('goalUsd'),
    last: document.getElementById('lastUsd'),
    nextPass: document.getElementById('nextPass'),
    nextFail: document.getElementById('nextFail'),
    survStatus: document.getElementById('survStatus'),
    streak: document.getElementById('streak'),
    streakBadge: document.getElementById('streakBadge'),
    hypeValue: document.getElementById('hypeValue'), 
    countdown: document.getElementById('countdown'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    progressLabel: document.getElementById('progressLabel'),

    // NIEUW: VOTE KNOPPEN (Toegevoegd uit de HTML update)
    voteButtons: document.querySelectorAll('.vote-buttons button'),
    voteCountdown: document.getElementById('voteCountdown'),
    votesPlay: document.getElementById('votesPlay'),
    votesEnergy: document.getElementById('votesEnergy'),
    votesRest: document.getElementById('votesRest'),
    voteMessage: document.getElementById('voteMessage'),
    lastVoteAction: document.getElementById('lastVoteAction'),

    // Hype & Community
    hypeFill: document.getElementById('hype-fill'),
    btnLore: document.getElementById('btn-lore'),
    loreModal: document.getElementById('loreModal'),
    btnLoreClose: document.getElementById('btn-lore-close'),

    // Log
    logList: document.getElementById('logList'),

    // Controls
    muteBtn: document.getElementById('muteBtn'),
    vol: document.getElementById('vol'),

    // CTA & callout
    ctaBtn: document.getElementById('ctaBtn'),
    callout: document.getElementById('callout'),
    calloutTrade: document.getElementById('calloutTrade'),

    // Overlays
    confettiLayer: document.getElementById('confettiLayer'),
    toast: document.getElementById('toast'),
    bubble: document.getElementById('chatBubble')
};

// =================================================
//       GLOBALE STATUS & INITIALISATIE
// =================================================

let sfxMuted = false;
let globalVol = 0.4;
let lastLowHealthAt = 0;
let lastPct = 0;
let lastMood = '';

// --- VOTE STATUS ---
let voteCooldown = false;
const VOTE_TIME = 120; // 2 minuten
let currentVotes = { play: 0, energy: 0, rest: 0 };
let currentRound = 1;

// CTA init
if (el.ctaBtn) el.ctaBtn.href = TRADE_URL;
if (el.calloutTrade) el.calloutTrade.href = TRADE_URL;


// =================================================
//       VOTE FUNCTIES (Quick Win 2)
// =================================================

function startVoteTimer() {
    let timeLeft = VOTE_TIME;
    
    const timer = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const seconds = (timeLeft % 60).toString().padStart(2, '0');
        if(el.voteCountdown) el.voteCountdown.textContent = `${minutes}:${seconds}`;

        if (timeLeft <= 0) {
            clearInterval(timer);
            processVotes(); // Evalueer de stemmen
            
            // Nieuwe ronde starten
            currentRound++;
            currentVotes = { play: 0, energy: 0, rest: 0 };
            
            // Reset stemknoppen
            el.voteButtons.forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('voted-by-me');
                document.getElementById(`votes${btn.dataset.action.charAt(0).toUpperCase() + btn.dataset.action.slice(1)}`).textContent = '0';
            });
            
            el.voteMessage.textContent = `Ronde ${currentRound} gestart. Stem nu!`;
            startVoteTimer(); 
        }
    }, 1000);
}

// Event Listeners voor stemknoppen
if(el.voteButtons.length > 0) {
    el.voteButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (voteCooldown) {
                el.voteMessage.textContent = 'Je hebt al gestemd in deze ronde!';
                playSfx('error_sad.wav');
                return;
            }

            const action = this.dataset.action;
            
            // 1. Simuleer stemverhoging (alleen lokaal voor deze MVP)
            currentVotes[action]++;
            document.getElementById(`votes${action.charAt(0).toUpperCase() + action.slice(1)}`).textContent = currentVotes[action];
            
            // 2. Anti-Spam (cooldown)
            voteCooldown = true;
            this.classList.add('voted-by-me');
            el.voteButtons.forEach(btn => btn.disabled = true);
            el.voteMessage.textContent = `Je stem op "${action.toUpperCase()}" is ontvangen! Wacht op de uitslag.`;
            
            // Stuur vote naar (niet-bestaande) server voor toekomstige implementatie:
            // socket.emit('vote', { action: action, round: currentRound }); 
        });
    });
}


function processVotes() {
    let winningAction = 'rest';
    let maxVotes = -1;
    
    // Bepaal de winnende actie
    for (const [action, votes] of Object.entries(currentVotes)) {
        if (votes > maxVotes) {
            maxVotes = votes;
            winningAction = action;
        } else if (votes === maxVotes) {
            // Bij gelijkspel: Geef willekeurig de winst aan de huidige actie of de reeds vastgestelde
            if (Math.random() > 0.5) winningAction = action;
        }
    }
    
    // Voer de winnende actie uit (simulatie van AI-respons)
    const logMsg = `[VOTE] Community koos voor: ${winningAction.toUpperCase()} met ${maxVotes} stemmen.`;
    logAction(logMsg);
    performAction(winningAction);
    
    el.lastVoteAction.textContent = `Laatste actie: ${winningAction.toUpperCase()} (${maxVotes} stemmen)`;
    voteCooldown = false;
}

function performAction(action) {
    const H = el.hunger;
    const E = el.energy;
    const P = el.happiness;
    
    // Speel een geluid af
    playSfx(action === 'play' ? 'play_chime.wav' : 'feed_nom.wav');

    switch (action) {
        case 'play':
            animateProgress(P, Math.min(100, (Number(P.value) || 0) + 25));
            animateProgress(E, Math.max(0, (Number(E.value) || 0) - 15));
            toast('GHOST GOT HAPPY!');
            break;
        case 'energy':
            animateProgress(E, Math.min(100, (Number(E.value) || 0) + 35));
            animateProgress(H, Math.max(0, (Number(H.value) || 0) - 5)); // Maakt beetje hongerig
            toast('GHOST GOT ENERGIZED!');
            break;
        case 'rest':
            animateProgress(E, Math.min(100, (Number(E.value) || 0) + 20));
            animateProgress(P, Math.max(0, (Number(P.value) || 0) - 10)); // Rusten is saai
            toast('GHOST IS RUSTING.');
            break;
    }
    el.lastAction.textContent = `VOTE: ${action.toUpperCase()}`;
}

// =================================================
//       DEBUG / STREAMER CONTROLS (Quick Win 3)
// =================================================

function logAction(msg){
    const li = document.createElement('li');
    li.textContent = decorateLog(msg);
    if(el.logList) el.logList.prepend(li); // Voeg toe aan de bovenkant
}

// Functies voor het streamer debug paneel (in HTML)
function simulateSurvivalPass() {
    if(el.progressFill) el.progressFill.style.width = '100%';
    if(el.progressBar) el.progressBar.classList.remove('critical');
    if(el.progressLabel) el.progressLabel.textContent = '100%';
    if(el.survStatus) { el.survStatus.textContent = '✅ Passed (Manual)'; el.survStatus.className = 'good'; }
    
    // Simulatie van het effect
    animateProgress(el.happiness, Math.min(100, (Number(el.happiness.value) || 0) + 50));
    logAction(`[MANUAL] Survival goal passed ✅`);
    confetti();
    playSfx('play_chime.wav');
}

function simulateSurvivalFail() {
    if(el.progressFill) el.progressFill.style.width = '5%';
    if(el.progressBar) el.progressBar.classList.add('critical');
    if(el.progressLabel) el.progressLabel.textContent = '5%';
    if(el.survStatus) { el.survStatus.textContent = '❌ Missed (Manual)'; el.survStatus.className = 'bad'; }

    // Simulatie van het effect
    animateProgress(el.happiness, Math.max(0, (Number(el.happiness.value) || 0) - 30));
    logAction(`[MANUAL] Survival goal missed ❌`);
    playSfx('error_sad.wav');
}

function setStats(val) {
    animateProgress(el.hunger, val);
    animateProgress(el.energy, val);
    animateProgress(el.happiness, val);
    logAction(`[MANUAL] Stats set to ${val}%`);
}

// Maak de debug functies globaal toegankelijk voor de HTML
window.simulateSurvivalPass = simulateSurvivalPass;
window.simulateSurvivalFail = simulateSurvivalFail;
window.setStats = setStats;

// =================================================
//       SURVIVAL SIMULATIE (Quick Win 4)
// =================================================

let survivalProgress = 50; 

function updateSurvivalMeterSimulation() {
    // Simuleer natuurlijke, willekeurige fluctuatie
    const fluctuation = (Math.random() - 0.5) * 4; // -2 tot +2
    survivalProgress = Math.min(100, Math.max(0, survivalProgress + fluctuation));

    const pct = Math.round(survivalProgress);

    // Pas de visuele weergave aan
    if(el.progressFill) el.progressFill.style.width = pct + '%';
    if(el.progressLabel) el.progressLabel.textContent = pct + '%';
    
    // Visuele waarschuwing (Illusionisme)
    if(el.progressBar) {
        if (pct < 20) {
            el.progressBar.classList.add('critical');
        } else {
            el.progressBar.classList.remove('critical');
        }
    }

    // Callout (Feed Now)
    if(el.callout) el.callout.hidden = !(pct < 50);

    lastPct = pct;
}

// Laat de meter elke 5 seconden bewegen
setInterval(updateSurvivalMeterSimulation, 5000); 

// =================================================
//       LIFE LOOP & PET SIMULATIE (Quick Win 1)
// =================================================

function updatePetSim(){
    // SIMULEER STATS-AFNAME (1x per minuut)
    const H = el.hunger;
    const E = el.energy;
    const P = el.happiness;

    // Trek een klein beetje af van de meters om spanning te creëren.
    animateProgress(H, Math.max(0, (Number(H.value) || 0) - 2));
    animateProgress(E, Math.max(0, (Number(E.value) || 0) - 1));
    animateProgress(P, Math.max(0, (Number(P.value) || 0) - 1));

    // Update de "Age" elke minuut
    const ageElement = el.ghostAge;
    if(ageElement) {
        let currentAge = parseFloat(ageElement.textContent) || 0;
        ageElement.textContent = (currentAge + 1 / 60).toFixed(2); // In uren
    }

    // SIMULEER MOOD/SPRITE & CHAT
    const currentHunger = Number(H.value) || 0;
    const currentEnergy = Number(E.value) || 0;

    let newMood = 'cheerful';
    let newEmoji = '🙂';
    let newSprite = 'ghost_idle.png'; // Dit moet je aanpassen aan je assets

    if (currentHunger < 30) {
        newMood = 'hungry';
        newEmoji = '😟';
        newSprite = 'ghost_sad.png';
        if (el.bubble) showBubble('I feel a strange, cold emptiness...');
    } else if (currentEnergy < 20) {
        newMood = 'sleepy';
        newEmoji = '😴';
        newSprite = 'ghost_sleepy.png';
        if (el.bubble) showBubble('Zzzz... need sleep.');
    } else {
        // Willekeurige bubble
        if (Math.random() < 0.1) showBubble(BUBBLES_BASE[Math.floor(Math.random()*BUBBLES_BASE.length)]);
    }

    if(el.mood) el.mood.textContent = newMood;
    if(el.moodEmoji) el.moodEmoji.textContent = newEmoji;
    setGhostImg(newSprite); 
}

// Voer de simulatie elke 60 seconden uit
setInterval(updatePetSim, 60000);

// =================================================
//       SOCKET & STATE UPDATE (Wordt nu een "Client-Simulatie Updater")
// =================================================

// We laten de socket.on('state') handler HIERONDER grotendeels staan.
// De server kan later de echte "state" sturen en de simulatie uitschakelen, maar voor nu updaten we de UI met de gesimuleerde data.

socket.on('state', (s)=>{
    // In deze MVP, negeer de survival data van de server
    // en gebruik alleen de Log en Hype data, en eventuele toekomstige evolutie data.

    window._latestState = s;
    const p = s.pet || {};
    const sv = s.survival || {};
    const g = s.ghost || {}; 
    
    // Update HYPE METER met echte serverdata (als deze al werkt)
    if(el.hypeFill) el.hypeFill.style.width = (p.hype || 0) + '%';
    if(el.hypeValue) el.hypeValue.textContent = Math.round(p.hype || 0) + '%';

    // Update de Levensfase en Leeftijd met serverdata als die beschikbaar is
    if(el.ghostStage) el.ghostStage.textContent = g.stage || 'Baby';
    if(el.ghostAge) el.ghostAge.textContent = g.ageHours || 0;
    if(el.name) el.name.textContent = `${g.stage || 'Baby'} Ghostagotchi`;
    
    // 4. LOG van de Server
    if(el.logList) {
        el.logList.innerHTML = '';
        (s.log || []).forEach(item=>{
            const li = document.createElement('li');
            li.textContent = decorateLog(item);
            el.logList.appendChild(li);
        });
    }

    // Toasts van server (bijv. voor hype cooldown)
    if (s.serverToast) {
         toast(s.serverToast); 
         playSfx('error_sad.wav');
         s.serverToast = null; // Zorg dat het maar één keer getoond wordt
    }

    // --- Deel van de oorspronkelijke logica overgenomen ---
    // (Deze blijft hier om te reageren op toekomstige serveracties)
    if (s.lastAction !== s.lastAction) {
        if (s.lastAction.includes('survival ✅')) {
            playSfx('play_chime.wav');
            if (Date.now()>confettiLockUntil){ confetti(); confettiLockUntil=Date.now()+5000; }
            highlightCTA();
        }
        else if (s.lastAction.includes('survival ❌')) { playSfx('error_sad.wav'); }
    }
    // Einde overgenomen logica
});


// =================================================
//       MODAL & OVERIGE ONVERANDERDE FUNCTIES
// =================================================

if (el.muteBtn){
    el.muteBtn.addEventListener('click', () => {
        sfxMuted = !sfxMuted;
        el.muteBtn.textContent = sfxMuted ? '🔊 Sound On' : '🔇 Sound Off'; 
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

function setGhostImg(file){ 
    if(el.ghostSprite && el.ghostSprite.src.split('/').pop() !== file) {
        el.ghostSprite.src = 'assets/' + file;
    } 
}

if (el.btnLore) { el.btnLore.addEventListener('click', () => { if(el.loreModal) el.loreModal.hidden = false; }); }
if (el.btnLoreClose) { el.btnLoreClose.addEventListener('click', () => { if(el.loreModal) el.loreModal.hidden = true; }); }

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

function moodEmoji(mood){
    const m = (mood||'').toLowerCase();
    if (m.includes('rested') || m.includes('sleep')) return '😴';
    if (m.includes('play'))   return '😄';
    if (m.includes('spooky')) return '👻';
    if (m.includes('satisfied') || m.includes('cheer') || m.includes('grateful') || m.includes('excited')) return '🙂';
    if (m.includes('sick') || m.includes('sad')) return '😵';
    return '🙂';
}
function animateProgress(elm, to, duration=400){
    if (!elm) return;
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
function decorateLog(text){
    const map = [
        {k:'AI: feed',     r:'🍗  AI: feed'},
        {k:'AI: sleep',    r:'😴  AI: sleep'},
        {k:'AI: play',     r:'🎮  AI: play'},
        {k:'AI: trick',    r:'🎲  AI: trick'},
        {k:'Survival goal passed', r:'✅  Survival goal passed'}, 
        {k:'Survival goal missed',  r:'❌  Survival goal missed'}, 
        {k:'Community hype boost',  r:'🚀  Community hype boost'},
        {k:'Someone gifted SOL',    r:'💎  Someone gifted SOL'},
        {k:'Ghost evolved into',    r:'🎊  Ghost evolved into'},
        {k:'VOTE: play',    r:'⚽️  VOTE: PLAY'},
        {k:'VOTE: energy',  r:'🔋  VOTE: ENERGY'},
        {k:'VOTE: rest',    r:'😴  VOTE: REST'},
        {k:'[VOTE] Community koos voor:', r:'🗳️ Gemeenschap koos:'},
    ];
    let out = text;
    map.forEach(m=>{ if (out.includes(m.k)) out = out.replace(m.k, m.r); });
    return out;
}
function highlightCTA(){
    const b = el.ctaBtn;
    if (!b) return;
    b.classList.add('highlight');
    setTimeout(()=> b.classList.remove('highlight'), 1200);
}

const BUBBLES_BASE = ['Feed meeee 🍗','I feel spooky 👻','Hype train? 🚂','Let’s play! 🎮','Sleepy time… 😴']; 
function showBubble(msg){
    const b = el.bubble;
    if (!b) return;
    b.textContent = msg;
    b.hidden = false;
    setTimeout(()=> b.hidden = true, 2500);
}

// Helpers
const fmtSOL = (x)=> `\u25CE${Number(x).toFixed(3)}`;

// START DE TIMER EN DE SIMULATIE BIJ HET LADEN
window.onload = ()=>{
    startVoteTimer(); 
    updateSurvivalMeterSimulation();
    updatePetSim();
};