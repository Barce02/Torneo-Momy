// Gestione Logica Torneo Momy (Categorie U9, U12, Open, Gironi Sinner & Alcaraz e Tabellone)

class TournamentManager {
  constructor(state) {
    this.state = state;
    this.ensureCategories();
  }

  // Categorie ufficiali del Torneo Momy
  static get CATEGORIES() {
    return ["U9", "U12", "Open"];
  }

  getPlayer(id) {
    if (!id) return null;
    return this.state.players.find(p => p.id === id) || null;
  }

  // Rileva o restituisce la categoria dell'atleta (U9, U12 o Open)
  getPlayerCategory(player) {
    if (!player) return "U12";
    if (player.category && ["U9", "U12", "Open"].includes(player.category)) {
      return player.category;
    }
    // Calcolo automatico in base ad anno di nascita
    let year = null;
    if (player.birthDate) {
      const d = new Date(player.birthDate);
      if (!isNaN(d.getFullYear())) year = d.getFullYear();
    } else if (player.year) {
      year = parseInt(player.year, 10);
    }
    if (year && !isNaN(year)) {
      if (year >= 2017) return "U9";
      if (year >= 2014) return "U12";
      return "Open";
    }
    return "U12";
  }

  // Restituisce la lista di giocatori filtrata per categoria
  getPlayersByCategory(category) {
    if (!category || category === "all") return this.state.players || [];
    return (this.state.players || []).filter(p => this.getPlayerCategory(p) === category);
  }

  // Inizializza e migra la struttura multi-categoria
  ensureCategories() {
    if (!this.state.categoryGroups) {
      this.state.categoryGroups = {};
    }
    // Migrazione gironi pregressi verso U12
    if (this.state.groups && !this.state.categoryGroups["U12"]) {
      this.state.categoryGroups["U12"] = this.state.groups;
    }

    ["U9", "U12", "Open"].forEach(cat => {
      if (!this.state.categoryGroups[cat]) {
        this.state.categoryGroups[cat] = {
          sinner: { id: "sinner", name: `Girone Sinner (${cat})`, playerIds: [], matches: [] },
          alcaraz: { id: "alcaraz", name: `Girone Alcaraz (${cat})`, playerIds: [], matches: [] }
        };
      } else {
        if (!this.state.categoryGroups[cat].sinner) {
          this.state.categoryGroups[cat].sinner = { id: "sinner", name: `Girone Sinner (${cat})`, playerIds: [], matches: [] };
        }
        if (!this.state.categoryGroups[cat].alcaraz) {
          this.state.categoryGroups[cat].alcaraz = { id: "alcaraz", name: `Girone Alcaraz (${cat})`, playerIds: [], matches: [] };
        }
      }
    });

    if (!this.state.categoryBrackets) {
      this.state.categoryBrackets = {};
    }
    // Migrazione tabellone pregresso verso U12
    if (this.state.bracket && !this.state.categoryBrackets["U12"]) {
      this.state.categoryBrackets["U12"] = this.state.bracket;
    }

    // Assicura categoria su tutti i giocatori
    if (this.state.players) {
      this.state.players.forEach(p => {
        if (!p.category) {
          p.category = this.getPlayerCategory(p);
        }
      });
    }
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

  // ==========================================
  // METODI GESTIONE TABELLONE FINALE PER CATEGORIA
  // ==========================================
  ensureBrackets(category = "U12") {
    this.ensureCategories();
    const cat = category || "U12";
    this.state.bracket = this.state.categoryBrackets[cat] || null;
    return this.state.categoryBrackets[cat] || null;
  }

  // Genera un tabellone a eliminazione diretta per una categoria
  generateBracket(playersList = null, category = "U12") {
    this.ensureCategories();
    const cat = category || "U12";
    const rawPlayers = playersList || this.state.players;
    const players = rawPlayers.filter(p => this.getPlayerCategory(p) === cat);

    if (!players || players.length < 2) {
      throw new Error(`Servono almeno 2 atleti iscritti nella categoria ${cat} per comporre il tabellone finale.`);
    }

    // Ordina i partecipanti in base alla classifica FITP
    const sortedPlayers = [...players].sort((a, b) => {
      const weightA = this.getRankingWeight(a.ranking);
      const weightB = this.getRankingWeight(b.ranking);
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return Math.random() - 0.5;
    });

    let bracketSize = 4;
    if (sortedPlayers.length > 16) bracketSize = 32;
    else if (sortedPlayers.length > 8) bracketSize = 16;
    else if (sortedPlayers.length > 4) bracketSize = 8;
    else bracketSize = 4;

    const slots = new Array(bracketSize).fill(null);

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
      const matchId = `m-${cat.toLowerCase()}-r1-${(i / 2) + 1}`;
      
      let winnerId = null;
      let status = "in_programma";
      let scores = "";

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
        category: cat,
        player1Id: p1 === "BYE" ? null : p1,
        player2Id: p2 === "BYE" ? null : p2,
        scores: scores,
        winnerId: winnerId,
        court: (i / 2) % 2 === 0 ? "Campo 0 (Terra)" : "Campo 1 (Terra)",
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

        const matchId = `m-${cat.toLowerCase()}-r${r + 1}-${m + 1}`;
        currentMatches.push({
          id: matchId,
          category: cat,
          player1Id: p1,
          player2Id: p2,
          scores: "",
          winnerId: null,
          court: "Campo 0 (Terra)",
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
      category: cat,
      rounds: rounds,
      createdAt: new Date().toISOString()
    };

    this.state.categoryBrackets[cat] = bracket;
    this.state.bracket = bracket;
    return bracket;
  }

  // Aggiorna punteggio ed avanza il vincitore nel tabellone
  updateBracketMatch(matchId, updateData, category = null) {
    this.ensureCategories();
    const cats = category ? [category] : ["U9", "U12", "Open"];

    for (let cat of cats) {
      const bracket = this.state.categoryBrackets[cat];
      if (!bracket || !bracket.rounds) continue;

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

      if (!targetMatch) continue;

      const oldWinnerId = targetMatch.winnerId;

      if (updateData.scores !== undefined) targetMatch.scores = updateData.scores;
      if (updateData.winnerId !== undefined) targetMatch.winnerId = updateData.winnerId;
      if (updateData.court !== undefined) targetMatch.court = updateData.court;
      if (updateData.dateTime !== undefined) targetMatch.dateTime = updateData.dateTime;
      if (updateData.status !== undefined) targetMatch.status = updateData.status;

      // Avanzamento al round successivo
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
        category: cat,
        isChampionDecided: isChampionDecided,
        winner: isChampionDecided ? this.getPlayer(targetMatch.winnerId) : null
      };
    }

    return false;
  }

  // ==========================================
  // METODI GESTIONE FASE A GIRONI PER CATEGORIA
  // ==========================================
  ensureGroups(category = "U12") {
    this.ensureCategories();
    const cat = category || "U12";
    const catGroup = this.state.categoryGroups[cat];
    this.state.groups = catGroup;
    return catGroup;
  }

  autoAssignGroups(category = "U12") {
    this.ensureCategories();
    const cat = category || "U12";
    const group = this.state.categoryGroups[cat];

    // Filtra solo gli atleti appartenenti a questa categoria!
    const players = this.state.players
      .filter(p => this.getPlayerCategory(p) === cat)
      .sort((a, b) => {
        const weightA = this.getRankingWeight(a.ranking);
        const weightB = this.getRankingWeight(b.ranking);
        if (weightA !== weightB) return weightB - weightA;
        return (a.lastName || "").localeCompare(b.lastName || "");
      });

    const sinnerIds = [];
    const alcarazIds = [];

    // Snake draft serpentina
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

    group.sinner.playerIds = sinnerIds;
    group.alcaraz.playerIds = alcarazIds;

    this.generateGroupMatches("sinner", cat);
    this.generateGroupMatches("alcaraz", cat);

    this.state.groups = group;
    return group;
  }

  assignPlayerToGroup(playerId, targetGroupKey, category = "U12") {
    this.ensureCategories();
    const cat = category || "U12";
    const group = this.state.categoryGroups[cat];

    group.sinner.playerIds = group.sinner.playerIds.filter(id => id !== playerId);
    group.alcaraz.playerIds = group.alcaraz.playerIds.filter(id => id !== playerId);

    if (targetGroupKey === "sinner" || targetGroupKey === "alcaraz") {
      group[targetGroupKey].playerIds.push(playerId);
      this.generateGroupMatches(targetGroupKey, cat);
    }
  }

  generateGroupMatches(groupKey, category = "U12") {
    this.ensureCategories();
    const cat = category || "U12";
    const catGroup = this.state.categoryGroups[cat];
    const group = catGroup[groupKey];
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
            id: `gm-${cat.toLowerCase()}-${groupKey}-${matchCount}`,
            groupKey: groupKey,
            category: cat,
            player1Id: p1Id,
            player2Id: p2Id,
            games1: null,
            games2: null,
            scores: "",
            winnerId: null,
            isDraw: false,
            court: groupKey === "sinner" ? "Campo 0 (Terra)" : "Campo 1 (Terra)",
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

  updateGroupMatch(groupKey, matchId, matchData, category = null) {
    this.ensureCategories();
    const cats = category ? [category] : ["U9", "U12", "Open"];

    for (let cat of cats) {
      const catGroup = this.state.categoryGroups[cat];
      if (!catGroup) continue;
      const group = catGroup[groupKey];
      if (!group) continue;

      const match = group.matches.find(m => m.id === matchId);
      if (!match) continue;

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

    return false;
  }

  getHeadToHeadWinner(matches, p1Id, p2Id) {
    if (!matches || matches.length === 0) return null;
    const m = matches.find(match =>
      match.status === "completato" &&
      ((match.player1Id === p1Id && match.player2Id === p2Id) ||
       (match.player1Id === p2Id && match.player2Id === p1Id))
    );
    if (!m) return null;
    if (m.isDraw || m.games1 === m.games2) return "DRAW";
    return m.winnerId || null;
  }

  getGroupStandings(groupKey, category = "U12") {
    this.ensureCategories();
    const cat = category || "U12";
    const catGroup = this.state.categoryGroups[cat];
    if (!catGroup) return [];
    const group = catGroup[groupKey];
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

    const pointsMap = {};
    standings.forEach(s => {
      const pt = s.points;
      if (!pointsMap[pt]) pointsMap[pt] = [];
      pointsMap[pt].push(s);
    });

    const sortedPoints = Object.keys(pointsMap).map(Number).sort((a, b) => b - a);
    const sortedStandings = [];

    sortedPoints.forEach(pt => {
      const cluster = pointsMap[pt];
      if (cluster.length === 1) {
        sortedStandings.push(cluster[0]);
      } else if (cluster.length === 2) {
        const p1 = cluster[0];
        const p2 = cluster[1];
        const h2h = this.getHeadToHeadWinner(group.matches || [], p1.player.id, p2.player.id);
        if (h2h === p1.player.id) {
          sortedStandings.push(p1, p2);
        } else if (h2h === p2.player.id) {
          sortedStandings.push(p2, p1);
        } else {
          cluster.sort((a, b) => {
            if (b.diff !== a.diff) return b.diff - a.diff;
            if (b.gamesFor !== a.gamesFor) return b.gamesFor - a.gamesFor;
            return this.getRankingWeight(b.player.ranking) - this.getRankingWeight(a.player.ranking);
          });
          sortedStandings.push(...cluster);
        }
      } else {
        cluster.sort((a, b) => {
          if (b.diff !== a.diff) return b.diff - a.diff;
          if (b.gamesFor !== a.gamesFor) return b.gamesFor - a.gamesFor;
          const h2h = this.getHeadToHeadWinner(group.matches || [], a.player.id, b.player.id);
          if (h2h === a.player.id) return -1;
          if (h2h === b.player.id) return 1;
          return this.getRankingWeight(b.player.ranking) - this.getRankingWeight(a.player.ranking);
        });
        sortedStandings.push(...cluster);
      }
    });

    return sortedStandings;
  }

  getCrossGroupSeedOrder(bracketSize) {
    if (bracketSize === 4) {
      return [1, 4, 3, 2];
    }
    if (bracketSize === 8) {
      return [1, 8, 4, 5, 3, 6, 2, 7];
    }
    if (bracketSize === 16) {
      return [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15];
    }
    if (bracketSize === 32) {
      const pairs = [
        [1, 32], [16, 17], [9, 24], [8, 25],
        [5, 28], [12, 21], [13, 20], [4, 29],
        [3, 30], [14, 19], [11, 22], [6, 27],
        [7, 26], [10, 23], [15, 18], [2, 31]
      ];
      return pairs.flat();
    }
    return Array.from({ length: bracketSize }, (_, i) => i + 1);
  }

  generateBracketFromGroups(category = "U12") {
    this.ensureCategories();
    const cat = category || "U12";
    const standingsSinner = this.getGroupStandings("sinner", cat);
    const standingsAlcaraz = this.getGroupStandings("alcaraz", cat);

    const totalInGroups = standingsSinner.length + standingsAlcaraz.length;
    if (totalInGroups < 2) {
      throw new Error(`Servono almeno 2 atleti inseriti nei gironi ${cat} per poter comporre il tabellone finale.`);
    }

    let bracketSize = 4;
    if (totalInGroups > 16) bracketSize = 32;
    else if (totalInGroups > 8) bracketSize = 16;
    else if (totalInGroups > 4) bracketSize = 8;
    else bracketSize = 4;

    const seedMap = {};
    let sIdx = 0;
    let aIdx = 0;

    for (let seed = 1; seed <= bracketSize; seed++) {
      if (seed % 2 === 1) {
        if (sIdx < standingsSinner.length) {
          seedMap[seed] = standingsSinner[sIdx].player.id;
          sIdx++;
        } else if (aIdx < standingsAlcaraz.length) {
          seedMap[seed] = standingsAlcaraz[aIdx].player.id;
          aIdx++;
        } else {
          seedMap[seed] = "BYE";
        }
      } else {
        if (aIdx < standingsAlcaraz.length) {
          seedMap[seed] = standingsAlcaraz[aIdx].player.id;
          aIdx++;
        } else if (sIdx < standingsSinner.length) {
          seedMap[seed] = standingsSinner[sIdx].player.id;
          sIdx++;
        } else {
          seedMap[seed] = "BYE";
        }
      }
    }

    const seedOrder = this.getCrossGroupSeedOrder(bracketSize);
    const slots = new Array(bracketSize).fill(null);
    for (let i = 0; i < bracketSize; i++) {
      const seedNum = seedOrder[i];
      slots[i] = seedMap[seedNum] || "BYE";
    }

    const totalRounds = Math.log2(bracketSize);
    const roundNamesMap = {
      1: ["Finale"],
      2: ["Semifinali", "Finale"],
      3: ["Quarti di Finale", "Semifinali", "Finale"],
      4: ["Ottavi di Finale", "Quarti di Finale", "Semifinali", "Finale"],
      5: ["Sedicesimi di Finale", "Ottavi di Finale", "Quarti di Finale", "Semifinali", "Finale"]
    };
    const names = roundNamesMap[totalRounds] || ["Turno 1", "Turno 2", "Semifinali", "Finale"];

    const r1Matches = [];
    for (let i = 0; i < bracketSize; i += 2) {
      const p1 = slots[i];
      const p2 = slots[i + 1];
      const matchId = `m-${cat.toLowerCase()}-r1-${(i / 2) + 1}`;

      let winnerId = null;
      let status = "in_programma";
      let scores = "";

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
        category: cat,
        player1Id: p1 === "BYE" ? null : p1,
        player2Id: p2 === "BYE" ? null : p2,
        scores: scores,
        winnerId: winnerId,
        court: (i / 2) % 2 === 0 ? "Campo 0 (Terra)" : "Campo 1 (Terra)",
        dateTime: "",
        status: status
      });
    }

    const rounds = [{
      name: names[0],
      matches: r1Matches
    }];

    let prevMatches = r1Matches;
    for (let r = 1; r < totalRounds; r++) {
      const currentMatches = [];
      const matchCount = prevMatches.length / 2;
      for (let m = 0; m < matchCount; m++) {
        const parent1 = prevMatches[m * 2];
        const parent2 = prevMatches[m * 2 + 1];

        const p1 = parent1.winnerId || null;
        const p2 = parent2.winnerId || null;

        const matchId = `m-${cat.toLowerCase()}-r${r + 1}-${m + 1}`;
        currentMatches.push({
          id: matchId,
          category: cat,
          player1Id: p1,
          player2Id: p2,
          scores: "",
          winnerId: null,
          court: "Campo 0 (Terra)",
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
      category: cat,
      rounds: rounds,
      source: "groups",
      createdAt: new Date().toISOString()
    };

    this.state.categoryBrackets[cat] = bracket;
    this.state.bracket = bracket;
    return bracket;
  }
}
