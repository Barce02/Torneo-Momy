// Gestione Logica Tabellone Finale Torneo Momy

class TournamentManager {
  constructor(state) {
    this.state = state;
  }

  getPlayer(id) {
    if (!id) return null;
    return this.state.players.find(p => p.id === id) || null;
  }

  // Valuta la forza della classifica FITP per comporre gli accoppiamenti
  getRankingWeight(ranking) {
    if (!ranking) return 0;
    const r = String(ranking).trim().toUpperCase();
    if (r === "NC") return 1;
    const match = r.match(/^([1-4])(?:\.([1-8]))?$/);
    if (match) {
      const category = parseInt(match[1], 10);
      const sub = match[2] ? parseInt(match[2], 10) : 0;
      return (5 - category) * 100 + (10 - sub) * 10;
    }
    return 1;
  }

  // Genera un tabellone a eliminazione diretta
  generateBracket(playersList) {
    const players = playersList || this.state.players;
    if (!players || players.length < 2) {
      throw new Error("Servono almeno 2 atleti iscritti per comporre il tabellone finale.");
    }

    // Ordina i partecipanti in base alla classifica FITP (i migliori piazzati nelle posizioni cardine)
    const sortedPlayers = [...players].sort((a, b) => {
      const weightA = this.getRankingWeight(a.ranking);
      const weightB = this.getRankingWeight(b.ranking);
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return Math.random() - 0.5;
    });

    // Dimensione minima potenza di 2 (4, 8, 16, 32)
    let bracketSize = 4;
    if (sortedPlayers.length > 16) bracketSize = 32;
    else if (sortedPlayers.length > 8) bracketSize = 16;
    else if (sortedPlayers.length > 4) bracketSize = 8;
    else bracketSize = 4;

    const slots = new Array(bracketSize).fill(null);

    // Schema di posizionamento giocatori secondo ranking standard tennis
    let seedPositions = [];
    if (bracketSize === 4) {
      seedPositions = [0, 3, 1, 2];
    } else if (bracketSize === 8) {
      seedPositions = [0, 7, 4, 3, 2, 5, 6, 1];
    } else if (bracketSize === 16) {
      seedPositions = [0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1];
    } else {
      seedPositions = Array.from({ length: bracketSize }, (_, i) => i);
    }

    let pIdx = 0;
    for (let pos of seedPositions) {
      if (pIdx < sortedPlayers.length) {
        slots[pos] = sortedPlayers[pIdx].id;
        pIdx++;
      } else {
        slots[pos] = "BYE";
      }
    }

    const rounds = [];
    const totalRounds = Math.log2(bracketSize);

    const roundNamesMap = {
      1: ["Finale"],
      2: ["Semifinali", "Finale"],
      3: ["Quarti di Finale", "Semifinali", "Finale"],
      4: ["Ottavi di Finale", "Quarti di Finale", "Semifinali", "Finale"],
      5: ["Sedicesimi di Finale", "Ottavi di Finale", "Quarti di Finale", "Semifinali", "Finale"]
    };

    const names = roundNamesMap[totalRounds] || ["Turno 1", "Turno 2", "Semifinali", "Finale"];

    // Round 1
    const r1Matches = [];
    for (let i = 0; i < bracketSize; i += 2) {
      const p1 = slots[i];
      const p2 = slots[i + 1];
      const matchId = `m-r1-${(i / 2) + 1}`;
      
      let winnerId = null;
      let status = "in_programma";
      let scores = "";

      // Gestione automatica BYE
      if (p1 === "BYE" && p2 && p2 !== "BYE") {
        winnerId = p2;
        status = "completato";
        scores = "BYE";
      } else if (p2 === "BYE" && p1 && p1 !== "BYE") {
        winnerId = p1;
        status = "completato";
        scores = "BYE";
      }

      r1Matches.push({
        id: matchId,
        player1Id: p1 === "BYE" ? null : p1,
        player2Id: p2 === "BYE" ? null : p2,
        scores: scores,
        winnerId: winnerId,
        court: "Campo 1 (Centrale)",
        dateTime: "",
        status: status
      });
    }

    rounds.push({
      name: names[0],
      matches: r1Matches
    });

    // Round successivi
    let prevMatches = r1Matches;
    for (let r = 1; r < totalRounds; r++) {
      const currentMatches = [];
      const matchCount = prevMatches.length / 2;
      for (let m = 0; m < matchCount; m++) {
        const parent1 = prevMatches[m * 2];
        const parent2 = prevMatches[m * 2 + 1];
        
        const p1 = parent1.winnerId || null;
        const p2 = parent2.winnerId || null;

        const matchId = `m-r${r + 1}-${m + 1}`;
        currentMatches.push({
          id: matchId,
          player1Id: p1,
          player2Id: p2,
          scores: "",
          winnerId: null,
          court: "Campo 1 (Centrale)",
          dateTime: "",
          status: "in_programma"
        });
      }

      rounds.push({
        name: names[r],
        matches: currentMatches
      });
      prevMatches = currentMatches;
    }

    const bracket = {
      rounds: rounds,
      createdAt: new Date().toISOString()
    };

    this.state.bracket = bracket;
    return bracket;
  }

  // Aggiorna punteggio ed avanza il vincitore nel tabellone
  updateBracketMatch(matchId, updateData) {
    const bracket = this.state.bracket;
    if (!bracket) return false;

    let roundIndex = -1;
    let matchIndex = -1;
    let targetMatch = null;

    for (let r = 0; r < bracket.rounds.length; r++) {
      const idx = bracket.rounds[r].matches.findIndex(m => m.id === matchId);
      if (idx !== -1) {
        roundIndex = r;
        matchIndex = idx;
        targetMatch = bracket.rounds[r].matches[idx];
        break;
      }
    }

    if (!targetMatch) return false;

    const oldWinnerId = targetMatch.winnerId;

    if (updateData.scores !== undefined) targetMatch.scores = updateData.scores;
    if (updateData.winnerId !== undefined) targetMatch.winnerId = updateData.winnerId;
    if (updateData.court !== undefined) targetMatch.court = updateData.court;
    if (updateData.dateTime !== undefined) targetMatch.dateTime = updateData.dateTime;
    if (updateData.status !== undefined) targetMatch.status = updateData.status;

    // Se c'è un round successivo, avanza il vincitore
    if (roundIndex < bracket.rounds.length - 1) {
      const nextRound = bracket.rounds[roundIndex + 1];
      const nextMatchIndex = Math.floor(matchIndex / 2);
      const isPlayer1 = matchIndex % 2 === 0;

      const nextMatch = nextRound.matches[nextMatchIndex];
      if (nextMatch) {
        const newWinner = targetMatch.winnerId;
        if (isPlayer1) {
          nextMatch.player1Id = newWinner;
        } else {
          nextMatch.player2Id = newWinner;
        }

        if (oldWinnerId && oldWinnerId !== newWinner) {
          nextMatch.winnerId = null;
          nextMatch.scores = "";
          nextMatch.status = "in_programma";
        }
      }
    }

    const isFinal = roundIndex === bracket.rounds.length - 1;
    const isChampionDecided = isFinal && targetMatch.winnerId && targetMatch.status === "completato";

    return {
      success: true,
      isChampionDecided: isChampionDecided,
      winner: isChampionDecided ? this.getPlayer(targetMatch.winnerId) : null
    };
  }
}
