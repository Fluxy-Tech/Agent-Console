import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import sturnusWordmark from "@/assets/NomeSemFundo.png";
import accessCover from "@/assets/CapaTelaDeAcesso.jpeg";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { refreshSessionState } from "@/hooks/use-bootstrap-session";
import { signIn } from "@/lib/auth-client";
import { useAppDispatch } from "@/store/hooks";

export function SignInPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await signIn.email({ email, password });

    if (signInError) {
      setLoading(false);
      setError(signInError.message ?? "Não foi possível entrar. Verifique suas credenciais.");
      return;
    }

    await refreshSessionState(dispatch);
    setLoading(false);
    navigate("/targets", { replace: true });
  }

  return (
    <AuthLayout hideMobileLogo backgroundImage={accessCover}>
      <Card className="w-3/4 max-w-2xl shadow-xl">
        <CardHeader>
          <div className="mb-1 flex items-center justify-center">
            <img src={sturnusWordmark} alt="Sturnus Flow" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-xl">Bem-vindo de volta</CardTitle>
          <CardDescription>Acesse o painel de gestão de agentes de IA.</CardDescription>
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
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link to="/forgot-password" className="text-primary text-xs font-medium hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <PasswordInput
                id="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-2" size="lg">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <p className="text-muted-foreground mt-6 text-center text-sm">
            Ainda não tem conta?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
