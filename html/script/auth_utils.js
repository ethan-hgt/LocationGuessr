// Classe utilitaire pour gérer l'authentification
// Gère les tokens JWT et le stockage des données utilisateur
class AuthUtils {
  // Constantes pour la gestion des tokens
  static TOKEN_REFRESH_THRESHOLD = 600000; // 10 minutes en millisecondes
  static VERIFICATION_INTERVAL = 180000; // 3 minutes en millisecondes
  static API_BASE_URL = "http://localhost:3000/api";
  static verificationTimer = null;
  static isRefreshing = false;

  // Récupère le token d'auth du storage
  // Vérifie aussi si le token n'est pas expiré
  static getAuthToken() {
    const token = localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Vérifier si le token est expiré
        if (payload.exp * 1000 > Date.now()) {
          // Vérifier si on doit rafraîchir le token
          if (payload.exp * 1000 - Date.now() < this.TOKEN_REFRESH_THRESHOLD) {
            // Déclencher un rafraîchissement asynchrone sans bloquer
            this.refreshTokenIfNeeded().catch(err => 
              console.warn("Échec du rafraîchissement du token:", err)
            );
          }
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
    return localStorage.getItem("userId") || sessionStorage.getItem("userId");
  }

  static getUsername() {
    return localStorage.getItem("userFirstName") || sessionStorage.getItem("userFirstName");
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
      const response = await fetch(`${this.API_BASE_URL}/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        // Éviter la mise en cache du navigateur
        cache: "no-store"
      });

      if (!response.ok) {
        console.log("Token invalide lors de la vérification");
        this.clearAuth();
        return false;
      }

      const data = await response.json();
      // Mettre à jour les informations utilisateur si nécessaire
      this.updateUserInfo(data);
      return true;
    } catch (err) {
      console.error("Erreur lors de la vérification du token:", err);
      // Ne pas effacer les données d'auth automatiquement en cas d'erreur réseau
      if (err.name !== "TypeError" && err.name !== "NetworkError") {
        this.clearAuth();
      }
      return false;
    }
  }

  // Nettoie toutes les données d'auth du storage
  static clearAuth() {
    console.log("Nettoyage des données d'authentification");
    [localStorage, sessionStorage].forEach(storage => {
      storage.removeItem("userToken");
      storage.removeItem("userFirstName");
      storage.removeItem("userId");
      storage.removeItem("refreshToken");
    });
    
    // Arrêter la vérification périodique
    if (this.verificationTimer) {
      clearInterval(this.verificationTimer);
      this.verificationTimer = null;
    }
  }

  // Stocke les données d'auth dans le bon storage
  // rememberMe = true -> localStorage
  // rememberMe = false -> sessionStorage
  static storeAuth(data, rememberMe = false) {
    this.clearAuth();
    const storage = rememberMe ? localStorage : sessionStorage;
    
    storage.setItem("userToken", data.token);
    storage.setItem("userFirstName", data.user.username);
    storage.setItem("userId", data.user.id);
    if (data.refreshToken) {
      storage.setItem("refreshToken", data.refreshToken);
    }
    
    // Démarrer la vérification périodique
    this.startPeriodicVerification();
  }

  // Met à jour les infos utilisateur dans le storage
  static updateUserInfo(userData) {
    const storage = localStorage.getItem("userToken") ? localStorage : sessionStorage;
    if (storage && userData.username) {
      storage.setItem("userFirstName", userData.username);
    }
  }

  // Démarrer une vérification périodique du token
  static startPeriodicVerification() {
    // Nettoyer un timer existant
    if (this.verificationTimer) {
      clearInterval(this.verificationTimer);
    }
    
    // Créer un nouveau timer
    this.verificationTimer = setInterval(() => {
      // Vérifier silencieusement le token
      this.verifyToken().catch(err => 
        console.warn("Erreur de vérification périodique:", err)
      );
    }, this.VERIFICATION_INTERVAL);
    
    // S'assurer que le timer ne bloque pas la fermeture de la page
    window.addEventListener('beforeunload', () => {
      if (this.verificationTimer) {
        clearInterval(this.verificationTimer);
      }
    });
  }

  // Rafraîchit automatiquement le token avant expiration
  static async refreshTokenIfNeeded() {
    // Éviter les rafraîchissements simultanés
    if (this.isRefreshing) return true;
    
    const token = this.getAuthToken();
    if (!token) return false;
    
    try {
      this.isRefreshing = true;
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Rafraîchir si le token expire bientôt
      if (payload.exp * 1000 - Date.now() < this.TOKEN_REFRESH_THRESHOLD) {
        console.log("Rafraîchissement du token...");
        
        // Utiliser le refreshToken si disponible, sinon faire une vérification simple
        const refreshToken = localStorage.getItem("refreshToken") || sessionStorage.getItem("refreshToken");
        
        if (refreshToken) {
          const response = await fetch(`${this.API_BASE_URL}/auth/refresh-token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (response.ok) {
            const data = await response.json();
            // Préserver le choix de stockage (local vs session)
            const useLocalStorage = localStorage.getItem("userToken") !== null;
            this.storeAuth(data, useLocalStorage);
            console.log("Token rafraîchi avec succès");
            return true;
          } else {
            console.warn("Échec du rafraîchissement, échec de la réponse:", response.status);
            // Si le serveur rejette le refresh token, on tente une vérification simple
            return await this.verifyToken();
          }
        } else {
          // Pas de refresh token, faire une simple vérification
          return await this.verifyToken();
        }
      }
      return true;
    } catch (err) {
      console.error("Erreur lors du rafraîchissement du token:", err);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }
}

// Pour la compatibilité avec le code existant
const getAuthToken = () => AuthUtils.getAuthToken();
const clearAuth = () => AuthUtils.clearAuth();

// Démarrer la vérification si l'utilisateur est déjà connecté
document.addEventListener('DOMContentLoaded', () => {
  if (AuthUtils.isLoggedIn()) {
    AuthUtils.startPeriodicVerification();
  }
});

// Fonction pour déconnexion propre
function logout() {
  AuthUtils.clearAuth();
  window.location.href = '/html/accueil.html';
}

// Exposer la fonction pour l'utilisation globale
window.logout = logout;
