const jwt = require('jsonwebtoken');

const auth = async (req, res, next) => {
    try {
        // Récupérer le token du header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'Authentification requise' });
        }

        // Vérifier le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token invalide' });
    }
};

module.exports = auth;