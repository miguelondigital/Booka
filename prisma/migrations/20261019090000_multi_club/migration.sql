-- Multiple clubs per member, club owners and invite codes, books per club
-- (one current, earlier ones kept), blocked members, and deleted accounts.
-- Existing data is carried over: each club's active book becomes its first
-- book, the earliest member becomes the owner, and invite codes are generated.

-- Clubs with no members were unreachable (every club route requires
-- membership) and have no one to own them, so they are removed.
DELETE FROM "Club" c WHERE NOT EXISTS (SELECT 1 FROM "Membership" m WHERE m."clubId" = c.id);

-- DropForeignKey
ALTER TABLE "Club" DROP CONSTRAINT "Club_activeBookId_fkey";
ALTER TABLE "Post" DROP CONSTRAINT "Post_checkpointId_fkey";
ALTER TABLE "Progress" DROP CONSTRAINT "Progress_checkpointId_fkey";
ALTER TABLE "Thread" DROP CONSTRAINT "Thread_checkpointId_fkey";
ALTER TABLE "Thread" DROP CONSTRAINT "Thread_clubId_fkey";

-- DropIndex
DROP INDEX "Club_activeBookId_key";
DROP INDEX "Thread_clubId_idx";

-- Books belong to a club.
ALTER TABLE "Book" ADD COLUMN "clubId" TEXT,
ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Book" b SET "clubId" = c.id, "startedAt" = c."createdAt" FROM "Club" c WHERE c."activeBookId" = b.id;
-- Books that were no club's active book were unreachable.
DELETE FROM "Book" WHERE "clubId" IS NULL;
ALTER TABLE "Book" ALTER COLUMN "clubId" SET NOT NULL;

-- Clubs get an owner and an invite code.
ALTER TABLE "Club" ADD COLUMN "inviteCode" TEXT,
ADD COLUMN "ownerId" TEXT;
UPDATE "Club" c SET "ownerId" = (
  SELECT m."memberId" FROM "Membership" m WHERE m."clubId" = c.id ORDER BY m."joinedAt", m."memberId" LIMIT 1
);
UPDATE "Club" SET "inviteCode" = upper(substr(md5(random()::text || id), 1, 10));
ALTER TABLE "Club" ALTER COLUMN "ownerId" SET NOT NULL,
ALTER COLUMN "inviteCode" SET NOT NULL,
DROP COLUMN "activeBookId";

-- Threads belong to a book (the book of their checkpoint).
ALTER TABLE "Thread" ADD COLUMN "bookId" TEXT;
UPDATE "Thread" t SET "bookId" = cp."bookId" FROM "Checkpoint" cp WHERE cp.id = t."checkpointId";
ALTER TABLE "Thread" ALTER COLUMN "bookId" SET NOT NULL,
DROP COLUMN "clubId";

-- Deleted accounts are anonymised, not removed.
ALTER TABLE "Member" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ClubBlock" (
    "clubId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubBlock_pkey" PRIMARY KEY ("clubId","memberId")
);

-- CreateIndex
CREATE INDEX "Book_clubId_startedAt_idx" ON "Book"("clubId", "startedAt");
CREATE UNIQUE INDEX "Club_inviteCode_key" ON "Club"("inviteCode");
CREATE INDEX "Membership_clubId_idx" ON "Membership"("clubId");
CREATE INDEX "Thread_bookId_idx" ON "Thread"("bookId");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Book" ADD CONSTRAINT "Book_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubBlock" ADD CONSTRAINT "ClubBlock_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubBlock" ADD CONSTRAINT "ClubBlock_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
