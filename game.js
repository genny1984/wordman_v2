/**
 * WORDMAN - MOTORE UNIFICATO ARCADE
 * Integrazione totale di controlli di lunghezza rigidi, anti-duplicati e scoring.js
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. PARAMETRI DI CONFIGURAZIONE URL
    const params = new URLSearchParams(window.location.search);
    const GAME_MODE = params.get('mode') || 'classic';
    const WORD_LENGTH = parseInt(params.get('len')) || 5; 
    const MAX_ATTEMPTS = 6;

    // Dizionari ampliati di Fallback (vengono usati se words.js fallisce o è vuoto)
    const EASY_WORDS = (window.EASY_WORDS && window.EASY_WORDS.length > 0) ? window.EASY_WORDS : ["TRENO", "GATTO", "PIZZA", "CORSA", "FUOCO", "MONDO", "TASTO", "LIBRO", "VERDE", "FIORE", "ACQUA", "AMICO", "ANIMA", "AEREO", "BARCA", "BOCCA", "BRAVO", "CAFFE", "CANTO", "CAPRA", "CARTA", "CERVO", "CIELO", "CLIMA", "COLPO", "COSTA", "CUORE", "DENTE", "DISCO", "DOLCE", "DONNA", "FANGO", "FESTA", "FIUME", "FORMA", "FORTE", "FUSTO", "GAMBA", "GIOCO", "GONNA", "GRANO", "GRAVE", "GUIDA", "GUSTO", "ISOLA", "LARGO", "LATTE", "LEGNO", "LENTO", "LINEA", "PADRE", "PANE", "PAESE", "PELLE", "PENNA", "PIANO", "PIEDE", "PORTO", "POSTO", "PRATO", "PRIMA", "PUNTO", "RADIO", "RAGNO", "REGNO", "ROSSO", "RUOTA", "SCALA", "SOGNO", "SOLDI", "SPINA", "SUOLO", "TASCA", "TERRA", "TESTA", "TORRE", "VENTO", "VETRO", "VOLTO", "ZAINO", "ZUPPA", "CORDA", "PORTA", "CREMA", "TASSE", "SCAFO", "PARCO", "CORPO", "PRONO", "ORAFO"];
    const HARD_WORDS = (window.HARD_WORDS && window.HARD_WORDS.length > 0) ? window.HARD_WORDS : ["ALBERO", "LAVORO", "STRADA", "CHIESA", "PIANTO", "SABBIA", "STORIA", "SANGUE", "SCARPA", "SCUOLA", "GIORNO", "TEATRO", "POESIA", "FRUTTO", "TAVOLO", "STADIO", "SVOLTA", "PATRIA", "FUTURO", "MEDICO", "NATURA", "PREZZO", "PIETRA", "BLOCCO", "CUGINO", "DOTTOR", "BRUTTO", "FREDDO", "PULITO", "CHIARO", "OSCURO", "FELICE", "STANCO", "PRONTO", "ONESTO", "SICURO", "ANANAS", "AVVISO", "AZIENDA", "ANELLO", "CACCIA", "CATENA", "CLASSE", "CUCINA", "DIVISA", "DOCCIA", "DOMANI", "ESTATE", "FAVOLA", "FEBBRE", "FRECCIA", "FRONTE", "GELATO", "GIACCA", "GIRAFFA", "GOMITO", "GRAZIA", "GUANTO", "LABBRO", "LANCIA", "MOSTRO", "MOTORE", "NUMERO", "PAGINA", "PAROLA", "PATATA", "PECORA", "PILOTA", "POSTER", "PRANZO", "QUADRO", "REGINA", "SABATO", "SALUTE", "SAPONE", "SATINO", "SCOPA", "SECOLO", "SIRENA", "SPEZIA", "SAPORE", "STAMPA", "STELLA", "TENDA", "TIGRE", "TIMONE", "TOMBA", "VIAGGIO", "SCONTO", "STREGA", "BRONZO", "BIANCO", "BIONDO", "DIVANO", "FASCIA", "FOGLIA", "SGUARDO", "CANDELA", "NUVOLA"];

    // Registro delle parole estratte in questa sessione (Evita i duplicati)
    const usedWords = new Set();

    // 2. STATO DEL GIOCO
    let SECRET_WORD = "";
    let currentAttempt = 0; 
    let currentTile = 0;    
    let totalScore = 0;
    let streakCount = 0;
    let isGameOverState = false;

    // Configurazione Timer
    let timeLeft = 60;
    let timerInterval = null;

    // 3. ELEMENTI INTERFACCIA DOM
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

    if (GAME_MODE === 'timer') {
        timerWrapper.classList.remove("hidden");
    }

    // 4. INPUT MOBILE INVISIBILE
    const mobileInput = document.createElement("input");
    mobileInput.type = "text";
    mobileInput.setAttribute("inputmode", "text");
    mobileInput.setAttribute("autocomplete", "off");
    mobileInput.setAttribute("autocapitalize", "characters");
    mobileInput.setAttribute("spellcheck", "false");
    mobileInput.style.position = "fixed";
    mobileInput.style.top = "0"; mobileInput.style.left = "0";
    mobileInput.style.opacity = "0"; mobileInput.style.pointerEvents = "none";
    mobileInput.style.zIndex = "-1000";
    document.body.appendChild(mobileInput);
    mobileInput.value = "X";

    function focusMobileInput() {
        if (!restartBtn.classList.contains("hidden")) return;
        mobileInput.focus({ preventScroll: true });
    }

    document.addEventListener("click", (e) => {
        if (e.target.id === "leaderboard-username" || e.target.closest("button")) return;
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

    // 5. SELEZIONE PAROLA CON CONTROLLI RIGIDI
    function getValidSecretWord() {
        // Seleziona il pool corretto basandosi sulla configurazione passata
        let basePool = (WORD_LENGTH === 5) ? EASY_WORDS : HARD_WORDS;
        
        // REGOLA 1: La parola deve avere ESATTAMENTE la lunghezza corretta impostata nell'URL
        let filteredPool = basePool.filter(word => word.trim().length === WORD_LENGTH);

        if (filteredPool.length === 0) {
            console.error(`Errore critico: Nessuna parola di lunghezza ${WORD_LENGTH} trovata nel dizionario.`);
            return (WORD_LENGTH === 5) ? "TRENO" : "ALBERO"; 
        }

        // REGOLA 2: La parola non deve essere già uscita in questa partita/sessione
        let availablePool = filteredPool.filter(word => !usedWords.has(word.toUpperCase()));

        // Se le parole del pool valido sono esaurite tutte, pulisci lo storico per non bloccare il gioco
        if (availablePool.length === 0) {
            usedWords.clear();
            availablePool = filteredPool;
        }

        // Scegli una parola a caso dal pool filtrato
        let chosenWord = availablePool[Math.floor(Math.random() * availablePool.length)].toUpperCase();
        
        // Aggiungi al registro dei duplicati
        usedWords.add(chosenWord);
        return chosenWord;
    }

    // 6. AZIONI DELLA LOGICA DI GIOCO
    function startNewRound() {
        SECRET_WORD = getValidSecretWord();
        console.log("Parola Segreta Validata:", SECRET_WORD);

        currentAttempt = 0;
        currentTile = 0;
        showMessage("");
        
        restartBtn.classList.add("hidden");
        globalSaveContainer.classList.add("hidden");

        // Rigenerazione Griglia basata su WORD_LENGTH
        board.style.setProperty('--cols', WORD_LENGTH);
        board.innerHTML = "";
        for (let i = 0; i < MAX_ATTEMPTS * WORD_LENGTH; i++) {
            const tile = document.createElement("div");
            tile.classList.add("tile");
            tile.setAttribute("id", `tile-${i}`);
            board.appendChild(tile);
        }

        // Reset Grafica Impiccato
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(10, 240); ctx.lineTo(150, 240);
        ctx.moveTo(40, 240); ctx.lineTo(40, 20);
        ctx.moveTo(40, 20);  ctx.lineTo(120, 20);
        ctx.moveTo(120, 20); ctx.lineTo(120, 50);
        ctx.stroke();

        if (GAME_MODE === 'timer') startTimer();
        focusMobileInput();
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
            if (tile) {
                tile.innerText = "";
            }
        }
    }

    function checkRow() {
        if (currentTile !== WORD_LENGTH) {
            showMessage(`Inserisci ${WORD_LENGTH} lettere!`); 
            return;
        }

        let guess = "";
        const startIndex = currentAttempt * WORD_LENGTH;
        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = document.getElementById(`tile-${startIndex + i}`);
            if (tile && tile.innerText) guess += tile.innerText;
        }
        guess = guess.trim().toUpperCase();

        let tileStatuses = new Array(WORD_LENGTH).fill("absent");
        let secretLettersRemaining = SECRET_WORD.split("");

        // Controllo Lettere Esatte (Verdi)
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (guess[i] === SECRET_WORD[i]) {
                tileStatuses[i] = "correct"; 
                secretLettersRemaining[i] = null;
            }
        }
        // Controllo Lettere Presenti (Gialle)
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (tileStatuses[i] === "correct") continue;
            const idx = secretLettersRemaining.indexOf(guess[i]);
            if (idx !== -1) {
                tileStatuses[i] = "present"; 
                secretLettersRemaining[idx] = null;
            }
        }

        // APPLICAZIONE LOGICA SCORING.JS RAFFINATA
        let roundPoints = 0;
        if (window.SCORING && typeof window.SCORING.calculateRowPoints === "function") {
            roundPoints += window.SCORING.calculateRowPoints(tileStatuses, WORD_LENGTH);
        } else {
            tileStatuses.forEach(s => { 
                if(s === 'correct') roundPoints += 20; 
                if(s === 'present') roundPoints += 10; 
            });
            if (WORD_LENGTH === 6) roundPoints = Math.round(roundPoints * 1.5);
        }

        // Applica classi grafiche della riga
        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = document.getElementById(`tile-${startIndex + i}`);
            if (tile) tile.classList.add(tileStatuses[i]);
        }

        // CASO DI VITTORIA
        if (guess === SECRET_WORD) {
            if (GAME_MODE === 'timer') clearInterval(timerInterval);

            // Applica il bonus di vittoria raffinato da scoring.js
            if (window.SCORING && typeof window.SCORING.calculateVictoryBonus === "function") {
                const isTimer = (GAME_MODE === 'timer');
                roundPoints += window.SCORING.calculateVictoryBonus(currentAttempt, WORD_LENGTH, isTimer, timeLeft);
            }

            totalScore += roundPoints;
            streakCount++; 
            
            currentScoreEl.innerText = totalScore;
            currentStreakEl.innerText = streakCount;

            const li = document.createElement("li");
            const timeTag = (GAME_MODE === 'timer') ? ` (${timeLeft}s)` : "";
            li.innerText = `✔️ ${SECRET_WORD} +${roundPoints}pt${timeTag}`;
            wordsListEl.prepend(li);

            showMessage(`🎉 Esatto! (+${roundPoints}pt)`);
            isGameOverState = false;
            restartBtn.innerText = "Continua";
            restartBtn.classList.remove("hidden");
            return;
        }

        // Disegna pezzo dell'impiccato se fallito
        drawHangman(currentAttempt);
        currentAttempt++;
        currentTile = 0;

        // CASO DI SCONFITTA (Fine tentativi)
        if (currentAttempt === MAX_ATTEMPTS) {
            if (GAME_MODE === 'timer') clearInterval(timerInterval);
            showMessage(`💥 IMPICCATO! Era: ${SECRET_WORD}`);
            triggerGameOver();
        }
    }

    // 7. TIMER DI GIOCO
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

    // 8. CONCLUSIONE DELLA SESSIONE
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
        usedWords.clear(); // Resetta lo storico duplicati per una nuova sessione completa
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

    // 9. CLASSIFICA GLOBAL SUPABASE
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
                    showMessage(`🌍 Record inviato con successo!`);
                    setTimeout(() => { window.location.href = "leaderboard.html"; }, 1200);
                } else {
                    showMessage(`❌ Errore di connessione.`);
                    btnSubmitGlobal.innerText = "INVIA";
                    btnSubmitGlobal.disabled = false;
                }
            }
        });
    }

    startNewRound();
});