FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev && npm cache clean --force

EXPOSE 3000

CMD ["npm", "run", "docker-start"]
