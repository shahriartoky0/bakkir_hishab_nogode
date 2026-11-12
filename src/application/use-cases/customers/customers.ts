import {
  domainError,
  DomainErrorCode,
  err,
  ok,
  PhoneNumber,
  type DomainError,
  type Result,
} from "@/domain/shared";
import type { Clock } from "../../ports/clock";
import type { CustomerRecord } from "../../ports/records";
import type { UnitOfWork } from "../../ports/repositories";

export interface SaveCustomerInput {
  id?: string;
  name: string;
  nameBn?: string | null;
  phone: string;
  altPhone?: string | null;
  address?: string | null;
  photoKey?: string | null;
  photoThumbKey?: string | null;
  nidNumber?: string | null;
  guarantorName?: string | null;
  guarantorPhone?: string | null;
  guarantorRelation?: string | null;
  creditLimitMinor?: number | null;
  notes?: string | null;
}

const clean = (s: string | null | undefined, max = 500) => (s?.trim() ? s.trim().slice(0, max) : null);

function optionalPhone(input: string | null | undefined): Result<string | null, DomainError> {
  if (!input?.trim()) return ok(null);
  const p = PhoneNumber.parse(input);
  return p.ok ? ok(p.value.e164) : p;
}

export class SaveCustomer {
  constructor(private readonly deps: { uow: UnitOfWork }) {}

  execute(input: SaveCustomerInput): Promise<Result<CustomerRecord, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const name = clean(input.name, 120);
      if (!name) return err(domainError(DomainErrorCode.NAME_REQUIRED));
      const phone = PhoneNumber.parse(input.phone);
      if (!phone.ok) return phone;
      const altPhone = optionalPhone(input.altPhone);
      if (!altPhone.ok) return altPhone;
      const guarantorPhone = optionalPhone(input.guarantorPhone);
      if (!guarantorPhone.ok) return guarantorPhone;
      if (input.creditLimitMinor != null && (!Number.isSafeInteger(input.creditLimitMinor) || input.creditLimitMinor < 0)) {
        return err(domainError(DomainErrorCode.INVALID_AMOUNT));
      }

      const dup = await r.customers.findByPhone(phone.value.e164);
      if (dup && dup.id !== input.id) {
        return err(domainError(DomainErrorCode.DUPLICATE_PHONE, { existingId: dup.id, existingName: dup.name }));
      }

      const data = {
        name,
        nameBn: clean(input.nameBn, 120),
        phone: phone.value.e164,
        altPhone: altPhone.value,
        address: clean(input.address),
        photoKey: input.photoKey ?? null,
        photoThumbKey: input.photoThumbKey ?? null,
        nidNumber: clean(input.nidNumber, 40),
        guarantorName: clean(input.guarantorName, 120),
        guarantorPhone: guarantorPhone.value,
        guarantorRelation: clean(input.guarantorRelation, 60),
        creditLimitMinor: input.creditLimitMinor ?? null,
        notes: clean(input.notes, 2000),
      };

      if (input.id) {
        const before = await r.customers.getById(input.id);
        if (!before) return err(domainError(DomainErrorCode.NOT_FOUND));
        await r.customers.update(input.id, data);
        const after = { ...before, ...data };
        await r.activity.log({ action: "customer.updated", entity: "customer", entityId: input.id, summary: name, before, after });
        return ok(after);
      }

      const created = await r.customers.insert({ ...data, isBlocked: false, archivedAt: null });
      await r.activity.log({ action: "customer.created", entity: "customer", entityId: created.id, summary: name, after: created });
      return ok(created);
    });
  }
}

export class SetCustomerStatus {
  constructor(private readonly deps: { uow: UnitOfWork; clock: Clock }) {}

  execute(input: { id: string; archived?: boolean; blocked?: boolean }): Promise<Result<null, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const c = await r.customers.getById(input.id);
      if (!c) return err(domainError(DomainErrorCode.NOT_FOUND));
      const patch: Partial<CustomerRecord> = {};
      if (input.archived !== undefined) patch.archivedAt = input.archived ? this.deps.clock.now() : null;
      if (input.blocked !== undefined) patch.isBlocked = input.blocked;
      await r.customers.update(c.id, patch);
      const action =
        input.archived !== undefined
          ? input.archived ? "customer.archived" : "customer.restored"
          : input.blocked ? "customer.blocked" : "customer.unblocked";
      await r.activity.log({ action, entity: "customer", entityId: c.id, summary: c.name });
      return ok(null);
    });
  }
}
