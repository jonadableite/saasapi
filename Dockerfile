FROM node:18-alpine

# Criar diretório da aplicação
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar arquivos do prisma
COPY prisma ./prisma/

# Gerar cliente Prisma
RUN npx prisma generate

# Copiar resto dos arquivos
COPY . .

# Compilar TypeScript
RUN npm run build

# Remover dependências de desenvolvimento
RUN npm prune --production

# Expor porta
EXPOSE 9000

# Comando para iniciar
CMD ["node", "dist/server.js"]
