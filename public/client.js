const socket = io();

/* ====== Zet hier je trade/pair link (SOL/Token) ====== */
const TRADE_URL = 'https://pump.fun/<JOUW_TOKEN_OF_LINK>';
// Gebruik een SOL-adres voor de 'Gift' knop (bijvoorbeeld een donatieadres)
const GIFT_ADDRESS = 'solana:3a9PFxBxZU7kB8Sd95gud361t9LecuB54a1VrZjR6JnD'; 
/* ==================================================== */

const SHOW_STREAK_TOAST = false; // popups uit

// Selecteer alle relevante elementen uit BEIDE HTML-versies
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
    goal: document.getElementById('goalUsd'),
    last: document.getElementById('lastUsd'),
    nextPass: document.getElementById('nextPass'),
    nextFail: document.getElementById('nextFail'),
    survStatus: document.getElementById('survStatus'),
    streak: document.getElementById('streak'),
    streakBadge: document.getElementById('streakBadge'),
    hypeValue: document.getElementById('hypeValue'), // De tekst-waarde
    countdown: document.getElementById('countdown'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    progressLabel: document.getElementById('progressLabel'),

    // NIEUW: Hype, Routine & Community
    hypeFill: document.getElementById('hype-fill'),
    timeline: document.getElementById('timeline'),
    btnHype: document.getElementById('btn-hype'),
    btnGift: document.getElementById('btn-gift'),
    btnLore: document.getElementById('btn-lore'),
    loreModal: document.getElementById('loreModal'),
    btnLoreClose: document.getElementById('btn-lore-close'),

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

// =================================================
//       INITIALISATIE & EVENT HANDLERS
// =================================================

// CTA init
if (el.ctaBtn) el.ctaBtn.href = TRADE_URL;
if (el.calloutTrade) el.calloutTrade.href = TRADE_URL;

// Copy Link
if (el.copyLink){
    el.copyLink.onclick = async ()=>{
        await navigator.clipboard.writeText(TRADE_URL);
        el.copyLink.textContent = 'Gekopieerd ✅';
        setTimeout(()=>el.copyLink.textContent='Kopieer link',1500);
    };
}
// QR Code
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

// Community Buttons (NIEUW)
if (el.btnHype) {
    el.btnHype.addEventListener('click', () => socket.emit('hype'));
}
if (el.btnGift) {
    el.btnGift.addEventListener('click', () => {
        // Opent de Phantom wallet met een pre-filled transactie (0.1 SOL naar GIFT_ADDRESS)
        window.open(`https://phantom.app/ul/browse/${GIFT_ADDRESS}?amount=0.1`, "_blank");
        socket.emit('gift'); // Stuurt signaal naar de server voor state update
    });
}
if (el.btnLore) {
    el.btnLore.addEventListener('click', () => {
        if(el.loreModal) el.loreModal.hidden = false;
    });
}
if (el.btnLoreClose) {
    el.btnLoreClose.addEventListener('click', () => {
        if(el.loreModal) el.loreModal.hidden = true;
    });
}

// =================================================
//       AUDIO & VISUELE HELPERS
// =================================================

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

// VISUAL HELPERS
function setGhostImg(file){ 
    if(el.ghostSprite) el.ghostSprite.src = 'assets/' + file; 
}
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
// Hype tekst is nu gebaseerd op de survival streak
function hypeText(st){ return st>=6?'🔥 INSANE' : st>=3?'🚀 Warm-up+' : st>=1?'⚡ Warm-up' : '–'; }
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
        {k:'Survival goal gehaald', r:'✅  Survival goal gehaald'},
        {k:'Survival goal gemist',  r:'❌  Survival goal gemist'},
        {k:'Community hype boost',  r:'🚀  Community hype boost'},
        {k:'Someone gifted SOL',    r:'💎  Someone gifted SOL'},
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

// Chat bubble (optioneel)
const BUBBLES_BASE = ['Feed meeee 🍗','I feel spooky 👻','Hype train? 🚂','Let’s play! 🎮','Sleepy time… 😴'];
function bubbleMessage(state){
    if (state.pet.hunger >= 80)  return 'So hungry… 🍽️';
    if (state.pet.energy <= 20)  return 'Zzzz… need sleep 😴';
    if (state.pet.happiness <= 25) return 'Need fun! 🎲';
    return BUBBLES_BASE[Math.floor(Math.random()*BUBBLES_BASE.length)];
}
function showBubble(msg){
    const b = el.bubble;
    if (!b) return;
    b.textContent = msg;
    b.hidden = false;
    setTimeout(()=> b.hidden = true, 2500);
}
// Random bubble timer
setInterval(()=>{ if (window._latestState) showBubble(bubbleMessage(window._latestState)); }, 28000 + Math.random()*18000);

// Helpers
const fmtSOL = (x)=> `\u25CE${Number(x).toFixed(3)}`;

// =================================================
//       SOCKET & STATE UPDATE
// =================================================

let lastPct = 0;

socket.on('state', (s)=>{
    window._latestState = s;
    const p = s.pet;
    const sv = s.survival || {};
    
    // 1. PET STATS & HERO
    if(el.name) el.name.textContent = p.name;
    if(el.mood) el.mood.textContent = p.mood;
    if(el.moodEmoji) el.moodEmoji.textContent = moodEmoji(p.mood);
    if(el.lastAction) el.lastAction.textContent = s.lastAction;
    
    animateProgress(el.hunger, p.hunger);
    animateProgress(el.energy, p.energy);
    animateProgress(el.happiness, p.happiness);
    
    // Aandacht & geluid
    if (el.attentionIcon) {
        if (p.attention) { el.attentionIcon.hidden = false; maybePlayLowHealth(); }
        else { el.attentionIcon.hidden = true; }
    }

    // Sprite & SFX
    const a = s.lastAction || '';
    if (a.includes('AI: feed'))      { setGhostImg('ghost_feed.png');  playSfx('feed_nom.wav'); }
    else if (a.includes('AI: sleep')){ setGhostImg('ghost_sleep.png'); playSfx('sleep_snore.wav'); }
    else if (a.includes('AI: play')) { setGhostImg('ghost_play.png');  playSfx('play_chime.wav'); }
    else if (a.includes('AI: trick')){ setGhostImg('ghost_trick.png'); playSfx('trick_spooky.wav'); }
    else if (a.includes('survival ✅')) {
        setGhostImg('ghost_play.png'); playSfx('play_chime.wav');
        if (Date.now()>confettiLockUntil){ confetti(); confettiLockUntil=Date.now()+5000; }
        if (SHOW_STREAK_TOAST) { /* niet tonen */ }
        highlightCTA();
    }
    else if (a.includes('survival ❌')) { setGhostImg('ghost_trick.png'); playSfx('error_sad.wav'); }
    else if (a.includes('community 🚀') || a.includes('community 💎')) { setGhostImg('ghost_play.png'); } // Speel blijde sprite voor community events
    else { setGhostImg('ghost_idle.png'); }


    // 2. SURVIVAL UI
    if(el.goal) el.goal.textContent = fmtSOL(sv.hourlyGoalSol ?? 0);
    if(el.last) el.last.textContent = fmtSOL(Number(sv.lastHourVolumeSol || 0));
    
    if(el.survStatus) {
        el.survStatus.textContent = sv.lastCheckPassed === null ? '—' : (sv.lastCheckPassed ? '✅ Gehaald' : '❌ Gemist');
        el.survStatus.className = sv.lastCheckPassed ? 'good' : 'bad';
    }
    if(el.streak) el.streak.textContent = sv.streak || 0;
    if(el.hype) el.hype.textContent = hypeText(sv.streak||0); // Gebruikt de hype tekst op basis van streak

    if(el.nextPass) el.nextPass.textContent = fmtSOL(sv.nextGoalOnPassSol ?? 0);
    if(el.nextFail) el.nextFail.textContent = fmtSOL(sv.nextGoalOnFailSol ?? 0);

    // Streak badge
    if (el.streakBadge) {
        if (sv.streak >= 1){
            el.streakBadge.hidden = false;
            el.streakBadge.textContent =
                sv.streak >= 6 ? '👑 Streak 6 — INSANE!' :
                sv.streak >= 3 ? '🚀 Streak 3 — Hype mode!' :
                                 '🔥 Streak 1 — we’re alive!';
        } else {
            el.streakBadge.hidden = true;
        }
    }

    // Countdown
    const t = Math.max(0, sv.nextCheckETA || 0);
    const mm = String(Math.floor(t/60)).padStart(2,'0');
    const ss = String(t%60).padStart(2,'0');
    if(el.countdown) el.countdown.textContent = `${mm}:${ss}`;

    // Progress bar
    const pct = Math.min(100, Math.round((sv.progress || 0)*100));
    if(el.progressFill) el.progressFill.style.width = pct + '%';
    if(el.progressLabel) el.progressLabel.textContent = pct + '%';

    if(el.progressBar) {
        if (pct >= 80 && pct < 90)  { el.progressBar.classList.add('glow'); el.progressBar.classList.remove('pulse','pulse-fast'); }
        else if (pct >= 90 && pct < 100) { el.progressBar.classList.add('glow','pulse-fast'); el.progressBar.classList.remove('pulse'); }
        else if (pct === 100)       { el.progressBar.classList.add('glow'); el.progressBar.classList.remove('pulse','pulse-fast'); }
        else                        { el.progressBar.classList.remove('glow','pulse','pulse-fast'); }
    }

    if(el.callout) el.callout.hidden = !(pct < 50);
    if (pct - lastPct >= 10) highlightCTA();
    lastPct = pct;

    // 3. NIEUW: HYPE METER
    if(el.hypeFill) el.hypeFill.style.width = p.hype + '%';
    if(el.hypeValue) el.hypeValue.textContent = Math.round(p.hype) + '%';


    // 4. NIEUW: TIMELINE / ROUTINE
    if(el.timeline) {
        el.timeline.innerHTML = '';
        (s.timeline||[]).forEach((it,idx)=>{
            const li=document.createElement('li');
            li.textContent=(idx===0?'▶ ':'')+it.key;
            el.timeline.appendChild(li);
        });
    }

    // 5. LOG
    if(el.logList) {
        el.logList.innerHTML = '';
        (s.log || []).forEach(item=>{
            const li = document.createElement('li');
            li.textContent = decorateLog(item);
            el.logList.appendChild(li);
        });
    }
});

// Toast van de server (bijv. voor hype cooldown)
socket.on('toast',(msg)=>{
    // Gebruik de meer geavanceerde toast functie
    toast(msg); 
    // Optioneel: speel foutgeluid
    playSfx('error_sad.wav');
});