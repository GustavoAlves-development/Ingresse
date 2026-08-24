import { Prisma, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hashPassword } from "@/lib/auth/password";
import { createUser, listUsersByOrganizer } from "@/lib/db/userRepository";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const ROLE_LABELS: Record<string, string> = {
  ORGANIZER_ADMIN: "Organizador",
  PORTARIA_STAFF: "Portaria",
};

const createStaffSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

async function createStaffAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.organizerId || session.user.role !== "ORGANIZER_ADMIN") {
    redirect("/login");
  }

  const parsed = createStaffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/admin/team?error=invalid-input");
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    await createUser(session.user.organizerId, {
      name,
      email,
      passwordHash,
      role: Role.PORTARIA_STAFF,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirect("/admin/team?error=email-in-use");
    }
    throw error;
  }

  redirect("/admin/team");
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizerId || session.user.role !== "ORGANIZER_ADMIN") {
    redirect("/login");
  }

  const { error } = await searchParams;
  const staff = await listUsersByOrganizer(session.user.organizerId);

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 font-heading text-xl font-semibold">
        Equipe de portaria
      </h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Adicionar membro</CardTitle>
        </CardHeader>
        <CardContent>
          {error === "email-in-use" && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>Esse e-mail já está em uso.</AlertDescription>
            </Alert>
          )}
          {error === "invalid-input" && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Verifique os campos preenchidos.
              </AlertDescription>
            </Alert>
          )}
          <form action={createStaffAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nome</FieldLabel>
                <Input id="name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Senha</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  required
                />
              </Field>
              <Button type="submit">Adicionar à portaria</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {staff.map((user) => (
          <Card key={user.id}>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant="outline">
                {ROLE_LABELS[user.role] ?? user.role}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
