// Initialisation des formulaires et des événements
document.addEventListener("DOMContentLoaded", function () {
  console.log("Initialisation de la page de login");
  updateHeader();

  if (window.location.pathname.includes("/login")) {
    const inscriptionForm = document.getElementById("inscriptionForm");
    const connexionForm = document.getElementById("connexionForm");
    const forgotPasswordLink = document.querySelector(".forgot-password");
    
    // Ajout des event listeners pour les onglets
    const connexionTab = document.getElementById("connexionTab");
    const inscriptionTab = document.getElementById("inscriptionTab");
    const switchToInscription = document.getElementById("switchToInscription");
    
    // Ajout des event listeners pour les toggles de mot de passe
    const toggleIconConnexion = document.getElementById("toggleIconConnexion");
    const toggleIconInscription = document.getElementById("toggleIconInscription");
    const toggleConfirmIconInscription = document.getElementById("toggleConfirmIconInscription");

    if (connexionTab) {
      connexionTab.addEventListener("click", () => switchTab('connexion'));
    }
    
    if (inscriptionTab) {
      inscriptionTab.addEventListener("click", () => switchTab('inscription'));
    }
    
    if (switchToInscription) {
      switchToInscription.addEventListener("click", (e) => {
        e.preventDefault();
        switchTab('inscription');
      });
    }
    
    if (toggleIconConnexion) {
      toggleIconConnexion.addEventListener("click", togglePassword);
    }
    
    if (toggleIconInscription) {
      toggleIconInscription.addEventListener("click", togglePasswordInscription);
    }
    
    if (toggleConfirmIconInscription) {
      toggleConfirmIconInscription.addEventListener("click", toggleConfirmPasswordInscription);
    }

    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener("click", (e) => {
        e.preventDefault();
        showPasswordResetPopup();
      });
    }

    if (inscriptionForm) {
      inscriptionForm.addEventListener("submit", handleInscriptionSubmit);
      fadeInForm(inscriptionForm, false);
    }
    if (connexionForm) {
      connexionForm.addEventListener("submit", handleConnexionSubmit);
      fadeInForm(connexionForm, true);
    }
  }
});

// Gère l'animation des formulaires
function fadeInForm(form, show) {
  if (show) {
    form.style.display = "flex";
    form.style.opacity = "0";
    setTimeout(() => {
      form.style.opacity = "1";
    }, 50);
  } else {
    form.style.opacity = "0";
    form.style.display = "none";
  }
}

// Switch entre connexion et inscription
function switchTab(tab) {
  const inscriptionForm = document.getElementById("inscriptionForm");
  const connexionForm = document.getElementById("connexionForm");
  const tabSlider = document.querySelector(".tab-slider");

  if (tab === "connexion") {
    fadeInForm(inscriptionForm, false);
    fadeInForm(connexionForm, true);
    tabSlider.style.left = "0";
  } else {
    fadeInForm(connexionForm, false);
    fadeInForm(inscriptionForm, true);
    tabSlider.style.left = "50%";
  }
}

// Gestion des popups de notification
function showPopup(title, message, type = "success", redirect = false) {
  let popup = document.getElementById("customPopup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "customPopup";
    popup.className = "custom-popup";
    document.body.appendChild(popup);

    popup.innerHTML = `
            <div class="popup-content">
                <box-icon id="popupIcon" class="popup-icon"></box-icon>
                <h2 id="popupTitle" class="popup-title"></h2>
                <p id="popupMessage" class="popup-message"></p>
            </div>
        `;
  }

  const popupContent = popup.querySelector(".popup-content");
  const popupIcon = document.getElementById("popupIcon");

  document.getElementById("popupTitle").innerText = title;
  document.getElementById("popupMessage").innerText = message;

  if (type === "error") {
    popupIcon.setAttribute("name", "x-circle");
    popupIcon.classList.remove("success");
    popupIcon.setAttribute("color", "#e74c3c");
    popupIcon.classList.add("error");
  } else {
    popupIcon.setAttribute("name", "check-circle");
    popupIcon.classList.remove("error");
    popupIcon.setAttribute("color", "#4CAF50");
    popupIcon.classList.add("success");
  }

  popup.style.display = "flex";
  popup.style.opacity = "0";

  setTimeout(() => {
    popup.style.opacity = "1";
    popupContent.style.transform = "translateY(0)";
  }, 50);

  const timeout = type === "error" ? 3000 : 2000;

  setTimeout(() => {
    closePopup();
    if (redirect && type === "success") {
      window.location.href = "/";
    }
  }, timeout);
}

function closePopup() {
  const popup = document.getElementById("customPopup");
  if (!popup) return;

  const popupContent = popup.querySelector(".popup-content");
  if (!popupContent) return;

  popup.style.opacity = "0";
  popupContent.style.transform = "translateY(-20px)";
  setTimeout(() => {
    popup.style.display = "none";
  }, 300);
}

// Handler de connexion simplifié
async function handleConnexionSubmit(event) {
  event.preventDefault();
  resetErrorStyles();

  const username = document.getElementById("usernameConnexion").value.trim();
  const password = document.getElementById("passwordConnexion").value;

  if (!username || !password) {
    showPopup("Erreur", "Veuillez remplir tous les champs", "error", false);
    return;
  }

  try {
    console.log("Tentative de connexion...");
          const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      showPopup("Erreur", data.message, "error", false);
      return;
    }

    console.log("Connexion réussie, stockage des données");
    AuthUtils.storeAuth(data);

    updateHeaderDisplay();
    showPopup("Bienvenue !", `Content de vous revoir, ${data.user.username} !`, "success", true);

    setTimeout(() => {
      window.location.href = "/";
    }, 2000);
  } catch (err) {
    console.error("Erreur connexion:", err);
    showPopup(
      "Erreur",
      "Une erreur est survenue lors de la connexion.",
      "error",
      false
    );
  }
}

// Handler d'inscription
async function handleInscriptionSubmit(event) {
  event.preventDefault();

  const username = document.getElementById("usernameInscription").value;
  const email = document.getElementById("emailInscription").value;
  const password = document.getElementById("passwordInscription").value;
  const confirmPassword = document.getElementById(
    "confirmPasswordInscription"
  ).value;

  if (password !== confirmPassword) {
    showPopup(
      "Erreur",
      "Les mots de passe ne correspondent pas.",
      "error",
      false
    );
    return;
  }

  if (password.length < 6) {
    showPopup(
      "Erreur",
      "Le mot de passe doit contenir au moins 6 caractères.",
      "error",
      false
    );
    return;
  }

  try {
    console.log("Tentative d'inscription...");
          const response = await fetch(`${CONFIG.API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      showPopup("Erreur", data.message, "error", false);
      return;
    }

    console.log("Inscription réussie, stockage des données");
    AuthUtils.storeAuth(data);
    sessionStorage.setItem("isNewUser", "true");

    updateHeaderDisplay();
    showPopup("Bienvenue !", "Inscription réussie !", "success", true);

    setTimeout(() => {
      window.location.href = "/";
    }, 2000);
  } catch (err) {
    console.error("Erreur inscription:", err);
    showPopup(
      "Erreur",
      "Une erreur est survenue lors de l'inscription.",
      "error",
      false
    );
  }
}

// Reset du mot de passe oublié
// Envoie un code de vérification à l'email fourni
async function handleForgotPassword(button) {
  const email = document.getElementById("resetEmail").value;
  if (!email) {
    showPopup("Erreur", "Veuillez entrer votre email", "error", false);
    return;
  }

  button.disabled = true;
  button.textContent = "Envoi...";

  try {
    const response = await fetch(
              `${CONFIG.API_BASE_URL}/auth/forgot-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      document.getElementById("emailStep").style.display = "none";
      document.getElementById("codeStep").style.display = "block";
      showPopup(
        "Succès",
        "Un code de vérification a été envoyé à votre email",
        "success",
        false
      );
    } else {
      showPopup("Erreur", data.message, "error", false);
    }
  } catch (err) {
    showPopup("Erreur", "Une erreur est survenue", "error", false);
  } finally {
    button.disabled = false;
    button.textContent = "Envoyer";
  }
}

// Fonctions de réinitialisation du mot de passe
function showPasswordResetPopup() {
  if (document.querySelector(".custom-popup")) {
    document.querySelector(".custom-popup").remove();
  }

  const popup = document.createElement("div");
  popup.className = "custom-popup";
  popup.style.display = "flex";
  popup.innerHTML = `
        <div class="popup-content">
            <div class="form-container">
                <div id="emailStep">
                    <h2 class="popup-title">Réinitialisation du mot de passe</h2>
                    <div class="input-container">
                        <box-icon name="envelope" class="input-icon" color="white"></box-icon>
                        <input type="email" id="resetEmail" placeholder="Email" required>
                    </div>
                    <button type="button" class="submit-button" onclick="handleForgotPassword(this)">Envoyer</button>
                </div>
                
                <div id="codeStep" style="display: none;">
                    <h2 class="popup-title">Code de vérification</h2>
                    <p class="popup-message">Veuillez entrer le code reçu par email</p>
                    <div class="input-container">
                        <box-icon name="lock" class="input-icon" color="white"></box-icon>
                        <input type="text" id="verificationCode" placeholder="Code à 6 chiffres" required maxlength="6" pattern="[0-9]*">
                    </div>
                    <button type="button" class="submit-button" onclick="verifyCode()">Vérifier</button>
                </div>

                <div id="newPasswordStep" style="display: none;">
                    <h2 class="popup-title">Nouveau mot de passe</h2>
                    <div class="input-container">
                        <box-icon name="lock" class="input-icon" color="white"></box-icon>
                        <input type="password" id="newPassword" placeholder="Nouveau mot de passe" required>
                        <box-icon name="hide" id="toggleIconNewPass" class="toggle-password" color="white" onclick="toggleNewPassword()"></box-icon>
                    </div>
                    <div class="input-container">
                        <box-icon name="lock" class="input-icon" color="white"></box-icon>
                        <input type="password" id="confirmNewPassword" placeholder="Confirmer le mot de passe" required>
                        <box-icon name="hide" id="toggleIconConfirmPass" class="toggle-password" color="white" onclick="toggleConfirmNewPassword()"></box-icon>
                    </div>
                    <button type="button" class="submit-button" onclick="resetPassword()">Changer le mot de passe</button>
                </div>
            </div>
            <button type="button" class="close-modal" onclick="this.parentElement.parentElement.remove()">
                <box-icon name="x" color="white"></box-icon>
            </button>
        </div>
    `;
  document.body.appendChild(popup);

  const popupContent = popup.querySelector(".popup-content");
  setTimeout(() => {
    popupContent.style.transform = "translateY(0)";
  }, 50);
}

async function verifyCode() {
  const code = document.getElementById("verificationCode").value;
  const email = document.getElementById("resetEmail").value;

  if (!code) {
    showPopup(
      "Erreur",
      "Veuillez entrer le code de vérification",
      "error",
      false
    );
    return;
  }

  if (code.length !== 6) {
    showPopup("Erreur", "Le code doit contenir 6 chiffres", "error", false);
    return;
  }

  try {
    const response = await fetch(
              `${CONFIG.API_BASE_URL}/auth/verify-reset-code`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      document.getElementById("codeStep").style.display = "none";
      document.getElementById("newPasswordStep").style.display = "block";
    } else {
      const input = document.getElementById("verificationCode");
      input.classList.add("error");
      input.value = "";
      showPopup(
        "Code incorrect",
        "Veuillez vérifier le code et réessayer",
        "error",
        false
      );
      setTimeout(() => input.classList.remove("error"), 3000);
    }
  } catch (err) {
    console.error(err);
    showPopup(
      "Erreur",
      "Une erreur est survenue, veuillez réessayer",
      "error",
      false
    );
  }
}

async function resetPassword() {
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmNewPassword").value;
  const email = document.getElementById("resetEmail").value;
  const code = document.getElementById("verificationCode").value;

  if (newPassword !== confirmPassword) {
    showPopup(
      "Erreur",
      "Les mots de passe ne correspondent pas",
      "error",
      false
    );
    return;
  }

  if (newPassword.length < 6) {
    showPopup(
      "Erreur",
      "Le mot de passe doit contenir au moins 6 caractères",
      "error",
      false
    );
    return;
  }

  try {
    const response = await fetch(
              `${CONFIG.API_BASE_URL}/auth/reset-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      document.querySelector(".custom-popup").remove();
      showPopup(
        "Succès",
        "Votre mot de passe a été réinitialisé avec succès",
        "success",
        false
      );
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      showPopup("Erreur", data.message, "error", false);
    }
  } catch (err) {
    showPopup("Erreur", "Une erreur est survenue", "error", false);
  }
}

// Fonctions de gestion des mots de passe
function togglePassword() {
  togglePasswordVisibility("passwordConnexion", "toggleIconConnexion");
}

function togglePasswordInscription() {
  togglePasswordVisibility("passwordInscription", "toggleIconInscription");
}

function toggleConfirmPasswordInscription() {
  togglePasswordVisibility(
    "confirmPasswordInscription",
    "toggleConfirmIconInscription"
  );
}

function toggleNewPassword() {
  togglePasswordVisibility("newPassword", "toggleIconNewPass");
}

function toggleConfirmNewPassword() {
  togglePasswordVisibility("confirmNewPassword", "toggleIconConfirmPass");
}

function togglePasswordVisibility(passwordFieldId, toggleIconId) {
  const passwordField = document.getElementById(passwordFieldId);
  const toggleIcon = document.getElementById(toggleIconId);

  if (!passwordField || !toggleIcon) return;

  const isPassword = passwordField.type === "password";
  passwordField.type = isPassword ? "text" : "password";
  toggleIcon.setAttribute("name", isPassword ? "show" : "hide");

  toggleIcon.style.transform = "scale(1.2)";
  setTimeout(() => {
    toggleIcon.style.transform = "scale(1)";
  }, 200);
}

// Fonction updateHeader simplifiée
async function updateHeader() {
  try {
    const token = AuthUtils.getAuthToken();
    const userName = AuthUtils.getUsername();
    const rightHeader = document.querySelector(".right-header");

    if (!rightHeader) return;

    if (token && userName) {
      rightHeader.innerHTML = `
        <div class="user-profile" onclick="toggleProfileMenu(event)">
          <img src="/img/default-avatar.webp" alt="Avatar" class="header-avatar">
          <span class="header-username">${userName}</span>
          <div class="profile-dropdown" id="profileDropdown">
            <a href="profile.html">Mon Profil</a>
            <a href="#" onclick="logout(); return false;" class="logout-option">Déconnexion</a>
          </div>
        </div>
      `;
    } else {
      rightHeader.innerHTML = `<a href="/login" class="header-link">Connexion</a>`;
    }
  } catch (error) {
    console.error("Erreur dans updateHeader:", error);
  }
}

function toggleProfileMenu(event) {
  event.stopPropagation();
  const dropdown = document.getElementById("profileDropdown");
  if (!dropdown) return;

  dropdown.classList.toggle("show");

  document.addEventListener("click", function closeMenu(e) {
    if (!e.target.closest(".user-profile")) {
      dropdown.classList.remove("show");
      document.removeEventListener("click", closeMenu);
    }
  });
}

function logout(showMessage = true) {
  AuthUtils.clearAuth();
  updateHeaderDisplay();

  if (showMessage) {
    showPopup(
      "Déconnexion réussie",
      "Vous avez été déconnecté avec succès.",
      "success",
      true
    );
  }
}

function resetErrorStyles() {
  document.querySelectorAll(".error-message").forEach(function (message) {
    message.remove();
  });
  document.querySelectorAll(".error").forEach(function (field) {
    field.classList.remove("error");
  });
}
