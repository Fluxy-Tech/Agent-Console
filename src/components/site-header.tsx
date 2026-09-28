import { Link } from "react-router-dom";
import fluxyIcon from "@/assets/IconeAzulSemFundo.png";
import fluxyIconWhite from "@/assets/IconeBrancoSemFundo.png";
import { cn } from "@/lib/utils";

/// Cabeçalho das páginas públicas (hoje só a política de privacidade). Sem a
/// antiga home de apresentação, sobra a logo e o atalho pro login.
export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const linkClass = cn(
    "text-base font-medium transition-colors",
    transparent ? "text-white hover:text-white/70" : "text-black hover:text-black/70",
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors",
        transparent ? "bg-transparent" : "border-b bg-background/95 backdrop-blur",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link to="/signin" className="flex items-center gap-2">
          <img src={transparent ? fluxyIconWhite : fluxyIcon} alt="Sturnus Flow" className="h-8 w-8 object-contain" />
        </Link>
        <Link to="/signin" className={linkClass}>
          Entrar
        </Link>
      </div>
    </header>
  );
}
