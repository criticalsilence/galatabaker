-- DropForeignKey handled implicitly (no FK change here)
-- DropUnique
DROP INDEX "Reward_userId_opsHash_kind_key";

-- CreateIndex
CREATE UNIQUE INDEX "Reward_opsHash_key" ON "Reward"("opsHash");
