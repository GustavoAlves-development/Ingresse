import Link from "next/link";
import { notFound } from "next/navigation";
import { findEventBySlug } from "@/lib/db/eventRepository";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const { status } = await searchParams;

  const event = await findEventBySlug(slug);
  if (!event) {
    notFound();
  }

  const isPending = status === "pending";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm text-center">
        <CardContent className="flex flex-col items-center gap-4 py-4">
          <span className="text-5xl" aria-hidden="true">
            🎉
          </span>
          <h1 className="font-heading text-xl font-semibold">
            Obrigado pela compra!
          </h1>
          <p className="text-sm text-muted-foreground">{event.name}</p>

          <div className="mt-2 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
            {isPending ? (
              <>
                Seu pagamento está em análise. Assim que for aprovado, seu
                ingresso com QR Code chega automaticamente no e-mail que você
                informou.
              </>
            ) : (
              <>
                Seu pagamento foi recebido. Seu ingresso com QR Code chega em
                instantes no e-mail que você informou.
              </>
            )}
          </div>

          <p className="text-sm font-medium text-foreground">
            📧 Fica de olho na caixa de entrada — e não esquece de checar a
            pasta de <strong>spam</strong>, caso não apareça em alguns
            minutos.
          </p>

          <Button
            render={<Link href={`/e/${slug}`} />}
            nativeButton={false}
            variant="outline"
            className="mt-2"
          >
            Voltar pro evento
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
