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
    let currentTileIndex = 0;
    let isGameOver = false;

    // Punteggi sessione continuativa (Arcade Survival)
    let totalScore = parseInt(localStorage.getItem('wordman_total_score')) || 0;
    let currentStreak = parseInt(localStorage.getItem('wordman_current_streak')) || 0;

    // Record personale memorizzato sul browser
    let personalBest = parseInt(localStorage.getItem(`wordman_pb_${GAME_MODE}_${WORD_LENGTH}`)) || 0;

    // Gestione Timer
    let timerInterval = null;
    let timeLeft = 60; 

    // Elementi DOM
    const boardEl = document.getElementById("game-board");
    const messageEl = document.getElementById("message");
    const restartBtn = document.getElementById("restart-btn");
    const currentScoreEl = document.getElementById("current-score");
    const currentStreakEl = document.getElementById("current-streak");
    const wordsListEl = document.getElementById("words-list");
    const keyboardInputTrigger = document.getElementById("keyboard-trigger");
    const timerWrapper = document.getElementById("timer-wrapper");
    const timerTextEl = document.getElementById("timer-text");
    const saveContainer = document.getElementById("global-save-container");

    // Inizializzazione Interfaccia Punteggi
    if (currentScoreEl) currentScoreEl.innerText = totalScore;
    if (currentStreakEl) currentStreakEl.innerText = currentStreak;

    // Mostra Record Personale Storico nel widget se presente
    updatePersonalBestWidget();

    // Avvio del Gioco
    initGame();

    // Sincronizza il Widget della posizione globale dal server Supabase
    updateLiveGlobalRank();

    function initGame() {
        SECRET_WORD = getRandomWord();
        currentAttempt = 0;
        currentTileIndex = 0;
        isGameOver = false;
        if (messageEl) messageEl.innerText = "";
        if (restartBtn) restartBtn.classList.add("hidden");
        if (saveContainer) saveContainer.classList.add("hidden");

        console.log("DEBUG - Parola segreta:", SECRET_WORD);

        // Configurazione griglia dinamica basata sui CSS esistenti
        if (boardEl) {
            boardEl.innerHTML = "";
            boardEl.style.gridTemplateColumns = `repeat(${WORD_LENGTH}, 1fr)`;
            
            for (let i = 0; i < MAX_ATTEMPTS * WORD_LENGTH; i++) {
                const tile = document.createElement("div");
                tile.classList.add("tile");
                boardEl.appendChild(tile);
            }
        }

        resetCanvas();

        // Configurazione Timer basata sulla modalità
        if (GAME_MODE === 'timer') {
            if (timerWrapper) timerWrapper.classList.remove("hidden");
            timeLeft = 60;
            if (timerTextEl) timerTextEl.innerText = timeLeft + "s";
            startTimer();
        } else {
            if (timerWrapper) timerWrapper.classList.add("hidden");
        }

        // Forza il focus per input mobile su schermi touch o click
        focusMobileInput();
    }

    function getRandomWord() {
        const pool = (WORD_LENGTH === 6) ? HARD_WORDS : EASY_WORDS;
        const available = pool.filter(w => !usedWords.has(w));
        
        if (available.length === 0) {
            usedWords.clear(); // Se esaurite, ricomincia il giro
            return pool[Math.floor(Math.random() * pool.length)];
        }
        
        const chosen = available[Math.floor(Math.random() * available.length)];
        usedWords.add(chosen);
        return chosen;
    }

    // --- LOGICA TIMER ---
    function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (isGameOver) {
                clearInterval(timerInterval);
                return;
            }
            timeLeft--;
            if (timerTextEl) timerTextEl.innerText = timeLeft + "s";

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                handleLoss(true); // Perso per tempo scaduto
            }
        }, 1000);
    }

    // --- GESTIONE INPUT (UNIFICATO KEYBOARD/MOBILE) ---
    if (keyboardInputTrigger) {
        keyboardInputTrigger.addEventListener("input", (e) => {
            if (isGameOver) {
                keyboardInputTrigger.value = "";
                return;
            }
            const value = keyboardInputTrigger.value.toUpperCase().replace(/[^A-Z]/g, '');
            syncInputToTiles(value);
        });

        keyboardInputTrigger.addEventListener("keydown", (e) => {
            if (isGameOver) return;
            if (e.key === "Enter") {
                submitGuess();
            }
        });
    }

    function syncInputToTiles(value) {
        const startRowIndex = currentAttempt * WORD_LENGTH;
        const tiles = boardEl.querySelectorAll(".tile");

        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = tiles[startRowIndex + i];
            if (tile) {
                if (i < value.length) {
                    tile.innerText = value[i];
                    tile.setAttribute("data-state", "tbd");
                } else {
                    tile.innerText = "";
                    tile.removeAttribute("data-state");
                }
            }
        }
        currentTileIndex = value.length;
    }

    function focusMobileInput() {
        if (!isGameOver && keyboardInputTrigger) {
            keyboardInputTrigger.focus();
        }
    }

    document.addEventListener("click", (e) => {
        if (e.target.id === "username" || e.target.id === "btn-submit-global" || e.target.closest("button")) return;
        focusMobileInput();
    });

    // --- VERIFICA TENTATIVO ---
    function submitGuess() {
        if (!keyboardInputTrigger) return;
        const guess = keyboardInputTrigger.value.toUpperCase().replace(/[^A-Z]/g, '');

        if (guess.length !== WORD_LENGTH) {
            showMessage(`Inserisci ${WORD_LENGTH} lettere!`);
            return;
        }

        const startRowIndex = currentAttempt * WORD_LENGTH;
        const tiles = boardEl.querySelectorAll(".tile");
        
        let secretLetterCounts = {};
        for (let char of SECRET_WORD) {
            secretLetterCounts[char] = (secretLetterCounts[char] || 0) + 1;
        }

        const rowStatuses = new Array(WORD_LENGTH).fill("absent");

        // 1. Primo Passaggio: Identificazione Verdi (Esatti)
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (guess[i] === SECRET_WORD[i]) {
                rowStatuses[i] = "correct";
                secretLetterCounts[guess[i]]--;
            }
        }

        // 2. Secondo Passaggio: Identificazione Gialli (Presenti)
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (rowStatuses[i] !== "correct") {
                if (secretLetterCounts[guess[i]] && secretLetterCounts[guess[i]] > 0) {
                    rowStatuses[i] = "present";
                    secretLetterCounts[guess[i]]--;
                }
            }
        }

        // Applica animazioni e colori alle caselle
        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = tiles[startRowIndex + i];
            if (tile) {
                tile.setAttribute("data-state", rowStatuses[i]);
            }
        }

        // Calcolo Punti Parziali della riga tramite modulo SCORING
        if (window.SCORING) {
            const rowPoints = window.SCORING.calculateRowPoints(rowStatuses, WORD_LENGTH);
            updateTotalScore(rowPoints);
        }

        // Controllo Esiti del tentativo
        if (guess === SECRET_WORD) {
            handleVictory();
        } else {
            currentAttempt++;
            if (keyboardInputTrigger) keyboardInputTrigger.value = "";
            currentTileIndex = 0;
            
            // Disegna parte dell'impiccato
            drawHangman(currentAttempt);

            if (currentAttempt >= MAX_ATTEMPTS) {
                handleLoss(false);
            }
        }
    }

    // --- GESTIONE VITTORIA E SCONFITTA ---
    function handleVictory() {
        isGameOver = true;
        clearInterval(timerInterval);
        
        currentStreak++;
        localStorage.setItem('wordman_current_streak', currentStreak);
        if (currentStreakEl) currentStreakEl.innerText = currentStreak;

        let bonus = 40;
        if (window.SCORING) {
            bonus = window.SCORING.calculateVictoryBonus(currentAttempt, WORD_LENGTH, (GAME_MODE === 'timer'), timeLeft);
        }
        updateTotalScore(bonus);

        showMessage(`🎉 CORRETTO! +${bonus} Punti Bonus!`);
        appendWordToCalderone(SECRET_WORD, true);

        // Verifica ed Aggiorna Record Personale
        checkAndSavePersonalBest();

        if (restartBtn) {
            restartBtn.innerText = "Continua Streak";
            restartBtn.classList.remove("hidden");
        }
    }

    function handleLoss(isTimeOut = false) {
        isGameOver = true;
        clearInterval(timerInterval);

        if (isTimeOut) {
            showMessage(`⏰ TEMPO SCADUTO! La parola era: ${SECRET_WORD}`);
            drawHangman(6); // Completa l'impiccato per timeout
        } else {
            showMessage(`💥 GAME OVER! La parola era: ${SECRET_WORD}`);
        }

        appendWordToCalderone(SECRET_WORD, false);

        // Verifica Record Personale finale
        checkAndSavePersonalBest();

        // Resetta lo streak locale della sessione per la prossima partita
        currentStreak = 0;
        localStorage.setItem('wordman_current_streak', 0);
        if (currentStreakEl) currentStreakEl.innerText = "0";

        // Cancella i punteggi cumulativi accumulati finora
        localStorage.removeItem('wordman_total_score');

        // Mostra il modulo per salvare il record globale su internet
        if (saveContainer && totalScore > 0) {
            saveContainer.classList.remove("hidden");
        }

        if (restartBtn) {
            restartBtn.innerText = "Ricomincia da 0";
            restartBtn.classList.remove("hidden");
        }
    }

    // Al click sul pulsante Continua / Riavvia
    if (restartBtn) {
        restartBtn.addEventListener("click", () => {
            if (currentStreak === 0) {
                totalScore = 0;
                if (currentScoreEl) currentScoreEl.innerText = "0";
                if (wordsListEl) wordsListEl.innerHTML = "";
            }
            if (keyboardInputTrigger) keyboardInputTrigger.value = "";
            initGame();
        });
    }

    // --- HELPER FUNZIONALI ---
    function updateTotalScore(amount) {
        totalScore += amount;
        localStorage.setItem('wordman_total_score', totalScore);
        if (currentScoreEl) currentScoreEl.innerText = totalScore;
    }

    function appendWordToCalderone(word, isSuccess) {
        if (!wordsListEl) return;
        const li = document.createElement("li");
        li.style.color = isSuccess ? "#538d4e" : "#ff4757";
        li.style.fontWeight = "bold";
        li.innerText = `${isSuccess ? '🧪' : '💀'} ${word} (${GAME_MODE.toUpperCase()} - ${WORD_LENGTH}L)`;
        wordsListEl.appendChild(li);
    }

    function checkAndSavePersonalBest() {
        if (totalScore > personalBest) {
            personalBest = totalScore;
            localStorage.setItem(`wordman_pb_${GAME_MODE}_${WORD_LENGTH}`, personalBest);
            updatePersonalBestWidget();
            console.log(`Nuovo PB Locale salvato per ${GAME_MODE} ${WORD_LENGTH}L: ${personalBest}`);
        }
    }

    function updatePersonalBestWidget() {
        const pbValEl = document.getElementById("pb-value");
        if (pbValEl) {
            pbValEl.innerText = personalBest;
        }
    }

    async function updateLiveGlobalRank() {
        const rankWidget = document.getElementById("live-rank-value");
        if (!rankWidget || !window.ONLINE_LEADERBOARD) return;

        const data = await window.ONLINE_LEADERBOARD.getTopRecords();
        if (data && data.currentUserRow) {
            rankWidget.innerText = `${data.currentUserRow.rank}° nel Mondo`;
        } else {
            rankWidget.innerText = "Nessun Record";
        }
    }

    // --- SALVATAGGIO CLASSIFICA ONLINE (VERSIONE ROBUSTA SENZA BLOCCHI) ---
    const btnSubmitGlobal = document.getElementById("btn-submit-global");
    if (btnSubmitGlobal) {
        btnSubmitGlobal.addEventListener("click", async () => {
            const usernameInput = document.getElementById("username");
            if (!usernameInput) return;

            const username = usernameInput.value.trim().toUpperCase();
            if (!username) {
                showMessage("❌ Inserisci un nome valido!");
                return;
            }

            // Cambia interfaccia visiva in stato caricamento
            btnSubmitGlobal.innerText = "INVIO...";
            btnSubmitGlobal.disabled = true;

            if (window.ONLINE_LEADERBOARD) {
                try {
                    // Esegue la chiamata asincrona verso Supabase
                    const res = await window.ONLINE_LEADERBOARD.submitScore(username, totalScore);
                    
                    if (res) {
                        showMessage(`🌍 Record registrato con successo!`);
                        await updateLiveGlobalRank(); // Aggiorna al volo la posizione
                        
                        // Reindirizza l'utente alla pagina della classifica globale dopo un breve delay
                        setTimeout(() => { 
                            window.location.href = "leaderboard.html"; 
                        }, 1200);
                    } else {
                        // Caso in cui la fetch ha risposto ma con stato di fallimento server (!response.ok)
                        showMessage("❌ Errore server classifica. Riprova più tardi.");
                        btnSubmitGlobal.innerText = "Invia Record";
                        btnSubmitGlobal.disabled = false;
                    }
                } catch (err) {
                    // Cattura errori critici improvvisi di assenza di rete o timeout
                    console.error("Errore di connessione alla rete:", err);
                    showMessage("❌ Errore di rete. Controlla la tua connessione.");
                    btnSubmitGlobal.innerText = "Invia Record";
                    btnSubmitGlobal.disabled = false;
                }
            } else {
                showMessage("❌ Modulo classifica online non caricato.");
                btnSubmitGlobal.innerText = "Invia Record";
                btnSubmitGlobal.disabled = false;
            }
        });
    }

    // --- MOTORE GRAFICO CANVAS (IMPICCATO ARCADE) ---
    const canvas = document.getElementById("hangman");
    const ctx = canvas ? canvas.getContext("2d") : null;

    function resetCanvas() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#ffffff";
        
        // Base fissa strutturale
        ctx.beginPath();
        ctx.moveTo(10, 230); ctx.lineTo(190, 230);
        ctx.moveTo(30, 230); ctx.lineTo(30, 20);
        ctx.lineTo(120, 20);
        ctx.lineTo(120, 50);
        ctx.stroke();
    }

    function drawHangman(step) {
        if (!ctx) return;
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#ff4757"; // Elementi dell'omino in rosso Arcade

        switch(step) {
            case 1: ctx.arc(120, 70, 20, 0, Math.PI * 2); break; // Testa
            case 2: ctx.moveTo(120, 90); ctx.lineTo(120, 160); break; // Corpo
            case 3: ctx.moveTo(120, 110); ctx.lineTo(90, 130); break; // Braccio sx
            case 4: ctx.moveTo(120, 110); ctx.lineTo(150, 130); break; // Braccio dx
            case 5: ctx.moveTo(120, 160); ctx.lineTo(95, 210); break; // Gamba sx
            case 6: ctx.moveTo(120, 160); ctx.lineTo(145, 210); break; // Gamba dx
        }
        ctx.stroke();
    }

    function showMessage(text) { 
        if (messageEl) messageEl.innerText = text; 
    }
});