import { beforeEach, describe, expect, it } from "vitest";
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MINUTES, SignIn } from "@/application/use-cases/auth/sign-in";
import { FakeAuthenticator, FakeClock, InMemoryLoginAttempts } from "../../fakes";

const owner = { id: "u1", email: "owner@shop.test", name: "Owner", locale: "bn" };

describe("SignIn", () => {
  let clock: FakeClock;
  let attempts: InMemoryLoginAttempts;
  let authenticator: FakeAuthenticator;
  let signIn: SignIn;

  beforeEach(() => {
    clock = new FakeClock();
    attempts = new InMemoryLoginAttempts();
    authenticator = new FakeAuthenticator({ "owner@shop.test": { password: "correct horse", user: owner } });
    signIn = new SignIn({ authenticator, attempts, clock });
  });

  it("signs in with the right password (email is case/space-insensitive)", async () => {
    const r = await signIn.execute({ email: "  Owner@Shop.test ", password: "correct horse" });
    expect(r).toEqual({ ok: true, value: owner });
  });

  it("rejects a wrong password and records the failure", async () => {
    const r = await signIn.execute({ email: "owner@shop.test", password: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_CREDENTIALS");
    expect(attempts.failures).toHaveLength(1);
  });

  it(`locks after ${LOGIN_MAX_FAILURES} failures without even checking the password`, async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await signIn.execute({ email: "owner@shop.test", password: "nope" });
    }
    const callsBefore = authenticator.calls;
    const r = await signIn.execute({ email: "owner@shop.test", password: "correct horse" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("TOO_MANY_ATTEMPTS");
      expect(r.error.details).toEqual({ minutes: LOGIN_WINDOW_MINUTES });
    }
    expect(authenticator.calls).toBe(callsBefore);
  });

  it("unlocks once the window has passed", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await signIn.execute({ email: "owner@shop.test", password: "nope" });
    }
    clock.advanceMinutes(LOGIN_WINDOW_MINUTES + 1);
    const r = await signIn.execute({ email: "owner@shop.test", password: "correct horse" });
    expect(r.ok).toBe(true);
  });

  it("clears the counter after a successful sign-in", async () => {
    await signIn.execute({ email: "owner@shop.test", password: "nope" });
    await signIn.execute({ email: "owner@shop.test", password: "correct horse" });
    expect(attempts.failures).toHaveLength(0);
  });
});
