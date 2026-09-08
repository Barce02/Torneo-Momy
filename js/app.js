// Torneo Momy 26/27 - Applicazione Ufficiale con Tema Blu & Giallo, Password e Face ID / Touch ID

const ADMIN_EMAIL = "barcello.luca02@gmail.com";
const USER_KEY = "torneo_momy_user_session_v7";
const ACCOUNTS_KEY = "torneo_momy_accounts_v7";
const DATA_KEY = "torneo_momy_store_v7";
const LAST_EMAIL_KEY = "torneo_momy_last_email_v7";

class App {
  constructor() {
    this.accounts = this.loadAccounts();
    this.user = this.loadUser();
    this.state = this.loadState();
    this.tournamentManager = new TournamentManager(this.state);
    this.currentTab = "players";
    this.authMode = "login";
    this.searchQuery = "";
    this.currentEditingMatchId = null;

    // Filtri calendario
    this.schedulePhaseFilter = "all";
    this.scheduleCourtFilter = "all";
    this.scheduleStatusFilter = "all";
    this.scheduleSearchQuery = "";

    this.init();
  }

  loadAccounts() {
    try {
      const saved = localStorage.getItem(ACCOUNTS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  }

  saveAccounts(accounts) {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      this.accounts = accounts;
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
        if (u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          u.role = "admin";
        }
        if (!u.firstName && u.name) {
          const parts = u.name.trim().split(" ");
          u.firstName = parts[0] || "";
          u.lastName = parts.slice(1).join(" ") || "";
        }
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
    this.render();
  }

  init() {
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

    // Form Recupera Password
    const forgotForm = document.getElementById("forgot-form");
    if (forgotForm) {
      forgotForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleResetPassword();
      });
    }

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
      setTimeout(() => {
        const em = document.getElementById("forgot-email-input");
        if (em) em.focus();
      }, 100);
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

  handleResetPassword() {
    const email = document.getElementById("forgot-email-input").value.trim().toLowerCase();
    const newPassword = document.getElementById("forgot-new-password-input").value;
    const confirmPassword = document.getElementById("forgot-confirm-password-input").value;

    if (!email) {
      alert("Inserisci l'indirizzo email del tuo account.");
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

    const accounts = this.loadAccounts();
    const account = accounts[email];

    if (!account) {
      alert(`Nessun account registrato con l'indirizzo ${email}.`);
      return;
    }

    account.password = newPassword;
    accounts[email] = account;
    this.saveAccounts(accounts);

    this.saveUser(account);
    this.closeModal("modal-login");
    this.showToast("Password reimpostata con successo! Sei autenticato.", "success");
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

    const isAdmin = email === ADMIN_EMAIL.toLowerCase();

    const accounts = this.loadAccounts();
    const accountObj = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      email,
      password,
      birthDate,
      ranking,
      role: isAdmin ? "admin" : "player",
      biometricsEnabled: biometricsChecked
    };

    accounts[email] = accountObj;
    this.saveAccounts(accounts);
    localStorage.setItem(LAST_EMAIL_KEY, email);

    this.saveUser(accountObj);
    this.closeModal("modal-login");

    if (isAdmin) {
      this.showToast("Benvenuto Amministratore!", "success");
    } else {
      this.showToast(`Benvenuto ${accountObj.name}! Account registrato.`, "success");
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
    const isAdmin = email === ADMIN_EMAIL.toLowerCase();
    if (!account && isAdmin) {
      account = {
        firstName: "Luca",
        lastName: "Barcello",
        name: "Barcello Luca",
        email: email,
        password: password,
        birthDate: "2002-01-01",
        ranking: "4.1",
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
      alert("Password errata. Riprova.");
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
    if (passInput) passInput.value = "";

    const mode = defaultMode || (hasAccounts ? "login" : "register");
    this.openModal("modal-login");
    this.switchAuthMode(mode);
  }

  renderUserBadge() {
    const badge = document.getElementById("user-profile-badge");
    const logoutBtn = document.getElementById("btn-logout");
    const headerAvatar = document.getElementById("header-avatar-circle");
    if (!badge) return;

    if (!this.user || this.user.email === "ospite@torneo.it") {
      badge.className = "bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:bg-white/20 transition";
      badge.onclick = () => this.openLoginModal("login");
      badge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-yellow-400"></span>
        <span>Spettatore</span>
      `;
      if (headerAvatar) {
        headerAvatar.innerHTML = `
          <svg class="w-3.5 h-3.5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        `;
      }
      if (logoutBtn) logoutBtn.classList.add("hidden");
      return;
    }

    if (logoutBtn) logoutBtn.classList.remove("hidden");

    // Rendi il badge cliccabile per personalizzare il profilo
    badge.onclick = () => this.openAccountModal();
    badge.title = "Clicca per personalizzare il tuo account e foto profilo";

    const avatarHtml = this.getAvatarMarkup(this.user, "w-5 h-5", "text-[10px]");

    if (headerAvatar) {
      headerAvatar.innerHTML = avatarHtml;
    }

    if (this.isAdmin) {
      badge.className = "bg-yellow-400 text-blue-950 border border-yellow-300 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-black shadow-sm cursor-pointer hover:bg-yellow-300 transition";
      badge.innerHTML = `
        <div class="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-blue-900 text-yellow-300">
          ${avatarHtml}
        </div>
        <span class="truncate max-w-[170px]">Admin: ${this.user.name}</span>
      `;
    } else {
      badge.className = "bg-blue-950/80 text-white border border-blue-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs cursor-pointer hover:bg-blue-900 transition";
      badge.innerHTML = `
        <div class="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-blue-800 text-yellow-300">
          ${avatarHtml}
        </div>
        <span class="truncate max-w-[150px] font-medium">${this.user.name}</span>
        ${this.user.ranking ? `<span class="bg-yellow-400 text-blue-950 font-mono text-[10px] px-1.5 py-0.5 rounded font-black">${this.user.ranking}</span>` : ''}
      `;
    }
  }

  getAvatarMarkup(user, sizeClass = "w-6 h-6", textClass = "text-xs") {
    if (!user) return "";
    if (user.photoUrl) {
      return `<img src="${user.photoUrl}" alt="Avatar" class="${sizeClass} rounded-full object-cover">`;
    }
    if (user.presetAvatar === "racket") {
      return `<svg class="w-3.5 h-3.5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="9" r="6" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 13.5L21 21"/></svg>`;
    }
    if (user.presetAvatar === "trophy") {
      return `<svg class="w-3.5 h-3.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 21h8m-4-4v4M5 4h14v4a7 7 0 01-14 0V4z"/></svg>`;
    }
    if (user.presetAvatar === "star") {
      return `<svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>`;
    }
    if (user.presetAvatar === "shield") {
      return `<svg class="w-3.5 h-3.5 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`;
    }
    const initials = (user.firstName ? user.firstName[0] : "") + (user.lastName ? user.lastName[0] : (user.name ? user.name[0] : "U"));
    return `<span class="${textClass} font-black uppercase text-blue-950">${initials || 'U'}</span>`;
  }

  // ==========================================
  // GESTIONE PROFILO ACCOUNT
  // ==========================================
  openAccountModal() {
    if (!this.user || this.user.email === "ospite@torneo.it") {
      this.openLoginModal("login");
      return;
    }

    const fnInput = document.getElementById("account-firstname-input");
    const lnInput = document.getElementById("account-lastname-input");
    const bdInput = document.getElementById("account-birthdate-input");
    const rkInput = document.getElementById("account-ranking-input");
    const emInput = document.getElementById("account-email-input");
    const npInput = document.getElementById("account-newpassword-input");
    const cpInput = document.getElementById("account-confirmpassword-input");
    const bioToggle = document.getElementById("account-biometrics-toggle");

    if (fnInput) fnInput.value = this.user.firstName || "";
    if (lnInput) lnInput.value = this.user.lastName || "";
    if (bdInput) bdInput.value = this.user.birthDate || "";
    if (rkInput) rkInput.value = this.user.ranking || "NC";
    if (emInput) emInput.value = this.user.email || "";
    if (npInput) npInput.value = "";
    if (cpInput) cpInput.value = "";
    if (bioToggle) bioToggle.checked = !!this.user.biometricsEnabled;

    this.renderAccountAvatarPreview();
    this.openModal("modal-account");
  }

  renderAccountAvatarPreview() {
    const container = document.getElementById("account-avatar-preview");
    if (!container || !this.user) return;

    if (this.user.photoUrl) {
      container.innerHTML = `<img src="${this.user.photoUrl}" alt="Avatar" class="w-full h-full object-cover rounded-2xl">`;
    } else if (this.user.presetAvatar) {
      container.innerHTML = this.getAvatarMarkup(this.user, "w-10 h-10", "text-xl");
    } else {
      const initials = (this.user.firstName ? this.user.firstName[0] : "") + (this.user.lastName ? this.user.lastName[0] : (this.user.name ? this.user.name[0] : "U"));
      container.innerHTML = `<span class="text-2xl font-black uppercase text-yellow-300">${initials || 'U'}</span>`;
    }
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

  selectPresetAvatar(type) {
    if (!this.user) return;
    delete this.user.photoUrl;
    this.user.presetAvatar = type;
    this.renderAccountAvatarPreview();
    this.renderUserBadge();
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

    const firstName = document.getElementById("account-firstname-input").value.trim();
    const lastName = document.getElementById("account-lastname-input").value.trim();
    const birthDate = document.getElementById("account-birthdate-input").value.trim();
    const ranking = document.getElementById("account-ranking-input").value.trim() || "NC";
    const newPassword = document.getElementById("account-newpassword-input").value;
    const confirmPassword = document.getElementById("account-confirmpassword-input").value;
    const biometricsEnabled = document.getElementById("account-biometrics-toggle")?.checked ?? true;

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
      if (this.user.photoUrl) this.state.players[playerIdx].photoUrl = this.user.photoUrl;
      this.saveState();
    }

    this.closeModal("modal-account");
    this.renderUserBadge();
    this.render();
    this.showToast("Profilo aggiornato con successo!", "success");
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
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      if (btn.dataset.tab === tab) {
        btn.classList.add("border-blue-600", "text-blue-700", "bg-blue-50/70", "font-semibold");
        btn.classList.remove("border-transparent", "text-gray-600", "hover:text-gray-900");
      } else {
        btn.classList.remove("border-blue-600", "text-blue-700", "bg-blue-50/70", "font-semibold");
        btn.classList.add("border-transparent", "text-gray-600", "hover:text-gray-900");
      }
    });

    this.renderTabContent();
  }

  renderTabContent() {
    const tabPanels = ["players", "groups", "schedule", "bracket", "rules"];
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
    }
  }

  render() {
    this.tournamentManager.ensureGroups();

    // Aggiorna contatori header nav
    const playersCount = this.state.players.length;
    const navCount = document.getElementById("nav-players-count");
    if (navCount) navCount.textContent = playersCount;

    // Aggiorna indicatore gironi
    const navGroups = document.getElementById("nav-groups-status");
    if (navGroups && this.state.groups) {
      const sCount = (this.state.groups.sinner?.playerIds || []).length;
      const aCount = (this.state.groups.alcaraz?.playerIds || []).length;
      if (sCount > 0 || aCount > 0) {
        navGroups.textContent = `${sCount + aCount} atleti (${sCount}+${aCount})`;
        navGroups.className = "bg-yellow-400 text-blue-950 text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-sm";
      } else {
        navGroups.textContent = "Sinner & Alcaraz";
        navGroups.className = "bg-blue-100 text-blue-900 text-[10px] font-bold px-1.5 py-0.2 rounded-full";
      }
    }

    // Aggiorna indicatore calendario
    const navScheduleCount = document.getElementById("nav-schedule-count");
    if (navScheduleCount) {
      const allMatches = this.getAllMatches();
      const scheduledCount = allMatches.filter(m => m.match && m.match.dateTime).length;
      if (allMatches.length > 0) {
        navScheduleCount.textContent = `${scheduledCount}/${allMatches.length} fissati`;
        navScheduleCount.className = scheduledCount > 0
          ? "bg-yellow-400 text-blue-950 text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-sm"
          : "bg-blue-100 text-blue-900 text-[10px] font-bold px-1.5 py-0.2 rounded-full";
      } else {
        navScheduleCount.textContent = "Orari & Campi";
        navScheduleCount.className = "bg-blue-100 text-blue-900 text-[10px] font-bold px-1.5 py-0.2 rounded-full";
      }
    }

    // Aggiorna indicatore tabellone
    const navBracketStatus = document.getElementById("nav-bracket-status");
    if (navBracketStatus) {
      if (this.state.bracket) {
        navBracketStatus.textContent = "Attivo";
        navBracketStatus.className = "bg-yellow-400 text-blue-950 text-[10px] font-black px-1.5 py-0.2 rounded-full";
      } else {
        navBracketStatus.textContent = "Non generato";
        navBracketStatus.className = "bg-gray-100 text-gray-600 text-[10px] font-medium px-1.5 py-0.2 rounded-full";
      }
    }

    this.renderTabContent();
  }

  // ==========================================
  // SEZIONE FASE A GIRONI (SINNER & ALCARAZ)
  // ==========================================
  renderGroupsView() {
    const container = document.getElementById("groups-container");
    if (!container) return;

    this.tournamentManager.ensureGroups();
    const sinnerStandings = this.tournamentManager.getGroupStandings("sinner");
    const alcarazStandings = this.tournamentManager.getGroupStandings("alcaraz");
    const sinnerGroup = this.state.groups.sinner;
    const alcarazGroup = this.state.groups.alcaraz;

    const totalInGroups = (sinnerGroup.playerIds || []).length + (alcarazGroup.playerIds || []).length;
    const totalPlayers = this.state.players.length;

    let html = `
      <div class="space-y-6">
        
        <!-- Banner Intestazione & Regolamento Gironi -->
        <div class="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-blue-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
              <span class="text-xs font-black uppercase tracking-wider text-yellow-300">Fase a Gironi • Torneo Momy 26/27</span>
            </div>
            <h2 class="text-xl sm:text-2xl font-extrabold tracking-tight">Girone Sinner & Girone Alcaraz</h2>
            <p class="text-xs text-blue-200 mt-1 max-w-2xl leading-relaxed">
              Partite da <strong>1 ora</strong> continua fino al suono della campana. Se in parità al suono della campana, <strong>rimane il pareggio (1 punto ciascuno)</strong>. Vittoria: 3 pt • Pareggio: 1 pt • Sconfitta: 0 pt.
            </p>
          </div>

          ${this.isAdmin ? `
            <div class="flex flex-wrap gap-2 w-full md:w-auto">
              <button onclick="app.handleAutoAssignGroups()" class="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black text-xs px-3.5 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-1.5">
                + Distribuisci Atleti nei 2 Gironi
              </button>
              ${totalInGroups >= 2 ? `
                <button onclick="app.handleGenerateBracketFromGroups()" class="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl border border-white/30 transition flex items-center justify-center gap-1.5">
                  Genera Tabellone Finale (Tutti Qualificati)
                </button>
              ` : ''}
            </div>
          ` : ''}
        </div>
    `;

    if (totalInGroups === 0) {
      html += `
        <div class="text-center py-16 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div class="w-14 h-14 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-gray-800 mb-1">Gironi Sinner e Alcaraz non ancora composti</h3>
          <p class="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mb-6">
            ${totalPlayers === 0
              ? "Nessun atleta è ancora registrato al torneo. Inserisci gli iscritti nella prima sezione per formare i gironi."
              : `Ci sono attualmente <strong>${totalPlayers}</strong> atleti iscritti. L'amministratore può suddividere gli atleti nei due gironi con criterio bilanciato.`}
          </p>
          ${this.isAdmin && totalPlayers >= 2 ? `
            <button onclick="app.handleAutoAssignGroups()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition">
              Componi Gironi Automaticamente (${totalPlayers} Partecipanti)
            </button>
          ` : `
            <button onclick="app.switchTab('players')" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition">
              Vai alla sezione Iscritti
            </button>
          `}
        </div>
      </div>
      `;
      container.innerHTML = html;
      return;
    }

    // Griglia dei 2 Gironi
    html += `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        ${this.renderSingleGroupCard("sinner", "Girone Sinner", sinnerStandings, sinnerGroup.matches || [])}
        ${this.renderSingleGroupCard("alcaraz", "Girone Alcaraz", alcarazStandings, alcarazGroup.matches || [])}
      </div>
    </div>
    `;

    container.innerHTML = html;
  }

  renderSingleGroupCard(groupKey, title, standings, matches) {
    const isSinner = groupKey === "sinner";
    const accentBorder = isSinner ? "border-blue-300" : "border-indigo-300";
    const headerBg = isSinner
      ? "bg-gradient-to-r from-blue-900 to-blue-950 text-white"
      : "bg-gradient-to-r from-indigo-950 to-slate-950 text-white";

    let html = `
      <div class="bg-white rounded-2xl border ${accentBorder} shadow-sm overflow-hidden flex flex-col">
        <!-- Header Girone -->
        <div class="${headerBg} p-4 sm:p-5 flex items-center justify-between border-b border-blue-900/60">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-yellow-400 text-blue-950 flex items-center justify-center font-black text-sm shadow-sm flex-shrink-0">
              ${isSinner ? 'S' : 'A'}
            </div>
            <div>
              <h3 class="text-base sm:text-lg font-black tracking-tight">${title}</h3>
              <p class="text-[11px] text-blue-200">${standings.length} ${standings.length === 1 ? 'atleta' : 'atleti'} • ${matches.length} incontri</p>
            </div>
          </div>
          <span class="bg-yellow-400 text-blue-950 text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
            ${isSinner ? 'Fase 1' : 'Fase 1'}
          </span>
        </div>

        <div class="p-4 sm:p-5 flex-grow space-y-6">
          <!-- Classifica Girone -->
          <div>
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span>Classifica Ufficiale</span>
              <span class="text-[10px] text-gray-400 font-normal">(V: 3pt • P: 1pt • S: 0pt)</span>
            </h4>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50 text-gray-600 uppercase text-[10px] font-semibold border-b">
                    <th class="py-2 px-2 text-center w-8">#</th>
                    <th class="py-2 px-2">Atleta</th>
                    <th class="py-2 px-1 text-center" title="Giocate">G</th>
                    <th class="py-2 px-1 text-center" title="Vinte">V</th>
                    <th class="py-2 px-1 text-center" title="Pareggiate">P</th>
                    <th class="py-2 px-1 text-center" title="Perse">S</th>
                    <th class="py-2 px-1 text-center" title="Game Fatti">GF</th>
                    <th class="py-2 px-1 text-center" title="Game Subiti">GS</th>
                    <th class="py-2 px-1 text-center" title="Diff. Game">DG</th>
                    <th class="py-2 px-2 text-center font-black text-blue-950" title="Punti Totali">PT</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  ${standings.map((s, idx) => {
                    const isMe = this.user && s.player.email && this.user.email && (s.player.email.toLowerCase() === this.user.email.toLowerCase());
                    const isTop2 = idx < 2;
                    return `
                      <tr class="hover:bg-blue-50/50 transition ${isMe ? 'bg-blue-50/60 font-semibold' : ''}">
                        <td class="py-2.5 px-2 text-center font-mono font-bold ${isTop2 ? 'text-yellow-600' : 'text-gray-400'}">
                          ${idx + 1}
                        </td>
                        <td class="py-2.5 px-2 font-bold text-gray-900">
                          <div class="flex items-center gap-1.5 truncate max-w-[140px]">
                            <span class="truncate">${s.player.name}</span>
                            ${s.player.ranking ? `<span class="text-[9px] font-mono bg-slate-100 text-slate-700 px-1 py-0.2 rounded font-semibold">${s.player.ranking}</span>` : ''}
                          </div>
                        </td>
                        <td class="py-2.5 px-1 text-center font-mono text-gray-600">${s.played}</td>
                        <td class="py-2.5 px-1 text-center font-mono text-emerald-700 font-bold">${s.won}</td>
                        <td class="py-2.5 px-1 text-center font-mono text-amber-700 font-bold">${s.drawn}</td>
                        <td class="py-2.5 px-1 text-center font-mono text-rose-700">${s.lost}</td>
                        <td class="py-2.5 px-1 text-center font-mono text-gray-600">${s.gamesFor}</td>
                        <td class="py-2.5 px-1 text-center font-mono text-gray-600">${s.gamesAgainst}</td>
                        <td class="py-2.5 px-1 text-center font-mono ${s.diff > 0 ? 'text-emerald-700 font-bold' : (s.diff < 0 ? 'text-rose-600' : 'text-gray-500')}">
                          ${s.diff > 0 ? `+${s.diff}` : s.diff}
                        </td>
                        <td class="py-2.5 px-2 text-center">
                          <span class="bg-yellow-400 text-blue-950 font-black text-xs px-2 py-0.5 rounded-md shadow-sm">
                            ${s.points}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Partite del Girone -->
          <div>
            <div class="flex items-center justify-between mb-2.5">
              <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Partite & Risultati
              </h4>
              ${this.isAdmin ? `
                <span class="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Clicca sul match per modificare
                </span>
              ` : ''}
            </div>

            <div class="space-y-2.5">
              ${matches.map(m => {
                const p1 = this.tournamentManager.getPlayer(m.player1Id);
                const p2 = this.tournamentManager.getPlayer(m.player2Id);
                const isCompleted = m.status === "completato";
                const isDraw = m.isDraw || (isCompleted && m.games1 !== null && m.games1 === m.games2);

                return `
                  <div class="bg-white border ${isCompleted ? (isDraw ? 'border-amber-300 bg-amber-50/20' : 'border-blue-300') : 'border-gray-200'} rounded-xl p-3 shadow-sm hover:shadow transition relative ${this.isAdmin ? 'cursor-pointer hover:border-blue-500' : ''}"
                       onclick="${this.isAdmin ? `app.openGroupMatchModal('${groupKey}', '${m.id}')` : ''}">
                    
                    <div class="flex items-center justify-between text-xs mb-1">
                      <div class="flex items-center gap-1.5 font-semibold text-gray-800">
                        <span class="${m.winnerId === m.player1Id ? 'font-bold text-blue-950' : ''}">${p1 ? p1.name : 'In attesa'}</span>
                        <span class="text-gray-400 font-normal">vs</span>
                        <span class="${m.winnerId === m.player2Id ? 'font-bold text-blue-950' : ''}">${p2 ? p2.name : 'In attesa'}</span>
                      </div>

                      ${isCompleted ? `
                        <div class="flex items-center gap-1.5">
                          <span class="font-mono font-black text-xs bg-blue-100 text-blue-900 px-2 py-0.5 rounded shadow-sm">
                            ${m.scores || `${m.games1} - ${m.games2}`}
                          </span>
                          ${isDraw ? `
                            <span class="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">Pari</span>
                          ` : ''}
                        </div>
                      ` : `
                        <span class="text-[10px] text-gray-400 italic">${m.status === 'in_corso' ? 'Live in corso' : 'Da disputare'}</span>
                      `}
                    </div>

                    <div class="flex items-center justify-between text-[11px] text-gray-500 pt-1.5 border-t border-gray-100">
                      <span>${m.court || 'Campo da definire'}</span>
                      <span>${m.dateTime ? this.formatShortDate(m.dateTime) : '1 ora di gioco'}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    return html;
  }

  handleAutoAssignGroups() {
    if (!this.isAdmin) return;
    if (this.state.players.length < 2) {
      alert("Servono almeno 2 atleti iscritti per poter comporre i gironi Sinner e Alcaraz.");
      return;
    }

    if (confirm("Vuoi distribuire automaticamente e in modo bilanciato gli iscritti tra Girone Sinner e Girone Alcaraz?")) {
      this.tournamentManager.autoAssignGroups();
      this.saveState();
      this.render();
      this.showToast("Gironi Sinner e Alcaraz composti con successo!", "success");
    }
  }

  handleGenerateBracketFromGroups() {
    if (!this.isAdmin) return;
    try {
      this.tournamentManager.generateBracketFromGroups();
      this.saveState();
      this.switchTab("bracket");
      this.showToast("Tabellone Finale generato con tutti i partecipanti dei gironi!", "success");
    } catch (e) {
      alert(e.message);
    }
  }

  openGroupMatchModal(groupKey, matchId) {
    if (!this.isAdmin) return;
    this.tournamentManager.ensureGroups();
    const group = this.state.groups[groupKey];
    if (!group) return;

    const match = group.matches.find(m => m.id === matchId);
    if (!match) return;

    const p1 = this.tournamentManager.getPlayer(match.player1Id);
    const p2 = this.tournamentManager.getPlayer(match.player2Id);

    document.getElementById("group-match-group-key").value = groupKey;
    document.getElementById("group-match-id").value = matchId;
    document.getElementById("group-match-header-label").textContent = group.name;

    document.getElementById("group-match-p1-name").textContent = p1 ? p1.name : "Atleta 1";
    document.getElementById("group-match-p2-name").textContent = p2 ? p2.name : "Atleta 2";
    document.getElementById("group-match-p1-label").textContent = `Game ${p1 ? p1.firstName : 'Atleta 1'}`;
    document.getElementById("group-match-p2-label").textContent = `Game ${p2 ? p2.firstName : 'Atleta 2'}`;

    document.getElementById("group-match-score1").value = match.games1 !== null ? match.games1 : "";
    document.getElementById("group-match-score2").value = match.games2 !== null ? match.games2 : "";
    document.getElementById("group-match-court").value = match.court || "Campo 1 (Centrale)";
    document.getElementById("group-match-datetime").value = match.dateTime || "";
    document.getElementById("group-match-status").value = match.status || "in_programma";

    this.openModal("modal-group-match");
  }

  setQuickGroupScore(g1, g2) {
    document.getElementById("group-match-score1").value = g1;
    document.getElementById("group-match-score2").value = g2;
  }

  handleSaveGroupMatchScore() {
    if (!this.isAdmin) return;

    const groupKey = document.getElementById("group-match-group-key").value;
    const matchId = document.getElementById("group-match-id").value;
    const games1 = document.getElementById("group-match-score1").value;
    const games2 = document.getElementById("group-match-score2").value;
    const court = document.getElementById("group-match-court").value;
    const dateTime = document.getElementById("group-match-datetime").value;
    const status = document.getElementById("group-match-status").value;

    this.tournamentManager.updateGroupMatch(groupKey, matchId, {
      games1, games2, court, dateTime, status
    });

    this.saveState();
    this.closeModal("modal-group-match");
    this.render();
    this.showToast("Risultato del girone salvato!", "success");
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
        (p.firstName && p.firstName.toLowerCase().includes(q)) ||
        (p.lastName && p.lastName.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.ranking && p.ranking.toLowerCase().includes(q)) ||
        (p.birthDate && p.birthDate.includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q))
      );
    });

    const myRegisteredPlayer = (this.user && this.user.email !== "ospite@torneo.it")
      ? this.state.players.find(p =>
          (p.userId && p.userId === this.user.email) ||
          (p.email && p.email.toLowerCase() === this.user.email.toLowerCase()) ||
          (p.firstName && p.lastName && this.user.firstName && this.user.lastName &&
           p.firstName.toLowerCase() === this.user.firstName.toLowerCase() &&
           p.lastName.toLowerCase() === this.user.lastName.toLowerCase())
        )
      : null;

    let html = `
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        
        <!-- Banner Condizionale Ruolo -->
        ${this.isAdmin ? `
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs text-blue-950">
              <strong>Accesso Amministratore (Barcello Luca):</strong> puoi inserire, modificare o eliminare atleti, gestire i gironi e comporre il tabellone finale.
            </div>
            <button onclick="app.openNewPlayerModal(false)" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5">
              + Inserisci Atleta
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
              <strong>Roster Ufficiale Torneo Momy:</strong> La gestione dei partecipanti (inserimento, modifica ed eliminazione atleti) e dei tabelloni è curata esclusivamente dall'Amministratore Ufficiale (<strong>Barcello Luca</strong>).
            </div>
          </div>
        `}

        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-gray-100">
          <div>
            <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>Elenco Iscritti Ufficiale</span>
              <span class="bg-blue-100 text-blue-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
                ${players.length} ${players.length === 1 ? 'iscritto' : 'iscritti'}
              </span>
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">Atleti partecipanti al Torneo Momy</p>
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
              <button onclick="app.openNewPlayerModal(false)" class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5">
                + Inserisci Atleta
              </button>
            ` : ''}
          </div>
        </div>
    `;

    if (players.length === 0) {
      html += `
        <div class="text-center py-16 bg-gray-50/50 rounded-xl border border-dashed border-gray-300 p-8 my-6">
          <div class="w-14 h-14 bg-blue-50 text-blue-700 border border-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
          <h3 class="text-base sm:text-lg font-bold text-gray-800 mb-1">Nessun atleta iscritto al momento</h3>
          <p class="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mb-5">
            ${this.isAdmin
              ? "L'elenco partecipanti del Torneo Momy è attualmente vuoto. Inserisci i ragazzi che parteciperanno alla competizione."
              : "L'elenco partecipanti del Torneo Momy è attualmente vuoto. L'amministratore ufficiale (Barcello Luca) provvederà all'inserimento degli iscritti."}
          </p>
          ${this.isAdmin ? `
            <button onclick="app.openNewPlayerModal(false)" class="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow transition">
              + Inserisci Atleta
            </button>
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
                <th class="py-3 px-3">Data di Nascita</th>
                <th class="py-3 px-3">Classifica FITP</th>
                <th class="py-3 px-3">Note</th>
                <th class="py-3 px-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${filtered.map((p, idx) => {
                return `
                  <tr class="hover:bg-gray-50/80 transition">
                    <td class="py-3 px-3 font-mono text-center text-gray-400 font-semibold">${idx + 1}</td>
                    <td class="py-3 px-3 font-bold text-gray-900">${p.firstName || (p.name ? p.name.split(' ')[0] : '-') || '-'}</td>
                    <td class="py-3 px-3 font-bold text-gray-900">${p.lastName || (p.name ? p.name.split(' ').slice(1).join(' ') : '-') || '-'}</td>
                    <td class="py-3 px-3 text-gray-600 font-mono text-xs">${this.formatDate(p.birthDate)}</td>
                    <td class="py-3 px-3">
                      <span class="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                        ${p.ranking || 'NC'}
                      </span>
                    </td>
                    <td class="py-3 px-3 text-gray-500 text-xs italic max-w-xs truncate">${p.notes || '-'}</td>
                    <td class="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      ${this.isAdmin ? `
                        <button onclick="app.editPlayer('${p.id}')" class="text-xs text-blue-700 hover:text-blue-900 font-medium px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition">
                          Modifica
                        </button>
                        <button onclick="app.deletePlayer('${p.id}')" class="text-xs text-rose-600 hover:text-rose-800 font-medium px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 transition">
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

  openNewPlayerModal(fromProfile = false) {
    if (!this.isAdmin) {
      this.showToast("Solo l'amministratore (Barcello Luca) può inserire giocatori.", "error");
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
    const notesInput = document.getElementById("player-notes-input");

    fnInput.value = "";
    lnInput.value = "";
    bdInput.value = "";
    rkInput.value = "NC";
    notesInput.value = "";

    this.openModal("modal-player");
    setTimeout(() => {
      fnInput.focus();
    }, 150);
  }

  editPlayer(id) {
    if (!this.isAdmin) {
      this.showToast("Solo l'amministratore (Barcello Luca) può modificare i dati dei giocatori.", "error");
      return;
    }

    const p = this.state.players.find(x => x.id === id);
    if (!p) return;

    const modalTitle = document.getElementById("player-modal-title");
    const submitBtn = document.getElementById("player-submit-btn");
    if (modalTitle) modalTitle.textContent = "Modifica Dati Atleta";
    if (submitBtn) submitBtn.textContent = "Aggiungi Atleta";
    document.getElementById("player-id-input").value = p.id;

    document.getElementById("player-firstname-input").value = p.firstName || (p.name ? p.name.split(' ')[0] : "") || "";
    document.getElementById("player-lastname-input").value = p.lastName || (p.name ? p.name.split(' ').slice(1).join(' ') : "") || "";
    document.getElementById("player-birthdate-input").value = p.birthDate || "";
    document.getElementById("player-ranking-input").value = p.ranking || "NC";
    document.getElementById("player-notes-input").value = p.notes || "";

    this.openModal("modal-player");
  }

  handleSavePlayer() {
    if (!this.isAdmin) {
      this.showToast("Operazione consentita solo all'amministratore (Barcello Luca).", "error");
      return;
    }

    const id = document.getElementById("player-id-input").value;
    const firstName = document.getElementById("player-firstname-input").value.trim();
    const lastName = document.getElementById("player-lastname-input").value.trim();
    const birthDate = document.getElementById("player-birthdate-input").value.trim();
    const ranking = document.getElementById("player-ranking-input").value.trim() || "NC";
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
          notes
        };
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
        notes,
        email: "",
        userId: "",
        status: "confermato"
      };
      this.state.players.push(newPlayer);
    }

    this.saveState();
    this.closeModal("modal-player");
    this.showToast(`Atleta ${fullName} registrato con successo!`, "success");
  }

  deletePlayer(id) {
    if (!this.isAdmin) {
      this.showToast("Solo l'amministratore (Barcello Luca) può eliminare giocatori.", "error");
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
    this.tournamentManager.ensureGroups();
    const all = [];

    // Gironi
    const sinnerMatches = this.state.groups?.sinner?.matches || [];
    sinnerMatches.forEach(m => {
      all.push({
        type: "group",
        groupKey: "sinner",
        groupName: "Girone Sinner",
        phase: "Girone Sinner",
        match: m
      });
    });

    const alcarazMatches = this.state.groups?.alcaraz?.matches || [];
    alcarazMatches.forEach(m => {
      all.push({
        type: "group",
        groupKey: "alcaraz",
        groupName: "Girone Alcaraz",
        phase: "Girone Alcaraz",
        match: m
      });
    });

    // Tabellone
    if (this.state.bracket && this.state.bracket.rounds) {
      this.state.bracket.rounds.forEach((round, rIdx) => {
        (round.matches || []).forEach(m => {
          all.push({
            type: "bracket",
            roundIndex: rIdx,
            roundName: round.name,
            phase: `Tabellone • ${round.name}`,
            match: m
          });
        });
      });
    }

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

    // Filtraggio
    const filtered = allMatches.filter(item => {
      const m = item.match;
      const p1 = this.tournamentManager.getPlayer(m.player1Id);
      const p2 = this.tournamentManager.getPlayer(m.player2Id);
      const p1Name = p1 ? p1.name.toLowerCase() : "";
      const p2Name = p2 ? p2.name.toLowerCase() : "";

      // Filtro Fase
      if (this.schedulePhaseFilter === "sinner" && item.groupKey !== "sinner") return false;
      if (this.schedulePhaseFilter === "alcaraz" && item.groupKey !== "alcaraz") return false;
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
              Date, orari e campi di gioco stabiliti dall'Amministratore (Barcello Luca) per la Fase a Gironi (Sinner & Alcaraz) e il Tabellone Finale.
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
              Orari e campi gestiti dall'Amministratore Barcello Luca
            </div>
          `}
        </div>

        <!-- Box Statistiche Incontri -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Incontri Totali</div>
            <div class="text-xl sm:text-2xl font-black text-gray-900 mt-0.5">${allMatches.length}</div>
          </div>
          <div class="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <div class="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Programmati</div>
            <div class="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">${scheduledMatches.length}</div>
          </div>
          <div class="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <div class="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Da Fissare</div>
            <div class="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">${allMatches.length - scheduledMatches.length}</div>
          </div>
          <div class="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm text-center">
            <div class="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Completati</div>
            <div class="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">${completedMatches.length}</div>
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
              <button onclick="app.setScheduleFilter('phase', 'sinner')" class="text-xs px-3 py-1.5 rounded-xl font-semibold transition ${this.schedulePhaseFilter === 'sinner' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                Girone Sinner
              </button>
              <button onclick="app.setScheduleFilter('phase', 'alcaraz')" class="text-xs px-3 py-1.5 rounded-xl font-semibold transition ${this.schedulePhaseFilter === 'alcaraz' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                Girone Alcaraz
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
                <option value="Campo 1" ${this.scheduleCourtFilter === 'Campo 1' ? 'selected' : ''}>Campo 1 (Centrale)</option>
                <option value="Campo 2" ${this.scheduleCourtFilter === 'Campo 2' ? 'selected' : ''}>Campo 2 (Terra)</option>
                <option value="Campo 3" ${this.scheduleCourtFilter === 'Campo 3' ? 'selected' : ''}>Campo 3 (Sintetico)</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <label class="font-bold text-gray-600">Stato:</label>
              <select onchange="app.setScheduleFilter('status', this.value)" class="text-xs border rounded-lg px-2.5 py-1 bg-white font-medium">
                <option value="all" ${this.scheduleStatusFilter === 'all' ? 'selected' : ''}>Tutti gli stati</option>
                <option value="scheduled" ${this.scheduleStatusFilter === 'scheduled' ? 'selected' : ''}>Con data/ora fissata</option>
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

          const isGroup = item.type === "group";
          const phaseColor = isGroup
            ? (item.groupKey === "sinner" ? "bg-blue-100 text-blue-900 border-blue-200" : "bg-indigo-100 text-indigo-900 border-indigo-200")
            : "bg-yellow-100 text-blue-950 border-yellow-300";

          const courtBadge = m.court || "Campo da definire";

          return `
            <div class="bg-white rounded-2xl border ${hasDateTime ? 'border-gray-200' : 'border-dashed border-gray-300'} shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between">
              
              <!-- Barra Superiore Incontro -->
              <div class="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/60">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${phaseColor}">
                    ${item.phase}
                  </span>
                  <span class="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    </svg>
                    <span>${courtBadge}</span>
                  </span>
                </div>

                <div>
                  ${isLive ? `
                    <span class="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                      <span>Live in corso</span>
                    </span>
                  ` : isCompleted ? `
                    <span class="bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Completato
                    </span>
                  ` : hasDateTime ? `
                    <span class="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                      In programma
                    </span>
                  ` : `
                    <span class="bg-gray-100 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-full">
                      Da fissare
                    </span>
                  `}
                </div>
              </div>

              <!-- Dettagli Atleti e Data/Ora -->
              <div class="p-4 sm:p-5 flex-grow space-y-3">
                
                <!-- Box Data & Orario -->
                <div class="flex items-center gap-2.5 p-2.5 rounded-xl ${hasDateTime ? 'bg-blue-50/70 border border-blue-200' : 'bg-amber-50/50 border border-amber-200/60'}">
                  <div class="w-7 h-7 rounded-lg ${hasDateTime ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-800'} flex items-center justify-center flex-shrink-0">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div class="text-xs">
                    ${hasDateTime ? `
                      <span class="font-bold text-blue-950">${this.formatScheduleDateTime(m.dateTime)}</span>
                      <span class="text-blue-700 text-[11px] block">Durata: 1 ora fino alla campana</span>
                    ` : `
                      <span class="font-semibold text-amber-900 italic">Data e ora non ancora fissate</span>
                      <span class="text-amber-700 text-[11px] block">In attesa di programmazione da parte dell'admin</span>
                    `}
                  </div>
                </div>

                <!-- Atleti a Confronto -->
                <div class="space-y-1.5 pt-1">
                  <!-- Giocatore 1 -->
                  <div class="flex items-center justify-between p-2 rounded-lg ${m.winnerId && m.winnerId === m.player1Id ? 'bg-blue-50/90 font-bold border border-blue-200' : 'bg-gray-50'}">
                    <div class="flex items-center gap-2 truncate">
                      <span class="text-xs font-bold ${m.winnerId && m.winnerId === m.player1Id ? 'text-blue-950' : 'text-gray-800'} truncate">
                        ${p1 ? p1.name : (m.player1Id ? m.player1Id : 'In attesa')}
                      </span>
                      ${p1 && p1.ranking ? `
                        <span class="text-[9px] font-mono bg-white text-gray-700 px-1.5 py-0.2 rounded border font-semibold">
                          ${p1.ranking}
                        </span>
                      ` : ''}
                    </div>
                    ${m.games1 !== null && m.games1 !== undefined ? `
                      <span class="font-mono text-xs font-black text-blue-900 bg-white px-2 py-0.5 rounded border">
                        ${m.games1}
                      </span>
                    ` : (isCompleted && m.scores ? `
                      <span class="font-mono text-xs font-bold text-blue-900">${m.scores}</span>
                    ` : '')}
                  </div>

                  <!-- Giocatore 2 -->
                  <div class="flex items-center justify-between p-2 rounded-lg ${m.winnerId && m.winnerId === m.player2Id ? 'bg-blue-50/90 font-bold border border-blue-200' : 'bg-gray-50'}">
                    <div class="flex items-center gap-2 truncate">
                      <span class="text-xs font-bold ${m.winnerId && m.winnerId === m.player2Id ? 'text-blue-950' : 'text-gray-800'} truncate">
                        ${p2 ? p2.name : (m.player2Id ? m.player2Id : 'In attesa')}
                      </span>
                      ${p2 && p2.ranking ? `
                        <span class="text-[9px] font-mono bg-white text-gray-700 px-1.5 py-0.2 rounded border font-semibold">
                          ${p2.ranking}
                        </span>
                      ` : ''}
                    </div>
                    ${m.games2 !== null && m.games2 !== undefined ? `
                      <span class="font-mono text-xs font-black text-blue-900 bg-white px-2 py-0.5 rounded border">
                        ${m.games2}
                      </span>
                    ` : ''}
                  </div>
                </div>

              </div>

              <!-- Footer con Azioni Admin -->
              ${this.isAdmin ? `
                <div class="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <span class="text-[11px] text-gray-400">ID: ${m.id}</span>
                  <button onclick="app.openScheduleMatchModal('${item.type}', '${item.groupKey || item.roundIndex}', '${m.id}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm transition flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span>Imposta Data, Ora & Campo</span>
                  </button>
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

  openScheduleMatchModal(type, groupKeyOrRound, matchId) {
    if (!this.isAdmin) {
      this.showToast("Solo l'amministratore (Barcello Luca) può programmare data e campo.", "error");
      return;
    }

    let targetMatch = null;
    let phaseLabel = "";

    if (type === "group") {
      this.tournamentManager.ensureGroups();
      const group = this.state.groups[groupKeyOrRound];
      if (group) {
        targetMatch = group.matches.find(m => m.id === matchId);
        phaseLabel = group.name || `Girone ${groupKeyOrRound}`;
      }
    } else if (type === "bracket") {
      if (this.state.bracket && this.state.bracket.rounds) {
        for (let r = 0; r < this.state.bracket.rounds.length; r++) {
          const round = this.state.bracket.rounds[r];
          const found = round.matches.find(m => m.id === matchId);
          if (found) {
            targetMatch = found;
            phaseLabel = `Tabellone • ${round.name}`;
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

    document.getElementById("schedule-match-phase-label").textContent = phaseLabel;
    document.getElementById("schedule-match-p1-name").textContent = p1 ? p1.name : "In attesa";
    document.getElementById("schedule-match-p2-name").textContent = p2 ? p2.name : "In attesa";

    document.getElementById("schedule-match-datetime").value = targetMatch.dateTime || "";
    document.getElementById("schedule-match-court").value = targetMatch.court || "Campo 1 (Centrale)";
    document.getElementById("schedule-match-status").value = targetMatch.status || "in_programma";

    this.openModal("modal-schedule-match");
  }

  handleSaveScheduleMatch() {
    if (!this.isAdmin) return;

    const type = document.getElementById("schedule-match-type").value;
    const groupKeyOrRound = document.getElementById("schedule-match-group-or-round").value;
    const matchId = document.getElementById("schedule-match-id").value;
    const dateTime = document.getElementById("schedule-match-datetime").value;
    const court = document.getElementById("schedule-match-court").value;
    const status = document.getElementById("schedule-match-status").value;

    if (type === "group") {
      this.tournamentManager.ensureGroups();
      this.tournamentManager.updateGroupMatch(groupKeyOrRound, matchId, {
        dateTime,
        court,
        status
      });
    } else if (type === "bracket") {
      this.tournamentManager.updateBracketMatch(matchId, {
        dateTime,
        court,
        status
      });
    }

    this.saveState();
    this.closeModal("modal-schedule-match");
    this.render();
    this.showToast("Data, ora e campo impostati con successo!", "success");
  }

  // ==========================================
  // SEZIONE 4: TABELLONE FINALE
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
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-blue-950 font-bold text-xs sm:text-sm">Gestione Tabellone Finale (Admin):</span>
            <span class="text-xs text-blue-800">
              ${bracket ? "Clicca su qualsiasi match per aggiornare il punteggio e il campo." : "Componi il tabellone con gli atleti iscritti."}
            </span>
          </div>
          <div class="flex items-center gap-2">
            ${players.length >= 2 ? `
              <button onclick="app.handleGenerateBracket()" class="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl shadow-sm transition">
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
          <div class="w-14 h-14 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
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
                <button onclick="app.handleGenerateBracket()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition">
                  Genera Tabellone Finale (${players.length} Partecipanti)
                </button>
              ` : `
                <button onclick="app.switchTab('players')" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition">
                  Vai a Iscritti per Aggiungere Giocatori
                </button>
              `}
            ` : `
              <p class="text-xs text-gray-500 italic">
                Il tabellone ufficiale delle partite verrà pubblicato dall'amministratore (Barcello Luca).
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
               onclick="${this.isAdmin ? `app.openMatchModal('${match.id}')` : ''}">
            
            ${isFinal && hasWinner ? `
              <div class="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-yellow-300 text-[11px] font-black px-2 py-1 text-center uppercase tracking-wider border-b border-blue-800">
                Campione del Torneo Momy
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
  // SEZIONE 5: REGOLAMENTO
  // ==========================================
  renderRulesView() {
    const container = document.getElementById("rules-container");
    if (!container) return;

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 sm:p-7 shadow-sm space-y-5">
          <div class="border-b pb-3">
            <div class="text-xs font-bold uppercase tracking-wider text-blue-800">Regolamento Ufficiale</div>
            <h2 class="text-xl font-extrabold text-gray-900 mt-0.5">
              Torneo Momy 26/27 • Tennis Giovanile
            </h2>
          </div>

          <!-- Formula Incontri a Tempo da 1 Ora -->
          <div class="bg-blue-50 border-l-4 border-blue-600 p-4 sm:p-5 rounded-r-2xl">
            <h4 class="font-extrabold text-blue-950 text-sm mb-1.5 flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span>Formula delle Partite: 1 Ora & Suono della Campana</span>
            </h4>
            <p class="text-xs text-blue-900 leading-relaxed">
              Tutte le partite del torneo hanno una durata prefissata di <strong>un'ora</strong>. Si gioca un <strong>set unico continuo che va avanti fino al suono della campana</strong>: chi è avanti nel conteggio dei game quando suona la campana vince l'incontro.
            </p>
          </div>

          <!-- Gestione Pareggio al suono della campana -->
          <div class="bg-amber-50 border border-amber-300 p-4 sm:p-5 rounded-2xl">
            <h4 class="font-extrabold text-amber-950 text-sm mb-2 flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Regola del Pareggio al Suono della Campana</span>
            </h4>
            <div class="space-y-2 text-xs text-amber-900 leading-relaxed">
              <div class="bg-white/90 p-3 rounded-xl border border-amber-200 shadow-xs">
                <strong class="text-blue-950 block mb-1">1. Durante la Fase a Gironi (Girone Sinner & Girone Alcaraz):</strong>
                Se al suono della campana il punteggio è in parità (es. 4-4, 5-5), <strong>la partita termina con il pareggio</strong>. A ciascun atleta viene assegnato <strong>1 punto</strong> in classifica (Vittoria: 3 punti, Pareggio: 1 punto, Sconfitta: 0 punti).
              </div>
              <div class="bg-white/90 p-3 rounded-xl border border-amber-200 shadow-xs">
                <strong class="text-blue-950 block mb-1">2. Nella Fase Finale a Eliminazione Diretta (Tabellone Finale):</strong>
                Nel tabellone ad eliminazione diretta non sono ammessi pareggi: se al suono della campana si è in parità, si gioca immediatamente un <strong>rapido tie-break ai 5 punti</strong> per decretare il vincitore che passa al turno successivo.
              </div>
            </div>
          </div>

          <!-- Gironi e Qualificazione di TUTTI i giocatori al Tabellone -->
          <div class="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl">
            <h4 class="font-bold text-gray-900 text-xs sm:text-sm mb-1.5 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
              <span>Gironi & Accesso di Tutti al Tabellone Finale</span>
            </h4>
            <p class="text-xs text-gray-700 leading-relaxed">
              I partecipanti disputano la fase a gironi (<strong>Girone Sinner</strong> e <strong>Girone Alcaraz</strong>) con formula all'italiana. <strong>Tutti i giocatori accedono alla fase a tabellone finale ad eliminazione diretta</strong>: in base alla posizione e ai risultati ottenuti nel girone viene composto il tabellone ad incrocio (le prime posizioni affrontano le posizioni inferiori del girone opposto con eventuali bye).
            </p>
          </div>

          <!-- Ruolo Esclusivo Amministratore -->
          <div class="bg-blue-50/60 border border-blue-200 p-4 rounded-2xl">
            <h4 class="font-bold text-blue-950 text-xs sm:text-sm mb-1 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-600"></span>
              <span>Amministrazione Ufficiale & Gestione Esclusiva</span>
            </h4>
            <p class="text-xs text-blue-900 leading-relaxed">
              La gestione degli atleti (inserimento, modifica dati anagrafici ed eliminazione), la composizione e modifica dei gironi, la programmazione del calendario gare (data, orario e campo) e la compilazione del tabellone finale sono riservate in via esclusiva all'Amministratore Ufficiale (<strong>Barcello Luca</strong>).
            </p>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 class="text-base font-bold text-gray-900 mb-3">Informazioni Torneo</h3>
            <div class="text-xs text-gray-600 space-y-2.5">
              <div><strong>Manifestazione:</strong> Torneo Momy 26/27</div>
              <div><strong>Amministratore Ufficiale:</strong> Barcello Luca</div>
              <div><strong>Gironi:</strong> Girone Sinner • Girone Alcaraz</div>
              <div><strong>Fase Finale:</strong> Tutti qualificati al Tabellone</div>
              <div><strong>Durata Match:</strong> 1 ora fino alla campana</div>
              <div><strong>Campi:</strong> Centrale (1), Terra (2), Sintetico (3)</div>
            </div>
          </div>

          <div class="bg-gradient-to-br from-slate-950 via-blue-900 to-indigo-950 rounded-2xl p-6 text-white shadow">
            <h3 class="font-bold text-base mb-2 text-yellow-300">
              ${this.isAdmin ? "Gestione Torneo Admin" : "Roster Torneo Momy"}
            </h3>
            <p class="text-xs text-blue-100 mb-4 leading-relaxed">
              ${this.isAdmin
                ? "Puoi inserire o modificare i partecipanti, aggiornare gli orari delle partite e validare i risultati."
                : "La gestione dei partecipanti, dei gironi e del calendario è curata dall'Amministratore Barcello Luca."}
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
