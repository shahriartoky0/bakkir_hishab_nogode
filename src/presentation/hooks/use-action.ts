"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "../actions/result";
import { useErrorText } from "./use-error-text";

/**
 * Run a server action in a transition: shows a toast on error (translated code),
 * an optional success toast, and refreshes server components on success.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const errorText = useErrorText();
  const router = useRouter();

  const run = useCallback(
    <T,>(
      action: () => Promise<ActionResult<T>>,
      opts: { success?: string; onSuccess?: (data: T) => void; onError?: (r: { code: string; details?: Record<string, string | number | boolean | null> }) => boolean | void; refresh?: boolean } = {},
    ) => {
      startTransition(async () => {
        const r = await action();
        if (!r.ok) {
          // onError may return true to say "handled, no toast".
          if (!opts.onError?.(r)) toast.error(errorText(r.code, r.details));
          return;
        }
        if (opts.success) toast.success(opts.success);
        opts.onSuccess?.(r.data);
        if (opts.refresh !== false) router.refresh();
      });
    },
    [errorText, router],
  );

  return { pending, run };
}
