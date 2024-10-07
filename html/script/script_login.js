$(document).ready(function() {
    updateHeader();

    $('#inscriptionForm').on('submit', handleInscriptionSubmit);
    $('#connexionForm').on('submit', handleConnexionSubmit);
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
    alert('Vous avez été déconnecté.');

    window.location.href = 'accueil.html';
}

function handleInscriptionSubmit(event) {
    event.preventDefault();

    const firstName = document.getElementById('prenom').value;
    const lastName = document.getElementById('nom').value;
    const email = document.getElementById('emailInscription').value;
    const password = document.getElementById('passwordInscription').value;
    const confirmPassword = document.getElementById('confirmPasswordInscription').value;

    if (password !== confirmPassword) {
        alert('Les mots de passe ne correspondent pas.');
        return;
    }

    const users = JSON.parse(localStorage.getItem('users')) || [];
    
    const userExists = users.some(user => user.email === email);
    if (userExists) {
        alert('Cet email est déjà utilisé.');
        return;
    }

    const newUser = { firstName, lastName, email, password };
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('userFirstName', firstName);

    alert('Inscription réussie ! Vous êtes maintenant connecté.');
    updateHeader();

    setTimeout(function() {
        window.location.href = 'accueil.html';
    }, 10);
}

function handleConnexionSubmit(event) {
    event.preventDefault();
    
    // Réinitialise les messages d'erreur et les styles
    resetErrorStyles();

    const email = document.getElementById('emailConnexion').value;
    const password = document.getElementById('passwordConnexion').value;

    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(user => user.email === email);

    if (!user) {
        showError('emailConnexion', 'Email invalide.');
        return;
    } else if (user.password !== password) {
        showError('passwordConnexion', 'Mot de passe incorrect.');
        return;
    } else {
        localStorage.setItem('userFirstName', user.firstName);
        alert('Connexion réussie !');
        updateHeader();
        
        setTimeout(function() {
            window.location.href = 'accueil.html';
        }, 10);
    }
}

function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorField = document.createElement('div');
    
    errorField.className = 'error-message';
    errorField.innerText = message;

    field.classList.add('error'); 
    field.parentNode.appendChild(errorField); 
}

function resetErrorStyles() {
    document.querySelectorAll('.error-message').forEach(function(message) {
        message.remove();
    });

    document.querySelectorAll('.error').forEach(function(field) {
        field.classList.remove('error');
    });
}