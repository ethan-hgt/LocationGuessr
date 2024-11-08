document.addEventListener('DOMContentLoaded', function() {
    // Toujours mettre à jour le header
    updateHeader();
    
    // Vérifier si on est sur la page de login
    if (window.location.pathname.includes('login.html')) {
        const inscriptionForm = document.getElementById('inscriptionForm');
        const connexionForm = document.getElementById('connexionForm');
        
        if (inscriptionForm) {
            inscriptionForm.addEventListener('submit', handleInscriptionSubmit);
        }
        if (connexionForm) {
            connexionForm.addEventListener('submit', handleConnexionSubmit);
        }
    }
});

function switchTab(tab) {
    const inscriptionForm = document.getElementById('inscriptionForm');
    const connexionForm = document.getElementById('connexionForm');
    const tabSlider = document.querySelector('.tab-slider');
    
    if (tab === 'connexion') {
        inscriptionForm.style.display = 'none';
        connexionForm.style.display = 'flex';
        tabSlider.style.left = '0';
    } else {
        inscriptionForm.style.display = 'flex';
        connexionForm.style.display = 'none';
        tabSlider.style.left = '50%';
    }
}

function showPopup(title, message, type = 'success', redirect = true, redirectUrl = 'accueil.html') {
    const popup = document.getElementById('customPopup');
    const popupIcon = document.getElementById('popupIcon');

    if (!popup || !popupIcon) return;

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

    popup.classList.add('show');

    const timeout = type === 'error' ? 2000 : 1500;

    if (redirect && type !== 'error') {
        setTimeout(() => {
            closePopup();
            window.location.href = redirectUrl;
        }, timeout);
    } else {
        setTimeout(() => {
            closePopup();
        }, timeout);
    }
}

function closePopup() {
    const popup = document.getElementById('customPopup');
    if (popup) {
        popup.classList.remove('show');
    }
}

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

        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userFirstName', data.user.username);
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('isNewUser', 'true');
        
        showPopup('Bienvenue !', 'Inscription réussie ! Configurons votre profil...', 'success', true, 'profile.html');
        updateHeader();
    } catch (err) {
        console.error(err);
        showPopup('Erreur', 'Une erreur est survenue lors de l\'inscription.', 'error', false);
    }
}

async function handleConnexionSubmit(event) {
    event.preventDefault();
    resetErrorStyles();
    const username = document.getElementById('usernameConnexion').value;
    const password = document.getElementById('passwordConnexion').value;

    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showPopup('Erreur', data.message || 'Identifiants invalides', 'error', false);
            return;
        }

        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userFirstName', data.user.username);
        localStorage.setItem('userId', data.user.id);
        
        showPopup('Succès', 'Connexion réussie !');
        updateHeader();
    } catch (err) {
        console.error(err);
        showPopup('Erreur', 'Une erreur est survenue lors de la connexion.', 'error', false);
    }
}

async function updateHeader() {
    const userToken = localStorage.getItem('userToken');
    const userName = localStorage.getItem('userFirstName');
    const rightHeader = document.querySelector('.right-header');

    if (userToken && userName) {
        try {
            const response = await fetch('http://localhost:3000/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                const avatarUrl = userData.avatarUrl || '/img/default-avatar.webp';
                
                rightHeader.innerHTML = `
                    <div class="user-profile" onclick="toggleProfileMenu(event)">
                        <img src="${avatarUrl}" alt="Avatar" class="header-avatar">
                        <span class="header-username">${userName}</span>
                        <div class="profile-dropdown" id="profileDropdown">
                            <a href="profile.html">Mon Profil</a>
                            <a href="#" onclick="logout(); return false;" class="logout-option">Déconnexion</a>
                        </div>
                    </div>
                `;
            } else {
                logout(false);
            }
        } catch (err) {
            console.error(err);
            logout(false);
        }
    } else {
        rightHeader.innerHTML = `<a href="login.html" class="header-link">Connexion</a>`;
    }
}

function toggleProfileMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('profileDropdown');
    dropdown.classList.toggle('show');

    document.addEventListener('click', function closeMenu(e) {
        if (!e.target.closest('.user-profile')) {
            dropdown.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        }
    });
}

function logout(showMessage = true) {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userId');
    updateHeader();
    
    if (showMessage) {
        showPopup('Déconnexion réussie', 'Vous avez été déconnecté avec succès.', 'success', false);
        setTimeout(() => {
            window.location.href = 'accueil.html';
        }, 1500);
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

function togglePassword() {
    togglePasswordVisibility('passwordConnexion', 'toggleIconConnexion');
}

function togglePasswordInscription() {
    togglePasswordVisibility('passwordInscription', 'toggleIconInscription');
}

function toggleConfirmPasswordInscription() {
    togglePasswordVisibility('confirmPasswordInscription', 'toggleConfirmIconInscription');
}

function togglePasswordVisibility(passwordFieldId, toggleIconId) {
    const passwordField = document.getElementById(passwordFieldId);
    const toggleIcon = document.getElementById(toggleIconId);
    if (passwordField.type === "password") {
        passwordField.type = "text";
        toggleIcon.setAttribute('name', 'show');
    } else {
        passwordField.type = "password";
        toggleIcon.setAttribute('name', 'hide');
    }
}