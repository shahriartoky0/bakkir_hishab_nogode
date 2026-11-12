"use server";

import { z } from "zod";
import type { CustomerListItem } from "@/application/ports/queries";
import { container } from "@/composition/container";
import { ok } from "@/domain/shared/result";
import { signPhotos } from "../lib/server";
import { guarded, guardedRead } from "./guard";
import type { ActionResult } from "./result";

const id = z.string().min(1).max(64);
const nullableText = (max: number) => z.string().max(max).nullable().optional();

const saveSchema = z.object({
  id: id.optional(),
  name: z.string().min(1).max(120),
  nameBn: nullableText(120),
  phone: z.string().min(1).max(30),
  altPhone: nullableText(30),
  address: nullableText(500),
  photoKey: nullableText(200),
  photoThumbKey: nullableText(200),
  nidNumber: nullableText(40),
  guarantorName: nullableText(120),
  guarantorPhone: nullableText(30),
  guarantorRelation: nullableText(60),
  creditLimitMinor: z.number().int().nonnegative().nullable().optional(),
  notes: nullableText(2000),
});

export async function saveCustomerAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guarded(saveSchema, input, async (d) => {
    const r = await container.saveCustomer().execute(d);
    return r.ok ? ok({ id: r.value.id }) : r;
  });
}

const statusSchema = z.object({ id, archived: z.boolean().optional(), blocked: z.boolean().optional() });

export async function setCustomerStatusAction(input: unknown): Promise<ActionResult<null>> {
  return guarded(statusSchema, input, (d) => container.setCustomerStatus().execute(d));
}

const searchSchema = z.object({
  q: z.string().max(100).optional(),
  filter: z.enum(["all", "has_dues", "overdue", "blocked", "archived"]),
  offset: z.number().int().min(0).max(100_000).default(0),
  limit: z.number().int().min(1).max(50).default(30),
});

export type CustomerSearchResult = { items: (CustomerListItem & { thumbUrl: string | null })[]; total: number };

/** Customer list/search for the client (TanStack Query) with thumbnail URLs. */
export async function searchCustomersAction(input: unknown): Promise<ActionResult<CustomerSearchResult>> {
  return guardedRead(searchSchema, input, async (d) => {
    const res = await container.queries().listCustomers(d);
    const urls = await signPhotos(res.items.map((i) => i.photoThumbKey));
    return {
      total: res.total,
      items: res.items.map((i) => ({ ...i, thumbUrl: i.photoThumbKey ? (urls[i.photoThumbKey] ?? null) : null })),
    };
  });
}
