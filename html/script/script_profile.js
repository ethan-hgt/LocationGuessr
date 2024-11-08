const API_URL = 'http://localhost:3000/api';
let userStats = null;
let notificationTimeout;

document.addEventListener('DOMContentLoaded', async () => {
    const isNewUser = localStorage.getItem('isNewUser');
    if (isNewUser) {
        showWelcomeMessage();
        localStorage.removeItem('isNewUser');
    }

    if (!localStorage.getItem('userToken')) {
        window.location.href = 'login.html';
        return;
    }

    await loadUserProfile();
    setupEventListeners();
    initializeTabs();
    loadUserStats();
});

function setupEventListeners() {
    document.querySelector('.avatar-overlay').addEventListener('click', () => {
        document.getElementById('avatarInput').click();
    });
    
    document.getElementById('avatarInput').addEventListener('change', handleAvatarChange);
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);

    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', togglePasswordVisibility);
    });
}

function initializeTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            switchTab(target);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`${tabId}-content`).classList.add('active');
}

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const MAX_SIZE = 200;
                if (width > height && width > MAX_SIZE) {
                    height = height * (MAX_SIZE / width);
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width = width * (MAX_SIZE / height);
                    height = MAX_SIZE;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], 'avatar.webp', {
                        type: 'image/webp'
                    }));
                }, 'image/webp', 0.8);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function handleAvatarChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
        showNotification('L\'image ne doit pas dépasser 500KB', 'error');
        return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showNotification('Format accepté : JPG, PNG ou WebP uniquement', 'error');
        return;
    }

    try {
        const avatar = document.getElementById('profileAvatar');
        avatar.style.opacity = '0.5';
        showNotification('Traitement de l\'image...', 'info');

        const compressedImage = await compressImage(file);
        const formData = new FormData();
        formData.append('avatar', compressedImage);

        const token = localStorage.getItem('userToken');
        const response = await fetch(`${API_URL}/user/avatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) throw new Error('Erreur lors du téléchargement');

        const data = await response.json();
        avatar.src = data.avatarUrl;
        avatar.style.opacity = '1';
        
        showNotification('Photo de profil mise à jour avec succès');
        
        const headerAvatar = document.querySelector('.header-avatar');
        if (headerAvatar) {
            headerAvatar.src = data.avatarUrl;
        }
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la mise à jour de l\'avatar', 'error');
        document.getElementById('profileAvatar').style.opacity = '1';
    }
}

async function loadUserProfile() {
    try {
        const token = localStorage.getItem('userToken');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        const response = await fetch(`${API_URL}/user/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Erreur de chargement du profil');

        const userData = await response.json();
        displayUserData(userData);
    } catch (error) {
        showNotification('Erreur lors du chargement du profil', 'error');
    }
}

function displayUserData(userData) {
    document.getElementById('username').textContent = userData.username;
    document.getElementById('editUsername').value = userData.username;
    document.getElementById('editEmail').value = userData.email;
    
    if (userData.avatarUrl) {
        document.getElementById('profileAvatar').src = userData.avatarUrl;
    }

    const joinDate = new Date(userData.createdAt).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('joinDate').textContent = joinDate;
}

async function handleProfileUpdate(event) {
    event.preventDefault();
    
    const formData = {
        username: document.getElementById('editUsername').value,
        email: document.getElementById('editEmail').value
    };

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    if (currentPassword && newPassword) {
        formData.currentPassword = currentPassword;
        formData.newPassword = newPassword;
    }

    try {
        const token = localStorage.getItem('userToken');
        const response = await fetch(`${API_URL}/user/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Erreur de mise à jour');

        const data = await response.json();
        localStorage.setItem('userFirstName', data.username);
        showNotification('Profil mis à jour avec succès');
        
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        
        await loadUserProfile();
    } catch (error) {
        showNotification('Erreur lors de la mise à jour du profil', 'error');
    }
}

async function loadUserStats() {
    try {
        const token = localStorage.getItem('userToken');
        const response = await fetch(`${API_URL}/user/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Erreur de chargement des statistiques');

        const stats = await response.json();
        displayStats(stats);
    } catch (error) {
        showNotification('Erreur lors du chargement des statistiques', 'error');
    }
}

function displayStats(stats) {
    document.getElementById('gamesPlayed').textContent = stats.totalGames || 0;
    document.getElementById('bestScore').textContent = stats.bestScore || 0;
    document.getElementById('averageScore').textContent = Math.round(stats.averageScore || 0);

    if (stats.franceMode) {
        document.getElementById('franceModeGames').textContent = stats.franceMode.gamesPlayed || 0;
        document.getElementById('franceModeAvg').textContent = Math.round(stats.franceMode.averageScore || 0);
        document.getElementById('franceModeTop').textContent = stats.franceMode.bestScore || 0;
    }

    if (stats.worldMode) {
        document.getElementById('worldModeGames').textContent = stats.worldMode.gamesPlayed || 0;
        document.getElementById('worldModeAvg').textContent = Math.round(stats.worldMode.averageScore || 0);
        document.getElementById('worldModeTop').textContent = stats.worldMode.bestScore || 0;
    }

    const recentGamesContainer = document.getElementById('recentGames');
    recentGamesContainer.innerHTML = '';

    if (stats.recentGames && stats.recentGames.length > 0) {
        stats.recentGames.forEach(game => {
            const modeEmoji = game.mode === 'france' ? '🇫🇷' : '🌎';
            const gameElement = document.createElement('div');
            gameElement.className = 'game-entry';
            gameElement.innerHTML = `
                <div class="game-info">
                    <strong>${modeEmoji} ${game.mode.charAt(0).toUpperCase() + game.mode.slice(1)}</strong>
                    <span>${new Date(game.date).toLocaleDateString()}</span>
                </div>
                <div class="game-score">
                    <span>${game.score} points</span>
                </div>
            `;
            recentGamesContainer.appendChild(gameElement);
        });
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notificationMessage');
    
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    messageEl.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');

    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function showWelcomeMessage() {
    const userName = localStorage.getItem('userFirstName');
    
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-banner';
    welcomeDiv.innerHTML = `
        <div class="welcome-content">
            <h2>Bienvenue ${userName} ! 👋</h2>
            <p>C'est le moment de personnaliser votre profil :</p>
            <ul>
                <li>Ajoutez une photo de profil</li>
                <li>Complétez vos informations</li>
            </ul>
        </div>
    `;

    document.querySelector('.profile-container').insertBefore(
        welcomeDiv,
        document.querySelector('.profile-card')
    );

    setTimeout(() => {
        welcomeDiv.style.opacity = '0';
        setTimeout(() => welcomeDiv.remove(), 500);
    }, 5000);
}

function togglePasswordVisibility(event) {
    const icon = event.target;
    const input = icon.parentElement.querySelector('input');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bx-hide');
        icon.classList.add('bx-show');
    } else {
        input.type = 'password';
        icon.classList.remove('bx-show');
        icon.classList.add('bx-hide');
    }
}

function logout() {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userFirstName');
    window.location.href = 'login.html';
}