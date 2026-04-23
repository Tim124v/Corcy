-- Add invite-based registration linkage
ALTER TABLE "User" ADD COLUMN "registeredViaInviteId" TEXT;

ALTER TABLE "Invite" ADD COLUMN "registeredUserId" TEXT;

