# Use a imagem oficial do Node.js como base
FROM node:18-slim

# Cria e define o diretório de trabalho
WORKDIR /usr/src/app

# Copia os arquivos package.json e package-lock.json
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o resto dos arquivos do projeto
COPY . .

# Expõe a porta que o app usa
EXPOSE 4001

# Comando para iniciar o app
CMD ["node", "index.js"]