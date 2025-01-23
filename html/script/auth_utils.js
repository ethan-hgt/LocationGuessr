class AuthUtils {
  static getAuthToken() {
    // Inverser l'ordre - vérifier sessionStorage en PREMIER
    const sessionToken = sessionStorage.getItem("userToken");
    if (sessionToken) return sessionToken;
    return localStorage.getItem("userToken");
  }

  static getUserId() {
    const sessionId = sessionStorage.getItem("userId");
    if (sessionId) return sessionId;
    return localStorage.getItem("userId");
  }

  static getUsername() {
    const sessionName = sessionStorage.getItem("userFirstName");
    if (sessionName) return sessionName;
    return localStorage.getItem("userFirstName");
  }

  static async verifyToken() {
    const token = this.getAuthToken();
    if (!token) return false;

    try {
      const response = await fetch("http://localhost:3000/api/user/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  static clearAuth() {
    // Nettoyer les deux storages
    localStorage.removeItem("userToken");
    localStorage.removeItem("userFirstName");
    localStorage.removeItem("userId");
    sessionStorage.removeItem("userToken");
    sessionStorage.removeItem("userFirstName");
    sessionStorage.removeItem("userId");
  }

  static isAuthenticated() {
    return this.getAuthToken() !== null;
  }

  static storeAuth(data, rememberMe = false) {
    // Nettoyer d'abord les deux storages
    this.clearAuth();

    // Puis stocker dans le storage approprié
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem("userToken", data.token);
    storage.setItem("userFirstName", data.user.username);
    storage.setItem("userId", data.user.id);
  }
}

// Pour la compatibilité avec le code existant
const getAuthToken = () => AuthUtils.getAuthToken();
const clearAuth = () => AuthUtils.clearAuth();
