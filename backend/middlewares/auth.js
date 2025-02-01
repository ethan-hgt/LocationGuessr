// Middleware d'authentification
// Vérifie le token JWT et ajoute l'utilisateur à la requête
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    // Récupère le token du header Authorization
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "Authentification requise",
        code: "NO_TOKEN",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Vérifier si l'utilisateur existe toujours
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      req.userId = decoded.userId;
      req.user = user;

      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          message: "Token invalide",
          code: "INVALID_TOKEN",
        });
      }
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Session expirée, veuillez vous reconnecter",
          code: "TOKEN_EXPIRED",
        });
      }
      if (error.message === "USER_NOT_FOUND") {
        return res.status(401).json({
          message: "Utilisateur non trouvé",
          code: "USER_NOT_FOUND",
        });
      }
      throw error;
    }
  } catch (err) {
    console.error("Erreur d'authentification:", err);
    res.status(500).json({
      message: "Erreur serveur lors de l'authentification",
      code: "AUTH_ERROR",
    });
  }
};

module.exports = auth;
