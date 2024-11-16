const API_URL = 'http://localhost:3000/api';
let userStats = null;
let notificationTimeout;

document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('userToken')) {
        window.location.href = 'login.html';
        return;
    }

    await loadUserProfile();
    setupEventListeners();
    initializeTabs();
    await loadUserStats();
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

async function handleAvatarChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        showNotification('L\'image ne doit pas dépasser 2MB', 'error');
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

        const formData = new FormData();
        formData.append('avatar', file);

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
        if (data.avatarUrl) {
            avatar.src = data.avatarUrl;
            
            // Mettre à jour aussi l'avatar dans le header
            const headerAvatar = document.querySelector('.header-avatar');
            if (headerAvatar) {
                headerAvatar.src = data.avatarUrl;
            }
        }
        
        avatar.style.opacity = '1';
        showNotification('Photo de profil mise à jour avec succès');

    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la mise à jour de l\'avatar', 'error');
        document.getElementById('profileAvatar').style.opacity = '1';
    }
}

async function loadUserProfile() {
    try {
        const token = localStorage.getItem('userToken');
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

async function loadUserStats() {
    try {
        const token = localStorage.getItem('userToken');
        console.log('Token:', token); // Vérifier le token

        const response = await fetch(`${API_URL}/user/stats/details`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response status:', response.status); // Vérifier le statut de la réponse

        if (!response.ok) throw new Error('Erreur de chargement des statistiques');

        const statsData = await response.json();
        console.log('Données reçues de l\'API (complètes):', statsData);
        console.log('Stats actuelles:', statsData.currentStats); // Vérifier les stats

        displayStats(statsData.currentStats);
    } catch (error) {
        console.error('Erreur complète:', error);
        showNotification('Erreur lors du chargement des statistiques', 'error');
    }
}

async function displayUserData(userData) {
    document.getElementById('username').textContent = userData.username;
    document.getElementById('editUsername').value = userData.username;
    document.getElementById('editEmail').value = userData.email || '';
    
    // Gestion de l'avatar
    const profileAvatar = document.getElementById('profileAvatar');
    if (userData.avatarUrl) {
        profileAvatar.src = userData.avatarUrl;
        
        // Mettre à jour aussi l'avatar dans le header si présent
        const headerAvatar = document.querySelector('.header-avatar');
        if (headerAvatar) {
            headerAvatar.src = userData.avatarUrl;
        }
    } else {
        profileAvatar.src = '/img/default-avatar.webp';
    }

    if (userData.createdAt) {
        const joinDate = new Date(userData.createdAt).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('joinDate').textContent = joinDate;
    } else {
        document.getElementById('joinDate').textContent = 'Date inconnue';
    }
}

function displayStats(stats) {
    document.getElementById('gamesPlayed').textContent = stats.gamesPlayed || 0;
    document.getElementById('bestScore').textContent = stats.bestScore || 0;
    document.getElementById('averageScore').textContent = Math.round(stats.averageScore || 0);

    const modes = [
        { id: 'france', name: 'France', icon: '🇫🇷' },
        { id: 'mondial', name: 'Mondial', icon: '🌍' },
        { id: 'disneyland', name: 'Disneyland', icon: '🎡' },
        { id: 'nevers', name: 'Nevers', icon: '🏛️' },
        { id: 'versaille', name: 'Versailles', icon: '👑' },
        { id: 'dark', name: 'Dark Mode', icon: '🌙' }
    ];

    modes.forEach(mode => {
        const modeKey = `${mode.id}Mode`;
        const modeStats = stats[modeKey] || { gamesPlayed: 0, averageScore: 0, bestScore: 0 };

        const modeElement = document.getElementById(`${mode.id}ModeGames`);
        const avgElement = document.getElementById(`${mode.id}ModeAvg`);
        const topElement = document.getElementById(`${mode.id}ModeTop`);

        if (modeElement) modeElement.textContent = modeStats.gamesPlayed;
        if (avgElement) avgElement.textContent = Math.round(modeStats.averageScore || 0);
        if (topElement) topElement.textContent = modeStats.bestScore;
    });

    if (stats.recentGames) {
        displayRecentGames(stats.recentGames);
    }
}

function displayRecentGames(recentGames) {
    const container = document.getElementById('recentGames');
    if (!container) return;
    
    container.innerHTML = '';

    const modeIcons = {
        france: '🇫🇷',
        mondial: '🌍',
        disneyland: '🎡',
        nevers: '🏛️',
        versaille: '👑',
        dark: '🌙'
    };

    if (!recentGames || recentGames.length === 0) {
        container.innerHTML = '<div class="no-games">Aucune partie récente</div>';
        return;
    }

    recentGames.forEach(game => {
        const gameElement = document.createElement('div');
        gameElement.className = 'game-entry';
        
        // On crée une copie du nom du mode pour pouvoir le modifier
        let modeName = game.mode;
        if (modeName === 'dark') {
            modeName = 'Dark Mode';
        } else {
            modeName = modeName.charAt(0).toUpperCase() + modeName.slice(1);
        }
        
        gameElement.innerHTML = `
            <div class="game-info">
                <span class="mode-icon">${modeIcons[game.mode] || '🎮'}</span>
                <strong>${modeName}</strong>
                <span>${new Date(game.date).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                })}</span>
            </div>
            <div class="game-score">
                <span>${game.score} points</span>
            </div>
        `;
        
        container.appendChild(gameElement);
    });
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

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur de mise à jour');
        }

        const data = await response.json();
        localStorage.setItem('userFirstName', data.username);
        showNotification('Profil mis à jour avec succès');
        
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        
        await loadUserProfile();
    } catch (error) {
        showNotification(error.message || 'Erreur lors de la mise à jour du profil', 'error');
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