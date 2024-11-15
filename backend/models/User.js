const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const modeStatsSchema = {
    gamesPlayed: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 }
};

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    avatarUrl: {
        type: String,
        default: '/img/default-avatar.webp'
    },
    stats: {
        gamesPlayed: { type: Number, default: 0 },
        totalScore: { type: Number, default: 0 },
        bestScore: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
        lastPlayedDate: { type: Date },
        franceMode: modeStatsSchema,
        mondialMode: modeStatsSchema,
        disneylandMode: modeStatsSchema,
        neversMode: modeStatsSchema,
        versailleMode: modeStatsSchema,
        darkMode: modeStatsSchema,
        recentGames: [{
            mode: String,
            score: Number,
            date: { type: Date, default: Date.now }
        }]
    }
}, {
    timestamps: true
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);