CREATE TABLE IF NOT EXISTS "timesheets"."team_member_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade,
	"user_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE cascade,
	"can_enter_time" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_member_settings_org_user_uidx" ON "timesheets"."team_member_settings" USING btree ("organization_id","user_id");
