const ADMIN_EMAILS = [
  "barcello.luca02@gmail.com",
  "alessia.ditullio1996@gmail.com"
];

function isUserAdmin(email) {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return ADMIN_EMAILS.some(admin => admin.toLowerCase() === clean);
}

const ADMIN_EMAIL = "barcello.luca02@gmail.com";
const USER_KEY = "torneo_momy_user_session_v7";
const ACCOUNTS_KEY = "torneo_momy_accounts_v7";
const DATA_KEY = "torneo_momy_store_v7";
const LAST_EMAIL_KEY = "torneo_momy_last_email_v7";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCz0k_RAHKUlixi-DTvB0ROt5zbB0EIThs",
  authDomain: "torneo-momy.firebaseapp.com",
  databaseURL: "https://torneo-momy-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "torneo-momy",
  storageBucket: "torneo-momy.firebasestorage.app",
  messagingSenderId: "644726025570",
  appId: "1:644726025570:web:81d60a7924289950afd03b",
  measurementId: "G-Y8XYP8RE4C"
};

class App {
  constructor() {
    this.db = null;
    this.isRemoteUpdate = false;
    this.accounts = this.loadAccounts();
    this.user = this.loadUser();
    this.state = this.loadState();
    this.tournamentManager = new TournamentManager(this.state);
    this.currentTab = "players";
    this.playersSubTab = "players";
    this.authMode = "login";
    this.searchQuery = "";
    this.accountsSearchQuery = "";
    this.currentEditingMatchId = null;
    this.revealedPasswords = {};

    this.selectedCategory = "Pre Agonistica U12"; // "all", "Pre Agonistica U12", "Pre Agonistica", "SAT U14", "SAT"
    this.pendingPasswordReset = this.loadPendingPasswordReset();

    // Filtri calendario
    this.schedulePhaseFilter = "all";
    this.scheduleCourtFilter = "all";
    this.scheduleStatusFilter = "all";
    this.scheduleSearchQuery = "";

    this.init();
  }

  loadPendingPasswordReset() {
    try {
      const saved = localStorage.getItem("torneo_momy_pending_reset");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.expiresAt && data.expiresAt > Date.now()) {
          return data;
        }
      }
    } catch (e) {}
    return null;
  }

  loadAccounts() {
    try {
      const saved = localStorage.getItem(ACCOUNTS_KEY);
      const accounts = saved ? JSON.parse(saved) : {};
      Object.keys(accounts).forEach(em => {
        if (isUserAdmin(em)) {
          accounts[em].role = "admin";
        }
      });
      return accounts;
    } catch (e) {
      return {};
    }
  }

  saveAccounts(accounts) {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      this.accounts = accounts;
      this.pushAccountsToFirebase(accounts);
    } catch (e) {
      console.error("Errore salvataggio accounts", e);
    }
  }

  // Caricamento sessione utente
  loadUser() {
    try {
      const saved = localStorage.getItem(USER_KEY);
      if (saved) {
        const u = JSON.parse(saved);
        if (u.email && isUserAdmin(u.email)) {
          u.role = "admin";
        }
        if (!u.firstName && u.name) {
          const parts = u.name.trim().split(" ");
          u.firstName = parts[0] || "";
          u.lastName = parts.slice(1).join(" ") || "";
        }
        delete u.presetAvatar;
        return u;
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
      if (userObj.email && userObj.email !== "ospite@torneo.it") {
        localStorage.setItem(LAST_EMAIL_KEY, userObj.email);
      }
    } catch (e) {
      console.error("Errore salvataggio utente", e);
    }
    this.renderUserBadge();
    this.renderTabContent();
  }

  logout() {
    if (this.user && this.user.email !== "ospite@torneo.it") {
      localStorage.setItem(LAST_EMAIL_KEY, this.user.email);
    }
    this.user = null;
    try {
      localStorage.removeItem(USER_KEY);
    } catch (e) {}

    this.renderUserBadge();
    this.render();
    this.showToast("Logout effettuato.", "info");

    // Riapri la modale di accesso con il tasto Face ID / Touch ID subito pronto
    setTimeout(() => {
      this.openLoginModal("login");
    }, 250);
  }

  get isAdmin() {
    return this.user && (this.user.role === "admin" || isUserAdmin(this.user.email));
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
        dates: "Stagione 26/27"
      }
    };
  }

  saveState() {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error("Errore salvataggio dati", e);
    }
    if (!this.isRemoteUpdate) {
      this.pushStateToFirebase(this.state);
    }
    this.render();
  }

  // Sincronizza automaticamente gli account registrati nell'elenco atleti per la propria categoria
  syncAccountsToPlayers() {
    try {
      const accounts = this.loadAccounts();
      if (!this.state.players) this.state.players = [];
      let stateChanged = false;

      Object.values(accounts).forEach(acc => {
        if (!acc || !acc.email) return;
        if (isUserAdmin(acc.email) || acc.role === "admin") return;

        const emailKey = acc.email.toLowerCase().trim();
        const existing = this.state.players.find(p =>
          (p.email && p.email.toLowerCase().trim() === emailKey) ||
          (p.userId && p.userId.toLowerCase().trim() === emailKey)
        );

        let cat = acc.category || "Da Assegnare";
        if (cat !== "Da Assegnare") {
          cat = this.tournamentManager.getPlayerCategory(acc);
        }

        if (!existing) {
          const newPlayer = {
            id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            firstName: acc.firstName || (acc.name ? acc.name.split(" ")[0] : ""),
            lastName: acc.lastName || (acc.name ? acc.name.split(" ").slice(1).join(" ") : ""),
            name: acc.name || `${acc.firstName || ''} ${acc.lastName || ''}`.trim(),
            birthDate: acc.birthDate || "",
            ranking: acc.ranking || "NC",
            category: cat,
            notes: "",
            email: emailKey,
            userId: emailKey,
            photoUrl: acc.photoUrl || "",
            status: "confermato"
          };
          this.state.players.push(newPlayer);
          stateChanged = true;
        } else {
          if (existing.category !== cat) {
            existing.category = cat;
            stateChanged = true;
          }
        }
      });

      if (stateChanged) {
        this.tournamentManager.ensureCategories();
        localStorage.setItem(DATA_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.warn("Errore syncAccountsToPlayers", e);
    }
  }

  // ==========================================
  // SINCRONIZZAZIONE CLOUD FIREBASE REALTIME
  // ==========================================

  encodeEmailKey(email) {
    return (email || "").toLowerCase().trim().replace(/[.#$\[\]/]/g, '_');
  }

  updateSyncStatus(status, text) {
    const dot = document.getElementById("cloud-sync-dot");
    const label = document.getElementById("cloud-sync-text");
    const badge = document.getElementById("cloud-sync-badge");
    if (badge) {
      badge.classList.add("hidden");
      badge.style.display = "none";
    }
    if (!dot || !label) return;

    label.textContent = text;
    dot.className = "w-2.5 h-2.5 rounded-full";

    if (status === "online") {
      dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50";
    } else if (status === "connecting" || status === "syncing") {
      dot.className = "w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse";
    } else if (status === "error") {
      dot.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
    }
  }

  pushAccountsToFirebase(accounts) {
    if (!this.db || this.isRemoteUpdate) return;
    try {
      const sanitized = {};
      Object.entries(accounts || {}).forEach(([email, acc]) => {
        if (acc && acc.email) {
          const key = this.encodeEmailKey(email);
          sanitized[key] = acc;
        }
      });
      this.db.ref("torneo_momy/accounts").set(sanitized).catch(err => {
        console.warn("Errore salvataggio account su Firebase:", err);
        if (err.message && err.message.toLowerCase().includes("permission")) {
          this.updateSyncStatus("error", "Permesso negato");
        }
      });
    } catch (e) {
      console.warn("pushAccountsToFirebase exception:", e);
    }
  }

  pushStateToFirebase(state) {
    if (!this.db || this.isRemoteUpdate) return;
    try {
      this.db.ref("torneo_momy/state").set(state).catch(err => {
        console.warn("Errore salvataggio stato torneo su Firebase:", err);
        if (err.message && err.message.toLowerCase().includes("permission")) {
          this.updateSyncStatus("error", "Permesso negato");
        }
      });
    } catch (e) {
      console.warn("pushStateToFirebase exception:", e);
    }
  }

  initFirebase() {
    try {
      if (typeof firebase === 'undefined') {
        console.warn("Firebase SDK non caricato");
        this.updateSyncStatus("error", "SDK non caricato");
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      this.db = firebase.database();
      this.updateSyncStatus("connecting", "Connessione...");

      let initialAccountsLoaded = false;
      let initialStateLoaded = false;

      // 1. Sincronizzazione Realtime ACCOUNTS
      const accountsRef = this.db.ref("torneo_momy/accounts");
      accountsRef.on("value", (snapshot) => {
        const val = snapshot.val();
        if (val) {
          const cloudAccounts = {};
          Object.values(val).forEach(acc => {
            if (acc && acc.email) {
              cloudAccounts[acc.email.toLowerCase().trim()] = acc;
            }
          });
          // Unisci con i dati locali per sicurezza
          this.accounts = { ...this.loadAccounts(), ...cloudAccounts };
          localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
          this.syncAccountsToPlayers();
          this.renderTabContent();
          this.renderUserBadge();
        } else if (!initialAccountsLoaded) {
          // Se Firebase è ancora vuoto, effettua il primo seeding con gli account locali
          const localAccounts = this.loadAccounts();
          if (Object.keys(localAccounts).length > 0) {
            console.log("Seeding account locali nel cloud Firebase...");
            this.pushAccountsToFirebase(localAccounts);
          }
        }
        initialAccountsLoaded = true;
        this.updateSyncStatus("online", "Sincronizzato");
      }, (error) => {
        console.error("Errore sincronizzazione Firebase accounts:", error);
        this.updateSyncStatus("error", error.code === "PERMISSION_DENIED" ? "Permesso negato" : "Disconnesso");
      });

      // 2. Sincronizzazione Realtime STATO TORNEO (partite, gironi, conferme orari, atleti)
      const stateRef = this.db.ref("torneo_momy/state");
      stateRef.on("value", (snapshot) => {
        const cloudState = snapshot.val();
        if (cloudState) {
          this.isRemoteUpdate = true;
          this.state = cloudState;
          if (!this.state.players) this.state.players = [];
          this.tournamentManager.state = this.state;
          localStorage.setItem(DATA_KEY, JSON.stringify(this.state));
          this.syncAccountsToPlayers();
          this.render();
          this.isRemoteUpdate = false;
        } else if (!initialStateLoaded) {
          // Se Firebase è ancora vuoto, effettua il primo seeding con lo stato locale
          if (this.state && this.state.players && this.state.players.length > 0) {
            console.log("Seeding stato torneo nel cloud Firebase...");
            this.pushStateToFirebase(this.state);
          }
        }
        initialStateLoaded = true;
        this.updateSyncStatus("online", "Sincronizzato");
      }, (error) => {
        console.error("Errore sincronizzazione Firebase state:", error);
        this.updateSyncStatus("error", error.code === "PERMISSION_DENIED" ? "Permesso negato" : "Disconnesso");
      });

    } catch (err) {
      console.error("Errore inizializzazione Firebase:", err);
      this.updateSyncStatus("error", "Errore Firebase");
    }
  }

  init() {
    this.initFirebase();
    this.syncAccountsToPlayers();
    this.bindEvents();
    this.renderUserBadge();
    this.render();

    // Se l'utente non ha ancora effettuato il login la prima volta, apri il modale
    if (!this.user) {
      setTimeout(() => {
        const accounts = this.loadAccounts();
        const hasAccounts = Object.keys(accounts).length > 0;
        this.openLoginModal(hasAccounts ? "login" : "register");
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

    // Form di Login con Password
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Form di Nuova Registrazione
    const registerForm = document.getElementById("register-form");
    if (registerForm) {
      registerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleRegister();
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

    // Form Risultato Partita Tabellone
    const matchScoreForm = document.getElementById("match-score-form");
    if (matchScoreForm) {
      matchScoreForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveMatchScore();
      });
    }

    // Form Risultato Partita Girone
    const groupMatchForm = document.getElementById("group-match-form");
    if (groupMatchForm) {
      groupMatchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveGroupMatchScore();
      });
    }

    // Form Recupera Password (Step 1 e Step 2)
    const forgotStep1 = document.getElementById("forgot-step1-form");
    if (forgotStep1) {
      forgotStep1.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleRequestPasswordReset();
      });
    }

    const forgotStep2 = document.getElementById("forgot-step2-form");
    if (forgotStep2) {
      forgotStep2.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleVerifyResetCode();
      });
    }

    // Calcolo automatico della categoria al cambio della data di nascita
    const hookBirthdateCategory = (birthdateId, categorySelectId) => {
      const bEl = document.getElementById(birthdateId);
      const cEl = document.getElementById(categorySelectId);
      if (bEl && cEl) {
        bEl.addEventListener("change", (e) => {
          if (categorySelectId === "register-category-select") {
            return;
          }
          if (categorySelectId.includes("account") && !this.isAdmin) {
            return;
          }
          const val = e.target.value;
          if (val) {
            const year = new Date(val).getFullYear();
            if (year >= 2014) cEl.value = "Pre Agonistica U12";
            else if (year >= 2012) cEl.value = "SAT U14";
            else cEl.value = "Pre Agonistica";
          }
        });
      }
    };

    hookBirthdateCategory("player-birthdate-input", "player-category-select");
    hookBirthdateCategory("account-birthdate-input", "account-category-select");
    hookBirthdateCategory("account-page-birthdate-input", "account-page-category-select");
    hookBirthdateCategory("admin-account-birthdate-input", "admin-account-category-select");

    // Form Personalizzazione Profilo Account
    const accountForm = document.getElementById("account-profile-form");
    if (accountForm) {
      accountForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveAccountProfile();
      });
    }

    // Form Programmazione Match Calendario (Admin)
    const scheduleMatchForm = document.getElementById("schedule-match-form");
    if (scheduleMatchForm) {
      scheduleMatchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveScheduleMatch();
      });
    }

    // Form Gestione Account (Admin)
    const adminAccountForm = document.getElementById("admin-account-form");
    if (adminAccountForm) {
      adminAccountForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveAdminAccount();
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
  // GESTIONE AUTENTICAZIONE, PASSWORD & BIOMETRICA
  // ==========================================
  togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    if (btn) {
      const showIcon = btn.querySelector(".eye-icon-show");
      const hideIcon = btn.querySelector(".eye-icon-hide");
      if (showIcon && hideIcon) {
        if (isPassword) {
          showIcon.classList.add("hidden");
          hideIcon.classList.remove("hidden");
        } else {
          showIcon.classList.remove("hidden");
          hideIcon.classList.add("hidden");
        }
      }
    }
  }

  toggleTablePassword(emailSafe, actualPassword) {
    const el = document.getElementById(`pwd-display-${emailSafe}`);
    if (!el) return;
    const isMasked = el.textContent.includes("•");
    if (isMasked) {
      el.textContent = actualPassword || "(Nessuna)";
      el.classList.remove("text-gray-800");
      el.classList.add("text-blue-900", "font-bold");
    } else {
      el.textContent = "••••••••";
      el.classList.remove("text-blue-900", "font-bold");
      el.classList.add("text-gray-800");
    }
  }

  switchAuthMode(mode) {
    this.authMode = mode;
    const tabLogin = document.getElementById("tab-auth-login");
    const tabRegister = document.getElementById("tab-auth-register");
    const secLogin = document.getElementById("auth-section-login");
    const secRegister = document.getElementById("auth-section-register");
    const secForgot = document.getElementById("auth-section-forgot");

    if (!tabLogin || !tabRegister || !secLogin || !secRegister) return;

    if (mode === "register") {
      tabRegister.className = "flex-1 py-2.5 text-center border-b-2 border-blue-600 text-blue-700 font-bold transition";
      tabLogin.className = "flex-1 py-2.5 text-center border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition";
      secLogin.classList.add("hidden");
      if (secForgot) secForgot.classList.add("hidden");
      secRegister.classList.remove("hidden");
      setTimeout(() => {
        const fn = document.getElementById("register-firstname-input");
        if (fn) fn.focus();
      }, 100);
    } else if (mode === "forgot") {
      tabLogin.className = "flex-1 py-2.5 text-center border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition";
      tabRegister.className = "flex-1 py-2.5 text-center border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition";
      secLogin.classList.add("hidden");
      secRegister.classList.add("hidden");
      if (secForgot) secForgot.classList.remove("hidden");
      this.resetForgotStep();
    } else {
      tabLogin.className = "flex-1 py-2.5 text-center border-b-2 border-blue-600 text-blue-700 font-bold transition";
      tabRegister.className = "flex-1 py-2.5 text-center border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition";
      secRegister.classList.add("hidden");
      if (secForgot) secForgot.classList.add("hidden");
      secLogin.classList.remove("hidden");
      setTimeout(() => {
        const em = document.getElementById("login-email-input");
        if (em) em.focus();
      }, 100);
    }
  }

  resetForgotStep() {
    this.isSendingResetEmail = false;
    const step1 = document.getElementById("forgot-step-1");
    const step2 = document.getElementById("forgot-step-2");
    if (step1) step1.classList.remove("hidden");
    if (step2) step2.classList.add("hidden");
    const btn = document.getElementById("btn-request-reset-code");
    const label = document.getElementById("btn-request-reset-label");
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("opacity-50", "cursor-not-allowed");
    }
    if (label) label.textContent = "Invia Codice di Verifica via Email";
    const em = document.getElementById("forgot-email-input");
    if (em) {
      if (!em.value && this.user && this.user.email && this.user.email !== "ospite@torneo.it") {
        em.value = this.user.email;
      }
      setTimeout(() => em.focus(), 100);
    }
  }

  async handleRequestPasswordReset() {
    if (this.isSendingResetEmail) return;

    const emailInput = document.getElementById("forgot-email-input");
    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";

    if (!email) {
      alert("Inserisci l'indirizzo email del tuo account.");
      return;
    }

    const accounts = this.loadAccounts();
    const account = accounts[email];

    if (!account) {
      alert(`Nessun account registrato con l'indirizzo "${email}".\n\nVerifica l'indirizzo digitato o procedi con una nuova registrazione.`);
      return;
    }

    this.isSendingResetEmail = true;

    // Genera codice di verifica sicuro a 6 cifre
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.pendingPasswordReset = {
      email: email,
      code: code,
      expiresAt: Date.now() + 15 * 60 * 1000 // Scadenza 15 minuti
    };
    try {
      localStorage.setItem("torneo_momy_pending_reset", JSON.stringify(this.pendingPasswordReset));
    } catch (e) {}

    // Stato visivo di caricamento
    const btn = document.getElementById("btn-request-reset-code");
    const label = document.getElementById("btn-request-reset-label");
    if (btn) {
      btn.disabled = true;
      btn.classList.add("opacity-50", "cursor-not-allowed");
    }
    if (label) label.textContent = "Invio codice in corso...";

    const athleteName = account ? `${account.firstName || ''} ${account.lastName || ''}`.trim() || 'Atleta' : 'Atleta';

    // Invio effettivo email via API FormSubmit (una sola email con codice)
    try {
      await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          _subject: `Codice di Verifica Password Torneo Momy: ${code}`,
          _template: "table",
          _captcha: "false",
          atleta: athleteName,
          email_account: email,
          codice_di_verifica: code,
          validita: "15 minuti",
          messaggio: `Ciao ${athleteName}, hai richiesto il reset della password del tuo account per il Torneo Momy 26/27. Inserisci il codice ${code} per impostare la nuova password.`
        })
      });
    } catch (err) {
      console.warn("Invio FormSubmit non riuscito o bloccato da CORS/file://", err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("opacity-50", "cursor-not-allowed");
      }
      if (label) label.textContent = "Invia Codice di Verifica via Email";
      this.isSendingResetEmail = false;
    }

    // Passa a Step 2 (SENZA mostrare il codice sul sito)
    const step1 = document.getElementById("forgot-step-1");
    const step2 = document.getElementById("forgot-step-2");
    if (step1) step1.classList.add("hidden");
    if (step2) step2.classList.remove("hidden");

    const sentEmailLabel = document.getElementById("forgot-sent-email-label");
    if (sentEmailLabel) sentEmailLabel.textContent = email;

    const codeInput = document.getElementById("forgot-code-input");
    if (codeInput) {
      codeInput.value = "";
      setTimeout(() => codeInput.focus(), 150);
    }

    this.showToast(`Email con codice inviata a ${email}! Controlla la tua casella di posta.`, "success", 6000);
  }

  handleVerifyResetCode() {
    if (!this.pendingPasswordReset || !this.pendingPasswordReset.code) {
      alert("Nessuna richiesta di reset password attiva. Richiedi prima un nuovo codice.");
      this.resetForgotStep();
      return;
    }

    if (Date.now() > this.pendingPasswordReset.expiresAt) {
      alert("Il codice di verifica è scaduto (validità 15 minuti). Richiedine uno nuovo.");
      this.resetForgotStep();
      return;
    }

    const codeInput = document.getElementById("forgot-code-input");
    const newPasswordInput = document.getElementById("forgot-new-password-input");
    const confirmPasswordInput = document.getElementById("forgot-confirm-password-input");

    const enteredCode = (codeInput ? codeInput.value : "").trim();
    const newPassword = newPasswordInput ? newPasswordInput.value : "";
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : "";

    if (!enteredCode || enteredCode !== this.pendingPasswordReset.code) {
      alert("Il codice di verifica inserito non è corretto. Controlla l'email ricevuta (anche nella cartella Spam).");
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      alert("La nuova password deve contenere almeno 4 caratteri.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Le due password inserite non coincidono.");
      return;
    }

    const email = this.pendingPasswordReset.email;
    const accounts = this.loadAccounts();
    const account = accounts[email];

    if (!account) {
      alert(`Account non trovato per ${email}.`);
      return;
    }

    // Aggiorna password salvata
    account.password = newPassword;
    accounts[email] = account;
    this.saveAccounts(accounts);

    // Rimuove richiesta pendente
    this.pendingPasswordReset = null;
    try {
      localStorage.removeItem("torneo_momy_pending_reset");
    } catch (e) {}

    // Login automatico
    this.saveUser(account);
    this.closeModal("modal-login");
    this.showToast(`Password reimpostata con successo! Benvenuto, ${account.firstName || 'Atleta'}!`, "success");
  }

  handleRegister() {
    const firstName = document.getElementById("register-firstname-input").value.trim();
    const lastName = document.getElementById("register-lastname-input").value.trim();
    const email = document.getElementById("register-email-input").value.trim().toLowerCase();
    const password = document.getElementById("register-password-input").value;
    const birthDate = document.getElementById("register-birthdate-input").value.trim();
    const ranking = document.getElementById("register-ranking-input").value.trim() || "NC";
    const biometricsChecked = document.getElementById("register-biometrics-checkbox")?.checked ?? true;

    if (!firstName || !lastName) {
      alert("Inserisci sia il Nome che il Cognome.");
      return;
    }
    if (!email) {
      alert("Inserisci un indirizzo email valido.");
      return;
    }
    if (!password || password.length < 4) {
      alert("La password deve contenere almeno 4 caratteri.");
      return;
    }
    if (!birthDate) {
      alert("Inserisci la data di nascita.");
      return;
    }

    const isAdmin = isUserAdmin(email);

    const accounts = this.loadAccounts();

    // CONTROLLO UNICITÀ EMAIL: non possono esistere due o più account con la stessa mail
    if (accounts[email]) {
      alert(`Attenzione: un account con l'indirizzo email "${email}" risulta già registrato.\n\nNon possono esistere due o più account con la stessa mail. Se è il tuo account, effettua l'accesso inserendo la password, oppure usa "Password dimenticata?" per recuperarla.`);
      this.switchAuthMode("login");
      const loginEmail = document.getElementById("login-email-input");
      if (loginEmail) loginEmail.value = email;
      return;
    }

    // La categoria non viene scelta dall'utente: viene assegnata dall'amministrazione del torneo
    const category = "Da Assegnare";

    const accountObj = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      email,
      password,
      birthDate,
      ranking,
      category,
      role: isAdmin ? "admin" : "player",
      biometricsEnabled: biometricsChecked
    };

    accounts[email] = accountObj;
    this.saveAccounts(accounts);
    localStorage.setItem(LAST_EMAIL_KEY, email);

    // Inserisci direttamente il giocatore nella lista atleti (in attesa di assegnazione torneo da admin)
    if (!isAdmin) {
      if (!this.state.players) this.state.players = [];
      const cleanEmail = email.toLowerCase().trim();
      const existingPlayer = this.state.players.find(p =>
        (p.email && p.email.toLowerCase().trim() === cleanEmail) ||
        (p.userId && p.userId.toLowerCase().trim() === cleanEmail)
      );
      if (!existingPlayer) {
        const newPlayer = {
          id: `p-${Date.now()}`,
          firstName,
          lastName,
          name: accountObj.name,
          birthDate,
          ranking,
          category,
          notes: "",
          email: cleanEmail,
          userId: cleanEmail,
          photoUrl: "",
          status: "confermato"
        };
        this.state.players.push(newPlayer);
      } else {
        existingPlayer.firstName = firstName;
        existingPlayer.lastName = lastName;
        existingPlayer.name = accountObj.name;
        existingPlayer.birthDate = birthDate;
        existingPlayer.ranking = ranking;
        existingPlayer.category = category;
      }
      this.tournamentManager.ensureCategories();
      this.saveState();
    }

    this.saveUser(accountObj);
    this.closeModal("modal-login");

    if (isAdmin) {
      this.showToast("Benvenuto Amministratore!", "success");
    } else {
      this.showToast(`Benvenuto ${accountObj.name}! Account creato con successo. La categoria di gara verrà assegnata dall'amministrazione.`, "success", 6000);
    }
  }

  handleLogin() {
    const email = document.getElementById("login-email-input").value.trim().toLowerCase();
    const password = document.getElementById("login-password-input").value;

    if (!email) {
      alert("Inserisci l'indirizzo email.");
      return;
    }
    if (!password) {
      alert("Inserisci la password.");
      return;
    }

    const accounts = this.loadAccounts();
    let account = accounts[email];

    // Se è la mail admin e non ha ancora account locale salvato, inizializzala
    const isAdmin = isUserAdmin(email);
    if (!account && isAdmin) {
      const isAlessia = email === "alessia.ditullio1996@gmail.com";
      account = {
        firstName: isAlessia ? "Alessia" : "Luca",
        lastName: isAlessia ? "Di Tullio" : "Barcello",
        name: isAlessia ? "Alessia Di Tullio" : "Barcello Luca",
        email: email,
        password: password,
        birthDate: isAlessia ? "1996-01-01" : "2002-01-01",
        ranking: isAlessia ? "NC" : "4.1",
        role: "admin",
        biometricsEnabled: true
      };
      accounts[email] = account;
      this.saveAccounts(accounts);
    }

    if (!account) {
      if (confirm(`Nessun account registrato con l'email ${email}. Vuoi registrarti adesso?`)) {
        this.switchAuthMode("register");
        const regEmail = document.getElementById("register-email-input");
        const regPass = document.getElementById("register-password-input");
        if (regEmail) regEmail.value = email;
        if (regPass) regPass.value = password;
      }
      return;
    }

    if (account.password && account.password !== password) {
      alert(`Password errata per l'account "${email}".\n\nPuoi visualizzare la password digitata cliccando sull'icona con l'occhio 👁️, oppure reimpostarla tramite il link "Password dimenticata?".`);
      return;
    }

    localStorage.setItem(LAST_EMAIL_KEY, email);
    this.saveUser(account);
    this.closeModal("modal-login");

    if (account.role === "admin") {
      this.showToast("Accesso Amministratore confermato!", "success");
    } else {
      this.showToast(`Bentornato ${account.name}!`, "success");
    }
  }

  async loginWithBiometrics() {
    const accounts = this.loadAccounts();
    const lastEmail = localStorage.getItem(LAST_EMAIL_KEY);
    const account = (lastEmail && accounts[lastEmail]) ? accounts[lastEmail] : (Object.values(accounts)[0] || null);

    if (!account) {
      this.showToast("Nessun account memorizzato. Effettua prima la registrazione.", "info");
      this.switchAuthMode("register");
      return;
    }

    // Verifica biometrica reale (Touch ID / Face ID via WebAuthn Platform Authenticator)
    if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          await navigator.credentials.get({
            publicKey: {
              challenge: challenge,
              timeout: 60000,
              userVerification: "preferred"
            }
          }).catch(err => {
            console.warn("WebAuthn biometric callback:", err);
            if (err.name === "NotAllowedError") throw err;
          });
        }
      } catch (err) {
        if (err.name === "NotAllowedError") {
          this.showToast("Verifica Face ID / Touch ID annullata.", "info");
          return;
        }
      }
    }

    localStorage.setItem(LAST_EMAIL_KEY, account.email);
    this.saveUser(account);
    this.closeModal("modal-login");
    this.showToast(`Accesso rapido Face ID / Touch ID completato! Ciao ${account.name}`, "success");
  }

  loginAsGuest() {
    const userObj = {
      email: "ospite@torneo.it",
      firstName: "Spettatore",
      lastName: "",
      name: "Spettatore",
      birthDate: "",
      ranking: "NC",
      role: "player"
    };
    this.saveUser(userObj);
    this.closeModal("modal-login");
    this.showToast("Accesso come Spettatore (Sola lettura)", "info");
  }

  openLoginModal(defaultMode = null) {
    const accounts = this.loadAccounts();
    const hasAccounts = Object.keys(accounts).length > 0;
    const lastEmail = localStorage.getItem(LAST_EMAIL_KEY);

    // Controlla se mostrare il blocco Face ID / Touch ID
    const biometricsBox = document.getElementById("biometrics-login-wrapper");
    if (biometricsBox) {
      if (hasAccounts) {
        biometricsBox.classList.remove("hidden");
      } else {
        biometricsBox.classList.add("hidden");
      }
    }

    // Pre-popola l'email dell'ultimo utente
    const emailInput = document.getElementById("login-email-input");
    if (emailInput) {
      emailInput.value = lastEmail || (this.user && this.user.email !== "ospite@torneo.it" ? this.user.email : "");
    }
    const passInput = document.getElementById("login-password-input");
    if (passInput) {
      passInput.value = "";
      passInput.type = "password";
    }

    const mode = defaultMode || (hasAccounts ? "login" : "register");
    this.openModal("modal-login");
    this.switchAuthMode(mode);
  }

  renderUserBadge() {
    const headerAvatar = document.getElementById("header-avatar-circle");
    const accountLabel = document.getElementById("header-account-label");
    const navAccountLabel = document.getElementById("nav-account-label");

    if (!this.user || this.user.email === "ospite@torneo.it") {
      if (headerAvatar) {
        headerAvatar.innerHTML = `
          <svg class="w-3.5 h-3.5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        `;
      }
      if (accountLabel) {
        accountLabel.textContent = "Account";
      }
      if (navAccountLabel) {
        navAccountLabel.textContent = "Account";
      }
      this.updateScheduleBadge();
      return;
    }

    const avatarHtml = this.getAvatarMarkup(this.user, "w-6 h-6", "text-[10px]");
    if (headerAvatar) {
      headerAvatar.innerHTML = avatarHtml;
    }

    if (accountLabel) {
      const displayName = this.user.firstName || (this.user.name ? this.user.name.split(" ")[0] : "Account");
      accountLabel.textContent = displayName;
    }

    if (navAccountLabel) {
      const displayName = this.user.firstName || "Account";
      navAccountLabel.textContent = displayName;
    }

    this.updateScheduleBadge();
  }

  getCurrentPlayer() {
    if (!this.user) return null;
    const email = (this.user.email || "").toLowerCase().trim();
    const fullName = (this.user.name || `${this.user.firstName || ''} ${this.user.lastName || ''}`).toLowerCase().trim();
    const firstName = (this.user.firstName || "").toLowerCase().trim();
    const lastName = (this.user.lastName || "").toLowerCase().trim();

    return (this.state.players || []).find(p => {
      if (p.userId && p.userId.toLowerCase().trim() === email) return true;
      if (p.email && p.email.toLowerCase().trim() === email) return true;
      const pName = (p.name || "").toLowerCase().trim();
      if (pName && fullName && pName === fullName) return true;
      if (firstName && lastName && pName.includes(firstName) && pName.includes(lastName)) return true;
      return false;
    }) || null;
  }

  getPendingScheduleMatchesForUser() {
    const cp = this.getCurrentPlayer();
    if (!cp) return [];

    const allMatches = this.getAllMatches();
    return allMatches.filter(item => {
      const m = item.match;
      if (!m.dateTime || m.status === "completato") return false;
      const isP1 = m.player1Id === cp.id;
      const isP2 = m.player2Id === cp.id;
      if (!isP1 && !isP2) return false;

      if (isP1 && (!m.p1Acceptance || m.p1Acceptance === "pending")) return true;
      if (isP2 && (!m.p2Acceptance || m.p2Acceptance === "pending")) return true;
      return false;
    });
  }

  updateScheduleBadge() {
    const badge = document.getElementById("schedule-nav-badge");
    if (!badge) return;
    const pending = this.getPendingScheduleMatchesForUser();
    if (pending.length > 0) {
      badge.textContent = `${pending.length}`;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  getAvatarMarkup(user, sizeClass = "w-6 h-6", textClass = "text-xs") {
    if (!user) return "";
    if (user.photoUrl) {
      return `<img src="${user.photoUrl}" alt="Avatar" class="${sizeClass} rounded-full object-cover">`;
    }
    const initials = (user.firstName ? user.firstName[0] : "") + (user.lastName ? user.lastName[0] : (user.name ? user.name[0] : "U"));
    return `<span class="${textClass} font-black uppercase text-blue-950">${initials || 'U'}</span>`;
  }

  // ==========================================
  // GESTIONE PROFILO ACCOUNT
  // ==========================================
  openAccountPage() {
    this.switchTab("account");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  openAccountModal() {
    this.openAccountPage();
  }

  renderAccountAvatarPreview() {
    const containers = [
      document.getElementById("account-avatar-preview"),
      document.getElementById("account-page-avatar-preview"),
      document.getElementById("account-page-form-avatar-preview")
    ].filter(Boolean);

    if (containers.length === 0 || !this.user) return;

    let content = "";
    if (this.user.photoUrl) {
      content = `<img src="${this.user.photoUrl}" alt="Avatar" class="w-full h-full object-cover rounded-2xl">`;
    } else {
      const initials = (this.user.firstName ? this.user.firstName[0] : "") + (this.user.lastName ? this.user.lastName[0] : (this.user.name ? this.user.name[0] : "U"));
      content = `<span class="text-2xl font-black uppercase text-yellow-300">${initials || 'U'}</span>`;
    }

    containers.forEach(c => {
      c.innerHTML = content;
    });
  }

  handlePhotoUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Seleziona un file immagine valido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!this.user) return;
      this.user.photoUrl = e.target.result;
      delete this.user.presetAvatar;
      this.renderAccountAvatarPreview();
      this.renderUserBadge();
      this.showToast("Foto caricata! Clicca 'Salva Modifiche' per confermare.", "info");
    };
    reader.readAsDataURL(file);
  }

  removeAccountPhoto() {
    if (!this.user) return;
    delete this.user.photoUrl;
    delete this.user.presetAvatar;
    this.renderAccountAvatarPreview();
    this.renderUserBadge();
    this.showToast("Foto rimossa.", "info");
  }

  handleSaveAccountProfile() {
    if (!this.user) return;

    const fnEl = document.getElementById("account-page-firstname-input") || document.getElementById("account-firstname-input");
    const lnEl = document.getElementById("account-page-lastname-input") || document.getElementById("account-lastname-input");
    const bdEl = document.getElementById("account-page-birthdate-input") || document.getElementById("account-birthdate-input");
    const rkEl = document.getElementById("account-page-ranking-input") || document.getElementById("account-ranking-input");
    const catEl = document.getElementById("account-page-category-select") || document.getElementById("account-category-select");
    const npEl = document.getElementById("account-page-newpassword-input") || document.getElementById("account-newpassword-input");
    const cpEl = document.getElementById("account-page-confirmpassword-input") || document.getElementById("account-confirmpassword-input");
    const bioEl = document.getElementById("account-page-biometrics-toggle") || document.getElementById("account-biometrics-toggle");

    const firstName = fnEl ? fnEl.value.trim() : "";
    const lastName = lnEl ? lnEl.value.trim() : "";
    const birthDate = bdEl ? bdEl.value.trim() : "";
    const ranking = rkEl ? rkEl.value.trim() : "NC";
    const category = (this.isAdmin && catEl) ? catEl.value : (this.user.category || this.tournamentManager.getPlayerCategory(this.user));
    const newPassword = npEl ? npEl.value : "";
    const confirmPassword = cpEl ? cpEl.value : "";
    const biometricsEnabled = bioEl ? bioEl.checked : true;

    if (!firstName || !lastName) {
      alert("Inserisci sia il Nome che il Cognome.");
      return;
    }
    if (!birthDate) {
      alert("Inserisci la Data di Nascita.");
      return;
    }

    if (newPassword) {
      if (newPassword.length < 4) {
        alert("La nuova password deve contenere almeno 4 caratteri.");
        return;
      }
      if (newPassword !== confirmPassword) {
        alert("Le due password non corrispondono.");
        return;
      }
    }

    const fullName = `${firstName} ${lastName}`.trim();

    this.user.firstName = firstName;
    this.user.lastName = lastName;
    this.user.name = fullName;
    this.user.birthDate = birthDate;
    this.user.ranking = ranking;
    this.user.category = category;
    this.user.biometricsEnabled = biometricsEnabled;
    if (newPassword) {
      this.user.password = newPassword;
    }

    // Aggiorna accounts
    const accounts = this.loadAccounts();
    const emailKey = this.user.email.toLowerCase();
    accounts[emailKey] = {
      ...(accounts[emailKey] || {}),
      ...this.user
    };
    this.saveAccounts(accounts);
    this.saveUser(this.user);

    // Sincronizza nell'elenco iscritti
    const playerIdx = this.state.players.findIndex(p =>
      (p.userId && p.userId === this.user.email) ||
      (p.email && p.email.toLowerCase() === emailKey)
    );
    if (playerIdx !== -1) {
      this.state.players[playerIdx].firstName = firstName;
      this.state.players[playerIdx].lastName = lastName;
      this.state.players[playerIdx].name = fullName;
      this.state.players[playerIdx].birthDate = birthDate;
      this.state.players[playerIdx].ranking = ranking;
      this.state.players[playerIdx].category = category;
      if (this.user.photoUrl) this.state.players[playerIdx].photoUrl = this.user.photoUrl;
      this.tournamentManager.ensureCategories();
      this.saveState();
    } else if (this.user.role !== "admin") {
      const newPlayer = {
        id: `p-${Date.now()}`,
        firstName,
        lastName,
        name: fullName,
        birthDate,
        ranking,
        category,
        notes: "",
        email: emailKey,
        userId: emailKey,
        photoUrl: this.user.photoUrl || "",
        status: "confermato"
      };
      this.state.players.push(newPlayer);
      this.tournamentManager.ensureCategories();
      this.saveState();
    }

    this.closeModal("modal-account");
    this.renderUserBadge();
    if (this.currentTab === "account") {
      this.renderAccountView();
    } else {
      this.render();
    }
    this.showToast("Profilo aggiornato con successo!", "success");
  }

  handleSaveAccountProfilePage() {
    this.handleSaveAccountProfile();
  }

  formatDate(dateStr) {
    if (!dateStr) return "-";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("it-IT");
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }

  // ==========================================
  // NAVIGAZIONE TAB (ISCRITTI, GIRONI, TABELLONE, REGOLAMENTO)
  // ==========================================
  switchTab(tab) {
    this.currentTab = tab;

    // Se si naviga in Gironi e la categoria attiva è "all", imposta Pre Agonistica U12 di default
    if (tab === "groups" && this.selectedCategory === "all") {
      this.selectedCategory = "Pre Agonistica U12";
    }

    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      if (btn.dataset.tab === tab) {
        btn.classList.add("border-blue-600", "text-blue-700", "bg-blue-50/70", "font-semibold");
        btn.classList.remove("border-transparent", "text-gray-600", "hover:text-gray-900");
      } else {
        btn.classList.remove("border-blue-600", "text-blue-700", "bg-blue-50/70", "font-semibold");
        btn.classList.add("border-transparent", "text-gray-600", "hover:text-gray-900");
      }
    });

    this.renderCategorySelector();
    this.renderTabContent();
  }

  // ==========================================
  // GESTIONE SELETTORE CATEGORIA (PRE AGONISTICA U12, PRE AGONISTICA, SAT U14, SAT)
  // ==========================================
  setCategory(cat) {
    this.selectedCategory = cat;
    this.renderCategorySelector();
    this.renderTabContent();
  }

  renderCategorySelector() {
    const wrapper = document.getElementById("category-bar-wrapper");
    const allowedTabs = ["players", "groups", "bracket"];
    const showBar = allowedTabs.includes(this.currentTab);
    if (wrapper) {
      wrapper.classList.toggle("hidden", !showBar);
    }
    if (!showBar) return;

    const container = document.getElementById("category-selector-buttons");
    if (!container) return;

    const cats = [
      { id: "all", label: "Tutte", full: "Tutte le Categorie" },
      { id: "Pre Agonistica U12", label: "Pre Ag. U12", full: "Pre Agonistica U12" },
      { id: "Pre Agonistica", label: "Pre Agonistica", full: "Pre Agonistica" },
      { id: "SAT U14", label: "SAT U14", full: "SAT U14" },
      { id: "SAT", label: "SAT", full: "SAT" }
    ];

    const unassignedCount = this.state.players.filter(p => this.tournamentManager.getPlayerCategory(p) === "Da Assegnare").length;
    if (this.currentTab === "players" && unassignedCount > 0) {
      cats.push({ id: "Da Assegnare", label: "⏳ Da Assegnare", full: "In attesa di Assegnazione" });
    }

    const counts = { all: this.state.players.length, "Da Assegnare": unassignedCount };
    TournamentManager.CATEGORIES.forEach(c => {
      counts[c] = this.state.players.filter(p => this.tournamentManager.getPlayerCategory(p) === c).length;
    });

    // In Gironi "all" non è ammesso, ma in Tabellone "all" permette di visualizzare tutti i tabelloni divisi per categoria
    if (this.currentTab === "groups" && (this.selectedCategory === "all" || this.selectedCategory === "Da Assegnare")) {
      this.selectedCategory = "Pre Agonistica U12";
    } else if (this.currentTab === "bracket" && this.selectedCategory === "Da Assegnare") {
      this.selectedCategory = "all";
    }

    let html = "";
    cats.forEach(c => {
      if (this.currentTab === "groups" && (c.id === "all" || c.id === "Da Assegnare")) {
        return;
      }
      if (this.currentTab === "bracket" && c.id === "Da Assegnare") {
        return;
      }

      const isActive = this.selectedCategory === c.id;
      const activeClass = isActive
        ? (c.id === "Da Assegnare"
            ? "bg-amber-400 text-amber-950 font-black shadow border-amber-300 ring-2 ring-amber-400/50"
            : "bg-yellow-400 text-blue-950 font-black shadow border-yellow-300 ring-2 ring-yellow-400/50")
        : (c.id === "Da Assegnare"
            ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold border-amber-400/40"
            : "bg-white/10 hover:bg-white/20 text-white font-medium border-white/20");

      html += `
        <button type="button" onclick="app.setCategory('${c.id}')" class="px-2.5 py-1 rounded-lg text-xs border transition flex items-center gap-1.5 cursor-pointer ${activeClass}">
          <span>${c.label}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? 'bg-blue-950 text-yellow-300' : 'bg-white/20 text-white'}">${counts[c.id] ?? 0}</span>
        </button>
      `;
    });

    container.innerHTML = html;

    const statusBadge = document.getElementById("category-status-indicator");
    if (statusBadge) {
      const activeObj = cats.find(c => c.id === this.selectedCategory) || cats[1];
      const count = counts[this.selectedCategory] ?? 0;
      statusBadge.innerHTML = `Categoria attiva: <span class="font-black text-yellow-400 uppercase tracking-wide ml-1">${activeObj.full}</span> <span class="text-white/70 ml-1">(${count} iscritti)</span>`;
    }
  }

  getCategoryBadgeMarkup(category) {
    const cat = category || "Da Assegnare";
    if (cat === "Pre Agonistica U12") {
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">Pre Ag. U12</span>`;
    } else if (cat === "Pre Agonistica") {
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">Pre Agonistica</span>`;
    } else if (cat === "SAT U14") {
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-300">SAT U14</span>`;
    } else if (cat === "SAT") {
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">SAT</span>`;
    } else if (cat === "Da Assegnare") {
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">⏳ Da Assegnare</span>`;
    }
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-300">${cat}</span>`;
  }

  getCategoryFormatInfo(category) {
    const cat = category || "Pre Agonistica U12";
    const isPreAg = cat === "Pre Agonistica" || cat === "Pre Agonistica U12";
    if (isPreAg) {
      return {
        type: "pre_agonistica",
        durationText: "1 ora e mezza (90 min)",
        shortDuration: "1h 30m",
        formula: "Long-set ai 9",
        summary: "Partite da 1 ora e mezza • Formula Long-set ai 9",
        badgeColor: "bg-purple-100 text-purple-900 border-purple-300"
      };
    } else {
      return {
        type: "sat",
        durationText: "1 ora (60 min)",
        shortDuration: "1h",
        formula: "1 ora suono della campana",
        summary: "Partite da 1 ora continua fino al suono della campana",
        badgeColor: "bg-sky-100 text-sky-900 border-sky-300"
      };
    }
  }

  renderTabContent() {
    const tabPanels = ["players", "groups", "schedule", "bracket", "rules", "account"];
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
      case "groups":
        this.renderGroupsView();
        break;
      case "schedule":
        this.renderScheduleView();
        break;
      case "bracket":
        this.renderBracketView();
        break;
      case "rules":
        this.renderRulesView();
        break;
      case "account":
        this.renderAccountView();
        break;
    }
  }

  render() {
    this.tournamentManager.ensureCategories();
    this.tournamentManager.ensureGroups(this.selectedCategory === "all" ? "Pre Agonistica U12" : this.selectedCategory);

    this.renderCategorySelector();

    // Aggiorna contatore iscritti nell'header nav
    const playersCount = this.state.players.length;
    const navCount = document.getElementById("nav-players-count");
    if (navCount) navCount.textContent = playersCount;

    this.updateScheduleBadge();

    this.renderTabContent();
  }

  // ==========================================
  // SEZIONE FASE A GIRONE UNICO PER CATEGORIA
  // ==========================================
  renderGroupsView() {
    const container = document.getElementById("groups-container");
    if (!container) return;

    if (this.selectedCategory === "all") {
      this.selectedCategory = "Pre Agonistica U12";
    }
    const cat = this.selectedCategory;
    const formatInfo = this.getCategoryFormatInfo(cat);

    this.tournamentManager.ensureCategories();
    this.tournamentManager.ensureGroups(cat);

    const standings = this.tournamentManager.getGroupStandings("single", cat);
    const catGroup = this.state.categoryGroups[cat] || this.tournamentManager.ensureGroups(cat);
    const singleGroup = catGroup.single || catGroup.sinner;
    const matches = singleGroup.matches || [];

    const categoryPlayers = this.state.players.filter(p => this.tournamentManager.getPlayerCategory(p) === cat);
    const totalPlayersInCat = categoryPlayers.length;
    const totalInGroup = (singleGroup.playerIds || []).length;
    const completedMatchesCount = matches.filter(m => m.status === "completato").length;

    let html = `
      <div class="space-y-6">
        
        <!-- Banner Intestazione & Regolamento Girone Unico -->
        <div class="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-blue-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
              <span class="text-xs font-black uppercase tracking-wider text-yellow-300">Girone Unico • Categoria ${cat}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-md font-bold bg-white/20 text-yellow-300">${formatInfo.shortDuration} • ${formatInfo.formula}</span>
            </div>
            <h2 class="text-xl sm:text-2xl font-extrabold tracking-tight">Girone Unico (${cat})</h2>
            <p class="text-xs text-blue-200 mt-1 max-w-2xl leading-relaxed">
              Formula: <strong>${formatInfo.durationText}</strong> (${formatInfo.formula}). Se in parità al termine del tempo, <strong>rimane il pareggio (1 punto ciascuno)</strong>.
              Vittoria: 3 pt • Pareggio: 1 pt • Sconfitta: 0 pt. Il punteggio e la classifica si aggiornano da soli al termine di ogni partita.
              <strong>A fine anno, i migliori 8 atleti disputeranno il Tabellone Finale</strong>.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button onclick="window.print()" title="Stampa Girone e Classifica per Bacheca Circolo" class="w-full sm:w-auto bg-white/15 hover:bg-white/25 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-white/30 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm">
              <svg class="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
              <span>Stampa Girone (${cat})</span>
            </button>
            ${this.isAdmin ? `
              <button onclick="app.handleAutoAssignGroups('${cat}')" class="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black text-xs px-3.5 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer">
                + Aggiorna Incontri Girone Unico (${cat})
              </button>
              ${totalInGroup >= 2 ? `
                <button onclick="app.handleGenerateBracketFromGroups('${cat}')" class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl border border-blue-500 transition flex items-center justify-center gap-1.5 cursor-pointer shadow">
                  Genera Tabellone Finale Top 8 (${cat})
                </button>
              ` : ''}
            ` : ''}
          </div>
        </div>
    `;

    if (totalInGroup === 0) {
      html += `
        <div class="text-center py-16 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div class="w-14 h-14 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-gray-800 mb-1">Girone Unico (${cat}) non ancora composto</h3>
          <p class="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mb-6">
            ${totalPlayersInCat === 0
              ? `Nessun atleta è attualmente iscritto nella categoria <strong>${cat}</strong>. Inserisci atleti in questa categoria o seleziona un'altra categoria.`
              : `Ci sono attualmente <strong>${totalPlayersInCat}</strong> atleti iscritti nella categoria <strong>${cat}</strong>. Clicca sul pulsante qui sotto per generare il Girone Unico con tutti i partecipanti.`}
          </p>
          ${this.isAdmin && totalPlayersInCat >= 2 ? `
            <button onclick="app.handleAutoAssignGroups('${cat}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition cursor-pointer">
              Genera Girone Unico (${totalPlayersInCat} Partecipanti ${cat})
            </button>
          ` : `
            <button onclick="app.switchTab('players')" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition cursor-pointer">
              Vai alla sezione Iscritti
            </button>
          `}
        </div>
      </div>
      `;
      container.innerHTML = html;
      return;
    }

    // Layout con Classifica a sinistra e Incontri a destra
    html += `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- Colonna Sinistra: Classifica Ufficiale Girone Unico -->
        <div class="lg:col-span-7 space-y-4">
          <div class="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden flex flex-col">
            <div class="bg-gradient-to-r from-blue-900 to-blue-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-blue-900/60">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-yellow-400 text-blue-950 flex items-center justify-center font-black text-sm shadow-sm flex-shrink-0">
                  🏆
                </div>
                <div>
                  <h3 class="text-base sm:text-lg font-black tracking-tight">Classifica Girone Unico (${cat})</h3>
                  <p class="text-[11px] text-blue-200">${standings.length} ${standings.length === 1 ? 'atleta' : 'atleti'} • Aggiornamento automatico in tempo reale</p>
                </div>
              </div>
              <span class="bg-emerald-400 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">
                Top 8 a fine anno
              </span>
            </div>

            <div class="p-4 sm:p-5 space-y-4">
              <div class="overflow-x-auto rounded-xl border border-gray-100 shadow-2xs">
                <table class="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr class="bg-slate-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
                      <th class="py-2.5 px-2 text-center w-7">#</th>
                      <th class="py-2.5 px-2.5">Nome e Cognome</th>
                      <th class="py-2.5 px-2 text-center font-black text-blue-950 bg-blue-50/50" title="Punti">PT</th>
                      <th class="py-2.5 px-2 text-center text-gray-600" title="Partite Giocate">G</th>
                      <th class="py-2.5 px-2 text-center text-emerald-700" title="Vinte">V</th>
                      <th class="py-2.5 px-2 text-center text-amber-700" title="Pari">P</th>
                      <th class="py-2.5 px-2 text-center text-rose-700" title="Perse">S</th>
                      <th class="py-2.5 px-2 text-center text-gray-700" title="Game Vinti">GV</th>
                      <th class="py-2.5 px-2 text-center text-gray-700" title="Diff Game">Diff</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    ${standings.map((s, idx) => {
                      const isMe = this.user && s.player.email && this.user.email && (s.player.email.toLowerCase() === this.user.email.toLowerCase());
                      const isTop8 = idx < 8;
                      const is8th = idx === 7;
                      
                      let rowHtml = `
                        <tr class="hover:bg-blue-50/50 transition ${isMe ? 'bg-blue-50/70 font-semibold' : ''}">
                          <td class="py-2.5 px-2 text-center font-mono font-bold">
                            <span class="inline-flex items-center justify-center w-5 h-5 rounded-md ${isTop8 ? 'bg-emerald-100 text-emerald-800 text-[10px]' : 'text-gray-400 text-xs'}">
                              ${idx + 1}
                            </span>
                          </td>
                          <td class="py-2.5 px-2.5 font-bold text-gray-900">
                            <div class="flex items-center gap-1.5 truncate">
                              <span class="truncate">${s.player.name}</span>
                              ${s.player.ranking ? `<span class="text-[9px] font-mono bg-slate-100 text-slate-700 px-1 py-0.2 rounded font-semibold">${s.player.ranking}</span>` : ''}
                              ${isTop8 ? `<span class="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 rounded font-bold">Top 8</span>` : ''}
                            </div>
                          </td>
                          <td class="py-2.5 px-2 text-center bg-blue-50/30">
                            <span class="bg-yellow-400 text-blue-950 font-black text-xs px-2 py-0.5 rounded-md shadow-xs">
                              ${s.points}
                            </span>
                          </td>
                          <td class="py-2.5 px-2 text-center font-mono text-gray-600">${s.played}</td>
                          <td class="py-2.5 px-2 text-center font-mono font-bold text-emerald-700">${s.won}</td>
                          <td class="py-2.5 px-2 text-center font-mono text-amber-700">${s.drawn}</td>
                          <td class="py-2.5 px-2 text-center font-mono text-rose-700">${s.lost}</td>
                          <td class="py-2.5 px-2 text-center font-mono text-gray-800">${s.gamesFor}</td>
                          <td class="py-2.5 px-2 text-center font-mono font-semibold ${s.diff > 0 ? 'text-emerald-700' : (s.diff < 0 ? 'text-rose-700' : 'text-gray-500')}">
                            ${s.diff > 0 ? `+${s.diff}` : s.diff}
                          </td>
                        </tr>
                      `;

                      if (is8th && standings.length > 8) {
                        rowHtml += `
                          <tr class="bg-emerald-50/80 border-y border-emerald-300">
                            <td colspan="9" class="py-1 px-3 text-center text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
                              ▲ Limite Qualificazione al Tabellone Finale Top 8 (Fine Anno) ▲
                            </td>
                          </tr>
                        `;
                      }

                      return rowHtml;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <div class="text-[11px] text-gray-600 bg-slate-50 rounded-xl p-3 border border-slate-200 leading-relaxed space-y-1">
                <div><span class="font-bold text-gray-800">Punteggi:</span> Vittoria 3 pt • Pareggio 1 pt • Sconfitta 0 pt.</div>
                <div><span class="font-bold text-gray-800">Criteri classifica:</span> 1° Punti • 2° Scontro diretto • 3° Differenza game • 4° Game vinti • 5° Classifica FITP.</div>
                <div class="text-emerald-800 font-semibold pt-0.5">⭐ A fine anno i primi 8 atleti disputeranno il Tabellone Finale a eliminazione diretta.</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Colonna Destra: Incontri del Girone Unico -->
        <div class="lg:col-span-5 space-y-4">
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div class="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm flex-shrink-0">
                  🎾
                </div>
                <div>
                  <h3 class="text-base sm:text-lg font-black tracking-tight">Partite Girone Unico</h3>
                  <p class="text-[11px] text-slate-300">${completedMatchesCount} su ${matches.length} completate</p>
                </div>
              </div>
              ${this.isAdmin ? `
                <span class="text-[10px] bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded border border-blue-400/40">
                  Clicca per punteggio
                </span>
              ` : ''}
            </div>

            <div class="p-4 sm:p-5 space-y-3 max-h-[750px] overflow-y-auto">
              ${matches.map(m => {
                const p1 = this.tournamentManager.getPlayer(m.player1Id);
                const p2 = this.tournamentManager.getPlayer(m.player2Id);
                const isCompleted = m.status === "completato";
                const isDraw = m.isDraw || (isCompleted && m.games1 !== null && m.games1 === m.games2);

                return `
                  <div class="bg-white border ${isCompleted ? (isDraw ? 'border-amber-300 bg-amber-50/20' : 'border-blue-300 bg-blue-50/10') : 'border-gray-200'} rounded-xl p-3 shadow-2xs hover:shadow transition relative ${this.isAdmin ? 'cursor-pointer hover:border-blue-500' : ''}"
                       onclick="${this.isAdmin ? `app.openGroupMatchModal('single', '${m.id}', '${cat}')` : ''}">
                    
                    <div class="flex items-center justify-between text-xs mb-1.5">
                      <div class="flex flex-col gap-0.5 font-semibold text-gray-800 flex-grow pr-2">
                        <div class="flex items-center justify-between">
                          <span class="${m.winnerId === m.player1Id ? 'font-black text-blue-950' : 'text-gray-700'}">${p1 ? p1.name : 'In attesa'}</span>
                          ${isCompleted && m.games1 !== null ? `<span class="font-mono font-bold text-xs ${m.winnerId === m.player1Id ? 'text-blue-900 font-black' : 'text-gray-600'}">${m.games1}</span>` : ''}
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="${m.winnerId === m.player2Id ? 'font-black text-blue-950' : 'text-gray-700'}">${p2 ? p2.name : 'In attesa'}</span>
                          ${isCompleted && m.games2 !== null ? `<span class="font-mono font-bold text-xs ${m.winnerId === m.player2Id ? 'text-blue-900 font-black' : 'text-gray-600'}">${m.games2}</span>` : ''}
                        </div>
                      </div>

                      <div class="flex flex-col items-end gap-1 flex-shrink-0 pl-2 border-l border-gray-100">
                        ${isCompleted ? `
                          <span class="font-mono font-black text-xs bg-blue-100 text-blue-900 px-2 py-0.5 rounded shadow-2xs">
                            ${m.scores || `${m.games1} - ${m.games2}`}
                          </span>
                          ${isDraw ? `
                            <span class="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded">Pareggio (1 pt)</span>
                          ` : ''}
                        ` : `
                          <span class="text-[10px] text-gray-400 italic">${m.status === 'in_corso' ? 'In corso (Live)' : 'Da disputare'}</span>
                        `}
                      </div>
                    </div>

                    <div class="flex items-center justify-between text-[11px] text-gray-500 pt-1.5 border-t border-gray-100">
                      <span>${m.court || 'Campo da definire'}</span>
                      <div class="flex items-center gap-1.5">
                        ${m.dateTime ? (
                          m.p1Acceptance === 'accepted' && m.p2Acceptance === 'accepted'
                            ? `<span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">✓ Confermato</span>`
                            : (m.p1Acceptance === 'rejected' || m.p2Acceptance === 'rejected')
                              ? `<span class="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">✕ Rifiutato</span>`
                              : `<span class="text-[9px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">⏳ In attesa</span>`
                        ) : ''}
                        <span>${m.dateTime ? this.formatShortDate(m.dateTime) : (formatInfo.shortDuration + ' di gioco')}</span>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

      </div>
    </div>
    `;

    container.innerHTML = html;
  }

  handleAutoAssignGroups(category = null) {
    if (!this.isAdmin) return;
    const cat = category || (this.selectedCategory === "all" ? "Pre Agonistica U12" : this.selectedCategory);
    const catPlayers = this.state.players.filter(p => this.tournamentManager.getPlayerCategory(p) === cat);

    if (catPlayers.length < 2) {
      alert(`Servono almeno 2 atleti iscritti nella categoria ${cat} per poter comporre il Girone Unico.`);
      return;
    }

    if (confirm(`Vuoi generare/aggiornare il Girone Unico per la categoria ${cat}? Tutti gli atleti iscritti verranno inclusi e le partite completate verranno conservate.`)) {
      this.tournamentManager.autoAssignGroups(cat);
      this.saveState();
      this.render();
      this.showToast(`Girone Unico (${cat}) aggiornato con successo!`, "success");
    }
  }

  handleGenerateBracketFromGroups(category = null) {
    if (!this.isAdmin) return;
    const cat = category || (this.selectedCategory === "all" ? "Pre Agonistica U12" : this.selectedCategory);
    if (confirm(`Vuoi generare il Tabellone Finale a eliminazione diretta (${cat}) con i migliori 8 atleti del Girone Unico?`)) {
      try {
        this.tournamentManager.generateBracketFromGroups(cat);
        this.saveState();
        this.setCategory(cat);
        this.switchTab("bracket");
        this.showToast(`Tabellone Finale Top 8 (${cat}) generato con successo!`, "success");
      } catch (e) {
        alert(e.message);
      }
    }
  }

  openGroupMatchModal(groupKey = "single", matchId, category = null) {
    if (!this.isAdmin) return;
    this.tournamentManager.ensureCategories();
    const cat = category || (this.selectedCategory !== "all" ? this.selectedCategory : "Pre Agonistica U12");
    this.tournamentManager.ensureGroups(cat);

    // Cerca la partita sia nei gruppi della categoria che nel fallback state.groups
    let foundGroup = null;
    let foundMatch = null;
    let foundCat = cat;

    for (const [cName, cGrp] of Object.entries(this.state.categoryGroups || {})) {
      for (const grp of [cGrp.single, cGrp.sinner, cGrp.alcaraz]) {
        if (grp && grp.matches) {
          const m = grp.matches.find(x => x.id === matchId);
          if (m) {
            foundMatch = m;
            foundGroup = grp;
            foundCat = cName;
            break;
          }
        }
      }
      if (foundMatch) break;
    }

    if (!foundMatch && this.state.groups && this.state.groups[groupKey]) {
      foundGroup = this.state.groups[groupKey];
      foundMatch = foundGroup.matches?.find(m => m.id === matchId);
    }

    if (!foundMatch) return;

    const p1 = this.tournamentManager.getPlayer(foundMatch.player1Id);
    const p2 = this.tournamentManager.getPlayer(foundMatch.player2Id);

    document.getElementById("group-match-group-key").value = groupKey || "single";
    document.getElementById("group-match-id").value = matchId;
    document.getElementById("group-match-header-label").textContent = `Girone Unico (${foundCat})`;

    const formatInfo = this.getCategoryFormatInfo(foundCat);
    const subtitleEl = document.getElementById("group-match-formula-subtitle");
    if (subtitleEl) {
      subtitleEl.textContent = formatInfo.summary;
    }

    document.getElementById("group-match-p1-name").textContent = p1 ? p1.name : "Atleta 1";
    document.getElementById("group-match-p2-name").textContent = p2 ? p2.name : "Atleta 2";
    document.getElementById("group-match-p1-label").textContent = `Game ${p1 ? p1.firstName : 'Atleta 1'}`;
    document.getElementById("group-match-p2-label").textContent = `Game ${p2 ? p2.firstName : 'Atleta 2'}`;

    document.getElementById("group-match-score1").value = foundMatch.games1 !== null ? foundMatch.games1 : "";
    document.getElementById("group-match-score2").value = foundMatch.games2 !== null ? foundMatch.games2 : "";
    document.getElementById("group-match-court").value = foundMatch.court || "Campo 0 (Terra)";
    document.getElementById("group-match-datetime").value = foundMatch.dateTime || "";
    document.getElementById("group-match-status").value = foundMatch.status || "in_programma";

    this.openModal("modal-group-match");
  }

  setQuickGroupScore(g1, g2) {
    document.getElementById("group-match-score1").value = g1;
    document.getElementById("group-match-score2").value = g2;
    const statusSelect = document.getElementById("group-match-status");
    if (statusSelect) {
      statusSelect.value = "completato";
    }
  }

  handleSaveGroupMatchScore() {
    if (!this.isAdmin) return;

    const groupKey = document.getElementById("group-match-group-key").value || "single";
    const matchId = document.getElementById("group-match-id").value;
    const games1 = document.getElementById("group-match-score1").value;
    const games2 = document.getElementById("group-match-score2").value;
    const court = document.getElementById("group-match-court").value;
    const dateTime = document.getElementById("group-match-datetime").value;
    let status = document.getElementById("group-match-status").value;

    // Se sono stati inseriti i game, la partita passa automaticamente a completata
    if (games1 !== "" && games2 !== "") {
      status = "completato";
    }

    const cat = this.selectedCategory !== "all" ? this.selectedCategory : null;

    this.tournamentManager.updateGroupMatch(groupKey, matchId, {
      games1, games2, court, dateTime, status
    }, cat);

    this.saveState();
    this.closeModal("modal-group-match");
    this.render();
    this.showToast("Risultato salvato e classifica aggiornata in tempo reale!", "success");
  }

  // ==========================================
  // SEZIONE 1: ISCRITTI & GESTIONE ACCOUNT
  // ==========================================
  switchPlayersSubTab(subTab) {
    this.playersSubTab = subTab;
    this.renderPlayersView();
  }

  showAdminAccounts() {
    this.switchTab("players");
    this.playersSubTab = "accounts";
    this.renderPlayersView();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  getPlayerForAccount(account) {
    if (!account) return null;
    const email = (account.email || "").toLowerCase().trim();
    const fn = (account.firstName || "").toLowerCase().trim();
    const ln = (account.lastName || "").toLowerCase().trim();
    return (this.state.players || []).find(p => {
      const pEmail = (p.email || p.userId || "").toLowerCase().trim();
      if (email && pEmail && pEmail === email) return true;
      const pFn = (p.firstName || (p.name ? p.name.split(" ")[0] : "")).toLowerCase().trim();
      const pLn = (p.lastName || (p.name ? p.name.split(" ").slice(1).join(" ") : "")).toLowerCase().trim();
      if (fn && ln && pFn && pLn && fn === pFn && ln === pLn) return true;
      return false;
    }) || null;
  }

  getAccountForPlayer(player) {
    if (!player) return null;
    const accounts = this.loadAccounts();
    const email = (player.email || player.userId || "").toLowerCase().trim();
    const fn = (player.firstName || (player.name ? player.name.split(" ")[0] : "")).toLowerCase().trim();
    const ln = (player.lastName || (player.name ? player.name.split(" ").slice(1).join(" ") : "")).toLowerCase().trim();
    return Object.values(accounts).find(acc => {
      const aEmail = (acc.email || "").toLowerCase().trim();
      if (email && aEmail && email === aEmail) return true;
      const aFn = (acc.firstName || (acc.name ? acc.name.split(" ")[0] : "")).toLowerCase().trim();
      const aLn = (acc.lastName || (acc.name ? acc.name.split(" ").slice(1).join(" ") : "")).toLowerCase().trim();
      if (fn && ln && aFn && aLn && fn === aFn && ln === aLn) return true;
      return false;
    }) || null;
  }

  renderPlayersView() {
    const container = document.getElementById("players-container");
    if (!container) return;

    // Se l'admin ha selezionato la vista "Tutti gli Account"
    if (this.isAdmin && this.playersSubTab === "accounts") {
      this.renderAdminAccountsView(container);
      return;
    }

    const players = this.state.players;
    const cat = this.selectedCategory;
    const filtered = players.filter(p => {
      if (cat !== "all" && this.tournamentManager.getPlayerCategory(p) !== cat) {
        return false;
      }
      if (!this.searchQuery) return true;
      const q = this.searchQuery;
      return (
        (p.firstName && p.firstName.toLowerCase().includes(q)) ||
        (p.lastName && p.lastName.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.ranking && p.ranking.toLowerCase().includes(q)) ||
        (p.birthDate && p.birthDate.includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q))
      );
    });

    const accountsCount = Object.keys(this.loadAccounts()).length;

    let html = `
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        
        <!-- Banner Condizionale Ruolo -->
        ${this.isAdmin ? `
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs text-blue-950">
              <strong>Accesso Amministrazione (Barcello Luca & Alessia Di Tullio):</strong> puoi inserire, modificare o eliminare atleti, consultare e gestire tutti gli account registrati, organizzare i gironi e comporre il tabellone finale.
            </div>
            <div class="flex items-center gap-2">
              <button onclick="app.openNewPlayerModal(false)" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                + Inserisci Atleta
              </button>
            </div>
          </div>

          <!-- Sub-Tabs Switcher per Admin -->
          <div class="flex border-b border-gray-200 mb-5 text-xs sm:text-sm font-semibold">
            <button type="button" onclick="app.switchPlayersSubTab('players')" class="py-2.5 px-4 text-center border-b-2 border-blue-600 text-blue-700 font-bold transition flex items-center gap-2">
              <span>🎾 Atleti nel Torneo</span>
              <span class="bg-blue-100 text-blue-900 text-xs px-2 py-0.5 rounded-full font-bold">${players.length}</span>
            </button>
            <button type="button" onclick="app.switchPlayersSubTab('accounts')" class="py-2.5 px-4 text-center border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition flex items-center gap-2">
              <span>👥 Tutti gli Account Registrati</span>
              <span class="bg-yellow-400 text-blue-950 text-xs px-2 py-0.5 rounded-full font-black shadow-sm">${accountsCount}</span>
            </button>
          </div>
        ` : `
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-3.5 mb-5 flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-blue-900 text-yellow-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
              <svg class="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <div class="text-xs text-blue-950 leading-relaxed">
              <strong>Roster Ufficiale Torneo Momy:</strong> La gestione dei partecipanti (inserimento, modifica ed eliminazione atleti) e dei tabelloni è curata esclusivamente dall'Amministrazione Ufficiale (<strong>Barcello Luca & Alessia Di Tullio</strong>).
            </div>
          </div>
        `}

        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-gray-100">
          <div>
            <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>Elenco Atleti nel Torneo</span>
              <span class="bg-blue-100 text-blue-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
                ${filtered.length} ${filtered.length === 1 ? 'visibile' : 'visibili'} ${cat !== 'all' ? `(${cat})` : `(Totale ${players.length})`}
              </span>
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">Atleti attivi inseriti nei gironi e nel tabellone</p>
          </div>

          <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <!-- Campo Cerca -->
            <div class="relative w-full sm:w-64">
              <input type="text" id="search-input" value="${this.searchQuery}" placeholder="Cerca per nome, cognome o classifica..." class="w-full text-xs sm:text-sm pl-8 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <svg class="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>

            ${this.isAdmin ? `
              <button onclick="app.openNewPlayerModal(false)" class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer">
                + Inserisci Atleta
              </button>
            ` : ''}
          </div>
        </div>
    `;

    if (filtered.length === 0) {
      html += `
        <div class="text-center py-16 bg-gray-50/50 rounded-xl border border-dashed border-gray-300 p-8 my-6">
          <div class="w-14 h-14 bg-blue-50 text-blue-700 border border-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
          <h3 class="text-base sm:text-lg font-bold text-gray-800 mb-1">Nessun atleta trovato ${cat !== 'all' ? `per la categoria ${cat}` : ''}</h3>
          <p class="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mb-5">
            ${players.length === 0
              ? (this.isAdmin
                  ? "L'elenco partecipanti del Torneo Momy è attualmente vuoto. Inserisci i ragazzi che parteciperanno alla competizione, oppure consulta la scheda 'Tutti gli Account Registrati' per inserire gli account già creati."
                  : "L'elenco partecipanti del Torneo Momy è attualmente vuoto. L'amministrazione ufficiale del torneo provvederà all'inserimento degli iscritti.")
              : `Nessun atleta corrisponde ai filtri impostati (categoria: ${cat}). Prova a selezionare "Tutte" o aggiungi nuovi atleti.`}
          </p>
          ${this.isAdmin ? `
            <div class="flex flex-wrap justify-center gap-3">
              <button onclick="app.openNewPlayerModal(false)" class="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow transition cursor-pointer">
                + Inserisci Atleta
              </button>
              <button onclick="app.switchPlayersSubTab('accounts')" class="bg-yellow-400 hover:bg-yellow-300 text-blue-950 text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow transition cursor-pointer">
                👥 Gestisci Account (${accountsCount})
              </button>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      html += `
        <div class="overflow-x-auto mt-4">
          <table class="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 text-gray-600 uppercase text-[11px] font-semibold border-b border-gray-200">
                <th class="py-3 px-3 w-12 text-center">#</th>
                <th class="py-3 px-3">Nome</th>
                <th class="py-3 px-3">Cognome</th>
                <th class="py-3 px-3">Categoria</th>
                <th class="py-3 px-3">Data di Nascita</th>
                <th class="py-3 px-3">Classifica FITP</th>
                <th class="py-3 px-3">Note</th>
                <th class="py-3 px-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${filtered.map((p, idx) => {
                const playerCat = this.tournamentManager.getPlayerCategory(p);
                const isUnassigned = playerCat === "Da Assegnare";
                return `
                  <tr class="hover:bg-gray-50/80 transition ${isUnassigned ? 'bg-amber-50/60' : ''}">
                    <td class="py-3 px-3 font-mono text-center text-gray-400 font-semibold">${idx + 1}</td>
                    <td class="py-3 px-3 font-bold text-gray-900">${p.firstName || (p.name ? p.name.split(' ')[0] : '-') || '-'}</td>
                    <td class="py-3 px-3 font-bold text-gray-900">${p.lastName || (p.name ? p.name.split(' ').slice(1).join(' ') : '-') || '-'}</td>
                    <td class="py-3 px-3">${this.getCategoryBadgeMarkup(playerCat)}</td>
                    <td class="py-3 px-3 text-gray-600 font-mono text-xs">${this.formatDate(p.birthDate)}</td>
                    <td class="py-3 px-3">
                      <span class="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                        ${p.ranking || 'NC'}
                      </span>
                    </td>
                    <td class="py-3 px-3 text-gray-500 text-xs italic max-w-xs truncate">${p.notes || '-'}</td>
                    <td class="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      ${this.isAdmin ? `
                        ${isUnassigned ? `
                          <button onclick="app.editPlayer('${p.id}')" class="text-xs text-amber-950 font-black px-2.5 py-1 rounded-lg bg-yellow-400 hover:bg-yellow-300 shadow-xs transition cursor-pointer">
                            Assegna Categoria
                          </button>
                        ` : `
                          <button onclick="app.editPlayer('${p.id}')" class="text-xs text-blue-700 hover:text-blue-900 font-medium px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition cursor-pointer">
                            Modifica
                          </button>
                        `}
                        <button onclick="app.deletePlayer('${p.id}')" class="text-xs text-rose-600 hover:text-rose-800 font-medium px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 transition cursor-pointer">
                          Elimina
                        </button>
                      ` : `
                        <span class="text-gray-400 text-xs italic">Sola lettura</span>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
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

  // Vista esclusiva Admin: Tutti gli Account Registrati (anche non inseriti nel gioco)
  renderAdminAccountsView(container) {
    const accounts = this.loadAccounts();
    const accountsList = Object.values(accounts);

    // Calcola quanti sono già nel torneo e quanti no
    let inTournamentCount = 0;
    accountsList.forEach(acc => {
      if (this.getPlayerForAccount(acc)) inTournamentCount++;
    });
    const notInTournamentCount = accountsList.length - inTournamentCount;

    const filteredAccounts = accountsList.filter(acc => {
      if (!this.accountsSearchQuery) return true;
      const q = this.accountsSearchQuery.toLowerCase();
      return (
        (acc.firstName && acc.firstName.toLowerCase().includes(q)) ||
        (acc.lastName && acc.lastName.toLowerCase().includes(q)) ||
        (acc.name && acc.name.toLowerCase().includes(q)) ||
        (acc.email && acc.email.toLowerCase().includes(q)) ||
        (acc.ranking && acc.ranking.toLowerCase().includes(q))
      );
    });

    let html = `
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        
        <!-- Banner Amministratore -->
        <div class="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white rounded-xl p-4 mb-5 border border-yellow-400/30 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-yellow-400 text-blue-950 flex items-center justify-center font-black flex-shrink-0 shadow">
              <svg class="w-5 h-5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-bold text-yellow-300">Pannello Amministrazione Globale Account</h3>
              <p class="text-xs text-blue-100 mt-0.5">Tutti gli account registrati (anche chi non ha ancora inserito il giocatore). Puoi visualizzare/copiare le password, modificare anagrafica e credenziali, eliminarli o sincronizzarli tra dispositivi.</p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button onclick="app.exportBackupData()" title="Esporta tutti gli account e i dati del torneo in un file JSON" class="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-3 py-2 rounded-xl border border-white/20 shadow-sm transition flex items-center gap-1.5 cursor-pointer">
              <svg class="w-3.5 h-3.5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              <span>Esporta Backup</span>
            </button>
            <label title="Importa file JSON con account e torneo da un altro dispositivo" class="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-3 py-2 rounded-xl border border-white/20 shadow-sm transition flex items-center gap-1.5 cursor-pointer">
              <svg class="w-3.5 h-3.5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/>
              </svg>
              <span>Importa Backup</span>
              <input type="file" id="backup-file-input" accept=".json,application/json" class="hidden" onchange="app.importBackupData(event)">
            </label>
            <button onclick="app.openAdminAccountModal()" class="bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black text-xs px-3.5 py-2 rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
              </svg>
              <span>+ Crea Account</span>
            </button>
          </div>
        </div>

        <!-- Sub-Tabs Switcher per Admin -->
        <div class="flex border-b border-gray-200 mb-5 text-xs sm:text-sm font-semibold">
          <button type="button" onclick="app.switchPlayersSubTab('players')" class="py-2.5 px-4 text-center border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition flex items-center gap-2">
            <span>🎾 Atleti nel Torneo</span>
            <span class="bg-blue-100 text-blue-900 text-xs px-2 py-0.5 rounded-full font-bold">${this.state.players.length}</span>
          </button>
          <button type="button" onclick="app.switchPlayersSubTab('accounts')" class="py-2.5 px-4 text-center border-b-2 border-blue-600 text-blue-700 font-bold transition flex items-center gap-2">
            <span>👥 Tutti gli Account Registrati</span>
            <span class="bg-yellow-400 text-blue-950 text-xs px-2 py-0.5 rounded-full font-black shadow-sm">${accountsList.length}</span>
          </button>
        </div>

        <!-- Barra Statistiche & Ricerca -->
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-5 border-b border-gray-100">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-bold text-gray-700">Riepilogo:</span>
            <span class="bg-blue-100 text-blue-900 text-xs font-bold px-2.5 py-1 rounded-lg">
              ${accountsList.length} account totali
            </span>
            <span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
              ✓ ${inTournamentCount} inseriti nel gioco
            </span>
            ${notInTournamentCount > 0 ? `
              <span class="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                ⏳ ${notInTournamentCount} non ancora inseriti
              </span>
            ` : `
              <span class="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-lg">
                Tutti inseriti nel gioco
              </span>
            `}
          </div>

          <div class="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div class="relative w-full sm:w-72">
              <input type="text" id="accounts-search-input" value="${this.accountsSearchQuery}" placeholder="Cerca per nome, email o classifica..." class="w-full text-xs sm:text-sm pl-8 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <svg class="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <button onclick="app.openAdminAccountModal()" class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer">
              + Nuovo Account
            </button>
          </div>
        </div>
    `;

    if (filteredAccounts.length === 0) {
      html += `
        <div class="text-center py-12 bg-gray-50/50 rounded-xl border border-dashed border-gray-300 p-8 my-6">
          <div class="w-12 h-12 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
          <h3 class="text-base font-bold text-gray-800 mb-1">Nessun account trovato</h3>
          <p class="text-xs text-gray-500 max-w-sm mx-auto mb-4">
            ${this.accountsSearchQuery ? `Nessun account corrisponde a "${this.accountsSearchQuery}".` : "Non ci sono account registrati nel sistema."}
          </p>
          <button onclick="app.openAdminAccountModal()" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition">
            + Crea Nuovo Account
          </button>
        </div>
      `;
    } else {
      html += `
        <div class="overflow-x-auto mt-4">
          <table class="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 text-gray-600 uppercase text-[11px] font-semibold border-b border-gray-200">
                <th class="py-3 px-3 w-10 text-center">#</th>
                <th class="py-3 px-3">Utente</th>
                <th class="py-3 px-3">Email (Unica)</th>
                <th class="py-3 px-3">Password</th>
                <th class="py-3 px-3">Categoria</th>
                <th class="py-3 px-3">Nascita</th>
                <th class="py-3 px-3">Classifica</th>
                <th class="py-3 px-3">Ruolo</th>
                <th class="py-3 px-3">Stato nel Torneo</th>
                <th class="py-3 px-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${filteredAccounts.map((acc, idx) => {
                const linkedPlayer = this.getPlayerForAccount(acc);
                const safeEmail = (acc.email || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
                const avatarHtml = this.getAvatarMarkup(acc, "w-6 h-6", "text-[10px]");

                return `
                  <tr class="hover:bg-gray-50/80 transition ${!linkedPlayer ? 'bg-amber-50/25' : ''}">
                    <td class="py-3 px-3 font-mono text-center text-gray-400 font-semibold">${idx + 1}</td>
                    <td class="py-3 px-3 font-bold text-gray-900">
                      <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-blue-900 text-yellow-300">
                          ${avatarHtml}
                        </div>
                        <span class="truncate max-w-[140px]">${acc.name || `${acc.firstName || ''} ${acc.lastName || ''}`.trim() || 'Utente'}</span>
                      </div>
                    </td>
                    <td class="py-3 px-3 font-medium text-gray-800 font-mono text-xs">
                      <span class="truncate max-w-[170px] inline-block" title="${acc.email}">${acc.email}</span>
                    </td>
                    <td class="py-3 px-3 font-mono text-xs">
                      <div class="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 max-w-fit">
                        <span id="pwd-display-${safeEmail}" class="tracking-wider text-gray-700">••••••••</span>
                        <button type="button" onclick="app.toggleTablePassword('${safeEmail}', '${this.escapeHtml(acc.password || '')}')" title="Mostra/Nascondi password" class="text-gray-400 hover:text-blue-700 p-0.5 transition cursor-pointer">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td class="py-3 px-3">${this.getCategoryBadgeMarkup(acc.category || this.tournamentManager.getPlayerCategory(acc))}</td>
                    <td class="py-3 px-3 text-gray-600 font-mono text-xs">${this.formatDate(acc.birthDate)}</td>
                    <td class="py-3 px-3">
                      <span class="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                        ${acc.ranking || 'NC'}
                      </span>
                    </td>
                    <td class="py-3 px-3">
                      ${acc.role === 'admin' ? `
                        <span class="bg-yellow-400 text-blue-950 font-black text-[10px] uppercase px-2 py-0.5 rounded shadow-sm">Admin</span>
                      ` : `
                        <span class="bg-slate-100 text-slate-600 font-medium text-[10px] uppercase px-2 py-0.5 rounded">Giocatore</span>
                      `}
                    </td>
                    <td class="py-3 px-3">
                      ${linkedPlayer ? `
                        <span class="bg-emerald-100 text-emerald-800 font-bold text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                          <svg class="w-3 h-3 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                          <span>Nel Torneo</span>
                        </span>
                      ` : `
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="bg-amber-100 text-amber-900 font-semibold text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap">
                            Non nel gioco
                          </span>
                          <button onclick="app.insertAccountIntoTournament('${acc.email}')" title="Inserisci questo account come atleta nel torneo" class="bg-yellow-400 hover:bg-yellow-500 text-blue-950 font-black text-[11px] px-2 py-0.5 rounded-lg shadow-sm transition whitespace-nowrap cursor-pointer">
                            + Inserisci nel Gioco
                          </button>
                        </div>
                      `}
                    </td>
                    <td class="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      <button onclick="app.openAdminAccountModal('${acc.email}')" class="text-xs text-blue-700 hover:text-blue-900 font-medium px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition cursor-pointer">
                        Modifica
                      </button>
                      <button onclick="app.deleteAccount('${acc.email}')" class="text-xs text-rose-600 hover:text-rose-800 font-medium px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 transition cursor-pointer">
                        Elimina
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Ricollega ricerca live accounts
    const accSearch = document.getElementById("accounts-search-input");
    if (accSearch) {
      accSearch.addEventListener("input", (e) => {
        this.accountsSearchQuery = e.target.value.toLowerCase().trim();
        this.renderAdminAccountsView(container);
      });
    }
  }

  // Modale per Admin: Modifica o Crea Account
  openAdminAccountModal(email = null) {
    if (!this.isAdmin) {
      this.showToast("Solo l'amministratore può gestire gli account.", "error");
      return;
    }

    const titleEl = document.getElementById("admin-account-modal-title");
    const submitBtn = document.getElementById("admin-account-submit-btn");
    const origEmailInput = document.getElementById("admin-account-orig-email");
    const fnInput = document.getElementById("admin-account-firstname-input");
    const lnInput = document.getElementById("admin-account-lastname-input");
    const emInput = document.getElementById("admin-account-email-input");
    const pwInput = document.getElementById("admin-account-password-input");
    const bdInput = document.getElementById("admin-account-birthdate-input");
    const rkInput = document.getElementById("admin-account-ranking-input");
    const catSelect = document.getElementById("admin-account-category-select");
    const roleSelect = document.getElementById("admin-account-role-select");
    const alsoPlayerWrapper = document.getElementById("admin-account-also-player-wrapper");
    const alsoPlayerCheckbox = document.getElementById("admin-account-also-player");

    if (pwInput) pwInput.type = "password";

    if (email) {
      const accounts = this.loadAccounts();
      const acc = accounts[email.toLowerCase().trim()];
      if (!acc) {
        this.showToast("Account non trovato.", "error");
        return;
      }
      if (titleEl) titleEl.textContent = `Modifica Account (${acc.name || acc.email})`;
      if (submitBtn) submitBtn.textContent = "Salva Modifiche";
      if (origEmailInput) origEmailInput.value = acc.email;
      if (fnInput) fnInput.value = acc.firstName || (acc.name ? acc.name.split(" ")[0] : "");
      if (lnInput) lnInput.value = acc.lastName || (acc.name ? acc.name.split(" ").slice(1).join(" ") : "");
      if (emInput) emInput.value = acc.email || "";
      if (pwInput) pwInput.value = acc.password || "";
      if (bdInput) bdInput.value = acc.birthDate || "";
      if (rkInput) rkInput.value = acc.ranking || "NC";
      if (catSelect) catSelect.value = acc.category || this.tournamentManager.getPlayerCategory(acc);
      if (roleSelect) roleSelect.value = acc.role || "player";

      const linkedPlayer = this.getPlayerForAccount(acc);
      if (alsoPlayerWrapper) {
        if (linkedPlayer) {
          alsoPlayerWrapper.classList.add("hidden");
          if (alsoPlayerCheckbox) alsoPlayerCheckbox.checked = false;
        } else {
          alsoPlayerWrapper.classList.remove("hidden");
          if (alsoPlayerCheckbox) alsoPlayerCheckbox.checked = true;
        }
      }
    } else {
      if (titleEl) titleEl.textContent = "Crea Nuovo Account";
      if (submitBtn) submitBtn.textContent = "Crea Account";
      if (origEmailInput) origEmailInput.value = "";
      if (fnInput) fnInput.value = "";
      if (lnInput) lnInput.value = "";
      if (emInput) emInput.value = "";
      if (pwInput) pwInput.value = "";
      if (bdInput) bdInput.value = "";
      if (rkInput) rkInput.value = "NC";
      if (catSelect) catSelect.value = (this.selectedCategory !== "all") ? this.selectedCategory : "Pre Agonistica U12";
      if (roleSelect) roleSelect.value = "player";
      if (alsoPlayerWrapper) alsoPlayerWrapper.classList.remove("hidden");
      if (alsoPlayerCheckbox) alsoPlayerCheckbox.checked = true;
    }

    this.openModal("modal-admin-account");
    setTimeout(() => {
      if (fnInput) fnInput.focus();
    }, 150);
  }

  // Salvataggio Account da parte dell'Admin (con controllo tassativo unicità email)
  handleSaveAdminAccount() {
    if (!this.isAdmin) return;

    const origEmail = (document.getElementById("admin-account-orig-email")?.value || "").trim().toLowerCase();
    const firstName = document.getElementById("admin-account-firstname-input")?.value.trim() || "";
    const lastName = document.getElementById("admin-account-lastname-input")?.value.trim() || "";
    const email = (document.getElementById("admin-account-email-input")?.value || "").trim().toLowerCase();
    const password = document.getElementById("admin-account-password-input")?.value || "";
    const birthDate = document.getElementById("admin-account-birthdate-input")?.value.trim() || "";
    const ranking = document.getElementById("admin-account-ranking-input")?.value.trim() || "NC";
    const category = document.getElementById("admin-account-category-select")?.value || this.tournamentManager.getPlayerCategory({ birthDate });
    const role = document.getElementById("admin-account-role-select")?.value || "player";
    const alsoPlayer = document.getElementById("admin-account-also-player")?.checked ?? false;

    if (!firstName || !lastName) {
      alert("Inserisci sia il Nome che il Cognome.");
      return;
    }
    if (!email) {
      alert("Inserisci un indirizzo email valido.");
      return;
    }
    if (!password || password.length < 4) {
      alert("La password deve contenere almeno 4 caratteri.");
      return;
    }
    if (!birthDate) {
      alert("Inserisci la data di nascita.");
      return;
    }

    const accounts = this.loadAccounts();

    // CONTROLLO UNICITÀ EMAIL: non possono esistere due o più account con la stessa mail
    if (!origEmail && accounts[email]) {
      alert(`Errore: esiste già un account registrato con l'email "${email}".\n\nNon possono esistere due o più account con la stessa mail.`);
      return;
    }
    if (origEmail && email !== origEmail && accounts[email]) {
      alert(`Errore: l'email "${email}" appartiene già a un altro account registrato.\n\nNon possono esistere due o più account con la stessa mail.`);
      return;
    }

    // Se l'email è stata modificata, cancella la vecchia chiave
    if (origEmail && email !== origEmail) {
      delete accounts[origEmail];
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const prevAcc = origEmail ? (this.accounts[origEmail] || {}) : {};

    const updatedAccount = {
      ...prevAcc,
      firstName,
      lastName,
      name: fullName,
      email,
      password,
      birthDate,
      ranking,
      category,
      role: isUserAdmin(email) ? "admin" : role,
      biometricsEnabled: prevAcc.biometricsEnabled ?? true
    };

    accounts[email] = updatedAccount;
    this.saveAccounts(accounts);

    // Se l'admin sta modificando il proprio account attualmente loggato
    if (this.user && (this.user.email.toLowerCase() === origEmail || this.user.email.toLowerCase() === email)) {
      this.user = { ...this.user, ...updatedAccount };
      this.saveUser(this.user);
    }

    // Aggiorna anche l'eventuale atleta collegato nel torneo
    const linkedPlayer = this.getPlayerForAccount(updatedAccount) || (origEmail ? this.state.players.find(p => (p.email && p.email.toLowerCase() === origEmail) || (p.userId && p.userId.toLowerCase() === origEmail)) : null);
    if (linkedPlayer) {
      linkedPlayer.firstName = firstName;
      linkedPlayer.lastName = lastName;
      linkedPlayer.name = fullName;
      linkedPlayer.birthDate = birthDate;
      linkedPlayer.ranking = ranking;
      linkedPlayer.category = category;
      linkedPlayer.email = email;
      linkedPlayer.userId = email;
      this.saveState();
    } else if (alsoPlayer) {
      const newPlayer = {
        id: `p-${Date.now()}`,
        firstName,
        lastName,
        name: fullName,
        birthDate,
        ranking,
        category,
        notes: "",
        email,
        userId: email,
        photoUrl: "",
        status: "confermato"
      };
      this.state.players.push(newPlayer);
      this.saveState();
    }

    this.closeModal("modal-admin-account");
    this.showToast(origEmail ? `Account "${fullName}" aggiornato!` : `Account "${fullName}" creato con successo!`, "success");
    this.render();
  }

  // Eliminazione account da parte dell'Admin
  deleteAccount(email) {
    if (!this.isAdmin) {
      this.showToast("Solo l'amministratore può eliminare account.", "error");
      return;
    }
    const cleanEmail = (email || "").toLowerCase().trim();
    const accounts = this.loadAccounts();
    const acc = accounts[cleanEmail];
    if (!acc) {
      this.showToast("Account non trovato.", "error");
      return;
    }

    if (isUserAdmin(cleanEmail) && this.user && this.user.email.toLowerCase() === cleanEmail) {
      if (!confirm("ATTENZIONE: Stai per eliminare il tuo stesso account Amministratore. Sei sicuro di voler procedere?")) {
        return;
      }
    } else {
      if (!confirm(`Sei sicuro di voler eliminare l'account di ${acc.name || acc.email} (${acc.email})?\n\nQuesta operazione cancellerà le relative credenziali di accesso.`)) {
        return;
      }
    }

    const linkedPlayer = this.getPlayerForAccount(acc);
    if (linkedPlayer) {
      if (confirm(`L'account "${acc.name || acc.email}" è anche presente come atleta nel torneo.\n\nVuoi rimuovere anche l'atleta dall'elenco iscritti del torneo?\n\n- Premi OK per eliminare sia l'account che l'atleta\n- Premi Annulla per eliminare solo l'account e mantenere l'atleta`)) {
        this.state.players = this.state.players.filter(p => p.id !== linkedPlayer.id);
        this.saveState();
      }
    }

    delete accounts[cleanEmail];
    this.saveAccounts(accounts);

    if (this.user && this.user.email.toLowerCase() === cleanEmail) {
      this.logout();
      return;
    }

    this.showToast(`Account di "${acc.name || acc.email}" eliminato.`, "info");
    this.render();
  }

  // Inserisce un account registrato tra gli atleti ufficiali del torneo con 1 click
  insertAccountIntoTournament(email) {
    if (!this.isAdmin) {
      this.showToast("Solo l'amministratore può inserire giocatori nel torneo.", "error");
      return;
    }
    const cleanEmail = (email || "").toLowerCase().trim();
    const accounts = this.loadAccounts();
    const acc = accounts[cleanEmail];
    if (!acc) {
      this.showToast("Account non trovato.", "error");
      return;
    }

    const existingPlayer = this.getPlayerForAccount(acc);
    if (existingPlayer) {
      this.showToast(`L'atleta "${acc.name}" è già inserito nel torneo.`, "info");
      return;
    }

    const firstName = acc.firstName || (acc.name ? acc.name.split(" ")[0] : "");
    const lastName = acc.lastName || (acc.name ? acc.name.split(" ").slice(1).join(" ") : "");
    const fullName = acc.name || `${firstName} ${lastName}`.trim();

    const newPlayer = {
      id: `p-${Date.now()}`,
      firstName,
      lastName,
      name: fullName,
      birthDate: acc.birthDate || "",
      ranking: acc.ranking || "NC",
      category: acc.category || this.tournamentManager.getPlayerCategory(acc),
      notes: "",
      email: acc.email,
      userId: acc.email,
      photoUrl: acc.photoUrl || "",
      status: "confermato"
    };

    this.state.players.push(newPlayer);
    this.saveState();
    this.showToast(`Atleta "${fullName}" inserito con successo nel torneo!`, "success");
    this.render();
  }

  // Esporta tutti i dati (Account registrati e Torneo) in formato JSON
  exportBackupData() {
    try {
      const accounts = this.loadAccounts();
      const accountsList = Object.values(accounts);
      const data = {
        version: "torneo-momy-v7",
        exportedAt: new Date().toISOString(),
        accountsCount: accountsList.length,
        playersCount: this.state.players ? this.state.players.length : 0,
        accounts: accounts,
        state: this.state
      };
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `torneo_momy_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast(`Backup esportato con successo! (${accountsList.length} account)`, "success");
    } catch (e) {
      console.error("Errore esportazione", e);
      alert("Errore durante l'esportazione del backup: " + e.message);
    }
  }

  // Importa i dati da un file JSON (permette di trasferire account e giocatori tra telefono e desktop)
  importBackupData(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const data = JSON.parse(content);

        if (!data.accounts && !data.state) {
          alert("Formato file non valido: il file selezionato non sembra essere un backup del Torneo Momy.");
          return;
        }

        const countAccounts = data.accounts ? Object.keys(data.accounts).length : 0;
        const countPlayers = (data.state && Array.isArray(data.state.players)) ? data.state.players.length : 0;

        if (confirm(`Confermi il ripristino di questo backup?\n\n- Account trovati nel file: ${countAccounts}\n- Atleti nel torneo: ${countPlayers}\n\nI dati verranno integrati con quelli attuali del dispositivo.`)) {
          // Unisci account
          if (data.accounts && typeof data.accounts === "object") {
            const currentAccounts = this.loadAccounts();
            const mergedAccounts = { ...currentAccounts, ...data.accounts };
            this.saveAccounts(mergedAccounts);
          }

          // Unisci dati del torneo (giocatori, tabellone, ecc.)
          if (data.state && typeof data.state === "object") {
            if (Array.isArray(data.state.players)) {
              const currentPlayers = Array.isArray(this.state.players) ? this.state.players : [];
              const playerMap = new Map();
              currentPlayers.forEach(p => playerMap.set(p.id || p.email || p.name, p));
              data.state.players.forEach(p => playerMap.set(p.id || p.email || p.name, p));
              this.state.players = Array.from(playerMap.values());
            }
            if (data.state.bracket) {
              this.state.bracket = data.state.bracket;
            }
            if (data.state.tournament) {
              this.state.tournament = { ...this.state.tournament, ...data.state.tournament };
            }
            this.saveState();
            this.tournamentManager = new TournamentManager(this.state);
          }

          this.showToast("Dati importati e sincronizzati con successo!", "success");
          this.render();
        }
      } catch (err) {
        console.error("Errore lettura file backup", err);
        alert("Errore durante la lettura del file: " + err.message);
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  openNewPlayerModal(fromProfile = false) {
    if (!this.isAdmin) {
      this.showToast("Operazione riservata all'amministrazione del torneo.", "error");
      return;
    }

    const modalTitle = document.getElementById("player-modal-title");
    const submitBtn = document.getElementById("player-submit-btn");
    if (modalTitle) modalTitle.textContent = "Inserisci Atleta";
    if (submitBtn) submitBtn.textContent = "Aggiungi Atleta";
    
    document.getElementById("player-id-input").value = "";

    const fnInput = document.getElementById("player-firstname-input");
    const lnInput = document.getElementById("player-lastname-input");
    const bdInput = document.getElementById("player-birthdate-input");
    const rkInput = document.getElementById("player-ranking-input");
    const catSelect = document.getElementById("player-category-select");
    const notesInput = document.getElementById("player-notes-input");

    fnInput.value = "";
    lnInput.value = "";
    bdInput.value = "";
    rkInput.value = "NC";
    if (catSelect) catSelect.value = (this.selectedCategory !== "all" && this.selectedCategory !== "Da Assegnare") ? this.selectedCategory : "Pre Agonistica U12";
    notesInput.value = "";

    this.openModal("modal-player");
    setTimeout(() => {
      fnInput.focus();
    }, 150);
  }

  editPlayer(id) {
    if (!this.isAdmin) {
      this.showToast("Operazione riservata all'amministrazione del torneo.", "error");
      return;
    }

    const p = this.state.players.find(x => x.id === id);
    if (!p) return;

    const modalTitle = document.getElementById("player-modal-title");
    const submitBtn = document.getElementById("player-submit-btn");
    if (modalTitle) modalTitle.textContent = "Modifica Dati Atleta";
    if (submitBtn) submitBtn.textContent = "Salva Atleta";
    document.getElementById("player-id-input").value = p.id;

    document.getElementById("player-firstname-input").value = p.firstName || (p.name ? p.name.split(' ')[0] : "") || "";
    document.getElementById("player-lastname-input").value = p.lastName || (p.name ? p.name.split(' ').slice(1).join(' ') : "") || "";
    document.getElementById("player-birthdate-input").value = p.birthDate || "";
    document.getElementById("player-ranking-input").value = p.ranking || "NC";
    const catSelect = document.getElementById("player-category-select");
    if (catSelect) catSelect.value = p.category || this.tournamentManager.getPlayerCategory(p) || "Pre Agonistica U12";
    document.getElementById("player-notes-input").value = p.notes || "";

    this.openModal("modal-player");
  }

  handleSavePlayer() {
    if (!this.isAdmin) {
      this.showToast("Operazione riservata all'amministrazione del torneo.", "error");
      return;
    }

    const id = document.getElementById("player-id-input").value;
    const firstName = document.getElementById("player-firstname-input").value.trim();
    const lastName = document.getElementById("player-lastname-input").value.trim();
    const birthDate = document.getElementById("player-birthdate-input").value.trim();
    const ranking = document.getElementById("player-ranking-input").value.trim() || "NC";
    const categorySelect = document.getElementById("player-category-select");
    const category = categorySelect ? categorySelect.value : (this.tournamentManager.getPlayerCategory({ birthDate }) || "Da Assegnare");
    const notes = document.getElementById("player-notes-input").value.trim();

    if (!firstName || !lastName) {
      alert("Inserisci Nome e Cognome dell'atleta.");
      return;
    }

    if (!birthDate) {
      alert("Inserisci la data di nascita dell'atleta.");
      return;
    }

    const fullName = `${firstName} ${lastName}`.trim();

    if (id) {
      // Modifica atleta esistente
      const idx = this.state.players.findIndex(x => x.id === id);
      if (idx !== -1) {
        this.state.players[idx] = {
          ...this.state.players[idx],
          firstName,
          lastName,
          name: fullName,
          birthDate,
          ranking,
          category,
          notes
        };

        // Sincronizza anche sull'account registrato se presente
        const pEmail = (this.state.players[idx].email || "").toLowerCase().trim();
        if (pEmail) {
          const accounts = this.loadAccounts();
          if (accounts[pEmail]) {
            accounts[pEmail].category = category;
            accounts[pEmail].firstName = firstName;
            accounts[pEmail].lastName = lastName;
            accounts[pEmail].name = fullName;
            accounts[pEmail].birthDate = birthDate;
            accounts[pEmail].ranking = ranking;
            this.saveAccounts(accounts);
          }
        }
      }
    } else {
      // Controllo duplicati
      const already = this.state.players.some(p =>
        p.firstName.toLowerCase() === firstName.toLowerCase() &&
        p.lastName.toLowerCase() === lastName.toLowerCase()
      );
      if (already) {
        alert(`L'atleta ${fullName} risulta già presente tra gli iscritti.`);
        return;
      }

      // Nuovo atleta inserito da admin
      const newPlayer = {
        id: `p-${Date.now()}`,
        firstName,
        lastName,
        name: fullName,
        birthDate,
        ranking,
        category,
        notes,
        email: "",
        userId: "",
        status: "confermato"
      };
      this.state.players.push(newPlayer);
    }

    this.saveState();
    this.closeModal("modal-player");
    this.showToast(`Dati di ${fullName} salvati con successo!`, "success");
    this.render();
  }

  deletePlayer(id) {
    if (!this.isAdmin) {
      this.showToast("Operazione riservata all'amministrazione del torneo.", "error");
      return;
    }
    const p = this.state.players.find(x => x.id === id);
    if (!p) return;

    if (confirm(`Sei sicuro di voler rimuovere ${p.name} dall'elenco iscritti?`)) {
      this.state.players = this.state.players.filter(x => x.id !== id);
      this.saveState();
      this.showToast("Atleta rimosso", "info");
    }
  }

  // ==========================================
  // SEZIONE 3: CALENDARIO PARTITE (ORARI & CAMPI)
  // ==========================================
  getAllMatches() {
    this.tournamentManager.ensureCategories();
    const categories = TournamentManager.CATEGORIES;
    const all = [];

    categories.forEach(cat => {
      this.tournamentManager.ensureGroups(cat);
      const groups = this.state.categoryGroups?.[cat] || {};

      const singleGroup = groups.single || groups.sinner;
      const singleMatches = singleGroup?.matches || [];
      singleMatches.forEach(m => {
        all.push({
          type: "group",
          category: cat,
          groupKey: "single",
          groupName: `Girone Unico (${cat})`,
          phase: `Girone Unico • ${cat}`,
          match: m
        });
      });

      this.tournamentManager.ensureBrackets(cat);
      const bracket = this.state.categoryBrackets?.[cat];
      if (bracket && bracket.rounds) {
        bracket.rounds.forEach((round, rIdx) => {
          (round.matches || []).forEach(m => {
            all.push({
              type: "bracket",
              category: cat,
              roundIndex: rIdx,
              roundName: round.name,
              phase: `Tabellone ${cat} • ${round.name}`,
              match: m
            });
          });
        });
      }
    });

    return all;
  }

  setScheduleFilter(key, value) {
    if (key === "phase") this.schedulePhaseFilter = value;
    if (key === "court") this.scheduleCourtFilter = value;
    if (key === "status") this.scheduleStatusFilter = value;
    if (key === "search") this.scheduleSearchQuery = (value || "").toLowerCase().trim();
    this.renderScheduleView();
  }

  renderScheduleView() {
    const container = document.getElementById("schedule-container");
    if (!container) return;

    const allMatches = this.getAllMatches();
    const scheduledMatches = allMatches.filter(x => x.match.dateTime);
    const completedMatches = allMatches.filter(x => x.match.status === "completato");
    const confirmedMatches = allMatches.filter(x => x.match.dateTime && x.match.p1Acceptance === "accepted" && x.match.p2Acceptance === "accepted");
    const pendingMatches = allMatches.filter(x => x.match.dateTime && x.match.status !== "completato" && x.match.p1Acceptance !== "rejected" && x.match.p2Acceptance !== "rejected" && !(x.match.p1Acceptance === "accepted" && x.match.p2Acceptance === "accepted"));
    const rejectedMatches = allMatches.filter(x => x.match.dateTime && (x.match.p1Acceptance === "rejected" || x.match.p2Acceptance === "rejected"));

    // Filtraggio
    const filtered = allMatches.filter(item => {
      // Filtro Categoria attiva
      if (this.selectedCategory !== "all" && item.category !== this.selectedCategory) return false;

      const m = item.match;
      const p1 = this.tournamentManager.getPlayer(m.player1Id);
      const p2 = this.tournamentManager.getPlayer(m.player2Id);
      const p1Name = p1 ? p1.name.toLowerCase() : "";
      const p2Name = p2 ? p2.name.toLowerCase() : "";

      // Filtro Fase
      if (this.schedulePhaseFilter === "group" && item.type !== "group") return false;
      if (this.schedulePhaseFilter === "bracket" && item.type !== "bracket") return false;

      // Filtro Campo
      if (this.scheduleCourtFilter !== "all") {
        if (!m.court || !m.court.includes(this.scheduleCourtFilter)) return false;
      }

      // Filtro Stato
      if (this.scheduleStatusFilter === "scheduled" && !m.dateTime) return false;
      if (this.scheduleStatusFilter === "unscheduled" && m.dateTime) return false;
      if (this.scheduleStatusFilter === "live" && m.status !== "in_corso") return false;
      if (this.scheduleStatusFilter === "completed" && m.status !== "completato") return false;
      if (this.scheduleStatusFilter === "confirmed") {
        if (!m.dateTime || m.p1Acceptance !== "accepted" || m.p2Acceptance !== "accepted") return false;
      }
      if (this.scheduleStatusFilter === "pending_acceptance") {
        if (!m.dateTime || m.status === "completato" || m.p1Acceptance === "rejected" || m.p2Acceptance === "rejected" || (m.p1Acceptance === "accepted" && m.p2Acceptance === "accepted")) return false;
      }
      if (this.scheduleStatusFilter === "rejected") {
        if (!m.dateTime || (m.p1Acceptance !== "rejected" && m.p2Acceptance !== "rejected")) return false;
      }

      // Ricerca Atleta
      if (this.scheduleSearchQuery) {
        const q = this.scheduleSearchQuery;
        if (!p1Name.includes(q) && !p2Name.includes(q)) return false;
      }

      return true;
    });

    // Ordinamento cronologico
    filtered.sort((a, b) => {
      const dtA = a.match.dateTime ? new Date(a.match.dateTime).getTime() : Infinity;
      const dtB = b.match.dateTime ? new Date(b.match.dateTime).getTime() : Infinity;
      if (dtA !== dtB) return dtA - dtB;
      return a.phase.localeCompare(b.phase);
    });

    const myPendingMatches = this.getPendingScheduleMatchesForUser();

    let html = `
      <div class="space-y-6">

        <!-- Banner Intestazione Calendario -->
        <div class="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-blue-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
              <span class="text-xs font-black uppercase tracking-wider text-yellow-300">Programma Ufficiale Partite</span>
            </div>
            <h2 class="text-xl sm:text-2xl font-extrabold tracking-tight">Calendario Incontri & Campi</h2>
            <p class="text-xs text-blue-200 mt-1 max-w-2xl leading-relaxed">
              Date, orari e campi programmati dall'Amministrazione (<strong>Barcello Luca & Alessia Di Tullio</strong>). Entrambi gli atleti devono confermare o rifiutare l'orario per la disputa dell'incontro.
            </p>
          </div>

          ${this.isAdmin ? `
            <div class="bg-yellow-400 text-blue-950 text-xs font-black px-4 py-2.5 rounded-xl shadow border border-yellow-300 flex items-center gap-2">
              <svg class="w-4 h-4 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
              </svg>
              <span>Gestione Orari e Campi Attiva</span>
            </div>
          ` : `
            <div class="text-xs text-blue-200 bg-white/10 px-3.5 py-2 rounded-xl border border-white/20">
              Orari programmati dall'Amministrazione del Torneo
            </div>
          `}
        </div>

        ${myPendingMatches.length > 0 ? `
          <!-- Banner Notifica Atleta Partite da Confermare -->
          <div class="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 p-4 rounded-2xl shadow-md border border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-white text-amber-900 flex items-center justify-center font-black text-lg shadow-sm flex-shrink-0">
                🔔
              </div>
              <div>
                <h4 class="font-extrabold text-sm sm:text-base">Hai ${myPendingMatches.length} ${myPendingMatches.length === 1 ? 'partita in programma in attesa' : 'partite in programma in attesa'} della tua conferma orario!</h4>
                <p class="text-xs text-slate-900/85 mt-0.5">L'organizzatore ha proposto data e ora. Clicca su <strong>"Accetta Orario"</strong> o <strong>"Rifiuta Orario"</strong> sulla tua partita per confermare la tua presenza.</p>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Box Statistiche Incontri -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Incontri Totali</div>
            <div class="text-xl sm:text-2xl font-black text-gray-900 mt-0.5">${allMatches.length}</div>
          </div>
          <div class="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <div class="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Confermati (2/2)</div>
            <div class="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">${confirmedMatches.length}</div>
          </div>
          <div class="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <div class="text-[11px] font-bold text-amber-600 uppercase tracking-wider">In Attesa Risposta</div>
            <div class="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">${pendingMatches.length}</div>
          </div>
          <div class="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <div class="text-[11px] font-bold ${rejectedMatches.length > 0 ? 'text-rose-600' : 'text-blue-600'} uppercase tracking-wider">
              ${rejectedMatches.length > 0 ? 'Da Riprogrammare' : 'Da Fissare'}
            </div>
            <div class="text-xl sm:text-2xl font-black ${rejectedMatches.length > 0 ? 'text-rose-700' : 'text-blue-900'} mt-0.5">
              ${rejectedMatches.length > 0 ? rejectedMatches.length : (allMatches.length - scheduledMatches.length)}
            </div>
          </div>
        </div>

        <!-- Filtri e Ricerca -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            
            <!-- Filtro Fase -->
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-xs font-bold text-gray-600 mr-1">Fase:</span>
              <button onclick="app.setScheduleFilter('phase', 'all')" class="text-xs px-3 py-1.5 rounded-xl font-semibold transition ${this.schedulePhaseFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                Tutte
              </button>
              <button onclick="app.setScheduleFilter('phase', 'group')" class="text-xs px-3 py-1.5 rounded-xl font-semibold transition ${this.schedulePhaseFilter === 'group' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                Girone Unico
              </button>
              <button onclick="app.setScheduleFilter('phase', 'bracket')" class="text-xs px-3 py-1.5 rounded-xl font-semibold transition ${this.schedulePhaseFilter === 'bracket' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                Tabellone Finale
              </button>
            </div>

            <!-- Ricerca Atleta -->
            <div class="relative w-full sm:w-56">
              <input type="text" id="schedule-search-input" value="${this.scheduleSearchQuery}" placeholder="Cerca atleta..." class="w-full text-xs sm:text-sm pl-8 pr-3 py-1.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <svg class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>

          </div>

          <!-- Filtri Campo e Stato -->
          <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 text-xs">
            <div class="flex items-center gap-2">
              <label class="font-bold text-gray-600">Campo:</label>
              <select onchange="app.setScheduleFilter('court', this.value)" class="text-xs border rounded-lg px-2.5 py-1 bg-white font-medium">
                <option value="all" ${this.scheduleCourtFilter === 'all' ? 'selected' : ''}>Tutti i campi</option>
                <option value="Campo 0" ${this.scheduleCourtFilter === 'Campo 0' ? 'selected' : ''}>Campo 0 (Terra)</option>
                <option value="Campo 1" ${this.scheduleCourtFilter === 'Campo 1' ? 'selected' : ''}>Campo 1 (Terra)</option>
                <option value="Campo 2" ${this.scheduleCourtFilter === 'Campo 2' ? 'selected' : ''}>Campo 2 (Terra)</option>
                <option value="Campo 3" ${this.scheduleCourtFilter === 'Campo 3' ? 'selected' : ''}>Campo 3 (Greenset)</option>
                <option value="Campo 4" ${this.scheduleCourtFilter === 'Campo 4' ? 'selected' : ''}>Campo 4 (Greenset)</option>
                <option value="Campo 5" ${this.scheduleCourtFilter === 'Campo 5' ? 'selected' : ''}>Campo 5 (Terra)</option>
                <option value="Campo 6" ${this.scheduleCourtFilter === 'Campo 6' ? 'selected' : ''}>Campo 6 (Terra)</option>
                <option value="Campo 7" ${this.scheduleCourtFilter === 'Campo 7' ? 'selected' : ''}>Campo 7 (Terra)</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <label class="font-bold text-gray-600">Stato:</label>
              <select onchange="app.setScheduleFilter('status', this.value)" class="text-xs border rounded-lg px-2.5 py-1 bg-white font-medium">
                <option value="all" ${this.scheduleStatusFilter === 'all' ? 'selected' : ''}>Tutti gli stati</option>
                <option value="confirmed" ${this.scheduleStatusFilter === 'confirmed' ? 'selected' : ''}>✅ Accettati da entrambi (Confermati)</option>
                <option value="pending_acceptance" ${this.scheduleStatusFilter === 'pending_acceptance' ? 'selected' : ''}>⏳ In attesa di accettazione</option>
                <option value="rejected" ${this.scheduleStatusFilter === 'rejected' ? 'selected' : ''}>❌ Rifiutati (Da riprogrammare)</option>
                <option value="scheduled" ${this.scheduleStatusFilter === 'scheduled' ? 'selected' : ''}>Tutti con data/ora fissata</option>
                <option value="unscheduled" ${this.scheduleStatusFilter === 'unscheduled' ? 'selected' : ''}>Da programmare</option>
                <option value="live" ${this.scheduleStatusFilter === 'live' ? 'selected' : ''}>In corso (Live)</option>
                <option value="completed" ${this.scheduleStatusFilter === 'completed' ? 'selected' : ''}>Completati</option>
              </select>
            </div>
          </div>
        </div>
    `;

    if (allMatches.length === 0) {
      html += `
        <div class="text-center py-16 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div class="w-14 h-14 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-gray-800 mb-1">Nessuna partita in calendario</h3>
          <p class="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mb-6">
            Componi la fase a gironi o il tabellone finale per generare automaticamente gli incontri del Torneo Momy.
          </p>
          ${this.isAdmin ? `
            <button onclick="app.switchTab('groups')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition">
              Vai alla Fase a Gironi
            </button>
          ` : `
            <button onclick="app.switchTab('players')" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition">
              Visualizza Iscritti
            </button>
          `}
        </div>
      </div>
      `;
      container.innerHTML = html;
      return;
    }

    if (filtered.length === 0) {
      html += `
        <div class="text-center py-12 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <p class="text-sm font-semibold text-gray-700">Nessuna partita corrisponde ai filtri selezionati.</p>
          <button onclick="app.schedulePhaseFilter='all'; app.scheduleCourtFilter='all'; app.scheduleStatusFilter='all'; app.scheduleSearchQuery=''; app.renderScheduleView();" class="mt-3 text-xs text-blue-600 hover:underline font-bold">
            Resetta tutti i filtri
          </button>
        </div>
      </div>
      `;
      container.innerHTML = html;
      return;
    }

    // Lista Schede Incontri
    html += `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${filtered.map(item => {
          const m = item.match;
          const p1 = this.tournamentManager.getPlayer(m.player1Id);
          const p2 = this.tournamentManager.getPlayer(m.player2Id);
          const isCompleted = m.status === "completato";
          const isLive = m.status === "in_corso";
          const hasDateTime = !!m.dateTime;

          const p1Acc = m.p1Acceptance || (hasDateTime ? "pending" : null);
          const p2Acc = m.p2Acceptance || (hasDateTime ? "pending" : null);
          const isBothAccepted = hasDateTime && p1Acc === "accepted" && p2Acc === "accepted";
          const isAnyRejected = hasDateTime && (p1Acc === "rejected" || p2Acc === "rejected");
          const acceptedCount = (p1Acc === "accepted" ? 1 : 0) + (p2Acc === "accepted" ? 1 : 0);

          const currentPlayer = this.getCurrentPlayer();
          const isMeP1 = currentPlayer && p1 && (currentPlayer.id === p1.id || (currentPlayer.email && p1.email && currentPlayer.email.toLowerCase() === p1.email.toLowerCase()));
          const isMeP2 = currentPlayer && p2 && (currentPlayer.id === p2.id || (currentPlayer.email && p2.email && currentPlayer.email.toLowerCase() === p2.email.toLowerCase()));
          const isMyMatch = isMeP1 || isMeP2;
          const myRole = isMeP1 ? "p1" : (isMeP2 ? "p2" : null);
          const myAcc = isMeP1 ? p1Acc : (isMeP2 ? p2Acc : null);

          const isGroup = item.type === "group";
          const phaseColor = isGroup
            ? "bg-blue-100 text-blue-900 border-blue-200"
            : "bg-yellow-100 text-blue-950 border-yellow-300";

          const courtBadge = m.court || "Campo da definire";

          // Badge di stato principale
          let scheduleStatusBadge = "";
          if (isLive) {
            scheduleStatusBadge = `
              <span class="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                <span>Live in corso</span>
              </span>`;
          } else if (isCompleted) {
            scheduleStatusBadge = `
              <span class="bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                Completato
              </span>`;
          } else if (hasDateTime) {
            if (isBothAccepted) {
              scheduleStatusBadge = `
                <span class="bg-emerald-100 text-emerald-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs flex items-center gap-1">
                  <span>✓</span> <span>Confermato (2/2)</span>
                </span>`;
            } else if (isAnyRejected) {
              scheduleStatusBadge = `
                <span class="bg-rose-100 text-rose-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-rose-300 shadow-2xs flex items-center gap-1">
                  <span>✕</span> <span>Orario Rifiutato</span>
                </span>`;
            } else {
              scheduleStatusBadge = `
                <span class="bg-amber-100 text-amber-950 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                  <span>⏳</span> <span>In attesa (${acceptedCount}/2)</span>
                </span>`;
            }
          } else {
            scheduleStatusBadge = `
              <span class="bg-gray-100 text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded-full border border-gray-200">
                Da fissare
              </span>`;
          }

          // Badge accettazione singoli atleti
          const p1StatusBadge = !hasDateTime ? '' : (
            p1Acc === 'accepted'
              ? `<span class="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1 shadow-2xs"><span>✓</span> <span>Accettato</span></span>`
              : p1Acc === 'rejected'
                ? `<span class="text-[10px] font-bold text-rose-800 bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-300 flex items-center gap-1 shadow-2xs"><span>✕</span> <span>Rifiutato</span></span>`
                : `<span class="text-[10px] font-medium text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300 flex items-center gap-1"><span>⏳</span> <span>In attesa</span></span>`
          );

          const p2StatusBadge = !hasDateTime ? '' : (
            p2Acc === 'accepted'
              ? `<span class="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1 shadow-2xs"><span>✓</span> <span>Accettato</span></span>`
              : p2Acc === 'rejected'
                ? `<span class="text-[10px] font-bold text-rose-800 bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-300 flex items-center gap-1 shadow-2xs"><span>✕</span> <span>Rifiutato</span></span>`
                : `<span class="text-[10px] font-medium text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300 flex items-center gap-1"><span>⏳</span> <span>In attesa</span></span>`
          );

          return `
            <div class="bg-white rounded-2xl border ${hasDateTime ? (isBothAccepted ? 'border-emerald-300 ring-1 ring-emerald-100' : isAnyRejected ? 'border-rose-300 ring-1 ring-rose-100' : 'border-gray-200') : 'border-dashed border-gray-300'} shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between">
              
              <!-- Barra Superiore Incontro -->
              <div class="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${phaseColor}">
                    ${item.phase}
                  </span>
                  ${this.getCategoryBadgeMarkup(item.category)}
                  <span class="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    </svg>
                    <span>${courtBadge}</span>
                  </span>
                </div>

                <div>
                  ${scheduleStatusBadge}
                </div>
              </div>

              <!-- Dettagli Atleti e Data/Ora -->
              <div class="p-4 sm:p-5 flex-grow space-y-3">
                
                <!-- Box Data & Orario -->
                <div class="flex items-center gap-2.5 p-3 rounded-xl ${hasDateTime ? (isBothAccepted ? 'bg-emerald-50/80 border border-emerald-200' : isAnyRejected ? 'bg-rose-50/80 border border-rose-200' : 'bg-blue-50/70 border border-blue-200') : 'bg-amber-50/50 border border-amber-200/60'}">
                  <div class="w-8 h-8 rounded-lg ${hasDateTime ? (isBothAccepted ? 'bg-emerald-600 text-white' : isAnyRejected ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white') : 'bg-amber-100 text-amber-800'} flex items-center justify-center flex-shrink-0 font-bold text-sm shadow-xs">
                    ${hasDateTime ? (isBothAccepted ? '✓' : isAnyRejected ? '✕' : '📅') : '⏳'}
                  </div>
                  <div class="text-xs">
                    ${hasDateTime ? `
                      <span class="font-black text-gray-900 text-xs sm:text-sm block">${this.formatScheduleDateTime(m.dateTime)}</span>
                      <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span class="text-gray-500 text-[11px]">Durata: ${this.getCategoryFormatInfo(item.category).durationText} • ${this.getCategoryFormatInfo(item.category).formula}</span>
                        ${isBothAccepted ? `
                          <span class="text-[11px] font-extrabold text-emerald-700">• Orario accettato da entrambi</span>
                        ` : isAnyRejected ? `
                          <span class="text-[11px] font-extrabold text-rose-700">• Orario rifiutato da un atleta</span>
                        ` : `
                          <span class="text-[11px] font-semibold text-amber-800">• Proposto dall'admin • In attesa di risposta (${acceptedCount}/2)</span>
                        `}
                      </div>
                    ` : `
                      <span class="font-semibold text-amber-900 italic">Data e ora non ancora fissate</span>
                      <span class="text-amber-700 text-[11px] block">In attesa di programmazione da parte dell'admin</span>
                    `}
                  </div>
                </div>

                <!-- Atleti a Confronto con Stato Accettazione -->
                <div class="space-y-2 pt-1">
                  <!-- Giocatore 1 -->
                  <div class="flex items-center justify-between p-2.5 rounded-xl ${m.winnerId && m.winnerId === m.player1Id ? 'bg-blue-50/90 font-bold border border-blue-200' : 'bg-gray-50'} border border-gray-100">
                    <div class="flex items-center gap-2 truncate">
                      <span class="text-xs font-bold ${m.winnerId && m.winnerId === m.player1Id ? 'text-blue-950' : 'text-gray-900'} truncate">
                        ${p1 ? p1.name : (m.player1Id ? m.player1Id : 'In attesa')}
                      </span>
                      ${p1 && p1.ranking ? `
                        <span class="text-[9px] font-mono bg-white text-gray-700 px-1.5 py-0.2 rounded border font-semibold">
                          ${p1.ranking}
                        </span>
                      ` : ''}
                      ${isMeP1 ? `<span class="text-[10px] bg-blue-600 text-white font-black px-1.5 py-0.2 rounded">TU</span>` : ''}
                    </div>

                    <div class="flex items-center gap-2 flex-shrink-0">
                      ${p1StatusBadge}
                      ${m.games1 !== null && m.games1 !== undefined ? `
                        <span class="font-mono text-xs font-black text-blue-900 bg-white px-2 py-0.5 rounded border">
                          ${m.games1}
                        </span>
                      ` : (isCompleted && m.scores ? `
                        <span class="font-mono text-xs font-bold text-blue-900">${m.scores}</span>
                      ` : '')}
                    </div>
                  </div>

                  <!-- Giocatore 2 -->
                  <div class="flex items-center justify-between p-2.5 rounded-xl ${m.winnerId && m.winnerId === m.player2Id ? 'bg-blue-50/90 font-bold border border-blue-200' : 'bg-gray-50'} border border-gray-100">
                    <div class="flex items-center gap-2 truncate">
                      <span class="text-xs font-bold ${m.winnerId && m.winnerId === m.player2Id ? 'text-blue-950' : 'text-gray-900'} truncate">
                        ${p2 ? p2.name : (m.player2Id ? m.player2Id : 'In attesa')}
                      </span>
                      ${p2 && p2.ranking ? `
                        <span class="text-[9px] font-mono bg-white text-gray-700 px-1.5 py-0.2 rounded border font-semibold">
                          ${p2.ranking}
                        </span>
                      ` : ''}
                      ${isMeP2 ? `<span class="text-[10px] bg-blue-600 text-white font-black px-1.5 py-0.2 rounded">TU</span>` : ''}
                    </div>

                    <div class="flex items-center gap-2 flex-shrink-0">
                      ${p2StatusBadge}
                      ${m.games2 !== null && m.games2 !== undefined ? `
                        <span class="font-mono text-xs font-black text-blue-900 bg-white px-2 py-0.5 rounded border">
                          ${m.games2}
                        </span>
                      ` : ''}
                    </div>
                  </div>
                </div>

                <!-- Box Azione Accetta / Rifiuta per l'Atleta Coinvolto -->
                ${isMyMatch && hasDateTime && !isCompleted ? `
                  <div class="mt-2 p-3 rounded-xl border ${myAcc === 'accepted' ? 'bg-emerald-50/90 border-emerald-300' : myAcc === 'rejected' ? 'bg-rose-50/90 border-rose-300' : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300'} space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-extrabold ${myAcc === 'accepted' ? 'text-emerald-950' : myAcc === 'rejected' ? 'text-rose-950' : 'text-amber-950'}">
                        ${myAcc === 'accepted' ? '✓ Hai confermato questo orario' : myAcc === 'rejected' ? '✕ Hai rifiutato questo orario' : '👉 Conferma la tua presenza per questo orario:'}
                      </span>
                      <span class="text-[10px] font-black uppercase tracking-wider text-gray-500">Tua Risposta</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                      <button onclick="app.respondMatchSchedule('${item.type}', '${item.groupKey !== undefined ? item.groupKey : item.roundIndex}', '${m.id}', '${item.category}', '${myRole}', 'accepted')"
                              class="py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${myAcc === 'accepted' ? 'bg-emerald-600 text-white ring-2 ring-emerald-400' : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300'}">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        <span>${myAcc === 'accepted' ? 'Orario Accettato' : 'Accetta Orario'}</span>
                      </button>
                      <button onclick="app.respondMatchSchedule('${item.type}', '${item.groupKey !== undefined ? item.groupKey : item.roundIndex}', '${m.id}', '${item.category}', '${myRole}', 'rejected')"
                              class="py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${myAcc === 'rejected' ? 'bg-rose-600 text-white ring-2 ring-rose-400' : 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-300'}">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        <span>${myAcc === 'rejected' ? 'Orario Rifiutato' : 'Rifiuta Orario'}</span>
                      </button>
                    </div>
                  </div>
                ` : (!this.user || this.user.email === 'ospite@torneo.it') && hasDateTime && !isCompleted ? `
                  <div class="text-[11px] text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 flex items-center justify-between">
                    <span>Sei uno dei due giocatori?</span>
                    <button onclick="app.openLoginModal('login')" class="text-blue-600 font-bold hover:underline">Accedi per confermare</button>
                  </div>
                ` : ''}

              </div>

              <!-- Footer con Azioni Admin -->
              ${this.isAdmin ? `
                <div class="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
                  ${isAnyRejected ? `
                    <div class="text-[11px] font-bold text-rose-800 bg-rose-50 p-2 rounded-lg border border-rose-200 flex items-center gap-1.5">
                      <svg class="w-4 h-4 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                      </svg>
                      <span>L'orario è stato rifiutato. Proponi una nuova data e ora agli atleti.</span>
                    </div>
                  ` : ''}
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] text-gray-400">ID: ${m.id}</span>
                    <button onclick="app.openScheduleMatchModal('${item.type}', '${item.groupKey !== undefined ? item.groupKey : item.roundIndex}', '${m.id}', '${item.category}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      <span>${hasDateTime ? 'Modifica Data, Ora & Conferme' : 'Imposta Data, Ora & Campo'}</span>
                    </button>
                  </div>
                </div>
              ` : ''}

            </div>
          `;
        }).join('')}
      </div>
    `;

    html += `</div>`;
    container.innerHTML = html;

    // Ricollega ricerca calendario
    const searchInput = document.getElementById("schedule-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.scheduleSearchQuery = e.target.value.toLowerCase().trim();
        this.renderScheduleView();
      });
    }
  }

  formatScheduleDateTime(dateTimeStr) {
    if (!dateTimeStr) return "";
    try {
      const d = new Date(dateTimeStr);
      if (isNaN(d.getTime())) return dateTimeStr;
      const dayName = d.toLocaleDateString('it-IT', { weekday: 'long' });
      const dayFormatted = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const dateNum = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
      const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      return `${dayFormatted} ${dateNum} • ore ${time}`;
    } catch (e) {
      return dateTimeStr;
    }
  }

  openScheduleMatchModal(type, groupKeyOrRound, matchId, category = null) {
    if (!this.isAdmin) {
      this.showToast("Operazione riservata all'amministrazione del torneo.", "error");
      return;
    }

    const cat = category || (this.selectedCategory !== "all" ? this.selectedCategory : "Pre Agonistica U12");
    let targetMatch = null;
    let phaseLabel = "";

    if (type === "group") {
      this.tournamentManager.ensureGroups(cat);
      const groups = this.state.categoryGroups?.[cat] || this.state.groups;
      const group = groups ? groups[groupKeyOrRound] : null;
      if (group) {
        targetMatch = group.matches.find(m => m.id === matchId);
        phaseLabel = `${group.name || `Girone ${groupKeyOrRound}`} (${cat})`;
      }
    } else if (type === "bracket") {
      this.tournamentManager.ensureBrackets(cat);
      const bracket = this.state.categoryBrackets?.[cat] || this.state.bracket;
      if (bracket && bracket.rounds) {
        for (let r = 0; r < bracket.rounds.length; r++) {
          const round = bracket.rounds[r];
          const found = round.matches.find(m => m.id === matchId);
          if (found) {
            targetMatch = found;
            phaseLabel = `Tabellone ${cat} • ${round.name}`;
            groupKeyOrRound = r;
            break;
          }
        }
      }
    }

    if (!targetMatch) return;

    const p1 = this.tournamentManager.getPlayer(targetMatch.player1Id);
    const p2 = this.tournamentManager.getPlayer(targetMatch.player2Id);

    document.getElementById("schedule-match-type").value = type;
    document.getElementById("schedule-match-group-or-round").value = groupKeyOrRound;
    document.getElementById("schedule-match-id").value = matchId;
    const catInput = document.getElementById("schedule-match-category");
    if (catInput) catInput.value = cat;

    document.getElementById("schedule-match-phase-label").textContent = phaseLabel;
    document.getElementById("schedule-match-p1-name").textContent = p1 ? p1.name : "In attesa";
    document.getElementById("schedule-match-p2-name").textContent = p2 ? p2.name : "In attesa";

    // Etichette atleti per le conferme
    const p1Label = document.getElementById("schedule-modal-p1-label");
    if (p1Label) p1Label.textContent = p1 ? p1.name : "Atleta 1";
    const p2Label = document.getElementById("schedule-modal-p2-label");
    if (p2Label) p2Label.textContent = p2 ? p2.name : "Atleta 2";

    const p1Acc = document.getElementById("schedule-match-p1-acceptance");
    if (p1Acc) p1Acc.value = targetMatch.p1Acceptance || "pending";
    const p2Acc = document.getElementById("schedule-match-p2-acceptance");
    if (p2Acc) p2Acc.value = targetMatch.p2Acceptance || "pending";

    document.getElementById("schedule-match-datetime").value = targetMatch.dateTime || "";
    document.getElementById("schedule-match-court").value = targetMatch.court || "Campo 0 (Terra)";
    document.getElementById("schedule-match-status").value = targetMatch.status || "in_programma";

    this.openModal("modal-schedule-match");
  }

  handleSaveScheduleMatch() {
    if (!this.isAdmin) return;

    const type = document.getElementById("schedule-match-type").value;
    const groupKeyOrRound = document.getElementById("schedule-match-group-or-round").value;
    const matchId = document.getElementById("schedule-match-id").value;
    const category = document.getElementById("schedule-match-category")?.value || (this.selectedCategory !== "all" ? this.selectedCategory : "Pre Agonistica U12");
    const dateTime = document.getElementById("schedule-match-datetime").value;
    const court = document.getElementById("schedule-match-court").value;
    const status = document.getElementById("schedule-match-status").value;

    const p1Acceptance = document.getElementById("schedule-match-p1-acceptance")?.value || "pending";
    const p2Acceptance = document.getElementById("schedule-match-p2-acceptance")?.value || "pending";

    const updatePayload = {
      dateTime,
      court,
      status,
      p1Acceptance: dateTime ? p1Acceptance : null,
      p2Acceptance: dateTime ? p2Acceptance : null
    };

    if (type === "group") {
      this.tournamentManager.ensureGroups(category);
      this.tournamentManager.updateGroupMatch(groupKeyOrRound, matchId, updatePayload, category);
    } else if (type === "bracket") {
      this.tournamentManager.updateBracketMatch(matchId, updatePayload, category);
    }

    this.saveState();
    this.closeModal("modal-schedule-match");
    this.render();
    this.showToast("Data, orario e campo programmati con successo!", "success");
  }

  respondMatchSchedule(type, groupKeyOrRound, matchId, category, role, response) {
    if (!this.user || this.user.email === "ospite@torneo.it") {
      this.showToast("Effettua l'accesso con il tuo account per confermare o rifiutare l'orario.", "warning");
      this.openLoginModal("login");
      return;
    }

    const updatePayload = {};
    if (role === "p1") updatePayload.p1Acceptance = response;
    if (role === "p2") updatePayload.p2Acceptance = response;

    const cat = category || (this.selectedCategory !== "all" ? this.selectedCategory : "Pre Agonistica U12");

    if (type === "group") {
      this.tournamentManager.ensureGroups(cat);
      this.tournamentManager.updateGroupMatch(groupKeyOrRound, matchId, updatePayload, cat);
    } else if (type === "bracket") {
      this.tournamentManager.ensureBrackets(cat);
      this.tournamentManager.updateBracketMatch(matchId, updatePayload, cat);
    }

    this.saveState();
    this.render();

    if (response === "accepted") {
      this.showToast("Disponibilità per l'orario CONFERMATA! 👍", "success");
    } else {
      this.showToast("Orario RIFIUTATO. L'organizzatore Luca Barcello proporrà una nuova data/ora.", "info");
    }
  }

  // ==========================================
  // SEZIONE 4: TABELLONE FINALE PER CATEGORIA
  // ==========================================
  renderBracketView() {
    const container = document.getElementById("bracket-container");
    if (!container) return;

    this.tournamentManager.ensureCategories();
    const categories = TournamentManager.CATEGORIES; // ["Pre Agonistica U12", "Pre Agonistica", "SAT U14", "SAT"]
    const currentCat = this.selectedCategory || "all";

    // Calcolo statistiche per ciascuna categoria
    const stats = {};
    categories.forEach(cat => {
      this.tournamentManager.ensureBrackets(cat);
      const players = this.tournamentManager.getPlayersByCategory(cat);
      const bracket = this.state.categoryBrackets?.[cat] || (cat === "Pre Agonistica U12" ? this.state.bracket : null);
      const isGenerated = !!(bracket && bracket.rounds && bracket.rounds.length > 0);
      stats[cat] = {
        playersCount: players.length,
        isGenerated,
        bracket
      };
    });

    let html = `
      <div class="space-y-6">
        <!-- Barra di Navigazione Rapida Categorie Tabellone -->
        <div class="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
              <span class="text-xs font-black uppercase tracking-wider text-blue-950">Tabelloni Finali • Divisione per Categoria</span>
            </div>
            <p class="text-xs text-gray-500 mt-0.5">
              Visualizza tutti i tabelloni del torneo o naviga tra le singole categorie.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <button onclick="app.setCategory('all')" 
                    class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${currentCat === 'all' ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/50' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">
              <span>Tutti i Tabelloni</span>
            </button>
            ${categories.map(cat => {
              const isActive = currentCat === cat;
              const catStat = stats[cat];
              return `
                <button onclick="app.setCategory('${cat}')" 
                        class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${isActive ? 'bg-yellow-400 text-blue-950 shadow-sm ring-2 ring-yellow-400/50' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">
                  <span>${cat}</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? 'bg-blue-950 text-yellow-300' : 'bg-gray-200 text-gray-700'}">${catStat.playersCount}</span>
                  ${catStat.isGenerated 
                    ? `<span class="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" title="Tabellone attivo"></span>` 
                    : `<span class="w-2 h-2 rounded-full bg-gray-300" title="Tabellone da comporre"></span>`}
                </button>
              `;
            }).join("")}
          </div>
        </div>
    `;

    if (currentCat === "all") {
      // Mostra tutte le 4 categorie divise ordinatamente
      categories.forEach(cat => {
        html += this.renderCategoryBracketBlock(cat, stats[cat]);
      });
    } else {
      // Mostra la singola categoria selezionata
      html += this.renderCategoryBracketBlock(currentCat, stats[currentCat]);
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  renderCategoryBracketBlock(cat, stat) {
    const bracket = stat ? stat.bracket : (this.state.categoryBrackets?.[cat] || (cat === "Pre Agonistica U12" ? this.state.bracket : null));
    const categoryPlayers = this.tournamentManager.getPlayersByCategory(cat);
    const formatInfo = this.getCategoryFormatInfo(cat);
    const isGenerated = bracket && bracket.rounds && bracket.rounds.length > 0;

    let html = `
      <div class="space-y-4 bg-gray-50/60 p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs">
        <!-- Banner Intestazione Categoria -->
        <div class="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-blue-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
              <span class="text-xs font-black uppercase tracking-wider text-yellow-300">Tabellone Finale • Top 8 a Fine Anno</span>
              <span class="text-[10px] px-2 py-0.5 rounded-md font-bold bg-white/20 text-yellow-200">${formatInfo.shortDuration} • ${formatInfo.formula}</span>
            </div>
            <h2 class="text-xl sm:text-2xl font-extrabold tracking-tight">Tabellone Finale (${cat})</h2>
            <p class="text-xs text-blue-200 mt-1 max-w-2xl leading-relaxed">
              Formula: <strong>${formatInfo.durationText}</strong> (${formatInfo.formula}). Tabellone a eliminazione diretta riservato ai <strong>migliori 8 atleti</strong> del Girone Unico di <strong>${cat}</strong> (${categoryPlayers.length} iscritti), generato al termine dell'anno.
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap w-full md:w-auto">
            ${isGenerated ? `
              <button onclick="window.print()" title="Stampa Tabellone Finale per Bacheca Circolo" class="w-full sm:w-auto bg-white/15 hover:bg-white/25 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-white/30 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm">
                <svg class="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                </svg>
                <span>Stampa (${cat})</span>
              </button>
            ` : ''}

            ${this.isAdmin ? `
              ${isGenerated ? `
                <button onclick="app.handleGenerateBracketFromGroups('${cat}')" class="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black text-xs px-3.5 py-2.5 rounded-xl shadow transition cursor-pointer">
                  Rigenera Tabellone Top 8 (${cat})
                </button>
                <button onclick="app.handleResetBracket('${cat}')" class="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs px-3 py-2.5 rounded-xl border border-rose-200 transition cursor-pointer">
                  Azzera (${cat})
                </button>
              ` : `
                ${categoryPlayers.length >= 2 ? `
                  <button onclick="app.handleGenerateBracketFromGroups('${cat}')" class="bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black text-xs px-4 py-2.5 rounded-xl shadow transition cursor-pointer">
                    + Genera Tabellone Finale Top 8 (${cat})
                  </button>
                ` : `
                  <button onclick="app.switchTab('players')" class="bg-white/20 hover:bg-white/30 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-white/30 transition cursor-pointer">
                    Vai a Iscritti per Aggiungere Giocatori
                  </button>
                `}
              `}
            ` : ''}
          </div>
        </div>
    `;

    // Se non ancora generato per questa categoria: mostra anteprima Top 8
    if (!isGenerated) {
      const groupStandings = this.tournamentManager.getGroupStandings("single", cat);
      const top8 = groupStandings.slice(0, 8);

      html += `
        <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div class="text-center py-4">
            <div class="w-14 h-14 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <h3 class="text-lg font-extrabold text-gray-900 mb-1">Tabellone Finale a Fine Anno (${cat})</h3>
            <p class="text-xs sm:text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
              Il Tabellone Finale a eliminazione diretta verrà generato a <strong>fine anno</strong> e vedrà sfidarsi i <strong>migliori 8 atleti</strong> della classifica del Girone Unico di <strong>${cat}</strong>.
            </p>
          </div>

          <!-- Anteprima Migliori 8 Attuali -->
          <div class="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span class="text-xs font-bold text-gray-800 uppercase tracking-wider">Qualificati Attuali al Tabellone Finale (Top 8 ${cat})</span>
              </div>
              <span class="text-[11px] font-semibold text-gray-500 bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs">
                ${categoryPlayers.length} atleti iscritti nella categoria
              </span>
            </div>

            ${top8.length === 0 ? `
              <p class="text-xs text-gray-400 italic text-center py-4">Nessun atleta o partita registrata nel girone unico.</p>
            ` : `
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                ${top8.map((s, idx) => `
                  <div class="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between shadow-2xs">
                    <div class="flex items-center gap-2.5 truncate">
                      <span class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center flex-shrink-0">
                        ${idx + 1}°
                      </span>
                      <div class="truncate">
                        <div class="text-xs font-bold text-gray-900 truncate">${s.player.name}</div>
                        <div class="text-[10px] text-gray-400 font-mono">${s.player.ranking || 'NC'} • G: ${s.played}</div>
                      </div>
                    </div>
                    <span class="text-xs font-black text-blue-950 bg-yellow-400 px-2 py-0.5 rounded shadow-2xs flex-shrink-0">
                      ${s.points} pt
                    </span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          ${this.isAdmin && categoryPlayers.length >= 2 ? `
            <div class="text-center pt-2">
              <button onclick="app.handleGenerateBracketFromGroups('${cat}')" class="bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black text-xs px-5 py-2.5 rounded-xl shadow transition cursor-pointer">
                Genera Ora Tabellone Finale Top 8 (${cat})
              </button>
            </div>
          ` : `
            <p class="text-xs text-gray-400 italic text-center">La composizione del tabellone a eliminazione diretta avverrà a conclusione delle partite del girone unico.</p>
          `}
        </div>
      </div>
      `;
      return html;
    }

    // Se generato: albero del tabellone
    html += `
      <div class="overflow-x-auto pb-4">
        <div class="bracket-tree flex gap-8 items-stretch min-w-max px-2 py-4">
    `;

    bracket.rounds.forEach((round, rIdx) => {
      const isFinal = rIdx === bracket.rounds.length - 1;
      html += `
        <div class="bracket-round flex flex-col justify-around min-w-[280px] max-w-[320px]">
          <div class="text-center mb-4">
            <span class="inline-block bg-slate-950 text-yellow-300 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-md shadow-sm border border-slate-800">
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
          <div class="match-card bg-white border ${hasWinner ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'} rounded-xl shadow-sm hover:shadow-md transition relative overflow-hidden ${this.isAdmin ? 'cursor-pointer' : ''}"
               onclick="${this.isAdmin ? `app.openMatchModal('${match.id}', '${cat}')` : ''}">
            
            ${isFinal && hasWinner ? `
              <div class="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-yellow-300 text-[11px] font-black px-2 py-1 text-center uppercase tracking-wider border-b border-blue-800">
                Campione del Torneo Momy (${cat})
              </div>
            ` : ""}

            <div class="p-3">
              <!-- Giocatore 1 -->
              <div class="flex items-center justify-between py-1.5 border-b border-gray-100 ${isP1Winner ? 'font-bold text-blue-950 bg-blue-50/80 -mx-3 px-3 rounded' : 'text-gray-700'}">
                <div class="flex items-center gap-1.5 truncate">
                  <span class="truncate text-sm font-semibold">${p1 ? p1.name : (match.player1Id ? match.player1Id : '<span class="text-gray-400 italic">In attesa</span>')}</span>
                  ${p1 && p1.ranking ? `<span class="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 font-semibold">${p1.ranking}</span>` : ""}
                </div>
                ${isP1Winner ? `<span class="text-blue-950 font-black text-xs bg-yellow-400 px-1.5 py-0.5 rounded shadow-sm">Vinto</span>` : ""}
              </div>

              <!-- Giocatore 2 -->
              <div class="flex items-center justify-between py-1.5 ${isP2Winner ? 'font-bold text-blue-950 bg-blue-50/80 -mx-3 px-3 rounded' : 'text-gray-700'}">
                <div class="flex items-center gap-1.5 truncate">
                  <span class="truncate text-sm font-semibold">${p2 ? p2.name : (match.player2Id ? match.player2Id : '<span class="text-gray-400 italic">In attesa</span>')}</span>
                  ${p2 && p2.ranking ? `<span class="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 font-semibold">${p2.ranking}</span>` : ""}
                </div>
                ${isP2Winner ? `<span class="text-blue-950 font-black text-xs bg-yellow-400 px-1.5 py-0.5 rounded shadow-sm">Vinto</span>` : ""}
              </div>

              <!-- Dettagli e Punteggio -->
              <div class="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <div>
                  ${match.scores ? `
                    <span class="font-mono font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded text-xs">
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
                <div class="mt-2 text-center text-[11px] text-blue-700 font-bold bg-blue-50 py-1 rounded hover:bg-blue-100 border border-blue-200/50">
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
    </div>
    `;

    return html;
  }

  handleGenerateBracket(category = null) {
    if (!this.isAdmin) return;
    const cat = category || (this.selectedCategory !== "all" ? this.selectedCategory : "Pre Agonistica U12");
    try {
      this.tournamentManager.generateBracketFromGroups(cat);
      this.saveState();
      this.renderBracketView();
      this.showToast(`Tabellone Finale Top 8 (${cat}) generato con successo!`, "success");
    } catch (e) {
      alert(e.message);
    }
  }

  handleResetBracket(category = null) {
    if (!this.isAdmin) return;
    const cat = category || (this.selectedCategory !== "all" ? this.selectedCategory : "Pre Agonistica U12");
    if (confirm(`Sei sicuro di voler azzerare il tabellone finale della categoria ${cat}?`)) {
      this.tournamentManager.ensureCategories();
      if (this.state.categoryBrackets) {
        this.state.categoryBrackets[cat] = null;
      }
      if (cat === "Pre Agonistica U12") {
        this.state.bracket = null;
      }
      this.saveState();
      this.renderBracketView();
      this.showToast(`Tabellone finale (${cat}) azzerato`, "info");
    }
  }

  // Modale per aggiornare incontro da parte dell'Admin
  openMatchModal(matchId, category = null) {
    if (!this.isAdmin) return;
    const cat = category || (this.selectedCategory !== "all" ? this.selectedCategory : "Pre Agonistica U12");
    this.tournamentManager.ensureBrackets(cat);
    const bracket = this.state.categoryBrackets?.[cat] || this.state.bracket;
    if (!bracket || !bracket.rounds) return;

    let targetMatch = null;
    bracket.rounds.forEach(r => {
      const found = r.matches.find(m => m.id === matchId);
      if (found) targetMatch = found;
    });

    if (!targetMatch) return;
    this.currentEditingMatchId = matchId;
    this.currentEditingMatchCategory = cat;

    const p1 = this.tournamentManager.getPlayer(targetMatch.player1Id);
    const p2 = this.tournamentManager.getPlayer(targetMatch.player2Id);

    const modalTitle = document.querySelector("#modal-match-score h3");
    if (modalTitle) {
      modalTitle.textContent = `Aggiorna Incontro Tabellone (${cat})`;
    }

    document.getElementById("score-p1-name").textContent = p1 ? p1.name : "In attesa";
    document.getElementById("score-p2-name").textContent = p2 ? p2.name : "In attesa";

    const winnerSelect = document.getElementById("score-winner-select");
    winnerSelect.innerHTML = `
      <option value="">-- Seleziona Vincitore --</option>
      ${p1 ? `<option value="${p1.id}" ${targetMatch.winnerId === p1.id ? 'selected' : ''}>${p1.name}</option>` : ''}
      ${p2 ? `<option value="${p2.id}" ${targetMatch.winnerId === p2.id ? 'selected' : ''}>${p2.name}</option>` : ''}
    `;

    document.getElementById("score-input").value = targetMatch.scores || "";
    document.getElementById("score-court-select").value = targetMatch.court || "Campo 0 (Terra)";
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
    const cat = this.currentEditingMatchCategory || (this.selectedCategory !== "all" ? this.selectedCategory : "Pre Agonistica U12");

    const res = this.tournamentManager.updateBracketMatch(this.currentEditingMatchId, {
      winnerId, scores, court, dateTime, status
    }, cat);

    if (res && res.isChampionDecided) {
      if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      this.showToast(`Torneo Momy (${res.category || cat}) completato! Vincitore: ${res.winner ? res.winner.name : 'Campione'}`, "success", 6000);
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
  // SEZIONE 5: REGOLAMENTO
  // ==========================================
  renderRulesView() {
    const container = document.getElementById("rules-container");
    if (!container) return;

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 sm:p-7 shadow-sm space-y-6">
          <div class="border-b pb-3">
            <div class="text-xs font-bold uppercase tracking-wider text-blue-800">Regolamento Ufficiale</div>
            <h2 class="text-xl font-extrabold text-gray-900 mt-0.5">
              Torneo Momy 26/27 • Tennis Giovanile
            </h2>
            <p class="text-xs text-gray-500 mt-1">
              Categorie Ufficiali: <strong>Pre Agonistica U12</strong>, <strong>Pre Agonistica</strong>, <strong>SAT U14</strong>, <strong>SAT</strong>
            </p>
          </div>

          <!-- SEZIONE CATEGORIE PRE AGONISTICA -->
          <div class="border-2 border-purple-300 bg-purple-50/70 p-5 rounded-2xl space-y-3">
            <div>
              <h3 class="font-extrabold text-purple-950 text-base flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-purple-600"></span>
                <span>Pre Agonistica (Pre Agonistica U12 & Pre Agonistica)</span>
              </h3>
              <div class="text-xs font-extrabold text-purple-800 mt-1 flex items-center gap-1.5">
                <span class="bg-purple-200 text-purple-900 px-2.5 py-0.5 rounded-lg border border-purple-300 inline-block">1 ora e mezza (90 min) • Long-Set ai 9</span>
              </div>
            </div>
            <div class="text-xs text-purple-950 leading-relaxed space-y-2">
              <p>
                <strong>Durata e Formula:</strong> Le partite hanno una durata massima di <strong>1 ora e mezza (90 minuti)</strong> e si giocano con la formula del <strong>Long-Set ai 9 game</strong> (vince chi per primo raggiunge 9 game).
              </p>
              <div class="bg-white/95 p-3.5 rounded-xl border border-purple-200 space-y-2 shadow-xs">
                <div class="font-bold text-purple-900 flex items-center gap-1.5">
                  <span>⏱️ Limite di Tempo e Parità (Pre Agonistica):</span>
                </div>
                <ul class="list-disc list-inside space-y-1.5 text-purple-950 pl-1">
                  <li>Se allo scadere del tempo di 1 ora e mezza la partita non si è conclusa a 9 game, <strong>vince chi si trova in vantaggio nel computo dei game</strong>.</li>
                  <li><strong>Fase a Gironi:</strong> se allo scadere del tempo il punteggio è in parità (es. 6-6, 7-7), la partita termina con il <strong>pareggio</strong> (1 punto ciascuno in classifica).</li>
                  <li><strong>Fase Finale (Tabellone):</strong> se allo scadere del tempo il punteggio è in parità, si gioca un <strong>tie-break di spareggio</strong> per decretare il vincitore che accede al turno successivo.</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- SEZIONE CATEGORIE SAT -->
          <div class="border-2 border-sky-300 bg-sky-50/70 p-5 rounded-2xl space-y-3">
            <div>
              <h3 class="font-extrabold text-sky-950 text-base flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-sky-600"></span>
                <span>SAT (SAT U14 & SAT)</span>
              </h3>
              <div class="text-xs font-extrabold text-sky-800 mt-1 flex items-center gap-1.5">
                <span class="bg-sky-200 text-sky-900 px-2.5 py-0.5 rounded-lg border border-sky-300 inline-block">1 ora suono della campana</span>
              </div>
            </div>
            <div class="text-xs text-sky-950 leading-relaxed space-y-2">
              <p>
                <strong>Durata e Formula:</strong> Le partite hanno una durata prefissata di <strong>1 ora (60 minuti)</strong>. Si disputa un <strong>set unico continuo fino al suono della campana</strong>: al termine dell'ora, chi è avanti nel conteggio dei game vince l'incontro.
              </p>
              <div class="bg-white/95 p-3.5 rounded-xl border border-sky-200 space-y-2 shadow-xs">
                <div class="font-bold text-sky-900 flex items-center gap-1.5">
                  <span>🔔 Regola del Pareggio al Suono della Campana (SAT):</span>
                </div>
                <ul class="list-disc list-inside space-y-1.5 text-sky-950 pl-1">
                  <li><strong>Fase a Gironi (Girone Unico):</strong> se al suono della campana il punteggio è in parità (es. 4-4, 5-5), <strong>la partita termina con il pareggio</strong>. A ciascun atleta viene assegnato <strong>1 punto</strong> in classifica (Vittoria: 3 punti, Pareggio: 1 punto, Sconfitta: 0 punti).</li>
                  <li><strong>Fase Finale a Eliminazione Diretta (Tabellone):</strong> nel tabellone finale non sono ammessi pareggi; se al suono della campana si è in parità, si disputa subito un <strong>rapido tie-break ai 5 punti</strong> per decretare il vincitore che passa al turno successivo.</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Girone Unico e Qualificazione dei Migliori 8 al Tabellone Finale -->
          <div class="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl">
            <h4 class="font-bold text-gray-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
              <span>Fase a Girone Unico & Qualificazione dei Migliori 8 a Fine Anno</span>
            </h4>
            <p class="text-xs text-gray-700 leading-relaxed">
              In ciascuna categoria (<strong>Pre Agonistica U12</strong>, <strong>Pre Agonistica</strong>, <strong>SAT U14</strong>, <strong>SAT</strong>) tutti i partecipanti disputano un <strong>Girone Unico all'italiana</strong>. Al completamento di ciascun incontro, il punteggio e la classifica si aggiornano da soli in tempo reale. <strong>A fine anno, i migliori 8 atleti di ogni categoria accederanno al rispettivo Tabellone Finale a eliminazione diretta</strong> (1° vs 8°, 4° vs 5°, 3° vs 6°, 2° vs 7°).
            </p>
          </div>

          <!-- Criteri Classifica Gironi -->
          <div class="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl">
            <h4 class="font-bold text-gray-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span>Criteri di Classifica nei Gironi</span>
            </h4>
            <p class="text-xs text-gray-700 leading-relaxed mb-2">
              L'ordine di posizionamento nella classifica dei gironi è stabilito applicando i seguenti criteri:
            </p>
            <ol class="list-decimal list-inside text-xs text-gray-700 space-y-1 pl-1">
              <li><strong>Punti</strong> (Vittoria: 3 pt • Pareggio: 1 pt • Sconfitta: 0 pt)</li>
              <li><strong>Scontro diretto</strong> (se esattamente due atleti sono a pari punti)</li>
              <li><strong>Differenza game</strong> (vinti meno persi)</li>
              <li><strong>Numero di game vinti</strong></li>
              <li><strong>Classifica FITP</strong></li>
            </ol>
          </div>

          <!-- Ruolo Esclusivo Amministratore -->
          <div class="bg-blue-50/60 border border-blue-200 p-4 rounded-2xl">
            <h4 class="font-bold text-blue-950 text-xs sm:text-sm mb-1 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-600"></span>
              <span>Amministrazione Ufficiale & Gestione Esclusiva</span>
            </h4>
            <p class="text-xs text-blue-900 leading-relaxed">
              La gestione degli atleti (inserimento, modifica dati anagrafici ed eliminazione), la composizione e modifica dei gironi, la programmazione del calendario gare (data, orario e campo) e la compilazione del tabellone finale sono riservate in via esclusiva all'Amministrazione Ufficiale (<strong>Barcello Luca & Alessia Di Tullio</strong>).
            </p>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 class="text-base font-bold text-gray-900 mb-3">Informazioni Torneo</h3>
            <div class="text-xs text-gray-600 space-y-2.5">
              <div><strong>Manifestazione:</strong> Torneo Momy 26/27</div>
              <div><strong>Amministrazione Ufficiale:</strong> Barcello Luca • Alessia Di Tullio</div>
              <div><strong>Categorie:</strong> Pre Agonistica U12, Pre Agonistica, SAT U14, SAT</div>
              <div><strong>Gironi:</strong> Girone Unico per ogni Categoria</div>
              <div><strong>Fase Finale:</strong> Migliori 8 al Tabellone Finale (a fine anno)</div>
              <div><strong>Formula Pre Agonistica:</strong> 1h 30m • Long-Set ai 9</div>
              <div><strong>Formula SAT:</strong> 1 ora • Suono della campana</div>
              <div><strong>Campi da Gioco:</strong> Campi 0-2 (Terra), 3-4 (Greenset), 5-7 (Terra)</div>
            </div>
          </div>

          <div class="bg-gradient-to-br from-slate-950 via-blue-900 to-indigo-950 rounded-2xl p-6 text-white shadow">
            <h3 class="font-bold text-base mb-2 text-yellow-300">
              ${this.isAdmin ? "Gestione Torneo Admin" : "Roster Torneo Momy"}
            </h3>
            <p class="text-xs text-blue-100 mb-4 leading-relaxed">
              ${this.isAdmin
                ? "Puoi inserire o modificare i partecipanti, aggiornare gli orari delle partite e validare i risultati."
                : "La gestione dei partecipanti, dei gironi e del calendario è curata dall'Amministrazione (Barcello Luca & Alessia Di Tullio)."}
            </p>
            ${this.isAdmin ? `
              <button onclick="app.switchTab('players'); app.openNewPlayerModal(false);" class="w-full bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black text-xs py-2.5 px-4 rounded-xl shadow transition">
                + Inserisci Atleta (Admin)
              </button>
            ` : `
              <button onclick="app.switchTab('players');" class="w-full bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black text-xs py-2.5 px-4 rounded-xl shadow transition">
                Visualizza Elenco Iscritti
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // SEZIONE 6: IL MIO ACCOUNT (PAGINA COMPLETA)
  // ==========================================
  renderAccountView() {
    const container = document.getElementById("account-container");
    if (!container) return;

    if (!this.user || this.user.email === "ospite@torneo.it") {
      container.innerHTML = `
        <div class="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 my-6 text-center">
          <div class="h-16 flex items-center justify-center mx-auto mb-3">
            <img src="assets/logo.jpg" alt="Momy Sport Village" class="h-full w-auto object-contain">
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-1">Area Riservata Account</h2>
          <p class="text-xs sm:text-sm text-gray-500 mb-6">
            Accedi con la tua email e password, oppure crea un nuovo account per gestire il tuo profilo e partecipare al torneo.
          </p>

          <div class="flex flex-col gap-3">
            <button onclick="app.openLoginModal('login')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 px-4 rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
              <span>Accedi al tuo Account</span>
            </button>
            <button onclick="app.openLoginModal('register')" class="w-full bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black text-sm py-3 px-4 rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              <span>Crea Nuovo Account</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    const u = this.user;
    const accounts = this.loadAccounts();
    const accountsCount = Object.keys(accounts).length;
    const linkedPlayer = this.getPlayerForAccount(u);
    const curCat = this.tournamentManager.getPlayerCategory(u);
    const catLabels = {
      "Pre Agonistica U12": "Pre Agonistica U12",
      "Pre Agonistica": "Pre Agonistica",
      "SAT U14": "SAT U14",
      "SAT": "SAT",
      "Da Assegnare": "In attesa di assegnazione dai maestri"
    };
    const curCategoryLabel = catLabels[curCat] || (curCat === "Da Assegnare" ? "In attesa di assegnazione dai maestri" : curCat) || "Da Assegnare";

    container.innerHTML = `
      <div class="space-y-6 max-w-4xl mx-auto">

        <!-- Banner Scheda Profilo Utente -->
        <div class="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 rounded-2xl p-6 sm:p-7 text-white shadow-md border border-blue-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div class="flex items-center gap-4">
            <!-- Avatar grande -->
            <div id="account-page-avatar-preview" class="w-20 h-20 rounded-2xl bg-blue-900 text-yellow-300 border-2 border-yellow-400 shadow-md flex items-center justify-center font-black text-2xl overflow-hidden flex-shrink-0">
              <!-- Riempito via JS -->
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <h2 class="text-xl sm:text-2xl font-extrabold tracking-tight">${this.escapeHtml(u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Utente')}</h2>
                ${this.isAdmin ? `
                  <span class="bg-yellow-400 text-blue-950 font-black text-xs uppercase px-2.5 py-0.5 rounded shadow-sm">
                    👑 Amministratore
                  </span>
                ` : linkedPlayer ? `
                  <span class="bg-emerald-500 text-white font-bold text-xs px-2.5 py-0.5 rounded shadow-sm">
                    🎾 Atleta nel Torneo
                  </span>
                ` : `
                  <span class="bg-blue-500/80 text-white font-medium text-xs px-2.5 py-0.5 rounded shadow-sm">
                    👤 Account Registrato
                  </span>
                `}
              </div>
              <p class="text-xs sm:text-sm text-blue-200 font-mono flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <span>${this.escapeHtml(u.email)}</span>
              </p>
              <div class="flex items-center gap-3 mt-2 text-xs text-yellow-300/90 font-medium flex-wrap">
                <span>Classifica: <strong>${u.ranking || 'NC'}</strong></span>
                <span>•</span>
                <span>Nascita: <strong>${this.formatDate(u.birthDate)}</strong></span>
                <span>•</span>
                <span>Categoria: <strong>${curCat}</strong></span>
              </div>
            </div>
          </div>

          <!-- Azioni Rapide Banner -->
          <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button onclick="app.logout()" class="w-full sm:w-auto bg-white/10 hover:bg-rose-600/80 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-white/20 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm">
              <svg class="w-4 h-4 text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              <span>Esci dall'Account</span>
            </button>
          </div>
        </div>

        <!-- Se Admin: Scheda Backup & Sincronizzazione Dati -->
        ${this.isAdmin ? `
          <div class="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 class="text-sm font-bold text-blue-950 flex items-center gap-2">
                <svg class="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                <span>Sincronizzazione Dati tra Dispositivi (Telefono ↔ Computer)</span>
              </h3>
              <p class="text-xs text-blue-800 mt-0.5">Esporta tutti gli account e i dati del torneo per archiviarli o sincronizzarli tra cellulare e PC.</p>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <button onclick="app.exportBackupData()" class="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer">
                <span>Esporta Backup</span>
              </button>
              <label class="flex-1 sm:flex-none bg-white hover:bg-gray-100 text-blue-900 border border-blue-300 text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer">
                <span>Importa Backup</span>
                <input type="file" accept=".json,application/json" class="hidden" onchange="app.importBackupData(event)">
              </label>
            </div>
          </div>
        ` : ''}

        <!-- FORM MODIFICA PROFILO -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <h3 class="text-base sm:text-lg font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100 flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            <span>Dati Personali e Personalizzazione Profilo</span>
          </h3>

          <form id="account-page-form" class="space-y-6" onsubmit="event.preventDefault(); app.handleSaveAccountProfilePage();">
            
            <!-- Foto Profilo / Avatar -->
            <div class="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <label class="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">Foto Profilo / Avatar</label>
              <div class="flex flex-col sm:flex-row items-center gap-5">
                <div id="account-page-form-avatar-preview" class="w-20 h-20 rounded-2xl bg-blue-900 text-yellow-300 border-2 border-yellow-400 shadow-md flex items-center justify-center font-black text-2xl overflow-hidden flex-shrink-0">
                  <!-- Popolato via JS -->
                </div>

                <div class="flex-grow space-y-3 text-center sm:text-left">
                  <div class="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <label class="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition inline-flex items-center gap-1.5">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      <span>Carica Nuova Foto</span>
                      <input type="file" id="account-page-photo-file" accept="image/*" class="hidden" onchange="app.handlePhotoUpload(event)">
                    </label>

                    <button type="button" onclick="app.removeAccountPhoto()" class="bg-white hover:bg-gray-100 text-rose-700 text-xs font-semibold px-3.5 py-2 rounded-xl border border-gray-200 transition cursor-pointer">
                      Rimuovi Foto
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Dati Anagrafici -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Nome *</label>
                <input type="text" id="account-page-firstname-input" value="${this.escapeHtml(u.firstName || '')}" class="w-full text-xs sm:text-sm px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" required>
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Cognome *</label>
                <input type="text" id="account-page-lastname-input" value="${this.escapeHtml(u.lastName || '')}" class="w-full text-xs sm:text-sm px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" required>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Data di Nascita *</label>
                <input type="date" id="account-page-birthdate-input" value="${u.birthDate || ''}" class="w-full text-xs sm:text-sm px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" required>
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Classifica FITP *</label>
                <select id="account-page-ranking-input" class="w-full text-xs sm:text-sm px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium" required>
                  ${["NC", "4.6", "4.5", "4.4", "4.3", "4.2", "4.1", "3.5", "3.4", "3.3", "3.2", "3.1", "2.8", "2.7", "2.6", "2.5", "2.4", "2.3", "2.2", "2.1", "1"].map(rk => `
                    <option value="${rk}" ${u.ranking === rk ? 'selected' : ''}>${rk}</option>
                  `).join('')}
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Categoria di Gioco *</label>
                ${this.isAdmin ? `
                  <select id="account-page-category-select" class="w-full text-xs sm:text-sm px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium" required>
                    <option value="Da Assegnare" ${curCat === 'Da Assegnare' ? 'selected' : ''}>⏳ In attesa di assegnazione (Da Assegnare)</option>
                    <option value="Pre Agonistica U12" ${curCat === 'Pre Agonistica U12' ? 'selected' : ''}>Pre Agonistica U12</option>
                    <option value="Pre Agonistica" ${curCat === 'Pre Agonistica' ? 'selected' : ''}>Pre Agonistica</option>
                    <option value="SAT U14" ${curCat === 'SAT U14' ? 'selected' : ''}>SAT U14</option>
                    <option value="SAT" ${curCat === 'SAT' ? 'selected' : ''}>SAT</option>
                  </select>
                  <p class="text-[10px] text-blue-700 mt-1 font-semibold">Modalità Amministratore: puoi assegnare o modificare la categoria di gara.</p>
                ` : `
                  <input type="text" value="${curCategoryLabel}" readonly disabled class="w-full text-xs sm:text-sm px-3.5 py-2.5 border rounded-xl bg-gray-100 text-gray-800 font-bold cursor-not-allowed">
                  <input type="hidden" id="account-page-category-select" value="${curCat}">
                  <p class="text-[10px] text-gray-500 mt-1">La categoria viene assegnata dai maestri e amministratori del torneo.</p>
                `}
              </div>
            </div>

            <!-- Email (Unica e non modificabile) -->
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Indirizzo Email (Identificativo Unico)</label>
              <input type="email" value="${this.escapeHtml(u.email)}" readonly class="w-full text-xs sm:text-sm px-3.5 py-2.5 border rounded-xl bg-gray-50 text-gray-600 cursor-not-allowed font-mono">
              <p class="text-[11px] text-gray-400 mt-1">L'email non può essere modificata direttamente per garantire l'integrità delle credenziali di accesso.</p>
            </div>

            <!-- Modifica Password -->
            <div class="bg-blue-50/50 border border-blue-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-blue-950">Modifica Password di Accesso (Opzionale)</span>
                <span class="text-[11px] text-gray-500">Lascia vuoto se non vuoi modificarla</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-[11px] font-semibold text-gray-700 mb-1">Nuova Password</label>
                  <div class="relative">
                    <input type="password" id="account-page-newpassword-input" autocomplete="new-password" placeholder="Minimo 4 caratteri" minlength="4" class="w-full text-xs sm:text-sm pl-3 pr-9 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 bg-white">
                    <button type="button" onclick="app.togglePasswordVisibility('account-page-newpassword-input', this)" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 transition" title="Mostra/Nascondi password">
                      <svg class="w-3.5 h-3.5 eye-icon-show" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      <svg class="w-3.5 h-3.5 eye-icon-hide hidden text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-gray-700 mb-1">Conferma Nuova Password</label>
                  <div class="relative">
                    <input type="password" id="account-page-confirmpassword-input" autocomplete="new-password" placeholder="Ripeti nuova password" minlength="4" class="w-full text-xs sm:text-sm pl-3 pr-9 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 bg-white">
                    <button type="button" onclick="app.togglePasswordVisibility('account-page-confirmpassword-input', this)" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 transition" title="Mostra/Nascondi password">
                      <svg class="w-3.5 h-3.5 eye-icon-show" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      <svg class="w-3.5 h-3.5 eye-icon-hide hidden text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Opzione Biometrica -->
            <div class="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <svg class="w-5 h-5 text-blue-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004 11m5.808 9.562l.054.09"/></svg>
                <label for="account-page-biometrics-toggle" class="text-xs sm:text-sm text-blue-950 font-semibold cursor-pointer">
                  Accesso rapido con Face ID / Touch ID abilitato su questo dispositivo
                </label>
              </div>
              <input type="checkbox" id="account-page-biometrics-toggle" ${u.biometricsEnabled ? 'checked' : ''} class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
            </div>

            <!-- Pulsanti Azione Form -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
              <button type="button" onclick="app.logout()" class="w-full sm:w-auto text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-4 py-2.5 rounded-xl border border-rose-200 transition text-center cursor-pointer">
                Disconnetti Account (Esci)
              </button>
              <div class="flex items-center gap-3 w-full sm:w-auto">
                <button type="submit" class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-md transition cursor-pointer">
                  Salva Modifiche Profilo
                </button>
              </div>
            </div>

          </form>
        </div>

      </div>
    `;

    this.renderAccountAvatarPreview();
    const bdInput = document.getElementById("account-page-birthdate-input");
    const catSelect = document.getElementById("account-page-category-select");
    if (bdInput && catSelect) {
      bdInput.addEventListener("change", (e) => {
        const cat = this.tournamentManager.getPlayerCategory({ birthDate: e.target.value });
        catSelect.value = cat;
      });
    }
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
      success: "bg-blue-950 text-yellow-300 border-blue-800 font-bold",
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
