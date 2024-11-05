const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const User = require('../models/User');

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

// Route pour mettre à jour les stats
router.post('/stats', auth, async (req, res) => {
    try {
        const { score } = req.body;
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // Mettre à jour les stats
        user.stats.gamesPlayed += 1;
        user.stats.totalScore += score;
        user.stats.averageScore = user.stats.totalScore / user.stats.gamesPlayed;
        user.stats.bestScore = Math.max(user.stats.bestScore, score);
        user.stats.lastPlayedDate = new Date();

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



// Route pour obtenir le classement
router.get('/leaderboard', async (req, res) => {
    try {
        const topPlayers = await User.find({
            'stats.gamesPlayed': { $gt: 0 }
        })
        .select('username stats.bestScore stats.gamesPlayed stats.averageScore stats.totalScore stats.lastPlayedDate')
        .sort({ 'stats.bestScore': -1 })
        .limit(10);

        // Ajouter le rang et formater les données
        const formattedLeaderboard = topPlayers.map((player, index) => ({
            rank: index + 1,
            username: player.username,
            stats: {
                bestScore: player.stats.bestScore,
                averageScore: Math.round(player.stats.averageScore * 10) / 10, // Arrondir à 1 décimale
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

        // Obtenir le rang du joueur
        const rank = await User.countDocuments({
            'stats.bestScore': { $gt: user.stats.bestScore }
        }) + 1;

        // Calculer le nombre total de joueurs actifs
        const totalPlayers = await User.countDocuments({ 'stats.gamesPlayed': { $gt: 0 } });

        // Calculer le nombre de joueurs que l'utilisateur dépasse
        const playersBelow = await User.countDocuments({ 
            'stats.bestScore': { $lt: user.stats.bestScore },
            'stats.gamesPlayed': { $gt: 0 }
        });

        // Calculer les statistiques additionnelles
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