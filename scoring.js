/**
 * WORDMAN - Modulo Logica Punteggi Sopraffina
 */

const SCORING = {
    POINTS_GREEN: 20,
    POINTS_YELLOW: 10,

    calculateRowPoints: function(statuses, wordLength) {
        let punti = 0;
        for (let status of statuses) {
            if (status === "correct") {
                punti += this.POINTS_GREEN;
            } else if (status === "present") {
                punti += this.POINTS_YELLOW;
            }
        }
        if (wordLength === 6) {
            punti = Math.round(punti * 1.5);
        }
        return punti;
    },

    calculateVictoryBonus: function(attemptIndex, wordLength, isTimerMode, timeLeft) {
        let bonusTentativo = 40;
        
        switch (attemptIndex) {
            case 0: bonusTentativo = 150; break; 
            case 1: bonusTentativo = 120; break; 
            case 2: bonusTentativo = 100; break; 
            case 3: bonusTentativo = 80;  break; 
            case 4: bonusTentativo = 60;  break; 
            case 5: bonusTentativo = 40;  break; 
        }

        if (wordLength === 6) {
            bonusTentativo = Math.round(bonusTentativo * 1.5);
        }

        if (isTimerMode && timeLeft > 0) {
            bonusTentativo += Math.round(timeLeft * 1.5);
        }

        return bonusTentativo;
    }
};