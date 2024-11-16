const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const User = require('../models/User');
const { validateGameMode, getModeKey } = require('./gameMode');
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
        fileSize: 500 * 1024
    },
    fileFilter: function(req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Seuls les formats JPG, PNG et WebP sont acceptés.'), false);
        }
        cb(null, true);
    }
});

// Dans routes/user.js, route /leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const { mode } = req.query;
        const modeKey = mode ? `${mode}Mode` : null;
        
        let sortCriteria = {};
        let query = {};

        if (modeKey && mode !== 'all') {
            sortCriteria[`stats.${modeKey}.bestScore`] = -1;
            query[`stats.${modeKey}.gamesPlayed`] = { $gt: 0 };
        } else {
            sortCriteria['stats.bestScore'] = -1;
            query['stats.gamesPlayed'] = { $gt: 0 };
        }

        const topPlayers = await User.find(query)
            .select('username avatarUrl stats')
            .sort(sortCriteria)
            .limit(10);

        const formattedLeaderboard = topPlayers.map((player, index) => {
            const stats = modeKey && mode !== 'all' ? player.stats[modeKey] : player.stats;
            return {
                rank: index + 1,
                _id: player._id,
                username: player.username,
                avatarUrl: player.avatarUrl,
                stats: {
                    bestScore: stats ? stats.bestScore || 0 : 0,
                    averageScore: stats ? Math.round((stats.averageScore || 0) * 10) / 10 : 0,
                    gamesPlayed: stats ? stats.gamesPlayed || 0 : 0,
                    lastPlayed: player.stats.lastPlayedDate
                }
            };
        });

        // Calculer les stats globales
        const globalStats = {
            topScore: formattedLeaderboard.length > 0 ? formattedLeaderboard[0].stats.bestScore : 0,
            totalPlayers: await User.countDocuments(query)
        };

        res.json({
            totalPlayers: globalStats.totalPlayers,
            leaderboard: formattedLeaderboard,
            globalStats
        });
    } catch (err) {
        console.error('Erreur leaderboard:', err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route pour obtenir le profil
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        console.log('Utilisateur connecté :', user.username);
        res.json(user);
    } catch (err) {
        console.error('Erreur profile:', err);
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

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        if (user.avatarUrl && !user.avatarUrl.includes('default-avatar')) {
            const oldAvatarPath = path.join(__dirname, '..', 'uploads', 'avatars', path.basename(user.avatarUrl));
            if (fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
        }

        const avatarUrl = `/uploads/avatars/avatar-${req.userId}${path.extname(req.file.originalname)}`;

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
        const { score, mode } = req.body;
        console.log('Mode reçu:', mode); // Pour le debug
        
        if (!mode) {
            return res.status(400).json({ message: 'Mode de jeu non spécifié' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        const modeKey = `${mode}Mode`;
        console.log('ModeKey:', modeKey); // Pour le debug

        // Mise à jour des stats globales
        user.stats.gamesPlayed += 1;
        user.stats.totalScore += score;
        user.stats.averageScore = user.stats.totalScore / user.stats.gamesPlayed;
        user.stats.bestScore = Math.max(user.stats.bestScore, score);
        user.stats.lastPlayedDate = new Date();

        // Initialisation des stats du mode si elles n'existent pas
        if (!user.stats[modeKey]) {
            user.stats[modeKey] = {
                gamesPlayed: 0,
                totalScore: 0,
                bestScore: 0,
                averageScore: 0
            };
        }

        // Mise à jour des stats du mode spécifique
        user.stats[modeKey].gamesPlayed += 1;
        user.stats[modeKey].totalScore += score;
        user.stats[modeKey].averageScore = user.stats[modeKey].totalScore / user.stats[modeKey].gamesPlayed;
        user.stats[modeKey].bestScore = Math.max(user.stats[modeKey].bestScore, score);

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
        console.error('Erreur lors de la mise à jour des stats:', err);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour des statistiques' });
    }
});

// Route pour obtenir le classement
router.post('/stats', auth, async (req, res) => {
    try {
        let { score, mode } = req.body;
        console.log('Mode reçu:', mode);
        
        // Conversion du mode si nécessaire
        if (mode === 'lampe') {
            mode = 'dark';
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        const modeKey = `${mode}Mode`;
        console.log('ModeKey:', modeKey);

        // Mise à jour des stats globales
        user.stats.gamesPlayed += 1;
        user.stats.totalScore += score;
        user.stats.averageScore = user.stats.totalScore / user.stats.gamesPlayed;
        user.stats.bestScore = Math.max(user.stats.bestScore, score);
        user.stats.lastPlayedDate = new Date();

        // Initialisation des stats du mode si elles n'existent pas
        if (!user.stats[modeKey]) {
            user.stats[modeKey] = {
                gamesPlayed: 0,
                totalScore: 0,
                bestScore: 0,
                averageScore: 0
            };
        }

        // Mise à jour des stats du mode spécifique
        user.stats[modeKey].gamesPlayed += 1;
        user.stats[modeKey].totalScore += score;
        user.stats[modeKey].averageScore = user.stats[modeKey].totalScore / user.stats[modeKey].gamesPlayed;
        user.stats[modeKey].bestScore = Math.max(user.stats[modeKey].bestScore, score);

        // Ajouter la partie à l'historique récent avec le bon nom de mode
        user.stats.recentGames.unshift({
            mode: mode, // Utilisez le mode converti
            score,
            date: new Date()
        });

        user.stats.recentGames = user.stats.recentGames.slice(0, 10);

        await user.save();

        res.json({
            message: 'Statistiques mises à jour',
            stats: user.stats
        });

    } catch (err) {
        console.error('Erreur lors de la mise à jour des stats:', err);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour des statistiques' });
    }
});

// Route pour obtenir la position d'un joueur spécifique
router.get('/rank/:userId', async (req, res) => {
    try {
        const { mode } = req.query;
        const modeKey = mode ? getModeKey(mode) : null;
        
        let sortCriteria = {};
        let query = {};

        if (modeKey && mode !== 'all') {
            sortCriteria[`stats.${modeKey}.bestScore`] = -1;
            query[`stats.${modeKey}.gamesPlayed`] = { $gt: 0 };
        } else {
            sortCriteria['stats.bestScore'] = -1;
            query['stats.gamesPlayed'] = { $gt: 0 };
        }

        const players = await User.find(query).sort(sortCriteria);
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
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // S'assurer que chaque mode a des stats initialisées
        const modes = ['france', 'mondial', 'disneyland', 'nevers', 'versaille', 'dark'];
        modes.forEach(mode => {
            const modeKey = `${mode}Mode`;
            if (!user.stats[modeKey]) {
                user.stats[modeKey] = {
                    gamesPlayed: 0,
                    totalScore: 0,
                    bestScore: 0,
                    averageScore: 0
                };
            }
        });

        const currentStats = {
            ...user.stats,
            gamesPlayed: user.stats.gamesPlayed || 0,
            bestScore: user.stats.bestScore || 0,
            averageScore: user.stats.averageScore || 0,
            lastPlayed: user.stats.lastPlayedDate,
            franceMode: user.stats.franceMode || { gamesPlayed: 0, averageScore: 0, bestScore: 0 },
            mondialMode: user.stats.mondialMode || { gamesPlayed: 0, averageScore: 0, bestScore: 0 },
            disneylandMode: user.stats.disneylandMode || { gamesPlayed: 0, averageScore: 0, bestScore: 0 },
            neversMode: user.stats.neversMode || { gamesPlayed: 0, averageScore: 0, bestScore: 0 },
            versailleMode: user.stats.versailleMode || { gamesPlayed: 0, averageScore: 0, bestScore: 0 },
            darkMode: user.stats.darkMode || { gamesPlayed: 0, averageScore: 0, bestScore: 0 },
            recentGames: user.stats.recentGames || []
        };

        // Calcul du rang
        const betterPlayers = await User.countDocuments({
            'stats.bestScore': { $gt: user.stats.bestScore }
        });

        // Total des joueurs
        const totalPlayers = await User.countDocuments({
            'stats.gamesPlayed': { $gt: 0 }
        });

        res.json({
            username: user.username,
            rank: betterPlayers + 1,
            totalPlayers,
            currentStats
        });

    } catch (err) {
        console.error('Erreur stats details:', err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;