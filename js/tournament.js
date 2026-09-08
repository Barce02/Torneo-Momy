// Logica per Tabelloni (Eliminazione Diretta) e Gironi all'Italiana

class TournamentManager {
  constructor(state) {
    this.state = state;
  }

  // Recupera giocatore per ID
  getPlayer(id) {
    if (!id) return null;
    return this.state.players.find(p => p.id === id) || null;
  }

  // Formatta nome giocatore con eventuale testa di serie e circolo
  getPlayerDisplayName(id, showDetails = true) {
    if (!id) return "TBD (Da definire)";
    if (id === "BYE") return "BYE (Passa il turno)";
    const p = this.getPlayer(id);
    if (!p) return "Sconosciuto";
    let name = p.name;
    if (showDetails) {
      if (p.seed) name = `[${p.seed}] ${name}`;
      if (p.club) name += ` (${p.club})`;
    }
    return name;
  }

  // Genera un tabellone a eliminazione diretta
  generateBracket(category) {
    const categoryPlayers = this.state.players.filter(
      p => p.category === category && p.status === "confermato"
    );

    if (categoryPlayers.length < 2) {
      throw new Error("Servono almeno 2 giocatori per creare il tabellone.");
    }

    // Ordina: prima le teste di serie (1, 2, 3...), poi gli altri
    const seeded = categoryPlayers
      .filter(p => p.seed)
      .sort((a, b) => a.seed - b.seed);
    const unseeded = categoryPlayers
      .filter(p => !p.seed)
      .sort(() => Math.random() - 0.5); // shuffle unseeded

    const sortedPlayers = [...seeded, ...unseeded];

    // Determina dimensione tabellone (potenza di 2: 4, 8, 16, 32)
    let bracketSize = 4;
    if (sortedPlayers.length > 8) bracketSize = 16;
    else if (sortedPlayers.length > 4) bracketSize = 8;
    else bracketSize = 4;

    // Posizionamento tennistico standard delle teste di serie
    const slots = new Array(bracketSize).fill(null);

    // Schema di seeding standard tennis per 4, 8, 16
    let seedPositions = [];
    if (bracketSize === 4) {
      seedPositions = [0, 3, 1, 2];
    } else if (bracketSize === 8) {
      seedPositions = [0, 7, 4, 3, 2, 5, 6, 1];
    } else if (bracketSize === 16) {
      seedPositions = [0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1];
    }

    // Riempi slot con giocatori disponibili
    let pIdx = 0;
    for (let pos of seedPositions) {
      if (pIdx < sortedPlayers.length) {
        slots[pos] = sortedPlayers[pIdx].id;
        pIdx++;
      } else {
        slots[pos] = "BYE";
      }
    }

    // Costruisci i turni
    const rounds = [];
    const totalRounds = Math.log2(bracketSize);

    // Nomi dei turni
    const roundNamesMap = {
      1: ["Finale"],
      2: ["Semifinali", "Finale"],
      3: ["Quarti di Finale", "Semifinali", "Finale"],
      4: ["Ottavi di Finale", "Quarti di Finale", "Semifinali", "Finale"]
    };

    const names = roundNamesMap[totalRounds] || ["Turno 1", "Turno 2", "Semifinali", "Finale"];

    // Round 1
    const r1Matches = [];
    for (let i = 0; i < bracketSize; i += 2) {
      const p1 = slots[i];
      const p2 = slots[i + 1];
      const matchId = `b-${category.replace(/\s+/g, '-').toLowerCase()}-r1-m${(i / 2) + 1}`;
      
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
        court: this.state.tournament.courts[0] || "Campo 1",
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
        
        // Se un genitore ha già un vincitore (es. BYE), lo avanziamo
        const p1 = parent1.winnerId || null;
        const p2 = parent2.winnerId || null;

        const matchId = `b-${category.replace(/\s+/g, '-').toLowerCase()}-r${r + 1}-m${m + 1}`;
        currentMatches.push({
          id: matchId,
          player1Id: p1,
          player2Id: p2,
          scores: "",
          winnerId: null,
          court: this.state.tournament.courts[0] || "Campo 1",
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

    if (!this.state.brackets) this.state.brackets = {};
    this.state.brackets[category] = {
      category: category,
      rounds: rounds
    };

    return this.state.brackets[category];
  }

  // Aggiorna punteggio ed avanza vincitore nel tabellone
  updateBracketMatch(category, matchId, updateData) {
    const bracket = this.state.brackets[category];
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

    // Aggiorna dati del match
    if (updateData.scores !== undefined) targetMatch.scores = updateData.scores;
    if (updateData.winnerId !== undefined) targetMatch.winnerId = updateData.winnerId;
    if (updateData.court !== undefined) targetMatch.court = updateData.court;
    if (updateData.dateTime !== undefined) targetMatch.dateTime = updateData.dateTime;
    if (updateData.status !== undefined) targetMatch.status = updateData.status;

    // Se c'è un round successivo, avanza o propaga il vincitore
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

        // Se il vecchio vincitore era diverso e il next match aveva già un vincitore derivato, azzera a valle
        if (oldWinnerId && oldWinnerId !== newWinner) {
          nextMatch.winnerId = null;
          nextMatch.scores = "";
          nextMatch.status = "in_programma";
        }
      }
    }

    // Se è la finale ed è stata completata con un vincitore, restituisci flag champions
    const isFinal = roundIndex === bracket.rounds.length - 1;
    const isChampionDecided = isFinal && targetMatch.winnerId && targetMatch.status === "completato";

    return {
      success: true,
      isChampionDecided: isChampionDecided,
      winner: isChampionDecided ? this.getPlayer(targetMatch.winnerId) : null
    };
  }

  // Genera un girone all'italiana (Round Robin)
  createGroup(category, groupName, playerIds) {
    if (!this.state.groups) this.state.groups = {};
    if (!this.state.groups[category]) this.state.groups[category] = [];

    const matches = [];
    let matchCount = 1;

    // Genera tutte le coppie possibili (Round Robin)
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        matches.push({
          id: `grp-${Date.now()}-${matchCount++}`,
          p1: playerIds[i],
          p2: playerIds[j],
          scores: "",
          winnerId: null,
          court: this.state.tournament.courts[0] || "Campo 1",
          dateTime: "",
          status: "in_programma"
        });
      }
    }

    const newGroup = {
      name: groupName,
      category: category,
      playerIds: [...playerIds],
      matches: matches
    };

    this.state.groups[category].push(newGroup);
    return newGroup;
  }

  // Calcola classifica girone (Punti, Vittorie, Set, Game)
  calculateGroupStandings(group) {
    const table = {};

    group.playerIds.forEach(pid => {
      const p = this.getPlayer(pid);
      table[pid] = {
        id: pid,
        name: p ? p.name : "Sconosciuto",
        club: p ? p.club : "",
        played: 0,
        won: 0,
        lost: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        points: 0
      };
    });

    group.matches.forEach(m => {
      if (m.status === "completato" && m.winnerId && table[m.p1] && table[m.p2]) {
        table[m.p1].played += 1;
        table[m.p2].played += 1;

        if (m.winnerId === m.p1) {
          table[m.p1].won += 1;
          table[m.p1].points += 2; // 2 punti per vittoria
          table[m.p2].lost += 1;
        } else if (m.winnerId === m.p2) {
          table[m.p2].won += 1;
          table[m.p2].points += 2;
          table[m.p1].lost += 1;
        }

        // Parsing punteggio set e game (es: "4-1 4-2" o "6-3 4-6 [10-7]")
        this.parseScoreStats(m.scores, m.p1, m.p2, table);
      }
    });

    // Ordina classifica: Punti DESC, Diff Set DESC, Diff Game DESC, Game Vinti DESC
    return Object.values(table).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const setDiffA = a.setsWon - a.setsLost;
      const setDiffB = b.setsWon - b.setsLost;
      if (setDiffB !== setDiffA) return setDiffB - setDiffA;
      const gameDiffA = a.gamesWon - a.gamesLost;
      const gameDiffB = b.gamesWon - b.gamesLost;
      if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
      return b.gamesWon - a.gamesWon;
    });
  }

  // Parser punteggio tennis (es: "6-3 4-6 10-8" o "4-1 4-2")
  parseScoreStats(scoreStr, p1Id, p2Id, table) {
    if (!scoreStr) return;
    const cleanSets = scoreStr.replace(/\[|\]/g, '').trim().split(/\s+/);

    cleanSets.forEach(setStr => {
      const parts = setStr.split('-');
      if (parts.length === 2) {
        const g1 = parseInt(parts[0], 10);
        const g2 = parseInt(parts[1], 10);
        if (!isNaN(g1) && !isNaN(g2)) {
          table[p1Id].gamesWon += g1;
          table[p1Id].gamesLost += g2;
          table[p2Id].gamesWon += g2;
          table[p2Id].gamesLost += g1;

          if (g1 > g2) {
            table[p1Id].setsWon += 1;
            table[p2Id].setsLost += 1;
          } else if (g2 > g1) {
            table[p2Id].setsWon += 1;
            table[p1Id].setsLost += 1;
          }
        }
      }
    });
  }

  // Raccoglie tutte le partite (tabellone + gironi) per l'Order of Play (Programma Campi)
  getAllMatches() {
    const all = [];

    // Dai tabelloni
    if (this.state.brackets) {
      Object.entries(this.state.brackets).forEach(([cat, bracket]) => {
        bracket.rounds.forEach((round, rIdx) => {
          round.matches.forEach(m => {
            if (m.player1Id || m.player2Id) {
              all.push({
                ...m,
                type: 'bracket',
                category: cat,
                roundName: round.name,
                player1: this.getPlayer(m.player1Id),
                player2: this.getPlayer(m.player2Id)
              });
            }
          });
        });
      });
    }

    // Dai gironi
    if (this.state.groups) {
      Object.entries(this.state.groups).forEach(([cat, groupsList]) => {
        groupsList.forEach(grp => {
          grp.matches.forEach(m => {
            all.push({
              ...m,
              type: 'group',
              category: cat,
              groupName: grp.name,
              player1: this.getPlayer(m.p1),
              player2: this.getPlayer(m.p2)
            });
          });
        });
      });
    }

    // Ordina per data/ora
    return all.sort((a, b) => {
      if (!a.dateTime) return 1;
      if (!b.dateTime) return -1;
      return new Date(a.dateTime) - new Date(b.dateTime);
    });
  }
}
