const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const User = require("../models/User");
const multer = require("multer");
const { GAME_MODES } = require("./gameMode");

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

// Configuration de Multer
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

// Route pour l'upload d'avatar
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

router.get("/leaderboard", async (req, res) => {
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

    const topPlayers = await User.find(query)
      .select("username avatarData stats")
      .sort(sortCriteria)
      .limit(10);

    const formattedLeaderboard = topPlayers.map((player) => {
      const stats =
        modeKey && mode !== "all" ? player.stats[modeKey] : player.stats;
      return {
        _id: player._id,
        username: player.username,
        avatarData: player.avatarData,
        stats: {
          bestScore: stats ? stats.bestScore || 0 : 0,
          averageScore: stats
            ? Math.round((stats.averageScore || 0) * 10) / 10
            : 0,
          gamesPlayed: stats ? stats.gamesPlayed || 0 : 0,
          lastPlayed: player.stats.lastPlayedDate,
        },
      };
    });

    const totalPlayers = await User.countDocuments(query);

    res.json({
      totalPlayers,
      leaderboard: formattedLeaderboard,
    });
  } catch (err) {
    console.error("Erreur leaderboard:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route pour obtenir le profil
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      stats: user.stats,
      createdAt: user.createdAt,
      avatarUrl: user.avatarData || "/img/default-avatar.webp",
    });
  } catch (err) {
    console.error("Erreur profile:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route pour mettre à jour le profil
router.put("/profile", auth, async (req, res) => {
  try {
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

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route pour mettre à jour les stats
router.post("/stats", auth, async (req, res) => {
  try {
    let { score, mode } = req.body;
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

    // Mise à jour de l'historique récent
    user.stats.recentGames.unshift({
      mode: modeInfo.name,
      modeIcon: modeInfo.icon,
      modeEmoji: modeInfo.emoji,
      score,
      date: new Date(),
    });

    user.stats.recentGames = user.stats.recentGames.slice(0, 10);

    await user.save();

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
  } catch (err) {
    console.error("Erreur lors de la mise à jour des stats:", err);
    res
      .status(500)
      .json({
        message: "Erreur serveur lors de la mise à jour des statistiques",
      });
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

// Route pour obtenir les stats détaillées d'un joueur
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

module.exports = router;
