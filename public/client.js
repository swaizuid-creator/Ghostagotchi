const socket = io();

/* ====== ⚠️ PAS HIER JOUW LINKS EN ADRES AAN ⚠️ ====== */
const TRADE_URL = 'https://pump.fun/<JOUW_TOKEN_OF_LINK>'; 
// Vervang 3a9PFxBxZU7kB8Sd95gud361t9LecuB54a1VrZjR6Jn3 door JOUW Solana Adres
const GIFT_ADDRESS = 'solana:3a9PFxBxZU7kB8Sd95gud361t9LecuB54a1VrZjR6Jn3?amount=0.5&label=GhostagotchiGift'; 
/* ================================================= */

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

    // Levenscyclus elementen
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

    // VOTE KNOPPEN
    voteButtons: document.querySelectorAll('.vote-buttons button'),
    voteCountdown: document.getElementById('voteCountdown'),
    votesPlay: document.getElementById('votesPlay'),
    votesEnergy: document.getElementById('votesEnergy'),
    votesRest: document.getElementById('votesRest'),
    voteMessage: document.getElementById('voteMessage'),
    lastVoteAction: document.getElementById('lastVoteAction'),

    // Hype & Community
    hypeFill: document.getElementById('hype-fill'),
    btnGift: document.getElementById('btn-gift'),
    btnLore: document.getElementById('btn-lore'),
    btnShareX: document.getElementById('btn-share-x'),
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
//       COMMUNITAIRE KNOPPEN (Gift & Share X)
// =================================================

// Gift Button functionaliteit (Phantom Deep Link)
if (el.btnGift) {
    el.btnGift.addEventListener('click', () => {
        // Opent een deep link naar de Phantom wallet.
        // OPMERKING: Je kunt ook `window.open(GIFT_ADDRESS, "_blank");` gebruiken
        // voor een meer universele deep link, maar Phantom heeft soms hun eigen URI nodig.
        window.open(`https://phantom.app/ul/browse/${GIFT_ADDRESS}`, "_blank");
        socket.emit('gift'); // Signaleer de server
        logAction(`💎 Iemand klikte op "Gift Ghost"!`);
        playSfx('play_chime.wav');
    });
}

// Share on X functionaliteit
if (el.btnShareX) {
    el.btnShareX.addEventListener('click', () => {
        // ⚠️ PAS DEZE TEKST EN LINK AAN NAAR JE EIGEN WEBSITE ⚠️
        const text = encodeURIComponent(`Mijn Ghostagotchi leeft nog! Volg het AI Survival experiment live op [JOUW_WEBSITE_LINK]. Hoe lang overleeft de community de chaos? #Ghostagotchi #SOL #AIsurvival`);
        const url = `https://twitter.com/intent/tweet?text=${text}`;
        window.open(url, '_blank', 'width=600,height=400');
    });
}


// =================================================
//       VOTE FUNCTIES (Anti-Chaos)
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
            processVotes(); 
            
            // Nieuwe ronde starten
            currentRound++;
            currentVotes = { play: 0, energy: 0, rest: 0 };
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
            currentVotes[action]++;
            document.getElementById(`votes${action.charAt(0).toUpperCase() + action.slice(1)}`).textContent = currentVotes[action];
            
            voteCooldown = true;
            this.classList.add('voted-by-me');
            el.voteButtons.forEach(btn => btn.disabled = true);
            el.voteMessage.textContent = `Je stem op "${action.toUpperCase()}" is ontvangen!`;
            
            // In een live omgeving zou je socket.emit gebruiken om de server te laten weten dat er gestemd is:
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
            if (Math.random() > 0.5) winningAction = action; // Willekeurig bij gelijkspel
        }
    }
    
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
    
    playSfx(action === 'play' ? 'play_chime.wav' : 'feed_nom.wav');

    switch (action) {
        case 'play':
            animateProgress(P, Math.min(100, (Number(P.value) || 0) + 25));
            animateProgress(E, Math.max(0, (Number(E.value) || 0) - 15));
            toast('GHOST GOT HAPPY!');
            break;
        case 'energy':
            animateProgress(E, Math.min(100, (Number(E.value) || 0) + 35));
            animateProgress(H, Math.max(0, (Number(H.value) || 0) - 5)); 
            toast('GHOST GOT ENERGIZED!');
            break;
        case 'rest':
            animateProgress(E, Math.min(100, (Number(E.value) || 0) + 20));
            animateProgress(P, Math.max(0, (Number(P.value) || 0) - 10)); 
            toast('GHOST IS RUSTING.');
            break;
    }
    el.lastAction.textContent = `VOTE: ${action.toUpperCase()}`;
}

// =================================================
//       SIMULATIE & UI
// =================================================

let survivalProgress = 50; 

function updateSurvivalMeterSimulation() {
    // Simuleer lichte, willekeurige fluctuatie
    // De AI stuurt deze waarde in de echte live-versie
    const fluctuation = (Math.random() - 0.5) * 4; 
    survivalProgress = Math.min(100, Math.max(0, survivalProgress + fluctuation));

    const pct = Math.round(survivalProgress);

    if(el.progressFill) el.progressFill.style.width = pct + '%';
    if(el.progressLabel) el.progressLabel.textContent = pct + '%';
    
    // Visuele waarschuwing
    if(el.progressBar) {
        if (pct < 20) {
            el.progressBar.classList.add('critical');
            if (el.survStatus) { el.survStatus.textContent = '❌ CRITICAL'; el.survStatus.className = 'bad'; }
        } else if (pct > 90) {
            el.progressBar.classList.remove('critical');
            if (el.survStatus) { el.survStatus.textContent = '✅ SAFE'; el.survStatus.className = 'good'; }
        } else {
            el.progressBar.classList.remove('critical');
            if (el.survStatus) { el.survStatus.textContent = '—'; el.survStatus.className = ''; }
        }
    }

    if(el.callout) el.callout.hidden = !(pct < 50);

    lastPct = pct;
}

function updatePetSim(){
    // SIMULEER STATS-AFNAME (1x per minuut)
    const H = el.hunger;
    const E = el.energy;
    const P = el.happiness;

    // Lichte afname
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
    const currentHappiness = Number(P.value) || 0;

    let newMood = 'rested';
    let newEmoji = '🙂';
    let newSprite = 'ghost_adult.png'; // Gebruik een algemene sprite als default

    // Bepaal de meest urgente status
    if (currentHunger < 30) {
        newMood = 'hungry'; newEmoji = '😟'; newSprite = 'ghost_sad.png';
    } else if (currentEnergy < 20) {
        newMood = 'sleepy'; newEmoji = '😴'; newSprite = 'ghost_sleepy.png';
    } else if (currentHappiness < 30) {
        newMood = 'sad'; newEmoji = '😞'; newSprite = 'ghost_sad.png';
    } 

    if(el.mood) el.mood.textContent = newMood;
    if(el.moodEmoji) el.moodEmoji.textContent = newEmoji;
    setGhostImg(newSprite); 
}

// Laat de meter elke 5 seconden bewegen
setInterval(updateSurvivalMeterSimulation, 5000); 
// Voer de simulatie elke 60 seconden uit
setInterval(updatePetSim, 60000);

// =================================================
//       SOCKET & LOG / OVERIGE FUNCTIES
// =================================================

function logAction(msg){
    const li = document.createElement('li');
    li.textContent = decorateLog(msg);
    if(el.logList) el.logList.prepend(li); 
}

socket.on('state', (s)=>{
    // In deze MVP gebruiken we alleen de Log en Hype data van de server
    window._latestState = s;
    const p = s.pet || {};
    const g = s.ghost || {}; 
    
    // Update HYPE METER met serverdata
    if(el.hypeFill) el.hypeFill.style.width = (p.hype || 0) + '%';
    if(el.hypeValue) el.hypeValue.textContent = Math.round(p.hype || 0) + '%';

    // Update de Levensfase en Leeftijd met serverdata
    if(el.ghostStage) el.ghostStage.textContent = g.stage || 'Baby';
    if(el.ghostAge) el.ghostAge.textContent = g.ageHours || 0;
    if(el.name) el.name.textContent = `${g.stage || 'Baby'} Ghostagotchi`;
    
    // LOG van de Server
    if(el.logList) {
        el.logList.innerHTML = '';
        (s.log || []).forEach(item=>{
            const li = document.createElement('li');
            li.textContent = decorateLog(item);
            el.logList.appendChild(li);
        });
    }

    if (s.serverToast) {
         toast(s.serverToast); 
         playSfx('error_sad.wav');
         s.serverToast = null; 
    }
});


// Onveranderde Helper Functies:
if (el.muteBtn){ el.muteBtn.addEventListener('click', () => { sfxMuted = !sfxMuted; el.muteBtn.textContent = sfxMuted ? '🔊 Sound On' : '🔇 Sound Off'; }); }
if (el.vol){ el.vol.oninput = ()=>{ globalVol = (Number(el.vol.value)||0)/100; }; }
function playSfx(file){
    if (sfxMuted) return;
    const a = new Audio('assets/sfx/' + file);
    a.volume = globalVol;
    a.play().catch(()=>{});
}
function setGhostImg(file){ 
    // Voorkom onnodig laden als de sprite al correct is
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
        {k:'Gift Ghost', r:'💎 Gift Ghost'} 
    ];
    let out = text;
    map.forEach(m=>{ if (out.includes(m.k)) out = out.replace(m.k, m.r); });
    return out;
}
const fmtSOL = (x)=> `\u25CE${Number(x).toFixed(3)}`;

// START DE TIMER EN DE SIMULATIE BIJ HET LADEN
window.onload = ()=>{
    startVoteTimer(); 
    updateSurvivalMeterSimulation();
    updatePetSim();
};