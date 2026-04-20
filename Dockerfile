FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY src ./src
COPY test ./test

EXPOSE 3000
CMD ["npm", "start"]
