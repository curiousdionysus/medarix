import * as React from "react";
import { Outlet } from "react-router-dom";
import { useT } from "@/features/i18n/locale-context";
import { SidebarLayoutProvider } from "@/features/layout/sidebar-layout-context";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";

export function AppLayout() {
  const t = useT();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [cmdOpen, setCmdOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <SidebarLayoutProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </main>
          <footer className="shrink-0 border-t border-border bg-card/50 px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-center text-xs text-muted-foreground">
              {t("layout.footerCopyright")}
            </p>
          </footer>
        </div>
        <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      </div>
    </SidebarLayoutProvider>
  );
}
