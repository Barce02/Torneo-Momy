// Gestione Iscritti Ufficiale - Torneo Momy

// Rimuove vecchie chiavi di test per evitare che il browser mostri dati finti cached
localStorage.removeItem("torneo_tennis_ragazzi_v1");
localStorage.removeItem("torneo_momy_v2");
localStorage.removeItem("torneo_momy_v3");

const STORAGE_KEY = "torneo_momy_iscritti_v4";

class App {
  constructor() {
    this.players = this.loadPlayers();
    this.searchQuery = "";
    this.init();
  }

  // Carica gli iscritti salvati o inizia con lista vuota []
  loadPlayers() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Inizializzazione lista vuota", e);
    }
    return []; // Lista rigorosamente vuota di base
  }

  savePlayers() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.players));
    } catch (e) {
      console.error("Errore salvataggio in localStorage", e);
    }
    this.render();
  }

  init() {
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    // Form Salva Giocatore
    const playerForm = document.getElementById("player-form");
    if (playerForm) {
      playerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSavePlayer();
      });
    }

    // Ricerca live
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderTable();
      });
    }
  }

  render() {
    this.renderBadge();
    this.renderTable();
  }

  renderBadge() {
    const badge = document.getElementById("players-count-badge");
    if (badge) {
      const count = this.players.length;
      badge.textContent = `${count} ${count === 1 ? 'iscritto' : 'iscritti'}`;
    }
  }

  renderTable() {
    const container = document.getElementById("players-table-container");
    if (!container) return;

    // Filtra in base alla ricerca
    const filtered = this.players.filter(p => {
      if (!this.searchQuery) return true;
      const query = this.searchQuery;
      return (
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.club && p.club.toLowerCase().includes(query)) ||
        (p.ranking && p.ranking.toLowerCase().includes(query)) ||
        (p.parentName && p.parentName.toLowerCase().includes(query))
      );
    });

    // Se la lista è completamente vuota
    if (this.players.length === 0) {
      container.innerHTML = `
        <div class="text-center py-16 bg-gray-50/60 rounded-2xl border border-dashed border-gray-300 p-8">
          <div class="w-14 h-14 bg-white text-tennis-green border border-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
          <h3 class="text-base sm:text-lg font-bold text-gray-800 mb-1">Nessun atleta iscritto al momento</h3>
          <p class="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mb-6">
            L'elenco partecipanti del Torneo Momy è attualmente vuoto. Inserisci i ragazzi che prenderanno parte alla competizione.
          </p>
          <button onclick="app.openNewPlayerModal()" class="bg-tennis-green hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition">
            + Aggiungi il Primo Iscritto
          </button>
        </div>
      `;
      return;
    }

    // Se non ci sono risultati per la ricerca
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-gray-400">
          <p class="text-sm">Nessun iscritto trovato per "<strong>${this.searchQuery}</strong>".</p>
        </div>
      `;
      return;
    }

    // Tabella con gli iscritti effettivi
    let html = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs sm:text-sm border-collapse">
          <thead>
            <tr class="bg-gray-50 text-gray-600 uppercase text-[11px] font-semibold border-b border-gray-200">
              <th class="py-3 px-3 w-12 text-center">#</th>
              <th class="py-3 px-3">Atleta</th>
              <th class="py-3 px-3">Anno</th>
              <th class="py-3 px-3">Circolo Tennis</th>
              <th class="py-3 px-3">Classifica</th>
              <th class="py-3 px-3">Genitore / Telefono</th>
              <th class="py-3 px-3">Note</th>
              <th class="py-3 px-3 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${filtered.map((p, idx) => `
              <tr class="hover:bg-gray-50/80 transition">
                <td class="py-3 px-3 font-mono text-center text-gray-400 font-semibold">${idx + 1}</td>
                <td class="py-3 px-3 font-bold text-gray-900">${p.name}</td>
                <td class="py-3 px-3 text-gray-600">${p.birthYear || '-'}</td>
                <td class="py-3 px-3 text-gray-600">${p.club || '-'}</td>
                <td class="py-3 px-3">
                  <span class="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    ${p.ranking || 'NC'}
                  </span>
                </td>
                <td class="py-3 px-3 text-gray-600">
                  ${p.parentName ? `<div class="font-medium text-gray-800">${p.parentName}</div>` : ''}
                  ${p.parentPhone ? `<div class="text-xs text-gray-500 font-mono">${p.parentPhone}</div>` : (!p.parentName ? '-' : '')}
                </td>
                <td class="py-3 px-3 text-gray-500 text-xs italic max-w-xs truncate">${p.notes || '-'}</td>
                <td class="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                  <button onclick="app.editPlayer('${p.id}')" class="text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
                    Modifica
                  </button>
                  <button onclick="app.deletePlayer('${p.id}')" class="text-xs text-rose-600 hover:text-rose-800 font-medium px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 transition">
                    Elimina
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  }

  openNewPlayerModal() {
    document.getElementById("player-modal-title").textContent = "Nuovo Iscritto";
    document.getElementById("player-id-input").value = "";
    document.getElementById("player-name-input").value = "";
    document.getElementById("player-year-input").value = "";
    document.getElementById("player-ranking-input").value = "NC";
    document.getElementById("player-club-input").value = "";
    document.getElementById("player-parent-input").value = "";
    document.getElementById("player-phone-input").value = "";
    document.getElementById("player-notes-input").value = "";

    this.openModal("modal-player");
    setTimeout(() => {
      document.getElementById("player-name-input").focus();
    }, 100);
  }

  editPlayer(id) {
    const p = this.players.find(x => x.id === id);
    if (!p) return;

    document.getElementById("player-modal-title").textContent = "Modifica Iscritto";
    document.getElementById("player-id-input").value = p.id;
    document.getElementById("player-name-input").value = p.name || "";
    document.getElementById("player-year-input").value = p.birthYear || "";
    document.getElementById("player-ranking-input").value = p.ranking || "NC";
    document.getElementById("player-club-input").value = p.club || "";
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
    const parentName = document.getElementById("player-parent-input").value.trim();
    const parentPhone = document.getElementById("player-phone-input").value.trim();
    const notes = document.getElementById("player-notes-input").value.trim();

    if (!name) {
      alert("Il nome dell'atleta è obbligatorio");
      return;
    }

    if (id) {
      // Modifica atleta esistente
      const idx = this.players.findIndex(x => x.id === id);
      if (idx !== -1) {
        this.players[idx] = {
          ...this.players[idx],
          name, birthYear, ranking, club, parentName, parentPhone, notes
        };
      }
    } else {
      // Nuovo atleta
      const newPlayer = {
        id: `p-${Date.now()}`,
        name,
        birthYear,
        ranking,
        club,
        parentName,
        parentPhone,
        notes,
        createdAt: new Date().toISOString()
      };
      this.players.push(newPlayer);
    }

    this.savePlayers();
    this.closeModal("modal-player");
    this.showToast(`Iscrizione di ${name} salvata!`, "success");
  }

  deletePlayer(id) {
    const p = this.players.find(x => x.id === id);
    if (!p) return;

    if (confirm(`Sei sicuro di voler eliminare ${p.name} dall'elenco iscritti?`)) {
      this.players = this.players.filter(x => x.id !== id);
      this.savePlayers();
      this.showToast("Atleta rimosso dall'elenco", "info");
    }
  }

  // Esporta elenco in formato CSV per Excel
  exportCSV() {
    if (this.players.length === 0) {
      alert("Nessun iscritto presente da esportare.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM per Excel
    csvContent += "Numero;Nome Cognome;Anno;Circolo;Classifica;Genitore;Telefono;Note\n";

    this.players.forEach((p, index) => {
      const row = [
        index + 1,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.birthYear || '',
        `"${(p.club || '').replace(/"/g, '""')}"`,
        p.ranking || 'NC',
        `"${(p.parentName || '').replace(/"/g, '""')}"`,
        `"${(p.parentPhone || '').replace(/"/g, '""')}"`,
        `"${(p.notes || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(";") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `iscritti-torneo-momy-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();

    this.showToast("File CSV per Excel scaricato con successo", "success");
  }

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

  showToast(message, type = "info", duration = 3000) {
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

    setTimeout(() => {
      toast.classList.add("hidden");
    }, duration);
  }
}

// Inizializza l'applicazione
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new App();
});
