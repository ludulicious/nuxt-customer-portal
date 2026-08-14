UPDATE "user" SET "role" = 'user' WHERE "role" IS NULL;
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET NOT NULL;
