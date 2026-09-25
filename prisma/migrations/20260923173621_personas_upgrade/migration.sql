-- Personas upgrade: status enum (ACTIVE|ARCHIVED) -> string (revisita|curso|no_en_casa|no_visitar|archivado) + nuevos campos
ALTER TABLE "InterestedPerson" ALTER COLUMN "status" TYPE TEXT USING (
  CASE WHEN "status"::text = 'ACTIVE' THEN 'revisita'
       WHEN "status"::text = 'ARCHIVED' THEN 'archivado'
       ELSE "status"::text END
);
ALTER TABLE "InterestedPerson" ALTER COLUMN "status" SET DEFAULT 'revisita';

DROP TYPE IF EXISTS "PersonStatus";

ALTER TABLE "InterestedPerson" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "InterestedPerson" ADD COLUMN IF NOT EXISTS "firstContactDate" DATE;
ALTER TABLE "InterestedPerson" ADD COLUMN IF NOT EXISTS "studyPublication" TEXT;
ALTER TABLE "InterestedPerson" ADD COLUMN IF NOT EXISTS "studyLesson" INTEGER;
ALTER TABLE "InterestedPerson" ADD COLUMN IF NOT EXISTS "studyTotalLessons" INTEGER;
ALTER TABLE "InterestedPerson" ADD COLUMN IF NOT EXISTS "nextVisitDate" DATE;
ALTER TABLE "InterestedPerson" ADD COLUMN IF NOT EXISTS "nextVisitTime" TEXT;
ALTER TABLE "InterestedPerson" ADD COLUMN IF NOT EXISTS "nextTopic" TEXT;
ALTER TABLE "InterestedPerson" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "InterestedPerson" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
