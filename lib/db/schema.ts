import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const sshAuthType = pgEnum("ssh_auth_type", ["private_key", "password"]);
export const routerStatus = pgEnum("router_status", ["unknown", "online", "offline", "error"]);
export const peerMode = pgEnum("peer_mode", ["internet", "internal", "site_to_site"]);
export const peerOrigin = pgEnum("peer_origin", ["application", "router_import"]);
export const peerDesiredAction = pgEnum("peer_desired_action", ["none", "create", "update", "delete", "restore"]);
export const peerSyncStatus = pgEnum("peer_sync_status", [
  "pending",
  "synced",
  "apply_failed",
  "drifted",
  "missing_on_router",
  "reappeared_on_router",
  "deleted",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export type EncryptedValue = {
  version: 1;
  iv: string;
  ciphertext: string;
  tag: string;
};

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  address: text("address"),
  description: text("description"),
  ...timestamps,
});

export const networks = pgTable("networks", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  description: text("description"),
  ...timestamps,
}, (table) => [index("networks_company_idx").on(table.companyId)]);

export const routers = pgTable("routers", {
  id: uuid("id").defaultRandom().primaryKey(),
  networkId: uuid("network_id").notNull().references(() => networks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  host: text("host").notNull(),
  sshPort: integer("ssh_port").default(22).notNull(),
  sshUsername: text("ssh_username").notNull(),
  sshAuthType: sshAuthType("ssh_auth_type").notNull(),
  sshSecret: jsonb("ssh_secret").$type<EncryptedValue>().notNull(),
  hostKeyFingerprint: text("host_key_fingerprint"),
  routerOsVersion: text("router_os_version"),
  status: routerStatus("status").default("unknown").notNull(),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  lastSuccessfulConnectionAt: timestamp("last_successful_connection_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
  description: text("description"),
  ...timestamps,
}, (table) => [index("routers_network_idx").on(table.networkId)]);

export const wireguardInterfaces = pgTable("wireguard_interfaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  routerId: uuid("router_id").notNull().references(() => routers.id, { onDelete: "cascade" }),
  routerOsId: text("router_os_id").notNull(),
  name: text("name").notNull(),
  listenPort: integer("listen_port").notNull(),
  publicKey: text("public_key").notNull(),
  mtu: integer("mtu"),
  isRunning: boolean("is_running").default(false).notNull(),
  isDisabled: boolean("is_disabled").default(false).notNull(),
  allocationCidr: text("allocation_cidr"),
  allocationStart: text("allocation_start"),
  allocationEnd: text("allocation_end"),
  clientEndpointHost: text("client_endpoint_host"),
  clientEndpointPort: integer("client_endpoint_port"),
  clientDns: text("client_dns"),
  isManaged: boolean("is_managed").default(true).notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("wireguard_interfaces_router_ros_id_uq").on(table.routerId, table.routerOsId),
  index("wireguard_interfaces_router_idx").on(table.routerId),
]);

export const interfaceAddresses = pgTable("interface_addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  interfaceId: uuid("interface_id").notNull().references(() => wireguardInterfaces.id, { onDelete: "cascade" }),
  cidr: text("cidr").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("interface_addresses_uq").on(table.interfaceId, table.cidr)]);

export const internalSubnets = pgTable("internal_subnets", {
  id: uuid("id").defaultRandom().primaryKey(),
  interfaceId: uuid("interface_id").notNull().references(() => wireguardInterfaces.id, { onDelete: "cascade" }),
  cidr: text("cidr").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("internal_subnets_uq").on(table.interfaceId, table.cidr)]);

export const peers = pgTable("peers", {
  id: uuid("id").defaultRandom().primaryKey(),
  interfaceId: uuid("interface_id").notNull().references(() => wireguardInterfaces.id, { onDelete: "cascade" }),
  routerOsId: text("router_os_id"),
  name: text("name").notNull(),
  comment: text("comment").notNull(),
  mode: peerMode("mode").default("internal").notNull(),
  publicKey: text("public_key").notNull(),
  appliedPublicKey: text("applied_public_key"),
  privateKey: jsonb("private_key").$type<EncryptedValue>(),
  presharedKey: jsonb("preshared_key").$type<EncryptedValue>(),
  assignedAddress: text("assigned_address").notNull(),
  persistentKeepalive: integer("persistent_keepalive").default(25).notNull(),
  remoteEndpointHost: text("remote_endpoint_host"),
  remoteEndpointPort: integer("remote_endpoint_port"),
  isDisabled: boolean("is_disabled").default(false).notNull(),
  origin: peerOrigin("origin").default("application").notNull(),
  desiredAction: peerDesiredAction("desired_action").default("create").notNull(),
  syncStatus: peerSyncStatus("sync_status").default("pending").notNull(),
  routerRevision: text("router_revision"),
  lastApplyError: text("last_apply_error"),
  lastHandshakeAt: timestamp("last_handshake_at", { withTimezone: true }),
  currentEndpoint: text("current_endpoint"),
  rxBytes: bigint("rx_bytes", { mode: "number" }).default(0).notNull(),
  txBytes: bigint("tx_bytes", { mode: "number" }).default(0).notNull(),
  lastStatusRefreshAt: timestamp("last_status_refresh_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index("peers_interface_idx").on(table.interfaceId),
  index("peers_public_key_idx").on(table.publicKey),
  index("peers_sync_status_idx").on(table.syncStatus),
]);

export const peerInternalSubnets = pgTable("peer_internal_subnets", {
  peerId: uuid("peer_id").notNull().references(() => peers.id, { onDelete: "cascade" }),
  subnetId: uuid("subnet_id").notNull().references(() => internalSubnets.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.peerId, table.subnetId] })]);

export const peerRemoteSubnets = pgTable("peer_remote_subnets", {
  id: uuid("id").defaultRandom().primaryKey(),
  peerId: uuid("peer_id").notNull().references(() => peers.id, { onDelete: "cascade" }),
  cidr: text("cidr").notNull(),
}, (table) => [uniqueIndex("peer_remote_subnets_uq").on(table.peerId, table.cidr)]);

export const routerOperationLocks = pgTable("router_operation_locks", {
  routerId: uuid("router_id").primaryKey().references(() => routers.id, { onDelete: "cascade" }),
  owner: text("owner").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const authRateLimits = pgTable("auth_rate_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").default(0).notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});
