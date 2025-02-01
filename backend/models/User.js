const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Schema pour les stats de chaque mode de jeu
// Stocke les scores, moyennes etc pour chaque mode
const modeStatsSchema = {
  gamesPlayed: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
};

// Schema principal pour les utilisateurs
// Contient toutes les infos du compte et les stats de jeu
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    resetPasswordCode: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    avatarData: {
      type: String,
      default: null,
    },
    stats: {
      // Stats globales du joueur
      gamesPlayed: { type: Number, default: 0 },
      totalScore: { type: Number, default: 0 },
      bestScore: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      lastPlayedDate: { type: Date },

      // Stats pour chaque mode de jeu
      franceMode: modeStatsSchema,
      mondialMode: modeStatsSchema,
      disneylandMode: modeStatsSchema,
      neversMode: modeStatsSchema,
      versailleMode: modeStatsSchema,
      darkMode: modeStatsSchema,

      // Historique des 10 dernières parties
      recentGames: [
        {
          mode: String,
          modeIcon: String,
          modeEmoji: String,
          score: Number,
          date: { type: Date, default: Date.now },
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Hash le mot de passe avant la sauvegarde
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Pour comparer le mot de passe lors du login
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
