// Classe utilitaire simplifiée pour gérer l'authentification
// Gestion simple des tokens JWT avec sessionStorage uniquement
class AuthUtils {
  static getApiUrl() {
    return window.CONFIG ? window.CONFIG.API_BASE_URL : "http://localhost:3000/api";
  }

  // Récupère le token d'auth du sessionStorage uniquement
  static getAuthToken() {
    const token = sessionStorage.getItem("userToken");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Vérifier si le token est expiré
        if (payload.exp * 1000 > Date.now()) {
          return token;
        }
        console.log("Token expiré, nettoyage");
        this.clearAuth();
        return null;
      } catch (err) {
        console.error("Erreur lors du décodage du token:", err);
        this.clearAuth();
        return null;
      }
    }
    return null;
  }

  // Helpers pour récupérer les infos utilisateur
  static getUserId() {
    return sessionStorage.getItem("userId");
  }

  static getUsername() {
    return sessionStorage.getItem("userFirstName");
  }

  // Vérifie si l'utilisateur est connecté
  static isLoggedIn() {
    return !!this.getAuthToken();
  }

  // Vérifie si le token est toujours valide côté serveur
  static async verifyToken() {
    const token = this.getAuthToken();
    if (!token) return false;

    try {
      const response = await fetch(`${this.getApiUrl()}/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store"
      });

      if (!response.ok) {
        console.log("Token invalide lors de la vérification");
        this.clearAuth();
        return false;
      }

      const data = await response.json();
      this.updateUserInfo(data);
      return true;
    } catch (err) {
      console.error("Erreur lors de la vérification du token:", err);
      return false;
    }
  }

  // Nettoie toutes les données d'auth
  static clearAuth() {
    console.log("Nettoyage des données d'authentification");
    sessionStorage.removeItem("userToken");
    sessionStorage.removeItem("userFirstName");
    sessionStorage.removeItem("userId");
  }

  // Stocke les données d'auth dans sessionStorage uniquement
  static storeAuth(data) {
    this.clearAuth();
    
    sessionStorage.setItem("userToken", data.token);
    sessionStorage.setItem("userFirstName", data.user.username);
    sessionStorage.setItem("userId", data.user.id);
  }

  // Met à jour les infos utilisateur
  static updateUserInfo(userData) {
    if (userData.username) {
      sessionStorage.setItem("userFirstName", userData.username);
    }
  }
}

// Fonctions globales pour compatibilité
const getAuthToken = () => AuthUtils.getAuthToken();
const clearAuth = () => AuthUtils.clearAuth();

// Fonction de déconnexion simple
function logout() {
  AuthUtils.clearAuth();
  window.location.href = "/html/accueil.html";
}
