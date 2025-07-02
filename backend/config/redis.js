const redis = require('redis');
const winston = require('winston');

// Vérifier si Redis est activé
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

// Config 
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      winston.error('Redis serveur refusé, tentative de reconnexion...');
      return new Error('Redis serveur refusé');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      winston.error('Redis timeout de reconnexion dépassé');
      return new Error('Timeout de reconnexion dépassé');
    }
    if (options.attempt > 10) {
      winston.error('Redis nombre maximum de tentatives atteint');
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  },
  max_attempts: 10,
  connect_timeout: 10000,
  command_timeout: 5000,
  lazyConnect: true
};

// Créer le client 
let client = null;

if (REDIS_ENABLED) {
  try {
    client = redis.createClient(redisConfig);
    
    // Gestion des événements
    client.on('connect', () => {
      winston.info('✅ Redis connecté avec succès');
    });

    client.on('ready', () => {
      winston.info('🚀 Redis prêt à recevoir des commandes');
    });

    client.on('error', (err) => {
      winston.error('❌ Erreur Redis:', err.message);
    });

    client.on('reconnecting', () => {
      winston.warn('🔄 Reconnexion Redis en cours...');
    });

    client.on('end', () => {
      winston.warn('🔌 Connexion Redis fermée');
    });
  } catch (error) {
    winston.error('❌ Impossible de créer le client Redis:', error.message);
    client = null;
  }
} else {
  winston.info('⚠️ Redis désactivé - mode sans cache');
}

// Fonctions utilitaires 
const cacheUtils = {
  // Mettre en cache avec TTL
  async set(key, value, ttl = 3600) {
    if (!REDIS_ENABLED || !client) {
      winston.debug(`Cache désactivé - SET ignoré: ${key}`);
      return true;
    }
    
    try {
      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
      await client.setEx(key, ttl, serializedValue);
      winston.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      winston.error(`Erreur cache SET ${key}:`, error.message);
      return false;
    }
  },

  // Récupérer du cache
  async get(key) {
    if (!REDIS_ENABLED || !client) {
      winston.debug(`Cache désactivé - GET ignoré: ${key}`);
      return null;
    }
    
    try {
      const value = await client.get(key);
      if (value) {
        winston.debug(`Cache HIT: ${key}`);
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      winston.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      winston.error(`Erreur cache GET ${key}:`, error.message);
      return null;
    }
  },

  // Supprimer du cache
  async del(key) {
    if (!REDIS_ENABLED || !client) {
      winston.debug(`Cache désactivé - DEL ignoré: ${key}`);
      return true;
    }
    
    try {
      await client.del(key);
      winston.debug(`Cache DEL: ${key}`);
      return true;
    } catch (error) {
      winston.error(`Erreur cache DEL ${key}:`, error.message);
      return false;
    }
  },

  // Vérifier si une clé existe
  async exists(key) {
    if (!REDIS_ENABLED || !client) {
      return false;
    }
    
    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      winston.error(`Erreur cache EXISTS ${key}:`, error.message);
      return false;
    }
  },

  // Incrémenter une valeur
  async incr(key) {
    if (!REDIS_ENABLED || !client) {
      return null;
    }
    
    try {
      return await client.incr(key);
    } catch (error) {
      winston.error(`Erreur cache INCR ${key}:`, error.message);
      return null;
    }
  },

  // Mettre en cache avec pattern de clé
  async setWithPattern(pattern, id, value, ttl = 3600) {
    const key = `${pattern}:${id}`;
    return this.set(key, value, ttl);
  },

  // Récupérer avec pattern de clé
  async getWithPattern(pattern, id) {
    const key = `${pattern}:${id}`;
    return this.get(key);
  },

  // Supprimer avec pattern de clé
  async delWithPattern(pattern, id) {
    const key = `${pattern}:${id}`;
    return this.del(key);
  },

  // Nettoyer le cache par pattern
  async clearPattern(pattern) {
    if (!REDIS_ENABLED || !client) {
      winston.debug(`Cache désactivé - clearPattern ignoré: ${pattern}`);
      return 0;
    }
    
    try {
      const keys = await client.keys(`${pattern}:*`);
      if (keys.length > 0) {
        await client.del(keys);
        winston.info(`Cache nettoyé: ${keys.length} clés supprimées pour le pattern ${pattern}`);
      }
      return keys.length;
    } catch (error) {
      winston.error(`Erreur nettoyage pattern ${pattern}:`, error.message);
      return 0;
    }
  },

  // Statistiques du cache
  async getStats() {
    if (!REDIS_ENABLED || !client) {
      return {
        keys: 0,
        info: { used_memory_human: 'N/A' },
        timestamp: new Date().toISOString()
      };
    }
    
    try {
      const info = await client.info('memory');
      const keys = await client.dbSize();
      return {
        keys,
        info: info.split('\r\n').reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) acc[key] = value;
          return acc;
        }, {}),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      winston.error('Erreur récupération stats Redis:', error.message);
      return {
        keys: 0,
        info: { used_memory_human: 'N/A' },
        timestamp: new Date().toISOString()
      };
    }
  }
};

// Connexion initiale
const connectRedis = async () => {
  if (!REDIS_ENABLED) {
    winston.info('⚠️ Redis désactivé - connexion ignorée');
    return false;
  }
  
  if (!client) {
    winston.error('❌ Client Redis non disponible');
    return false;
  }
  
  try {
    await client.connect();
    winston.info('🔗 Connexion Redis établie');
    return true;
  } catch (error) {
    winston.error('❌ Échec connexion Redis:', error.message);
    return false;
  }
};

// Fermeture propre
const disconnectRedis = async () => {
  if (!REDIS_ENABLED || !client) {
    return;
  }
  
  try {
    await client.quit();
    winston.info('🔌 Connexion Redis fermée proprement');
  } catch (error) {
    winston.error('❌ Erreur fermeture Redis:', error.message);
  }
};

module.exports = {
  client,
  cacheUtils,
  connectRedis,
  disconnectRedis,
  REDIS_ENABLED
}; 