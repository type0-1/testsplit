FROM node:20-bullseye-slim 

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["npm", "test"]
