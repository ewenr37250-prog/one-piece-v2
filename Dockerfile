# Utilisation d'une image Node légère
FROM node:18-alpine

# Dossier de travail dans le conteneur
WORKDIR /usr/src/app

# Installation des dépendances
# On utilise --production pour aller plus vite
COPY package*.json ./
RUN npm install --production

# Copie TOUS les fichiers du dépôt dans le conteneur
COPY . .

# Exposition du port 3000
EXPOSE 3000

# Lancement du serveur (CORRECTION DU CHEMIN ICI)
# On retire "src/" car tes fichiers sont à la racine
CMD ["node", "server.js"]
