FROM node:18

WORKDIR /usr/src/app

COPY backend/package*.json ./backend/

WORKDIR /usr/src/app/backend
RUN npm install

WORKDIR /usr/src/app
COPY . .

EXPOSE 3000

CMD ["npm", "start", "--prefix", "backend"]