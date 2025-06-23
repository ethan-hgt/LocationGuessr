// Point d'entrée principal du backend
// Configure Express, CORS, MongoDB et les routes API
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Configuration du logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'locationguessr-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Helmet sécurisé (CSP désactivé pour compatibilité Node 18/helmet v6+)
app.use(helmet({
  contentSecurityPolicy: false, // Désactive CSP pour éviter les erreurs de syntaxe
  crossOriginEmbedderPolicy: false
}));

// Compression des réponses
app.use(compression());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives par IP
  message: {
    message: "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: {
    message: "Trop de requêtes. Réessayez dans 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED"
  }
});

// Appliquer le rate limiting
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Middleware CORS avec configuration sécurisée
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://votre-domaine.com'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging des requêtes
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Middleware pour servir les fichiers statiques avec cache
app.use("/img", (req, res, next) => {
  // Cache les images pendant 1 heure
  res.set('Cache-Control', 'public, max-age=3600');
  express.static(path.join(__dirname, "../img"))(req, res, next);
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/user", require("./routes/user"));

// Route de test avec validation
app.get("/test", (req, res) => {
  res.json({ 
    message: "Le serveur fonctionne correctement !",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Route pour les modes de jeu avec cache
const gameModesCache = {
  data: null,
  timestamp: null,
  ttl: 5 * 60 * 1000 // 5 minutes
};

app.get("/api/modes", (req, res) => {
  const now = Date.now();
  
  // Vérifier si le cache est valide
  if (gameModesCache.data && (now - gameModesCache.timestamp) < gameModesCache.ttl) {
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    return res.json(gameModesCache.data);
  }

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

  // Mettre en cache
  gameModesCache.data = modes;
  gameModesCache.timestamp = now;
  
  res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
  res.json(modes);
});

// Route pour servir l'application frontend
app.get("/", (req, res) => {
  res.redirect("/html/accueil.html");
});

// Connexion MongoDB avec configs optimisées
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
    });
    logger.info("[MongoDB] Connexion établie");
    console.log("[MongoDB] Connexion établie");
  } catch (err) {
    logger.error("[MongoDB] Erreur de connexion:", err);
    console.error("[MongoDB] Erreur de connexion:", err);
  }
};

// Gestion centralisée des erreurs
app.use((err, req, res, next) => {
  logger.error('Erreur serveur:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  console.error("[Error] Type:", err.name);
  console.error("[Error] Message:", err.message);
  console.error("[Error] Path:", req.path);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Le fichier est trop volumineux. Taille maximum : 2MB",
        code: "FILE_TOO_LARGE"
      });
    }
    return res.status(400).json({
      message: `Erreur upload: ${err.message}`,
      code: "UPLOAD_ERROR"
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Erreur de validation",
      code: "VALIDATION_ERROR",
      details: Object.values(err.errors).map((error) => error.message),
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      message: "Cette valeur existe déjà",
      code: "DUPLICATE_KEY"
    });
  }

  res.status(500).json({
    message: "Une erreur est survenue sur le serveur",
    code: "INTERNAL_ERROR",
    error: process.env.NODE_ENV !== "production" ? err.message : undefined,
  });
});

// Route 404
app.use((req, res) => {
  logger.warn('Route non trouvée:', { url: req.url, method: req.method });
  console.log("[404] Route non trouvée:", req.url);
  res.status(404).json({ 
    message: "Route non trouvée",
    code: "NOT_FOUND"
  });
});

// Gestion de la fermeture
process.on("SIGTERM", () => {
  logger.info('SIGTERM reçu, fermeture propre du serveur');
  console.log("[Server] SIGTERM reçu. Fermeture propre...");
  mongoose.connection
    .close()
    .then(() => {
      logger.info('Déconnexion MongoDB réussie');
      console.log("[MongoDB] Déconnexion réussie");
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Erreur lors de la fermeture MongoDB:', err);
      console.error("[MongoDB] Erreur lors de la fermeture:", err);
      process.exit(1);
    });
});

// Ne démarrer le serveur que si on n'est pas en mode test
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    app.listen(port, () => {
      logger.info(`Serveur démarré sur le port ${port}`);
      console.log(`[Server] Démarré sur le port ${port}`);
      console.log("[Server] Chemins statiques configurés:");
      console.log("  - Images:", path.join(__dirname, "../img"));
    });
  });
}

module.exports = { app, connectDB };
