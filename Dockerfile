FROM node:18

WORKDIR /usr/src/app

# Copier les fichiers de dépendances
COPY backend/package*.json ./backend/

# Installer les dépendances du backend
WORKDIR /usr/src/app/backend
RUN npm install

# Retourner à la racine et copier tout le projet
WORKDIR /usr/src/app
COPY . .

# Exposer le port 3000
EXPOSE 3000

# Définir le répertoire de travail pour le serveur
WORKDIR /usr/src/app/backend

# Démarrer le serveur
CMD ["npm", "start"]