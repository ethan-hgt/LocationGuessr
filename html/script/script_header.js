document.addEventListener('DOMContentLoaded', function() {
    // Animation des liens
    const headerLinks = document.querySelectorAll('.header-link');
    headerLinks.forEach(link => {
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
    });

    // Marquer le lien actif
    const currentLocation = window.location.href;
    headerLinks.forEach(link => {
        if (link.href === currentLocation) {
            link.classList.add('active');
        }
    });

    // Initialisation du header
    updateHeader();
});

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

    // Fermer le menu si on clique ailleurs
    document.addEventListener('click', function closeMenu(e) {
        if (!e.target.closest('.user-profile')) {
            dropdown.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        }
    });
}

// Exporter pour l'utilisation globale
window.updateHeader = updateHeader;
window.toggleProfileMenu = toggleProfileMenu;