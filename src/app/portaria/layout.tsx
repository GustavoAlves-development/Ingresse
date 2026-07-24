import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";

export default function PortariaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
