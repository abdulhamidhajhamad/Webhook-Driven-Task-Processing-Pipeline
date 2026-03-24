FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc
RUN cp -r src/core/db/migrations dist/core/db/
EXPOSE 3000
CMD ["node", "dist/api/server.js"]