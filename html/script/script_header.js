// Script header simplifié pour toutes les pages
// Gestion de l'affichage du header basé sur la présence du token

document.addEventListener("DOMContentLoaded", function() {
  console.log("Initialisation du header");
  updateHeaderDisplay();
  
  // Mettre à jour le header toutes les 5 secondes pour vérifier l'état de connexion
  setInterval(updateHeaderDisplay, 5000);
});

async function updateHeaderDisplay() {
  const rightHeader = document.querySelector(".right-header");
  if (!rightHeader) return;

  const token = sessionStorage.getItem("userToken");
  const username = sessionStorage.getItem("userFirstName");

  if (token && username && isTokenValid(token)) {
    // Utilisateur connecté - récupérer l'avatar
    let avatarSrc = "/img/default-avatar.webp";
    
    try {
      const response = await fetch("http://localhost:3000/api/user/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        avatarSrc = userData.avatarUrl || "/img/default-avatar.webp";
      }
    } catch (error) {
      console.log("Impossible de récupérer l'avatar, utilisation de l'avatar par défaut");
    }
    
    rightHeader.innerHTML = `
      <div class="user-profile" onclick="toggleProfileMenu(event)">
        <img src="${avatarSrc}" alt="Avatar" class="header-avatar">
        <span class="header-username">${username}</span>
        <div class="profile-dropdown" id="profileDropdown">
          <a href="profile.html">Mon Profil</a>
          <a href="#" onclick="logout(); return false;" class="logout-option">Déconnexion</a>
        </div>
      </div>
    `;
  } else {
    // Utilisateur non connecté ou token expiré
    if (token && !isTokenValid(token)) {
      // Nettoyer les données expirées
      sessionStorage.removeItem("userToken");
      sessionStorage.removeItem("userFirstName");
      sessionStorage.removeItem("userId");
    }
    
    rightHeader.innerHTML = `<a href="login.html" class="header-link">Connexion</a>`;
  }
}

function isTokenValid(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch (error) {
    return false;
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

function logout() {
  console.log("Déconnexion");
  
  // Nettoyer toutes les données
  sessionStorage.removeItem("userToken");
  sessionStorage.removeItem("userFirstName");
  sessionStorage.removeItem("userId");
  
  // Mettre à jour le header
  updateHeaderDisplay();
  
  // Rediriger vers l'accueil
  window.location.href = "accueil.html";
}

// Exposer les fonctions globalement
window.updateHeaderDisplay = updateHeaderDisplay;
window.toggleProfileMenu = toggleProfileMenu;
window.logout = logout;
