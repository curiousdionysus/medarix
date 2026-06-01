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
import { useT } from "@/features/i18n/locale-context";
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
  const t = useT();

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
      <CommandInput placeholder={t("command.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("command.empty")}</CommandEmpty>
        <CommandGroup heading={t("command.nav")}>
          {navItems.map((item) => (
            <CommandItem key={item.to} value={t(item.labelKey)} onSelect={() => go(item.to)}>
              <item.icon />
              {t(item.labelKey)}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading={t("command.actions")}>
          <CommandItem
            value={t("command.toggleTheme")}
            onSelect={() => {
              toggle();
              onOpenChange(false);
            }}
          >
            <Sun className="dark:hidden" />
            <Moon className="hidden dark:block" />
            {t("command.toggleTheme")}
          </CommandItem>
          <CommandItem
            value={t("command.logout")}
            onSelect={() => {
              onOpenChange(false);
              logout();
            }}
          >
            <LogOut />
            {t("command.logout")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
