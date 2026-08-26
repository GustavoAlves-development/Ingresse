import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminHomePage() {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Painel do organizador</CardTitle>
          <CardDescription>
            Gerencie os eventos e ingressos da sua organização.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button render={<Link href="/admin/events" />} nativeButton={false}>
            Meus eventos
          </Button>
          <Button
            render={<Link href="/portaria" />}
            nativeButton={false}
            variant="outline"
          >
            Portaria
          </Button>
          <Button
            render={<Link href="/admin/team" />}
            nativeButton={false}
            variant="outline"
          >
            Equipe
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
