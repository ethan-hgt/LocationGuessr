const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { monitoring, logger } = require('../config/logger');
const { cacheUtils, getCacheStats } = require('../config/redis');
const { getCacheStats: getCacheMiddlewareStats } = require('../middlewares/cache');
const User = require('../models/User');

// Middleware pour vérifier les permissions admin
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentification requise' });
    }
    
    // Vérifier si l'utilisateur est admin (ajouter un champ isAdmin au modèle User si nécessaire)
    // Pour l'instant, on utilise une liste d'emails admin
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
    
    if (!adminEmails.includes(req.user.email)) {
      return res.status(403).json({ message: 'Accès refusé - Admin requis' });
    }
    
    next();
  } catch (error) {
    logger.error('Erreur vérification admin:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Route pour obtenir les métriques en temps réel
router.get('/metrics', auth, requireAdmin, async (req, res) => {
  try {
    const startTime = process.hrtime.bigint();
    
    // Récupérer les statistiques système
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Récupérer les statistiques Redis
    const redisStats = await getCacheStats();
    
    // Récupérer les statistiques de base de données
    const userCount = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    
    // Calculer les statistiques de jeu
    const gameStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalGames: { $sum: '$stats.gamesPlayed' },
          totalScore: { $sum: '$stats.totalScore' },
          avgScore: { $avg: '$stats.averageScore' },
          bestScore: { $max: '$stats.bestScore' }
        }
      }
    ]);
    
    const stats = gameStats[0] || {
      totalGames: 0,
      totalScore: 0,
      avgScore: 0,
      bestScore: 0
    };
    
    // Récupérer les statistiques par mode de jeu
    const modeStats = await User.aggregate([
      {
        $project: {
          franceGames: '$stats.franceMode.gamesPlayed',
          mondialGames: '$stats.mondialMode.gamesPlayed',
          disneyGames: '$stats.disneylandMode.gamesPlayed',
          neversGames: '$stats.neversMode.gamesPlayed',
          versaillesGames: '$stats.versailleMode.gamesPlayed',
          darkGames: '$stats.darkMode.gamesPlayed'
        }
      },
      {
        $group: {
          _id: null,
          franceTotal: { $sum: '$franceGames' },
          mondialTotal: { $sum: '$mondialGames' },
          disneyTotal: { $sum: '$disneyGames' },
          neversTotal: { $sum: '$neversGames' },
          versaillesTotal: { $sum: '$versaillesGames' },
          darkTotal: { $sum: '$darkGames' }
        }
      }
    ]);
    
    const modeTotals = modeStats[0] || {
      franceTotal: 0,
      mondialTotal: 0,
      disneyTotal: 0,
      neversTotal: 0,
      versaillesTotal: 0,
      darkTotal: 0
    };
    
    // Récupérer les utilisateurs récents
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('username email createdAt stats.gamesPlayed');
    
    // Récupérer les meilleurs scores
    const topScores = await User.find()
      .sort({ 'stats.bestScore': -1 })
      .limit(10)
      .select('username stats.bestScore stats.gamesPlayed');
    
    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    const metrics = {
      system: {
        uptime: Math.floor(uptime),
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          external: Math.round(memUsage.external / 1024 / 1024) // MB
        },
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      redis: redisStats,
      database: {
        totalUsers: userCount,
        activeUsers,
        totalGames: stats.totalGames,
        totalScore: stats.totalScore,
        averageScore: Math.round(stats.avgScore * 10) / 10,
        bestScore: stats.bestScore
      },
      gameModes: {
        france: modeTotals.franceTotal,
        mondial: modeTotals.mondialTotal,
        disneyland: modeTotals.disneyTotal,
        nevers: modeTotals.neversTotal,
        versailles: modeTotals.versaillesTotal,
        dark: modeTotals.darkTotal
      },
      recentActivity: {
        recentUsers,
        topScores
      },
      performance: {
        responseTime: duration,
        timestamp: new Date().toISOString()
      }
    };
    
    // Logger les métriques
    monitoring.logMetric('admin_metrics_request', 1, {
      responseTime: duration,
      userCount,
      totalGames: stats.totalGames
    });
    
    res.json(metrics);
  } catch (error) {
    logger.error('Erreur récupération métriques:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des métriques' });
  }
});

// Route pour obtenir les logs récents
router.get('/logs', auth, requireAdmin, async (req, res) => {
  try {
    const { level = 'info', limit = 100, since } = req.query;
    
    const fs = require('fs');
    const path = require('path');
    
    let logFile;
    switch (level) {
      case 'error':
        logFile = path.join(__dirname, '../logs/error.log');
        break;
      case 'http':
        logFile = path.join(__dirname, '../logs/http.log');
        break;
      case 'metrics':
        logFile = path.join(__dirname, '../logs/metrics.log');
        break;
      case 'performance':
        logFile = path.join(__dirname, '../logs/performance.log');
        break;
      default:
        logFile = path.join(__dirname, '../logs/combined.log');
    }
    
    if (!fs.existsSync(logFile)) {
      return res.json({ logs: [], total: 0 });
    }
    
    const logContent = fs.readFileSync(logFile, 'utf8');
    let logs = logContent.split('\n').filter(line => line.trim());
    
    // Filtrer par date si spécifié
    if (since) {
      const sinceDate = new Date(since);
      logs = logs.filter(log => {
        try {
          const logDate = new Date(JSON.parse(log).timestamp);
          return logDate >= sinceDate;
        } catch {
          return true;
        }
      });
    }
    
    // Parser et formater les logs
    const parsedLogs = logs
      .slice(-limit)
      .map(log => {
        try {
          const parsed = JSON.parse(log);
          return {
            timestamp: parsed.timestamp,
            level: parsed.level || 'info',
            message: parsed.message,
            ...parsed
          };
        } catch {
          return { message: log, level: 'unknown' };
        }
      })
      .reverse();
    
    res.json({
      logs: parsedLogs,
      total: logs.length,
      level,
      limit: parseInt(limit)
    });
  } catch (error) {
    logger.error('Erreur récupération logs:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des logs' });
  }
});

// Route pour obtenir les statistiques de cache
router.get('/cache-stats', auth, requireAdmin, async (req, res) => {
  try {
    const stats = await getCacheStats();
    res.json(stats);
  } catch (error) {
    logger.error('Erreur récupération stats cache:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques cache' });
  }
});

// Route pour nettoyer le cache
router.post('/cache-clear', auth, requireAdmin, async (req, res) => {
  try {
    const { pattern } = req.body;
    
    if (!pattern) {
      return res.status(400).json({ message: 'Pattern requis pour nettoyer le cache' });
    }
    
    const deletedCount = await cacheUtils.clearPattern(pattern);
    
    logger.info(`Cache nettoyé par admin: ${deletedCount} clés supprimées pour le pattern ${pattern}`);
    
    res.json({
      message: `Cache nettoyé avec succès`,
      deletedCount,
      pattern
    });
  } catch (error) {
    logger.error('Erreur nettoyage cache:', error);
    res.status(500).json({ message: 'Erreur lors du nettoyage du cache' });
  }
});

// Route pour obtenir les statistiques de performance
router.get('/performance', auth, requireAdmin, async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    
    const fs = require('fs');
    const path = require('path');
    const perfLogFile = path.join(__dirname, '../logs/performance.log');
    
    if (!fs.existsSync(perfLogFile)) {
      return res.json({ performance: [] });
    }
    
    const logContent = fs.readFileSync(perfLogFile, 'utf8');
    const logs = logContent.split('\n').filter(line => line.trim());
    
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const performanceLogs = logs
      .map(log => {
        try {
          return JSON.parse(log);
        } catch {
          return null;
        }
      })
      .filter(log => log && new Date(log.timestamp) >= since)
      .map(log => ({
        operation: log.operation,
        duration: log.duration,
        timestamp: log.timestamp,
        details: log.details
      }))
      .reverse();
    
    // Calculer les statistiques de performance
    const avgDuration = performanceLogs.length > 0 
      ? performanceLogs.reduce((sum, log) => sum + log.duration, 0) / performanceLogs.length 
      : 0;
    
    const maxDuration = performanceLogs.length > 0 
      ? Math.max(...performanceLogs.map(log => log.duration))
      : 0;
    
    const minDuration = performanceLogs.length > 0 
      ? Math.min(...performanceLogs.map(log => log.duration))
      : 0;
    
    res.json({
      performance: performanceLogs,
      stats: {
        total: performanceLogs.length,
        averageDuration: Math.round(avgDuration * 100) / 100,
        maxDuration: Math.round(maxDuration * 100) / 100,
        minDuration: Math.round(minDuration * 100) / 100
      }
    });
  } catch (error) {
    logger.error('Erreur récupération performance:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques de performance' });
  }
});

// Route pour obtenir les statistiques d'erreurs
router.get('/errors', auth, requireAdmin, async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    
    const fs = require('fs');
    const path = require('path');
    const errorLogFile = path.join(__dirname, '../logs/error.log');
    
    if (!fs.existsSync(errorLogFile)) {
      return res.json({ errors: [] });
    }
    
    const logContent = fs.readFileSync(errorLogFile, 'utf8');
    const logs = logContent.split('\n').filter(line => line.trim());
    
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const errorLogs = logs
      .map(log => {
        try {
          return JSON.parse(log);
        } catch {
          return null;
        }
      })
      .filter(log => log && new Date(log.timestamp) >= since)
      .map(log => ({
        message: log.message,
        stack: log.stack,
        context: log.context,
        timestamp: log.timestamp
      }))
      .reverse();
    
    // Grouper les erreurs par type
    const errorTypes = {};
    errorLogs.forEach(error => {
      const type = error.message.split(':')[0] || 'Unknown';
      if (!errorTypes[type]) {
        errorTypes[type] = 0;
      }
      errorTypes[type]++;
    });
    
    res.json({
      errors: errorLogs,
      stats: {
        total: errorLogs.length,
        types: errorTypes
      }
    });
  } catch (error) {
    logger.error('Erreur récupération erreurs:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des erreurs' });
  }
});

// Route pour obtenir un dashboard complet
router.get('/dashboard', auth, requireAdmin, async (req, res) => {
  try {
    // Récupérer toutes les métriques en parallèle
    const [metrics, cacheStats, performance, errors] = await Promise.all([
      fetch(`${req.protocol}://${req.get('host')}/api/monitoring/metrics`, {
        headers: { Authorization: req.headers.authorization }
      }).then(r => r.json()),
      fetch(`${req.protocol}://${req.get('host')}/api/monitoring/cache-stats`, {
        headers: { Authorization: req.headers.authorization }
      }).then(r => r.json()),
      fetch(`${req.protocol}://${req.get('host')}/api/monitoring/performance?hours=1`, {
        headers: { Authorization: req.headers.authorization }
      }).then(r => r.json()),
      fetch(`${req.protocol}://${req.get('host')}/api/monitoring/errors?hours=1`, {
        headers: { Authorization: req.headers.authorization }
      }).then(r => r.json())
    ]);
    
    const dashboard = {
      metrics,
      cache: cacheStats,
      performance,
      errors,
      timestamp: new Date().toISOString()
    };
    
    res.json(dashboard);
  } catch (error) {
    logger.error('Erreur récupération dashboard:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du dashboard' });
  }
});

module.exports = router; 