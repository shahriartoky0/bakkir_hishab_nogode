import { z } from "zod";

export const signInSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});

export type SignInValues = z.input<typeof signInSchema>;
