const multer = require("multer");
const path = require("path");
const fs = require("fs");

console.log("[Avatar Config] Initialisation du middleware uploadAvatar");

// Configuration du stockage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(
      __dirname,
      "..",
      "public",
      "uploads",
      "avatars"
    );
    console.log("[Avatar] Dossier de destination:", uploadDir);

    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      console.log("[Avatar] Création du dossier uploads/avatars");
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    console.log("[Avatar] Fichier reçu:", file.originalname);
    console.log("[Avatar] Type MIME:", file.mimetype);

    // Utiliser l'ID de l'utilisateur dans le nom du fichier
    const fileName = `avatar-${req.userId}${path.extname(file.originalname)}`;
    console.log("[Avatar] Nouveau nom de fichier:", fileName);

    cb(null, fileName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (req, file, cb) => {
    console.log("[Avatar] Vérification du type de fichier:", file.mimetype);
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (allowedTypes.includes(file.mimetype)) {
      console.log("[Avatar] Type de fichier accepté");
      cb(null, true);
    } else {
      console.log("[Avatar] Type de fichier rejeté");
      cb(new Error("Format non supporté. Utilisez JPG, PNG ou WebP."));
    }
  },
});

module.exports = upload;
