# Zeste : serveur Node (API + fichiers statiques). La base Postgres tourne dans un autre conteneur.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY public ./public
USER node
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:${PORT:-80}/api/health || exit 1
CMD ["node", "server/index.js"]
