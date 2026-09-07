ALTER TABLE "peers" ADD COLUMN "applied_public_key" text;--> statement-breakpoint
ALTER TABLE "wireguard_interfaces" DROP COLUMN "applied_public_key";