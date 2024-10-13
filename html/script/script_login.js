$(document).ready(function() {
    updateHeader();
    $('#inscriptionForm').on('submit', handleInscriptionSubmit);
    $('#connexionForm').on('submit', handleConnexionSubmit);
});

function showPopup(title, message, type = 'success', redirect = true) {
    const popup = document.getElementById('customPopup');
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

    popup.classList.add('show');

    const timeout = type === 'error' ? 2000 : 1500;

    if (redirect && type !== 'error') {
        setTimeout(() => {
            closePopup();
            window.location.href = 'accueil.html';
        }, timeout);
    } else {
        setTimeout(() => {
            closePopup();
        }, timeout);
    }
}

function closePopup() {
    const popup = document.getElementById('customPopup');
    popup.classList.remove('show');
}

function handleInscriptionSubmit(event) {
    event.preventDefault();
    const username = document.getElementById('usernameInscription').value;
    const email = document.getElementById('emailInscription').value;
    const password = document.getElementById('passwordInscription').value;
    const confirmPassword = document.getElementById('confirmPasswordInscription').value;

    if (password !== confirmPassword) {
        showPopup('Erreur', 'Les mots de passe ne correspondent pas.', 'error', false);
        return;
    }

    const users = JSON.parse(localStorage.getItem('users')) || [];
    const userExists = users.some(user => user.email === email || user.username === username);
    if (userExists) {
        showPopup('Erreur', 'Cet email ou nom d\'utilisateur est déjà utilisé.', 'error', false);
        return;
    }

    const newUser = { username, email, password };
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('userFirstName', username);
    showPopup('Succès', 'Inscription réussie ! Vous êtes maintenant connecté.');
    updateHeader();
}

function handleConnexionSubmit(event) {
    event.preventDefault();
    resetErrorStyles();
    const username = document.getElementById('usernameConnexion').value;
    const password = document.getElementById('passwordConnexion').value;

    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(user => user.username === username);

    if (!user) {
        showPopup('Erreur', 'Nom d\'utilisateur invalide.', 'error', false);
        return;
    } else if (user.password !== password) {
        showPopup('Erreur', 'Mot de passe incorrect.', 'error', false);
        return;
    } else {
        localStorage.setItem('userFirstName', user.username);
        showPopup('Succès', 'Connexion réussie !');
        updateHeader();
    }
}

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

function updateHeader() {
    const userName = localStorage.getItem('userFirstName');
    const rightHeader = document.querySelector('.right-header');
    if (userName) {
        rightHeader.innerHTML = `<span>${userName} (<a href="#" class="logout-link" onclick="logout(); return false;">Déconnexion</a>)</span>`;
    } else {
        rightHeader.innerHTML = `<a href="login.html" class="header-link">Connexion</a>`;
    }
}

function logout() {
    localStorage.removeItem('userFirstName');
    updateHeader();
    
    showPopup('Déconnexion réussie', 'Vous avez été déconnecté avec succès.', 'success', false);

    setTimeout(() => {
        window.location.href = 'accueil.html';
    }, 1500);
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