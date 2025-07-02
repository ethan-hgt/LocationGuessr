const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const User = require("../models/User");
const multer = require("multer");
const { GAME_MODES } = require("./gameMode");
const { monitoring, logger } = require("../config/logger");
const { 
  cacheUserProfile, 
  cacheLeaderboard, 
  invalidateUserCache,
  invalidateLeaderboardCache,
  invalidateCacheMiddleware 
} = require("../middlewares/cache");

// Fonction utilitaire pour normaliser les noms de modes
// Ex: "parc" -> "disneylandMode"
function normalizeMode(mode) {
  const modeMap = {
    parc: "disneyland",
    versailles: "versaille",
    versaille: "versaille",
    nevers: "nevers",
    france: "france",
    mondial: "mondial",
    dark: "dark",
  };

  const normalizedMode = modeMap[mode] || mode;
  return `${normalizedMode}Mode`;
}

function getModeInfo(mode) {
  const modeMap = {
    parc: "disneyland",
    versailles: "versaille",
    versaille: "versaille",
    nevers: "nevers",
    france: "france",
    mondial: "mondial",
    dark: "dark",
  };

  const modeEmojis = {
    france: "🇫🇷",
    mondial: "🌍",
    disneyland: "🎡",
    versaille: "👑",
    nevers: "🏛️",
    dark: "🌙",
  };

  const normalizedMode = modeMap[mode] || mode;
  const gameMode = GAME_MODES[normalizedMode];

  return {
    key: `${normalizedMode}Mode`,
    name: GAME_MODES[normalizedMode]?.name || mode,
    icon: GAME_MODES[normalizedMode]?.icon || null,
    emoji: modeEmojis[normalizedMode] || "", // Ajout de l'emoji
  };
}

// Config pour la gestion des avatars
// Limite: 2MB, formats: JPG/PNG/WebP
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Format non supporté"));
    }
    cb(null, true);
  },
});

// Upload d'avatar
// Converti l'image en base64 pour stockage dans MongoDB
router.post("/avatar", auth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Aucun fichier uploadé" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const base64 = req.file.buffer.toString("base64");
    const avatarData = `data:${req.file.mimetype};base64,${base64}`;

    user.avatarData = avatarData;
    await user.save();

    res.json({
      success: true,
      avatarUrl: avatarData,
    });
  } catch (error) {
    console.error("[Avatar] Erreur:", error);
    res.status(500).json({ message: "Erreur lors de l'upload" });
  }
});

// Récup du leaderboard
// Trié par meilleur score, limité aux 10 meilleurs
router.get("/leaderboard", cacheLeaderboard, async (req, res) => {
  try {
    const startTime = process.hrtime.bigint();
    const { mode = "global", limit = 10 } = req.query;

    let sortCriteria = {};
    let matchCriteria = {};

    if (mode === "global") {
      sortCriteria = { "stats.bestScore": -1, "stats.gamesPlayed": -1 };
    } else {
      const normalizedMode = normalizeMode(mode);
      const modeKey = `${normalizedMode}Mode`;
      sortCriteria = { [`stats.${modeKey}.bestScore`]: -1, [`stats.${modeKey}.gamesPlayed`]: -1 };
      matchCriteria[`stats.${modeKey}.gamesPlayed`] = { $gt: 0 };
    }

    const users = await User.find(matchCriteria)
      .sort(sortCriteria)
      .limit(parseInt(limit))
      .select("username stats avatarUrl");

    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    monitoring.logDatabaseEvent('find', 'users', duration, true);
    monitoring.logMetric('leaderboard_request', 1, { mode, limit });

    res.json(users);
  } catch (error) {
    logger.error("Erreur récupération leaderboard:", error);
    monitoring.logError(error, { action: 'get_leaderboard', mode: req.query.mode });
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route pour obtenir le profil
router.get("/profile", cacheUserProfile, async (req, res) => {
  try {
    const startTime = process.hrtime.bigint();
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    monitoring.logDatabaseEvent('find', 'users', duration, true);
    monitoring.logAuthEvent('profile_view', user.id, true);

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      stats: user.stats,
      createdAt: user.createdAt,
      avatarUrl: user.avatarData || "/img/default-avatar.webp",
    });
  } catch (error) {
    logger.error("Erreur récupération profil:", error);
    monitoring.logError(error, { userId: req.userId, action: 'get_profile' });
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route pour mettre à jour le profil
router.put("/profile", auth, invalidateCacheMiddleware(['user:profile']), async (req, res) => {
  try {
    const startTime = process.hrtime.bigint();
    const updates = req.body;
    const allowedUpdates = ["username", "email"];

    const filteredUpdates = Object.keys(updates)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    if (updates.username || updates.email) {
      const existingUser = await User.findOne({
        $and: [
          { _id: { $ne: req.userId } },
          {
            $or: [{ username: updates.username }, { email: updates.email }],
          },
        ],
      });

      if (existingUser) {
        return res.status(400).json({
          message: "Ce nom d'utilisateur ou cet email est déjà utilisé.",
        });
      }
    }

    const user = await User.findByIdAndUpdate(req.userId, filteredUpdates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    monitoring.logDatabaseEvent('update', 'users', duration, true);
    monitoring.logAuthEvent('profile_update', user.id, true, { fields: Object.keys(filteredUpdates) });

    // Invalider le cache utilisateur
    await invalidateUserCache(user.id);

    res.json(user);
  } catch (error) {
    logger.error("Erreur mise à jour profil:", error);
    monitoring.logError(error, { userId: req.userId, action: 'update_profile' });
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route pour mettre à jour les stats
router.post("/stats", auth, invalidateCacheMiddleware(['user:profile', 'leaderboard']), async (req, res) => {
  try {
    const startTime = process.hrtime.bigint();
    let { score, mode, gameDetails } = req.body;
    console.log("Mode original reçu:", mode);

    const modeInfo = getModeInfo(mode);
    console.log("ModeInfo:", modeInfo);

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Initialisation des stats du mode si elles n'existent pas
    if (!user.stats[modeInfo.key]) {
      user.stats[modeInfo.key] = {
        gamesPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        averageScore: 0,
      };
    }

    // Mise à jour des stats du mode
    user.stats[modeInfo.key].gamesPlayed += 1;
    user.stats[modeInfo.key].totalScore += score;
    user.stats[modeInfo.key].averageScore = Math.round(
      user.stats[modeInfo.key].totalScore / user.stats[modeInfo.key].gamesPlayed
    );
    user.stats[modeInfo.key].bestScore = Math.max(
      user.stats[modeInfo.key].bestScore,
      score
    );

    // Mise à jour des stats globales
    user.stats.gamesPlayed = (user.stats.gamesPlayed || 0) + 1;
    user.stats.totalScore = (user.stats.totalScore || 0) + score;
    user.stats.averageScore = Math.round(
      user.stats.totalScore / user.stats.gamesPlayed
    );
    user.stats.bestScore = Math.max(user.stats.bestScore || 0, score);
    user.stats.lastPlayedDate = new Date();

    // Nettoyer l'historique existant pour corriger les anciens noms de modes
    user.stats.recentGames = user.stats.recentGames.filter(game => {
      return ['france', 'mondial', 'disneyland', 'nevers', 'versaille', 'dark'].includes(game.mode);
    });

    // Mise à jour de l'historique récent
    user.stats.recentGames.unshift({
      mode: mode, // Utiliser le mode original (clé courte) au lieu de modeInfo.name
      modeIcon: modeInfo.icon,
      modeEmoji: modeInfo.emoji,
      score,
      date: new Date(),
    });

    user.stats.recentGames = user.stats.recentGames.slice(0, 10);

    await user.save();

    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    monitoring.logDatabaseEvent('update', 'users', duration, true);
    monitoring.logGameEvent('score_saved', user.id, modeInfo.key, score, gameDetails);

    // Invalider les caches
    await Promise.all([
      invalidateUserCache(user.id),
      invalidateLeaderboardCache(modeInfo.key),
      invalidateLeaderboardCache('global')
    ]);

    res.json({
      message: "Statistiques mises à jour",
      stats: {
        mode: user.stats[modeInfo.key],
        global: {
          bestScore: user.stats.bestScore,
          averageScore: user.stats.averageScore,
          gamesPlayed: user.stats.gamesPlayed,
        },
      },
    });
  } catch (error) {
    logger.error("Erreur sauvegarde stats:", error);
    monitoring.logError(error, { 
      userId: req.userId, 
      action: 'save_stats',
      mode: req.body.mode,
      score: req.body.score
    });
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour des statistiques" });
  }
});

// Route temporaire pour debug
router.get("/debug-mode/:mode", auth, async (req, res) => {
  try {
    const mode = req.params.mode;
    const modeKey = normalizeMode(mode);
    const user = await User.findById(req.userId);

    res.json({
      originalMode: mode,
      modeKey: modeKey,
      modeStats: user.stats[modeKey],
      allModes: Object.keys(user.stats).filter((key) => key.endsWith("Mode")),
      allStats: user.stats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route pour obtenir la position d'un joueur spécifique
router.get("/rank/:userId", async (req, res) => {
  try {
    const { mode } = req.query;
    const modeKey = mode ? normalizeMode(mode) : null;

    let sortCriteria = {};
    let query = {};

    if (modeKey && mode !== "all") {
      sortCriteria[`stats.${modeKey}.bestScore`] = -1;
      query[`stats.${modeKey}.gamesPlayed`] = { $gt: 0 };
    } else {
      sortCriteria["stats.bestScore"] = -1;
      query["stats.gamesPlayed"] = { $gt: 0 };
    }

    const players = await User.find(query).sort(sortCriteria);
    const playerIndex = players.findIndex(
      (p) => p._id.toString() === req.params.userId
    );

    if (playerIndex === -1) {
      return res.status(404).json({ message: "Joueur non trouvé" });
    }

    res.json({
      rank: playerIndex + 1,
      totalPlayers: players.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Stats détaillées d'un joueur
// Pour la page profil avec toutes les stats par mode
router.get("/stats/details", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // S'assurer que chaque mode a des stats initialisées
    const modes = [
      "france",
      "mondial",
      "disneyland",
      "nevers",
      "versaille",
      "dark",
    ];
    modes.forEach((mode) => {
      const modeKey = `${mode}Mode`;
      if (!user.stats[modeKey]) {
        user.stats[modeKey] = {
          gamesPlayed: 0,
          totalScore: 0,
          bestScore: 0,
          averageScore: 0,
        };
      }
    });

    const currentStats = {
      ...user.stats,
      gamesPlayed: user.stats.gamesPlayed || 0,
      bestScore: user.stats.bestScore || 0,
      averageScore: user.stats.averageScore || 0,
      lastPlayed: user.stats.lastPlayedDate,
      franceMode: user.stats.franceMode || {
        gamesPlayed: 0,
        averageScore: 0,
        bestScore: 0,
      },
      mondialMode: user.stats.mondialMode || {
        gamesPlayed: 0,
        averageScore: 0,
        bestScore: 0,
      },
      disneylandMode: user.stats.disneylandMode || {
        gamesPlayed: 0,
        averageScore: 0,
        bestScore: 0,
      },
      neversMode: user.stats.neversMode || {
        gamesPlayed: 0,
        averageScore: 0,
        bestScore: 0,
      },
      versailleMode: user.stats.versailleMode || {
        gamesPlayed: 0,
        averageScore: 0,
        bestScore: 0,
      },
      darkMode: user.stats.darkMode || {
        gamesPlayed: 0,
        averageScore: 0,
        bestScore: 0,
      },
      recentGames: user.stats.recentGames || [],
    };

    // Calcul du rang
    const betterPlayers = await User.countDocuments({
      "stats.bestScore": { $gt: user.stats.bestScore },
    });

    // Total des joueurs
    const totalPlayers = await User.countDocuments({
      "stats.gamesPlayed": { $gt: 0 },
    });

    res.json({
      username: user.username,
      rank: betterPlayers + 1,
      totalPlayers,
      currentStats,
    });
  } catch (err) {
    console.error("Erreur stats details:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route temporaire pour nettoyer les données corrompues
router.post("/cleanup-recent-games", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    console.log("Avant nettoyage:", user.stats.recentGames.length, "jeux");
    
    // Nettoyer l'historique en gardant seulement les modes valides
    const validModes = ['france', 'mondial', 'disneyland', 'nevers', 'versaille', 'dark'];
    user.stats.recentGames = user.stats.recentGames.filter(game => {
      return validModes.includes(game.mode);
    });

    console.log("Après nettoyage:", user.stats.recentGames.length, "jeux");

    await user.save();

    res.json({
      message: "Historique nettoyé avec succès",
      recentGamesCount: user.stats.recentGames.length
    });
  } catch (err) {
    console.error("Erreur lors du nettoyage:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Récupérer les statistiques globales
router.get("/global-stats", async (req, res) => {
  try {
    const startTime = process.hrtime.bigint();

    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalGames: { $sum: "$stats.gamesPlayed" },
          totalScore: { $sum: "$stats.totalScore" },
          avgScore: { $avg: "$stats.averageScore" },
          bestScore: { $max: "$stats.bestScore" }
        }
      }
    ]);

    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    monitoring.logDatabaseEvent('aggregate', 'users', duration, true);
    monitoring.logMetric('global_stats_request', 1);

    const globalStats = stats[0] || {
      totalUsers: 0,
      totalGames: 0,
      totalScore: 0,
      avgScore: 0,
      bestScore: 0
    };

    res.json({
      totalUsers: globalStats.totalUsers,
      totalGames: globalStats.totalGames,
      totalScore: globalStats.totalScore,
      averageScore: Math.round(globalStats.avgScore * 10) / 10,
      bestScore: globalStats.bestScore,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Erreur récupération stats globales:", error);
    monitoring.logError(error, { action: 'get_global_stats' });
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Fonctions utilitaires
function normalizeGameMode(mode) {
  const modeMapping = {
    parc: "disneyland",
    versailles: "versailles",
    versaille: "versailles",
    nevers: "nevers",
    france: "france",
    mondial: "mondial",
    dark: "dark",
  };
  return modeMapping[mode] || mode;
}

function getModeIcon(mode) {
  const icons = {
    france: "/img/France.png",
    mondial: "/img/Mondial.png",
    disneyland: "/img/disney.png",
    nevers: "/img/nevers.png",
    versaille: "/img/versaille.png",
    dark: "/img/lampe.png",
  };
  return icons[mode] || "/img/Mondial.png";
}

function getModeEmoji(mode) {
  const emojis = {
    france: "🇫🇷",
    mondial: "🌍",
    disneyland: "🏰",
    nevers: "🏛️",
    versaille: "👑",
    dark: "🔦",
  };
  return emojis[mode] || "🌍";
}

module.exports = router;
