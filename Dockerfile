Dockerfile
FROM node:18-alpine


WORKDIR /server


COPY package*.json ./


RUN npm install


COPY . .


RUN npx prisma generate


RUN npm run build


EXPOSE 9000


CMD ["npm", "start"]