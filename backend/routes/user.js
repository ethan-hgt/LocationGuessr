const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration de Multer pour l'upload des avatars
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads', 'avatars');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function(req, file, cb) {
        const userId = req.userId;
        cb(null, `avatar-${userId}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 // 500KB max
    },
    fileFilter: function(req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Seuls les formats JPG, PNG et WebP sont acceptés.'), false);
        }
        cb(null, true);
    }
});

// Route pour obtenir le profil
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route pour mettre à jour le profil
router.put('/profile', auth, async (req, res) => {
    try {
        const updates = req.body;
        const allowedUpdates = ['username', 'email'];
        
        const filteredUpdates = Object.keys(updates)
            .filter(key => allowedUpdates.includes(key))
            .reduce((obj, key) => {
                obj[key] = updates[key];
                return obj;
            }, {});

        if (updates.username || updates.email) {
            const existingUser = await User.findOne({
                $and: [
                    { _id: { $ne: req.userId } },
                    {
                        $or: [
                            { username: updates.username },
                            { email: updates.email }
                        ]
                    }
                ]
            });

            if (existingUser) {
                return res.status(400).json({ 
                    message: 'Ce nom d\'utilisateur ou cet email est déjà utilisé.' 
                });
            }
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            filteredUpdates,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route pour upload l'avatar
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Aucun fichier uploadé' });
        }

        // Récupérer l'utilisateur pour vérifier l'ancien avatar
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // Supprimer l'ancien avatar s'il existe
        if (user.avatarUrl && !user.avatarUrl.includes('default-avatar')) {
            const oldAvatarPath = path.join(__dirname, '..', 'uploads', 'avatars', path.basename(user.avatarUrl));
            if (fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
        }

        // Nouveau chemin de l'avatar
        const avatarUrl = `/uploads/avatars/avatar-${req.userId}${path.extname(req.file.originalname)}`;

        // Mettre à jour l'utilisateur
        await User.findByIdAndUpdate(req.userId, { avatarUrl });

        res.json({
            success: true,
            avatarUrl: avatarUrl
        });
    } catch (error) {
        console.error('Erreur lors de l\'upload de l\'avatar:', error);
        res.status(500).json({ message: 'Erreur lors de l\'upload de l\'avatar' });
    }
});

// Route pour mettre à jour les stats
router.post('/stats', auth, async (req, res) => {
    try {
        const { score, mode, gameDetails } = req.body;
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // Mise à jour des stats globales
        user.stats.gamesPlayed += 1;
        user.stats.totalScore += score;
        user.stats.averageScore = user.stats.totalScore / user.stats.gamesPlayed;
        user.stats.bestScore = Math.max(user.stats.bestScore, score);
        user.stats.lastPlayedDate = new Date();

        // Mise à jour des stats par mode
        const modeStats = mode === 'france' ? user.stats.franceMode : user.stats.worldMode;
        modeStats.gamesPlayed += 1;
        modeStats.totalScore += score;
        modeStats.averageScore = modeStats.totalScore / modeStats.gamesPlayed;
        modeStats.bestScore = Math.max(modeStats.bestScore, score);

        // Ajouter la partie à l'historique récent
        user.stats.recentGames.unshift({
            mode,
            score,
            date: new Date()
        });

        // Garder seulement les 10 dernières parties
        user.stats.recentGames = user.stats.recentGames.slice(0, 10);

        await user.save();

        res.json({
            message: 'Statistiques mises à jour',
            stats: user.stats
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

router.get('/stats', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        if (!user.stats.franceMode) {
            user.stats.franceMode = {
                gamesPlayed: 0,
                totalScore: 0,
                bestScore: 0,
                averageScore: 0
            };
        }
        if (!user.stats.worldMode) {
            user.stats.worldMode = {
                gamesPlayed: 0,
                totalScore: 0,
                bestScore: 0,
                averageScore: 0
            };
        }

        const stats = {
            totalGames: user.stats.gamesPlayed || 0,
            bestScore: user.stats.bestScore || 0,
            averageScore: user.stats.averageScore || 0,
            franceMode: user.stats.franceMode,
            worldMode: user.stats.worldMode,
            recentGames: user.stats.recentGames || []
        };

        res.json(stats);
    } catch (error) {
        console.error('Erreur lors de la récupération des stats:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des statistiques' });
    }
});

// Route pour obtenir le classement
router.get('/leaderboard', async (req, res) => {
    try {
        const topPlayers = await User.find({
            'stats.gamesPlayed': { $gt: 0 }
        })
        .select('username stats.bestScore stats.gamesPlayed stats.averageScore stats.totalScore stats.lastPlayedDate')
        .sort({ 'stats.bestScore': -1 })
        .limit(10);

        const formattedLeaderboard = topPlayers.map((player, index) => ({
            rank: index + 1,
            username: player.username,
            stats: {
                bestScore: player.stats.bestScore,
                averageScore: Math.round(player.stats.averageScore * 10) / 10,
                gamesPlayed: player.stats.gamesPlayed,
                totalScore: player.stats.totalScore,
                lastPlayed: player.stats.lastPlayedDate ? 
                    new Date(player.stats.lastPlayedDate).toLocaleDateString() : 
                    'Jamais'
            }
        }));

        res.json({
            totalPlayers: await User.countDocuments({ 'stats.gamesPlayed': { $gt: 0 } }),
            leaderboard: formattedLeaderboard
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Ajouter une route pour obtenir la position d'un joueur spécifique
router.get('/rank/:userId', async (req, res) => {
    try {
        const players = await User.find({
            'stats.gamesPlayed': { $gt: 0 }
        })
        .sort({ 'stats.bestScore': -1 });

        const playerIndex = players.findIndex(p => p._id.toString() === req.params.userId);
        
        if (playerIndex === -1) {
            return res.status(404).json({ message: 'Joueur non trouvé' });
        }

        res.json({
            rank: playerIndex + 1,
            totalPlayers: players.length
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route pour obtenir les stats détaillées d'un joueur
router.get('/stats/details', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('username stats');

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        const rank = await User.countDocuments({
            'stats.bestScore': { $gt: user.stats.bestScore }
        }) + 1;

        const totalPlayers = await User.countDocuments({ 'stats.gamesPlayed': { $gt: 0 } });

        const playersBelow = await User.countDocuments({ 
            'stats.bestScore': { $lt: user.stats.bestScore },
            'stats.gamesPlayed': { $gt: 0 }
        });

        const stats = {
            username: user.username,
            rank,
            totalPlayers,
            currentStats: {
                gamesPlayed: user.stats.gamesPlayed,
                bestScore: user.stats.bestScore,
                averageScore: Math.round(user.stats.averageScore * 10) / 10,
                totalScore: user.stats.totalScore,
                lastPlayed: user.stats.lastPlayedDate ? 
                    new Date(user.stats.lastPlayedDate).toLocaleDateString() : 
                    'Jamais'
            },
            percentile: totalPlayers > 0 ? Math.round((playersBelow / totalPlayers) * 100) : 0
        };

        res.json(stats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;