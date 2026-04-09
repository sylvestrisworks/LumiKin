CREATE TABLE IF NOT EXISTS "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compliance_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"regulation" varchar(10) NOT NULL,
	"status" varchar(15) DEFAULT 'not_assessed' NOT NULL,
	"notes" text,
	"assessed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dark_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"pattern_id" varchar(4) NOT NULL,
	"severity" varchar(6) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"comment" text,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "curascore" integer;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "accessibility_risk" real;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "endless_design_risk" real;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "representation_score" real;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "propaganda_level" integer;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "bechdel_result" varchar(4);--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "executive_summary" text;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "debate_transcript" text;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "debate_rounds" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "is_vr" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "rep_gender_balance" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "rep_ethnic_diversity" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "propaganda_level" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "propaganda_notes" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "bechdel_result" varchar(4);--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "bechdel_notes" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "r5_cross_platform" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "r5_load_time" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "r5_mobile_optimized" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "r5_login_barrier" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "r6_infinite_gameplay" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "r6_no_stopping_points" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "r6_no_game_over" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "r6_no_chapters" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "uses_virtual_currency" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "virtual_currency_name" varchar(50);--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "virtual_currency_rate" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "parent_tip_benefits" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compliance_status" ADD CONSTRAINT "compliance_status_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dark_patterns" ADD CONSTRAINT "dark_patterns_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_feedback" ADD CONSTRAINT "game_feedback_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_unique" ON "compliance_status" ("game_id","regulation");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dp_review_idx" ON "dark_patterns" ("review_id");