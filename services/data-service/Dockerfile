FROM node:24-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 3001
CMD ["sh", "-c", "npm run migration:run && npm run start:prod"]
