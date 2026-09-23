# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci

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
RUN npm ci --omit=dev

# Copy build artifacts
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8000

# Use environment variable NODE_ENV to control behavior
ENV NODE_ENV=development

# Run migrations and start app
CMD ["sh", "-c", "node dist/run-migrations.js && node dist/main.js"]
#CMD ["sh", "-c", "npm run typeorm migration:run && node dist/main.js"]
