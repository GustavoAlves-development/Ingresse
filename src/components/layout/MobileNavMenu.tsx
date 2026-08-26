"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

export function MobileNavMenu({
  navLinks,
  userLabel,
  signOutSlot,
}: {
  navLinks: { href: string; label: string }[];
  userLabel: string;
  signOutSlot: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="flex size-9 items-center justify-center rounded-md text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {open ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <Menu className="size-5" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 border-b border-border bg-secondary px-6 py-4 shadow-lg">
          <nav className="flex flex-col gap-3 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">{userLabel}</span>
            {signOutSlot}
          </div>
        </div>
      )}
    </div>
  );
}
