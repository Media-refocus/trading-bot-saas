-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('TRIAL', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backtest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT,
    "strategyName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "parameters" JSONB NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProfitPips" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxDrawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitFactor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "ticksProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalTicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Backtest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotAccount" (
    "id" TEXT NOT NULL,
    "botConfigId" TEXT NOT NULL,
    "loginEnc" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "serverEnc" TEXT NOT NULL,
    "pathEnc" TEXT,
    "symbol" TEXT NOT NULL DEFAULT 'XAUUSD',
    "magic" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastBalance" DOUBLE PRECISION,
    "lastEquity" DOUBLE PRECISION,
    "lastMargin" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "telegramApiIdEnc" TEXT,
    "telegramApiHashEnc" TEXT,
    "telegramSessionEnc" TEXT,
    "telegramChannels" JSONB,
    "symbol" TEXT NOT NULL DEFAULT 'XAUUSD',
    "magicNumber" INTEGER NOT NULL DEFAULT 20250101,
    "entryLot" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "entryNumOrders" INTEGER NOT NULL DEFAULT 1,
    "entryTrailingActivate" INTEGER,
    "entryTrailingStep" INTEGER,
    "entryTrailingBack" INTEGER,
    "entryTrailingBuffer" INTEGER,
    "gridStepPips" INTEGER NOT NULL DEFAULT 10,
    "gridLot" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "gridMaxLevels" INTEGER NOT NULL DEFAULT 4,
    "gridNumOrders" INTEGER NOT NULL DEFAULT 1,
    "gridTolerancePips" INTEGER NOT NULL DEFAULT 1,
    "restrictionType" TEXT,
    "maxLevels" INTEGER NOT NULL DEFAULT 4,
    "dailyLossLimitPercent" DOUBLE PRECISION,
    "dailyLossCurrent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyLossResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotHeartbeat" (
    "id" TEXT NOT NULL,
    "botConfigId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT,
    "uptimeSeconds" INTEGER,
    "mt5Connected" BOOLEAN NOT NULL DEFAULT false,
    "telegramConnected" BOOLEAN NOT NULL DEFAULT false,
    "openPositions" INTEGER NOT NULL DEFAULT 0,
    "pendingOrders" INTEGER NOT NULL DEFAULT 0,
    "memoryMB" DOUBLE PRECISION,
    "cpuPercent" DOUBLE PRECISION,
    "errorMessage" TEXT,

    CONSTRAINT "BotHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotPosition" (
    "id" TEXT NOT NULL,
    "botAccountId" TEXT NOT NULL,
    "tradeId" TEXT,
    "mt5Ticket" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "openPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "lotSize" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "virtualSL" DOUBLE PRECISION,
    "unrealizedPL" DOUBLE PRECISION,
    "unrealizedPips" DOUBLE PRECISION,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "signalId" TEXT,
    "tradingAccountId" TEXT,
    "side" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "lotSize" DOUBLE PRECISION NOT NULL,
    "openPrice" DOUBLE PRECISION NOT NULL,
    "closePrice" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "profitPips" DOUBLE PRECISION,
    "profitMoney" DOUBLE PRECISION,
    "level" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedStrategy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentStrategyId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "strategyName" TEXT NOT NULL DEFAULT 'Custom',
    "lotajeBase" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "numOrders" INTEGER NOT NULL DEFAULT 1,
    "pipsDistance" INTEGER NOT NULL DEFAULT 10,
    "maxLevels" INTEGER NOT NULL DEFAULT 4,
    "takeProfitPips" INTEGER NOT NULL DEFAULT 20,
    "stopLossPips" INTEGER,
    "useStopLoss" BOOLEAN NOT NULL DEFAULT false,
    "useTrailingSL" BOOLEAN NOT NULL DEFAULT true,
    "trailingSLPercent" INTEGER NOT NULL DEFAULT 50,
    "restrictionType" TEXT,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxDrawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitFactor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "forksCount" INTEGER NOT NULL DEFAULT 0,
    "downloadsCount" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "botConfigId" TEXT,
    "side" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "symbol" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channelId" TEXT,
    "channelName" TEXT,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "isCloseSignal" BOOLEAN NOT NULL DEFAULT false,
    "restrictionType" TEXT,
    "maxLevels" INTEGER NOT NULL DEFAULT 4,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedTrade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "backtestId" TEXT NOT NULL,
    "signalIndex" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "lotSize" DOUBLE PRECISION NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "profit" DOUBLE PRECISION NOT NULL,
    "profitPips" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategyName" TEXT NOT NULL DEFAULT 'Custom',
    "lotajeBase" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "numOrders" INTEGER NOT NULL DEFAULT 1,
    "pipsDistance" INTEGER NOT NULL DEFAULT 10,
    "maxLevels" INTEGER NOT NULL DEFAULT 4,
    "takeProfitPips" INTEGER NOT NULL DEFAULT 20,
    "stopLossPips" INTEGER,
    "useStopLoss" BOOLEAN NOT NULL DEFAULT false,
    "useTrailingSL" BOOLEAN NOT NULL DEFAULT true,
    "trailingSLPercent" INTEGER NOT NULL DEFAULT 50,
    "restrictionType" TEXT,
    "lastTotalTrades" INTEGER,
    "lastTotalProfit" DOUBLE PRECISION,
    "lastWinRate" DOUBLE PRECISION,
    "lastMaxDrawdown" DOUBLE PRECISION,
    "lastTestedAt" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyComment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publishedStrategyId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publishedStrategyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "stripePriceId" TEXT,
    "stripeSubId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEnd" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'TRIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "telegramChatId" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TickData" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "bid" DOUBLE PRECISION NOT NULL,
    "ask" DOUBLE PRECISION NOT NULL,
    "spread" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TickData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "botConfigId" TEXT,
    "botAccountId" TEXT,
    "signalId" TEXT,
    "side" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "mt5Ticket" INTEGER,
    "openPrice" DOUBLE PRECISION NOT NULL,
    "lotSize" DOUBLE PRECISION NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closePrice" DOUBLE PRECISION,
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "virtualSL" DOUBLE PRECISION,
    "profitPips" DOUBLE PRECISION,
    "profitMoney" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION,
    "swap" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "broker" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "server" TEXT,
    "encryptedApiKey" TEXT NOT NULL,
    "encryptedApiSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "BotAccount_botConfigId_idx" ON "BotAccount"("botConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "BotConfig_tenantId_key" ON "BotConfig"("tenantId");

-- CreateIndex
CREATE INDEX "BotConfig_apiKeyHash_idx" ON "BotConfig"("apiKeyHash");

-- CreateIndex
CREATE INDEX "BotConfig_tenantId_idx" ON "BotConfig"("tenantId");

-- CreateIndex
CREATE INDEX "BotHeartbeat_botConfigId_timestamp_idx" ON "BotHeartbeat"("botConfigId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "BotPosition_tradeId_key" ON "BotPosition"("tradeId");

-- CreateIndex
CREATE INDEX "BotPosition_botAccountId_idx" ON "BotPosition"("botAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BotPosition_botAccountId_mt5Ticket_key" ON "BotPosition"("botAccountId", "mt5Ticket");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "PublishedStrategy_isPublic_idx" ON "PublishedStrategy"("isPublic");

-- CreateIndex
CREATE INDEX "PublishedStrategy_parentStrategyId_idx" ON "PublishedStrategy"("parentStrategyId");

-- CreateIndex
CREATE INDEX "PublishedStrategy_authorId_idx" ON "PublishedStrategy"("authorId");

-- CreateIndex
CREATE INDEX "PublishedStrategy_tenantId_idx" ON "PublishedStrategy"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Signal_botConfigId_status_idx" ON "Signal"("botConfigId", "status");

-- CreateIndex
CREATE INDEX "Signal_tenantId_receivedAt_idx" ON "Signal"("tenantId", "receivedAt");

-- CreateIndex
CREATE INDEX "Strategy_tenantId_idx" ON "Strategy"("tenantId");

-- CreateIndex
CREATE INDEX "StrategyComment_publishedStrategyId_idx" ON "StrategyComment"("publishedStrategyId");

-- CreateIndex
CREATE INDEX "StrategyLike_publishedStrategyId_idx" ON "StrategyLike"("publishedStrategyId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyLike_userId_publishedStrategyId_key" ON "StrategyLike"("userId", "publishedStrategyId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubId_key" ON "Subscription"("stripeSubId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_telegramChatId_key" ON "Tenant"("telegramChatId");

-- CreateIndex
CREATE INDEX "TickData_timestamp_idx" ON "TickData"("timestamp");

-- CreateIndex
CREATE INDEX "TickData_symbol_timestamp_idx" ON "TickData"("symbol", "timestamp");

-- CreateIndex
CREATE INDEX "Trade_signalId_idx" ON "Trade"("signalId");

-- CreateIndex
CREATE INDEX "Trade_botConfigId_status_idx" ON "Trade"("botConfigId", "status");

-- CreateIndex
CREATE INDEX "Trade_tenantId_openedAt_idx" ON "Trade"("tenantId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Backtest" ADD CONSTRAINT "Backtest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotAccount" ADD CONSTRAINT "BotAccount_botConfigId_fkey" FOREIGN KEY ("botConfigId") REFERENCES "BotConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotConfig" ADD CONSTRAINT "BotConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotHeartbeat" ADD CONSTRAINT "BotHeartbeat_botConfigId_fkey" FOREIGN KEY ("botConfigId") REFERENCES "BotConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotPosition" ADD CONSTRAINT "BotPosition_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedStrategy" ADD CONSTRAINT "PublishedStrategy_parentStrategyId_fkey" FOREIGN KEY ("parentStrategyId") REFERENCES "PublishedStrategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedStrategy" ADD CONSTRAINT "PublishedStrategy_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedStrategy" ADD CONSTRAINT "PublishedStrategy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_botConfigId_fkey" FOREIGN KEY ("botConfigId") REFERENCES "BotConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedTrade" ADD CONSTRAINT "SimulatedTrade_backtestId_fkey" FOREIGN KEY ("backtestId") REFERENCES "Backtest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedTrade" ADD CONSTRAINT "SimulatedTrade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyComment" ADD CONSTRAINT "StrategyComment_publishedStrategyId_fkey" FOREIGN KEY ("publishedStrategyId") REFERENCES "PublishedStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyComment" ADD CONSTRAINT "StrategyComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyLike" ADD CONSTRAINT "StrategyLike_publishedStrategyId_fkey" FOREIGN KEY ("publishedStrategyId") REFERENCES "PublishedStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyLike" ADD CONSTRAINT "StrategyLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_botConfigId_fkey" FOREIGN KEY ("botConfigId") REFERENCES "BotConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

