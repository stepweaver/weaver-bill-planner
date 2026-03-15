"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { name: "Months", path: "/months" },
  { name: "Templates", path: "/templates" },
];

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="relative flex h-5 w-6 flex-col items-center justify-center" aria-hidden>
      <span
        className={`absolute h-0.5 w-5 origin-center rounded-full bg-current transition-all duration-300 ease-out ${
          open ? "translate-y-1.5 rotate-45" : "-translate-y-1.5 rotate-0"
        }`}
      />
      <span
        className={`h-0.5 w-5 origin-center rounded-full bg-current transition-all duration-300 ease-out ${
          open ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
        }`}
      />
      <span
        className={`absolute h-0.5 w-5 origin-center rounded-full bg-current transition-all duration-300 ease-out ${
          open ? "-translate-y-1.5 -rotate-45" : "translate-y-1.5 rotate-0"
        }`}
      />
    </span>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const id = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="flex md:hidden items-center">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
            "text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
            "transition-colors outline-none"
          )}
          aria-label="Open menu"
          aria-expanded={open}
        >
          <HamburgerIcon open={open} />
        </SheetTrigger>
        <SheetContent side="right" className="flex flex-col w-full max-w-[min(20rem,85vw)]">
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle className="text-left font-medium text-foreground">
              <span className="text-primary">λ</span>ledger
            </SheetTitle>
          </SheetHeader>
          <nav className="flex-1 overflow-y-auto py-4" aria-label="Main navigation">
            <ul className="space-y-1">
              {NAV_LINKS.map((item) => (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    onClick={() => setOpen(false)}
                    className="block py-3 px-2 text-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
            <form action={signOutAction} className="mt-4 pt-4 border-t border-border">
              <Button type="submit" variant="ghost" className="w-full justify-start py-3 px-2 text-foreground hover:text-destructive">
                Sign out
              </Button>
            </form>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
