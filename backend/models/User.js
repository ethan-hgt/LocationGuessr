const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Schema pour les stats de chaque mode de jeu
// Stocke les scores, moyennes etc pour chaque mode
const modeStatsSchema = {
  gamesPlayed: { type: Number, default: 0, min: 0 },
  totalScore: { type: Number, default: 0, min: 0 },
  bestScore: { type: Number, default: 0, min: 0 },
  averageScore: { type: Number, default: 0, min: 0 },
};

// Schema pour les jeux récents
const recentGameSchema = {
  mode: { 
    type: String, 
    required: true,
    enum: ['france', 'mondial', 'disneyland', 'nevers', 'versaille', 'dark']
  },
  modeIcon: String,
  modeEmoji: String,
  score: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
};

// Schema principal pour les utilisateurs
// Contient toutes les infos du compte et les stats de jeu
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Le nom d'utilisateur est requis"],
      unique: true,
      trim: true,
      minlength: [3, "Le nom d'utilisateur doit contenir au moins 3 caractères"],
      maxlength: [20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères"],
      match: [/^[a-zA-Z0-9_]+$/, "Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscores"],
      index: true // Index pour les recherches par username
    },
    email: {
      type: String,
      required: [true, "L'email est requis"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Format d'email invalide"],
      index: true // Index pour les recherches par email
    },
    password: {
      type: String,
      required: [true, "Le mot de passe est requis"],
      minlength: [6, "Le mot de passe doit contenir au moins 6 caractères"],
      select: false // Ne pas inclure le mot de passe dans les requêtes par défaut
    },
    resetPasswordCode: {
      type: String,
      default: null,
      select: false // Ne pas inclure dans les requêtes par défaut
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false // Ne pas inclure dans les requêtes par défaut
    },
    avatarData: {
      type: String,
      default: null,
    },
    stats: {
      // Stats globales du joueur
      gamesPlayed: { type: Number, default: 0, min: 0 },
      totalScore: { type: Number, default: 0, min: 0 },
      bestScore: { type: Number, default: 0, min: 0 },
      averageScore: { type: Number, default: 0, min: 0 },
      lastPlayedDate: { type: Date },

      // Stats pour chaque mode de jeu
      franceMode: modeStatsSchema,
      mondialMode: modeStatsSchema,
      disneylandMode: modeStatsSchema,
      neversMode: modeStatsSchema,
      versailleMode: modeStatsSchema,
      darkMode: modeStatsSchema,

      // Historique des 10 dernières parties (limité pour éviter la croissance infinie)
      recentGames: {
        type: [recentGameSchema],
        default: [],
        validate: {
          validator: function(v) {
            return v.length <= 10; // Maximum 10 jeux récents
          },
          message: 'Maximum 10 jeux récents autorisés'
        }
      },
    },
    // Champs pour les métadonnées
    lastLogin: { type: Date },
    loginCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    // Options pour optimiser les performances
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.password;
        delete ret.resetPasswordCode;
        delete ret.resetPasswordExpires;
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.password;
        delete ret.resetPasswordCode;
        delete ret.resetPasswordExpires;
        return ret;
      }
    }
  }
);

// Index composés pour optimiser les requêtes fréquentes
userSchema.index({ "stats.bestScore": -1, "stats.gamesPlayed": -1 }); // Pour le leaderboard global
userSchema.index({ "stats.mondialMode.bestScore": -1, "stats.mondialMode.gamesPlayed": -1 }); // Leaderboard mondial
userSchema.index({ "stats.franceMode.bestScore": -1, "stats.franceMode.gamesPlayed": -1 }); // Leaderboard France
userSchema.index({ "stats.disneylandMode.bestScore": -1, "stats.disneylandMode.gamesPlayed": -1 }); // Leaderboard Disney
userSchema.index({ "stats.neversMode.bestScore": -1, "stats.neversMode.gamesPlayed": -1 }); // Leaderboard Nevers
userSchema.index({ "stats.versailleMode.bestScore": -1, "stats.versailleMode.gamesPlayed": -1 }); // Leaderboard Versailles
userSchema.index({ "stats.darkMode.bestScore": -1, "stats.darkMode.gamesPlayed": -1 }); // Leaderboard Dark

// Index pour les recherches par date
userSchema.index({ "stats.lastPlayedDate": -1 });
userSchema.index({ "lastLogin": -1 });

// Index pour les recherches textuelles (optionnel, pour de futures fonctionnalités)
userSchema.index({ username: "text", email: "text" });

// Virtual pour calculer le score moyen global
userSchema.virtual('stats.globalAverageScore').get(function() {
  if (this.stats.gamesPlayed === 0) return 0;
  return Math.round((this.stats.totalScore / this.stats.gamesPlayed) * 10) / 10;
});

// Virtual pour obtenir l'avatar URL
userSchema.virtual('avatarUrl').get(function() {
  return this.avatarData || '/img/default-avatar.webp';
});

// Middleware pre-save pour hasher le mot de passe
userSchema.pre("save", async function (next) {
  // Ne hasher que si le mot de passe a été modifié
  if (!this.isModified("password")) return next();
  
  try {
    const salt = await bcrypt.genSalt(12); // Augmenté de 10 à 12 pour plus de sécurité
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware pre-save pour mettre à jour les stats globales
userSchema.pre("save", function(next) {
  // Calculer les stats globales basées sur les modes individuels
  const modes = ['franceMode', 'mondialMode', 'disneylandMode', 'neversMode', 'versailleMode', 'darkMode'];
  
  let totalGames = 0;
  let totalScore = 0;
  let bestScore = 0;
  
  modes.forEach(mode => {
    if (this.stats[mode]) {
      totalGames += this.stats[mode].gamesPlayed || 0;
      totalScore += this.stats[mode].totalScore || 0;
      bestScore = Math.max(bestScore, this.stats[mode].bestScore || 0);
    }
  });
  
  this.stats.gamesPlayed = totalGames;
  this.stats.totalScore = totalScore;
  this.stats.bestScore = bestScore;
  this.stats.averageScore = totalGames > 0 ? Math.round((totalScore / totalGames) * 10) / 10 : 0;
  
  next();
});

// Méthode pour comparer le mot de passe
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Erreur lors de la comparaison du mot de passe');
  }
};

// Méthode pour mettre à jour les stats d'un mode
userSchema.methods.updateModeStats = function(mode, score, gameDetails = {}) {
  const modeKey = `${mode}Mode`;
  
  if (!this.stats[modeKey]) {
    this.stats[modeKey] = {
      gamesPlayed: 0,
      totalScore: 0,
      bestScore: 0,
      averageScore: 0
    };
  }
  
  // Mettre à jour les stats du mode
  this.stats[modeKey].gamesPlayed += 1;
  this.stats[modeKey].totalScore += score;
  this.stats[modeKey].bestScore = Math.max(this.stats[modeKey].bestScore, score);
  this.stats[modeKey].averageScore = Math.round((this.stats[modeKey].totalScore / this.stats[modeKey].gamesPlayed) * 10) / 10;
  
  // Mettre à jour les stats globales
  this.stats.lastPlayedDate = new Date();
  
  // Ajouter au jeu récent
  const recentGame = {
    mode: mode,
    modeIcon: gameDetails.modeIcon || `/img/${mode}.png`,
    modeEmoji: gameDetails.modeEmoji || '🎮',
    score: score,
    date: new Date()
  };
  
  this.stats.recentGames.unshift(recentGame);
  
  // Garder seulement les 10 derniers jeux
  if (this.stats.recentGames.length > 10) {
    this.stats.recentGames = this.stats.recentGames.slice(0, 10);
  }
  
  return this;
};

// Méthode statique pour obtenir le leaderboard optimisé
userSchema.statics.getLeaderboard = function(mode = null, limit = 10) {
  let sortCriteria = {};
  let query = {};
  
  if (mode && mode !== 'all') {
    const modeKey = `${mode}Mode`;
    sortCriteria[`stats.${modeKey}.bestScore`] = -1;
    query[`stats.${modeKey}.gamesPlayed`] = { $gt: 0 };
  } else {
    sortCriteria["stats.bestScore"] = -1;
    query["stats.gamesPlayed"] = { $gt: 0 };
  }
  
  return this.find(query)
    .select('username avatarData stats')
    .sort(sortCriteria)
    .limit(limit)
    .lean(); // Utiliser lean() pour de meilleures performances
};

// Méthode statique pour obtenir les statistiques globales
userSchema.statics.getGlobalStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        totalGames: { $sum: "$stats.gamesPlayed" },
        totalScore: { $sum: "$stats.totalScore" },
        averageScore: { $avg: "$stats.averageScore" }
      }
    }
  ]);
};

module.exports = mongoose.model("User", userSchema);
