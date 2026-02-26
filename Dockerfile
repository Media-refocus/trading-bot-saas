# ============================================
# Trading Bot SaaS - Dockerfile
# Multi-stage build optimizado para producción
# ============================================

FROM node:18-alpine AS base

# ============================================
# Stage 1: Dependencies
# ============================================
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm ci

# Generar Prisma Client
RUN npx prisma generate

# ============================================
# Stage 2: Builder
# ============================================
FROM base AS builder
WORKDIR /app

# Copiar dependencias
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables de entorno para build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generar Prisma Client nuevamente (por si acaso)
RUN npx prisma generate

# Build de Next.js
RUN npm run build

# ============================================
# Stage 3: Runner (Producción)
# ============================================
FROM base AS runner
WORKDIR /app

# Variables de entorno
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar archivos públicos
COPY --from=builder /app/public ./public

# Copiar standalone output (requiere output: 'standalone' en next.config.mjs)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copiar Prisma para migraciones en runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Permisos
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
