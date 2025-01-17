const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { GAME_MODES } = require('./gameMode');
const nodemailer = require('nodemailer');

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
   service: 'gmail',
   auth: {
       user: process.env.EMAIL_USER,
       pass: process.env.EMAIL_PASS
   }
});

// Middleware de validation d'email
const validateEmail = (req, res, next) => {
   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
   if (!emailRegex.test(req.body.email)) {
       return res.status(400).json({ message: 'Format d\'email invalide.' });
   }
   next();
};

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
       const { username, password, rememberMe } = req.body;

       // Trouver l'utilisateur
       const user = await User.findOne({ username });
       if (!user) {
           console.log(`Tentative de connexion échouée: utilisateur ${username} non trouvé`);
           return res.status(400).json({ message: 'Identifiants invalides' });
       }

       // Vérifier le mot de passe
       const isMatch = await user.comparePassword(password);
       if (!isMatch) {
           console.log(`Tentative de connexion échouée: mot de passe incorrect pour ${username}`);
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

       // Créer le token JWT
       const expiresIn = rememberMe ? '7d' : '24h';
       const token = jwt.sign(
           { userId: user.id },
           process.env.JWT_SECRET,
           { expiresIn }
       );

       console.log(`Connexion réussie: ${username}`);

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
       console.error('Erreur login:', err);
       res.status(500).json({ message: 'Erreur serveur' });
   }
});

// Route pour demander le code de réinitialisation
router.post('/forgot-password', validateEmail, async (req, res) => {
   try {
       const { email } = req.body;
       console.log(`Tentative de réinitialisation pour: ${email}`);

       const user = await User.findOne({ email });
       if (!user) {
           console.log(`Email non trouvé: ${email}`);
           await new Promise(resolve => setTimeout(resolve, 1000));
           return res.status(200).json({ message: 'Si cet email existe, un code a été envoyé.' });
       }

       // Vérifier si un code récent existe déjà
       if (user.resetPasswordExpires && user.resetPasswordExpires > Date.now()) {
           const timeLeft = Math.ceil((user.resetPasswordExpires - Date.now()) / 1000 / 60);
           return res.status(429).json({
               message: `Veuillez attendre ${timeLeft} minutes avant de demander un nouveau code.`
           });
       }

       const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
       const expiration = Date.now() + 15 * 60 * 1000; // 15 minutes

       user.resetPasswordCode = resetCode;
       user.resetPasswordExpires = expiration;
       await user.save();

       // Envoi de l'email
       try {
        await transporter.sendMail({
            from: {
                name: 'LocationGuessr',
                address: process.env.EMAIL_USER
            },
            to: email,
            subject: 'Code de réinitialisation - LocationGuessr',
            html: `
                <div style="
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    font-family: Arial, sans-serif;
                    background-color: #121212;
                    color: #ffffff;
                ">
                    <div style="
                        background-color: #1E1E23;
                        padding: 30px;
                        border-radius: 10px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        text-align: center;
                    ">
                        <h1 style="
                            color: #ffffff;
                            font-size: 24px;
                            margin-bottom: 30px;
                        ">LocationGuessr</h1>
        
                        <h2 style="
                            color: #ffffff;
                            font-size: 20px;
                            margin-bottom: 20px;
                        ">Code de réinitialisation</h2>
        
                        <div style="
                            background-color: #2A2A30;
                            padding: 20px;
                            margin: 30px 0;
                            border-radius: 8px;
                            font-size: 32px;
                            letter-spacing: 4px;
                            font-weight: bold;
                        ">${resetCode}</div>
        
                        <p style="
                            color: #B0B0B0;
                            font-size: 16px;
                            line-height: 1.6;
                            margin-bottom: 20px;
                        ">Ce code expire dans 15 minutes.</p>
        
                        <div style="
                            padding: 20px;
                            background-color: #2A2A30;
                            border-radius: 8px;
                            margin-top: 30px;
                            font-size: 14px;
                            color: #B0B0B0;
                        ">
                            <p style="margin: 0;">Si vous n'avez pas demandé cette réinitialisation,<br>vous pouvez ignorer cet email en toute sécurité.</p>
                        </div>
                    </div>
        
                    <div style="
                        text-align: center;
                        margin-top: 30px;
                        color: #808080;
                        font-size: 12px;
                    ">
                        <p>© ${new Date().getFullYear()} LocationGuessr. Tous droits réservés.</p>
                        <p style="margin-top: 10px">Ceci est un email automatique, merci de ne pas y répondre.</p>
                    </div>
                </div>
            `
        });
           console.log('Email envoyé avec succès à:', email);
       } catch (emailError) {
           console.error('Erreur lors de l\'envoi de l\'email:', emailError);
           // On continue quand même pour ne pas révéler si l'email existe
       }

       console.log(`Code généré pour ${email}: ${resetCode}`);
       
       res.json({ 
           message: 'Code de réinitialisation envoyé avec succès.',
           expiresIn: '15 minutes'
       });
   } catch (err) {
       console.error('Erreur forgot-password:', err);
       res.status(500).json({ message: 'Erreur lors de l\'envoi du code.' });
   }
});

// Route pour vérifier le code
router.post('/verify-reset-code', async (req, res) => {
   try {
       const { email, code } = req.body;

       if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
           return res.status(400).json({ message: 'Format de code invalide.' });
       }

       const user = await User.findOne({
           email,
           resetPasswordCode: code,
           resetPasswordExpires: { $gt: Date.now() }
       });

       if (!user) {
           console.log(`Échec de vérification pour ${email}`);
           return res.status(400).json({ message: 'Code invalide ou expiré.' });
       }

       console.log(`Code vérifié avec succès pour ${email}`);
       res.json({ 
           message: 'Code vérifié avec succès.',
           validUntil: user.resetPasswordExpires
       });
   } catch (err) {
       console.error('Erreur verify-code:', err);
       res.status(500).json({ message: 'Erreur lors de la vérification du code.' });
   }
});

// Route pour réinitialiser le mot de passe
router.post('/reset-password', async (req, res) => {
   try {
       const { email, code, newPassword } = req.body;

       // Validation du nouveau mot de passe
       if (!newPassword || newPassword.length < 6) {
           return res.status(400).json({
               message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.'
           });
       }

       const user = await User.findOne({
           email,
           resetPasswordCode: code,
           resetPasswordExpires: { $gt: Date.now() }
       });

       if (!user) {
           return res.status(400).json({ message: 'Code invalide ou expiré.' });
       }

       // Vérifier que le nouveau mot de passe est différent de l'ancien
       const isSamePassword = await user.comparePassword(newPassword);
       if (isSamePassword) {
           return res.status(400).json({
               message: 'Le nouveau mot de passe doit être différent de l\'ancien.'
           });
       }

       // Mise à jour du mot de passe
       user.password = newPassword;
       user.resetPasswordCode = null;
       user.resetPasswordExpires = null;
       await user.save();

       console.log(`Mot de passe réinitialisé avec succès pour ${email}`);

       res.json({ 
           message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
       });
   } catch (err) {
       console.error('Erreur reset-password:', err);
       res.status(500).json({ message: 'Erreur lors de la réinitialisation du mot de passe.' });
   }
});

module.exports = router;