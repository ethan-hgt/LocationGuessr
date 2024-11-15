const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { GAME_MODES } = require('./gameMode');

// Route d'inscription
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                message: 'Cet email ou nom d\'utilisateur est déjà utilisé.' 
            });
        }

        // Initialiser les stats pour tous les modes
        const initialStats = {
            gamesPlayed: 0,
            totalScore: 0,
            bestScore: 0,
            averageScore: 0,
            lastPlayedDate: null,
            recentGames: []
        };

        // Ajouter les stats spécifiques pour chaque mode
        Object.keys(GAME_MODES).forEach(mode => {
            initialStats[`${mode}Mode`] = {
                gamesPlayed: 0,
                totalScore: 0,
                bestScore: 0,
                averageScore: 0
            };
        });

        // Créer un nouvel utilisateur
        const user = new User({
            username,
            email,
            password,
            stats: initialStats
        });

        await user.save();

        // Créer le token JWT
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatarUrl: user.avatarUrl,
                stats: user.stats
            }
        });

    } catch (err) {
        console.error(err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ 
                message: 'Validation échouée. Le mot de passe doit contenir au moins 6 caractères.'
            });
        }
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route de connexion
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Trouver l'utilisateur
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Identifiants invalides' });
        }

        // Vérifier le mot de passe
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Identifiants invalides' });
        }

        // Initialiser les stats manquantes si nécessaire
        let statsUpdated = false;
        Object.keys(GAME_MODES).forEach(mode => {
            const modeKey = `${mode}Mode`;
            if (!user.stats[modeKey]) {
                user.stats[modeKey] = {
                    gamesPlayed: 0,
                    totalScore: 0,
                    bestScore: 0,
                    averageScore: 0
                };
                statsUpdated = true;
            }
        });

        if (statsUpdated) {
            await user.save();
        }

        console.log(`Utilisateur connecté : ${user.username}`);

        // Créer le token JWT
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatarUrl: user.avatarUrl,
                stats: user.stats
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;