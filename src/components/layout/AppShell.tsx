import { Nav } from "./Nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}
