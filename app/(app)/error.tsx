"use client";

import { ErrorState } from "@/presentation/components/error-state";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState onRetry={reset} />;
}
