const CONFIG = {
  // Détection de l'environnement
  getApiUrl() {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Si on est en local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    
    // En production : utiliser le même domaine que le front
    return `${protocol}//${hostname}`;
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