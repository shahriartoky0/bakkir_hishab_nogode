export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  locale: string;
}

/** Wraps the auth library. Signing in also establishes the session cookie. */
export interface Authenticator {
  signIn(email: string, password: string): Promise<AuthenticatedUser | null>;
}

/** Account management for the signed-in owner. */
export interface AccountGateway {
  /** false = current password was wrong */
  changePassword(currentPassword: string, newPassword: string): Promise<boolean>;
  /** Revoke every session including this one. */
  signOutEverywhere(): Promise<void>;
}

export interface LoginAttemptStore {
  countFailuresSince(key: string, since: Date): Promise<number>;
  recordFailure(key: string, at: Date): Promise<void>;
  clearFailures(key: string): Promise<void>;
}
