# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY qri-frontend/package*.json ./
RUN npm ci
COPY qri-frontend/ ./
RUN npx vite build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY qri-backend/package*.json ./
RUN npm ci
COPY qri-backend/prisma ./prisma
RUN npx prisma generate
COPY qri-backend/tsconfig.json ./
COPY qri-backend/src ./src
RUN npm run build

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app

COPY qri-backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY qri-backend/prisma ./prisma
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
