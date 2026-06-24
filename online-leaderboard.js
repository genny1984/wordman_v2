const ONLINE_LEADERBOARD = {
    SUPABASE_URL: 'https://ezopsdhrggolwffbwknb.supabase.co',
    SUPABASE_KEY: 'sb_publishable_5h0aollwcdkBZr3XxN4qCw_n4npr9X0',

    // 1. Genera o recupera il codice invisibile del dispositivo
    _getOrCreateUserToken: function() {
        let token = localStorage.getItem('wordman_device_token');
        if (!token) {
            token = 'usr_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
            localStorage.setItem('wordman_device_token', token);
        }
        return token;
    },

    // 2. Invio del punteggio con Log degli errori dettagliato
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

            if (!checkResponse.ok) {
                const errText = await checkResponse.text();
                console.error("❌ Supabase - Errore nel controllo record esistente:", checkResponse.status, errText);
                return null;
            }
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
                    
                    if (!updateResponse.ok) {
                        const errText = await updateResponse.text();
                        console.error("❌ Supabase - Errore durante l'UPDATE del record:", updateResponse.status, errText);
                        return null;
                    }
                    return await updateResponse.json();
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
                
                if (!insertResponse.ok) {
                    const errText = await insertResponse.text();
                    console.error("❌ Supabase - Errore durante l'INSERT del record:", insertResponse.status, errText);
                    return null;
                }
                return await insertResponse.json();
            }

        } catch (error) {
            console.error("💥 Errore di rete critico durante submitScore:", error);
            return null;
        }
    },

    // 3. Calcolo della posizione in tempo reale (Rank)
    calculateRank: async function(myScore) {
        const url = `${this.SUPABASE_URL}/rest/v1/leaderboard?score=gt.${myScore}&select=score`;
        try {
            const response = await fetch(url, {
                headers: {
                    'apikey': this.SUPABASE_KEY,
                    'Authorization': `Bearer ${this.SUPABASE_KEY}`
                }
            });
            if (!response.ok) {
                const errText = await response.text();
                console.error("❌ Supabase - Errore in calculateRank:", response.status, errText);
                return '--';
            }
            const data = await response.json();
            return (Array.isArray(data) ? data.length : 0) + 1;
        } catch (error) {
            console.error("💥 Errore di rete in calculateRank:", error);
            return '--';
        }
    },

    // 4. Scarica tutta la classifica per riempire leaderboard.html
    getLeaderboardData: async function() {
        const myToken = this._getOrCreateUserToken();
        const url = `${this.SUPABASE_URL}/rest/v1/leaderboard?order=score.desc`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'apikey': this.SUPABASE_KEY,
                    'Authorization': `Bearer ${this.SUPABASE_KEY}`
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error("❌ Supabase - Errore in getLeaderboardData:", response.status, errText);
                return null;
            }
            const allRecords = await response.json();

            let top10 = [];
            let currentUserRow = null;

            allRecords.forEach((record, index) => {
                const playerRank = index + 1;
                const isMe = (record.user_token === myToken);

                const playerData = {
                    rank: playerRank,
                    username: record.username,
                    score: record.score,
                    isCurrentUser: isMe
                };

                if (playerRank <= 10) {
                    top10.push(playerData);
                }
                if (isMe) {
                    currentUserRow = playerData;
                }
            });

            return {
                top10: top10,
                currentUserRow: currentUserRow
            };

        } catch (error) {
            console.error("💥 Errore nel caricamento della classifica:", error);
            return null;
        }
    }
};