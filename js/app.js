// Gestione Principale dell'Applicazione Torneo Tennis

// Chiave LocalStorage
const STORAGE_KEY = "torneo_tennis_ragazzi_v1";

class App {
  constructor() {
    this.state = this.loadState();
    this.tournamentManager = new TournamentManager(this.state);
    this.isAdmin = false;
    this.currentTab = "bracket";
    this.selectedCategory = this.state.tournament.categories[1] || this.state.tournament.categories[0];
    this.currentEditingMatch = null;

    this.init();
  }

  // Caricamento dello stato da LocalStorage o dai dati demo
  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Impossibile caricare dati da localStorage, uso dati demo", e);
    }
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  // Salvataggio stato persistente
  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error("Errore nel salvataggio in localStorage", e);
    }
  }

  init() {
    this.bindEvents();
    this.renderHeader();
    this.renderCategorySelector();
    this.renderTabContent();
  }

  bindEvents() {
    // Navigazione Tab
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Toggle Admin Mode
    const adminToggleBtn = document.getElementById("admin-toggle-btn");
    if (adminToggleBtn) {
      adminToggleBtn.addEventListener("click", () => {
        if (this.isAdmin) {
          this.setAdminMode(false);
        } else {
          this.openModal("modal-pin");
          document.getElementById("pin-input").value = "";
          document.getElementById("pin-input").focus();
        }
      });
    }

    // Conferma PIN Admin
    const pinForm = document.getElementById("pin-form");
    if (pinForm) {
      pinForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const pin = document.getElementById("pin-input").value.trim();
        if (pin === this.state.tournament.adminPin || pin === "1234") {
          this.setAdminMode(true);
          this.closeModal("modal-pin");
          this.showToast("Accesso Giudice Arbitro / Admin sbloccato!", "success");
        } else {
          this.showToast("PIN errato! Riprova.", "error");
        }
      });
    }

    // Form Iscrizione Pubblica (Genitori)
    const publicRegForm = document.getElementById("public-reg-form");
    if (publicRegForm) {
      publicRegForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handlePublicRegistration();
      });
    }

    // Form Salva Risultato Match
    const matchScoreForm = document.getElementById("match-score-form");
    if (matchScoreForm) {
      matchScoreForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveMatchScore();
      });
    }

    // Form Nuovo Giocatore
    const playerForm = document.getElementById("player-form");
    if (playerForm) {
      playerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSavePlayer();
      });
    }

    // Export Backup
    const exportBtn = document.getElementById("export-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportBackup());
    }

    // Import Backup
    const importInput = document.getElementById("import-file-input");
    if (importInput) {
      importInput.addEventListener("change", (e) => this.importBackup(e));
    }

    // Reset ai Dati Demo
    const resetDemoBtn = document.getElementById("reset-demo-btn");
    if (resetDemoBtn) {
      resetDemoBtn.addEventListener("click", () => {
        if (confirm("Vuoi reimpostare il torneo ai dati dimostrativi completi?")) {
          this.state = JSON.parse(JSON.stringify(INITIAL_DATA));
          this.tournamentManager = new TournamentManager(this.state);
          this.saveState();
          this.renderAll();
          this.showToast("Dati dimostrativi ripristinati con successo!", "success");
        }
      });
    }

    // Stampa Tabellone
    const printBtn = document.getElementById("print-bracket-btn");
    if (printBtn) {
      printBtn.addEventListener("click", () => window.print());
    }
  }

  setAdminMode(status) {
    this.isAdmin = status;
    const badge = document.getElementById("admin-badge");
    const toggleBtn = document.getElementById("admin-toggle-btn");

    if (this.isAdmin) {
      badge.textContent = "Modalità Organizzatore / Giudice Arbitro (Attiva)";
      badge.className = "bg-amber-100 text-amber-800 border border-amber-300 text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1.5";
      toggleBtn.innerHTML = `
        <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path>
        </svg>
        <span>Esci da Admin</span>
      `;
      document.body.classList.add("is-admin");
    } else {
      badge.textContent = "Vista Pubblica (Famiglie & Atleti)";
      badge.className = "bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1.5";
      toggleBtn.innerHTML = `
        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path>
        </svg>
        <span>Accedi come Admin</span>
      `;
      document.body.classList.remove("is-admin");
    }

    this.renderTabContent();
  }

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      if (btn.dataset.tab === tab) {
        btn.classList.add("border-tennis-green", "text-tennis-green", "bg-emerald-50/70", "font-semibold");
        btn.classList.remove("border-transparent", "text-gray-600", "hover:text-gray-900");
      } else {
        btn.classList.remove("border-tennis-green", "text-tennis-green", "bg-emerald-50/70", "font-semibold");
        btn.classList.add("border-transparent", "text-gray-600", "hover:text-gray-900");
      }
    });

    this.renderTabContent();
  }

  renderHeader() {
    const t = this.state.tournament;
    document.getElementById("tournament-title").textContent = t.name;
    document.getElementById("tournament-club").textContent = `${t.club} • ${t.address}`;
    document.getElementById("tournament-dates").textContent = `📅 ${t.dates}`;
  }

  renderCategorySelector() {
    const container = document.getElementById("category-selector");
    if (!container) return;

    container.innerHTML = "";
    this.state.tournament.categories.forEach(cat => {
      const isSelected = cat === this.selectedCategory;
      const btn = document.createElement("button");
      btn.className = `px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-150 ${
        isSelected
          ? "bg-tennis-green text-white shadow-sm ring-2 ring-emerald-500/30"
          : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
      }`;
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        this.selectedCategory = cat;
        this.renderCategorySelector();
        this.renderTabContent();
      });
      container.appendChild(btn);
    });
  }

  renderTabContent() {
    const tabPanels = ["bracket", "groups", "schedule", "players", "pending", "rules"];
    tabPanels.forEach(tp => {
      const el = document.getElementById(`tab-panel-${tp}`);
      if (el) {
        if (tp === this.currentTab) {
          el.classList.remove("hidden");
        } else {
          el.classList.add("hidden");
        }
      }
    });

    switch (this.currentTab) {
      case "bracket":
        this.renderBracketView();
        break;
      case "groups":
        this.renderGroupsView();
        break;
      case "schedule":
        this.renderScheduleView();
        break;
      case "players":
        this.renderPlayersView();
        break;
      case "pending":
        this.renderPendingView();
        break;
      case "rules":
        this.renderRulesView();
        break;
    }
  }

  renderAll() {
    this.renderHeader();
    this.renderCategorySelector();
    this.renderTabContent();
  }

  // ==========================================
  // 1. TABELLONE (BRACKET)
  // ==========================================
  renderBracketView() {
    const container = document.getElementById("bracket-container");
    if (!container) return;

    const cat = this.selectedCategory;
    const bracket = this.state.brackets ? this.state.brackets[cat] : null;

    let html = "";

    // Controlli di gestione tabellone (visibili solo ad Admin)
    const adminControls = this.isAdmin ? `
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-amber-800 font-semibold text-sm">🛠️ Gestione Tabellone [${cat}]:</span>
          <span class="text-xs text-amber-700">Clicca su una partita per inserire punteggio, campo e orario.</span>
        </div>
        <div class="flex gap-2">
          <button onclick="app.handleGenerateBracket('${cat}')" class="text-xs bg-tennis-green hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm">
            ${bracket ? "Rigenera Tabellone" : "Genera Tabellone"}
          </button>
          ${bracket ? `
            <button onclick="app.handleResetBracket('${cat}')" class="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-lg">
              Azzera Risultati
            </button>
          ` : ""}
        </div>
      </div>
    ` : "";

    html += adminControls;

    if (!bracket || !bracket.rounds || bracket.rounds.length === 0) {
      html += `
        <div class="text-center py-16 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div class="w-16 h-16 bg-emerald-100 text-tennis-green rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            🎾
          </div>
          <h3 class="text-lg font-bold text-gray-800 mb-1">Nessun tabellone generato per ${cat}</h3>
          <p class="text-sm text-gray-500 max-w-md mx-auto mb-6">
            ${this.isAdmin 
              ? "Hai abilitato la modalità organizzatore: clicca sul pulsante qui sotto per comporre il tabellone automaticamente con le teste di serie." 
              : "Il giudice arbitro non ha ancora pubblicato il tabellone definitivo per questa categoria."}
          </p>
          ${this.isAdmin ? `
            <button onclick="app.handleGenerateBracket('${cat}')" class="bg-tennis-green hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow transition">
              Crea Tabellone Automatico (${cat})
            </button>
          ` : ""}
        </div>
      `;
      container.innerHTML = html;
      return;
    }

    // Render visivo del tabellone ad albero
    html += `
      <div class="overflow-x-auto pb-6">
        <div class="bracket-tree flex gap-8 items-stretch min-w-max px-2 py-4">
    `;

    bracket.rounds.forEach((round, rIdx) => {
      const isFinal = rIdx === bracket.rounds.length - 1;
      html += `
        <div class="bracket-round flex flex-col justify-around min-w-[280px] max-w-[320px]">
          <div class="text-center mb-4">
            <span class="inline-block bg-emerald-900 text-emerald-100 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
              ${round.name}
            </span>
          </div>
          <div class="flex flex-col justify-around flex-grow gap-6">
      `;

      round.matches.forEach((match, mIdx) => {
        const p1 = this.tournamentManager.getPlayer(match.player1Id);
        const p2 = this.tournamentManager.getPlayer(match.player2Id);
        const hasWinner = !!match.winnerId;
        const isP1Winner = hasWinner && match.winnerId === match.player1Id;
        const isP2Winner = hasWinner && match.winnerId === match.player2Id;

        html += `
          <div class="match-card bg-white border ${hasWinner ? 'border-emerald-300' : 'border-gray-200'} rounded-xl shadow-sm hover:shadow-md transition relative overflow-hidden ${this.isAdmin ? 'cursor-pointer' : ''}"
               onclick="${this.isAdmin ? `app.openMatchModal('${cat}', '${match.id}')` : ''}">
            
            ${isFinal && hasWinner ? `
              <div class="bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-[11px] font-bold px-2 py-0.5 text-center uppercase tracking-wider flex items-center justify-center gap-1">
                🏆 Campione del Torneo
              </div>
            ` : ""}

            <div class="p-3">
              <!-- Giocatore 1 -->
              <div class="flex items-center justify-between py-1.5 border-b border-gray-100 ${isP1Winner ? 'font-bold text-emerald-900 bg-emerald-50/50 -mx-3 px-3 rounded' : 'text-gray-700'}">
                <div class="flex items-center gap-1.5 truncate">
                  ${p1 && p1.seed ? `<span class="text-[10px] bg-emerald-700 text-white font-bold px-1.5 py-0.2 rounded">${p1.seed}</span>` : ""}
                  <span class="truncate text-sm">${p1 ? p1.name : (match.player1Id ? match.player1Id : '<span class="text-gray-400 italic">In attesa</span>')}</span>
                  ${p1 && p1.club ? `<span class="text-[11px] text-gray-400">(${p1.club})</span>` : ""}
                </div>
                ${isP1Winner ? `<span class="text-emerald-600 font-extrabold text-sm ml-2">✓</span>` : ""}
              </div>

              <!-- Giocatore 2 -->
              <div class="flex items-center justify-between py-1.5 ${isP2Winner ? 'font-bold text-emerald-900 bg-emerald-50/50 -mx-3 px-3 rounded' : 'text-gray-700'}">
                <div class="flex items-center gap-1.5 truncate">
                  ${p2 && p2.seed ? `<span class="text-[10px] bg-emerald-700 text-white font-bold px-1.5 py-0.2 rounded">${p2.seed}</span>` : ""}
                  <span class="truncate text-sm">${p2 ? p2.name : (match.player2Id ? match.player2Id : '<span class="text-gray-400 italic">In attesa</span>')}</span>
                  ${p2 && p2.club ? `<span class="text-[11px] text-gray-400">(${p2.club})</span>` : ""}
                </div>
                ${isP2Winner ? `<span class="text-emerald-600 font-extrabold text-sm ml-2">✓</span>` : ""}
              </div>

              <!-- Risultato e Dettagli Match -->
              <div class="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <div>
                  ${match.scores ? `
                    <span class="font-mono font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded text-xs">
                      ${match.scores}
                    </span>
                  ` : `
                    <span class="text-gray-400 text-[11px]">${match.status === 'in_corso' ? '🟡 In corso...' : 'Da disputare'}</span>
                  `}
                </div>
                <div class="text-right text-[11px] text-gray-500">
                  ${match.dateTime ? this.formatShortDate(match.dateTime) : ''}
                  ${match.court ? `<span class="ml-1 font-medium text-gray-600">• ${match.court.split(' ')[0]} ${match.court.split(' ')[1] || ''}</span>` : ''}
                </div>
              </div>

              ${this.isAdmin ? `
                <div class="mt-2 text-center text-[10px] text-tennis-green font-semibold bg-emerald-50 py-1 rounded hover:bg-emerald-100">
                  ✏️ Modifica Risultato & Orario
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  handleGenerateBracket(category) {
    try {
      this.tournamentManager.generateBracket(category);
      this.saveState();
      this.renderBracketView();
      this.showToast(`Tabellone generato con successo per ${category}!`, "success");
    } catch (e) {
      alert(e.message);
    }
  }

  handleResetBracket(category) {
    if (confirm(`Sei sicuro di voler azzerare tutti i risultati del tabellone ${category}?`)) {
      this.handleGenerateBracket(category);
    }
  }

  // ==========================================
  // 2. FASE A GIRONI (ROUND ROBIN)
  // ==========================================
  renderGroupsView() {
    const container = document.getElementById("groups-container");
    if (!container) return;

    const cat = this.selectedCategory;
    const catGroups = this.state.groups ? this.state.groups[cat] || [] : [];

    let html = "";

    const adminHeader = this.isAdmin ? `
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm font-semibold text-amber-900">
          🛠️ Gestione Gironi per ${cat}
        </div>
        <button onclick="app.openNewGroupModal('${cat}')" class="text-xs bg-tennis-green hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm">
          + Crea Nuovo Girone
        </button>
      </div>
    ` : "";

    html += adminHeader;

    if (catGroups.length === 0) {
      html += `
        <div class="text-center py-16 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div class="w-16 h-16 bg-emerald-100 text-tennis-green rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            🔄
          </div>
          <h3 class="text-lg font-bold text-gray-800 mb-1">Nessun girone configurato per ${cat}</h3>
          <p class="text-sm text-gray-500 max-w-md mx-auto mb-6">
            La formula a gironi (Round Robin) è ideale per le categorie Under 10 e Under 12 per garantire più incontri a ciascun ragazzo.
          </p>
          ${this.isAdmin ? `
            <button onclick="app.openNewGroupModal('${cat}')" class="bg-tennis-green hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow transition">
              Crea Girone per ${cat}
            </button>
          ` : ""}
        </div>
      `;
      container.innerHTML = html;
      return;
    }

    catGroups.forEach((group, gIdx) => {
      const standings = this.tournamentManager.calculateGroupStandings(group);

      html += `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          <div class="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between">
            <h3 class="font-bold text-base flex items-center gap-2">
              <span>🎾</span> ${group.name} (${cat})
            </h3>
            <span class="text-xs bg-emerald-950/60 text-emerald-200 px-3 py-1 rounded-full font-mono">
              ${group.playerIds.length} Atleti • ${group.matches.length} Partite
            </span>
          </div>

          <div class="p-5">
            <!-- Tabella Classifica -->
            <h4 class="font-bold text-sm text-gray-700 mb-2.5 flex items-center gap-1.5">
              <span>📊</span> Classifica Girone
            </h4>
            <div class="overflow-x-auto mb-6">
              <table class="w-full text-xs sm:text-sm text-left border-collapse">
                <thead>
                  <tr class="bg-gray-100 text-gray-600 uppercase text-[11px] font-semibold border-b">
                    <th class="py-2.5 px-3">Pos</th>
                    <th class="py-2.5 px-3">Giocatore</th>
                    <th class="py-2.5 px-3">Circolo</th>
                    <th class="py-2.5 px-2 text-center">G</th>
                    <th class="py-2.5 px-2 text-center">V</th>
                    <th class="py-2.5 px-2 text-center">P</th>
                    <th class="py-2.5 px-2 text-center">Set V-P</th>
                    <th class="py-2.5 px-2 text-center">Game V-P</th>
                    <th class="py-2.5 px-3 text-center font-bold text-emerald-800">Punti</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  ${standings.map((st, pos) => `
                    <tr class="hover:bg-gray-50/70 transition ${pos < 2 ? 'bg-emerald-50/30 font-medium' : ''}">
                      <td class="py-2 px-3 font-bold ${pos === 0 ? 'text-amber-500' : pos === 1 ? 'text-gray-400' : 'text-gray-600'}">
                        ${pos + 1}° ${pos === 0 ? '🥇' : pos === 1 ? '🥈' : ''}
                      </td>
                      <td class="py-2 px-3 text-gray-900">${st.name}</td>
                      <td class="py-2 px-3 text-gray-500 text-xs">${st.club || '-'}</td>
                      <td class="py-2 px-2 text-center text-gray-600">${st.played}</td>
                      <td class="py-2 px-2 text-center text-emerald-600 font-bold">${st.won}</td>
                      <td class="py-2 px-2 text-center text-rose-500">${st.lost}</td>
                      <td class="py-2 px-2 text-center text-gray-600 font-mono text-xs">${st.setsWon}-${st.setsLost}</td>
                      <td class="py-2 px-2 text-center text-gray-600 font-mono text-xs">${st.gamesWon}-${st.gamesLost}</td>
                      <td class="py-2 px-3 text-center font-bold text-tennis-green text-sm">${st.points}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Calendario Incontri del Girone -->
            <h4 class="font-bold text-sm text-gray-700 mb-2.5 flex items-center gap-1.5">
              <span>📅</span> Partite del Girone
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${group.matches.map(m => {
                const p1 = this.tournamentManager.getPlayer(m.p1);
                const p2 = this.tournamentManager.getPlayer(m.p2);
                const isP1Win = m.winnerId === m.p1;
                const isP2Win = m.winnerId === m.p2;

                return `
                  <div class="border rounded-xl p-3 bg-gray-50/50 hover:bg-white hover:border-emerald-300 transition ${this.isAdmin ? 'cursor-pointer' : ''}"
                       onclick="${this.isAdmin ? `app.openGroupMatchModal('${cat}', ${gIdx}, '${m.id}')` : ''}">
                    <div class="flex justify-between items-center mb-1 text-xs text-gray-500">
                      <span>${m.court || 'Campo da definire'}</span>
                      <span>${m.dateTime ? this.formatShortDate(m.dateTime) : 'Orario da fissare'}</span>
                    </div>

                    <div class="flex items-center justify-between">
                      <div class="space-y-1">
                        <div class="text-sm ${isP1Win ? 'font-bold text-emerald-800' : 'text-gray-800'}">
                          ${p1 ? p1.name : 'TBD'} ${isP1Win ? '✓' : ''}
                        </div>
                        <div class="text-sm ${isP2Win ? 'font-bold text-emerald-800' : 'text-gray-800'}">
                          ${p2 ? p2.name : 'TBD'} ${isP2Win ? '✓' : ''}
                        </div>
                      </div>
                      <div>
                        ${m.scores ? `
                          <span class="font-mono text-xs font-bold text-tennis-green bg-emerald-100 px-2 py-1 rounded">
                            ${m.scores}
                          </span>
                        ` : `
                          <span class="text-xs text-gray-400">Da disputare</span>
                        `}
                      </div>
                    </div>

                    ${this.isAdmin ? `
                      <div class="mt-2 text-right">
                        <span class="text-[10px] text-tennis-green font-semibold">✏️ Modifica</span>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  openNewGroupModal(category) {
    const confirmedPlayers = this.state.players.filter(p => p.category === category && p.status === "confermato");
    if (confirmedPlayers.length < 3) {
      alert(`Servono almeno 3 giocatori confermati nella categoria ${category} per formare un girone.`);
      return;
    }

    const groupName = prompt(`Inserisci il nome del nuovo girone (es: Girone A, Girone Rosso):`, `Girone ${String.fromCharCode(65 + (this.state.groups && this.state.groups[category] ? this.state.groups[category].length : 0))}`);
    if (!groupName) return;

    // Assegna tutti i giocatori disponibili non ancora in un girone oppure chiedi
    const playerIds = confirmedPlayers.map(p => p.id);
    this.tournamentManager.createGroup(category, groupName, playerIds);
    this.saveState();
    this.renderGroupsView();
    this.showToast(`Girone "${groupName}" creato con successo!`, "success");
  }

  // ==========================================
  // 3. PROGRAMMA CAMPI (ORDER OF PLAY)
  // ==========================================
  renderScheduleView() {
    const container = document.getElementById("schedule-container");
    if (!container) return;

    const allMatches = this.tournamentManager.getAllMatches();

    if (allMatches.length === 0) {
      container.innerHTML = `
        <div class="text-center py-16 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div class="w-16 h-16 bg-emerald-100 text-tennis-green rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            📅
          </div>
          <h3 class="text-lg font-bold text-gray-800 mb-1">Nessun incontro programmato</h3>
          <p class="text-sm text-gray-500">I match appariranno qui man mano che verranno fissati orari e campi.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 class="text-lg font-bold text-gray-900">Programma Ufficiale di Gioco</h3>
          <p class="text-xs text-gray-500">Orari indicativi degli incontri su tutti i campi del circolo</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="app.filterSchedule('all')" class="schedule-filter-btn px-3 py-1 rounded-full text-xs font-semibold bg-tennis-green text-white" data-filter="all">Tutti</button>
          <button onclick="app.filterSchedule('in_corso')" class="schedule-filter-btn px-3 py-1 rounded-full text-xs font-medium bg-white text-gray-700 border hover:bg-gray-100" data-filter="in_corso">In Corso</button>
          <button onclick="app.filterSchedule('in_programma')" class="schedule-filter-btn px-3 py-1 rounded-full text-xs font-medium bg-white text-gray-700 border hover:bg-gray-100" data-filter="in_programma">Da Giocare</button>
          <button onclick="app.filterSchedule('completato')" class="schedule-filter-btn px-3 py-1 rounded-full text-xs font-medium bg-white text-gray-700 border hover:bg-gray-100" data-filter="completato">Terminati</button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="schedule-matches-grid">
    `;

    allMatches.forEach(m => {
      const p1 = m.player1;
      const p2 = m.player2;
      const statusBadge = this.getStatusBadge(m.status);

      html += `
        <div class="schedule-card bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow transition relative" data-status="${m.status}">
          <div class="flex justify-between items-start mb-2.5">
            <span class="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              ${m.category}
            </span>
            ${statusBadge}
          </div>

          <div class="space-y-1.5 mb-3">
            <div class="text-sm font-semibold flex items-center justify-between text-gray-800">
              <span class="truncate">${p1 ? p1.name : 'Da definire'}</span>
              ${m.winnerId && p1 && m.winnerId === p1.id ? '<span class="text-emerald-600 font-bold">✓</span>' : ''}
            </div>
            <div class="text-xs text-gray-400 font-bold uppercase text-center">- VS -</div>
            <div class="text-sm font-semibold flex items-center justify-between text-gray-800">
              <span class="truncate">${p2 ? p2.name : 'Da definire'}</span>
              ${m.winnerId && p2 && m.winnerId === p2.id ? '<span class="text-emerald-600 font-bold">✓</span>' : ''}
            </div>
          </div>

          <div class="pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
            <div class="text-gray-600 font-medium flex items-center gap-1">
              <span>🏟️</span> ${m.court || 'Campo TBD'}
            </div>
            <div class="font-semibold text-tennis-green">
              ${m.dateTime ? this.formatShortDate(m.dateTime) : 'Orario da fissare'}
            </div>
          </div>

          ${m.scores ? `
            <div class="mt-2 text-center bg-gray-50 py-1 rounded font-mono font-bold text-xs text-tennis-green border">
              Risultato: ${m.scores}
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  filterSchedule(status) {
    document.querySelectorAll(".schedule-filter-btn").forEach(b => {
      if (b.dataset.filter === status) {
        b.className = "schedule-filter-btn px-3 py-1 rounded-full text-xs font-semibold bg-tennis-green text-white";
      } else {
        b.className = "schedule-filter-btn px-3 py-1 rounded-full text-xs font-medium bg-white text-gray-700 border hover:bg-gray-100";
      }
    });

    document.querySelectorAll(".schedule-card").forEach(card => {
      if (status === "all" || card.dataset.status === status) {
        card.classList.remove("hidden");
      } else {
        card.classList.add("hidden");
      }
    });
  }

  getStatusBadge(status) {
    switch (status) {
      case "in_corso":
        return `<span class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">● LIVE</span>`;
      case "completato":
        return `<span class="bg-gray-100 text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded-full">Terminato</span>`;
      default:
        return `<span class="bg-blue-50 text-blue-700 text-[10px] font-medium px-2 py-0.5 rounded-full">In programma</span>`;
    }
  }

  // ==========================================
  // 4. ISCRITTI & GIOCATORI
  // ==========================================
  renderPlayersView() {
    const container = document.getElementById("players-container");
    if (!container) return;

    const players = this.state.players;
    const cat = this.selectedCategory;
    const filtered = players.filter(p => !cat || p.category === cat);

    let html = `
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
          <div>
            <h3 class="text-lg font-bold text-gray-900">Elenco Iscritti - ${cat}</h3>
            <p class="text-xs text-gray-500">${filtered.length} atleti registrati in questa categoria</p>
          </div>
          ${this.isAdmin ? `
            <button onclick="app.openNewPlayerModal()" class="bg-tennis-green hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5">
              <span>+</span> Aggiungi Ragazzo/a
            </button>
          ` : `
            <button onclick="app.openModal('modal-public-reg')" class="bg-tennis-green hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5">
              <span>📝</span> Iscrivi Tuo Figlio Online
            </button>
          `}
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 text-gray-600 uppercase text-[11px] font-semibold border-b">
                <th class="py-3 px-3">T.d.S.</th>
                <th class="py-3 px-3">Atleta</th>
                <th class="py-3 px-3">Anno</th>
                <th class="py-3 px-3">Circolo</th>
                <th class="py-3 px-3">Class.</th>
                ${this.isAdmin ? '<th class="py-3 px-3">Genitore / Tel</th>' : ''}
                <th class="py-3 px-3">Stato</th>
                ${this.isAdmin ? '<th class="py-3 px-3 text-right">Azioni</th>' : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${filtered.map(p => `
                <tr class="hover:bg-gray-50 transition">
                  <td class="py-2.5 px-3">
                    ${p.seed ? `<span class="bg-tennis-green text-white font-bold text-xs px-2 py-0.5 rounded-full">[${p.seed}]</span>` : '<span class="text-gray-300">-</span>'}
                  </td>
                  <td class="py-2.5 px-3 font-semibold text-gray-900">${p.name}</td>
                  <td class="py-2.5 px-3 text-gray-600">${p.birthYear || '-'}</td>
                  <td class="py-2.5 px-3 text-gray-600">${p.club || '-'}</td>
                  <td class="py-2.5 px-3 font-mono text-gray-700">${p.ranking || 'NC'}</td>
                  ${this.isAdmin ? `
                    <td class="py-2.5 px-3 text-gray-500 text-xs">
                      ${p.parentName || ''} ${p.parentPhone ? `(${p.parentPhone})` : ''}
                    </td>
                  ` : ''}
                  <td class="py-2.5 px-3">
                    <span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Confermato
                    </span>
                  </td>
                  ${this.isAdmin ? `
                    <td class="py-2.5 px-3 text-right space-x-1">
                      <button onclick="app.editPlayer('${p.id}')" class="text-gray-500 hover:text-emerald-700 p-1 text-xs">✏️</button>
                      <button onclick="app.deletePlayer('${p.id}')" class="text-gray-500 hover:text-rose-600 p-1 text-xs">🗑️</button>
                    </td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // ==========================================
  // 5. PRE-ISCRIZIONI (RICHIESTE GENITORI)
  // ==========================================
  renderPendingView() {
    const container = document.getElementById("pending-container");
    if (!container) return;

    const regs = this.state.registrations || [];

    let html = `
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div class="flex justify-between items-center mb-5">
          <div>
            <h3 class="text-lg font-bold text-gray-900">Richieste di Iscrizione Online</h3>
            <p class="text-xs text-gray-500">Istanze inviate dalle famiglie in attesa di approvazione del comitato organizzatore</p>
          </div>
          <button onclick="app.openModal('modal-public-reg')" class="bg-tennis-green text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm">
            + Compila Nuova Richiesta
          </button>
        </div>
    `;

    if (regs.length === 0) {
      html += `
        <div class="text-center py-12 text-gray-400">
          <p class="text-sm">Nessuna richiesta di iscrizione in sospeso al momento.</p>
        </div>
      `;
    } else {
      html += `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${regs.map(reg => `
            <div class="border border-gray-200 rounded-xl p-4 bg-gray-50/50 flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-start mb-2">
                  <h4 class="font-bold text-base text-gray-900">${reg.name}</h4>
                  <span class="text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                    In attesa
                  </span>
                </div>
                <div class="text-xs text-gray-600 space-y-1 mb-3">
                  <div><strong>Categoria:</strong> ${reg.category}</div>
                  <div><strong>Anno di nascita:</strong> ${reg.birthYear} • <strong>Classifica:</strong> ${reg.ranking}</div>
                  <div><strong>Circolo:</strong> ${reg.club}</div>
                  <div><strong>Genitore:</strong> ${reg.parentName} (${reg.parentPhone})</div>
                  ${reg.notes ? `<div class="bg-white p-2 rounded border text-gray-500 italic mt-1">"${reg.notes}"</div>` : ''}
                </div>
              </div>

              ${this.isAdmin ? `
                <div class="pt-3 border-t flex justify-end gap-2">
                  <button onclick="app.rejectRegistration('${reg.id}')" class="text-xs text-rose-600 hover:bg-rose-50 font-medium px-3 py-1.5 rounded-lg border border-rose-200">
                    Rifiuta
                  </button>
                  <button onclick="app.approveRegistration('${reg.id}')" class="text-xs bg-tennis-green hover:bg-emerald-700 text-white font-semibold px-4 py-1.5 rounded-lg shadow-sm">
                    Accetta & Aggiungi al Torneo
                  </button>
                </div>
              ` : `
                <div class="pt-2 border-t text-[11px] text-gray-400 italic">
                  In attesa di revisione da parte del giudice arbitro
                </div>
              `}
            </div>
          `).join('')}
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  // ==========================================
  // 6. INFO TORNEO & REGOLAMENTO
  // ==========================================
  renderRulesView() {
    const container = document.getElementById("rules-container");
    if (!container) return;

    const t = this.state.tournament;

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📋</span> Regolamento Ufficiale del Torneo Giovanile
            </h3>
            <div class="prose prose-sm text-gray-600 space-y-4">
              <p>
                Il presente torneo è riservato alle categorie giovanili con l'obiettivo prioritario di promuovere i valori di <strong>fair play</strong>, sportività e divertimento sul campo da tennis.
              </p>

              <div class="bg-emerald-50 border-l-4 border-tennis-green p-4 rounded-r-xl">
                <h4 class="font-bold text-tennis-green text-sm mb-1">Formula dei Punteggi</h4>
                <p class="text-xs text-gray-700 leading-relaxed">${t.rules}</p>
              </div>

              <h4 class="font-bold text-gray-800 text-sm">Codice di Condotta per Ragazzi e Genitori</h4>
              <ul class="list-disc pl-5 text-xs text-gray-600 space-y-1.5">
                <li>I ragazzi chiamano autonomamente le palle fuori nel proprio campo; in caso di dubbio si rigioca il punto con fair play.</li>
                <li>I genitori sono pregati di sostenere calorosamente tutti i partecipanti senza intervenire nelle decisioni di campo.</li>
                <li>Si richiede la presentazione al circolo 20 minuti prima dell'orario fissato per l'incontro.</li>
                <li>Riscaldamento massimo consentito prima del match: 5 minuti.</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 class="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span>🏟️</span> Circolo Ospitante
            </h3>
            <div class="text-xs text-gray-600 space-y-2">
              <div><strong>Circolo:</strong> ${t.club}</div>
              <div><strong>Indirizzo:</strong> ${t.address}</div>
              <div><strong>Date di svolgimento:</strong> ${t.dates}</div>
              <div><strong>Direttore Torneo:</strong> ${t.director}</div>
              <div><strong>Ufficiale di Gara:</strong> ${t.referee}</div>
            </div>

            <div class="mt-4 pt-4 border-t border-gray-100">
              <h4 class="font-bold text-xs text-gray-800 mb-2">Campi Disponibili</h4>
              <ul class="text-xs text-gray-600 space-y-1">
                ${t.courts.map(c => `<li class="flex items-center gap-1.5"><span>🎾</span> ${c}</li>`).join('')}
              </ul>
            </div>
          </div>

          <div class="bg-gradient-to-br from-emerald-800 to-tennis-green rounded-2xl p-6 text-white shadow">
            <h3 class="font-bold text-base mb-2">Sei un genitore?</h3>
            <p class="text-xs text-emerald-100 mb-4 leading-relaxed">
              Puoi inviare la richiesta di iscrizione di tuo figlio/a direttamente online senza dover telefonare o recarti in segreteria.
            </p>
            <button onclick="app.openModal('modal-public-reg')" class="w-full bg-white text-tennis-green font-bold text-xs py-2.5 px-4 rounded-xl shadow hover:bg-emerald-50 transition">
              Iscrivi Ora Tuo Figlio
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // MODALE GESTIONE RISULTATO MATCH
  // ==========================================
  openMatchModal(category, matchId) {
    const bracket = this.state.brackets[category];
    if (!bracket) return;

    let targetMatch = null;
    bracket.rounds.forEach(r => {
      const found = r.matches.find(m => m.id === matchId);
      if (found) targetMatch = found;
    });

    if (!targetMatch) return;

    this.currentEditingMatch = {
      type: 'bracket',
      category: category,
      matchId: matchId,
      match: targetMatch
    };

    this.populateMatchModal(targetMatch);
    this.openModal("modal-match-score");
  }

  openGroupMatchModal(category, groupIndex, matchId) {
    const group = this.state.groups[category][groupIndex];
    if (!group) return;
    const match = group.matches.find(m => m.id === matchId);
    if (!match) return;

    this.currentEditingMatch = {
      type: 'group',
      category: category,
      groupIndex: groupIndex,
      matchId: matchId,
      match: match
    };

    this.populateMatchModal(match);
    this.openModal("modal-match-score");
  }

  populateMatchModal(match) {
    const p1Id = match.player1Id || match.p1;
    const p2Id = match.player2Id || match.p2;

    const p1 = this.tournamentManager.getPlayer(p1Id);
    const p2 = this.tournamentManager.getPlayer(p2Id);

    document.getElementById("score-p1-name").textContent = p1 ? p1.name : "Giocatore 1";
    document.getElementById("score-p2-name").textContent = p2 ? p2.name : "Giocatore 2";

    const winnerSelect = document.getElementById("score-winner-select");
    winnerSelect.innerHTML = `
      <option value="">-- Seleziona Vincitore --</option>
      ${p1 ? `<option value="${p1.id}" ${match.winnerId === p1.id ? 'selected' : ''}>${p1.name}</option>` : ''}
      ${p2 ? `<option value="${p2.id}" ${match.winnerId === p2.id ? 'selected' : ''}>${p2.name}</option>` : ''}
    `;

    document.getElementById("score-input").value = match.scores || "";
    document.getElementById("score-court-select").value = match.court || this.state.tournament.courts[0];
    document.getElementById("score-datetime-input").value = match.dateTime || "";
    document.getElementById("score-status-select").value = match.status || "in_programma";
  }

  handleSaveMatchScore() {
    if (!this.currentEditingMatch) return;

    const winnerId = document.getElementById("score-winner-select").value || null;
    const scores = document.getElementById("score-input").value.trim();
    const court = document.getElementById("score-court-select").value;
    const dateTime = document.getElementById("score-datetime-input").value;
    const status = document.getElementById("score-status-select").value;

    const updateData = { scores, winnerId, court, dateTime, status };

    if (this.currentEditingMatch.type === 'bracket') {
      const res = this.tournamentManager.updateBracketMatch(
        this.currentEditingMatch.category,
        this.currentEditingMatch.matchId,
        updateData
      );

      if (res && res.isChampionDecided) {
        this.triggerCelebration(res.winner ? res.winner.name : "Nuovo Campione");
      }
    } else if (this.currentEditingMatch.type === 'group') {
      const group = this.state.groups[this.currentEditingMatch.category][this.currentEditingMatch.groupIndex];
      const match = group.matches.find(m => m.id === this.currentEditingMatch.matchId);
      if (match) {
        Object.assign(match, updateData);
      }
    }

    this.saveState();
    this.closeModal("modal-match-score");
    this.renderTabContent();
    this.showToast("Risultato salvato con successo!", "success");
  }

  // Quick buttons punteggio (es: "6-3 6-4" o "4-1 4-2")
  setQuickScore(score) {
    document.getElementById("score-input").value = score;
  }

  // ==========================================
  // EFFETTO CORIANDOLI (CELEBRATION)
  // ==========================================
  triggerCelebration(championName) {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 300);
    }
    this.showToast(`🎉 COMPLIMENTI A ${championName.toUpperCase()}, CAMPIONE DEL TORNEO! 🏆`, "success", 6000);
  }

  // ==========================================
  // GESTIONE GIOCATORI
  // ==========================================
  openNewPlayerModal() {
    document.getElementById("player-modal-title").textContent = "Nuovo Iscritto";
    document.getElementById("player-id-input").value = "";
    document.getElementById("player-name-input").value = "";
    document.getElementById("player-year-input").value = "2013";
    document.getElementById("player-category-select").value = this.selectedCategory;
    document.getElementById("player-club-input").value = this.state.tournament.club;
    document.getElementById("player-ranking-input").value = "NC";
    document.getElementById("player-seed-input").value = "";
    document.getElementById("player-parent-input").value = "";
    document.getElementById("player-phone-input").value = "";

    this.openModal("modal-player");
  }

  editPlayer(id) {
    const p = this.tournamentManager.getPlayer(id);
    if (!p) return;

    document.getElementById("player-modal-title").textContent = "Modifica Giocatore";
    document.getElementById("player-id-input").value = p.id;
    document.getElementById("player-name-input").value = p.name;
    document.getElementById("player-year-input").value = p.birthYear || "";
    document.getElementById("player-category-select").value = p.category;
    document.getElementById("player-club-input").value = p.club || "";
    document.getElementById("player-ranking-input").value = p.ranking || "NC";
    document.getElementById("player-seed-input").value = p.seed || "";
    document.getElementById("player-parent-input").value = p.parentName || "";
    document.getElementById("player-phone-input").value = p.parentPhone || "";

    this.openModal("modal-player");
  }

  handleSavePlayer() {
    const id = document.getElementById("player-id-input").value;
    const name = document.getElementById("player-name-input").value.trim();
    const birthYear = parseInt(document.getElementById("player-year-input").value, 10);
    const category = document.getElementById("player-category-select").value;
    const club = document.getElementById("player-club-input").value.trim();
    const ranking = document.getElementById("player-ranking-input").value.trim();
    const seedVal = document.getElementById("player-seed-input").value.trim();
    const seed = seedVal ? parseInt(seedVal, 10) : null;
    const parentName = document.getElementById("player-parent-input").value.trim();
    const parentPhone = document.getElementById("player-phone-input").value.trim();

    if (!name) {
      alert("Il nome del giocatore è obbligatorio");
      return;
    }

    if (id) {
      // Modifica
      const idx = this.state.players.findIndex(p => p.id === id);
      if (idx !== -1) {
        this.state.players[idx] = {
          ...this.state.players[idx],
          name, birthYear, category, club, ranking, seed, parentName, parentPhone
        };
      }
    } else {
      // Nuovo
      const newPlayer = {
        id: `p-${Date.now()}`,
        name, birthYear, category, club, ranking, seed, parentName, parentPhone,
        status: "confermato"
      };
      this.state.players.push(newPlayer);
    }

    this.saveState();
    this.closeModal("modal-player");
    this.renderPlayersView();
    this.showToast("Dati del giocatore salvati!", "success");
  }

  deletePlayer(id) {
    if (confirm("Sei sicuro di voler eliminare questo giocatore dalla lista degli iscritti?")) {
      this.state.players = this.state.players.filter(p => p.id !== id);
      this.saveState();
      this.renderPlayersView();
      this.showToast("Giocatore rimosso.", "info");
    }
  }

  // ==========================================
  // PRE-ISCRIZIONE PUBBLICA
  // ==========================================
  handlePublicRegistration() {
    const name = document.getElementById("reg-name").value.trim();
    const birthYear = parseInt(document.getElementById("reg-year").value, 10);
    const category = document.getElementById("reg-category").value;
    const club = document.getElementById("reg-club").value.trim();
    const ranking = document.getElementById("reg-ranking").value.trim();
    const parentName = document.getElementById("reg-parent-name").value.trim();
    const parentPhone = document.getElementById("reg-parent-phone").value.trim();
    const notes = document.getElementById("reg-notes").value.trim();

    if (!name || !parentName || !parentPhone) {
      alert("Compila tutti i campi obbligatori (Nome atleta, Nome genitore, Recapito telefonico)");
      return;
    }

    const reg = {
      id: `reg-${Date.now()}`,
      name, birthYear, category, club, ranking,
      parentName, parentPhone, notes,
      timestamp: new Date().toISOString(),
      status: "in_attesa"
    };

    if (!this.state.registrations) this.state.registrations = [];
    this.state.registrations.push(reg);

    this.saveState();
    this.closeModal("modal-public-reg");
    document.getElementById("public-reg-form").reset();

    alert("Grazie! Richiesta inviata con successo. La segreteria e il Giudice Arbitro confermeranno l'iscrizione a breve.");
    this.renderPendingView();
  }

  approveRegistration(regId) {
    const reg = this.state.registrations.find(r => r.id === regId);
    if (!reg) return;

    // Converti in giocatore effettivo
    const newPlayer = {
      id: `p-${Date.now()}`,
      name: reg.name,
      birthYear: reg.birthYear,
      category: reg.category,
      club: reg.club,
      ranking: reg.ranking || "NC",
      seed: null,
      parentName: reg.parentName,
      parentPhone: reg.parentPhone,
      status: "confermato"
    };

    this.state.players.push(newPlayer);
    this.state.registrations = this.state.registrations.filter(r => r.id !== regId);

    this.saveState();
    this.renderPendingView();
    this.renderPlayersView();
    this.showToast(`Iscrizione di ${reg.name} confermata con successo!`, "success");
  }

  rejectRegistration(regId) {
    if (confirm("Sei sicuro di voler respingere questa richiesta di iscrizione?")) {
      this.state.registrations = this.state.registrations.filter(r => r.id !== regId);
      this.saveState();
      this.renderPendingView();
      this.showToast("Richiesta respinta.", "info");
    }
  }

  // ==========================================
  // EXPORT & IMPORT BACKUP (JSON)
  // ==========================================
  exportBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `torneo-tennis-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    this.showToast("Backup scaricato!", "success");
  }

  importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (importedData && importedData.tournament && importedData.players) {
          this.state = importedData;
          this.tournamentManager = new TournamentManager(this.state);
          this.saveState();
          this.renderAll();
          this.showToast("Dati del torneo ripristinati con successo!", "success");
        } else {
          alert("File JSON non valido: mancano le strutture dati del torneo.");
        }
      } catch (err) {
        alert("Errore nella lettura del file: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  // ==========================================
  // UTILITY HELPERS
  // ==========================================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  }

  showToast(message, type = "info", duration = 3500) {
    const toast = document.getElementById("toast-notification");
    if (!toast) return;

    const colors = {
      success: "bg-emerald-800 text-white border-emerald-600",
      error: "bg-rose-800 text-white border-rose-600",
      info: "bg-slate-800 text-white border-slate-600"
    };

    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl transition-all duration-300 transform translate-y-0 text-xs sm:text-sm font-medium flex items-center gap-2 ${colors[type] || colors.info}`;
    toast.textContent = message;
    toast.classList.remove("hidden");

    setTimeout(() => {
      toast.classList.add("hidden");
    }, duration);
  }

  formatShortDate(dateTimeStr) {
    if (!dateTimeStr) return "";
    try {
      const d = new Date(dateTimeStr);
      const day = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
      const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      return `${day} ore ${time}`;
    } catch (e) {
      return dateTimeStr;
    }
  }
}

// Inizializza l'app all'avvio del DOM
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new App();
});
