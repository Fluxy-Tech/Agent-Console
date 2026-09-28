import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import sturnusWordmark from "@/assets/NomeSemFundo.png";
import accessCover from "@/assets/CapaTelaDeAcesso.jpeg";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { refreshSessionState } from "@/hooks/use-bootstrap-session";
import { signUp } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/store/hooks";

const PASSWORD_REQUIREMENTS = [
  { label: "Mínimo de 8 caracteres", test: (value: string) => value.length >= 8 },
  { label: "Pelo menos 1 número", test: (value: string) => /\d/.test(value) },
  { label: "Pelo menos 1 símbolo", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export function SignUpPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordChecks = PASSWORD_REQUIREMENTS.map((req) => ({ ...req, met: req.test(password) }));
  const passwordValid = passwordChecks.every((check) => check.met);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!passwordValid) {
      setError("A senha precisa ter no mínimo 8 caracteres, incluindo 1 número e 1 símbolo.");
      return;
    }

    setLoading(true);

    const { error: signUpError } = await signUp.email({ name, email, password });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message ?? "Não foi possível criar a conta.");
      return;
    }

    // O signUp acabou de criar uma sessão nova (cookie) — a store ainda não
    // sabe disso (o bootstrap na raiz do app só roda uma vez, no load inicial),
    // então precisamos atualizá-la aqui antes de navegar, senão os guards de
    // rota (RequireAuth/RequireActiveCompany) mandam de volta pro /signin.
    await refreshSessionState(dispatch);
    setLoading(false);
    navigate("/business", { replace: true });
  }

  return (
    <AuthLayout hideMobileLogo backgroundImage={accessCover}>
      <Card className="w-3/4 max-w-2xl shadow-xl">
        <CardHeader>
          <div className="mb-1 flex items-center justify-center">
            <Link to="/signin" aria-label="Ir para o login">
              <img src={sturnusWordmark} alt="Sturnus Flow" className="h-16 w-auto" />
            </Link>
          </div>
          <CardTitle className="text-xl">Criar conta</CardTitle>
          <CardDescription>
            Depois de criar sua conta, você poderá criar uma empresa ou entrar com um código de convite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                required
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="mt-1 flex flex-col gap-1">
                {passwordChecks.map((check) => (
                  <span
                    key={check.label}
                    className={cn(
                      "flex items-center gap-1.5 text-xs",
                      check.met ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {check.met ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                    {check.label}
                  </span>
                ))}
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-2" size="lg">
              {loading ? "Criando..." : "Criar conta"}
            </Button>
          </form>
          <p className="text-muted-foreground mt-6 text-center text-sm">
            Já tem conta?{" "}
            <Link to="/signin" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
