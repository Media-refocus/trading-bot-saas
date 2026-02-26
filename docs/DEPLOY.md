# Guía de Deploy - Trading Bot SaaS

## Requisitos Previos

- Node.js 18+
- Cuenta en Vercel (recomendado) o servidor VPS
- Base de datos PostgreSQL (recomendado para producción)

## Variables de Entorno

Crea un archivo `.env.production` con:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/tradingbot?schema=public"

# Auth
AUTH_SECRET="tu-clave-secreta-muy-larga-y-segura"
NEXTAUTH_URL="https://tu-dominio.com"

# App
NEXT_PUBLIC_APP_URL="https://tu-dominio.com"

# Stripe (opcional, para pagos)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

## Deploy en Vercel

### 1. Instalar CLI de Vercel
```bash
npm i -g vercel
```

### 2. Login y deploy
```bash
vercel login
vercel --prod
```

### 3. Configurar variables de entorno
En el dashboard de Vercel, añade las variables de entorno.

### 4. Configurar build command
El archivo `vercel.json` ya está configurado con:
- Build command: `prisma generate && next build`
- Región: Madrid (mad1)
- Functions con maxDuration de 30s para API routes

## Migración a PostgreSQL

El proyecto usa SQLite en desarrollo. Para producción:

### 1. Crear base de datos PostgreSQL
- Opción A: [Vercel Postgres](https://vercel.com/storage/postgres)
- Opción B: [Neon](https://neon.tech) (serverless)
- Opción C: [Railway](https://railway.app) (VPS con PostgreSQL)

### 2. Actualizar schema de Prisma
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 3. Ejecutar migración
```bash
# Generar cliente
npx prisma generate

# Crear migración inicial
npx prisma migrate dev --name init_postgresql

# En producción
npx prisma migrate deploy
```

## Base de Datos de Ticks

Los ticks históricos (70M+ registros) requieren almacenamiento especial:

### Opción A: PostgreSQL con particionamiento
```sql
-- Crear tabla particionada por mes
CREATE TABLE tick_data (
    id BIGSERIAL,
    symbol VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    bid DOUBLE PRECISION NOT NULL,
    ask DOUBLE PRECISION NOT NULL,
    spread DOUBLE PRECISION NOT NULL
) PARTITION BY RANGE (timestamp);

-- Crear particiones mensuales
CREATE TABLE tick_data_2024_01 PARTITION OF tick_data
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Opción B: S3/R2 para archivos comprimidos
- Almacenar ticks en archivos Parquet comprimidos
- Descargar bajo demanda para backtests
- Reduce costos de base de datos significativamente

### Opción C: TimescaleDB
- Extensión de PostgreSQL para time-series
- Compresión automática de datos históricos
- Consultas rápidas por rango de fechas

## Checklist Pre-Deploy

- [ ] Variables de entorno configuradas
- [ ] AUTH_SECRET generado con `openssl rand -base64 32`
- [ ] Base de datos PostgreSQL configurada
- [ ] Migraciones ejecutadas: `npx prisma migrate deploy`
- [ ] Build exitoso: `npm run build`
- [ ] Tests pasando: `npm test`
- [ ] Stripe en modo live (si aplica)

## Comandos Útiles

```bash
# Generar AUTH_SECRET
openssl rand -base64 32

# Verificar build local
npm run build
npm run start

# Ver migraciones pendientes
npx prisma migrate status

# Reset DB (solo desarrollo)
npx prisma migrate reset

# Ver datos con Prisma Studio
npx prisma studio
```

## Monitoreo

Recomendado:
- **Vercel Analytics** - Métricas de rendimiento
- **Sentry** - Error tracking
- **Logflare/Datadog** - Logs centralizados
- **Uptime Robot** - Monitoreo de disponibilidad

## Deploy con Docker (Alternativa a Vercel)

```bash
# Construir imagen
npm run docker:build

# Levantar servicios
npm run docker:up

# Ver logs
docker-compose logs -f
```

Ver `Dockerfile` y `docker-compose.yml` para más detalles.

## Rollback

En Vercel:
1. Ve al dashboard del proyecto
2. Click en "Deployments"
3. Click en los tres puntos del deploy anterior
4. Selecciona "Promote to Production"

Con Docker:
```bash
# Ver imágenes disponibles
docker images

# Hacer rollback a versión anterior
docker-compose down
docker tag trading-bot-saas:previous trading-bot-saas:latest
docker-compose up -d
```

## Troubleshooting

### Error: "Prisma Client could not be generated"
```bash
npx prisma generate
```

### Error: "Database connection failed"
- Verificar DATABASE_URL
- Verificar que la DB acepte conexiones externas
- En Vercel, verificar que las variables de entorno estén configuradas

### Error: "Build timeout"
- Reducir tamaño de dependencias
- Usar `output: 'standalone'` en next.config.mjs
- Aumentar timeout en vercel.json

### Error: "Auth secret not set"
- Generar AUTH_SECRET: `openssl rand -base64 32`
- Añadir a variables de entorno en Vercel
