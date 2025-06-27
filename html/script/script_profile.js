// Configuration de l'API et variables globales
const API_URL = window.CONFIG ? window.CONFIG.API_BASE_URL : "http://localhost:3000/api";
let userStats = null;
let notificationTimeout;
let isRequestInProgress = false;
let lastRequestTime = 0;
const COOLDOWN_TIME = 60000; // Cooldown de 1 minute entre les requêtes

// Initialisation de la page profil
// Vérifie l'authentification et charge les données utilisateur
document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("Début chargement profil");
    updateHeaderDisplay();

    const token = AuthUtils.getAuthToken();
    if (!token) {
      console.log("Pas de token, redirection vers login");
      window.location.href = "login.html";
      return;
    }

    console.log("Token trouvé, vérification nouvel utilisateur");
    const isNewUser =
      sessionStorage.getItem("isNewUser") || localStorage.getItem("isNewUser");
    if (isNewUser) {
      showNotification("Bienvenue sur votre profil !", "success");
      sessionStorage.removeItem("isNewUser");
      localStorage.removeItem("isNewUser");
    }

    console.log("Chargement des données utilisateur");
    await Promise.all([loadUserProfile(), loadUserStats()]);

    setupEventListeners();
    initializeTabs();
  } catch (error) {
    console.error("Erreur lors de l'initialisation:", error);
    showNotification("Erreur lors du chargement du profil", "error");
  }
});

// Configuration des écouteurs d'événements pour les interactions utilisateur
function setupEventListeners() {
  // Upload d'avatar lors du clic sur l'overlay
  document.querySelector(".avatar-overlay").addEventListener("click", () => {
    document.getElementById("avatarInput").click();
  });

  // Gestion des changements d'avatar et mises à jour de profil
  document.getElementById("avatarInput").addEventListener("change", handleAvatarChange);
  document.querySelector(".submit-button").addEventListener("click", updateProfile);

  // Toggle visibilité des mots de passe
  document.querySelectorAll(".toggle-password").forEach((icon) => {
    icon.addEventListener("click", togglePasswordVisibility);
  });
}

// Initialisation des onglets avec animation du slider
function initializeTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const slider = document.querySelector(".tab-slider");

  tabButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      slider.style.transform = `translateX(${index * 100}%)`;
      switchTab(button.dataset.tab);
    });
  });
}

// Variable pour suivre si on fait une suppression ou un reset des stats
let currentAction = null;

// Gestion des modales de confirmation
function showModal(modalId) {
  document.getElementById(modalId).style.display = "flex";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

// Mise à jour du mot de passe 
// Vérifie le code envoyé par email et met à jour le mot de passe
async function updatePassword() {
  const email = document.getElementById("confirmEmail").value;
  const code = document.getElementById("verificationCode").value;
  const newPassword = document.getElementById("newPassword").value;

  if (!newPassword) {
    showNotification("Le nouveau mot de passe est requis", "error");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        code,
        newPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message);
    }

    // Réinitialiser les champs
    document.getElementById("confirmEmail").value = "";
    document.getElementById("verificationCode").value = "";
    document.getElementById("newPassword").value = "";

    // Réinitialiser les étapes
    document.getElementById("emailStep").style.display = "block";
    document.getElementById("codeStep").style.display = "none";
    document.getElementById("newPasswordStep").style.display = "none";

    // Fermer la modal et afficher la notification
    closeModal("changePasswordModal");
    showNotification("Mot de passe modifié avec succès", "success");
  } catch (error) {
    showNotification(
      error.message || "Erreur lors de la modification du mot de passe",
      "error"
    );
  }
}

// Process de suppression de compte
// Envoie un code de vérification par email avec cooldown
async function initiateAccountDeletion() {
  if (isRequestInProgress) {
    showNotification("Une demande est déjà en cours", "error");
    return;
  }

  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < COOLDOWN_TIME) {
    const timeLeft = Math.ceil((COOLDOWN_TIME - timeSinceLastRequest) / 1000);
    showNotification(
      `Veuillez attendre ${timeLeft} secondes avant de demander un nouveau code`,
      "error"
    );
    return;
  }

  try {
    isRequestInProgress = true;
    currentAction = "delete-account";
    const response = await fetch(`${API_URL}/auth/delete-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AuthUtils.getAuthToken()}`,
      },
    });
    if (!response.ok) throw new Error("Erreur envoi code");
    lastRequestTime = Date.now();
    closeModal("deleteAccountModal");
    showModal("verificationModal");
  } catch (error) {
    showNotification(error.message, "error");
  } finally {
    isRequestInProgress = false;
  }
}

// Process de reset des statistiques 
// Envoie un code de vérification par email avec cooldown
async function initiateStatsReset() {
  if (isRequestInProgress) {
    showNotification("Une demande est déjà en cours", "error");
    return;
  }

  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < COOLDOWN_TIME) {
    const timeLeft = Math.ceil((COOLDOWN_TIME - timeSinceLastRequest) / 1000);
    showNotification(
      `Veuillez attendre ${timeLeft} secondes avant de demander un nouveau code`,
      "error"
    );
    return;
  }

  try {
    isRequestInProgress = true;
    currentAction = "reset-stats";
    const response = await fetch(`${API_URL}/auth/reset-stats`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AuthUtils.getAuthToken()}`,
      },
    });
    if (!response.ok) throw new Error("Erreur envoi code");
    lastRequestTime = Date.now();
    closeModal("resetStatsModal");
    showModal("verificationModal");
  } catch (error) {
    showNotification(error.message, "error");
  } finally {
    isRequestInProgress = false;
  }
}

// Vérification des codes reçus par email
// Gère à la fois la suppression de compte et le reset des stats
async function verifyCode() {
  const code = document.getElementById("verificationCode").value;

  if (!code) {
    showNotification("Veuillez entrer un code", "error");
    return;
  }
  if (code.length !== 6) {
    showNotification("Le code doit contenir exactement 6 chiffres", "error");
    return;
  }
  if (!/^\d+$/.test(code)) {
    showNotification("Le code doit contenir uniquement des chiffres", "error");
    return;
  }

  try {
    const endpoint =
      currentAction === "delete-account"
        ? "confirm-delete-account"
        : "confirm-reset-stats";
    const response = await fetch(`${API_URL}/auth/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AuthUtils.getAuthToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        email: document.getElementById("confirmEmail")?.value, // Ajout de l'email si disponible
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Code invalide");
    }

    closeModal("verificationModal");
    document.getElementById("verificationCode").value = ""; // Reset du champ

    if (currentAction === "delete-account") {
      AuthUtils.clearAuth();
      showNotification("Compte supprimé avec succès", "success");
      setTimeout(() => (window.location.href = "login.html"), 2000);
    } else {
      await loadUserStats();
      showNotification("Statistiques réinitialisées avec succès", "success");
    }
  } catch (error) {
    console.error("Erreur de vérification:", error);
    showNotification(error.message || "Code invalide", "error");
    document.getElementById("verificationCode").value = ""; // Reset du champ en cas d'erreur
  }
}

// Gestion des modification de mot de passe
// Envoi du code de vérification par email
async function sendPasswordChangeCode() {
  const email = document.getElementById("confirmEmail").value;

  if (!email) {
    showNotification("Veuillez entrer votre email", "error");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message);
    }

    document.getElementById("emailStep").style.display = "none";
    document.getElementById("codeStep").style.display = "block";
    showNotification(
      "Un code de vérification a été envoyé à votre email",
      "success"
    );
  } catch (error) {
    showNotification(error.message || "Une erreur est survenue", "error");
  }
}

// Vérification du code pour changement de mot de passe
async function verifyChangePasswordCode() {
  const email = document.getElementById("confirmEmail").value;
  const code = document.getElementById("verificationCode").value;

  if (!code || code.length !== 6) {
    showNotification("Le code doit contenir 6 chiffres", "error");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/verify-reset-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, code }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message);
    }

    document.getElementById("codeStep").style.display = "none";
    document.getElementById("newPasswordStep").style.display = "block";
  } catch (error) {
    showNotification(error.message || "Code invalide", "error");
  }
}

function logout() {
  AuthUtils.clearAuth();
  window.location.href = "login.html";
}

// Navigation entre les onglets
function switchTab(tabId) {
  document
    .querySelectorAll(".tab-button")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  const activeButton = document.querySelector(`[data-tab="${tabId}"]`);
  const activeContent = document.getElementById(`${tabId}-content`);

  if (activeButton && activeContent) {
    activeButton.classList.add("active");
    activeContent.classList.add("active");

    const index = Array.from(activeButton.parentElement.children).indexOf(
      activeButton
    );
    document.querySelector(".tab-slider").style.transform = `translateX(${
      index * 100
    }%)`;
  }
}

// Gestion du changement d'avatar
async function handleAvatarChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showNotification("L'image ne doit pas dépasser 2MB", "error");
    return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    showNotification("Format accepté : JPG, PNG ou WebP uniquement", "error");
    return;
  }

  try {
    const avatar = document.getElementById("profileAvatar");
    avatar.style.opacity = "0.5";
    showNotification("Traitement de l'image...", "info");

    const formData = new FormData();
    formData.append("avatar", file);

    const token = localStorage.getItem("userToken");
    const response = await fetch(`${API_URL}/user/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) throw new Error("Erreur lors du téléchargement");

    const data = await response.json();
    if (data.avatarUrl) {
      avatar.src = data.avatarUrl;

      // Mettre à jour aussi l'avatar dans le header
      const headerAvatar = document.querySelector(".header-avatar");
      if (headerAvatar) {
        headerAvatar.src = data.avatarUrl;
      }
    }

    avatar.style.opacity = "1";
    showNotification("Photo de profil mise à jour avec succès");
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur lors de la mise à jour de l'avatar", "error");
    document.getElementById("profileAvatar").style.opacity = "1";
  }
}

// Chargement des données du profil utilisateur
// Récupère les infos de base (username, email, avatar...)
async function loadUserProfile() {
  try {
    const token = AuthUtils.getAuthToken();
    console.log("Chargement profil - token présent:", !!token);

    const response = await fetch(`${API_URL}/user/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("Erreur API:", response.status);
      throw new Error("Erreur de chargement du profil");
    }

    const userData = await response.json();
    console.log("Données utilisateur reçues");
    await displayUserData(userData);
  } catch (error) {
    console.error("Erreur loadUserProfile:", error);
    showNotification("Erreur lors du chargement du profil", "error");
  }
}

// Chargement des statistiques détaillées
// Récupère les stats globales et par mode de jeu
async function loadUserStats() {
  try {
    const token = AuthUtils.getAuthToken();
    console.log("Chargement stats - token présent:", !!token);

    const response = await fetch(`${API_URL}/user/stats/details`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Erreur de chargement des statistiques");
    }

    const statsData = await response.json();
    console.log("Stats reçues:", statsData);

    if (statsData && statsData.currentStats) {
      displayStats(statsData.currentStats);
    } else {
      console.error("Format de données invalide:", statsData);
    }
  } catch (error) {
    console.error("Erreur loadUserStats:", error);
    showNotification("Erreur lors du chargement des statistiques", "error");
  }
}

// Affichage des données utilisateur dans l'interface
// Met à jour tous les champs du profil
function displayUserData(userData) {
  try {
    const elements = {
      username: document.getElementById("username"),
      editUsername: document.getElementById("editUsername"),
      editEmail: document.getElementById("editEmail"),
      profileAvatar: document.getElementById("profileAvatar"),
      joinDate: document.getElementById("joinDate"),
    };

    // Vérifier que tous les éléments existent
    Object.entries(elements).forEach(([key, element]) => {
      if (!element) {
        console.error(`Élément manquant: ${key}`);
      }
    });

    if (elements.username) elements.username.textContent = userData.username;
    if (elements.editUsername) elements.editUsername.value = userData.username;
    if (elements.editEmail) elements.editEmail.value = userData.email || "";

    // Gestion de l'avatar
    if (elements.profileAvatar) {
      elements.profileAvatar.src =
        userData.avatarUrl || "/img/default-avatar.webp";

      // Mettre à jour l'avatar du header si présent
      const headerAvatar = document.querySelector(".header-avatar");
      if (headerAvatar) {
        headerAvatar.src = userData.avatarUrl || "/img/default-avatar.webp";
      }
    }

    // Gestion de la date d'inscription
    if (elements.joinDate) {
      if (userData.createdAt) {
        const joinDate = new Date(userData.createdAt).toLocaleDateString(
          "fr-FR",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );
        elements.joinDate.textContent = joinDate;
      } else {
        elements.joinDate.textContent = "Date inconnue";
      }
    }
  } catch (error) {
    console.error("Erreur dans displayUserData:", error);
  }
}

// Affichage des statistiques dans l'interface
// Met à jour les compteurs globaux et par mode
function displayStats(stats) {
  try {
    // Vérifier si les stats sont définies
    if (!stats) {
      console.error("Stats non définies");
      return;
    }

    // Mettre à jour les statistiques globales
    const elements = {
      gamesPlayed: document.getElementById("gamesPlayed"),
      bestScore: document.getElementById("bestScore"),
      averageScore: document.getElementById("averageScore"),
    };

    // Vérifier et mettre à jour chaque élément
    if (elements.gamesPlayed)
      elements.gamesPlayed.textContent = stats.gamesPlayed || "0";
    if (elements.bestScore)
      elements.bestScore.textContent = stats.bestScore || "0";
    if (elements.averageScore)
      elements.averageScore.textContent = Math.round(stats.averageScore || 0);

    // Définir les modes de jeu
    const modes = [
      { id: "france", name: "France", icon: "🇫🇷" },
      { id: "mondial", name: "Mondial", icon: "🌍" },
      { id: "disneyland", name: "Disneyland", icon: "🎡" },
      { id: "nevers", name: "Nevers", icon: "🏛️" },
      { id: "versaille", name: "Versailles", icon: "👑" },
      { id: "dark", name: "Dark Mode", icon: "🌙" },
    ];

    // Mettre à jour les stats pour chaque mode
    modes.forEach((mode) => {
      const modeKey = `${mode.id}Mode`;
      const modeStats = stats[modeKey] || {
        gamesPlayed: 0,
        averageScore: 0,
        bestScore: 0,
      };

      const modeElements = {
        games: document.getElementById(`${mode.id}ModeGames`),
        avg: document.getElementById(`${mode.id}ModeAvg`),
        top: document.getElementById(`${mode.id}ModeTop`),
      };

      if (modeElements.games)
        modeElements.games.textContent = modeStats.gamesPlayed || "0";
      if (modeElements.avg)
        modeElements.avg.textContent = Math.round(modeStats.averageScore || 0);
      if (modeElements.top)
        modeElements.top.textContent = modeStats.bestScore || "0";
    });

    // Afficher les parties récentes si disponibles
    if (stats.recentGames) {
      displayRecentGames(stats.recentGames);
    }
  } catch (error) {
    console.error("Erreur dans displayStats:", error);
  }
}

// Affichage de l'historique des parties
// Liste des 10 dernières parties avec icônes par mode
function displayRecentGames(recentGames) {
  const container = document.getElementById("recentGames");
  if (!container) return;

  container.innerHTML = "";

  const modeIcons = {
    France: "🇫🇷",
    france: "🇫🇷",
    Mondial: "🌍",
    mondial: "🌍",
    MONDIAL: "🌍",
    Disneyland: "🎡",
    disneyland: "🎡",
    Nevers: "🏛️",
    nevers: "🏛️",
    Versailles: "👑",
    versailles: "👑",
    "Dark Mode": "🌙",
    dark: "🌙",
  };

  if (!recentGames || recentGames.length === 0) {
    container.innerHTML = '<div class="no-games">Aucune partie récente</div>';
    return;
  }

  recentGames.forEach((game) => {
    const gameElement = document.createElement("div");
    gameElement.className = "game-entry";

    // Normalisation du nom du mode
    let displayMode = game.mode;
    if (displayMode.toLowerCase() === "dark") {
      displayMode = "Dark Mode";
    } else {
      // Première lettre en majuscule pour les autres modes
      displayMode =
        displayMode.charAt(0).toUpperCase() +
        displayMode.slice(1).toLowerCase();
    }

    gameElement.innerHTML = `
            <div class="game-info">
                <span class="mode-icon">${
                  modeIcons[game.mode] || modeIcons[displayMode] || "🎮"
                }</span>
                <strong>${displayMode}</strong>
                <span>${new Date(game.date).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}</span>
            </div>
            <div class="game-score">
                <span>${game.score} points</span>
            </div>
        `;

    container.appendChild(gameElement);
  });
}

// Mise à jour des infos de profil
// Gère la mise à jour du username, email et mot de passe
async function updateProfile() {
  const formData = {
    username: document.getElementById("editUsername").value,
    email: document.getElementById("editEmail").value,
  };

  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;

  if (currentPassword || newPassword) {
    if (!currentPassword || !newPassword) {
      showNotification("Les deux champs de mot de passe sont requis", "error");
      return;
    }
    formData.currentPassword = currentPassword;
    formData.newPassword = newPassword;
  }

  try {
    const token = AuthUtils.getAuthToken();
    const response = await fetch(`${API_URL}/user/profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erreur de mise à jour");
    }

    const data = await response.json();

    if (data.username) {
      localStorage.setItem("userFirstName", data.username);
      document.getElementById("username").textContent = data.username;
    }

    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";

    showNotification("Profil mis à jour avec succès");
    await loadUserProfile();
  } catch (error) {
    showNotification(error.message, "error");
  }
}

// Système de notification avec auto-hide
// Types: success, error, info
function showNotification(message, type = "success") {
  const notification = document.getElementById("notification");
  const messageEl = document.getElementById("notificationMessage");
  const icon = notification.querySelector("i");

  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }

  messageEl.textContent = message;
  notification.className = `notification ${type}`;

  if (type === "error") {
    icon.className = "bx bx-x-circle";
    icon.style.color = "#ff4444";
  } else {
    icon.className = "bx bx-check-circle";
    icon.style.color = "#4CAF50";
  }

  notification.classList.add("show");

  notificationTimeout = setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

// Gestion de la visibilité des mots de passe
// Toggle entre affichage en clair et masqué
function togglePasswordVisibility(event) {
  const icon = event.target;
  const input = icon.parentElement.querySelector("input");

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("bx-hide");
    icon.classList.add("bx-show");
  } else {
    input.type = "password";
    icon.classList.remove("bx-show");
    icon.classList.add("bx-hide");
  }
}
