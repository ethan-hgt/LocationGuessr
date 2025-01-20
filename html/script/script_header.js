document.addEventListener('DOMContentLoaded', function() {
    initializeHeaderLinks();
    updateHeaderWithAvatar();
    setupProfileEvents();
});

// Gestion des liens du header
function initializeHeaderLinks() {
    const headerLinks = document.querySelectorAll('.header-link');
    headerLinks.forEach(link => {
        // Animation au survol
        link.addEventListener('mouseenter', () => {
            link.style.transition = 'transform 1s ease-out';
            link.style.transform = 'scale(1.2)';
        });

        link.addEventListener('mouseleave', () => {
            if (!link.classList.contains('active')) {
                link.style.transition = 'transform 0.6s ease-in';
                link.style.transform = 'scale(1)';
            }
        });

        // Marquer le lien actif
        if (link.href === window.location.href) {
            link.classList.add('active');
        }
    });
}

// Configuration des événements du profil
function setupProfileEvents() {
    document.addEventListener('click', function(event) {
        const dropdown = document.querySelector('.profile-dropdown');
        const userProfile = document.querySelector('.user-profile');
        
        if (dropdown && userProfile) {
            if (userProfile.contains(event.target)) {
                dropdown.classList.toggle('show');
            } else {
                dropdown.classList.remove('show');
            }
        }
    });
}

// Mise à jour du header avec l'avatar
async function updateHeaderWithAvatar() {
    const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
    const userName = localStorage.getItem('userFirstName') || sessionStorage.getItem('userFirstName');
    const rightHeader = document.querySelector('.right-header');

    if (!rightHeader) return;

    if (token && userName) {
        try {
            const response = await fetch('http://localhost:3000/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                const avatarUrl = userData.avatarUrl || '/img/default-avatar.webp';
                
                rightHeader.innerHTML = `
                    <div class="user-profile">
                        <img src="${avatarUrl}" alt="Avatar" class="header-avatar" onerror="this.src='/img/default-avatar.webp'">
                        <span class="header-username">${userName}</span>
                        <div class="profile-dropdown">
                            <a href="profile.html">Mon Profil</a>
                            <a href="#" class="logout-option" onclick="logout(event); return false;">Déconnexion</a>
                        </div>
                    </div>
                `;

                // Réinitialiser les événements après mise à jour du DOM
                setupProfileEvents();
            } else {
                logout(false);
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du header:', error);
            logout(false);
        }
    } else {
        rightHeader.innerHTML = `<a href="login.html" class="header-link">Connexion</a>`;
        initializeHeaderLinks(); // Réinitialiser les événements pour le nouveau lien
    }
}

// Fonction de déconnexion améliorée
function logout(event) {
    if (event && typeof event !== 'boolean') {
        event.preventDefault();
    }

    const redirect = event === false ? false : true;

    // Nettoyage localStorage
    localStorage.removeItem('userToken');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userId');

    // Nettoyage sessionStorage
    sessionStorage.removeItem('userToken');
    sessionStorage.removeItem('userFirstName');
    sessionStorage.removeItem('userId');

    if (redirect) {
        window.location.href = 'accueil.html';
    } else {
        updateHeaderWithAvatar();
    }
}

function updateHeaderAvatar(avatarUrl) {
    const headerAvatar = document.querySelector('.header-avatar');
    if (headerAvatar && avatarUrl) {
        headerAvatar.src = avatarUrl;
    }
}

setInterval(async function() {
    const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
    if (token) {
        try {
            const response = await fetch('http://localhost:3000/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                logout(false);
            }
        } catch (error) {
            logout(false);
        }
    }
}, 5 * 60 * 1000);

window.updateHeaderWithAvatar = updateHeaderWithAvatar;
window.updateHeaderAvatar = updateHeaderAvatar;
window.logout = logout;