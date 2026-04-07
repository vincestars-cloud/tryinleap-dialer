FROM node:20-slim

WORKDIR /app

# Install client deps and build
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

# Install server deps
COPY server/package*.json ./server/
RUN cd server && npm install --production

COPY server/ ./server/

EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

CMD ["node", "server/src/index.js"]
