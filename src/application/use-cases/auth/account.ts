import { domainError, DomainErrorCode, err, ok, type DomainError, type Result } from "@/domain/shared";
import type { AccountGateway } from "../../ports/authenticator";

export const MIN_PASSWORD_LENGTH = 8;

/** Change the owner's password; other sessions are revoked by the gateway. */
export class ChangePassword {
  constructor(private readonly deps: { account: AccountGateway }) {}

  async execute(input: { currentPassword: string; newPassword: string }): Promise<Result<null, DomainError>> {
    if (input.newPassword.length < MIN_PASSWORD_LENGTH || input.newPassword.length > 128) {
      return err(domainError(DomainErrorCode.VALIDATION, { field: "newPassword" }));
    }
    if (input.newPassword === input.currentPassword) {
      return err(domainError(DomainErrorCode.VALIDATION, { field: "newPassword" }));
    }
    const changed = await this.deps.account.changePassword(input.currentPassword, input.newPassword);
    return changed ? ok(null) : err(domainError(DomainErrorCode.WRONG_PASSWORD));
  }
}

/** Revoke every session, including this one. */
export class SignOutEverywhere {
  constructor(private readonly deps: { account: AccountGateway }) {}

  async execute(): Promise<Result<null, DomainError>> {
    await this.deps.account.signOutEverywhere();
    return ok(null);
  }
}
