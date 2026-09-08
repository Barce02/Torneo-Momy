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

  // ==========================================
  // METODI GESTIONE FASE A GIRONI (SINNER & ALCARAZ)
  // ==========================================
  ensureGroups() {
    if (!this.state.groups) {
      this.state.groups = {
        sinner: { id: "sinner", name: "Girone Sinner", playerIds: [], matches: [] },
        alcaraz: { id: "alcaraz", name: "Girone Alcaraz", playerIds: [], matches: [] }
      };
    } else {
      if (!this.state.groups.sinner) {
        this.state.groups.sinner = { id: "sinner", name: "Girone Sinner", playerIds: [], matches: [] };
      }
      if (!this.state.groups.alcaraz) {
        this.state.groups.alcaraz = { id: "alcaraz", name: "Girone Alcaraz", playerIds: [], matches: [] };
      }
    }
    return this.state.groups;
  }

  autoAssignGroups() {
    this.ensureGroups();
    const players = [...this.state.players].sort((a, b) => {
      const weightA = this.getRankingWeight(a.ranking);
      const weightB = this.getRankingWeight(b.ranking);
      if (weightA !== weightB) return weightB - weightA;
      return (a.lastName || "").localeCompare(b.lastName || "");
    });

    const sinnerIds = [];
    const alcarazIds = [];

    // Metodo a serpentina (snake draft) per bilanciare i due gironi
    players.forEach((p, idx) => {
      const cycle = Math.floor(idx / 2) % 2;
      if (cycle === 0) {
        if (idx % 2 === 0) sinnerIds.push(p.id);
        else alcarazIds.push(p.id);
      } else {
        if (idx % 2 === 0) alcarazIds.push(p.id);
        else sinnerIds.push(p.id);
      }
    });

    this.state.groups.sinner.playerIds = sinnerIds;
    this.state.groups.alcaraz.playerIds = alcarazIds;

    this.generateGroupMatches("sinner");
    this.generateGroupMatches("alcaraz");

    return this.state.groups;
  }

  assignPlayerToGroup(playerId, targetGroupKey) {
    this.ensureGroups();
    this.state.groups.sinner.playerIds = this.state.groups.sinner.playerIds.filter(id => id !== playerId);
    this.state.groups.alcaraz.playerIds = this.state.groups.alcaraz.playerIds.filter(id => id !== playerId);

    if (targetGroupKey === "sinner" || targetGroupKey === "alcaraz") {
      this.state.groups[targetGroupKey].playerIds.push(playerId);
      this.generateGroupMatches(targetGroupKey);
    }
  }

  generateGroupMatches(groupKey) {
    this.ensureGroups();
    const group = this.state.groups[groupKey];
    if (!group) return [];

    const playerIds = group.playerIds.filter(id => this.getPlayer(id) !== null);
    const existingMatches = group.matches || [];
    const newMatches = [];

    let matchCount = 1;
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const p1Id = playerIds[i];
        const p2Id = playerIds[j];

        const existing = existingMatches.find(m =>
          (m.player1Id === p1Id && m.player2Id === p2Id) ||
          (m.player1Id === p2Id && m.player2Id === p1Id)
        );

        if (existing) {
          newMatches.push(existing);
        } else {
          newMatches.push({
            id: `gm-${groupKey}-${matchCount}`,
            groupKey: groupKey,
            player1Id: p1Id,
            player2Id: p2Id,
            games1: null,
            games2: null,
            scores: "",
            winnerId: null,
            isDraw: false,
            court: groupKey === "sinner" ? "Campo 1 (Centrale)" : "Campo 2",
            dateTime: "",
            status: "in_programma"
          });
        }
        matchCount++;
      }
    }

    group.matches = newMatches;
    return newMatches;
  }

  updateGroupMatch(groupKey, matchId, matchData) {
    this.ensureGroups();
    const group = this.state.groups[groupKey];
    if (!group) return false;

    const match = group.matches.find(m => m.id === matchId);
    if (!match) return false;

    if (matchData.court !== undefined) match.court = matchData.court;
    if (matchData.dateTime !== undefined) match.dateTime = matchData.dateTime;

    const g1 = matchData.games1 !== undefined && matchData.games1 !== null && matchData.games1 !== "" ? parseInt(matchData.games1, 10) : null;
    const g2 = matchData.games2 !== undefined && matchData.games2 !== null && matchData.games2 !== "" ? parseInt(matchData.games2, 10) : null;

    match.games1 = isNaN(g1) ? null : g1;
    match.games2 = isNaN(g2) ? null : g2;

    if (match.games1 !== null && match.games2 !== null) {
      match.scores = `${match.games1} - ${match.games2}`;
      match.status = matchData.status || "completato";

      if (match.games1 > match.games2) {
        match.winnerId = match.player1Id;
        match.isDraw = false;
      } else if (match.games2 > match.games1) {
        match.winnerId = match.player2Id;
        match.isDraw = false;
      } else {
        // Regolamento Momy: Al suono della campana rimane il pareggio nella fase a gironi
        match.winnerId = null;
        match.isDraw = true;
      }
    } else {
      match.scores = matchData.scores || "";
      match.winnerId = matchData.winnerId || null;
      match.isDraw = false;
      match.status = matchData.status || "in_programma";
    }

    return true;
  }

  getGroupStandings(groupKey) {
    this.ensureGroups();
    const group = this.state.groups[groupKey];
    if (!group) return [];

    const statsMap = {};

    group.playerIds.forEach(id => {
      const p = this.getPlayer(id);
      if (p) {
        statsMap[id] = {
          player: p,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gamesFor: 0,
          gamesAgainst: 0,
          diff: 0,
          points: 0
        };
      }
    });

    (group.matches || []).forEach(m => {
      if (m.status === "completato" && m.games1 !== null && m.games2 !== null) {
        const s1 = statsMap[m.player1Id];
        const s2 = statsMap[m.player2Id];

        if (s1 && s2) {
          s1.played++;
          s2.played++;
          s1.gamesFor += m.games1;
          s1.gamesAgainst += m.games2;
          s2.gamesFor += m.games2;
          s2.gamesAgainst += m.games1;

          if (m.isDraw || m.games1 === m.games2) {
            s1.drawn++;
            s2.drawn++;
            s1.points += 1;
            s2.points += 1;
          } else if (m.winnerId === m.player1Id) {
            s1.won++;
            s2.lost++;
            s1.points += 3;
          } else if (m.winnerId === m.player2Id) {
            s2.won++;
            s1.lost++;
            s2.points += 3;
          }
        }
      }
    });

    const standings = Object.values(statsMap);
    standings.forEach(s => {
      s.diff = s.gamesFor - s.gamesAgainst;
    });

    // Criteri ordinamento: Punti, Differenza Game, Game Fatti, Ranking
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.gamesFor !== a.gamesFor) return b.gamesFor - a.gamesFor;
      return (this.getRankingWeight(b.player.ranking) - this.getRankingWeight(a.player.ranking));
    });

    return standings;
  }

  generateBracketFromGroups(topCount = 2) {
    this.ensureGroups();
    const standingsSinner = this.getGroupStandings("sinner");
    const standingsAlcaraz = this.getGroupStandings("alcaraz");

    if (standingsSinner.length < topCount || standingsAlcaraz.length < topCount) {
      throw new Error(`Servono almeno ${topCount} atleti per ciascun girone per poter comporre il tabellone finale incrociato.`);
    }

    if (topCount === 2) {
      // 4 atleti: 1° Sinner vs 2° Alcaraz, 1° Alcaraz vs 2° Sinner
      const p1S = standingsSinner[0].player.id;
      const p2A = standingsAlcaraz[1].player.id;
      const p1A = standingsAlcaraz[0].player.id;
      const p2S = standingsSinner[1].player.id;

      const r1Matches = [
        {
          id: "m-r1-1",
          player1Id: p1S,
          player2Id: p2A,
          scores: "",
          winnerId: null,
          court: "Campo 1 (Centrale)",
          dateTime: "",
          status: "in_programma"
        },
        {
          id: "m-r1-2",
          player1Id: p1A,
          player2Id: p2S,
          scores: "",
          winnerId: null,
          court: "Campo 2",
          dateTime: "",
          status: "in_programma"
        }
      ];

      const r2Matches = [
        {
          id: "m-r2-1",
          player1Id: null,
          player2Id: null,
          scores: "",
          winnerId: null,
          court: "Campo 1 (Centrale)",
          dateTime: "",
          status: "in_programma"
        }
      ];

      this.state.bracket = {
        rounds: [
          { name: "Semifinali", matches: r1Matches },
          { name: "Finale", matches: r2Matches }
        ],
        source: "groups",
        createdAt: new Date().toISOString()
      };

      return this.state.bracket;
    } else {
      // Quarti di finale con 8 atleti (top 4 di entrambi i gironi)
      const s1 = standingsSinner[0].player.id;
      const a4 = standingsAlcaraz[3].player.id;
      const s2 = standingsSinner[1].player.id;
      const a3 = standingsAlcaraz[2].player.id;
      const a1 = standingsAlcaraz[0].player.id;
      const s4 = standingsSinner[3].player.id;
      const a2 = standingsAlcaraz[1].player.id;
      const s3 = standingsSinner[2].player.id;

      const qfMatches = [
        { id: "m-r1-1", player1Id: s1, player2Id: a4, scores: "", winnerId: null, court: "Campo 1 (Centrale)", dateTime: "", status: "in_programma" },
        { id: "m-r1-2", player1Id: s2, player2Id: a3, scores: "", winnerId: null, court: "Campo 2", dateTime: "", status: "in_programma" },
        { id: "m-r1-3", player1Id: a1, player2Id: s4, scores: "", winnerId: null, court: "Campo 1 (Centrale)", dateTime: "", status: "in_programma" },
        { id: "m-r1-4", player1Id: a2, player2Id: s3, scores: "", winnerId: null, court: "Campo 2", dateTime: "", status: "in_programma" }
      ];

      const sfMatches = [
        { id: "m-r2-1", player1Id: null, player2Id: null, scores: "", winnerId: null, court: "Campo 1 (Centrale)", dateTime: "", status: "in_programma" },
        { id: "m-r2-2", player1Id: null, player2Id: null, scores: "", winnerId: null, court: "Campo 2", dateTime: "", status: "in_programma" }
      ];

      const finalMatches = [
        { id: "m-r3-1", player1Id: null, player2Id: null, scores: "", winnerId: null, court: "Campo 1 (Centrale)", dateTime: "", status: "in_programma" }
      ];

      this.state.bracket = {
        rounds: [
          { name: "Quarti di Finale", matches: qfMatches },
          { name: "Semifinali", matches: sfMatches },
          { name: "Finale", matches: finalMatches }
        ],
        source: "groups",
        createdAt: new Date().toISOString()
      };

      return this.state.bracket;
    }
  }
}
