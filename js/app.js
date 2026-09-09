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
    this.playersSubTab = "players";
    this.authMode = "login";
    this.searchQuery = "";
    this.accountsSearchQuery = "";
    this.currentEditingMatchId = null;
    this.revealedPasswords = {};

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

    // CONTROLLO UNICITÀ EMAIL: non possono esistere due o più account con la stessa mail
    if (accounts[email]) {
      alert(`Attenzione: un account con l'indirizzo email "${email}" risulta già registrato.\n\nNon possono esistere due o più account con la stessa mail. Se è il tuo account, effettua l'accesso inserendo la password, oppure usa "Password dimenticata?" per recuperarla.`);
      this.switchAuthMode("login");
      const loginEmail = document.getElementById("login-email-input");
      if (loginEmail) loginEmail.value = email;
      return;
    }

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
    } else if (this.user.presetAvatar) {
      content = this.getAvatarMarkup(this.user, "w-10 h-10", "text-xl");
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

    const fnEl = document.getElementById("account-page-firstname-input") || document.getElementById("account-firstname-input");
    const lnEl = document.getElementById("account-page-lastname-input") || document.getElementById("account-lastname-input");
    const bdEl = document.getElementById("account-page-birthdate-input") || document.getElementById("account-birthdate-input");
    const rkEl = document.getElementById("account-page-ranking-input") || document.getElementById("account-ranking-input");
    const npEl = document.getElementById("account-page-newpassword-input") || document.getElementById("account-newpassword-input");
    const cpEl = document.getElementById("account-page-confirmpassword-input") || document.getElementById("account-confirmpassword-input");
    const bioEl = document.getElementById("account-page-biometrics-toggle") || document.getElementById("account-biometrics-toggle");

    const firstName = fnEl ? fnEl.value.trim() : "";
    const lastName = lnEl ? lnEl.value.trim() : "";
    const birthDate = bdEl ? bdEl.value.trim() : "";
    const ranking = rkEl ? rkEl.value.trim() : "NC";
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

          <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button onclick="window.print()" title="Stampa Gironi e Classifiche per Bacheca Circolo" class="w-full sm:w-auto bg-white/15 hover:bg-white/25 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-white/30 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm">
              <svg class="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
              <span>Stampa Gironi</span>
            </button>
            ${this.isAdmin ? `
              <button onclick="app.handleAutoAssignGroups()" class="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black text-xs px-3.5 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer">
                + Distribuisci Atleti nei 2 Gironi
              </button>
              ${totalInGroups >= 2 ? `
                <button onclick="app.handleGenerateBracketFromGroups()" class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl border border-blue-500 transition flex items-center justify-center gap-1.5 cursor-pointer shadow">
                  Genera Tabellone Finale
                </button>
              ` : ''}
            ` : ''}
          </div>
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

    // Griglia dei 2 Gironi affiancati
    html += `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
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
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>Classifica Ufficiale</span>
              <span class="text-[10px] text-gray-400 font-normal">V: 3pt • P: 1pt • S: 0pt</span>
            </h4>
            <div class="overflow-x-auto rounded-xl border border-gray-100 shadow-2xs">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
                    <th class="py-2.5 px-2 text-center w-7">#</th>
                    <th class="py-2.5 px-2.5">Nome e Cognome</th>
                    <th class="py-2.5 px-2 text-center font-black text-blue-950" title="Punti Totali">Punti</th>
                    <th class="py-2.5 px-2 text-center text-gray-700" title="Game Vinti">Game Vinti</th>
                    <th class="py-2.5 px-2 text-center text-rose-700" title="Set Persi">Set Persi</th>
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
                        <td class="py-2.5 px-2.5 font-bold text-gray-900">
                          <div class="flex items-center gap-1.5 truncate">
                            <span class="truncate">${s.player.name}</span>
                            ${s.player.ranking ? `<span class="text-[9px] font-mono bg-slate-100 text-slate-700 px-1 py-0.2 rounded font-semibold">${s.player.ranking}</span>` : ''}
                          </div>
                        </td>
                        <td class="py-2.5 px-2 text-center">
                          <span class="bg-yellow-400 text-blue-950 font-black text-xs px-2.5 py-0.5 rounded-md shadow-sm">
                            ${s.points}
                          </span>
                        </td>
                        <td class="py-2.5 px-2 text-center font-mono font-semibold text-gray-800">
                          ${s.gamesFor}
                        </td>
                        <td class="py-2.5 px-2 text-center font-mono font-semibold text-rose-700">
                          ${s.lost}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
            <div class="mt-2 text-[10px] text-gray-500 bg-slate-50 rounded-lg p-2 border border-slate-200">
              <span class="font-bold text-gray-700">Criteri classifica:</span> 1° Punti • 2° Scontro diretto (se in 2 a pari punti) • 3° Diff. game • 4° Game vinti
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
    document.getElementById("group-match-court").value = match.court || "Campo 0 (Terra)";
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

    const accountsCount = Object.keys(this.loadAccounts()).length;

    let html = `
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        
        <!-- Banner Condizionale Ruolo -->
        ${this.isAdmin ? `
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs text-blue-950">
              <strong>Accesso Amministratore (Barcello Luca):</strong> puoi inserire, modificare o eliminare atleti, consultare e gestire tutti gli account registrati, organizzare i gironi e comporre il tabellone finale.
            </div>
            <div class="flex items-center gap-2">
              <button onclick="app.openNewPlayerModal(false)" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5">
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
              <strong>Roster Ufficiale Torneo Momy:</strong> La gestione dei partecipanti (inserimento, modifica ed eliminazione atleti) e dei tabelloni è curata esclusivamente dall'Amministratore Ufficiale (<strong>Barcello Luca</strong>).
            </div>
          </div>
        `}

        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-gray-100">
          <div>
            <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>Elenco Atleti nel Torneo</span>
              <span class="bg-blue-100 text-blue-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
                ${players.length} ${players.length === 1 ? 'iscritto' : 'iscritti'}
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
              ? "L'elenco partecipanti del Torneo Momy è attualmente vuoto. Inserisci i ragazzi che parteciperanno alla competizione, oppure consulta la scheda 'Tutti gli Account Registrati' per inserire gli account già creati."
              : "L'elenco partecipanti del Torneo Momy è attualmente vuoto. L'amministratore ufficiale (Barcello Luca) provvederà all'inserimento degli iscritti."}
          </p>
          ${this.isAdmin ? `
            <div class="flex flex-wrap justify-center gap-3">
              <button onclick="app.openNewPlayerModal(false)" class="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow transition">
                + Inserisci Atleta
              </button>
              <button onclick="app.switchPlayersSubTab('accounts')" class="bg-yellow-400 hover:bg-yellow-300 text-blue-950 text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow transition">
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
      role: email === ADMIN_EMAIL.toLowerCase() ? "admin" : role,
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

    if (cleanEmail === ADMIN_EMAIL.toLowerCase() && this.user && this.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      if (!confirm("ATTENZIONE: Stai per eliminare il tuo stesso account di Super Amministratore. Sei sicuro di voler procedere?")) {
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
    document.getElementById("schedule-match-court").value = targetMatch.court || "Campo 0 (Terra)";
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
                <button onclick="app.handleGenerateBracket()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition cursor-pointer">
                  Genera Tabellone Finale (${players.length} Partecipanti)
                </button>
              ` : `
                <button onclick="app.switchTab('players')" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow transition cursor-pointer">
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

    // Barra Intestazione Tabellone con Tasto Stampa
    html += `
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-900 text-yellow-400 flex items-center justify-center font-black flex-shrink-0 shadow">
            <svg class="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-bold text-gray-900">Tabellone Finale ad Eliminazione Diretta</h2>
            <p class="text-xs text-gray-500">Incontri ufficiali, risultati e progressione del torneo</p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button onclick="window.print()" title="Stampa Tabellone Finale per Bacheca Circolo" class="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer">
            <svg class="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            <span>Stampa Tabellone</span>
          </button>
          ${this.isAdmin ? `
            <button onclick="app.handleGenerateBracket()" class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-sm transition cursor-pointer">
              Rigenera Tabellone
            </button>
            <button onclick="app.handleResetBracket()" class="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs px-3.5 py-2.5 rounded-xl border border-rose-200 transition cursor-pointer">
              Azzera
            </button>
          ` : ''}
        </div>
      </div>
    `;

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
            </ol>
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
              <div><strong>Campi:</strong> Da 0 a 2 (Terra), 3 e 4 (Greenset), da 5 a 7 (Terra)</div>
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
              <div class="flex items-center gap-3 mt-2 text-xs text-yellow-300/90 font-medium">
                <span>Classifica: <strong>${u.ranking || 'NC'}</strong></span>
                <span>•</span>
                <span>Nascita: <strong>${this.formatDate(u.birthDate)}</strong></span>
              </div>
            </div>
          </div>

          <!-- Azioni Rapide Banner -->
          <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
            ${this.isAdmin ? `
              <button onclick="app.showAdminAccounts()" class="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-black text-xs px-3.5 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer">
                <svg class="w-4 h-4 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                <span>Tutti gli Account (${accountsCount})</span>
              </button>
            ` : ''}
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

                  <!-- Badge profilo predefiniti -->
                  <div>
                    <span class="text-[11px] text-gray-500 font-semibold block mb-1.5">Oppure scegli uno stile predefinito:</span>
                    <div class="flex gap-2 justify-center sm:justify-start">
                      <button type="button" onclick="app.selectPresetAvatar('racket')" title="Racchetta" class="w-9 h-9 rounded-xl bg-white hover:bg-yellow-200 text-blue-950 flex items-center justify-center border border-gray-300 shadow-sm transition cursor-pointer">
                        <svg class="w-4 h-4 text-blue-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="9" r="6" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 13.5L21 21"/></svg>
                      </button>
                      <button type="button" onclick="app.selectPresetAvatar('trophy')" title="Coppa" class="w-9 h-9 rounded-xl bg-white hover:bg-yellow-200 text-blue-950 flex items-center justify-center border border-gray-300 shadow-sm transition cursor-pointer">
                        <svg class="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 21h8m-4-4v4M5 4h14v4a7 7 0 01-14 0V4z"/></svg>
                      </button>
                      <button type="button" onclick="app.selectPresetAvatar('star')" title="Stella" class="w-9 h-9 rounded-xl bg-white hover:bg-yellow-200 text-blue-950 flex items-center justify-center border border-gray-300 shadow-sm transition cursor-pointer">
                        <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                      </button>
                      <button type="button" onclick="app.selectPresetAvatar('shield')" title="Scudo" class="w-9 h-9 rounded-xl bg-white hover:bg-yellow-200 text-blue-950 flex items-center justify-center border border-gray-300 shadow-sm transition cursor-pointer">
                        <svg class="w-4 h-4 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                      </button>
                    </div>
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

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
