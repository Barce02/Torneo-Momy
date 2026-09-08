// Torneo Momy - Applicazione Principale con Login & Gestione Ruoli (Admin / Giocatore)

const ADMIN_EMAIL = "barcello.luca02@gmail.com";
const USER_KEY = "torneo_momy_user_session";
const DATA_KEY = "torneo_momy_store_v5";

class App {
  constructor() {
    this.user = this.loadUser();
    this.state = this.loadState();
    this.tournamentManager = new TournamentManager(this.state);
    this.currentTab = "players";
    this.searchQuery = "";
    this.currentEditingMatchId = null;

    this.init();
  }

  // Caricamento sessione utente
  loadUser() {
    try {
      const saved = localStorage.getItem(USER_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Nessun utente salvato", e);
    }
    return null;
  }

  saveUser(userObj) {
    this.user = userObj;
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    } catch (e) {
      console.error("Errore salvataggio utente", e);
    }
    this.renderUserBadge();
    this.renderTabContent();
  }

  get isAdmin() {
    return this.user && this.user.role === "admin";
  }

  // Caricamento dati torneo
  loadState() {
    try {
      const saved = localStorage.getItem(DATA_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Inizializzazione dati torneo", e);
    }
    return {
      players: [],
      bracket: null,
      tournament: {
        name: "Torneo Momy",
        club: "Circolo Tennis",
        dates: "Stagione 2025"
      }
    };
  }

  saveState() {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error("Errore salvataggio dati", e);
    }
    this.render();
  }

  init() {
    this.bindEvents();
    this.renderUserBadge();
    this.render();

    // Se l'utente non ha ancora effettuato il login la prima volta, apri il modale
    if (!this.user) {
      setTimeout(() => {
        this.openLoginModal();
      }, 200);
    }
  }

  bindEvents() {
    // Navigazione Tab
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // Form di Login
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Form Giocatore
    const playerForm = document.getElementById("player-form");
    if (playerForm) {
      playerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSavePlayer();
      });
    }

    // Form Risultato Partita
    const matchScoreForm = document.getElementById("match-score-form");
    if (matchScoreForm) {
      matchScoreForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveMatchScore();
      });
    }

    // Ricerca live
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderPlayersView();
      });
    }
  }

  // ==========================================
  // GESTIONE AUTENTICAZIONE & RUOLI
  // ==========================================
  handleLogin() {
    const emailInput = document.getElementById("login-email-input").value.trim().toLowerCase();
    const nameInput = document.getElementById("login-name-input").value.trim();

    if (!emailInput) {
      alert("Inserisci un indirizzo email valido.");
      return;
    }

    // Riconoscimento automatico admin
    const isAdmin = emailInput === ADMIN_EMAIL.toLowerCase();

    const userObj = {
      email: emailInput,
      name: nameInput || (isAdmin ? "Luca Barcello" : "Giocatore"),
      role: isAdmin ? "admin" : "player"
    };

    this.saveUser(userObj);
    this.closeModal("modal-login");

    if (isAdmin) {
      this.showToast(`Benvenuto Amministratore (${emailInput})`, "success");
    } else {
      this.showToast(`Accesso effettuato come Giocatore (${emailInput})`, "info");
    }
  }

  loginAsGuest() {
    const userObj = {
      email: "ospite@torneo.it",
      name: "Spettatore",
      role: "player"
    };
    this.saveUser(userObj);
    this.closeModal("modal-login");
    this.showToast("Accesso come Spettatore (Sola lettura)", "info");
  }

  openLoginModal() {
    const emailInput = document.getElementById("login-email-input");
    const nameInput = document.getElementById("login-name-input");
    if (this.user) {
      emailInput.value = this.user.email === "ospite@torneo.it" ? "" : this.user.email;
      nameInput.value = this.user.name || "";
    } else {
      emailInput.value = "";
      nameInput.value = "";
    }
    this.openModal("modal-login");
    setTimeout(() => emailInput.focus(), 150);
  }

  renderUserBadge() {
    const badge = document.getElementById("user-profile-badge");
    if (!badge) return;

    if (!this.user) {
      badge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
        <span>Accesso non effettuato</span>
      `;
      return;
    }

    if (this.isAdmin) {
      badge.className = "bg-amber-400/20 text-amber-200 border border-amber-400/40 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-medium";
      badge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
        <span class="truncate max-w-[200px]"><strong>Admin:</strong> ${this.user.email}</span>
      `;
    } else {
      badge.className = "bg-white/10 text-emerald-100 border border-white/20 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs";
      badge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span class="truncate max-w-[200px]">${this.user.name} (Giocatore)</span>
      `;
    }
  }

  // ==========================================
  // NAVIGAZIONE TAB
  // ==========================================
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

  renderTabContent() {
    const tabPanels = ["players", "bracket", "rules"];
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
      case "players":
        this.renderPlayersView();
        break;
      case "bracket":
        this.renderBracketView();
        break;
      case "rules":
        this.renderRulesView();
        break;
    }
  }

  render() {
    // Aggiorna contatori header nav
    const playersCount = this.state.players.length;
    const navCount = document.getElementById("nav-players-count");
    if (navCount) navCount.textContent = playersCount;

    const navBracketStatus = document.getElementById("nav-bracket-status");
    if (navBracketStatus) {
      if (this.state.bracket) {
        navBracketStatus.textContent = "Attivo";
        navBracketStatus.className = "bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full";
      } else {
        navBracketStatus.textContent = "Non generato";
        navBracketStatus.className = "bg-gray-100 text-gray-600 text-[10px] font-medium px-1.5 py-0.2 rounded-full";
      }
    }

    this.renderTabContent();
  }

  // ==========================================
  // SEZIONE 1: ISCRITTI
  // ==========================================
  renderPlayersView() {
    const container = document.getElementById("players-container");
    if (!container) return;

    const players = this.state.players;
    const filtered = players.filter(p => {
      if (!this.searchQuery) return true;
      const q = this.searchQuery;
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.club && p.club.toLowerCase().includes(q)) ||
        (p.ranking && p.ranking.toLowerCase().includes(q))
      );
    });

    let html = `
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        
        <!-- Banner informativo per Giocatore vs Admin -->
        ${this.isAdmin ? `
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs text-emerald-900">
              <strong>Accesso Amministratore attivo (${ADMIN_EMAIL}):</strong> puoi aggiungere e modificare atleti, assegnare le teste di serie e generare il tabellone finale.
            </div>
            <button onclick="app.openNewPlayerModal()" class="bg-tennis-green hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5">
              + Aggiungi Atleta
            </button>
          </div>
        ` : `
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div class="text-xs text-slate-600">
              Accesso come <strong>${this.user ? this.user.name : 'Giocatore/Spettatore'}</strong> (Sola lettura). Per gestire gli atleti e i punteggi, accedi come amministratore con <code>${ADMIN_EMAIL}</code>.
            </div>
            <button onclick="app.openNewPlayerModal()" class="bg-tennis-green hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-sm transition whitespace-nowrap">
              Invia Modulo Iscrizione
            </button>
          </div>
        `}

        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-gray-100">
          <div>
            <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>Elenco Iscritti Ufficiale</span>
              <span class="bg-emerald-100 text-tennis-green text-xs font-bold px-2.5 py-0.5 rounded-full">
                ${players.length} ${players.length === 1 ? 'iscritto' : 'iscritti'}
              </span>
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">Atleti partecipanti al Torneo Momy</p>
          </div>

          <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <!-- Campo Cerca -->
            <div class="relative w-full sm:w-64">
              <input type="text" id="search-input" value="${this.searchQuery}" placeholder="Cerca per nome o circolo..." class="w-full text-xs sm:text-sm pl-8 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              <svg class="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>

            <button onclick="app.openNewPlayerModal()" class="w-full sm:w-auto bg-tennis-green hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5">
              + Aggiungi Atleta
            </button>
          </div>
        </div>
    `;

    if (players.length === 0) {
      html += `
        <div class="text-center py-16 bg-gray-50/50 rounded-xl border border-dashed border-gray-300 p-8 my-6">
          <div class="w-14 h-14 bg-white text-tennis-green border border-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
          <h3 class="text-base sm:text-lg font-bold text-gray-800 mb-1">Nessun atleta iscritto al momento</h3>
          <p class="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mb-5">
            L'elenco partecipanti del Torneo Momy è attualmente vuoto. Inserisci i ragazzi che parteciperanno alla competizione.
          </p>
          <button onclick="app.openNewPlayerModal()" class="bg-tennis-green hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow transition">
            + Inserisci il Primo Atleta
          </button>
        </div>
      `;
    } else {
      html += `
        <div class="overflow-x-auto mt-4">
          <table class="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 text-gray-600 uppercase text-[11px] font-semibold border-b border-gray-200">
                <th class="py-3 px-3 w-12 text-center">#</th>
                <th class="py-3 px-3">T.d.S.</th>
                <th class="py-3 px-3">Atleta</th>
                <th class="py-3 px-3">Anno</th>
                <th class="py-3 px-3">Circolo Tennis</th>
                <th class="py-3 px-3">Classifica</th>
                ${this.isAdmin ? '<th class="py-3 px-3">Genitore / Telefono</th>' : ''}
                <th class="py-3 px-3">Note</th>
                ${this.isAdmin ? '<th class="py-3 px-3 text-right">Azioni</th>' : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${filtered.map((p, idx) => `
                <tr class="hover:bg-gray-50/80 transition">
                  <td class="py-3 px-3 font-mono text-center text-gray-400 font-semibold">${idx + 1}</td>
                  <td class="py-3 px-3">
                    ${p.seed ? `<span class="bg-tennis-green text-white font-bold text-xs px-2 py-0.5 rounded">[${p.seed}]</span>` : '<span class="text-gray-300">-</span>'}
                  </td>
                  <td class="py-3 px-3 font-bold text-gray-900">${p.name}</td>
                  <td class="py-3 px-3 text-gray-600">${p.birthYear || '-'}</td>
                  <td class="py-3 px-3 text-gray-600">${p.club || '-'}</td>
                  <td class="py-3 px-3">
                    <span class="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                      ${p.ranking || 'NC'}
                    </span>
                  </td>
                  ${this.isAdmin ? `
                    <td class="py-3 px-3 text-gray-600">
                      ${p.parentName ? `<div class="font-medium text-gray-800">${p.parentName}</div>` : ''}
                      ${p.parentPhone ? `<div class="text-xs text-gray-500 font-mono">${p.parentPhone}</div>` : (!p.parentName ? '-' : '')}
                    </td>
                  ` : ''}
                  <td class="py-3 px-3 text-gray-500 text-xs italic max-w-xs truncate">${p.notes || '-'}</td>
                  ${this.isAdmin ? `
                    <td class="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      <button onclick="app.editPlayer('${p.id}')" class="text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
                        Modifica
                      </button>
                      <button onclick="app.deletePlayer('${p.id}')" class="text-xs text-rose-600 hover:text-rose-800 font-medium px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 transition">
                        Elimina
                      </button>
                    </td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Ricollega il listener sul campo cerca
    const newSearchInput = document.getElementById("search-input");
    if (newSearchInput) {
      newSearchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderPlayersView();
      });
    }
  }

  openNewPlayerModal() {
    document.getElementById("player-modal-title").textContent = this.isAdmin ? "Nuovo Iscritto (Admin)" : "Modulo Iscrizione Ragazzo/a";
    document.getElementById("player-id-input").value = "";
    document.getElementById("player-name-input").value = "";
    document.getElementById("player-year-input").value = "";
    document.getElementById("player-ranking-input").value = "NC";
    document.getElementById("player-club-input").value = "";
    document.getElementById("player-seed-input").value = "";
    document.getElementById("player-parent-input").value = "";
    document.getElementById("player-phone-input").value = "";
    document.getElementById("player-notes-input").value = "";

    this.openModal("modal-player");
    setTimeout(() => document.getElementById("player-name-input").focus(), 150);
  }

  editPlayer(id) {
    if (!this.isAdmin) return;
    const p = this.state.players.find(x => x.id === id);
    if (!p) return;

    document.getElementById("player-modal-title").textContent = "Modifica Atleta";
    document.getElementById("player-id-input").value = p.id;
    document.getElementById("player-name-input").value = p.name || "";
    document.getElementById("player-year-input").value = p.birthYear || "";
    document.getElementById("player-ranking-input").value = p.ranking || "NC";
    document.getElementById("player-club-input").value = p.club || "";
    document.getElementById("player-seed-input").value = p.seed || "";
    document.getElementById("player-parent-input").value = p.parentName || "";
    document.getElementById("player-phone-input").value = p.parentPhone || "";
    document.getElementById("player-notes-input").value = p.notes || "";

    this.openModal("modal-player");
  }

  handleSavePlayer() {
    const id = document.getElementById("player-id-input").value;
    const name = document.getElementById("player-name-input").value.trim();
    const birthYearVal = document.getElementById("player-year-input").value.trim();
    const birthYear = birthYearVal ? parseInt(birthYearVal, 10) : "";
    const ranking = document.getElementById("player-ranking-input").value.trim() || "NC";
    const club = document.getElementById("player-club-input").value.trim();
    const seedVal = document.getElementById("player-seed-input").value.trim();
    const seed = seedVal ? parseInt(seedVal, 10) : null;
    const parentName = document.getElementById("player-parent-input").value.trim();
    const parentPhone = document.getElementById("player-phone-input").value.trim();
    const notes = document.getElementById("player-notes-input").value.trim();

    if (!name) {
      alert("Il nome e cognome dell'atleta è obbligatorio");
      return;
    }

    if (id) {
      // Modifica atleta esistente
      const idx = this.state.players.findIndex(x => x.id === id);
      if (idx !== -1) {
        this.state.players[idx] = {
          ...this.state.players[idx],
          name, birthYear, ranking, club, seed, parentName, parentPhone, notes
        };
      }
    } else {
      // Nuovo atleta
      const newPlayer = {
        id: `p-${Date.now()}`,
        name, birthYear, ranking, club, seed, parentName, parentPhone, notes,
        status: "confermato"
      };
      this.state.players.push(newPlayer);
    }

    this.saveState();
    this.closeModal("modal-player");
    this.showToast(`Iscrizione di ${name} salvata!`, "success");
  }

  deletePlayer(id) {
    if (!this.isAdmin) return;
    const p = this.state.players.find(x => x.id === id);
    if (!p) return;

    if (confirm(`Sei sicuro di voler rimuovere ${p.name} dall'elenco iscritti?`)) {
      this.state.players = this.state.players.filter(x => x.id !== id);
      this.saveState();
      this.showToast("Atleta rimosso", "info");
    }
  }

  // ==========================================
  // SEZIONE 2: TABELLONE FINALE
  // ==========================================
  renderBracketView() {
    const container = document.getElementById("bracket-container");
    if (!container) return;

    const bracket = this.state.bracket;
    const players = this.state.players;

    let html = "";

    // Controlli di gestione tabellone per l'Amministratore
    if (this.isAdmin) {
      html += `
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-amber-900 font-bold text-xs sm:text-sm">Gestione Tabellone Finale (Admin):</span>
            <span class="text-xs text-amber-700">
              ${bracket ? "Clicca su qualsiasi match per aggiornare il punteggio e il campo." : "Componi il tabellone con gli atleti iscritti."}
            </span>
          </div>
          <div class="flex items-center gap-2">
            ${players.length >= 2 ? `
              <button onclick="app.handleGenerateBracket()" class="text-xs bg-tennis-green hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl shadow-sm transition">
                ${bracket ? "Rigenera Tabellone" : "Genera Tabellone Finale Automatico"}
              </button>
            ` : ''}
            ${bracket ? `
              <button onclick="app.handleResetBracket()" class="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3.5 py-2 rounded-xl transition">
                Azzera Tabellone
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    // Se il tabellone non è ancora generato
    if (!bracket || !bracket.rounds || bracket.rounds.length === 0) {
      html += `
        <div class="text-center py-16 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div class="w-14 h-14 bg-emerald-50 border border-emerald-200 text-tennis-green rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-gray-800 mb-1">Tabellone Finale non ancora composto</h3>
          
          <div class="max-w-md mx-auto mb-6">
            <p class="text-sm text-gray-500 mb-2">
              ${players.length === 0
                ? "Nessun atleta è ancora registrato. Aggiungi gli iscritti prima di generare il tabellone."
                : `Al momento ci sono <strong>${players.length}</strong> atleti registrati.`}
            </p>
            ${players.length === 1 ? `
              <p class="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                Servono almeno 2 iscritti per poter comporre gli incontri a eliminazione diretta.
              </p>
            ` : ''}
          </div>

          <div class="flex flex-wrap justify-center gap-3">
            ${this.isAdmin ? `
              ${players.length >= 2 ? `
                <button onclick="app.handleGenerateBracket()" class="bg-tennis-green hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition">
                  Genera Tabellone Finale (${players.length} Partecipanti)
                </button>
              ` : `
                <button onclick="app.switchTab('players')" class="bg-tennis-green hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition">
                  Vai a Iscritti per Aggiungere Giocatori
                </button>
              `}
            ` : `
              <p class="text-xs text-gray-400 italic">
                Il tabellone ufficiale delle partite verrà pubblicato dall'amministratore (barcello.luca02@gmail.com).
              </p>
            `}
          </div>
        </div>
      `;
      container.innerHTML = html;
      return;
    }

    // Render visivo ad albero
    html += `
      <div class="overflow-x-auto pb-6">
        <div class="bracket-tree flex gap-8 items-stretch min-w-max px-2 py-4">
    `;

    bracket.rounds.forEach((round, rIdx) => {
      const isFinal = rIdx === bracket.rounds.length - 1;
      html += `
        <div class="bracket-round flex flex-col justify-around min-w-[280px] max-w-[320px]">
          <div class="text-center mb-4">
            <span class="inline-block bg-emerald-900 text-emerald-100 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md shadow-sm">
              ${round.name}
            </span>
          </div>
          <div class="flex flex-col justify-around flex-grow gap-6">
      `;

      round.matches.forEach((match) => {
        const p1 = this.tournamentManager.getPlayer(match.player1Id);
        const p2 = this.tournamentManager.getPlayer(match.player2Id);
        const hasWinner = !!match.winnerId;
        const isP1Winner = hasWinner && match.winnerId === match.player1Id;
        const isP2Winner = hasWinner && match.winnerId === match.player2Id;

        html += `
          <div class="match-card bg-white border ${hasWinner ? 'border-emerald-300' : 'border-gray-200'} rounded-xl shadow-sm hover:shadow-md transition relative overflow-hidden ${this.isAdmin ? 'cursor-pointer' : ''}"
               onclick="${this.isAdmin ? `app.openMatchModal('${match.id}')` : ''}">
            
            ${isFinal && hasWinner ? `
              <div class="bg-emerald-800 text-white text-[11px] font-bold px-2 py-0.5 text-center uppercase tracking-wider">
                Campione del Torneo Momy
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
                ${isP1Winner ? `<span class="text-emerald-700 font-bold text-xs bg-emerald-100 px-1.5 py-0.5 rounded">Vinto</span>` : ""}
              </div>

              <!-- Giocatore 2 -->
              <div class="flex items-center justify-between py-1.5 ${isP2Winner ? 'font-bold text-emerald-900 bg-emerald-50/50 -mx-3 px-3 rounded' : 'text-gray-700'}">
                <div class="flex items-center gap-1.5 truncate">
                  ${p2 && p2.seed ? `<span class="text-[10px] bg-emerald-700 text-white font-bold px-1.5 py-0.2 rounded">${p2.seed}</span>` : ""}
                  <span class="truncate text-sm">${p2 ? p2.name : (match.player2Id ? match.player2Id : '<span class="text-gray-400 italic">In attesa</span>')}</span>
                  ${p2 && p2.club ? `<span class="text-[11px] text-gray-400">(${p2.club})</span>` : ""}
                </div>
                ${isP2Winner ? `<span class="text-emerald-700 font-bold text-xs bg-emerald-100 px-1.5 py-0.5 rounded">Vinto</span>` : ""}
              </div>

              <!-- Dettagli e Punteggio -->
              <div class="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <div>
                  ${match.scores ? `
                    <span class="font-mono font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded text-xs">
                      ${match.scores}
                    </span>
                  ` : `
                    <span class="text-gray-400 text-[11px]">${match.status === 'in_corso' ? 'In corso (Live)' : 'Da disputare'}</span>
                  `}
                </div>
                <div class="text-right text-[11px] text-gray-500">
                  ${match.dateTime ? this.formatShortDate(match.dateTime) : ''}
                  ${match.court ? `<span class="ml-1 font-medium text-gray-600">• ${match.court.split(' ')[0]} ${match.court.split(' ')[1] || ''}</span>` : ''}
                </div>
              </div>

              ${this.isAdmin ? `
                <div class="mt-2 text-center text-[11px] text-tennis-green font-medium bg-emerald-50 py-1 rounded hover:bg-emerald-100 border border-emerald-200/50">
                  Inserisci Risultato & Orario
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

  handleGenerateBracket() {
    if (!this.isAdmin) return;
    try {
      this.tournamentManager.generateBracket();
      this.saveState();
      this.renderBracketView();
      this.showToast("Tabellone Finale generato con successo!", "success");
    } catch (e) {
      alert(e.message);
    }
  }

  handleResetBracket() {
    if (!this.isAdmin) return;
    if (confirm("Sei sicuro di voler azzerare il tabellone finale?")) {
      this.state.bracket = null;
      this.saveState();
      this.renderBracketView();
      this.showToast("Tabellone finale azzerato", "info");
    }
  }

  // Modale per aggiornare incontro da parte dell'Admin
  openMatchModal(matchId) {
    if (!this.isAdmin || !this.state.bracket) return;

    let targetMatch = null;
    this.state.bracket.rounds.forEach(r => {
      const found = r.matches.find(m => m.id === matchId);
      if (found) targetMatch = found;
    });

    if (!targetMatch) return;
    this.currentEditingMatchId = matchId;

    const p1 = this.tournamentManager.getPlayer(targetMatch.player1Id);
    const p2 = this.tournamentManager.getPlayer(targetMatch.player2Id);

    document.getElementById("score-p1-name").textContent = p1 ? p1.name : "In attesa";
    document.getElementById("score-p2-name").textContent = p2 ? p2.name : "In attesa";

    const winnerSelect = document.getElementById("score-winner-select");
    winnerSelect.innerHTML = `
      <option value="">-- Seleziona Vincitore --</option>
      ${p1 ? `<option value="${p1.id}" ${targetMatch.winnerId === p1.id ? 'selected' : ''}>${p1.name}</option>` : ''}
      ${p2 ? `<option value="${p2.id}" ${targetMatch.winnerId === p2.id ? 'selected' : ''}>${p2.name}</option>` : ''}
    `;

    document.getElementById("score-input").value = targetMatch.scores || "";
    document.getElementById("score-court-select").value = targetMatch.court || "Campo 1 (Centrale)";
    document.getElementById("score-datetime-input").value = targetMatch.dateTime || "";
    document.getElementById("score-status-select").value = targetMatch.status || "in_programma";

    this.openModal("modal-match-score");
  }

  handleSaveMatchScore() {
    if (!this.isAdmin || !this.currentEditingMatchId) return;

    const winnerId = document.getElementById("score-winner-select").value || null;
    const scores = document.getElementById("score-input").value.trim();
    const court = document.getElementById("score-court-select").value;
    const dateTime = document.getElementById("score-datetime-input").value;
    const status = document.getElementById("score-status-select").value;

    const res = this.tournamentManager.updateBracketMatch(this.currentEditingMatchId, {
      winnerId, scores, court, dateTime, status
    });

    if (res && res.isChampionDecided) {
      if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      this.showToast(`Torneo Momy completato! Vincitore: ${res.winner ? res.winner.name : 'Campione'}`, "success", 6000);
    } else {
      this.showToast("Risultato dell'incontro salvato!", "success");
    }

    this.saveState();
    this.closeModal("modal-match-score");
    this.renderBracketView();
  }

  setQuickScore(score) {
    document.getElementById("score-input").value = score;
  }

  // ==========================================
  // SEZIONE 3: REGOLAMENTO
  // ==========================================
  renderRulesView() {
    const container = document.getElementById("rules-container");
    if (!container) return;

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 sm:p-7 shadow-sm">
          <h2 class="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">
            Regolamento Ufficiale - Torneo Momy
          </h2>
          <div class="prose prose-sm text-gray-600 space-y-4">
            <p>
              Il Torneo Momy è una manifestazione sportiva giovanile volta a promuovere i valori di sportività, lealtà e crescita tecnica sui campi di tennis.
            </p>

            <div class="bg-emerald-50 border-l-4 border-tennis-green p-4 rounded-r-xl">
              <h4 class="font-bold text-tennis-green text-sm mb-1">Formula degli Incontri</h4>
              <p class="text-xs text-gray-700 leading-relaxed">
                Partite al meglio dei 2 set su 3 con punteggio short-set (ai 4 game con tie-break sul 4 pari) o punteggio tradizionale a discrezione dell'arbitro. In caso di parità di set, eventuale terzo set disputato mediante super tie-break a 10 punti.
              </p>
            </div>

            <h4 class="font-bold text-gray-800 text-sm">Disposizioni di Gioco & Fair Play</h4>
            <ul class="list-disc pl-5 text-xs text-gray-600 space-y-1.5">
              <li>I partecipanti devono presentarsi alla segreteria almeno 20 minuti prima dell'orario stabilito.</li>
              <li>Riscaldamento preliminare in campo limitato a 5 minuti.</li>
              <li>Chiamate di palla autonome e leali da parte dei giocatori sul proprio campo.</li>
              <li>Le decisioni del Giudice Arbitro sono definitive ed inappellabili.</li>
            </ul>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 class="text-base font-bold text-gray-900 mb-3">Informazioni Organizzazione</h3>
            <div class="text-xs text-gray-600 space-y-2">
              <div><strong>Manifestazione:</strong> Torneo Momy 2025</div>
              <div><strong>Amministratore Ufficiale:</strong> ${ADMIN_EMAIL}</div>
              <div><strong>Campi:</strong> Terra Rossa e Sintetico</div>
              <div><strong>Regolamento:</strong> Conforme disposizioni FITP</div>
            </div>
          </div>

          <div class="bg-gradient-to-br from-emerald-800 to-tennis-green rounded-2xl p-6 text-white shadow">
            <h3 class="font-bold text-base mb-2">Partecipa al Torneo</h3>
            <p class="text-xs text-emerald-100 mb-4 leading-relaxed">
              Per iscrivere un atleta compila la scheda anagrafica nella sezione Iscritti.
            </p>
            <button onclick="app.switchTab('players'); app.openNewPlayerModal();" class="w-full bg-white text-tennis-green font-bold text-xs py-2.5 px-4 rounded-xl shadow hover:bg-emerald-50 transition">
              Iscrivi Atleta Ora
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // UTILITY GENERALI
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

  showToast(message, type = "info", duration = 3200) {
    const toast = document.getElementById("toast-notification");
    if (!toast) return;

    const colors = {
      success: "bg-emerald-900 text-white border-emerald-700",
      error: "bg-rose-900 text-white border-rose-700",
      info: "bg-slate-900 text-white border-slate-700"
    };

    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl transition-all duration-300 text-xs sm:text-sm font-medium flex items-center gap-2 ${colors[type] || colors.info}`;
    toast.textContent = message;
    toast.classList.remove("hidden");

    setTimeout(() => toast.classList.add("hidden"), duration);
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

// Inizializza l'app all'avvio
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new App();
});
