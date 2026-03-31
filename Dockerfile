# Utilisation d'une image Node légère
FROM node:18-alpine

# Dossier de travail dans le conteneur
WORKDIR /usr/src/app

# Installation des dépendances
COPY package*.json ./
RUN npm install --production

# Copie du reste du code
COPY . .

# Exposition du port
EXPOSE 3000

# Lancement du serveur
CMD ["node", "src/server.js"]
