import { useNavigate } from "react-router-dom";
import { Menu, Search, Moon, Sun, LogOut, User, Bell } from "lucide-react";
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
import { useTheme } from "@/features/theme/theme-context";
import { initials } from "@/lib/utils";
import { roleLabel } from "@/config/roles";

interface Props {
  onMenu: () => void;
  onOpenCommand: () => void;
}

export function Topbar({ onMenu, onOpenCommand }: Props) {
  const { user, logout } = useAuth();
  const { resolved, toggle } = useTheme();
  const navigate = useNavigate();
  const isMac = navigator.platform.toUpperCase().includes("MAC");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 glass">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Menü">
        <Menu className="size-5" />
      </Button>

      <button
        onClick={onOpenCommand}
        className="group flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-ring/60"
      >
        <Search className="size-4" />
        <span>Hasta, çalışma veya komut ara…</span>
        <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:flex">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Tema değiştir">
              {resolved === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tema: {resolved === "dark" ? "Koyu" : "Açık"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Bildirimler" className="relative">
              <Bell className="size-5" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive ring-2 ring-card" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bildirimler</TooltipContent>
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
                  {user?.roles?.map((r) => roleLabel(r)).join(", ") || "—"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/settings/profile")}>
              <User /> Profilim
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive">
              <LogOut /> Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
