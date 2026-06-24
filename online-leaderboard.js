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
        const token = this._getOrCreateUserToken();
        const checkUrl = `${this.SUPABASE_URL}/rest/v1/leaderboard?user_token=eq.${token}`;
        
        try {
            const checkResponse = await fetch(checkUrl, {
                method: 'GET',
                headers: {
                    'apikey': this.SUPABASE_KEY,
                    'Authorization': `Bearer ${this.SUPABASE_KEY}`
                }
            });

            if (!checkResponse.ok) return null;
            const existingRecords = await checkResponse.json();

            // Se questo specifico dispositivo ha già una riga
            if (existingRecords && existingRecords.length > 0) {
                const oldRecord = existingRecords[0];

                if (score > oldRecord.score) {
                    const updateUrl = `${this.SUPABASE_URL}/rest/v1/leaderboard?user_token=eq.${token}`;
                    const updateResponse = await fetch(updateUrl, {
                        method: 'PATCH',
                        headers: {
                            'apikey': this.SUPABASE_KEY, 'Authorization': `Bearer ${this.SUPABASE_KEY}`,
                            'Content-Type': 'application/json', 'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({ username: username, score: score })
                    });
                    return updateResponse.ok ? await updateResponse.json() : null;
                } else {
                    if (username !== oldRecord.username) {
                        const updateUrl = `${this.SUPABASE_URL}/rest/v1/leaderboard?user_token=eq.${token}`;
                        await fetch(updateUrl, {
                            method: 'PATCH',
                            headers: { 'apikey': this.SUPABASE_KEY, 'Authorization': `Bearer ${this.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: username })
                        });
                    }
                    return { message: "Record precedente più alto custodito con successo." };
                }
            } 
            // Se è un nuovo utente, crea la riga
            else {
                const insertUrl = `${this.SUPABASE_URL}/rest/v1/leaderboard`;
                const insertResponse = await fetch(insertUrl, {
                    method: 'POST',
                    headers: {
                        'apikey': this.SUPABASE_KEY, 'Authorization': `Bearer ${this.SUPABASE_KEY}`,
                        'Content-Type': 'application/json', 'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ username: username, score: score, user_token: token })
                });
                return insertResponse.ok ? await insertResponse.json() : null;
            }

        } catch (error) {
            console.error("Errore di rete durante l'operazione:", error);
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