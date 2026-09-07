CREATE TYPE "public"."peer_desired_action" AS ENUM('none', 'create', 'update', 'delete', 'restore');--> statement-breakpoint
CREATE TYPE "public"."peer_mode" AS ENUM('internet', 'internal', 'site_to_site');--> statement-breakpoint
CREATE TYPE "public"."peer_origin" AS ENUM('application', 'router_import');--> statement-breakpoint
CREATE TYPE "public"."peer_sync_status" AS ENUM('pending', 'synced', 'apply_failed', 'drifted', 'missing_on_router', 'reappeared_on_router', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."router_status" AS ENUM('unknown', 'online', 'offline', 'error');--> statement-breakpoint
CREATE TYPE "public"."ssh_auth_type" AS ENUM('private_key', 'password');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"address" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interface_id" uuid NOT NULL,
	"cidr" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_subnets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interface_id" uuid NOT NULL,
	"cidr" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "networks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peer_internal_subnets" (
	"peer_id" uuid NOT NULL,
	"subnet_id" uuid NOT NULL,
	CONSTRAINT "peer_internal_subnets_peer_id_subnet_id_pk" PRIMARY KEY("peer_id","subnet_id")
);
--> statement-breakpoint
CREATE TABLE "peer_remote_subnets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"peer_id" uuid NOT NULL,
	"cidr" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interface_id" uuid NOT NULL,
	"router_os_id" text,
	"name" text NOT NULL,
	"comment" text NOT NULL,
	"mode" "peer_mode" DEFAULT 'internal' NOT NULL,
	"public_key" text NOT NULL,
	"private_key" jsonb,
	"preshared_key" jsonb,
	"assigned_address" text NOT NULL,
	"persistent_keepalive" integer DEFAULT 25 NOT NULL,
	"remote_endpoint_host" text,
	"remote_endpoint_port" integer,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"origin" "peer_origin" DEFAULT 'application' NOT NULL,
	"desired_action" "peer_desired_action" DEFAULT 'create' NOT NULL,
	"sync_status" "peer_sync_status" DEFAULT 'pending' NOT NULL,
	"router_revision" text,
	"last_apply_error" text,
	"last_handshake_at" timestamp with time zone,
	"current_endpoint" text,
	"rx_bytes" bigint DEFAULT 0 NOT NULL,
	"tx_bytes" bigint DEFAULT 0 NOT NULL,
	"last_status_refresh_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "router_operation_locks" (
	"router_id" uuid PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_id" uuid NOT NULL,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"ssh_port" integer DEFAULT 22 NOT NULL,
	"ssh_username" text NOT NULL,
	"ssh_auth_type" "ssh_auth_type" NOT NULL,
	"ssh_secret" jsonb NOT NULL,
	"host_key_fingerprint" text,
	"router_os_version" text,
	"status" "router_status" DEFAULT 'unknown' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_successful_connection_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wireguard_interfaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"router_id" uuid NOT NULL,
	"router_os_id" text NOT NULL,
	"name" text NOT NULL,
	"listen_port" integer NOT NULL,
	"public_key" text NOT NULL,
	"applied_public_key" text,
	"mtu" integer,
	"is_running" boolean DEFAULT false NOT NULL,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"allocation_cidr" text,
	"allocation_start" text,
	"allocation_end" text,
	"client_endpoint_host" text,
	"client_endpoint_port" integer,
	"client_dns" text,
	"is_managed" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interface_addresses" ADD CONSTRAINT "interface_addresses_interface_id_wireguard_interfaces_id_fk" FOREIGN KEY ("interface_id") REFERENCES "public"."wireguard_interfaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_subnets" ADD CONSTRAINT "internal_subnets_interface_id_wireguard_interfaces_id_fk" FOREIGN KEY ("interface_id") REFERENCES "public"."wireguard_interfaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "networks" ADD CONSTRAINT "networks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_internal_subnets" ADD CONSTRAINT "peer_internal_subnets_peer_id_peers_id_fk" FOREIGN KEY ("peer_id") REFERENCES "public"."peers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_internal_subnets" ADD CONSTRAINT "peer_internal_subnets_subnet_id_internal_subnets_id_fk" FOREIGN KEY ("subnet_id") REFERENCES "public"."internal_subnets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_remote_subnets" ADD CONSTRAINT "peer_remote_subnets_peer_id_peers_id_fk" FOREIGN KEY ("peer_id") REFERENCES "public"."peers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peers" ADD CONSTRAINT "peers_interface_id_wireguard_interfaces_id_fk" FOREIGN KEY ("interface_id") REFERENCES "public"."wireguard_interfaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "router_operation_locks" ADD CONSTRAINT "router_operation_locks_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routers" ADD CONSTRAINT "routers_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wireguard_interfaces" ADD CONSTRAINT "wireguard_interfaces_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "interface_addresses_uq" ON "interface_addresses" USING btree ("interface_id","cidr");--> statement-breakpoint
CREATE UNIQUE INDEX "internal_subnets_uq" ON "internal_subnets" USING btree ("interface_id","cidr");--> statement-breakpoint
CREATE INDEX "networks_company_idx" ON "networks" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "peer_remote_subnets_uq" ON "peer_remote_subnets" USING btree ("peer_id","cidr");--> statement-breakpoint
CREATE INDEX "peers_interface_idx" ON "peers" USING btree ("interface_id");--> statement-breakpoint
CREATE INDEX "peers_public_key_idx" ON "peers" USING btree ("public_key");--> statement-breakpoint
CREATE INDEX "peers_sync_status_idx" ON "peers" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "routers_network_idx" ON "routers" USING btree ("network_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wireguard_interfaces_router_ros_id_uq" ON "wireguard_interfaces" USING btree ("router_id","router_os_id");--> statement-breakpoint
CREATE INDEX "wireguard_interfaces_router_idx" ON "wireguard_interfaces" USING btree ("router_id");