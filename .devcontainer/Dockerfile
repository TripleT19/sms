FROM mcr.microsoft.com/devcontainers/php:1-8.4-bullseye

# ------------------------------------------------------------
# Remove broken Yarn repository from the base image
# ------------------------------------------------------------
RUN rm -f /etc/apt/sources.list.d/*yarn* 2>/dev/null || true

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    zip \
    curl \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libzip-dev \
    libonig-dev \
    libxml2-dev \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Install PHP extensions needed for Laravel + MySQL
RUN docker-php-ext-install \
    pdo \
    pdo_mysql \
    mbstring \
    zip \
    exif \
    pcntl \
    bcmath \
    gd

# Copy Composer from the official Composer image
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Install Node.js and Yarn
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -f /usr/bin/yarn /usr/local/bin/yarn /usr/bin/yarnpkg /usr/local/bin/yarnpkg \
    && npm install -g yarn

# Set working directory (must match workspaceFolder in devcontainer.json)
WORKDIR /workspaces/sms

# ------------------------------------------------------------
# NOTE: Do NOT copy project files or run composer install here.
# The project folder is mounted at /workspaces/sms by docker-compose.
# All dependency installation should be done in post-create.sh.
# ------------------------------------------------------------

# Expose Laravel port (informational)
EXPOSE 8000

# Default command (will be overridden by docker-compose "sleep infinity")
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]