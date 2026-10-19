'use client';

import { RouteError } from '@/components/route-error';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-workspace p-4">
      <RouteError error={error} reset={reset} homeHref="/" />
    </main>
  );
}
