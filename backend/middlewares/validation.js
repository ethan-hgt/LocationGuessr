const { body, validationResult } = require('express-validator');

// Middleware pour gérer les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Données invalides",
      code: "VALIDATION_ERROR",
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Validation pour l'inscription
const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Le nom d\'utilisateur doit contenir entre 3 et 20 caractères')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Format d\'email invalide'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'),
  
  handleValidationErrors
];

// Validation simplifiée pour la connexion
const validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Le nom d\'utilisateur est requis'),
  
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis'),
  
  handleValidationErrors
];

// Validation pour la réinitialisation de mot de passe
const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Format d\'email invalide'),
  
  handleValidationErrors
];

// Validation pour la réinitialisation de mot de passe avec code
const validateResetPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Format d\'email invalide'),
  
  body('code')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Le code doit contenir exactement 6 chiffres'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'),
  
  handleValidationErrors
];

// Validation pour la sauvegarde de score
const validateScore = [
  body('score')
    .isInt({ min: 0, max: 10000 })
    .withMessage('Le score doit être un nombre entier entre 0 et 10000'),
  
  body('mode')
    .isIn(['france', 'mondial', 'disneyland', 'nevers', 'versaille', 'dark'])
    .withMessage('Mode de jeu invalide'),
  
  body('gameDetails.roundsPlayed')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Le nombre de rounds doit être entre 1 et 10'),
  
  body('gameDetails.bestRoundScore')
    .optional()
    .isInt({ min: 0, max: 2000 })
    .withMessage('Le meilleur score de round doit être entre 0 et 2000'),
  
  body('gameDetails.averageDistance')
    .optional()
    .isFloat({ min: 0, max: 20000 })
    .withMessage('La distance moyenne doit être un nombre positif'),
  
  handleValidationErrors
];

// Validation pour la mise à jour du profil
const validateProfileUpdate = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Le nom d\'utilisateur doit contenir entre 3 et 20 caractères')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Format d\'email invalide'),
  
  handleValidationErrors
];

// Validation pour les paramètres de requête
const validateQueryParams = [
  body('mode')
    .optional()
    .isIn(['france', 'mondial', 'disneyland', 'nevers', 'versaille', 'dark', 'all'])
    .withMessage('Mode de jeu invalide'),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100'),
  
  handleValidationErrors
];

// Sanitisation des données
const sanitizeInput = (req, res, next) => {
  // Sanitiser les chaînes de caractères
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  
  // Sanitiser les paramètres de requête
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim();
      }
    });
  }
  
  next();
};

// Validation des types de fichiers pour l'upload d'avatar
const validateAvatarFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      message: "Aucun fichier uploadé",
      code: "NO_FILE"
    });
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 2 * 1024 * 1024; // 2MB

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      message: "Format de fichier non supporté. Utilisez JPG, PNG ou WebP",
      code: "INVALID_FILE_TYPE"
    });
  }

  if (req.file.size > maxSize) {
    return res.status(400).json({
      message: "Fichier trop volumineux. Taille maximum : 2MB",
      code: "FILE_TOO_LARGE"
    });
  }

  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateScore,
  validateProfileUpdate,
  validateQueryParams,
  sanitizeInput,
  validateAvatarFile,
  handleValidationErrors
}; 