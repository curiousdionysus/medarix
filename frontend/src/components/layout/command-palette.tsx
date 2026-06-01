import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_SECTIONS } from "@/config/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { useIsEnterprise } from "@/features/license/api";
import { useTheme } from "@/features/theme/theme-context";
import { Moon, Sun, LogOut } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { hasRole, logout } = useAuth();
  const isEnterprise = useIsEnterprise();
  const { toggle } = useTheme();

  const go = React.useCallback(
    (to: string) => {
      onOpenChange(false);
      navigate(to);
    },
    [navigate, onOpenChange],
  );

  const navItems = NAV_SECTIONS.filter((s) => !s.enterprise || isEnterprise)
    .flatMap((s) => s.items)
    .filter((it) => (!it.enterprise || isEnterprise) && (!it.roles || hasRole(...it.roles)));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Sayfalara git veya komut çalıştır…" />
      <CommandList>
        <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
        <CommandGroup heading="Gezinme">
          {navItems.map((item) => (
            <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)}>
              <item.icon />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Eylemler">
          <CommandItem
            value="tema değiştir"
            onSelect={() => {
              toggle();
              onOpenChange(false);
            }}
          >
            <Sun className="dark:hidden" />
            <Moon className="hidden dark:block" />
            Temayı değiştir
          </CommandItem>
          <CommandItem
            value="çıkış yap"
            onSelect={() => {
              onOpenChange(false);
              logout();
            }}
          >
            <LogOut />
            Çıkış yap
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
