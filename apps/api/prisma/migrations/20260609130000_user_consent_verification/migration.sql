-- GalataBaker API — Task 4.5/4.6/4.7/4.8: User consent + verification
ALTER TABLE "User"
  ADD COLUMN "emailVerified"      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN "telegramVerified"   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN "consentGivenAt"     TIMESTAMP(3),
  ADD COLUMN "consentVersion"     TEXT;
