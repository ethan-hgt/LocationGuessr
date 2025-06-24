document.addEventListener("DOMContentLoaded", function () {
  // Animation des liens
  const headerLinks = document.querySelectorAll(".header-link");
  headerLinks.forEach((link) => {
    link.addEventListener("mouseenter", () => {
      link.style.transition = "transform 1s ease-out";
      link.style.transform = "scale(1.2)";
    });
    link.addEventListener("mouseleave", () => {
      if (!link.classList.contains("active")) {
        link.style.transition = "transform 0.6s ease-in";
        link.style.transform = "scale(1)";
      }
    });
  });

  // Marquer le lien actif
  const currentLocation = window.location.href;
  headerLinks.forEach((link) => {
    if (link.href === currentLocation) {
      link.classList.add("active");
    }
  });

  // Initialisation du header
  updateHeader();
  
  // Initialisation du menu mobile
  initMobileMenu();
});

// Fonction pour initialiser et gérer le menu mobile
function initMobileMenu() {
  // Injection du menu burger et du conteneur mobile dans le header
  const header = document.querySelector('header');
  const leftHeader = document.querySelector('.left-header');
  
  if (!header || !leftHeader) return;
  
  // Création du bouton burger s'il n'existe pas déjà
  if (!document.querySelector('.burger-menu')) {
    const burgerButton = document.createElement('div');
    burgerButton.className = 'burger-menu';
    burgerButton.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;
    leftHeader.appendChild(burgerButton);
    
    // Création du menu mobile s'il n'existe pas déjà
    if (!document.querySelector('.mobile-menu')) {
      const mobileMenu = document.createElement('div');
      mobileMenu.className = 'mobile-menu';
      
      // Récupérer tous les liens du header sauf le premier (logo)
      const headerLinks = document.querySelectorAll('.left-header .header-link');
      headerLinks.forEach((link, index) => {
        if (index > 0) { // Ignorer le premier lien (généralement le logo)
          const clonedLink = link.cloneNode(true);
          mobileMenu.appendChild(clonedLink);
        }
      });
      
      // Ajouter le lien de connexion au menu mobile si présent dans le header
      const loginLink = document.querySelector('.right-header .header-link');
      if (loginLink) {
        const clonedLoginLink = loginLink.cloneNode(true);
        mobileMenu.appendChild(clonedLoginLink);
      }
      
      header.after(mobileMenu);
    }
    
    // Gestion des événements pour le menu burger
    burgerButton.addEventListener('click', toggleMobileMenu);
  }
}

// Fonction pour basculer l'état du menu mobile
function toggleMobileMenu() {
  const burgerMenu = document.querySelector('.burger-menu');
  const mobileMenu = document.querySelector('.mobile-menu');
  
  if (!burgerMenu || !mobileMenu) return;
  
  burgerMenu.classList.toggle('active');
  mobileMenu.classList.toggle('active');
  
  // Empêcher le défilement de la page lorsque le menu est ouvert
  document.body.style.overflow = burgerMenu.classList.contains('active') ? 'hidden' : '';
  
  // Fermer le menu si on clique sur un lien
  const mobileLinks = mobileMenu.querySelectorAll('.header-link');
  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      burgerMenu.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

// État de chargement du header pour éviter les mises à jour multiples
let isHeaderUpdating = false;
// Timestamp de la dernière mise à jour réussie
let lastSuccessfulUpdate = 0;
// Temps minimum entre les mises à jour complètes (5 minutes)
const MIN_UPDATE_INTERVAL = 300000;

async function updateHeader() {
  // Éviter les mises à jour simultanées
  if (isHeaderUpdating) return;
  
  try {
    isHeaderUpdating = true;
    const token = AuthUtils.getAuthToken();
    const userName = AuthUtils.getUsername();
    const rightHeader = document.querySelector(".right-header");

    if (!rightHeader) return;

    // Cas où l'utilisateur n'est pas connecté
    if (!token || !userName) {
      rightHeader.innerHTML = `<a href="login.html" class="header-link">Connexion</a>`;
      return;
    }
    
    // Vérifier si une mise à jour complète est nécessaire
    const currentTime = Date.now();
    const needsFullUpdate = currentTime - lastSuccessfulUpdate > MIN_UPDATE_INTERVAL;
    
    // Si une mise à jour récente a été faite et qu'on a les données utilisateur en cache
    if (!needsFullUpdate && rightHeader.querySelector(".header-username")) {
      // Mise à jour silencieuse sans modifier l'interface
      AuthUtils.refreshTokenIfNeeded().catch(err => 
        console.warn("Échec du rafraîchissement silencieux:", err)
      );
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/api/user/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        // Ajouter un timeout pour éviter les attentes infinies
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }

      const userData = await response.json();

      // Mettre à jour le stockage si le nom a changé
      if (userData.username !== userName) {
        if (localStorage.getItem("userToken")) {
          localStorage.setItem("userFirstName", userData.username);
        }
        if (sessionStorage.getItem("userToken")) {
          sessionStorage.setItem("userFirstName", userData.username);
        }
      }

      rightHeader.innerHTML = `
                <div class="user-profile" onclick="toggleProfileMenu(event)">
                    <img src="${
                      userData.avatarUrl || "/img/default-avatar.webp"
                    }" alt="Avatar" class="header-avatar">
                    <span class="header-username">${
                      userData.username
                    }</span>
                    <div class="profile-dropdown" id="profileDropdown">
                        <a href="profile.html">Mon Profil</a>
                        <a href="#" onclick="logout(); return false;" class="logout-option">Déconnexion</a>
                    </div>
                </div>
            `;
            
      // Marquer la mise à jour comme réussie
      lastSuccessfulUpdate = currentTime;
    } catch (error) {
      console.warn("Erreur lors de la mise à jour du header:", error);
      
      // En cas d'erreur réseau, conserver l'affichage actuel si l'utilisateur semble connecté
      if (error.name === 'TypeError' || error.name === 'AbortError' || 
          error.message.includes('Network') || error.message.includes('timeout')) {
        
        // Si on a déjà un menu utilisateur, le conserver
        if (rightHeader.querySelector(".user-profile")) {
          console.log("Problème réseau détecté, conservation de l'interface utilisateur actuelle");
          return;
        }
        
        // Sinon, tenter d'utiliser les données minimales disponibles pour l'affichage
        rightHeader.innerHTML = `
          <div class="user-profile" onclick="toggleProfileMenu(event)">
              <img src="/img/default-avatar.webp" alt="Avatar" class="header-avatar">
              <span class="header-username">${userName}</span>
              <div class="profile-dropdown" id="profileDropdown">
                  <a href="profile.html">Mon Profil</a>
                  <a href="#" onclick="logout(); return false;" class="logout-option">Déconnexion</a>
              </div>
          </div>
        `;
        return;
      }
      
      // Pour les autres erreurs (token invalide, etc.), déconnecter
      AuthUtils.clearAuth();
      rightHeader.innerHTML = `<a href="login.html" class="header-link">Connexion</a>`;
    }
  } catch (error) {
    console.error("Erreur critique dans updateHeader:", error);
    // Ne pas nettoyer automatiquement l'auth en cas d'erreur critique
  } finally {
    isHeaderUpdating = false;
  }
}

function toggleProfileMenu(event) {
  event.stopPropagation();
  const dropdown = document.getElementById("profileDropdown");
  if (!dropdown) return;

  dropdown.classList.toggle("show");

  // Fermer le menu si on clique ailleurs
  document.addEventListener("click", function closeMenu(e) {
    if (!e.target.closest(".user-profile")) {
      dropdown.classList.remove("show");
      document.removeEventListener("click", closeMenu);
    }
  });
}

// Exporter pour l'utilisation globale
window.updateHeader = updateHeader;
window.toggleProfileMenu = toggleProfileMenu;
window.toggleMobileMenu = toggleMobileMenu;
