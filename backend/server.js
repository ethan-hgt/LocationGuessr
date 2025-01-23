const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration des chemins statiques avec logs de débogage
app.use("/img", (req, res, next) => {
  console.log("[Static] Accès aux images:", req.url);
  express.static(path.join(__dirname, "../img"))(req, res, next);
});

// Routes
app.use("/api/auth", require("./routes/auth"));
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

// Connexion MongoDB avec options améliorées
mongoose
  .connect(process.env.MONGODB_URI, {
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

// Gestionnaire d'erreurs global amélioré
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
  res.status(404).json({ message: "Route non trouvée" });
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
      console.error("[MongoDB] Erreur lors de la fermeture:", err);
      process.exit(1);
    });
});

app.listen(port, () => {
  console.log(`[Server] Démarré sur le port ${port}`);
  console.log("[Server] Chemins statiques configurés:");
  console.log("  - Images:", path.join(__dirname, "../img"));
});
