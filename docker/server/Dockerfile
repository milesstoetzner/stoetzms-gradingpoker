FROM node:22-bookworm AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .
RUN pnpm install
COPY server src
RUN pnpm pkgroll



# Base image with Node.js
FROM node:20-alpine

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy only package manager files first for better cache usage
COPY pnpm-lock.yaml ./
COPY package.json ./

# Install only production dependencies
RUN pnpm install --prod

# Copy the rest of the application code
COPY . .

# Expose the app port (change if your app uses a different one)
EXPOSE 3000

# Start the app
CMD ["node", "index.js"]
