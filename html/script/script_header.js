document.addEventListener('DOMContentLoaded', function() {
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

    const currentLocation = window.location.href;
    headerLinks.forEach(link => {
        if (link.href === currentLocation) {
            link.classList.add('active');
        }
    });

    // Gestion du menu profil
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
});

// Function pour mettre à jour le header avec l'avatar
async function updateHeaderWithAvatar() {
    const token = localStorage.getItem('userToken');
    const userName = localStorage.getItem('userFirstName');
    const rightHeader = document.querySelector('.right-header');

    if (token && userName) {
        try {
            const response = await fetch('http://localhost:3000/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                const avatarUrl = userData.avatarUrl || '/public/default-avatar.webp';
                rightHeader.innerHTML = `
                    <div class="user-profile">
                        <img src="${avatarUrl}" alt="Avatar" class="header-avatar">
                        <span class="header-username">${userName}</span>
                        <div class="profile-dropdown">
                            <a href="profile.html">Mon Profil</a>
                            <a href="#" class="logout-option" onclick="logout(); return false;">Déconnexion</a>
                        </div>
                    </div>
                `;
            } else {
                logout(false);
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du header:', error);
            logout(false);
        }
    } else {
        rightHeader.innerHTML = `<a href="login.html" class="header-link">Connexion</a>`;
    }
}

// Appeler la fonction au chargement
document.addEventListener('DOMContentLoaded', updateHeaderWithAvatar);