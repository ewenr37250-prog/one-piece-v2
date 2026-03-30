# Utilise une image Node.js stable
FROM node:18

# Crée le dossier de l'app
WORKDIR /usr/src/app

# Copie les fichiers de dépendances
COPY package*.json ./

# Installe les outils
RUN npm install

# Copie tout le reste du code (server.js, index.html)
COPY . .

# Expose le port 3000
EXPOSE 3000

# Lance le serveur
CMD [ "node", "server.js" ]
