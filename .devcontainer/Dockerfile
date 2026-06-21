FROM mcr.microsoft.com/devcontainers/php:1-8.4

ENV DEBIAN_FRONTEND=noninteractive

# Remove broken Yarn repo if present, then install dependencies
RUN rm -f /etc/apt/sources.list.d/yarn.list || true \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    zip \
    unzip \
    git \
    curl \
    gnupg \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-configure gd \
    --with-freetype \
    --with-jpeg \
 && docker-php-ext-install gd pdo pdo_mysql mysqli

 RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y nodejs