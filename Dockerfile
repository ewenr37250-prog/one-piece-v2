# On utilise une version stable de Node
FROM node:18-slim

# On définit le dossier de travail dans le container
WORKDIR /app

# On copie les fichiers de dépendances
COPY package*.json ./

# On installe les modules
RUN npm install --production

# On copie tout le reste du code (dont server.js et index.html)
COPY . .

# On expose le port (Render utilise 10000 par défaut)
EXPOSE 10000

# La commande pour lancer le jeu
CMD ["node", "server.js"]
