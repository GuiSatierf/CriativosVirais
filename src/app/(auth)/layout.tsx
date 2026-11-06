import Link from "next/link";
import { Brand } from "@/components/brand";

/** Sign-in pages: one centered card under the logo, with a soft brand glow at the top. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-svh flex-col items-center overflow-hidden px-4 pb-[env(safe-area-inset-bottom)] sm:px-8">
      <div aria-hidden className="auth-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[26rem]" />
      <Link href="/" className="mt-8 rounded-lg sm:mt-12">
        <Brand className="h-5 sm:h-6" />
      </Link>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex w-full max-w-md flex-1 items-start py-8 outline-none sm:items-center sm:py-10"
      >
        <div className="w-full rounded-2xl border bg-card p-6 shadow-(--shadow-floating) sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
