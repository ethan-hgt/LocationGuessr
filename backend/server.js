const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer'); // Ajouté pour la gestion des erreurs multer
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

// Route pour vérifier les modes disponibles
app.get('/api/modes', (req, res) => {
    const modes = {
        france: {
            name: 'France',
            icon: '/img/France.png'
        },
        mondial: {
            name: 'Mondial',
            icon: '/img/Mondial.png'
        },
        disneyland: {
            name: 'Disneyland',
            icon: '/img/disney.png'
        },
        nevers: {
            name: 'Nevers',
            icon: '/img/nevers.png'
        },
        versaille: {
            name: 'Versaille',
            icon: '/img/versaille.png'
        },
        dark: {
            name: 'Dark Mode',
            icon: '/img/lampe.png'
        }
    };
    res.json(modes);
});

// Connexion à MongoDB avec options améliorées
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: true, // Pour les performances en production, mettre à false
    serverSelectionTimeoutMS: 5000, // Timeout après 5 secondes
    socketTimeoutMS: 45000, // Ferme les sockets après 45 secondes
    family: 4 // Utilise IPv4, ignorer IPv6
})
.then(() => console.log('Connecté à MongoDB'))
.catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Middleware de logging pour le debug en développement
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}

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
    
    // Log de l'erreur en développement
    if (process.env.NODE_ENV !== 'production') {
        console.error(err.stack);
    }
    
    // Gestion des erreurs de validation MongoDB
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            message: 'Erreur de validation',
            details: Object.values(err.errors).map(error => error.message)
        });
    }

    // Gestion des erreurs de duplicate key MongoDB
    if (err.code === 11000) {
        return res.status(400).json({
            message: 'Cette valeur existe déjà'
        });
    }

    res.status(500).json({ 
        message: 'Une erreur est survenue sur le serveur',
        error: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
});

// Route 404 pour les chemins non trouvés
app.use((req, res) => {
    res.status(404).json({ message: 'Route non trouvée' });
});

// Gestion propre de la fermeture
process.on('SIGTERM', () => {
    console.log('SIGTERM reçu. Fermeture propre...');
    mongoose.connection.close()
        .then(() => {
            console.log('MongoDB déconnecté');
            process.exit(0);
        })
        .catch(err => {
            console.error('Erreur lors de la fermeture de MongoDB:', err);
            process.exit(1);
        });
});

app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});