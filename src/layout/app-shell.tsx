import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import useSWR from "swr";
import { ChevronsLeft, ChevronsRight, LogOut, Settings } from "lucide-react";
import sturnusIcon from "@/assets/IconeAzulSemFundo.png";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCan, useIsSupportTeam } from "@/hooks/use-can";
import { useSupportUnread } from "@/hooks/use-support-unread";
import { NAV_GROUPS } from "./nav-config";
import { SupportNotifier } from "./support-notifier";
import { signOut } from "@/lib/auth-client";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuth } from "@/store/slices/auth-slice";
import { homePathFor, setActiveCompany } from "@/store/slices/active-company-slice";
import { PermissionAction, ROLE_LABELS } from "@/domain/permission-action";
import type { UserProfile } from "@/types/domain";

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const can = useCan();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const activeCompany = useAppSelector((s) => s.activeCompany);
  const actingAsSupport = useIsSupportTeam();
  const { data: supportUnread } = useSupportUnread();
  // Só pela foto do perfil (URL presignada); o nome continua vindo da store.
  const { data: profile } = useSWR<UserProfile>(user ? "/api/me" : null);
  const badgeCounts = { support: supportUnread?.tickets ?? 0 };

  async function handleSignOut() {
    await signOut();
    dispatch(clearAuth());
    dispatch(setActiveCompany(null));
    window.location.href = "/signin";
  }

  // Trava a rolagem do documento enquanto o shell está montado — toda página
  // aqui dentro já rola internamente pelo <main>; sem isso, qualquer
  // conteúdo que escape do contêiner (tabela larga, popover mal posicionado
  // etc.) faz o body inteiro crescer e o menu lateral "termina" antes do fim
  // da página em vez de acompanhar o scroll.
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden">
      <SupportNotifier />
      <aside
        className={cn(
          "bg-card border-border flex flex-col border-r transition-[width] duration-200",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <Link to={homePathFor(activeCompany)} className={cn("flex h-14 items-center gap-2 px-4", collapsed ? "justify-center" : "justify-start")}>
          <img src={sturnusIcon} alt="Sturnus Flow" className="h-8 w-8 shrink-0 object-contain" />
          {!collapsed && <span className="font-display text-lg font-semibold">Sturnus Flow</span>}
        </Link>

        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {NAV_GROUPS.map((group) => {
            // Na central "Suporte Sturnus" o menu é só o de suporte — as
            // outras telas não têm o que mostrar nessa empresa.
            const items = group.items.filter(
              (item) =>
                (!item.action || can(item.action)) &&
                // Telas de quem atende só existem dentro da central Suporte
                // Sturnus; em qualquer outra empresa vale o menu da empresa.
                (item.audience !== "platformAdmin" || (!!user?.isPlatformAdmin && actingAsSupport)) &&
                (item.audience !== "supportTeam" || actingAsSupport) &&
                (item.audience !== "customer" || !actingAsSupport) &&
                (!activeCompany?.isSupportHub || item.action === PermissionAction.SUPPORT_VIEW),
            );
            if (items.length === 0) return null;

            return (
              <div key={group.label} className="mb-4">
                {!collapsed && (
                  <p className="text-muted-foreground px-2 py-1 text-xs font-medium uppercase">{group.label}</p>
                )}
                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    // Um item filho mais específico no menu (ex: /support/team
                    // dentro de /support) ganha o destaque sozinho.
                    const hasMoreSpecificItem = group.items.some(
                      (other) =>
                        other !== item &&
                        other.to.startsWith(`${item.to}/`) &&
                        (location.pathname === other.to || location.pathname.startsWith(`${other.to}/`)),
                    );
                    const isActive =
                      !item.external &&
                      !hasMoreSpecificItem &&
                      (location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
                    // NavLink.className aceita uma função, mas quando este link
                    // vira o asChild de um Radix Slot (TooltipTrigger, abaixo), o
                    // Slot faz `[a, b].filter(Boolean).join(" ")` para mesclar
                    // classNames — e como isso chama .toString() em qualquer
                    // valor não-string, uma função vira o próprio código-fonte
                    // dela virando classes CSS "de verdade" (ex.: sobra
                    // "text-primary-foreground" limpa no meio do texto). Por
                    // isso calculamos isActive manualmente e passamos string.
                    const linkClass = cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-base transition-colors",
                      collapsed ? "justify-center" : "justify-start",
                      isActive
                        ? "bg-sidebar-active text-sidebar-active-foreground font-medium"
                        : "text-sidebar-item-foreground hover:bg-sidebar-hover hover:text-sidebar-hover-foreground",
                    );
                    const badgeCount = item.badge ? badgeCounts[item.badge] : 0;
                    const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);
                    const content = (
                      <>
                        <span className="relative shrink-0">
                          <item.icon className="size-5" />
                          {/* Recolhido não cabe o número — vira só um ponto no ícone. */}
                          {collapsed && badgeCount > 0 && (
                            <span className="bg-destructive ring-sidebar absolute -top-1 -right-1 size-2.5 rounded-sm ring-2" />
                          )}
                        </span>
                        {!collapsed && item.label}
                        {!collapsed && badgeCount > 0 && (
                          <span
                            className="bg-destructive ml-auto min-w-5 rounded-sm px-1.5 text-center text-xs leading-5 font-semibold text-white"
                            aria-label={`${badgeCount} chamado(s) com mensagem nova`}
                          >
                            {badgeLabel}
                          </span>
                        )}
                      </>
                    );
                    // Links externos (ex.: Fluxy Desk) abrem em nova aba.
                    const link = item.external ? (
                      <a href={item.to} target="_blank" rel="noreferrer" className={linkClass}>
                        {content}
                      </a>
                    ) : (
                      <NavLink to={item.to} className={linkClass}>
                        {content}
                      </NavLink>
                    );

                    if (!collapsed) return <div key={item.to}>{link}</div>;

                    return (
                      <Tooltip key={item.to}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent>{item.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {(() => {
          const toggleButton = (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className={cn(
                "text-muted-foreground hover:text-foreground flex items-center gap-2 px-4 py-3 text-sm",
                collapsed ? "justify-center" : "justify-start",
              )}
            >
              {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
              {!collapsed && "Recolher"}
            </button>
          );

          if (!collapsed) return toggleButton;

          return (
            <Tooltip>
              <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
              <TooltipContent>Expandir</TooltipContent>
            </Tooltip>
          );
        })()}

        <DropdownMenu>
          {(() => {
            const profileButton = (
              <button
                type="button"
                className={cn(
                  "border-border hover:bg-accent flex items-center gap-2 border-t px-4 py-3 text-left",
                  collapsed ? "justify-center" : "justify-start",
                )}
              >
                <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm text-sm font-medium">
                  {profile?.imageUrl ? (
                    <img src={profile.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    (user?.name?.[0]?.toUpperCase() ?? "?")
                  )}
                </div>
                {!collapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user?.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {activeCompany?.memberRole ? ROLE_LABELS[activeCompany.memberRole] : user?.isPlatformAdmin ? "Administrador" : user?.isSupportAgent ? "Suporte" : ""}
                    </p>
                  </div>
                )}
              </button>
            );

            if (!collapsed) {
              return <DropdownMenuTrigger asChild>{profileButton}</DropdownMenuTrigger>;
            }

            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>{profileButton}</DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{user?.name}</TooltipContent>
              </Tooltip>
            );
          })()}
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>{activeCompany?.name ?? "Sem empresa ativa"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="size-4" /> Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/business">Trocar empresa</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>

      <main className="bg-page flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
