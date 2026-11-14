ALTER TABLE jiku_push ADD COLUMN wake_minute INTEGER;
--> statement-breakpoint
ALTER TABLE jiku_push ADD COLUMN evening_minute INTEGER NOT NULL DEFAULT 1080;
--> statement-breakpoint
ALTER TABLE jiku_push ADD COLUMN morning_delivery_day TEXT;
