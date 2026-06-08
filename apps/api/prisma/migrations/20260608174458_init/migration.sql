-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DelegationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RewardKind" AS ENUM ('BAKING', 'ENDORSING', 'FEE', 'DENUNCIATION');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'TELEGRAM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletPkh" TEXT NOT NULL,
    "email" TEXT,
    "telegramChatId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baker" (
    "pkh" TEXT NOT NULL,
    "alias" TEXT,
    "status" TEXT NOT NULL,
    "fee" DECIMAL(5,3) NOT NULL,
    "capacity" BIGINT NOT NULL,
    "totalStake" BIGINT NOT NULL,
    "delegatedBalance" BIGINT NOT NULL,
    "blocksBaked" INTEGER NOT NULL,
    "missedBlocks" INTEGER NOT NULL,
    "lastSeen" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Baker_pkey" PRIMARY KEY ("pkh")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bakerPkh" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "opsHash" TEXT,
    "status" "DelegationStatus" NOT NULL DEFAULT 'PENDING',
    "blockLevel" INTEGER,
    "blockTime" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "kind" "RewardKind" NOT NULL,
    "amount" BIGINT NOT NULL,
    "bakerPkh" TEXT NOT NULL,
    "opsHash" TEXT NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedOpsHash" TEXT,
    "blockTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletPkh_key" ON "User"("walletPkh");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");

-- CreateIndex
CREATE INDEX "User_walletPkh_idx" ON "User"("walletPkh");

-- CreateIndex
CREATE INDEX "Baker_status_idx" ON "Baker"("status");

-- CreateIndex
CREATE INDEX "Baker_totalStake_idx" ON "Baker"("totalStake");

-- CreateIndex
CREATE UNIQUE INDEX "Delegation_opsHash_key" ON "Delegation"("opsHash");

-- CreateIndex
CREATE INDEX "Delegation_userId_createdAt_idx" ON "Delegation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Delegation_bakerPkh_idx" ON "Delegation"("bakerPkh");

-- CreateIndex
CREATE INDEX "Delegation_status_idx" ON "Delegation"("status");

-- CreateIndex
CREATE INDEX "Reward_userId_cycle_idx" ON "Reward"("userId", "cycle");

-- CreateIndex
CREATE INDEX "Reward_bakerPkh_cycle_idx" ON "Reward"("bakerPkh", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "Reward_userId_opsHash_kind_key" ON "Reward"("userId", "opsHash", "kind");

-- CreateIndex
CREATE INDEX "Notification_sent_createdAt_idx" ON "Notification"("sent", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_bakerPkh_fkey" FOREIGN KEY ("bakerPkh") REFERENCES "Baker"("pkh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
