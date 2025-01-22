document.addEventListener('DOMContentLoaded', function() {
    console.log("Initialisation de la page de login");
    updateHeader();
    
    if (window.location.pathname.includes('login.html')) {
        const inscriptionForm = document.getElementById('inscriptionForm');
        const connexionForm = document.getElementById('connexionForm');
        const forgotPasswordLink = document.querySelector('.forgot-password');
        
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPasswordResetPopup();
            });
        }
        
        if (inscriptionForm) {
            inscriptionForm.addEventListener('submit', handleInscriptionSubmit);
            fadeInForm(inscriptionForm, false);
        }
        if (connexionForm) {
            connexionForm.addEventListener('submit', handleConnexionSubmit);
            fadeInForm(connexionForm, true);
        }
    }
});

// Fonctions de gestion des formulaires
function fadeInForm(form, show) {
    if (show) {
        form.style.display = 'flex';
        form.style.opacity = '0';
        setTimeout(() => {
            form.style.opacity = '1';
        }, 50);
    } else {
        form.style.opacity = '0';
        form.style.display = 'none';
    }
}

function switchTab(tab) {
    const inscriptionForm = document.getElementById('inscriptionForm');
    const connexionForm = document.getElementById('connexionForm');
    const tabSlider = document.querySelector('.tab-slider');
    
    if (tab === 'connexion') {
        fadeInForm(inscriptionForm, false);
        fadeInForm(connexionForm, true);
        tabSlider.style.left = '0';
    } else {
        fadeInForm(connexionForm, false);
        fadeInForm(inscriptionForm, true);
        tabSlider.style.left = '50%';
    }
}

// Fonctions de popup
function showPopup(title, message, type = 'success', redirect = false) {
    let popup = document.getElementById('customPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'customPopup';
        popup.className = 'custom-popup';
        document.body.appendChild(popup);
        
        popup.innerHTML = `
            <div class="popup-content">
                <box-icon id="popupIcon" class="popup-icon"></box-icon>
                <h2 id="popupTitle" class="popup-title"></h2>
                <p id="popupMessage" class="popup-message"></p>
            </div>
        `;
    }

    const popupContent = popup.querySelector('.popup-content');
    const popupIcon = document.getElementById('popupIcon');

    document.getElementById('popupTitle').innerText = title;
    document.getElementById('popupMessage').innerText = message;

    if (type === 'error') {
        popupIcon.setAttribute('name', 'x-circle');
        popupIcon.classList.remove('success');
        popupIcon.setAttribute('color', '#e74c3c');
        popupIcon.classList.add('error');
    } else {
        popupIcon.setAttribute('name', 'check-circle');
        popupIcon.classList.remove('error');
        popupIcon.setAttribute('color', '#4CAF50');
        popupIcon.classList.add('success');
    }

    popup.style.display = 'flex';
    popup.style.opacity = '0';
    
    setTimeout(() => {
        popup.style.opacity = '1';
        popupContent.style.transform = 'translateY(0)';
    }, 50);

    const timeout = type === 'error' ? 3000 : 2000;

    setTimeout(() => {
        closePopup();
        if (redirect && type === 'success') {
            window.location.href = 'accueil.html';
        }
    }, timeout);
}

function closePopup() {
    const popup = document.getElementById('customPopup');
    if (!popup) return;

    const popupContent = popup.querySelector('.popup-content');
    if (!popupContent) return;

    popup.style.opacity = '0';
    popupContent.style.transform = 'translateY(-20px)';
    setTimeout(() => {
        popup.style.display = 'none';
    }, 300);
}

// Fonctions d'authentification
async function handleInscriptionSubmit(event) {
    event.preventDefault();
    
    const username = document.getElementById('usernameInscription').value;
    const email = document.getElementById('emailInscription').value;
    const password = document.getElementById('passwordInscription').value;
    const confirmPassword = document.getElementById('confirmPasswordInscription').value;

    if (password !== confirmPassword) {
        showPopup('Erreur', 'Les mots de passe ne correspondent pas.', 'error', false);
        return;
    }

    if (password.length < 6) {
        showPopup('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.', 'error', false);
        return;
    }

    try {
        console.log("Tentative d'inscription...");
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showPopup('Erreur', data.message, 'error', false);
            return;
        }

        console.log("Inscription réussie, stockage des données");
        AuthUtils.storeAuth(data, false);
        sessionStorage.setItem('isNewUser', 'true');
        
        await updateHeader();
        showPopup('Bienvenue !', 'Inscription réussie !', 'success', true);
        
        setTimeout(() => {
            window.location.href = 'accueil.html';
        }, 2000);

    } catch (err) {
        console.error('Erreur inscription:', err);
        showPopup('Erreur', 'Une erreur est survenue lors de l\'inscription.', 'error', false);
    }
}

async function handleConnexionSubmit(event) {
    event.preventDefault();
    resetErrorStyles();
    const username = document.getElementById('usernameConnexion').value;
    const password = document.getElementById('passwordConnexion').value;
    const rememberMe = document.getElementById('remember').checked;

    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, rememberMe })
        });

        const data = await response.json();

        if (!response.ok) {
            showPopup('Erreur', data.message || 'Identifiants invalides', 'error', false);
            return;
        }

        AuthUtils.clearAuth(); // Nettoie les deux storages
        AuthUtils.storeAuth(data, rememberMe); // Stock dans le bon storage

        // Debug pour vérification
        console.log("Stockage des données dans:", rememberMe ? "localStorage" : "sessionStorage");
        console.log("Token dans sessionStorage:", sessionStorage.getItem('userToken'));
        console.log("Token dans localStorage:", localStorage.getItem('userToken'));

        await updateHeader();
        showPopup('Succès', 'Connexion réussie !', 'success', true);
        
    } catch (err) {
        console.error('Erreur de connexion:', err);
        showPopup('Erreur', 'Une erreur est survenue lors de la connexion.', 'error', false);
    }
}

// Fonctions de réinitialisation du mot de passe
function showPasswordResetPopup() {
    if (document.querySelector('.custom-popup')) {
        document.querySelector('.custom-popup').remove();
    }

    const popup = document.createElement('div');
    popup.className = 'custom-popup';
    popup.style.display = 'flex';
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

    const popupContent = popup.querySelector('.popup-content');
    setTimeout(() => {
        popupContent.style.transform = 'translateY(0)';
    }, 50);
}

async function handleForgotPassword(button) {
    const email = document.getElementById('resetEmail').value;
    if (!email) {
        showPopup('Erreur', 'Veuillez entrer votre email', 'error', false);
        return;
    }

    button.disabled = true;
    button.textContent = 'Envoi...';

    try {
        const response = await fetch('http://localhost:3000/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('emailStep').style.display = 'none';
            document.getElementById('codeStep').style.display = 'block';
            showPopup('Succès', 'Un code de vérification a été envoyé à votre email', 'success', false);
        } else {
            showPopup('Erreur', data.message, 'error', false);
        }
    } catch (err) {
        showPopup('Erreur', 'Une erreur est survenue', 'error', false);
    } finally {
        button.disabled = false;
        button.textContent = 'Envoyer';
    }
}

async function verifyCode() {
    const code = document.getElementById('verificationCode').value;
    const email = document.getElementById('resetEmail').value;

    if (!code) {
        showPopup('Erreur', 'Veuillez entrer le code de vérification', 'error', false);
        return;
    }

    if (code.length !== 6) {
        showPopup('Erreur', 'Le code doit contenir 6 chiffres', 'error', false);
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/auth/verify-reset-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('codeStep').style.display = 'none';
            document.getElementById('newPasswordStep').style.display = 'block';
        } else {
            const input = document.getElementById('verificationCode');
            input.classList.add('error');
            input.value = '';
            showPopup('Code incorrect', 'Veuillez vérifier le code et réessayer', 'error', false);
            setTimeout(() => input.classList.remove('error'), 3000);
        }
    } catch (err) {
        console.error(err);
        showPopup('Erreur', 'Une erreur est survenue, veuillez réessayer', 'error', false);
    }
}

async function resetPassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    const email = document.getElementById('resetEmail').value;
    const code = document.getElementById('verificationCode').value;

    if (newPassword !== confirmPassword) {
        showPopup('Erreur', 'Les mots de passe ne correspondent pas', 'error', false);
        return;
    }

    if (newPassword.length < 6) {
        showPopup('Erreur', 'Le mot de passe doit contenir au moins 6 caractères', 'error', false);
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            document.querySelector('.custom-popup').remove();
            showPopup('Succès', 'Votre mot de passe a été réinitialisé avec succès', 'success', false);
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            showPopup('Erreur', data.message, 'error', false);
        }
    } catch (err) {
        showPopup('Erreur', 'Une erreur est survenue', 'error', false);
    }
}

// Fonctions de gestion des mots de passe
function togglePassword() {
    togglePasswordVisibility('passwordConnexion', 'toggleIconConnexion');
}

function togglePasswordInscription() {
    togglePasswordVisibility('passwordInscription', 'toggleIconInscription');
}

function toggleConfirmPasswordInscription() {
    togglePasswordVisibility('confirmPasswordInscription', 'toggleConfirmIconInscription');
}

function toggleNewPassword() {
    togglePasswordVisibility('newPassword', 'toggleIconNewPass');
}

function toggleConfirmNewPassword() {
    togglePasswordVisibility('confirmNewPassword', 'toggleIconConfirmPass');
}

function togglePasswordVisibility(passwordFieldId, toggleIconId) {
    const passwordField = document.getElementById(passwordFieldId);
    const toggleIcon = document.getElementById(toggleIconId);
    
    if (!passwordField || !toggleIcon) return;
    
    const isPassword = passwordField.type === "password";
    passwordField.type = isPassword ? "text" : "password";
    toggleIcon.setAttribute('name', isPassword ? 'show' : 'hide');
    
    toggleIcon.style.transform = 'scale(1.2)';
    setTimeout(() => {
        toggleIcon.style.transform = 'scale(1)';
    }, 200);
}

// Fonctions de gestion du header et du profil
async function updateHeader() {
    try {
        const token = AuthUtils.getAuthToken();
        const userName = AuthUtils.getUsername();
        const rightHeader = document.querySelector('.right-header');

        if (!rightHeader) return;

        if (token && userName) {
            try {
                const response = await fetch('http://localhost:3000/api/user/profile', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Token invalide');
                }

                const userData = await response.json();
                
                // Mettre à jour le stockage si le nom a changé
                if (userData.username !== userName) {
                    if (localStorage.getItem('userToken')) {
                        localStorage.setItem('userFirstName', userData.username);
                    }
                    if (sessionStorage.getItem('userToken')) {
                        sessionStorage.setItem('userFirstName', userData.username);
                    }
                }

                rightHeader.innerHTML = `
                    <div class="user-profile" onclick="toggleProfileMenu(event)">
                        <img src="${userData.avatarUrl || '/img/default-avatar.webp'}" alt="Avatar" class="header-avatar">
                        <span class="header-username">${userData.username}</span>
                        <div class="profile-dropdown" id="profileDropdown">
                            <a href="profile.html">Mon Profil</a>
                            <a href="#" onclick="logout(); return false;" class="logout-option">Déconnexion</a>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('Erreur de vérification:', error);
                AuthUtils.clearAuth();
                rightHeader.innerHTML = `<a href="login.html" class="header-link">Connexion</a>`;
            }
        } else {
            rightHeader.innerHTML = `<a href="login.html" class="header-link">Connexion</a>`;
        }
    } catch (error) {
        console.error('Erreur dans updateHeader:', error);
    }
}

function toggleProfileMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('profileDropdown');
    if (!dropdown) return;
    
    dropdown.classList.toggle('show');

    document.addEventListener('click', function closeMenu(e) {
        if (!e.target.closest('.user-profile')) {
            dropdown.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        }
    });
}

function logout(showMessage = true) {
    AuthUtils.clearAuth();
    updateHeader();
    
    if (showMessage) {
        showPopup('Déconnexion réussie', 'Vous avez été déconnecté avec succès.', 'success', true);
    }
}

function resetErrorStyles() {
    document.querySelectorAll('.error-message').forEach(function(message) {
        message.remove();
    });
    document.querySelectorAll('.error').forEach(function(field) {
        field.classList.remove('error');
    });
}