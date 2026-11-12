import type { AuthenticatedUser, Authenticator, LoginAttemptStore } from "@/application/ports/authenticator";
import type { Clock } from "@/application/ports/clock";
import type { FileStorage, PresignUploadInput } from "@/application/ports/file-storage";
import type { IdGenerator } from "@/application/ports/id-generator";

export class FakeClock implements Clock {
  constructor(public current = new Date("2026-11-12T06:00:00Z")) {}
  now() {
    return new Date(this.current);
  }
  advanceMinutes(m: number) {
    this.current = new Date(this.current.getTime() + m * 60_000);
  }
}

export class SequentialIds implements IdGenerator {
  private n = 0;
  next() {
    this.n += 1;
    return `00000000-0000-7000-8000-${String(this.n).padStart(12, "0")}`;
  }
}

export class InMemoryLoginAttempts implements LoginAttemptStore {
  readonly failures: { key: string; at: Date }[] = [];
  async countFailuresSince(key: string, since: Date) {
    return this.failures.filter((f) => f.key === key && f.at >= since).length;
  }
  async recordFailure(key: string, at: Date) {
    this.failures.push({ key, at });
  }
  async clearFailures(key: string) {
    for (let i = this.failures.length - 1; i >= 0; i--) if (this.failures[i]?.key === key) this.failures.splice(i, 1);
  }
}

export class FakeAuthenticator implements Authenticator {
  calls = 0;
  constructor(private readonly users: Record<string, { password: string; user: AuthenticatedUser }>) {}
  async signIn(email: string, password: string) {
    this.calls += 1;
    const u = this.users[email];
    return u && u.password === password ? u.user : null;
  }
}

export class FakeFileStorage implements FileStorage {
  readonly uploads: PresignUploadInput[] = [];
  async createUploadUrl(input: PresignUploadInput) {
    this.uploads.push(input);
    return `https://r2.test/put/${input.key}?ttl=${input.expiresInSeconds}`;
  }
  async createDownloadUrl(key: string, ttl: number) {
    return `https://r2.test/get/${key}?ttl=${ttl}`;
  }
  readonly deleted: string[] = [];
  async deleteObjects(keys: readonly string[]) {
    this.deleted.push(...keys);
  }
}
