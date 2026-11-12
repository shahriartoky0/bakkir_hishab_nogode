import { timestamp, uuid } from "drizzle-orm/pg-core";
import { newId } from "../../ids";

/** UUIDv7 primary key generated in the app (time-ordered, index friendly). */
export const id = () => uuid("id").primaryKey().$defaultFn(newId);

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
