# Use a imagem oficial do Node.js como base
FROM node:18-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm install

# Gerar Prisma Client
RUN npx prisma generate

# Copiar o resto dos arquivos do projeto
COPY . .

# Compilar TypeScript
RUN npm run build

# Expor a porta que a aplicação usa
EXPOSE 9000

# Comando para iniciar a aplicação
CMD ["npm", "start"]
