const { cacheUtils, monitoring } = require('../config/redis');
const { logger } = require('../config/logger');

// Configuration du cache par défaut
const DEFAULT_TTL = 3600; // 1 heure
const SHORT_TTL = 300; // 5 minutes
const LONG_TTL = 86400; // 24 heures

// Middleware de cache générique
const cacheMiddleware = (ttl = DEFAULT_TTL, keyGenerator = null) => {
  return async (req, res, next) => {
    // Ignorer le cache si demandé explicitement
    if (req.headers['cache-control'] === 'no-cache' || req.query.nocache) {
      return next();
    }

    const startTime = Date.now();
    
    // Générer la clé de cache
    const cacheKey = keyGenerator ? keyGenerator(req) : generateCacheKey(req);
    
    try {
      // Essayer de récupérer depuis le cache
      const cachedData = await cacheUtils.get(cacheKey);
      
      if (cachedData) {
        const duration = Date.now() - startTime;
        monitoring.logCacheEvent('HIT', cacheKey, true, duration);
        
        // Ajouter les en-têtes de cache
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        return res.json(cachedData);
      }
      
      // Cache miss - intercepter la réponse
      const originalSend = res.json;
      res.json = function(data) {
        // Restaurer la méthode originale
        res.json = originalSend;
        
        // Mettre en cache la réponse
        cacheUtils.set(cacheKey, data, ttl).then(() => {
          const duration = Date.now() - startTime;
          monitoring.logCacheEvent('SET', cacheKey, false, duration);
        }).catch(err => {
          logger.error('Erreur mise en cache:', err);
        });
        
        // Ajouter les en-têtes de cache
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
        
        // Envoyer la réponse
        return originalSend.call(this, data);
      };
      
      const duration = Date.now() - startTime;
      monitoring.logCacheEvent('MISS', cacheKey, false, duration);
      
      next();
    } catch (error) {
      logger.error('Erreur middleware cache:', error);
      next();
    }
  };
};

// Middleware de cache pour les modes de jeu
const cacheGameModes = cacheMiddleware(SHORT_TTL, (req) => {
  return 'game:modes:list';
});

// Middleware de cache pour les profils utilisateurs
const cacheUserProfile = cacheMiddleware(DEFAULT_TTL, (req) => {
  const userId = req.user?.id || req.params.userId;
  return `user:profile:${userId}`;
});

// Middleware de cache pour les leaderboards
const cacheLeaderboard = cacheMiddleware(SHORT_TTL, (req) => {
  const mode = req.query.mode || 'global';
  const limit = req.query.limit || '10';
  return `leaderboard:${mode}:${limit}`;
});

// Middleware de cache pour les statistiques globales
const cacheGlobalStats = cacheMiddleware(LONG_TTL, (req) => {
  return 'stats:global';
});

// Middleware de cache pour les données de jeu
const cacheGameData = cacheMiddleware(DEFAULT_TTL, (req) => {
  const gameMode = req.params.mode || req.body.mode;
  return `game:data:${gameMode}`;
});

// Fonction pour générer une clé de cache basée sur la requête
function generateCacheKey(req) {
  const parts = [
    req.method,
    req.originalUrl.split('?')[0], // URL sans query params
    req.user?.id || 'anonymous'
  ];
  
  // Ajouter les paramètres de query importants
  const importantParams = ['mode', 'limit', 'page', 'sort'];
  importantParams.forEach(param => {
    if (req.query[param]) {
      parts.push(`${param}:${req.query[param]}`);
    }
  });
  
  return parts.join(':');
}

// Fonction pour invalider le cache
const invalidateCache = async (pattern) => {
  try {
    const deletedCount = await cacheUtils.clearPattern(pattern);
    logger.info(`Cache invalidé: ${deletedCount} clés supprimées pour le pattern ${pattern}`);
    return deletedCount;
  } catch (error) {
    logger.error('Erreur invalidation cache:', error);
    return 0;
  }
};

// Fonction pour invalider le cache utilisateur
const invalidateUserCache = async (userId) => {
  const patterns = [
    `user:profile:${userId}`,
    `user:stats:${userId}`,
    `user:games:${userId}`
  ];
  
  let totalDeleted = 0;
  for (const pattern of patterns) {
    totalDeleted += await invalidateCache(pattern);
  }
  
  return totalDeleted;
};

// Fonction pour invalider le cache des leaderboards
const invalidateLeaderboardCache = async (mode = null) => {
  if (mode) {
    return await invalidateCache(`leaderboard:${mode}`);
  } else {
    return await invalidateCache('leaderboard');
  }
};

// Middleware pour invalider le cache après modification
const invalidateCacheMiddleware = (patterns) => {
  return async (req, res, next) => {
    const originalSend = res.json;
    
    res.json = function(data) {
      // Restaurer la méthode originale
      res.json = originalSend;
      
      // Invalider le cache après une modification réussie
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(pattern => {
          invalidateCache(pattern).catch(err => {
            logger.error(`Erreur invalidation pattern ${pattern}:`, err);
          });
        });
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Cache pour les requêtes API externes (Google Street View, etc.)
const cacheExternalAPI = (ttl = DEFAULT_TTL) => {
  return async (req, res, next) => {
    const cacheKey = `api:external:${req.originalUrl}`;
    
    try {
      const cachedData = await cacheUtils.get(cacheKey);
      
      if (cachedData) {
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        return res.json(cachedData);
      }
      
      // Intercepter la réponse pour la mettre en cache
      const originalSend = res.json;
      res.json = function(data) {
        res.json = originalSend;
        
        // Mettre en cache seulement les réponses réussies
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheUtils.set(cacheKey, data, ttl).catch(err => {
            logger.error('Erreur cache API externe:', err);
          });
        }
        
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
        
        return originalSend.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error('Erreur cache API externe:', error);
      next();
    }
  };
};

// Cache pour les données de géolocalisation
const cacheGeolocationData = cacheMiddleware(SHORT_TTL, (req) => {
  const lat = req.query.lat || req.body.lat;
  const lng = req.query.lng || req.body.lng;
  return `geo:${lat}:${lng}`;
});

// Cache pour les données de jeu par mode
const cacheGameModeData = cacheMiddleware(DEFAULT_TTL, (req) => {
  const mode = req.params.mode || req.query.mode || 'mondial';
  return `game:mode:${mode}`;
});

// Fonction pour précharger le cache
const preloadCache = async () => {
  try {
    // Précharger les modes de jeu
    const gameModes = {
      france: { name: "France", icon: "/img/France.png" },
      mondial: { name: "Mondial", icon: "/img/Mondial.png" },
      disneyland: { name: "Disneyland", icon: "/img/disney.png" },
      nevers: { name: "Nevers", icon: "/img/nevers.png" },
      versaille: { name: "Versaille", icon: "/img/versaille.png" },
      dark: { name: "Dark Mode", icon: "/img/lampe.png" }
    };
    
    await cacheUtils.set('game:modes:list', gameModes, SHORT_TTL);
    logger.info('Cache préchargé: modes de jeu');
    
    // Précharger les statistiques globales
    const globalStats = {
      totalUsers: 0,
      totalGames: 0,
      averageScore: 0,
      lastUpdated: new Date().toISOString()
    };
    
    await cacheUtils.set('stats:global', globalStats, LONG_TTL);
    logger.info('Cache préchargé: statistiques globales');
    
  } catch (error) {
    logger.error('Erreur préchargement cache:', error);
  }
};

// Fonction pour obtenir les statistiques du cache
const getCacheStats = async () => {
  try {
    const stats = await cacheUtils.getStats();
    return {
      keys: stats.keys,
      memory: stats.info,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Erreur récupération stats cache:', error);
    return null;
  }
};

module.exports = {
  cacheMiddleware,
  cacheGameModes,
  cacheUserProfile,
  cacheLeaderboard,
  cacheGlobalStats,
  cacheGameData,
  cacheExternalAPI,
  cacheGeolocationData,
  cacheGameModeData,
  invalidateCache,
  invalidateUserCache,
  invalidateLeaderboardCache,
  invalidateCacheMiddleware,
  preloadCache,
  getCacheStats,
  DEFAULT_TTL,
  SHORT_TTL,
  LONG_TTL
}; 