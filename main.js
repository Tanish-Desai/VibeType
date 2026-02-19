import { wordList } from './wordList.js';
import { MeteorShower } from './background.js';

console.log("VibeType loaded");

// Background
const bgCanvas = document.getElementById('bg-canvas');
const meteorShower = new MeteorShower(bgCanvas);
meteorShower.animate();

// Game Constants
const FORBIDDEN_LINE_PERCENT = 20;
const DIFFICULTY_CHECKPOINTS = [
    { score: 0, spawnRate: 1500, speed: 1.4 },
    { score: 50, spawnRate: 1400, speed: 1.7 },
    { score: 100, spawnRate: 1300, speed: 1.9 },
    { score: 200, spawnRate: 1200, speed: 2.2 },
    { score: 350, spawnRate: 1100, speed: 2.8 },
    { score: 500, spawnRate: 1000, speed: 3.3 },
    { score: 750, spawnRate: 900, speed: 3.9 },
    { score: 1000, spawnRate: 800, speed: 4.4 }
];

function getDifficulty(currentScore) {
    let tier = DIFFICULTY_CHECKPOINTS[0];
    for (const t of DIFFICULTY_CHECKPOINTS) {
        if (currentScore >= t.score) tier = t;
        else break;
    }
    
    // Apply calibration settings
    // velocityMult scales the speed of words
    // accelMult scales the spawn rate (higher acceleration = faster spawns)
    return {
        ...tier,
        speed: tier.speed * velocityMult,
        spawnRate: tier.spawnRate / accelMult
    };
}

// State
let isPlaying = false;
// WPM Tracking
let activeTypingStartTime = null;
let totalTypingTime = 0;
let score = 0;
let words = [];
let inputBuffer = "";
let lastSpawnTime = 0;
let animationFrameId;
let gameStartTime = 0;
let gameMode = 'survival'; // survival, time-15, time-30
let timeRemaining = 0;

// Stats
let totalKeystrokes = 0;
let correctKeystrokes = 0;
let correctChars = 0;

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const liveStats = document.getElementById('live-stats');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const inputDisplay = document.getElementById('input-display');
const scoreDisplay = document.getElementById('score');
const finalScoreDisplay = document.getElementById('final-score');
const finalWpmDisplay = document.getElementById('final-wpm');
const finalAccDisplay = document.getElementById('final-acc');
const wpmDisplay = document.getElementById('wpm-display');
const accDisplay = document.getElementById('acc-display');
const timerDisplay = document.getElementById('timer-display');
const timerContainer = document.getElementById('timer-container');
const wordContainer = document.getElementById('word-container');
const modeBtns = document.querySelectorAll('.mode-btn');
const forbiddenLine = document.getElementById('forbidden-line');
const countdownOverlay = document.getElementById('countdown-overlay');
const menuBtn = document.getElementById('menu-btn');
const subtitle = document.querySelector('.subtitle');

// Leaderboard Elements
const leaderboard = document.getElementById('leaderboard');
const leaderboardList = document.getElementById('leaderboard-list');
const leaderboardMode = document.getElementById('leaderboard-mode');
const gameoverLeaderboardList = document.getElementById('game-over-leaderboard-list'); // Added
const rankContainer = document.getElementById('rank-container');
const finalRank = document.getElementById('final-rank');
const finalPercentile = document.getElementById('final-percentile');
const playerNameInput = document.getElementById('player-name-input');
const resetLeaderboardBtn = document.getElementById('reset-leaderboard-btn');
const gameOverLeaderboard = document.getElementById('game-over-leaderboard');
const gameOverLeaderboardList = document.getElementById('game-over-leaderboard-list');
const saveScoreContainer = document.getElementById('save-score-container');

// Settings Elements
const velocitySlider = document.getElementById('velocity-slider');
const accelSlider = document.getElementById('accel-slider');
const velocityVal = document.getElementById('velocity-val');
const accelVal = document.getElementById('accel-val');

// Settings State
let velocityMult = 1.0;
let accelMult = 1.0;

// Initialize from DOM state
if (velocitySlider) {
    velocityMult = parseFloat(velocitySlider.value);
    document.getElementById('velocity-val').textContent = velocityMult.toFixed(1);
}
if (accelSlider) {
    accelMult = parseFloat(accelSlider.value);
    document.getElementById('accel-val').textContent = accelMult.toFixed(1);
}

// Settings Listeners
velocitySlider.addEventListener('input', (e) => {
    velocityMult = parseFloat(e.target.value);
    velocityVal.textContent = velocityMult.toFixed(1);
});

accelSlider.addEventListener('input', (e) => {
    accelMult = parseFloat(e.target.value);
    accelVal.textContent = accelMult.toFixed(1);
});

const QUOTES = [
    "Type fast, live young.",
    "Words are your weapon.",
    "Speed is key.",
    "Don't let them through.",
    "Flow like water, type like fire.",
    "Keyboard warrior.",
    "Click clack boom.",
    "Finger gymnastics.",
    "Rhythm is everything.",
    "Every keystroke counts.",
    "Unleash the fury.",
    "Stay in the zone."
];

function setRandomQuote() {
    subtitle.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

// Initial Quote
setRandomQuote();

const SCORE_KEY = 'vibetype_scores_v1';

const ScoreManager = {
    getScores(mode) {
        const data = localStorage.getItem(SCORE_KEY);
        if (!data) return [];
        try {
            const parsed = JSON.parse(data);
            return parsed[mode] || [];
        } catch (e) {
            console.error("Error parsing scores:", e);
            return [];
        }
    },

    saveScore(mode, score, wpm, accuracy, name) {
        const data = localStorage.getItem(SCORE_KEY);
        let parsed = {};
        try {
            parsed = data ? JSON.parse(data) : {};
        } catch (e) {
            console.error("Error parsing scores for save, resetting:", e);
            parsed = {};
        }
        
        if (!parsed[mode]) parsed[mode] = [];
        
        const newEntry = {
            id: Date.now() + Math.random(), // Unique ID for finding exact rank
            score,
            wpm,
            accuracy: parseInt(accuracy), // Remove % if passed as string
            name: name || "ANONYMOUS",
            date: Date.now()
        };
        
        parsed[mode].push(newEntry);
        
        // Sort descending by score
        parsed[mode].sort((a, b) => b.score - a.score);
        
        // Keep top 100 locally
        if (parsed[mode].length > 100) {
            parsed[mode] = parsed[mode].slice(0, 100);
        }
        
        try {
            localStorage.setItem(SCORE_KEY, JSON.stringify(parsed));
        } catch (e) {
            console.error("Failed to save score to localStorage:", e);
        }
        
        return this.getRankAndPercentile(mode, newEntry.id);
    },

    resetScores(mode) {
        const data = localStorage.getItem(SCORE_KEY);
        if (!data) return;
        try {
            const parsed = JSON.parse(data);
            if (parsed[mode]) {
                parsed[mode] = [];
                localStorage.setItem(SCORE_KEY, JSON.stringify(parsed));
                this.updateLeaderboardUI(mode);
            }
        } catch (e) {
            console.error("Error resetting scores:", e);
        }
    },

    getRankAndPercentile(mode, entryId) {
        const scores = this.getScores(mode);
        // Scores are sorted desc by default from getScores() logic? No, getScores just returns the array.
        // Wait, saveScore sorts it before saving. So the array in localStorage is sorted.
        // But getScores() returns `parsed[mode]`.
        
        // Find by ID to get exact rank of THIS attempt
        const rank = scores.findIndex(s => s.id === entryId) + 1;
        const currentScore = scores.find(s => s.id === entryId)?.score || 0;
        
        const below = scores.filter(s => s.score < currentScore).length;
        const total = scores.length;

        let percentile = 100;
        if (total > 1) {
            percentile = Math.round((below / (total - 1)) * 100);
        }
        
        return { rank, percentile };
    },

    getHypotheticalRank(mode, score) {
        const scores = this.getScores(mode);
        let rank = 1;
        for (let i = 0; i < scores.length; i++) {
            if (score >= scores[i].score) {
                break;
            }
            rank++;
        }
        
        const below = scores.filter(s => s.score < score).length;
        const total = scores.length + 1;
        
        let percentile = 0;
        if (total > 1) {
            percentile = Math.round((below / (total - 1)) * 100);
        }
        
        return { rank, percentile };
    },

    updateLeaderboardUI(mode) {
        // Main Menu Leaderboard
        this.renderLeaderboard(mode, leaderboardList);
        // Game Over Leaderboard
        this.renderLeaderboard(mode, gameoverLeaderboardList);
    },
    
    renderLeaderboard(mode, listElement) {
        if (!listElement) return;

        const scores = this.getScores(mode); // Show all scores
        
        listElement.innerHTML = scores.map((s, i) => `
            <li>
                <span class="rank">#${i + 1}</span>
                <span class="sc-val">${s.score} <span style="font-size:0.7em; opacity:0.6;">${s.name}</span></span>
                <span class="wpm-val">${s.wpm} WPM</span>
            </li>
        `).join('');
        
        if (scores.length === 0) {
            listElement.innerHTML = `<li style="justify-content:center; color:#555;">No scores yet</li>`;
        }
    }
};

// Initialize Leaderboard
const savedMode = localStorage.getItem('vibetype_last_mode');
if (savedMode && ['survival', 'time-15', 'time-30'].includes(savedMode)) {
    gameMode = savedMode;
    // Update UI buttons
    modeBtns.forEach(btn => {
        if (btn.dataset.mode === gameMode) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}
ScoreManager.updateLeaderboardUI(gameMode);

// Dimensions
let gameWidth = window.innerWidth;
let gameHeight = window.innerHeight;
let forbiddenLineX = gameWidth * (FORBIDDEN_LINE_PERCENT / 100);

// Resize Listener
window.addEventListener('resize', () => {
    gameWidth = window.innerWidth;
    gameHeight = window.innerHeight;
    forbiddenLineX = gameWidth * (FORBIDDEN_LINE_PERCENT / 100);
});

// Mode Selection
modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        gameMode = btn.dataset.mode;
        
        // Save choice
        localStorage.setItem('vibetype_last_mode', gameMode);
        
        // Update leaderboard when mode changes
        ScoreManager.updateLeaderboardUI(gameMode);
    });
});

// Event Listeners
startBtn.addEventListener('click', prepGame);

restartBtn.addEventListener('click', () => {
    commitScore();
    prepGame();
});

menuBtn.addEventListener('click', () => {
    commitScore();
    showMenu();
});

resetLeaderboardBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to reset the leaderboard for this mode?")) {
        ScoreManager.resetScores(gameMode);
    }
});

playerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (pendingStats) {
             commitScore();
             // Do NOT prepGame() here. Stay on screen.
        }
    }
});

function showMenu() {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);
    
    // UI Cleanup
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    leaderboard.classList.remove('hidden'); // Show leaderboard
    
    wordContainer.innerHTML = '';
    inputBuffer = "";
    updateInputDisplay();
    
    // Refresh Leaderboard
    ScoreManager.updateLeaderboardUI(gameMode);

    // Reset Background
    meteorShower.mode = 'menu';
    setRandomQuote();
}

function prepGame() {
    console.log("Game Started: " + gameMode);
    
    // Background Mode
    meteorShower.mode = 'game';
    leaderboard.classList.add('hidden'); // Hide leaderboard
    // Background Mode
    meteorShower.mode = 'game';

    // Reset State
    score = 0;
    inputBuffer = "";
    words = [];
    lastSpawnTime = 0;
    
    // Stats Reset
    totalKeystrokes = 0;
    correctKeystrokes = 0;
    correctChars = 0;
    activeTypingStartTime = null;
    totalTypingTime = 0;

    // Timer Setup
    if (gameMode === 'time-15') timeRemaining = 15;
    else if (gameMode === 'time-30') timeRemaining = 30;
    else timeRemaining = 0;

    // Clear existing words
    wordContainer.innerHTML = '';

    // UI Updates
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    liveStats.classList.remove('hidden');
    countdownOverlay.classList.add('hidden'); // Ensure hidden initially

    updateScore(0);
    updateInputDisplay();
    updateStats();

    if (gameMode === 'survival') {
        inputDisplay.classList.remove('center-large');
        timerContainer.style.display = 'none';
        forbiddenLine.style.display = 'block';
        startGameLoop();
    } else {
        inputDisplay.classList.add('center-large');
        timerContainer.style.display = 'block';
        forbiddenLine.style.display = 'none';
        timerDisplay.textContent = timeRemaining.toFixed(1);
        
        // Fill screen for user to see
        fillScreenWithWords();
        
        // Start Countdown
        startCountdown();
    }
}

function startCountdown() {
    let count = 3;
    countdownOverlay.textContent = count;
    countdownOverlay.classList.remove('hidden');
    
    // Add blur effect to words
    wordContainer.classList.add('blur-effect');
    
    // Ensure we aren't playing yet
    isPlaying = false;

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownOverlay.textContent = count;
        } else {
            clearInterval(interval);
            countdownOverlay.classList.add('hidden');
            // Remove blur effect
            wordContainer.classList.remove('blur-effect');
            startGameLoop();
        }
    }, 1000);
}

function startGameLoop() {
    isPlaying = true;
    gameStartTime = performance.now();
    lastSpawnTime = 0; // Reset for survival spawning logic

    // Start Loop
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(gameLoop);
}

function fillScreenWithWords() {
    const attempts = 150; // Try to place this many words
    const padding = 30; // Min distance between words
    
    // Define scatter area (center 80% of screen)
    const marginX = gameWidth * 0.1;
    const marginY = gameHeight * 0.1;
    const spawnWidth = gameWidth * 0.8;
    const spawnHeight = gameHeight * 0.8;

    // Keep track of words already on screen to ensure uniqueness
    const existingWords = new Set(words.map(w => w.text));

    // Safety break to prevent infinite loops
    let placedCount = 0;

    for (let i = 0; i < attempts; i++) {
        let text;
        let uniqueAttempt = 0;
        
        // Find a unique word
        do {
            text = wordList[Math.floor(Math.random() * wordList.length)];
            uniqueAttempt++;
        } while (existingWords.has(text) && uniqueAttempt < 20);

        if (existingWords.has(text)) continue; // Skip if we couldn't find a unique one
        
        // Approximate size measurement
        const estWidth = text.length * 16; // Approx 16px per char
        const estHeight = 40; // Approx height

        let placed = false;
        
        // Try random positions multiple times for each word
        for (let j = 0; j < 50; j++) {
            // Random position within the smaller scatter area
            const x = Math.random() * (spawnWidth - estWidth) + marginX;
            const y = Math.random() * (spawnHeight - estHeight) + marginY;

            // Check collision with existing words
            let collision = false;
            for (const w of words) {
                // Simple box collision
                if (x < w.x + w.width + padding &&
                    x + estWidth + padding > w.x &&
                    y < w.y + w.height + padding &&
                    y + estHeight + padding > w.y) {
                    collision = true;
                    break;
                }
            }

            if (!collision) {
                createStaticWord(text, x, y, estWidth, estHeight);
                existingWords.add(text);
                placed = true;
                placedCount++;
                break;
            }
        }
    }
}

function createStaticWord(text, x, y, width, height) {
    const id = Date.now() + Math.random();
    const element = document.createElement('div');
    element.classList.add('word');
    element.textContent = text;
    element.style.top = `${y}px`;
    element.style.left = `${x}px`;
    wordContainer.appendChild(element);

    words.push({ id, text, x, y, width, height, speed: 0, element }); // Speed 0 for static
}

let pendingStats = null;

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);

    const stats = calculateStats();
    
    // Store stats for saving later
    pendingStats = {
        score: score,
        wpm: stats.wpm,
        accuracy: stats.accuracy
    };

    // Show Rank based on hypothetical save
    const hyp = ScoreManager.getHypotheticalRank(gameMode, score);
    
    rankContainer.classList.remove('hidden');
    finalRank.textContent = `#${hyp.rank}`;
    finalPercentile.textContent = `${hyp.percentile}%`;
    
    finalScoreDisplay.textContent = score;
    finalWpmDisplay.textContent = stats.wpm;
    finalAccDisplay.textContent = stats.accuracy + '%';

    playerNameInput.value = ''; // Clear input
    playerNameInput.focus();

    gameOverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
    liveStats.classList.add('hidden');
}

function commitScore() {
    if (!pendingStats) return;
    
    // Default name validation
    let name = playerNameInput.value.trim();
    if (!name) name = "ANONYMOUS";
    
    ScoreManager.saveScore(gameMode, pendingStats.score, pendingStats.wpm, pendingStats.accuracy, name);
    ScoreManager.updateLeaderboardUI(gameMode); // Update UI with new score
    
    pendingStats = null; // Clear
}

function calculateStats() {
    let currentSessionTime = 0;
    if (activeTypingStartTime !== null) {
        currentSessionTime = performance.now() - activeTypingStartTime;
    }
    const effectiveTimeMin = (totalTypingTime + currentSessionTime) / 1000 / 60;
    
    const wpm = effectiveTimeMin > 0 ? Math.round((correctChars / 5) / effectiveTimeMin) : 0;
    const accuracy = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 100;
    return { wpm, accuracy };
}

function updateStats() {
    const stats = calculateStats();
    wpmDisplay.textContent = stats.wpm;
    accDisplay.textContent = stats.accuracy + '%';
}

function spawnWord(timestamp) {
    const text = wordList[Math.floor(Math.random() * wordList.length)];
    const id = Date.now() + Math.random();
    const y = Math.random() * (gameHeight - 100) + 50;

    const element = document.createElement('div');
    element.classList.add('word');
    element.textContent = text;
    element.style.top = `${y}px`;
    element.style.left = `${gameWidth}px`;
    wordContainer.appendChild(element);

    const speed = getDifficulty(score).speed;

    // For survival check, we don't strictly need width/height for collision, but consistent data shape helps
    words.push({ id, text, x: gameWidth, y, width: 0, height: 0, speed, element });
}

function updateWords(dt) {
    if (gameMode !== 'survival') return; // Don't move words in Blitz

    for (let i = words.length - 1; i >= 0; i--) {
        const word = words[i];
        word.x -= word.speed; 
        word.element.style.left = `${word.x}px`;

        if (word.x < forbiddenLineX) {
            gameOver();
            return;
        }
    }
}

function gameLoop(timestamp) {
    if (!isPlaying) return;

    const now = performance.now();
    const dt = now - (lastSpawnTime || now); 

    // Timer Logic
    if (gameMode !== 'survival') {
        const elapsed = (now - gameStartTime) / 1000;
        const currentRemaining = Math.max(0, (gameMode === 'time-15' ? 15 : 30) - elapsed);
        timerDisplay.textContent = currentRemaining.toFixed(1);

        if (currentRemaining <= 0) {
            gameOver();
            return;
        }
    }

    // Spawn Logic for Survival
    if (gameMode === 'survival') {
        const difficulty = getDifficulty(score);
        if (timestamp - lastSpawnTime > difficulty.spawnRate) {
            spawnWord(timestamp);
            lastSpawnTime = timestamp;
        }
    }

    updateWords();
    updateStats();

    animationFrameId = requestAnimationFrame(gameLoop);
}

function updateScore(newScore) {
    score = newScore;
    scoreDisplay.textContent = score;
}

function updateInputDisplay() {
    inputDisplay.textContent = inputBuffer;
    checkInputMatch();
}

function checkInputMatch() {
    const matchIndex = words.findIndex(w => w.text === inputBuffer);

    if (matchIndex !== -1) {
        // Word matched
        if (activeTypingStartTime !== null) {
            totalTypingTime += performance.now() - activeTypingStartTime;
            activeTypingStartTime = null;
        }

        const word = words[matchIndex];
        correctChars += word.text.length;
        
        // Destroy animation
        const element = word.element;
        element.classList.add('word-destroy', 'matched'); // Add matched for color
        // Remove from array immediately so it can't be targeted again
        words.splice(matchIndex, 1);
        
        // Remove from DOM after animation
        setTimeout(() => {
            element.remove();
        }, 250);
        
        // Scoring Logic
        let points = 5;
        if (gameMode !== 'survival') {
            // Blitz scoring: Length based + heavy multiplier
            points = word.text.length * 10;
        }
        updateScore(score + points);
        
        inputBuffer = "";
        updateInputDisplay();

        // Refill if empty in Blitz
        if (gameMode !== 'survival' && words.length === 0) {
            fillScreenWithWords();
        }

    } else {
        words.forEach(w => {
            if (w.text.startsWith(inputBuffer) && inputBuffer.length > 0) {
                w.element.classList.add('matched');
                const matchedPart = w.text.substring(0, inputBuffer.length);
                const rest = w.text.substring(inputBuffer.length);
                w.element.innerHTML = `<span class="matched-char">${matchedPart}</span>${rest}`;
            } else {
                w.element.classList.remove('matched');
                w.element.textContent = w.text;
            }
        });
    }
}

window.addEventListener('keydown', (e) => {
    if (!isPlaying) return;

    if (inputBuffer.length === 0 && activeTypingStartTime === null && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        activeTypingStartTime = performance.now();
    }

    if (e.key === 'Backspace') {
        inputBuffer = inputBuffer.slice(0, -1);
        if (inputBuffer.length === 0 && activeTypingStartTime !== null) {
             totalTypingTime += performance.now() - activeTypingStartTime;
             activeTypingStartTime = null;
        }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        totalKeystrokes++;
        const potentialBuffer = inputBuffer + e.key;
        const isValidPrefix = words.some(w => w.text.startsWith(potentialBuffer));

        if (isValidPrefix) {
            correctKeystrokes++;
            inputBuffer += e.key;
        }
    }

    updateInputDisplay();
});
