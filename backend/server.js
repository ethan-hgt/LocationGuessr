const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration des dossiers statiques
app.use('/img', express.static(path.join(__dirname, '../img'))); // Pour les images du site
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Pour les avatars uploadés
app.use('/public', express.static(path.join(__dirname, 'public')));

// Création des dossiers nécessaires
const uploadsDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
const publicDir = path.join(__dirname, 'public');

[uploadsDir, avatarsDir, publicDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Le serveur fonctionne correctement !' });
});

// Route de debug pour vérifier les chemins
app.get('/check-paths', (req, res) => {
    const paths = {
        uploads: fs.existsSync(uploadsDir),
        avatars: fs.existsSync(avatarsDir),
        public: fs.existsSync(publicDir),
        img: fs.existsSync(path.join(__dirname, '../img')),
        defaultAvatar: fs.existsSync(path.join(__dirname, '../img/default-avatar.webp'))
    };
    res.json(paths);
});

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connecté à MongoDB'))
    .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Gestion des erreurs globales
app.use((err, req, res, next) => {
    // Gestion des erreurs Multer
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            message: 'Le fichier est trop volumineux. Taille maximum : 500KB'
        });
    }
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            message: 'Erreur lors de l\'upload du fichier'
        });
    }
    
    console.error(err.stack);
    res.status(500).json({ message: 'Une erreur est survenue sur le serveur' });
});

// Route 404 pour les chemins non trouvés
app.use((req, res) => {
    res.status(404).json({ message: 'Route non trouvée' });
});

app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});