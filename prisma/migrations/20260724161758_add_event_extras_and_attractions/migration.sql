-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "confirmedAttendees" INTEGER;

-- CreateTable
CREATE TABLE "Attraction" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attraction_eventId_idx" ON "Attraction"("eventId");

-- CreateIndex
CREATE INDEX "Attraction_organizerId_idx" ON "Attraction"("organizerId");

-- AddForeignKey
ALTER TABLE "Attraction" ADD CONSTRAINT "Attraction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
