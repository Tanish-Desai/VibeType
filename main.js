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
    { score: 0, spawnRate: 1500, speed: 0.5 },
    { score: 50, spawnRate: 1400, speed: 0.6 },
    { score: 100, spawnRate: 1300, speed: 0.7 },
    { score: 200, spawnRate: 1200, speed: 0.8 },
    { score: 350, spawnRate: 1100, speed: 1.0 },
    { score: 500, spawnRate: 1000, speed: 1.2 },
    { score: 750, spawnRate: 900, speed: 1.4 },
    { score: 1000, spawnRate: 800, speed: 1.6 }
];

function getDifficulty(currentScore) {
    let tier = DIFFICULTY_CHECKPOINTS[0];
    for (const t of DIFFICULTY_CHECKPOINTS) {
        if (currentScore >= t.score) tier = t;
        else break;
    }
    return tier;
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
    });
});

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function startGame() {
    console.log("Game Started: " + gameMode);
    isPlaying = true;
    score = 0;
    inputBuffer = "";
    words = [];
    lastSpawnTime = 0;
    gameStartTime = performance.now();

    // Stats Reset
    totalKeystrokes = 0;
    correctKeystrokes = 0;
    correctChars = 0;

    // WPM Reset
    activeTypingStartTime = null;
    totalTypingTime = 0;

    // Timer Setup
    if (gameMode === 'time-15') timeRemaining = 15;
    else if (gameMode === 'time-30') timeRemaining = 30;
    else timeRemaining = 0; // Survival

    // Clear existing words
    wordContainer.innerHTML = '';

    // UI Updates
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    liveStats.classList.remove('hidden');

    if (gameMode === 'survival') {
        timerContainer.style.display = 'none';
    } else {
        timerContainer.style.display = 'block';
        timerDisplay.textContent = timeRemaining.toFixed(1);
    }

    updateScore(0);
    updateInputDisplay();
    updateStats();

    // Start Loop
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);

    const stats = calculateStats();

    finalScoreDisplay.textContent = score;
    finalWpmDisplay.textContent = stats.wpm;
    finalAccDisplay.textContent = stats.accuracy + '%';

    gameOverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
    liveStats.classList.add('hidden');
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

    words.push({ id, text, x: gameWidth, y, speed, element });
}

function updateWords(dt) {
    for (let i = words.length - 1; i >= 0; i--) {
        const word = words[i];
        word.x -= word.speed; // Could use dt for smoother movement if needed
        word.element.style.left = `${word.x}px`;

        if (word.x < forbiddenLineX) {
            if (gameMode === 'survival') {
                gameOver();
                return;
            } else {
                // Time Attack: Penalty or just remove?
                // Let's just remove and maybe flash red
                word.element.remove();
                words.splice(i, 1);
                // Optional: Score penalty
                updateScore(Math.max(0, score - 2));
            }
        }
    }
}

function gameLoop(timestamp) {
    if (!isPlaying) return;

    const now = performance.now();
    const dt = now - (lastSpawnTime || now); // Not quite right for dt, but okay for spawn check

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

    // Spawn
    const difficulty = getDifficulty(score);
    if (timestamp - lastSpawnTime > difficulty.spawnRate) {
        spawnWord(timestamp);
        lastSpawnTime = timestamp;
    }

    updateWords();

    // Update Stats periodically (e.g. every 500ms or every frame? Every frame is fine for simple math)
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
        // Word matched - stop timer for this word
        if (activeTypingStartTime !== null) {
            totalTypingTime += performance.now() - activeTypingStartTime;
            activeTypingStartTime = null;
        }

        const word = words[matchIndex];
        correctChars += word.text.length; // Count characters for WPM
        word.element.remove();
        words.splice(matchIndex, 1);
        updateScore(score + 5); // 5 points per word
        inputBuffer = "";
        updateInputDisplay();
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

    // Start timing if not already and starting a new word (or typing first char)
    if (inputBuffer.length === 0 && activeTypingStartTime === null && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        activeTypingStartTime = performance.now();
    }

    if (e.key === 'Backspace') {
        inputBuffer = inputBuffer.slice(0, -1);
        // If buffer empty, stop timing (treat as "between words" waiting)
        if (inputBuffer.length === 0 && activeTypingStartTime !== null) {
             totalTypingTime += performance.now() - activeTypingStartTime;
             activeTypingStartTime = null;
        }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        totalKeystrokes++;
        // Check if this keystroke is correct (part of a valid prefix)
        const potentialBuffer = inputBuffer + e.key;
        const isValidPrefix = words.some(w => w.text.startsWith(potentialBuffer));

        if (isValidPrefix) {
            correctKeystrokes++;
            inputBuffer += e.key;
        } else {
            // Wrong key
            // Optional: Visual feedback for error
        }
    }

    updateInputDisplay();
});
