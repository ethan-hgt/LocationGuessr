const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { GAME_MODES } = require("./gameMode");
const nodemailer = require("nodemailer");
const auth = require("../middlewares/auth");

// Config pour l'envoi des mails (reset password, etc)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Vérifie si l'email a un format valide
const validateEmail = (req, res, next) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(req.body.email)) {
    return res.status(400).json({ message: "Format d'email invalide." });
  }
  next();
};

// Inscription d'un nouveau joueur
// Crée le compte et initialise toutes les stats à 0
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Cet email ou nom d'utilisateur est déjà utilisé.",
      });
    }

    // Initialiser les stats pour tous les modes
    const initialStats = {
      gamesPlayed: 0,
      totalScore: 0,
      bestScore: 0,
      averageScore: 0,
      lastPlayedDate: null,
      recentGames: [],
    };

    // Ajouter les stats spécifiques pour chaque mode
    Object.keys(GAME_MODES).forEach((mode) => {
      initialStats[`${mode}Mode`] = {
        gamesPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        averageScore: 0,
      };
    });

    // Créer un nouvel utilisateur
    const user = new User({
      username,
      email,
      password,
      stats: initialStats,
    });

    await user.save();

    // Créer le token JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        stats: user.stats,
      },
    });
  } catch (err) {
    console.error(err);
    if (err.name === "ValidationError") {
      return res.status(400).json({
        message:
          "Validation échouée. Le mot de passe doit contenir au moins 6 caractères.",
      });
    }
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Connexion des joueurs simplifiée
// Vérifie les identifiants et renvoie le token JWT
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Trouver l'utilisateur et inclure le mot de passe
    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      console.log(
        `Tentative de connexion échouée: utilisateur ${username} non trouvé`
      );
      return res.status(400).json({ message: "Identifiants invalides" });
    }

    // Vérifier le mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log(
        `Tentative de connexion échouée: mot de passe incorrect pour ${username}`
      );
      return res.status(400).json({ message: "Identifiants invalides" });
    }

    // Initialiser les stats manquantes si nécessaire
    let statsUpdated = false;
    Object.keys(GAME_MODES).forEach((mode) => {
      const modeKey = `${mode}Mode`;
      if (!user.stats[modeKey]) {
        user.stats[modeKey] = {
          gamesPlayed: 0,
          totalScore: 0,
          bestScore: 0,
          averageScore: 0,
        };
        statsUpdated = true;
      }
    });

    if (statsUpdated) {
      await user.save();
    }

    // Créer le token JWT avec durée fixe de 24h
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    console.log(`Connexion réussie: ${username}`);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        stats: user.stats,
      },
    });
  } catch (err) {
    console.error("Erreur login:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Reset du mdp via email
// Envoie un code à 6 chiffres qui expire après 15min
router.post("/forgot-password", validateEmail, async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`Tentative de réinitialisation pour: ${email}`);

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`Email non trouvé: ${email}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res
        .status(200)
        .json({ message: "Si cet email existe, un code a été envoyé." });
    }

    // Vérifier si un code récent existe déjà
    if (user.resetPasswordExpires && user.resetPasswordExpires > Date.now()) {
      const timeLeft = Math.ceil(
        (user.resetPasswordExpires - Date.now()) / 1000 / 60
      );
      return res.status(429).json({
        message: `Veuillez attendre ${timeLeft} minutes avant de demander un nouveau code.`,
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
          name: "LocationGuessr",
          address: process.env.EMAIL_USER,
        },
        to: email,
        subject: "Code de réinitialisation - LocationGuessr",
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
            `,
      });
      console.log("Email envoyé avec succès à:", email);
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email:", emailError);
      // On continue quand même pour ne pas révéler si l'email existe
    }

    console.log(`Code généré pour ${email}: ${resetCode}`);

    res.json({
      message: "Code de réinitialisation envoyé avec succès.",
      expiresIn: "15 minutes",
    });
  } catch (err) {
    console.error("Erreur forgot-password:", err);
    res.status(500).json({ message: "Erreur lors de l'envoi du code." });
  }
});

router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId).select('+password');

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Mot de passe actuel incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Mot de passe mis à jour avec succès" });
  } catch (error) {
    console.error("Erreur change-password:", error);
    res
      .status(500)
      .json({ message: "Erreur lors du changement de mot de passe" });
  }
});

// Route pour vérifier le code
router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      return res.status(400).json({ message: "Format de code invalide." });
    }

    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      console.log(`Échec de vérification pour ${email}`);
      return res.status(400).json({ message: "Code invalide ou expiré." });
    }

    console.log(`Code vérifié avec succès pour ${email}`);
    res.json({
      message: "Code vérifié avec succès.",
      validUntil: user.resetPasswordExpires,
    });
  } catch (err) {
    console.error("Erreur verify-code:", err);
    res
      .status(500)
      .json({ message: "Erreur lors de la vérification du code." });
  }
});

// Route pour réinitialiser le mot de passe
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    // Validation du nouveau mot de passe
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        message: "Le nouveau mot de passe doit contenir au moins 6 caractères.",
      });
    }

    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({ message: "Code invalide ou expiré." });
    }

    // Vérifier que le nouveau mot de passe est différent de l'ancien
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        message: "Le nouveau mot de passe doit être différent de l'ancien.",
      });
    }

    // Mise à jour du mot de passe
    user.password = newPassword;
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;
    await user.save();

    console.log(`Mot de passe réinitialisé avec succès pour ${email}`);

    res.json({
      message:
        "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.",
    });
  } catch (err) {
    console.error("Erreur reset-password:", err);
    res
      .status(500)
      .json({ message: "Erreur lors de la réinitialisation du mot de passe." });
  }
});

// Suppression de compte
// Nécessite une confirmation par email pour éviter les erreurs
router.post("/delete-account", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user)
      return res.status(404).json({ message: "Utilisateur non trouvé" });

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    user.resetPasswordCode = verificationCode;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    await transporter.sendMail({
      from: { name: "LocationGuessr", address: process.env.EMAIL_USER },
      to: user.email,
      subject: "Confirmation de suppression de compte - LocationGuessr",
      html: `
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: Arial, sans-serif; background-color: #121212; color: #ffffff;">
                    <div style="background-color: #1E1E23; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center;">
                        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 30px;">LocationGuessr</h1>
                        <h2 style="color: #ffffff; font-size: 20px; margin-bottom: 20px;">Confirmation de suppression de compte</h2>
                        <p style="color: #B0B0B0; margin-bottom: 20px;">Code de vérification :</p>
                        <div style="background-color: #2A2A30; padding: 20px; margin: 30px 0; border-radius: 8px; font-size: 32px; letter-spacing: 4px; font-weight: bold;">${verificationCode}</div>
                        <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Ce code expire dans 15 minutes.</p>
                        <div style="padding: 20px; background-color: #2A2A30; border-radius: 8px; margin-top: 30px; font-size: 14px; color: #B0B0B0;">
                            <p style="margin: 0;">Cette action est irréversible. Toutes vos données seront définitivement supprimées.</p>
                        </div>
                    </div>
                </div>
            `,
    });

    res.json({ message: "Code de vérification envoyé" });
  } catch (error) {
    console.error("Erreur delete-account:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.post("/confirm-delete-account", auth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findOne({
      _id: req.userId,
      resetPasswordCode: code,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ message: "Code invalide ou expiré" });

    await User.deleteOne({ _id: req.userId });
    res.json({ message: "Compte supprimé avec succès" });
  } catch (error) {
    console.error("Erreur confirm-delete:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Reset des stats
// Remet tous les scores et moyennes à 0
router.post("/reset-stats", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user)
      return res.status(404).json({ message: "Utilisateur non trouvé" });

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    user.resetPasswordCode = verificationCode;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    await transporter.sendMail({
      from: { name: "LocationGuessr", address: process.env.EMAIL_USER },
      to: user.email,
      subject:
        "Confirmation de réinitialisation des statistiques - LocationGuessr",
      html: `
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: Arial, sans-serif; background-color: #121212; color: #ffffff;">
                    <div style="background-color: #1E1E23; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center;">
                        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 30px;">LocationGuessr</h1>
                        <h2 style="color: #ffffff; font-size: 20px; margin-bottom: 20px;">Confirmation de réinitialisation des statistiques</h2>
                        <p style="color: #B0B0B0; margin-bottom: 20px;">Code de vérification :</p>
                        <div style="background-color: #2A2A30; padding: 20px; margin: 30px 0; border-radius: 8px; font-size: 32px; letter-spacing: 4px; font-weight: bold;">${verificationCode}</div>
                        <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Ce code expire dans 15 minutes.</p>
                        <div style="padding: 20px; background-color: #2A2A30; border-radius: 8px; margin-top: 30px; font-size: 14px; color: #B0B0B0;">
                            <p style="margin: 0;">Cette action est irréversible. Toutes vos statistiques seront réinitialisées.</p>
                        </div>
                    </div>
                </div>
            `,
    });

    res.json({ message: "Code de vérification envoyé" });
  } catch (error) {
    console.error("Erreur reset-stats:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.post("/confirm-reset-stats", auth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findOne({
      _id: req.userId,
      resetPasswordCode: code,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ message: "Code invalide ou expiré" });

    // Réinitialisation des stats
    const initialStats = {
      gamesPlayed: 0,
      totalScore: 0,
      bestScore: 0,
      averageScore: 0,
      lastPlayedDate: null,
      recentGames: [],
      franceMode: {
        gamesPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        averageScore: 0,
      },
      mondialMode: {
        gamesPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        averageScore: 0,
      },
      disneylandMode: {
        gamesPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        averageScore: 0,
      },
      neversMode: {
        gamesPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        averageScore: 0,
      },
      versailleMode: {
        gamesPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        averageScore: 0,
      },
      darkMode: {
        gamesPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        averageScore: 0,
      },
    };

    user.stats = initialStats;
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: "Statistiques réinitialisées avec succès" });
  } catch (error) {
    console.error("Erreur confirm-reset-stats:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route pour rafraîchir le token JWT
// Permet d'éviter les déconnexions fréquentes
router.post("/refresh-token", async (req, res) => {
  try {
    // Récupérer le token depuis les headers
    const authToken = req.header("Authorization")?.replace("Bearer ", "");
    // Ou depuis le body si nécessaire
    const { refreshToken } = req.body;

    if (!authToken && !refreshToken) {
      return res.status(400).json({ 
        message: "Token de rafraîchissement ou token d'authentification manquant"
      });
    }

    let userId;

    // Si on a un token d'authentification, essayer de l'utiliser
    if (authToken) {
      try {
        const decoded = jwt.verify(authToken, process.env.JWT_SECRET, {
          ignoreExpiration: true // Important: accepter les tokens expirés
        });
        userId = decoded.userId;
      } catch (error) {
        if (error.name !== 'TokenExpiredError') {
          // Si erreur autre que l'expiration, rejeter
          return res.status(401).json({ 
            message: "Token d'authentification invalide",
            error: error.name
          });
        }
        // Sinon, on continue avec le refresh token
      }
    }

    // Si pas d'userId obtenu et qu'on a un refresh token, l'utiliser
    if (!userId && refreshToken) {
      try {
        // Ici on pourrait implémenter une vraie logique de refresh token
        // Pour l'instant on vérifie juste qu'il n'est pas vide
        if (!refreshToken.trim()) {
          return res.status(401).json({ message: "Refresh token invalide" });
        }
      } catch (err) {
        return res.status(401).json({ message: "Refresh token invalide" });
      }
    }

    // Trouver l'utilisateur
    const user = userId ? await User.findById(userId) : null;
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Générer un nouveau token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "24h", // Expiration standard
    });

    // Générer aussi un nouveau refresh token si nécessaire
    // Dans une implémentation complète, vous stockeriez ce token dans la BDD
    const newRefreshToken = refreshToken || Math.random().toString(36).substring(2);

    res.json({
      token,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        stats: user.stats,
      },
    });
  } catch (error) {
    console.error("Erreur refresh token:", error);
    res.status(500).json({ message: "Erreur lors du rafraîchissement du token" });
  }
});

module.exports = router;
