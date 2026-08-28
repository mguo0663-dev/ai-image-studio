import { pgTable, serial, varchar, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const imageGenerations = pgTable(
  "image_generations",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    prompt: text("prompt").notNull(),
    style: varchar("style", { length: 100 }).default(""),
    resolution: varchar("resolution", { length: 20 }).default("2K"),
    detail_level: varchar("detail_level", { length: 20 }).default("standard"),
    aspect_ratio: varchar("aspect_ratio", { length: 20 }).default("1:1"),
    image_count: integer("image_count").default(1),
    image_urls: jsonb("image_urls"),
    reference_image_keys: jsonb("reference_image_keys"),
    model: varchar("model", { length: 50 }).default("doubao-seedream-5-0-260128"),
    status: varchar("status", { length: 20 }).default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("image_generations_created_at_idx").on(table.created_at),
    index("image_generations_status_idx").on(table.status),
  ]
);
