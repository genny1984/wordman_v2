/**
 * WORDMAN - MOTORE UNIFICATO ARCADE
 * Integrazione Record Personale, Posizione Globale (Live Rank) e Debug Mode su tutte le modalità
 */

document.addEventListener('DOMContentLoaded', () => {

    if (typeof SCORING !== 'undefined') {
        window.SCORING = SCORING;
    }

    // 1. PARAMETRI DI CONFIGURAZIONE URL
    const params = new URLSearchParams(window.location.search);
    const GAME_MODE = params.get('mode') || 'classic';
    const WORD_LENGTH = parseInt(params.get('len')) || 5; 
    const MAX_ATTEMPTS = 6;

    // Dizionari Fallback di sicurezza
    const EASY_WORDS = (window.EASY_WORDS && window.EASY_WORDS.length > 0) ? window.EASY_WORDS : ["TRENO", "GATTO", "PIZZA", "CORSA", "FUOCO", "MONDO", "TASTO", "LIBRO", "VERDE", "FIORE"];
    const HARD_WORDS = (window.HARD_WORDS && window.HARD_WORDS.length > 0) ? window.HARD_WORDS : ["ALBERO", "LAVORO", "STRADA", "CHIESA", "PIANTO", "SABBIA", "STORIA", "SANGUE"];

    const usedWords = new Set();

    // 2. STATO DEL GIOCO
    let SECRET_WORD = "";
    let currentAttempt = 0; 
    let currentTile = 0;    
    let totalScore = 0;
    let streakCount = 0;
    let isGameOverState = false;

    let timeLeft = 60;
    let timerInterval = null;

    // Gestione Record Personale Locale
    let personalBest = parseInt(localStorage.getItem('wordman_personal_best')) || 0;

    // 3. ELEMENTI DOM
    const board = document.getElementById("game-board");
    const canvas = document.getElementById("hangman");
    const ctx = canvas.getContext("2d");
    const restartBtn = document.getElementById("restart-btn");
    const currentScoreEl = document.getElementById("current-score");
    const currentStreakEl = document.getElementById("current-streak");
    const wordsListEl = document.getElementById("words-list");
    const globalSaveContainer = document.getElementById("global-save-container");
    const messageEl = document.getElementById("message");
    const timerWrapper = document.getElementById("timer-wrapper");
    const timerBar = document.getElementById("timer-bar");
    const timerText = document.getElementById("timer-text");

    // Elementi Statistiche Persistenti in alto
    const topPersonalBestEl = document.getElementById("top-personal-best");
    const topGlobalRankEl = document.getElementById("top-global-rank");

    // Rendering iniziale statistiche personali
    if (topPersonalBestEl) topPersonalBestEl.innerText = personalBest;

    if (GAME_MODE === 'timer') {
        timerWrapper.classList.remove("hidden");
    }

    // Funzione per aggiornare il Rank Mondiale in tempo reale in alto a destra
    async function updateLiveGlobalRank() {
        if (window.ONLINE_LEADERBOARD && typeof window.ONLINE_LEADERBOARD.getLeaderboardData === "function") {
            const data = await window.ONLINE_LEADERBOARD.getLeaderboardData();
            if (data && data.currentUserRow) {
                if (topGlobalRankEl) topGlobalRankEl.innerText = `${data.currentUserRow.rank}°`;
            } else {
                if (topGlobalRankEl) topGlobalRankEl.innerText = "--";
            }
        }
    }

    // Carica il Rank all'avvio della pagina
    updateLiveGlobalRank();

    // 4. TRUCCO MOBILE DEFINITIVO: Input a tutto schermo per prevenire scroll anomali
    const mobileInput = document.createElement("input");
    mobileInput.type = "text";
    mobileInput.setAttribute("inputmode", "text");
    mobileInput.setAttribute("autocomplete", "off");
    mobileInput.setAttribute("autocapitalize", "characters");
    mobileInput.setAttribute("spellcheck", "false");
    
    mobileInput.style.position = "fixed";
    mobileInput.style.top = "0"; 
    mobileInput.style.left = "0";
    mobileInput.style.width = "100vw"; 
    mobileInput.style.height = "100vh";
    mobileInput.style.opacity = "0"; 
    mobileInput.style.fontSize = "16px"; 
    mobileInput.style.zIndex = "-1000";
    mobileInput.style.pointerEvents = "none";
    document.body.appendChild(mobileInput);
    mobileInput.value = "X";

    function focusMobileInput() {
        if (!restartBtn.classList.contains("hidden")) return;
        if (document.activeElement === document.getElementById("leaderboard-username")) return;
        mobileInput.focus({ preventScroll: true });
    }

    document.addEventListener("click", (e) => {
        if (e.target.id === "leaderboard-username" || e.target.id === "btn-submit-global" || e.target.closest("button")) return;
        focusMobileInput();
    });

    mobileInput.addEventListener("input", (e) => {
        if (GAME_MODE === 'timer' && timeLeft <= 0) { mobileInput.value = "X"; return; }
        const val = mobileInput.value;
        if (val.length === 0) {
            if (restartBtn.classList.contains("hidden")) removeLetter();
            mobileInput.value = "X";
        } else if (val.length > 1) {
            const key = val.charAt(1).toUpperCase();
            if (key >= "A" && key <= "Z") addLetter(key);
            mobileInput.value = "X";
        }
    });

    mobileInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            if (!restartBtn.classList.contains("hidden")) restartBtn.click();
            else checkRow();
            e.preventDefault();
        }
    });

    window.addEventListener("keydown", (e) => {
        if (document.activeElement === document.getElementById("leaderboard-username")) return;
        if (e.target === mobileInput) return;
        const key = e.key.toUpperCase();

        if (!restartBtn.classList.contains("hidden")) {
            if (key === "ENTER") restartBtn.click();
            return;
        }
        if (currentAttempt >= MAX_ATTEMPTS || (GAME_MODE === 'timer' && timeLeft <= 0)) return;

        if (key.length === 1 && key >= "A" && key <= "Z") addLetter(key);
        if (key === "BACKSPACE") removeLetter();
        if (key === "ENTER") checkRow();
    });

    // 5. SELEZIONE PAROLA RIGIDA E PREVENTIVA
    function getValidSecretWord() {
        let basePool = (WORD_LENGTH === 5) ? EASY_WORDS : HARD_WORDS;
        let filteredPool = basePool.filter(word => word.trim().length === WORD_LENGTH);

        if (filteredPool.length === 0) {
            return (WORD_LENGTH === 5) ? "TRENO" : "ALBERO"; 
        }

        let availablePool = filteredPool.filter(word => !usedWords.has(word.toUpperCase()));
        if (availablePool.length === 0) {
            usedWords.clear();
            availablePool = filteredPool;
        }

        let chosenWord = availablePool[Math.floor(Math.random() * availablePool.length)].toUpperCase();
        usedWords.add(chosenWord);
        return chosenWord;
    }

    // 6. LOGICA DI INIZIO ROUND
    function startNewRound() {
        SECRET_WORD = getValidSecretWord();
        currentAttempt = 0;
        currentTile = 0;
        showMessage("");
        
        restartBtn.classList.add("hidden");
        globalSaveContainer.classList.add("hidden");

        board.style.setProperty('--cols', WORD_LENGTH);
        board.innerHTML = "";
        for (let i = 0; i < MAX_ATTEMPTS * WORD_LENGTH; i++) {
            const tile = document.createElement("div");
            tile.classList.add("tile");
            tile.setAttribute("id", `tile-${i}`);
            board.appendChild(tile);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(10, 240); ctx.lineTo(150, 240);
        ctx.moveTo(40, 240); ctx.lineTo(40, 20);
        ctx.moveTo(40, 20);  ctx.lineTo(120, 20);
        ctx.moveTo(120, 20); ctx.lineTo(120, 50);
        ctx.stroke();

        if (GAME_MODE === 'timer') startTimer();
        setTimeout(focusMobileInput, 100);
    }

    function addLetter(letter) {
        if (currentTile < WORD_LENGTH) {
            const index = (currentAttempt * WORD_LENGTH) + currentTile;
            const tile = document.getElementById(`tile-${index}`);
            if (tile) {
                tile.innerText = letter;
                currentTile++;
            }
        }
    }

    function removeLetter() {
        if (currentTile > 0) {
            currentTile--;
            const index = (currentAttempt * WORD_LENGTH) + currentTile;
            const tile = document.getElementById(`tile-${index}`);
            if (tile) tile.innerText = "";
        }
    }

    // 7. VERIFICA RIGA CON INTEGRATO SISTEMA DI DEBUG INTERCETTO E RECORD PERSONALE
    function checkRow() {
        // --- FUNZIONE DI DEBUG APPLICATA A TUTTE LE MODALITÀ ---
        let currentTypedString = "";
        const startIndex = currentAttempt * WORD_LENGTH;
        for (let i = 0; i < currentTile; i++) {
            const tile = document.getElementById(`tile-${startIndex + i}`);
            if (tile && tile.innerText) currentTypedString += tile.innerText;
        }
        currentTypedString = currentTypedString.trim().toUpperCase();

        if (currentTypedString === "DEBUG") {
            showMessage(`🔍 [DEBUG] Parola segreta: ${SECRET_WORD}`);
            for (let i = 0; i < currentTile; i++) {
                const tile = document.getElementById(`tile-${startIndex + i}`);
                if (tile) tile.innerText = "";
            }
            currentTile = 0;
            mobileInput.value = "X"; 
            return; 
        }
        // ------------------------------------------------------

        if (currentTile !== WORD_LENGTH) {
            showMessage(`Inserisci ${WORD_LENGTH} lettere!`); 
            return;
        }

        let guess = "";
        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = document.getElementById(`tile-${startIndex + i}`);
            if (tile && tile.innerText) guess += tile.innerText;
        }
        guess = guess.trim().toUpperCase();

        let tileStatuses = new Array(WORD_LENGTH).fill("absent");
        let secretLettersRemaining = SECRET_WORD.split("");

        for (let i = 0; i < WORD_LENGTH; i++) {
            if (guess[i] === SECRET_WORD[i]) {
                tileStatuses[i] = "correct"; 
                secretLettersRemaining[i] = null;
            }
        }
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (tileStatuses[i] === "correct") continue;
            const idx = secretLettersRemaining.indexOf(guess[i]);
            if (idx !== -1) {
                tileStatuses[i] = "present"; 
                secretLettersRemaining[idx] = null;
            }
        }

        // LETTURA DIRETTA DELLA VARIABILE GLOBALE SCORING
        let rowPoints = 0;
        if (typeof SCORING !== "undefined" && typeof SCORING.calculateRowPoints === "function") {
            rowPoints = SCORING.calculateRowPoints(tileStatuses, WORD_LENGTH);
        } else {
            tileStatuses.forEach(s => { 
                if(s === 'correct') rowPoints += 20; 
                if(s === 'present') rowPoints += 10; 
            });
            if (WORD_LENGTH === 6) rowPoints = Math.round(rowPoints * 1.5);
        }
        
        totalScore += rowPoints;

        // Controllo e aggiornamento real-time del Record Personale
        if (totalScore > personalBest) {
            personalBest = totalScore;
            localStorage.setItem('wordman_personal_best', personalBest);
            if (topPersonalBestEl) topPersonalBestEl.innerText = personalBest;
        }

        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = document.getElementById(`tile-${startIndex + i}`);
            if (tile) tile.classList.add(tileStatuses[i]);
        }

        // CASO DI VITTORIA
        if (guess === SECRET_WORD) {
            if (GAME_MODE === 'timer') clearInterval(timerInterval);

            let victoryBonus = 0;
            if (typeof SCORING !== "undefined" && typeof SCORING.calculateVictoryBonus === "function") {
                victoryBonus = SCORING.calculateVictoryBonus(currentAttempt, WORD_LENGTH, (GAME_MODE === 'timer'), timeLeft);
            }
            
            totalScore += victoryBonus;
            streakCount++; 

            // Ricontrollo Record dopo il bonus vittoria
            if (totalScore > personalBest) {
                personalBest = totalScore;
                localStorage.setItem('wordman_personal_best', personalBest);
                if (topPersonalBestEl) topPersonalBestEl.innerText = personalBest;
            }
            
            currentScoreEl.innerText = totalScore;
            currentStreakEl.innerText = streakCount;

            const li = document.createElement("li");
            li.innerHTML = `✔️ <span style="color:#538d4e;">${SECRET_WORD}</span> +${rowPoints + victoryBonus}pt`;
            wordsListEl.prepend(li);

            showMessage(`🎉 ROUND SUPERATO!`);
            isGameOverState = false;
            restartBtn.innerText = "Prossima Parola";
            restartBtn.classList.remove("hidden");
            return;
        }

        drawHangman(currentAttempt);
        currentAttempt++;
        currentTile = 0;

        currentScoreEl.innerText = totalScore;

        if (currentAttempt === MAX_ATTEMPTS) {
            if (GAME_MODE === 'timer') clearInterval(timerInterval);
            showMessage(`💥 FINITO! Era: ${SECRET_WORD}`);
            triggerGameOver();
        }
    }

    function startTimer() {
        clearInterval(timerInterval);
        timeLeft = 60;
        updateTimerUI();
        timerInterval = setInterval(() => {
            if (!restartBtn.classList.contains("hidden")) return clearInterval(timerInterval);
            timeLeft--;
            updateTimerUI();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                showMessage(`⏰ TEMPO SCADUTO! Era: ${SECRET_WORD}`);
                triggerGameOver();
            }
        }, 1000);
    }

    function updateTimerUI() {
        timerText.innerText = `${timeLeft}s`;
        const percentage = (timeLeft / 60) * 100;
        timerBar.style.width = `${percentage}%`;
        if (timeLeft <= 15) timerBar.style.backgroundColor = "#ff4757";
        else if (timeLeft <= 35) timerBar.style.backgroundColor = "#ff9f43";
        else timerBar.style.backgroundColor = "#1dd1a1";
    }

    function triggerGameOver() {
        isGameOverState = true;
        restartBtn.innerText = "Nuova Partita";
        restartBtn.classList.remove("hidden");
        if (totalScore > 0) {
            globalSaveContainer.classList.remove("hidden");
            document.getElementById("leaderboard-username").focus();
        } else {
            resetSessionData();
        }
    }

    function resetSessionData() {
        totalScore = 0; streakCount = 0;
        currentScoreEl.innerText = "0"; currentStreakEl.innerText = "0";
        wordsListEl.innerHTML = "";
        usedWords.clear();
    }

    restartBtn.addEventListener("click", () => {
        if (isGameOverState) resetSessionData();
        startNewRound();
    });

    function drawHangman(step) {
        ctx.strokeStyle = "#ff4757"; ctx.lineWidth = 4; ctx.beginPath();
        switch (step) {
            case 0: ctx.arc(120, 70, 20, 0, Math.PI * 2); break; 
            case 1: ctx.moveTo(120, 90); ctx.lineTo(120, 160); break; 
            case 2: ctx.moveTo(120, 110); ctx.lineTo(90, 130); break; 
            case 3: ctx.moveTo(120, 110); ctx.lineTo(150, 130); break; 
            case 4: ctx.moveTo(120, 160); ctx.lineTo(95, 210); break; 
            case 5: ctx.moveTo(120, 160); ctx.lineTo(145, 210); break; 
        }
        ctx.stroke();
    }

    function showMessage(text) { messageEl.innerText = text; }

    const btnSubmitGlobal = document.getElementById("btn-submit-global");
    if (btnSubmitGlobal) {
        btnSubmitGlobal.addEventListener("click", async () => {
            const username = document.getElementById("leaderboard-username").value.trim().toUpperCase();
            if (!username) return;

            btnSubmitGlobal.innerText = "INVIO...";
            btnSubmitGlobal.disabled = true;

            if (window.ONLINE_LEADERBOARD) {
                const res = await window.ONLINE_LEADERBOARD.submitScore(username, totalScore);
                if (res) {
                    showMessage(`🌍 Record registrato!`);
                    await updateLiveGlobalRank(); // Rinfresca istantaneamente il widget prima del redirect
                    setTimeout(() => { window.location.href = "leaderboard.html"; }, 1200);
                } else {
                    showMessage(`❌ Errore di rete.`);
                    btnSubmitGlobal.innerText = "INVIA RECORD";
                    btnSubmitGlobal.disabled = false;
                }
            }
        });
    }

    startNewRound();
});