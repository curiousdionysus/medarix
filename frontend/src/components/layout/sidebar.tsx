import { NavLink } from "react-router-dom";
import { Stethoscope, X } from "lucide-react";
import { NAV_SECTIONS } from "@/config/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { useIsEnterprise } from "@/features/license/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: Props) {
  const isEnterprise = useIsEnterprise();
  const { hasRole } = useAuth();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground shadow-lg">
            <Stethoscope className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-extrabold tracking-tight text-white">Medarix</p>
            <p className="text-[11px] text-sidebar-muted">Radyoloji Platformu</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-sidebar-muted hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section, i) => {
            if (section.enterprise && !isEnterprise) return null;
            const items = section.items.filter(
              (it) => (!it.enterprise || isEnterprise) && (!it.roles || hasRole(...it.roles)),
            );
            if (items.length === 0) return null;
            return (
              <div key={i} className="space-y-1">
                {section.title && (
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                    {section.title}
                  </p>
                )}
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent/15 text-white"
                          : "text-sidebar-foreground hover:bg-white/5 hover:text-white",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            "flex h-5 w-1 shrink-0 rounded-full transition-colors",
                            isActive ? "bg-sidebar-accent" : "bg-transparent",
                          )}
                        />
                        <item.icon className="size-[18px] shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-3">
          <p className="text-[11px] text-sidebar-muted">v1.0 · {isEnterprise ? "Enterprise" : "Standard"}</p>
        </div>
      </aside>
    </>
  );
}
