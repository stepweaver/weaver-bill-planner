import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./MobileNav";

const BRAND = "λledger";

export function Nav() {
  return (
    <nav
      className="sticky top-0 z-50 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex w-full max-w-[1500px] items-center gap-4">
        <Link
          href="/months"
          className="flex items-center gap-1.5 shrink-0 font-bold tracking-tight hover:opacity-90 transition-opacity"
          aria-label={`${BRAND} home`}
        >
          <span className="text-primary text-xl sm:text-2xl">{BRAND.slice(0, 1)}</span>
          <span className="text-foreground text-lg sm:text-xl">{BRAND.slice(1)}</span>
        </Link>

        <div className="hidden md:flex flex-1 items-center justify-end gap-1 rounded-lg border border-border/60 bg-card/50 p-1">
          <Link href="/months">
            <Button variant="ghost" size="sm" className="uppercase tracking-wider font-medium">
              Months
            </Button>
          </Link>
          <Link href="/templates">
            <Button variant="ghost" size="sm" className="uppercase tracking-wider font-medium">
              Recurring
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="uppercase tracking-wider font-medium">
              Settings
            </Button>
          </Link>
        </div>
        <form className="hidden md:block" action={async () => { "use server"; await signOut(); }}>
          <Button type="submit" variant="outline" size="sm" className="uppercase tracking-wider font-medium">
            Sign out
          </Button>
        </form>
        <div className="ml-auto md:ml-0">
          <MobileNav />
        </div>
      </div>
    </nav>
  );
}
