/* anchor: Linear session gate — centered quiet spinner, diverge: Outfit + muted copy */
import { Spinner } from "@/components/ui/spinner";

/**
 * Full-viewport pending state while resolving the staff session (`/staff/auth/session`).
 */
export function AuthLoading() {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background"
      aria-busy="true"
    >
      <Spinner
        className="size-5 text-muted-foreground motion-reduce:animate-none"
        aria-hidden
        role="presentation"
      />
      <p className="text-sm text-muted-foreground" role="status">
        Checking session…
      </p>
    </div>
  );
}
