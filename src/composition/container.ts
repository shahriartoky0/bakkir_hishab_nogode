import "server-only";
import { headers } from "next/headers";
import type { Locale, SettingsRecord } from "@/application/ports/records";
import { ClearDateRange } from "@/application/use-cases/admin/clear-date-range";
import { ChangePassword, SignOutEverywhere } from "@/application/use-cases/auth/account";
import { SignIn } from "@/application/use-cases/auth/sign-in";
import {
  ApplyStarterSet,
  ArchiveCategory,
  ArchiveField,
  ReorderCategories,
  ReorderFields,
  SaveCategory,
  SaveField,
} from "@/application/use-cases/catalog/catalog";
import { SaveCustomer, SetCustomerStatus } from "@/application/use-cases/customers/customers";
import { LogFollowUp } from "@/application/use-cases/followups/log-follow-up";
import { SetTranslationOverride } from "@/application/use-cases/i18n/translation-overrides";
import { CreateAdjustment, ReceivePayment, VoidPayment } from "@/application/use-cases/payments/payments";
import { CreatePhotoUpload } from "@/application/use-cases/photos/create-photo-upload";
import { GetPhotoUrls } from "@/application/use-cases/photos/get-photo-urls";
import { CancelSale, CreateSale, UpdateSale } from "@/application/use-cases/sales/sales";
import { UpdateSettings } from "@/application/use-cases/settings/update-settings";
import { createAuth, type Auth } from "@/infrastructure/auth/auth";
import { BetterAuthGateway } from "@/infrastructure/auth/better-auth-gateway";
import { systemClock } from "@/infrastructure/clock/system-clock";
import { storageEnv } from "@/infrastructure/config/env";
import { getDb } from "@/infrastructure/db/client";
import { uuidV7Generator } from "@/infrastructure/ids";
import { DrizzleQueries } from "@/infrastructure/queries/drizzle-queries";
import { DrizzleUnitOfWork, makeRepos } from "@/infrastructure/repositories/drizzle-repos";
import { DrizzleLoginAttemptStore } from "@/infrastructure/repositories/drizzle-login-attempt-store";
import { S3FileStorage } from "@/infrastructure/storage/s3-file-storage";

/**
 * Composition root: the only place that wires infrastructure into use cases.
 * Everything is created lazily and memoized per server instance.
 */
function once<T>(make: () => T): () => T {
  let v: T | undefined;
  return () => (v ??= make());
}

/** Small per-instance cache with TTL, invalidated explicitly after writes. */
function cached<T>(ttlMs: number, load: () => Promise<T>) {
  let value: { at: number; data: Promise<T> } | null = null;
  return {
    get(): Promise<T> {
      if (!value || Date.now() - value.at > ttlMs) {
        const data = load();
        value = { at: Date.now(), data };
        data.catch(() => (value = null));
      }
      return value.data;
    },
    invalidate() {
      value = null;
    },
  };
}

export const getAuth = once<Auth>(() => createAuth(getDb()));
const authGateway = once(() => new BetterAuthGateway(getAuth(), getDb(), () => headers()));
const storage = once(() => new S3FileStorage(storageEnv()));
const uow = once(() => new DrizzleUnitOfWork(getDb()));
const queries = once(() => new DrizzleQueries(getDb()));
const deps = () => ({ uow: uow(), clock: systemClock });

const settingsCache = cached<SettingsRecord>(30_000, () => makeRepos(getDb()).settings.get());
const overridesCache = cached<{ locale: Locale; key: string; value: string }[]>(30_000, () =>
  makeRepos(getDb()).translations.list(),
);

let knownMessageKeys: ReadonlySet<string> = new Set();

export const container = {
  session: () => authGateway(),
  account: () => authGateway(),
  signIn: () =>
    new SignIn({ authenticator: authGateway(), attempts: new DrizzleLoginAttemptStore(getDb()), clock: systemClock }),
  createPhotoUpload: () => new CreatePhotoUpload({ storage: storage(), ids: uuidV7Generator, clock: systemClock }),
  getPhotoUrls: () => new GetPhotoUrls({ storage: storage() }),
  changePassword: () => new ChangePassword({ account: authGateway() }),
  signOutEverywhere: () => new SignOutEverywhere({ account: authGateway() }),

  // settings & catalog
  settings: () => settingsCache.get(),
  invalidateSettings: () => settingsCache.invalidate(),
  updateSettings: () => new UpdateSettings({ uow: uow() }),
  saveCategory: () => new SaveCategory(deps()),
  archiveCategory: () => new ArchiveCategory(deps()),
  reorderCategories: () => new ReorderCategories(deps()),
  saveField: () => new SaveField(deps()),
  archiveField: () => new ArchiveField(deps()),
  reorderFields: () => new ReorderFields(deps()),
  applyStarterSet: () => new ApplyStarterSet(deps()),
  catalog: () => makeRepos(getDb()).catalog,

  // customers, sales, payments
  saveCustomer: () => new SaveCustomer({ uow: uow() }),
  setCustomerStatus: () => new SetCustomerStatus(deps()),
  createSale: () => new CreateSale(deps()),
  updateSale: () => new UpdateSale(deps()),
  cancelSale: () => new CancelSale(deps()),
  receivePayment: () => new ReceivePayment(deps()),
  voidPayment: () => new VoidPayment(deps()),
  createAdjustment: () => new CreateAdjustment(deps()),
  logFollowUp: () => new LogFollowUp(deps()),

  // translations
  translationOverrides: () => overridesCache.get(),
  setKnownMessageKeys: (keys: ReadonlySet<string>) => {
    knownMessageKeys = keys;
  },
  setTranslationOverride: () => {
    overridesCache.invalidate();
    return new SetTranslationOverride({ uow: uow(), knownKeys: () => knownMessageKeys });
  },
  invalidateTranslations: () => overridesCache.invalidate(),

  // owner-only hard delete of a date range (see drizzle/0003_admin_clear.sql)
  clearDateRange: () => new ClearDateRange({ ...deps(), storage: storage() }),

  queries: () => queries(),
};
