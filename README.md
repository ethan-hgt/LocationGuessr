# Location Guessr

**Location Guessr** est une webapp inspirée du jeu GeoGuessr. Le but est simple : le joueur est placé aléatoirement sur une carte à 360°, et doit deviner où il se trouve le plus précisément possible.

## Fonctionnalités

- **Modes de jeu variés** :
  - Monde
  - France (divisée en zones)
  - Monuments et lieux célèbres
  - Mode Lampe Torche (vision limitée autour du curseur)

- **Vue à 360° avec Google Street View**
- **Carte interactive** pour placer ses guesses
- **Chronomètre** et gestion du temps
- **Système de score** basé sur la distance et le temps
- **Comptes utilisateurs** :
  - Création de compte
  - Connexion
  - Profil avec statistiques et progression
  - Classement global des joueurs

## Stack technique

- **Front-end** : HTML, CSS, JavaScript
- **Back-end** : Node.js + MongoDB
- **API** : Google Street View / MapBox
- **Outils utilisés** :
  - Notion (organisation de projet en Kanban, planning)
  - GitHub Desktop (gestion de version)
  - Jest (tests unitaires)
  - Railway / Infomaniak (tests d’hébergement)

## Optimisations apportées

Dans le cadre d’un projet d’optimisation (SAÉ), plusieurs aspects ont été améliorés :

- **Performance** : meilleure gestion des assets, allègement du code
- **Éco-conception** : réduction du nombre de requêtes API inutiles, chargement conditionnel
- **Sécurité** : protection des endpoints, nettoyage des inputs, gestion des tokens
- **Accessibilité** : contraste renforcé, navigation clavier possible
- **Responsive design** : compatible desktop, tablette, mobile

## Équipe projet

Développé en binôme par **Basile Parrain** et **Ethan Hugerot**, étudiants en 2ᵉ année de BUT Informatique (IUT Dijon, site de Nevers).  
Ce projet a été réalisé en deux étapes :
1. Création d’une première version de Location Guessr (SAÉ 2.01)
2. Optimisation complète de l’application (SAÉ 2.05)

## Licence

Ce projet est réalisé à but pédagogique et n'est pas destiné à un usage commercial.  
Les images et données utilisées (ex. Google Street View) appartiennent à leurs propriétaires respectifs.

---

**Vous aimez le projet ? Laissez une étoile.**  
Pour toute suggestion ou bug, n'hésitez pas à ouvrir une *issue*.
