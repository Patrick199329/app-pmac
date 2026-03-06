FROM node:18-slim

# Install LibreOffice and fonts
RUN apt-get update && apt-get install -y \
    libreoffice-common \
    libreoffice-writer \
    fonts-liberation \
    fonts-dejavu \
    fonts-freefont-ttf \
    locales \
    && rm -rf /var/lib/apt/lists/*

# Set up Portuguese locale
RUN sed -i -e 's/# pt_BR.UTF-8 UTF-8/pt_BR.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen
ENV LANG pt_BR.UTF-8
ENV LANGUAGE pt_BR:pt
ENV LC_ALL pt_BR.UTF-8

WORKDIR /app

COPY package.json .
RUN npm install

COPY index.js .

# Ensure libreoffice can run without home dir
ENV HOME=/tmp

EXPOSE 3000

CMD ["node", "index.js"]
