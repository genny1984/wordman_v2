const ONLINE_LEADERBOARD = {
    SUPABASE_URL: 'https://ezopsdhrggolwffbwknb.supabase.co',
    SUPABASE_KEY: 'sb_publishable_5h0aollwcdkBZr3XxN4qCw_n4npr9X0',

    // Gestione locale del nome per evidenziare il giocatore nella classifica
    _setLastUsername: function(username) {
        localStorage.setItem('wordman_last_username', username);
    },
    _getLastUsername: function() {
        return localStorage.getItem('wordman_last_username') || '';
    },

// 1. Inserimento diretto del punteggio (Risolto errore 406)
    submitScore: async function(username, score) {
        this._setLastUsername(username);
        const insertUrl = `${this.SUPABASE_URL}/rest/v1/leaderboard`;
        
        try {
            const response = await fetch(insertUrl, {
                method: 'POST',
                headers: {
                    'apikey': this.SUPABASE_KEY,
                    'Authorization': `Bearer ${this.SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                    // Rimosso 'Prefer': 'return=representation' per evitare il blocco 406
                },
                body: JSON.stringify({ username: username, score: score })
            });

            // Con POST senza representation, lo stato di successo standard è 201 (Created)
            if (response.status === 201 || response.ok) {
                return { success: true };
            } else {
                console.error("Errore del server Supabase:", await response.text());
                return null;
            }
        } catch (error) {
            console.error("Errore di rete durante il salvataggio:", error);
            return null;
        }
    },

    // 2. Calcolo della posizione in tempo reale
    calculateRank: async function(myScore) {
        const url = `${this.SUPABASE_URL}/rest/v1/leaderboard?score=gt.${myScore}`;
        try {
            const response = await fetch(url, {
                headers: {
                    'apikey': this.SUPABASE_KEY,
                    'Authorization': `Bearer ${this.SUPABASE_KEY}`
                }
            });
            if (!response.ok) return 1;
            const data = await response.json();
            return (Array.isArray(data) ? data.length : 0) + 1;
        } catch (error) {
            return 1;
        }
    },

    // 3. Lettura dati per la pagina leaderboard.html
    getLeaderboardData: async function() {
        const lastUsername = this._getLastUsername();
        const url = `${this.SUPABASE_URL}/rest/v1/leaderboard?order=score.desc`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'apikey': this.SUPABASE_KEY,
                    'Authorization': `Bearer ${this.SUPABASE_KEY}`
                }
            });

            if (!response.ok) return null;
            const allRecords = await response.json();

            let top10 = [];
            let currentUserRow = null;
            let foundMe = false;

            allRecords.forEach((record, index) => {
                const playerRank = index + 1;
                
                // Evidenzia la riga se è l'ultimo nome usato su questo browser
                const isMe = (record.username === lastUsername && !foundMe);
                if (isMe) foundMe = true; 

                const playerData = {
                    rank: playerRank,
                    username: record.username,
                    score: record.score,
                    isCurrentUser: isMe
                };

                if (playerRank <= 10) top10.push(playerData);
                if (isMe) currentUserRow = playerData;
            });

            return {
                top10: top10,
                currentUserRow: currentUserRow
            };

        } catch (error) {
            console.error("Errore nel caricamento della classifica:", error);
            return null;
        }
    }
};