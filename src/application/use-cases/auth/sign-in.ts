import { domainError, DomainErrorCode, err, ok, type DomainError, type Result } from "@/domain/shared";
import type { AuthenticatedUser, Authenticator, LoginAttemptStore } from "../../ports/authenticator";
import type { Clock } from "../../ports/clock";

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MINUTES = 15;

export interface SignInInput {
  email: string;
  password: string;
}

/**
 * Sign in with a simple in-DB failure counter: after LOGIN_MAX_FAILURES failed
 * attempts for an email within LOGIN_WINDOW_MINUTES, further attempts are refused
 * until the window passes. A successful sign-in clears the counter.
 */
export class SignIn {
  constructor(
    private readonly deps: {
      authenticator: Authenticator;
      attempts: LoginAttemptStore;
      clock: Clock;
    },
  ) {}

  async execute(input: SignInInput): Promise<Result<AuthenticatedUser, DomainError>> {
    const key = input.email.trim().toLowerCase();
    const now = this.deps.clock.now();
    const since = new Date(now.getTime() - LOGIN_WINDOW_MINUTES * 60_000);

    const failures = await this.deps.attempts.countFailuresSince(key, since);
    if (failures >= LOGIN_MAX_FAILURES) {
      return err(domainError(DomainErrorCode.TOO_MANY_ATTEMPTS, { minutes: LOGIN_WINDOW_MINUTES }));
    }

    const user = await this.deps.authenticator.signIn(key, input.password);
    if (!user) {
      await this.deps.attempts.recordFailure(key, now);
      return err(domainError(DomainErrorCode.INVALID_CREDENTIALS));
    }

    await this.deps.attempts.clearFailures(key);
    return ok(user);
  }
}
