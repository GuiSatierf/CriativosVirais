import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-svh items-center justify-center bg-muted/40 px-4 py-20">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {children}
    </main>
  );
}
