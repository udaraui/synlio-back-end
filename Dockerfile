# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Optional: check build output
RUN ls -R ./dist

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

# Copy package.json and install only production deps
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Copy build artifacts
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8000

# Use environment variable NODE_ENV to control behavior
ENV NODE_ENV=development

# Start app
CMD ["node", "dist/main.js"]
