// =========================================================================
// 1. Element Selectie (DOM References)
// =========================================================================

const el = {
    // Stats
    hunger: document.getElementById('hunger'),
    energy: document.getElementById('energy'),
    happiness: document.getElementById('happiness'),
    mood: document.getElementById('mood'),
    moodEmoji: document.getElementById('moodEmoji'),
    lastAction: document.getElementById('lastAction'),
    ghostStage: document.getElementById('ghostStage'),
    ghostAge: document.getElementById('ghostAge'),
    ghostSprite: document.getElementById('ghostSprite'),
    attentionIcon: document.getElementById('attentionIcon'),
    // Vote/Community
    votesPlay: document.getElementById('votesPlay'),
    votesEnergy: document.getElementById('votesEnergy'),
    votesRest: document.getElementById('votesRest'),
    voteCountdown: document.getElementById('voteCountdown'),
    // UI
    logList: document.getElementById('logList'),
    toast: document.getElementById('toast'),
    chatBubble: document.getElementById('chatBubble'),
    voteMessage: document.getElementById('voteMessage'), 
};


// =========================================================================
// 2. Helper Functies (Visuals & Animation)
// =========================================================================

/** Speel een geluidseffect (simulatie) */
function playSfx(filename) {
    // In een echte app zou dit een Audio object aanmaken en afspelen
    // console.log(`[SFX] Playing: ${filename}`); 
}

/** Stelt de sprite in */
function setGhostImg(filename) {
    if (!el.ghostSprite) return;
    el.ghostSprite.src = `assets/${filename}`;
}

/**
 * Genereert de correcte bestandsnaam op basis van de stage en actie/mood.
 */
function getSpriteFileName(stage, action, isMood = false) {
    // Normaliseer stage naam (bijv. 'Teenager' -> 'teen')
    const s = stage.toLowerCase().split(' ')[0];

    // 1. KRITIEKE, GEDEELDE OF VREEMD BENOEMDE SPRITES
    if (action === 'rip' || action === 'dying') return 'ghost_rip.png';
    if (s === 'adult' && (action === 'idle' || action === 'cheerful') && isMood) return 'ghost_idle.png';
    if (isMood && action === 'idle') return `${s}_idle.png`; 

    // 2. ACTIE SPRITES (voor handleActionVisuals: TIJDELIJKE SPRITES)
    if (!isMood) {
        if (s === 'adult') {
            // Deze sprites bestaan in je lijst: ghost_play.png, ghost_feed.png, ghost_sleep.png, ghost_trick.png, ghost_clean.png, ghost_cure.png
            return `ghost_${action}.png`; 
        }
        // Baby/Kid/Teen gebruiken de lange naam (ghost_feed_baby.png)
        return `ghost_${action}_${s}.png`; 
    }

    // 3. MOOD SPRITES (voor updatePetSim: IDLE/SAD/HUNGRY/etc.)
    
    // Gebruik de beschikbare bestanden
    if (s === 'baby' && (action === 'angry' || action === 'sick')) return `ghost_${action}_${s}.png`;
    if (s === 'teen' && (action === 'angry' || action === 'sick')) return `ghost_${action}_${s}.png`;
    // Fallback voor overige moods
    return `ghost_${action}.png`; // Vb: ghost_sad.png, ghost_hungry.png (Adult Fallback)
}


/**
 * Voert de visuele en audio feedback van een actie uit.
 * Dit is voor de tijdelijke feedback (1.5 seconde).
 */
function handleActionVisuals(action) {
    const currentStage = (el.ghostStage.textContent || 'Adult').toLowerCase().split(' ')[0];
    let spriteAction = action.toLowerCase().trim();
    let sfxFile = 'default_action.wav';
    
    // 1. Bepaal SFX
    switch (spriteAction) {
        case 'play':
        case 'gift': sfxFile = 'play_chime.wav'; break;
        case 'feed': 
        case 'energy': sfxFile = 'feed_nom.wav'; break; 
        case 'rest': 
        case 'sleep': sfxFile = 'sleep_zz.wav'; break;
        case 'trick': sfxFile = 'trick_scary.wav'; break;
        case 'clean': sfxFile = 'sfx_clean.wav'; break;
        case 'cure': sfxFile = 'sfx_cure.wav'; break;
        default: return; 
    }
    
    // 2. Bepaal Sprite via de helper (niet-mood sprite)
    const spriteFile = getSpriteFileName(currentStage, spriteAction, false);
    
    setGhostImg(spriteFile);
    playSfx(sfxFile);

    // Na 1.5 seconde, keer terug naar de basis-mood
    setTimeout(() => {
        updatePetSim(); 
    }, 1500); 
}


/** Voegt een logbericht toe aan de zijbalk */
function addLog(message, type = 'SYSTEM') {
    const li = document.createElement('li');
    const timestamp = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    let prefix = `[${timestamp}]`;
    if (type === 'AI') prefix += ' 🧠';
    if (type === 'VOTE') prefix += ' 🗳️';
    if (type === 'CRITICAL') prefix += ' 🚨';
    
    li.innerHTML = `${prefix} ${message}`;
    
    if (el.logList) {
        el.logList.prepend(li);
        while (el.logList.children.length > 20) {
            el.logList.removeChild(el.logList.lastChild);
        }
    }
}

/** Toon een melding onderaan het scherm */
function toast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.add('show');
    setTimeout(() => {
        el.toast.classList.remove('show');
    }, 2500);
}

/** Animeer de progress bar waarde (progressief) */
function animateProgress(progressElement, targetValue) {
    if (!progressElement) return;
    const startValue = Number(progressElement.value);
    const duration = 300; // ms
    const startTime = performance.now();

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / duration);
        const currentValue = startValue + (targetValue - startValue) * progress;
        progressElement.value = currentValue;

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}


// =========================================================================
// 3. Stage & Mood Logica (IDLE STATE)
// =========================================================================

/** * Hoofdfunctie om de Ghostagotchi's stemming en basis-sprite (IDLE state) bij te werken.
 * Wordt elke minuut (simulatie) of na een actie aangeroepen.
 */
function updatePetSim(){
    // SIMULEER STATS-AFNAME (1x per minuut)
    const H = el.hunger;
    const E = el.energy;
    const P = el.happiness;

    animateProgress(H, Math.max(0, (Number(H.value) || 0) - 2));
    animateProgress(E, Math.max(0, (Number(E.value) || 0) - 1));
    animateProgress(P, Math.max(0, (Number(P.value) || 0) - 1));

    const ageElement = el.ghostAge;
    if(ageElement) {
        let currentAge = parseFloat(ageElement.textContent) || 0;
        ageElement.textContent = (currentAge + 1 / 60).toFixed(2); 
    }

    // SIMULEER MOOD/SPRITE
    const currentHunger = Number(H.value) || 0;
    const currentEnergy = Number(E.value) || 0;
    const currentHappiness = Number(P.value) || 0;
    const currentStage = el.ghostStage ? el.ghostStage.textContent.toLowerCase().split(' ')[0] : 'adult'; 

    let newMood = 'cheerful';
    let newEmoji = '🙂';
    let newSprite = getSpriteFileName(currentStage, 'idle', true); 

    // 1. Bepaal de meest urgente status (OVERRIDE de IDLE sprite)
    
    // KRITIEK: Dying
    if (currentHunger < 5 || currentEnergy < 5 || (currentStage === 'adult' && currentHappiness < 5)) {
        newMood = 'dying'; newEmoji = '💀'; 
        newSprite = getSpriteFileName(currentStage, 'rip');
        if(el.attentionIcon) el.attentionIcon.hidden = false;
        addLog('Ghost is CRITICALLY low on stats! Survival in gevaar.', 'CRITICAL');
    }
    // ZIEK (Tijdelijke mood voor de demo)
    else if (currentStage === 'baby' && currentHunger < 15 || currentStage === 'teen' && currentEnergy < 15) {
        newMood = 'sick'; newEmoji = '🤢'; 
        newSprite = getSpriteFileName(currentStage, 'sick', true);
    }
    // SLECHT: Honger, Boos, etc.
    else if (currentHunger < 30) {
        newMood = 'hungry'; newEmoji = '😟'; 
        newSprite = getSpriteFileName(currentStage, 'feed', true); 
    } else if (currentEnergy < 20) {
        newMood = 'sleepy'; newEmoji = '😴'; 
        newSprite = getSpriteFileName(currentStage, 'sleepy', true);
    } else if (currentHappiness < 30) {
        newMood = 'sad'; newEmoji = '😞'; 
        newSprite = getSpriteFileName(currentStage, 'sad', true);
    } else if (currentHappiness > 80 && currentEnergy > 50) {
        newMood = 'playful'; newEmoji = '🥳'; 
        newSprite = getSpriteFileName(currentStage, 'play', true); 
    }
    // Neutraal/Goed: Gebruik de IDLE sprite (staat al ingesteld bovenaan)
    else {
        if(el.attentionIcon) el.attentionIcon.hidden = true;
    }

    // Update de DOM met de nieuwe waarden
    if(el.mood) el.mood.textContent = newMood;
    if(el.moodEmoji) el.moodEmoji.textContent = newEmoji;
    setGhostImg(newSprite); 
}


/** * Simuleer een AI-actie op basis van de behoeften (de AI 'kijkt' naar de laagste stat) */
function simulateAIAction() {
    const H = Number(el.hunger.value) || 0;
    const E = Number(el.energy.value) || 0;
    const P = Number(el.happiness.value) || 0;
    
    let action = '';

    if (H < 30) {
        action = 'feed';
    } else if (E < 30) {
        action = 'rest';
    } else if (P < 40) {
        action = 'play';
    } else {
        const choices = ['play', 'feed', 'trick', 'clean'];
        action = choices[Math.floor(Math.random() * choices.length)];
    }

    performAction(action, 'AI'); 
    addLog(`AI started ${action}!`, 'AI');
}

// =========================================================================
// 4. Community Vote Logica
// =========================================================================

let userVoted = false; 

/** Registreert de stem van de gebruiker (simulatie) */
function registerVote(action) {
    if (userVoted) return;

    const voteElement = document.getElementById(`votes${action.charAt(0).toUpperCase() + action.slice(1)}`);
    if (voteElement) {
        voteElement.textContent = Number(voteElement.textContent) + 1;
        
        document.querySelector(`.vote-buttons button[data-action="${action}"]`).classList.add('voted-by-me');
        if(el.voteMessage) el.voteMessage.textContent = `Je hebt gestemd op ${action.toUpperCase()}. Wacht op de uitslag.`;
        
        userVoted = true;
        toast('Stem geregistreerd! 🗳️');
    }
}

/** Voert de actie uit (Community of AI) en past de stats aan */
function performAction(action, initiator = 'VOTE') {
    const H = el.hunger;
    const E = el.energy;
    const P = el.happiness;
    
    // 1. Pas de Visuals/Audio aan
    handleActionVisuals(action); 

    // 2. Pas de Stats aan
    switch (action) {
        case 'play':
            animateProgress(P, Math.min(100, (Number(P.value) || 0) + 25));
            animateProgress(E, Math.max(0, (Number(E.value) || 0) - 15));
            break;
        case 'feed':
        case 'energy': // Community vote 'energy' en AI 'feed'
            animateProgress(H, Math.min(100, (Number(H.value) || 0) + 30));
            animateProgress(E, Math.min(100, (Number(E.value) || 0) + 10)); 
            break;
        case 'rest':
        case 'sleep':
            animateProgress(E, Math.min(100, (Number(E.value) || 0) + 30));
            animateProgress(P, Math.max(0, (Number(P.value) || 0) - 10)); 
            break;
        case 'trick':
            animateProgress(P, Math.min(100, (Number(P.value) || 0) + 5)); 
            animateProgress(E, Math.max(0, (Number(E.value) || 0) - 5)); 
            break;
        case 'clean':
            animateProgress(P, Math.min(100, (Number(P.value) || 0) + 10));
            break;
        case 'cure':
            animateProgress(P, Math.min(100, (Number(P.value) || 0) + 15));
            break;
    }
    
    // 3. Update Log
    el.lastAction.textContent = `${initiator}: ${action.toUpperCase()}`;
    if(initiator === 'VOTE') addLog(`Community koos: ${action.toUpperCase()}`, 'VOTE');
}


/** Verwerkt het einde van een stemronde */
function endVoteRound() {
    const votes = {
        play: Number(el.votesPlay.textContent),
        energy: Number(el.votesEnergy.textContent),
        rest: Number(el.votesRest.textContent),
    };

    let winningAction = 'rest';
    let maxVotes = votes.rest;

    if (votes.play > maxVotes) {
        winningAction = 'play';
        maxVotes = votes.play;
    }
    if (votes.energy > maxVotes) {
        winningAction = 'energy';
        maxVotes = votes.energy;
    }

    if (maxVotes === 0) {
        addLog('Geen stemmen in deze ronde. AI neemt de controle over.', 'SYSTEM');
        simulateAIAction();
    } else {
        performAction(winningAction, 'VOTE');
    }
    
    // Reset de stemronde
    el.votesPlay.textContent = 0;
    el.votesEnergy.textContent = 0;
    el.votesRest.textContent = 0;
    userVoted = false;
    if(el.voteMessage) el.voteMessage.textContent = 'Stem op de volgende actie. Je hebt nog niet gestemd in deze ronde.';
    document.querySelectorAll('.vote-buttons button').forEach(btn => {
        btn.classList.remove('voted-by-me');
    });
}


// =========================================================================
// 5. Initialisatie & Event Handlers
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initial call om de basis-mood in te stellen (Gebruikt de waarde uit de HTML: "Baby")
    updatePetSim(); 
    
    // Start de simulatielus (elke 1 minuut)
    setInterval(updatePetSim, 60000); 

    // Event Listeners voor de Community Votes
    document.getElementById('votePlay').addEventListener('click', () => registerVote('play'));
    document.getElementById('voteEnergy').addEventListener('click', () => registerVote('energy'));
    document.getElementById('voteRest').addEventListener('click', () => registerVote('rest'));
    
    // Event Listener voor de Gift knop
    document.getElementById('btn-gift').addEventListener('click', (e) => {
        e.preventDefault();
        handleActionVisuals('gift');
        animateProgress(el.happiness, Math.min(100, (Number(el.happiness.value) || 0) + 15));
        toast('🎁 De Ghost is blij met je gift!');
    });
    
    // Event Listener voor de Lore Modal
    const loreBtn = document.getElementById('btn-lore');
    const loreModal = document.getElementById('loreModal');
    const loreCloseBtn = document.getElementById('btn-lore-close');
    
    if(loreBtn) loreBtn.addEventListener('click', () => {
        if(loreModal) loreModal.hidden = false;
    });
    if(loreCloseBtn) loreCloseBtn.addEventListener('click', () => {
        if(loreModal) loreModal.hidden = true;
    });

    // Simuleer een AI-actie om de 5 minuten voor variatie
    setInterval(simulateAIAction, 300000);

    // Simuleer de stemronde (2 minuten per ronde)
    let voteTime = 120; 
    function updateVoteCountdown() {
        if (voteTime <= 0) {
            endVoteRound();
            voteTime = 120;
        }
        const minutes = Math.floor(voteTime / 60).toString().padStart(2, '0');
        const seconds = (voteTime % 60).toString().padStart(2, '0');
        if (el.voteCountdown) el.voteCountdown.textContent = `${minutes}:${seconds}`;
        voteTime--;
    }
    updateVoteCountdown(); 
    setInterval(updateVoteCountdown, 1000);
});