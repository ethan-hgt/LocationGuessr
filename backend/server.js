// Point d'entrée principal du backend
// Configure Express, CORS, MongoDB et les routes API
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
require("dotenv").config();

// Import des configurations (simplifié pour éviter les erreurs)
// const { logger, monitoring, httpLogger } = require("./config/logger");
// const { connectRedis, disconnectRedis } = require("./config/redis");
// const { preloadCache } = require("./middlewares/cache");

const app = express();
const port = process.env.PORT || 3000;

// Middleware de compression pour optimiser les performances
app.use(compression());

// Middleware de logging HTTP (simplifié)
// app.use(httpLogger);

// Configuration de sécurité adaptée au développement
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https:", "data:", "https://unpkg.com", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://unpkg.com", "https://api.mapbox.com", "https://prod.spline.design"],
      mediaSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting adapté pour Infomaniak
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5000 : 10000, // Plus permissif
  message: {
    error: "Trop de requêtes, veuillez réessayer plus tard.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Configuration spécifique pour Infomaniak
  keyGenerator: (req) => {
    // Utiliser l'IP réelle même derrière un proxy
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  skip: (req) => {
    // Ignorer les health checks, ressources statiques et certaines requêtes
    return req.path === '/test' || 
           req.path === '/health' || 
           req.path.startsWith('/img/') ||
           req.path.startsWith('/html/') ||
           req.path.startsWith('/font/') ||
           req.path.startsWith('/sons/') ||
           req.path.endsWith('.css') ||
           req.path.endsWith('.js') ||
           req.path.endsWith('.png') ||
           req.path.endsWith('.jpg') ||
           req.path.endsWith('.jpeg') ||
           req.path.endsWith('.gif') ||
           req.path.endsWith('.svg') ||
           req.path.endsWith('.ico') ||
           req.path.endsWith('.woff') ||
           req.path.endsWith('.woff2') ||
           req.path.endsWith('.ttf') ||
           req.path.endsWith('.mp3') ||
           req.path.endsWith('.wav') ||
           req.path === '/api/modes'; // Ignorer les requêtes de modes de jeu
  }
});
app.use(limiter);

// Rate limiting spécial pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 100, // Plus permissif
  message: {
    error: "Trop de tentatives de connexion, veuillez réessayer plus tard."
  },
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});

// Sanitisation des données MongoDB (protection injection NoSQL)
app.use(mongoSanitize());

// CORS configuré pour la production et le développement
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? [
      'https://locationguessr.fr', 
      'https://www.locationguessr.fr',
      'http://locationguessr.fr',
      'http://www.locationguessr.fr'
    ] 
  : [
      'http://localhost:3000', 
      'http://127.0.0.1:3000', 
      'http://localhost:5500',
      'http://localhost:8080',
      'http://127.0.0.1:5500'
    ];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware standard
app.use(express.json({ limit: '10mb' }));

// Servir les fichiers statiques depuis la racine du projet
app.use(express.static(path.join(__dirname, "..")));

// Routes statiques spécifiques pour éviter les conflits
app.use("/html", express.static(path.join(__dirname, "../html")));
app.use("/img", express.static(path.join(__dirname, "../img")));
app.use("/font", express.static(path.join(__dirname, "../font")));
app.use("/sons", express.static(path.join(__dirname, "../sons")));
app.use("/css", express.static(path.join(__dirname, "../html/style")));
app.use("/js", express.static(path.join(__dirname, "../html/script")));

// Routes avec protection spécifique
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/user", require("./routes/user"));
// app.use("/api/monitoring", require("./routes/monitoring")); // SUPPRIMÉ car le module n'existe pas

// Route de test
app.get("/test", (req, res) => {
  res.json({ message: "Le serveur fonctionne correctement !" });
});

// Route health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Route pour les modes de jeu (simplifié)
app.get("/api/modes", (req, res) => {
  const modes = {
    france: {
      name: "France",
      icon: "/img/France.png",
    },
    mondial: {
      name: "Mondial",
      icon: "/img/Mondial.png",
    },
    disneyland: {
      name: "Disneyland",
      icon: "/img/disney.png",
    },
    nevers: {
      name: "Nevers",
      icon: "/img/nevers.png",
    },
    versaille: {
      name: "Versaille",
      icon: "/img/versaille.png",
    },
    dark: {
      name: "Dark Mode",
      icon: "/img/lampe.png",
    },
  };
  res.json(modes);
});

// Route pour servir l'application frontend
app.get("/", (req, res) => {
  // Toujours servir directement accueil.html (plus de redirection vers /html/)
  res.sendFile(path.join(__dirname, "../html/accueil.html"));
});

// Routes de fallback pour les pages principales (toujours actives)
// Retiré la condition NODE_ENV pour que ça marche aussi sur Infomaniak
  app.get("/accueil", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/accueil.html"));
  });
  
  app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/Login.html"));
  });
  
  app.get("/login.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/Login.html"));
  });
  
  app.get("/connexion", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/Login.html"));
  });
  
  app.get("/play", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/play.html"));
  });
  
  app.get("/leaderboard", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/Leaderboard.html"));
  });
  
  app.get("/profile", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/profile.html"));
  });

  // Routes avec .html pour compatibilité
  app.get("/accueil.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/accueil.html"));
  });
  
  app.get("/play.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/play.html"));
  });
  
  app.get("/leaderboard.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/Leaderboard.html"));
  });
  
  app.get("/profile.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/profile.html"));
  });

  // Route pour About Us
  app.get("/about", (req, res) => {
    res.sendFile(path.join(__dirname, "../html/aboutUs.html"));
  });

// Connexion MongoDB avec configs optimisées
const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/locationguessr-test', {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    logger.info("[MongoDB] Connexion établie");
    
    // Créer les index après la connexion
    try {
      const User = require('./models/User');
      if (User.createIndexes) {
        User.createIndexes();
      }
    } catch (error) {
      logger.warn('[MongoDB] Erreur création index:', error.message);
    }
    
    return true;
  } catch (err) {
    logger.error("[MongoDB] Erreur de connexion:", err);
    
    if (process.env.NODE_ENV === 'development') {
      logger.warn("[MongoDB] Mode développement - continuer sans base de données");
      return false;
    } else {
      throw err; // En production, on arrête le serveur
    }
  }
};

// Connexion MongoDB
connectMongoDB();

// Connexion Redis
const initializeRedis = async () => {
  try {
    const redisConnected = await connectRedis();
    if (redisConnected) {
      // Précharger le cache
      await preloadCache();
    } else {
      logger.info('⚠️ Redis désactivé - initialisation ignorée');
    }
  } catch (error) {
    logger.error('Erreur initialisation Redis:', error);
  }
};

// Initialiser Redis au démarrage seulement si activé
if (process.env.REDIS_ENABLED !== 'false') {
  initializeRedis();
} else {
  logger.info('⚠️ Redis désactivé - initialisation ignorée');
}

// Middleware de logging en développement
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    logger.debug(`[Request] ${req.method} ${req.url}`);
    next();
  });
}

// Gestion centralisée des erreurs
app.use((err, req, res, next) => {
  logger.error("[Error] Type:", err.name);
  logger.error("[Error] Message:", err.message);
  logger.error("[Error] Path:", req.path);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Le fichier est trop volumineux. Taille maximum : 2MB",
      });
    }
    return res.status(400).json({
      message: `Erreur upload: ${err.message}`,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Erreur de validation",
      details: Object.values(err.errors).map((error) => error.message),
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      message: "Cette valeur existe déjà",
    });
  }

  res.status(500).json({
    message: "Une erreur est survenue sur le serveur",
    error: process.env.NODE_ENV !== "production" ? err.message : undefined,
  });
});

// Route 404
app.use((req, res) => {
  logger.warn("[404] Route non trouvée:", req.url);
  // Rediriger vers la page d'accueil pour les routes inconnues
  res.redirect("/");
});

// Gestion de la fermeture
process.on("SIGTERM", async () => {
  logger.info("[Server] SIGTERM reçu. Fermeture propre...");
  
  try {
    // Fermer Redis
    await disconnectRedis();
    
    // Fermer MongoDB
    await mongoose.connection.close();
    logger.info("[MongoDB] Déconnexion réussie");
    
    process.exit(0);
  } catch (err) {
    logger.error("[Server] Erreur fermeture:", err);
    process.exit(1);
  }
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Monitoring périodique
setInterval(() => {
  monitoring.logMemoryUsage();
}, 5 * 60 * 1000); // Toutes les 5 minutes

// Démarrage du serveur
const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`[Server] Serveur démarré sur le port ${port}`);
  logger.info(`[Server] Mode: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`[Server] CORS autorisé pour:`, corsOrigins);
  
  if (process.env.NODE_ENV === 'production') {
    logger.info(`[Server] ✅ Production ready - API accessible sur https://locationguessr.fr/api`);
  }
  
  // Logger les métriques de démarrage
  monitoring.logMetric('server_start', 1, {
    port,
    mode: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

// Export pour les tests
module.exports = app;
