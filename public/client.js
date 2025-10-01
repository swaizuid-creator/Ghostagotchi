// =========================================================================
// 1. Element Selection (DOM References)
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
    chatBubble: document.getElementById('chatBubble'), // Maintained for future features
    voteMessage: document.getElementById('voteMessage'),
};

// =========================================================================
// 2. Configuration & Data
// =========================================================================

/** Constant for stat degradation per minute */
const DEGRADATION_AMOUNT = {
    hunger: 2,
    energy: 1,
    happiness: 1,
};

/** Action Configuration: [sfxFile, { stat: change, ... }] */
const ACTION_CONFIG = {
    play: { sfx: 'play_chime.wav', H: 0, E: -15, P: 25 },
    feed: { sfx: 'feed_nom.wav', H: 30, E: 10, P: 0 },
    energy: { sfx: 'feed_nom.wav', H: 30, E: 10, P: 0 }, // Alias for feed
    rest: { sfx: 'sleep_zz.wav', H: 0, E: 30, P: -10 },
    sleep: { sfx: 'sleep_zz.wav', H: 0, E: 30, P: -10 }, // Alias for rest
    gift: { sfx: 'play_chime.wav', H: 5, E: 0, P: 15 },
    trick: { sfx: 'trick_scary.wav', H: 0, E: -5, P: 5 },
    clean: { sfx: 'sfx_clean.wav', H: 0, E: 0, P: 10 },
    cure: { sfx: 'sfx_cure.wav', H: 0, E: 0, P: 15 },
};

// =========================================================================
// 3. Helper Functions (Visuals & Animation)
// =========================================================================

/** Plays a sound effect (simulation) */
function playSfx(filename) {
    // Ensure audio files are correctly located in /public/assets/
    try {
        const audio = new Audio(`/assets/${filename}`);
        audio.play().catch(e => console.warn(`[SFX ERROR] Cannot play ${filename}:`, e));
    } catch (e) {
        console.warn(`[SFX ERROR] Could not create audio object: ${filename}`);
    }
}

/** Sets the ghost sprite image source */
function setGhostImg(filename) {
    if (!el.ghostSprite) return;
    // Ensures the path always starts from the root ('/assets/')
    el.ghostSprite.src = `/assets/${filename}`;
}

/**
 * Generates the correct filename based on the stage and action/mood.
 */
function getSpriteFileName(stage, action, isMood = false) {
    // Normalize stage name (e.g., 'Teenager' -> 'teen')
    const s = (stage || 'Adult').toLowerCase().split(' ')[0];
    const a = action.toLowerCase();

    // 1. CRITICAL, SHARED, OR ODDLY NAMED SPRITES
    if (a === 'rip' || a === 'dying') return 'ghost_rip.png';
    if (a === 'sick') return `ghost_sick.png`;

    // 2. ACTION SPRITES (Temporary sprites: play, feed, rest, gift etc.)
    if (!isMood) {
        if (ACTION_CONFIG[a] || a === 'cure' || a === 'clean') {
            // Stage-specific for Baby/Kid/Teen
            if (s === 'baby' || s === 'kid' || s === 'teen') {
                return `ghost_${s}_${a}.png`;
            }
            // Adult/General: ghost_action.png
            return `ghost_${a}.png`;
        }
    }

    // 3. MOOD SPRITES (IDLE STATE: idle, sad, hungry, etc.)
    if (s === 'baby' || s === 'kid' || s === 'teen') {
        if (a === 'idle') {
            return `${s}_idle.png`; // e.g., baby_idle.png
        }
        // e.g., ghost_teen_sad.png (used for the 'sad' mood)
        return `ghost_${s}_${a}.png`;
    }

    // 4. Fallback/Adult sprites
    if (a === 'idle' || a === 'cheerful') return 'ghost_idle.png';
    return `ghost_${a}.png`; // e.g., ghost_sad.png, ghost_hungry.png
}


/**
 * Executes the visual and audio feedback of an action.
 */
function handleActionVisuals(action) {
    const currentStage = el.ghostStage ? el.ghostStage.textContent : 'Adult';
    const spriteAction = action.toLowerCase().trim();
    const config = ACTION_CONFIG[spriteAction];
    
    // Only execute if it's a known action or 'cure'/'clean'
    if (!config && spriteAction !== 'cure' && spriteAction !== 'clean') return; 

    // 1. Determine Sprite using the helper (non-mood sprite)
    const spriteFile = getSpriteFileName(currentStage, spriteAction, false);
    
    // 2. Determine SFX (use config or fallback for cure/clean)
    const sfxFile = config ? config.sfx : (spriteAction === 'clean' ? 'sfx_clean.wav' : 'sfx_cure.wav');

    setGhostImg(spriteFile);
    playSfx(sfxFile);

    // After 1.5 seconds, return to the base mood
    setTimeout(() => {
        updatePetSim(); 
    }, 1500); 
}


/** Adds a log message to the sidebar */
function addLog(message, type = 'SYSTEM') {
    const li = document.createElement('li');
    // Use 'en-US' locale for international stream
    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    let prefix = `[${timestamp}]`;
    if (type === 'AI') prefix += ' 🧠';
    if (type === 'VOTE') prefix += ' 🗳️';
    if (type === 'CRITICAL') prefix += ' 🚨';
    
    li.innerHTML = `${prefix} ${message}`;
    
    if (el.logList) {
        el.logList.prepend(li);
        // Limit the log list to a maximum of 20 items
        while (el.logList.children.length > 20) {
            el.logList.removeChild(el.logList.lastChild);
        }
    }
}

/** Shows a notification at the bottom of the screen */
function toast(message) {
    if (!el.toast) return;
    // Prevent multiple overlapping toasts
    if (el.toast.classList.contains('show')) return; 
    
    el.toast.textContent = message;
    el.toast.classList.add('show');
    setTimeout(() => {
        el.toast.classList.remove('show');
    }, 2500);
}

/** Animates the progress bar value (progressively) */
function animateProgress(progressElement, targetValue) {
    if (!progressElement) return;
    const startValue = Number(progressElement.value);
    const duration = 300; // ms
    const startTime = performance.now();

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / duration);
        const currentValue = startValue + (targetValue - startValue) * progress;
        
        // Ensure the value stays within [0, 100]
        progressElement.value = Math.max(0, Math.min(100, currentValue));

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}


// =========================================================================
// 4. Stage & Mood Logic (IDLE STATE)
// =========================================================================

/** * Main function to update the Ghostagotchi's mood and base sprite (IDLE state).
 */
function updatePetSim(){
    // SIMULATE STAT DEGRADATION (1x per minute)
    const H = el.hunger;
    const E = el.energy;
    const P = el.happiness;

    // Decrease stats, ensuring a minimum of 0
    animateProgress(H, Math.max(0, (Number(H.value) || 0) - DEGRADATION_AMOUNT.hunger));
    animateProgress(E, Math.max(0, (Number(E.value) || 0) - DEGRADATION_AMOUNT.energy));
    animateProgress(P, Math.max(0, (Number(P.value) || 0) - DEGRADATION_AMOUNT.happiness));

    const ageElement = el.ghostAge;
    if(ageElement) {
        let currentAge = parseFloat(ageElement.textContent) || 0;
        // Age increases by 1/60 (hour per minute)
        ageElement.textContent = (currentAge + 1 / 60).toFixed(2); 
    }

    // SIMULATE MOOD/SPRITE
    const currentHunger = Number(H.value) || 0;
    const currentEnergy = Number(E.value) || 0;
    const currentHappiness = Number(P.value) || 0;
    const currentStage = el.ghostStage ? el.ghostStage.textContent : 'Adult'; 

    let newMood = 'Cheerful';
    let newEmoji = '🙂';
    let newSprite = getSpriteFileName(currentStage, 'idle', true); 

    // 1. Determine the most urgent status (OVERRIDE the IDLE sprite)
    
    // CRITICAL: Dying
    if (currentHunger < 5 || currentEnergy < 5 || (currentStage === 'Adult' && currentHappiness < 5)) {
        newMood = 'Dying'; newEmoji = '💀'; 
        newSprite = getSpriteFileName(currentStage, 'rip');
        if(el.attentionIcon) el.attentionIcon.hidden = false;
        if (el.mood.textContent !== 'Dying') { 
            addLog('Ghost is CRITICALLY low on stats! Survival is at risk.', 'CRITICAL');
        }
    }
    // SICK (example condition)
    else if (currentStage === 'Baby' && currentHunger < 15 || currentStage === 'Teen' && currentEnergy < 15) {
        newMood = 'Sick'; newEmoji = '🤢'; 
        newSprite = getSpriteFileName(currentStage, 'sick', true);
        if(el.attentionIcon) el.attentionIcon.hidden = false;
    }
    // BAD: Hungry
    else if (currentHunger < 30) {
        newMood = 'Hungry'; newEmoji = '😟'; 
        newSprite = getSpriteFileName(currentStage, 'feed', true); // Uses the 'feed' sprite as mood
        if(el.attentionIcon) el.attentionIcon.hidden = false;
    } 
    // BAD: Tired
    else if (currentEnergy < 20) {
        newMood = 'Sleepy'; newEmoji = '😴'; 
        newSprite = getSpriteFileName(currentStage, 'sleep', true); // Uses the 'sleep' sprite as mood
        if(el.attentionIcon) el.attentionIcon.hidden = false;
    } 
    // BAD: Sad/Angry
    else if (currentHappiness < 30) {
        newMood = 'Sad'; newEmoji = '😞'; 
        newSprite = getSpriteFileName(currentStage, 'sad', true);
        if(el.attentionIcon) el.attentionIcon.hidden = false;
    } 
    // GOOD: Playful/Happy
    else if (currentHappiness > 80 && currentEnergy > 50) {
        newMood = 'Playful'; newEmoji = '🥳'; 
        newSprite = getSpriteFileName(currentStage, 'play', true); // Uses the 'play' sprite as mood
        if(el.attentionIcon) el.attentionIcon.hidden = true;
    }
    // Neutral/Good: IDLE
    else {
        newMood = 'Cheerful'; newEmoji = '🙂';
        newSprite = getSpriteFileName(currentStage, 'idle', true);
        if(el.attentionIcon) el.attentionIcon.hidden = true;
    }

    // Update the DOM with the new values
    if(el.mood) el.mood.textContent = newMood;
    if(el.moodEmoji) el.moodEmoji.textContent = newEmoji;
    setGhostImg(newSprite); 
}


/** Simulates an AI action based on needs */
function simulateAIAction() {
    const H = Number(el.hunger.value) || 0;
    const E = Number(el.energy.value) || 0;
    const P = Number(el.happiness.value) || 0;
    
    let action = '';

    // Priority 1: Hunger
    if (H < 30) {
        action = 'feed';
    // Priority 2: Energy
    } else if (E < 30) {
        action = 'rest';
    // Priority 3: Happiness
    } else if (P < 40) {
        action = 'play';
    // RANDOM ACTION
    } else {
        const choices = ['play', 'feed', 'trick', 'clean'];
        action = choices[Math.floor(Math.random() * choices.length)];
    }

    performAction(action, 'AI'); 
    addLog(`AI chose action: ${action.toUpperCase()}`, 'AI');
}

// =========================================================================
// 5. Community Vote Logic
// =========================================================================

let userVoted = false; 

/** Registers the user's vote (simulation) */
function registerVote(action) {
    if (userVoted) return toast('You have already voted this round! Await the result.');

    const actionKey = action.charAt(0).toUpperCase() + action.slice(1);
    const voteElement = el[`votes${actionKey}`];
    
    if (voteElement) {
        voteElement.textContent = Number(voteElement.textContent) + 1;
        
        // Mark the chosen button
        document.querySelector(`.vote-buttons button[data-action="${action}"]`).classList.add('voted-by-me');
        if(el.voteMessage) el.voteMessage.textContent = `You voted for ${action.toUpperCase()}. Waiting for the result.`;
        
        userVoted = true;
        toast('Vote registered! 🗳️');
    }
}

/** Performs the action (Community, AI, or Gift) and adjusts the stats */
function performAction(action, initiator = 'VOTE') {
    const H = el.hunger;
    const E = el.energy;
    const P = el.happiness;
    
    const config = ACTION_CONFIG[action.toLowerCase()];
    
    if (!config && action.toLowerCase() !== 'cure' && action.toLowerCase() !== 'clean') {
        console.error(`Unknown action: ${action}`);
        return;
    }

    // 1. Adjust Visuals/Audio
    handleActionVisuals(action); 

    // 2. Adjust Stats (use config)
    if (config) {
        // animateProgress handles boundary checks (0 and 100)
        if (config.H) animateProgress(H, (Number(H.value) || 0) + config.H);
        if (config.E) animateProgress(E, (Number(E.value) || 0) + config.E);
        if (config.P) animateProgress(P, (Number(P.value) || 0) + config.P);
    } else if (action.toLowerCase() === 'cure') {
        // Manual stat increase for special actions
        animateProgress(P, Math.min(100, (Number(P.value) || 0) + 15));
    } else if (action.toLowerCase() === 'clean') {
        animateProgress(P, Math.min(100, (Number(P.value) || 0) + 10));
    }
    
    // 3. Update Log
    if(el.lastAction) el.lastAction.textContent = `${initiator}: ${action.toUpperCase()}`;
    if(initiator === 'VOTE') addLog(`Community chose: ${action.toUpperCase()}`, 'VOTE');
}


/** Processes the end of a voting round */
function endVoteRound() {
    const votes = {
        play: Number(el.votesPlay.textContent) || 0,
        energy: Number(el.votesEnergy.textContent) || 0,
        rest: Number(el.votesRest.textContent) || 0,
    };

    let winningAction = 'rest';
    let maxVotes = votes.rest;
    let totalVotes = votes.play + votes.energy + votes.rest;

    // Determine the winning action
    if (votes.play > maxVotes) {
        winningAction = 'play';
        maxVotes = votes.play;
    }
    if (votes.energy > maxVotes) {
        winningAction = 'energy';
        maxVotes = votes.energy;
    }

    if (totalVotes === 0) {
        addLog('No votes cast this round. AI takes control.', 'SYSTEM');
        simulateAIAction();
    } else {
        performAction(winningAction, 'VOTE');
    }
    
    // Reset the voting round
    el.votesPlay.textContent = 0;
    el.votesEnergy.textContent = 0;
    el.votesRest.textContent = 0;
    userVoted = false;
    if(el.voteMessage) el.voteMessage.textContent = 'Vote for the next action. You have not voted this round yet.';
    document.querySelectorAll('.vote-buttons button').forEach(btn => {
        btn.classList.remove('voted-by-me');
    });
}


// =========================================================================
// 6. Initialization & Event Handlers
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 🔥 CRITICAL CHECK: Ensure essential elements exist
    if (!el.hunger || !el.energy || !el.happiness || !el.ghostSprite) {
        console.error("Error: Essential DOM elements for the Ghostagotchi (stats/sprite) are missing. Simulation cannot start.");
        return; 
    }

    // Initial call to set the base mood (Uses the value from the HTML)
    updatePetSim(); 
    
    // Start the stat degradation and mood update loop (every 1 minute = 60000ms)
    setInterval(updatePetSim, 60000); 

    // Event Listeners for Community Votes
    if (document.getElementById('votePlay')) document.getElementById('votePlay').addEventListener('click', () => registerVote('play'));
    if (document.getElementById('voteEnergy')) document.getElementById('voteEnergy').addEventListener('click', () => registerVote('energy')); 
    if (document.getElementById('voteRest')) document.getElementById('voteRest').addEventListener('click', () => registerVote('rest'));
    
    // Event Listener for the Gift button
    if (document.getElementById('btn-gift')) {
        document.getElementById('btn-gift').addEventListener('click', (e) => {
            e.preventDefault();
            performAction('gift', 'GIFT');
            toast('🎁 The Ghost is happy with your gift! (Stats +)');
        });
    }

    // Placeholder for CTAs (Share X and Boost Hype)
    if (document.getElementById('btn-share-x')) {
        document.getElementById('btn-share-x').addEventListener('click', (e) => {
            e.preventDefault();
            toast('Share on X is still in development! 📢');
        });
    }
    if (document.getElementById('btn-hype')) {
        document.getElementById('btn-hype').addEventListener('click', (e) => {
            e.preventDefault();
            toast('Boost Hype is still in development! 🚀');
        });
    }


    // Event Listener for the Lore Modal
    const loreBtn = document.getElementById('btn-lore');
    const loreModal = document.getElementById('loreModal');
    const loreCloseBtn = document.getElementById('btn-lore-close');
    
    if(loreBtn && loreModal && loreCloseBtn) {
        loreBtn.addEventListener('click', () => {
            loreModal.hidden = false;
        });
        loreCloseBtn.addEventListener('click', () => {
            loreModal.hidden = true;
        });
    }


    // Simulate an AI action every 5 minutes for variety
    setInterval(simulateAIAction, 300000);

    // Simulate the voting round (2 minutes per round = 120 seconds)
    let voteTime = 120; 
    function updateVoteCountdown() {
        if (voteTime <= 0) {
            endVoteRound();
            voteTime = 120;
        }
        // Use '00' padding for minutes and seconds
        const minutes = Math.floor(voteTime / 60).toString().padStart(2, '0');
        const seconds = (voteTime % 60).toString().padStart(2, '0');
        if (el.voteCountdown) el.voteCountdown.textContent = `${minutes}:${seconds}`;
        voteTime--;
    }
    updateVoteCountdown(); // Call immediately to start
    setInterval(updateVoteCountdown, 1000);
});
