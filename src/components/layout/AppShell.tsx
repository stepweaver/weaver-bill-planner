import { Nav } from "./Nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className="mx-auto w-full max-w-[1500px] px-4 pb-8 pt-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
