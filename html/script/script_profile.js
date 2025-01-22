const API_URL = 'http://localhost:3000/api';
let userStats = null;
let notificationTimeout;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Début chargement profil");
        await updateHeader();
        
        const token = AuthUtils.getAuthToken();
        if (!token) {
            console.log("Pas de token, redirection vers login");
            window.location.href = 'login.html';
            return;
        }

        console.log("Token trouvé, vérification nouvel utilisateur");
        const isNewUser = sessionStorage.getItem('isNewUser') || localStorage.getItem('isNewUser');
        if (isNewUser) {
            showNotification('Bienvenue sur votre profil !', 'success');
            sessionStorage.removeItem('isNewUser');
            localStorage.removeItem('isNewUser');
        }

        console.log("Chargement des données utilisateur");
        await Promise.all([
            loadUserProfile(),
            loadUserStats()
        ]);
        
        setupEventListeners();
        initializeTabs();

    } catch (error) {
        console.error("Erreur lors de l'initialisation:", error);
        showNotification('Erreur lors du chargement du profil', 'error');
    }
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
        const token = AuthUtils.getAuthToken();
        console.log("Chargement profil - token présent:", !!token);

        const response = await fetch(`${API_URL}/user/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error("Erreur API:", response.status);
            throw new Error('Erreur de chargement du profil');
        }

        const userData = await response.json();
        console.log("Données utilisateur reçues");
        await displayUserData(userData);

    } catch (error) {
        console.error("Erreur loadUserProfile:", error);
        showNotification('Erreur lors du chargement du profil', 'error');
    }
}

async function loadUserStats() {
    try {
        const token = AuthUtils.getAuthToken();
        console.log("Chargement stats - token présent:", !!token);

        const response = await fetch(`${API_URL}/user/stats/details`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Erreur de chargement des statistiques');
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
        showNotification('Erreur lors du chargement des statistiques', 'error');
    }
}

function displayUserData(userData) {
    try {
        const elements = {
            username: document.getElementById('username'),
            editUsername: document.getElementById('editUsername'),
            editEmail: document.getElementById('editEmail'),
            profileAvatar: document.getElementById('profileAvatar'),
            joinDate: document.getElementById('joinDate')
        };

        // Vérifier que tous les éléments existent
        Object.entries(elements).forEach(([key, element]) => {
            if (!element) {
                console.error(`Élément manquant: ${key}`);
            }
        });

        if (elements.username) elements.username.textContent = userData.username;
        if (elements.editUsername) elements.editUsername.value = userData.username;
        if (elements.editEmail) elements.editEmail.value = userData.email || '';

        // Gestion de l'avatar
        if (elements.profileAvatar) {
            elements.profileAvatar.src = userData.avatarUrl || '/img/default-avatar.webp';
            
            // Mettre à jour l'avatar du header si présent
            const headerAvatar = document.querySelector('.header-avatar');
            if (headerAvatar) {
                headerAvatar.src = userData.avatarUrl || '/img/default-avatar.webp';
            }
        }

        // Gestion de la date d'inscription
        if (elements.joinDate) {
            if (userData.createdAt) {
                const joinDate = new Date(userData.createdAt).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                elements.joinDate.textContent = joinDate;
            } else {
                elements.joinDate.textContent = 'Date inconnue';
            }
        }
    } catch (error) {
        console.error('Erreur dans displayUserData:', error);
    }
}

function displayStats(stats) {
    try {
        // Vérifier si les stats sont définies
        if (!stats) {
            console.error('Stats non définies');
            return;
        }

        // Mettre à jour les statistiques globales
        const elements = {
            gamesPlayed: document.getElementById('gamesPlayed'),
            bestScore: document.getElementById('bestScore'),
            averageScore: document.getElementById('averageScore')
        };

        // Vérifier et mettre à jour chaque élément
        if (elements.gamesPlayed) elements.gamesPlayed.textContent = stats.gamesPlayed || '0';
        if (elements.bestScore) elements.bestScore.textContent = stats.bestScore || '0';
        if (elements.averageScore) elements.averageScore.textContent = Math.round(stats.averageScore || 0);

        // Définir les modes de jeu
        const modes = [
            { id: 'france', name: 'France', icon: '🇫🇷' },
            { id: 'mondial', name: 'Mondial', icon: '🌍' },
            { id: 'disneyland', name: 'Disneyland', icon: '🎡' },
            { id: 'nevers', name: 'Nevers', icon: '🏛️' },
            { id: 'versaille', name: 'Versailles', icon: '👑' },
            { id: 'dark', name: 'Dark Mode', icon: '🌙' }
        ];

        // Mettre à jour les stats pour chaque mode
        modes.forEach(mode => {
            const modeKey = `${mode.id}Mode`;
            const modeStats = stats[modeKey] || { gamesPlayed: 0, averageScore: 0, bestScore: 0 };

            const modeElements = {
                games: document.getElementById(`${mode.id}ModeGames`),
                avg: document.getElementById(`${mode.id}ModeAvg`),
                top: document.getElementById(`${mode.id}ModeTop`)
            };

            if (modeElements.games) modeElements.games.textContent = modeStats.gamesPlayed || '0';
            if (modeElements.avg) modeElements.avg.textContent = Math.round(modeStats.averageScore || 0);
            if (modeElements.top) modeElements.top.textContent = modeStats.bestScore || '0';
        });

        // Afficher les parties récentes si disponibles
        if (stats.recentGames) {
            displayRecentGames(stats.recentGames);
        }
    } catch (error) {
        console.error('Erreur dans displayStats:', error);
    }
}

function displayRecentGames(recentGames) {
    const container = document.getElementById('recentGames');
    if (!container) return;
    
    container.innerHTML = '';

    const modeIcons = {
        'France': '🇫🇷',
        'france': '🇫🇷',
        'Mondial': '🌍',
        'mondial': '🌍',
        'MONDIAL': '🌍',
        'Disneyland': '🎡',
        'disneyland': '🎡',
        'Nevers': '🏛️',
        'nevers': '🏛️',
        'Versailles': '👑',
        'versailles': '👑',
        'Dark Mode': '🌙',
        'dark': '🌙'
    };

    if (!recentGames || recentGames.length === 0) {
        container.innerHTML = '<div class="no-games">Aucune partie récente</div>';
        return;
    }

    recentGames.forEach(game => {
        const gameElement = document.createElement('div');
        gameElement.className = 'game-entry';
        
        // Normalisation du nom du mode
        let displayMode = game.mode;
        if (displayMode.toLowerCase() === 'dark') {
            displayMode = 'Dark Mode';
        } else {
            // Première lettre en majuscule pour les autres modes
            displayMode = displayMode.charAt(0).toUpperCase() + displayMode.slice(1).toLowerCase();
        }
        
        gameElement.innerHTML = `
            <div class="game-info">
                <span class="mode-icon">${modeIcons[game.mode] || modeIcons[displayMode] || '🎮'}</span>
                <strong>${displayMode}</strong>
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