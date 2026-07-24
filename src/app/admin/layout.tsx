import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
