FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

RUN npm run build

RUN npm prune --omit=dev && npm cache clean --force

EXPOSE 3000

CMD ["npm", "run", "docker-start"]
