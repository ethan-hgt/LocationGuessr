const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Créer le dossier logs s'il n'existe pas
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuration des niveaux de log personnalisés
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Couleurs pour les logs
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

// Format personnalisé pour les logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Format simple pour la console
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// Configuration des transports
const transports = [];

// Transport console pour le développement ET la production
transports.push(
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: consoleFormat,
  })
);

// Transport fichier pour les erreurs
transports.push(
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
);

// Transport fichier pour tous les logs
transports.push(
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
);

// Transport fichier pour les requêtes HTTP
transports.push(
  new winston.transports.File({
    filename: path.join(logsDir, 'http.log'),
    level: 'http',
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 3,
  })
);

// Créer le logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Logger spécialisé pour les métriques
const metricsLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'metrics.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  ]
});

// Logger pour les performances
const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  ]
});

// Fonctions utilitaires pour le monitoring
const monitoring = {
  // Log des métriques
  logMetric(name, value, tags = {}) {
    metricsLogger.info('METRIC', {
      name,
      value,
      tags,
      timestamp: new Date().toISOString()
    });
  },

  // Log des performances
  logPerformance(operation, duration, details = {}) {
    performanceLogger.info('PERFORMANCE', {
      operation,
      duration,
      details,
      timestamp: new Date().toISOString()
    });
  },

  // Log des erreurs avec contexte
  logError(error, context = {}) {
    logger.error('ERROR', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  },

  // Log des requêtes HTTP
  logHttpRequest(req, res, duration) {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP_REQUEST_ERROR', logData);
    } else {
      logger.http('HTTP_REQUEST', logData);
    }

    // Métriques pour les requêtes
    this.logMetric('http_requests_total', 1, {
      method: req.method,
      status: res.statusCode,
      endpoint: req.url.split('?')[0]
    });

    this.logMetric('http_request_duration_ms', duration, {
      method: req.method,
      endpoint: req.url.split('?')[0]
    });
  },

  // Log des événements de cache
  logCacheEvent(event, key, hit = false, duration = 0) {
    logger.debug('CACHE_EVENT', {
      event,
      key,
      hit,
      duration,
      timestamp: new Date().toISOString()
    });

    // Métriques pour le cache
    this.logMetric('cache_operations_total', 1, {
      event,
      hit: hit ? 'true' : 'false'
    });

    if (duration > 0) {
      this.logMetric('cache_operation_duration_ms', duration, { event });
    }
  },

  // Log des événements de base de données
  logDatabaseEvent(operation, collection, duration, success = true) {
    logger.debug('DATABASE_EVENT', {
      operation,
      collection,
      duration,
      success,
      timestamp: new Date().toISOString()
    });

    // Métriques pour la base de données
    this.logMetric('database_operations_total', 1, {
      operation,
      collection,
      success: success ? 'true' : 'false'
    });

    this.logMetric('database_operation_duration_ms', duration, {
      operation,
      collection
    });
  },

  // Log des événements d'authentification
  logAuthEvent(event, userId, success = true, details = {}) {
    logger.info('AUTH_EVENT', {
      event,
      userId,
      success,
      details,
      timestamp: new Date().toISOString()
    });

    // Métriques pour l'authentification
    this.logMetric('auth_events_total', 1, {
      event,
      success: success ? 'true' : 'false'
    });
  },

  // Log des événements de jeu
  logGameEvent(event, userId, gameMode, score = 0, details = {}) {
    logger.info('GAME_EVENT', {
      event,
      userId,
      gameMode,
      score,
      details,
      timestamp: new Date().toISOString()
    });

    // Métriques pour les jeux
    this.logMetric('game_events_total', 1, {
      event,
      gameMode
    });

    if (score > 0) {
      this.logMetric('game_scores', score, {
        gameMode,
        event
      });
    }
  },

  // Log des erreurs système
  logSystemError(error, component) {
    logger.error('SYSTEM_ERROR', {
      component,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Métriques pour les erreurs système
    this.logMetric('system_errors_total', 1, {
      component,
      errorType: error.name
    });
  },

  // Log des métriques de mémoire
  logMemoryUsage() {
    const memUsage = process.memoryUsage();
    this.logMetric('memory_usage_bytes', memUsage.heapUsed, { type: 'heap_used' });
    this.logMetric('memory_usage_bytes', memUsage.heapTotal, { type: 'heap_total' });
    this.logMetric('memory_usage_bytes', memUsage.rss, { type: 'rss' });
  },

  // Log des métriques de CPU
  logCpuUsage(startTime) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convertir en millisecondes
    this.logMetric('cpu_usage_ms', duration);
  }
};

// Middleware pour logger les requêtes HTTP
const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log de la requête entrante
  logger.http('REQUEST_START', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Intercepter la fin de la réponse
  res.on('finish', () => {
    const duration = Date.now() - start;
    monitoring.logHttpRequest(req, res, duration);
  });

  next();
};

// Fonction pour nettoyer les anciens logs
const cleanupLogs = () => {
  if (!fs.existsSync(logsDir)) {
    return;
  }

  const files = fs.readdirSync(logsDir);
  const now = Date.now();
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 jours

  files.forEach(file => {
    const filePath = path.join(logsDir, file);
    const stats = fs.statSync(filePath);
    
    if (now - stats.mtime.getTime() > maxAge) {
      fs.unlinkSync(filePath);
      logger.info(`Ancien log supprimé: ${file}`);
    }
  });
};

// Nettoyer les logs tous les jours à 2h du matin
setInterval(cleanupLogs, 24 * 60 * 60 * 1000);

module.exports = {
  logger,
  metricsLogger,
  performanceLogger,
  monitoring,
  httpLogger,
  cleanupLogs
}; 