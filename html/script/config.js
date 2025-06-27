const CONFIG = {
  // Détection de l'environnement
  getApiUrl() {
    const hostname = window.location.hostname;
    
    // Si on est en local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    
    // Si on est en production, utiliser le même domaine
    return window.location.origin;
  },

  // URL de base de l'API
  get API_BASE_URL() {
    return this.getApiUrl() + '/api';
  },

  // Mode de développement
  get isDevelopment() {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  },

  // Mode de production
  get isProduction() {
    return !this.isDevelopment;
  }
};

// Export global pour utilisation dans tous les scripts
window.CONFIG = CONFIG; 