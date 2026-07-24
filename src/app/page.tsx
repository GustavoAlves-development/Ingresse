import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="brand-glow font-heading text-4xl font-semibold tracking-tight text-foreground">
        ingresse
      </h1>
      <p className="max-w-sm text-muted-foreground">
        Venda de ingressos e controle de portaria para organizadores de
        eventos.
      </p>
      <div className="flex gap-3">
        <Button render={<Link href="/login" />} nativeButton={false}>
          Entrar
        </Button>
        <Button
          render={<Link href="/signup" />}
          nativeButton={false}
          variant="outline"
        >
          Criar conta
        </Button>
      </div>
    </main>
  );
}
