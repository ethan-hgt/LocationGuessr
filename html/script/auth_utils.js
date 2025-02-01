// Classe utilitaire pour gérer l'authentification
// Gère les tokens JWT et le stockage des données utilisateur
class AuthUtils {
  // Récupère le token d'auth du storage
  // Vérifie aussi si le token n'est pas expiré
  static getAuthToken() {
    const token = localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          return token;
        }
        this.clearAuth();
        return null;
      } catch {
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

  // Vérifie si le token est toujours valide côté serveur
  static async verifyToken() {
    const token = this.getAuthToken();
    if (!token) return false;

    try {
      const response = await fetch("http://localhost:3000/api/user/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.clearAuth();
        return false;
      }

      const data = await response.json();
      // Mettre à jour les informations utilisateur si nécessaire
      this.updateUserInfo(data);
      return true;
    } catch {
      this.clearAuth();
      return false;
    }
  }

  // Nettoie toutes les données d'auth du storage
  static clearAuth() {
    [localStorage, sessionStorage].forEach(storage => {
      storage.removeItem("userToken");
      storage.removeItem("userFirstName");
      storage.removeItem("userId");
      storage.removeItem("refreshToken");
    });
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
  }

  // Met à jour les infos utilisateur dans le storage
  static updateUserInfo(userData) {
    const storage = localStorage.getItem("userToken") ? localStorage : sessionStorage;
    if (storage && userData.username) {
      storage.setItem("userFirstName", userData.username);
    }
  }

  // Rafraîchit automatiquement le token avant expiration
  static async refreshTokenIfNeeded() {
    const token = this.getAuthToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Rafraîchir si le token expire dans moins de 5 minutes
      if (payload.exp * 1000 - Date.now() < 300000) {
        const refreshToken = localStorage.getItem("refreshToken") || sessionStorage.getItem("refreshToken");
        if (refreshToken) {
          const response = await fetch("http://localhost:3000/api/auth/refresh-token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (response.ok) {
            const data = await response.json();
            this.storeAuth(data, localStorage.getItem("userToken") !== null);
            return true;
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}

// Pour la compatibilité avec le code existant
const getAuthToken = () => AuthUtils.getAuthToken();
const clearAuth = () => AuthUtils.clearAuth();
