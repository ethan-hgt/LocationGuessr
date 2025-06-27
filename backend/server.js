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

const app = express();
const port = process.env.PORT || 3000;

// Middleware de compression pour optimiser les performances
app.use(compression());

// Configuration de sécurité adaptée au développement
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://api.mapbox.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://api.mapbox.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://maps.googleapis.com", "https://api.mapbox.com", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://lottie.host"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.mapbox.com", "https://maps.googleapis.com"],
      frameSrc: ["'self'", "https://maps.googleapis.com"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"]
    }
  } : false, // Désactiver CSP en développement pour éviter les blocages HTTP/HTTPS
  crossOriginEmbedderPolicy: false, // Nécessaire pour Google Street View
  crossOriginOpenerPolicy: false
}));

// Rate limiting adapté en local
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 1000 requêtes en dev, 100 en prod
  message: {
    error: "Trop de requêtes, veuillez réessayer plus tard.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Rate limiting spécial pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // 50 tentatives en dev, 5 en prod
  message: {
    error: "Trop de tentatives de connexion, veuillez réessayer plus tard."
  },
  skipSuccessfulRequests: true,
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

// Routes statiques et API
app.use("/img", (req, res, next) => {
  console.log("[Static] Accès aux images:", req.url);
  express.static(path.join(__dirname, "../img"))(req, res, next);
});

// Routes avec protection spécifique
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/user", require("./routes/user"));

// Route de test
app.get("/test", (req, res) => {
  res.json({ message: "Le serveur fonctionne correctement !" });
});

// Route pour les modes de jeu
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

// Route pour servir l'application frontend - CORRIGÉ pour la production
app.get("/", (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    // En production, servir directement accueil.html depuis la racine
    res.sendFile(path.join(__dirname, "../html/accueil.html"));
  } else {
    // En développement, garder la redirection
    res.redirect("/html/accueil.html");
  }
});

// Routes de fallback pour les pages principales en production
if (process.env.NODE_ENV === 'production') {
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
}

// Connexion MongoDB avec configs optimisées
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/locationguessr-test', {
    autoIndex: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
  })
  .then(() => console.log("[MongoDB] Connexion établie"))
  .catch((err) => console.error("[MongoDB] Erreur de connexion:", err));

// Middleware de logging en développement
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
  });
}

// Gestion centralisée des erreurs
app.use((err, req, res, next) => {
  console.error("[Error] Type:", err.name);
  console.error("[Error] Message:", err.message);
  console.error("[Error] Path:", req.path);

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
  console.log("[404] Route non trouvée:", req.url);
  if (process.env.NODE_ENV === 'production') {
    // En production, rediriger vers la page d'accueil pour les routes inconnues
    res.redirect("/");
  } else {
    res.status(404).json({ message: "Route non trouvée" });
  }
});

// Gestion de la fermeture
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM reçu. Fermeture propre...");
  mongoose.connection
    .close()
    .then(() => {
      console.log("[MongoDB] Déconnexion réussie");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[MongoDB] Erreur fermeture:", err);
      process.exit(1);
    });
});

// Démarrage du serveur
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[Server] Serveur démarré sur le port ${port}`);
  console.log(`[Server] Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] CORS autorisé pour:`, corsOrigins);
  if (process.env.NODE_ENV === 'production') {
    console.log(`[Server] ✅ Production ready - API accessible sur https://locationguessr.fr/api`);
  }
});

// Export pour les tests
module.exports = app;
