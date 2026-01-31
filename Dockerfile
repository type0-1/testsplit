FROM node:20.11.1-bullseye-slim@sha256:5a5a92b3a8d392691c983719dbdc65d9f30085d6dcd65376e7a32e6fe9bf4cbe


RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    maven \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD ["npm", "test"]
