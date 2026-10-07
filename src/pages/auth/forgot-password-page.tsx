import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: requestError } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (requestError) {
      setError(requestError.message ?? "Não foi possível enviar o e-mail de redefinição.");
      return;
    }

    setSent(true);
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-sm shadow-xl">
        {sent ? (
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <div className="bg-success/15 text-success flex size-12 items-center justify-center rounded-sm">
              <MailCheck className="size-6" />
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Verifique seu e-mail</h2>
            <p className="text-muted-foreground text-sm">
              Se <strong>{email}</strong> estiver cadastrado, você vai receber um link para redefinir sua senha em
              instantes.
            </p>
            <Link to="/signin" className="text-primary mt-2 text-sm font-medium hover:underline">
              Voltar para o login
            </Link>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Esqueceu sua senha?</CardTitle>
              <CardDescription>Informe seu e-mail e enviaremos um link para você redefinir a senha.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button type="submit" disabled={loading} className="mt-2" size="lg">
                  {loading ? "Enviando..." : "Enviar link de redefinição"}
                </Button>
              </form>
              <Link
                to="/signin"
                className="text-muted-foreground hover:text-foreground mt-6 flex items-center justify-center gap-1.5 text-sm"
              >
                <ArrowLeft className="size-4" /> Voltar para o login
              </Link>
            </CardContent>
          </>
        )}
      </Card>
    </AuthLayout>
  );
}
