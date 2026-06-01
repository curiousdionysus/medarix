import { useNavigate } from "react-router-dom";
import { Menu, Moon, Sun, LogOut, User, Bell, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/auth-context";
import { useLocale, useT } from "@/features/i18n/locale-context";
import { useSidebarLayout } from "@/features/layout/sidebar-layout-context";
import { useTheme } from "@/features/theme/theme-context";
import { cn, initials } from "@/lib/utils";
import { roleLabel } from "@/config/roles";

interface Props {
  onMenu: () => void;
}

export function Topbar({ onMenu }: Props) {
  const { user, logout } = useAuth();
  const { locale, setLocale } = useLocale();
  const t = useT();
  const { resolved, toggle } = useTheme();
  const { iconOnly, toggleCollapsed } = useSidebarLayout();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 glass">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label={t("topbar.menu")}>
        <Menu className="size-5" />
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={toggleCollapsed}
            aria-label={iconOnly ? t("sidebar.expand") : t("sidebar.collapse")}
          >
            <PanelLeft className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("topbar.toggleSidebar")}</TooltipContent>
      </Tooltip>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={t("topbar.themeToggle")}>
              {resolved === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t("topbar.theme")}: {resolved === "dark" ? t("topbar.themeDark") : t("topbar.themeLight")}
          </TooltipContent>
        </Tooltip>

        <div
          className="relative hidden h-8 items-stretch rounded-lg border border-border bg-background/60 p-0.5 sm:inline-flex"
          role="group"
          aria-label={t("settings.language")}
        >
          <span
            className={cn(
              "pointer-events-none absolute inset-y-0.5 z-0 w-[calc(50%-2px)] rounded-md bg-foreground/10 ring-1 ring-foreground/10 transition-[left] duration-200 ease-out",
              locale === "en" ? "left-[calc(50%+1px)]" : "left-0.5",
            )}
            aria-hidden
          />
          <button
            type="button"
            className={cn(
              "relative z-10 flex min-w-9 flex-1 items-center justify-center rounded-md px-2.5 text-xs font-semibold transition-colors",
              locale === "tr" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
            )}
            onClick={() => setLocale("tr")}
            aria-pressed={locale === "tr"}
          >
            TR
          </button>
          <button
            type="button"
            className={cn(
              "relative z-10 flex min-w-9 flex-1 items-center justify-center rounded-md px-2.5 text-xs font-semibold transition-colors",
              locale === "en" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
            )}
            onClick={() => setLocale("en")}
            aria-pressed={locale === "en"}
          >
            EN
          </button>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("topbar.notifications")} className="relative">
              <Bell className="size-5" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive ring-2 ring-card" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("topbar.notifications")}</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-secondary">
              <Avatar>
                <AvatarFallback>{initials(user?.display_name || user?.username)}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-semibold">{user?.display_name || user?.username}</p>
                <p className="text-[11px] text-muted-foreground">
                  {user?.roles?.map((r) => roleLabel(r, undefined, locale)).join(", ") || "—"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/settings/appearance")}>
              <User /> {t("topbar.profile")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive">
              <LogOut /> {t("topbar.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
