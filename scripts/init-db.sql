-- ============================================
-- Trading Bot SaaS - Init Script para PostgreSQL
-- Se ejecuta automaticamente al crear el contenedor
-- ============================================

-- Crear extension para UUID (necesaria para Prisma)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear extension para cifrado (opcional)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Configurar timezone por defecto
SET timezone = 'UTC';

-- Comentario para identificar la BD
COMMENT ON DATABASE tradingbot IS 'Trading Bot SaaS - Multi-tenant trading automation platform';
