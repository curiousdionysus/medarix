import * as React from "react";
import { NavLink } from "react-router-dom";
import {
  Stethoscope,
  X,
  PanelLeftClose,
  PanelLeft,
  Pin,
  PinOff,
  PanelLeftDashed,
} from "lucide-react";
import { NAV_SECTIONS } from "@/config/navigation";
import { useBranding } from "@/features/branding/branding-context";
import { useAuth } from "@/features/auth/auth-context";
import { useT } from "@/features/i18n/locale-context";
import { useSidebarLayout } from "@/features/layout/sidebar-layout-context";
import { useIsEnterprise } from "@/features/license/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Collapsed rail width — icon column matches exactly */
const RAIL_W = "4.5rem";
const SIDEBAR_EXPANDED = "16rem";
const SIDEBAR_EXPAND_MS = 200;

interface Props {
  mobileOpen: boolean;
  onClose: () => void;
}

function SidebarIconAction({
  label,
  side,
  active,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  side: "top" | "right";
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          className={cn(
            "group/icon relative flex size-9 items-center justify-center rounded-full",
            "text-sidebar-muted transition-colors duration-200",
            "hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
            "disabled:pointer-events-none disabled:opacity-40",
            active && "text-white",
            className,
          )}
        >
          <span
            className="pointer-events-none absolute inset-0.5 rounded-full bg-transparent transition-colors group-hover/icon:bg-white/[0.05]"
            aria-hidden
          />
          <span className="relative z-[1] [&_svg]:block">{children}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ mobileOpen, onClose }: Props) {
  const isEnterprise = useIsEnterprise();
  const { hasRole } = useAuth();
  const { branding, logoSrc } = useBranding();
  const t = useT();
  const {
    iconOnly,
    hovered,
    pinned,
    autoHide,
    toggleCollapsed,
    togglePinned,
    toggleAutoHide,
    setHovered,
  } = useSidebarLayout();

  const expanded = !iconOnly || mobileOpen;
  /** Hover peek: show item labels only — section titles would shift icons vertically */
  const isHoverPeek = autoHide && !pinned && hovered && expanded;
  const showFullChrome = !isHoverPeek;

  const [showLabels, setShowLabels] = React.useState(expanded);

  React.useEffect(() => {
    if (!expanded) {
      setShowLabels(false);
      return;
    }
    if (mobileOpen) {
      setShowLabels(true);
      return;
    }
    const timer = window.setTimeout(() => setShowLabels(true), SIDEBAR_EXPAND_MS);
    return () => window.clearTimeout(timer);
  }, [expanded, mobileOpen]);

  const showTooltips = iconOnly && !hovered && !mobileOpen;

  const sections = NAV_SECTIONS.map((section, i) => {
    if (section.enterprise && !isEnterprise) return null;
    const items = section.items.filter(
      (it) => (!it.enterprise || isEnterprise) && (!it.roles || hasRole(...it.roles)),
    );
    if (items.length === 0) return null;
    return { section, items, index: i };
  }).filter(Boolean) as {
    section: (typeof NAV_SECTIONS)[number];
    items: (typeof NAV_SECTIONS)[number]["items"];
    index: number;
  }[];

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
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: expanded ? SIDEBAR_EXPANDED : RAIL_W }}
        className={cn(
          "relative fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
          "transition-[width,transform] duration-200 ease-out lg:static",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Header — h-16 matches topbar so border lines align */}
        <div className="flex h-16 shrink-0 items-center border-b border-white/[0.08]">
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ width: RAIL_W }}
          >
            {logoSrc ? (
              <img src={logoSrc} alt="" className="size-7 rounded-full object-contain" />
            ) : (
              <Stethoscope className="size-5 text-white/85" strokeWidth={1.5} />
            )}
          </div>
          <div
            className={cn(
              "min-w-0 flex-1 space-y-0.5 pr-3 leading-tight transition-opacity duration-150",
              showLabels ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={!showLabels}
          >
            <p className="truncate text-[13px] font-semibold text-white">{branding.product_title}</p>
            <p className="truncate text-[11px] text-sidebar-muted">{branding.product_subtitle}</p>
            {branding.org_name ? (
              <p className="truncate text-[10px] text-sidebar-muted/85">{branding.org_name}</p>
            ) : null}
          </div>
        </div>

        <nav className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto py-1.5">
          {sections.map(({ section, items, index }, sectionIdx) => (
            <div key={index}>
              {sectionIdx > 0 && (
                <div className="px-3 pb-1 pt-2">
                  <div
                    className="h-px bg-white/[0.12]"
                    style={
                      expanded
                        ? undefined
                        : { width: `calc(${RAIL_W} - 1.5rem)`, margin: "0 auto" }
                    }
                    aria-hidden
                  />
                  <div
                    className="mt-2 flex h-4 items-center"
                    style={{ paddingLeft: expanded ? RAIL_W : 0 }}
                  >
                    {section.titleKey && showLabels && showFullChrome ? (
                      <p className="truncate text-[10px] font-medium uppercase tracking-widest text-white/55">
                        {t(section.titleKey)}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
              {section.titleKey && sectionIdx === 0 && showLabels && showFullChrome && (
                <p
                  className="mb-1 mt-1 truncate pr-3 text-[10px] font-medium uppercase tracking-widest text-white/55"
                  style={{ paddingLeft: RAIL_W }}
                >
                  {t(section.titleKey)}
                </p>
              )}
              {items.map((item) => {
                const label = t(item.labelKey);
                const link = (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={() =>
                      cn(
                        "group/nav relative grid h-10 w-full grid-cols-[4.5rem_1fr] items-center text-[13px] font-medium leading-none text-white",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className="pointer-events-none absolute left-0 right-2 top-1 h-8"
                          aria-hidden
                        >
                          <span
                            className={cn(
                              "block h-full w-full rounded-md bg-white/[0.08] transition-opacity duration-200",
                              isActive
                                ? "animate-sidebar-nav-pill opacity-100"
                                : "opacity-0 group-hover/nav:opacity-60",
                            )}
                          />
                        </span>
                        {isActive ? (
                          <span
                            className="pointer-events-none absolute left-0 top-2.5 z-[2] h-5 w-[3px] animate-sidebar-nav-indicator rounded-r-full bg-sidebar-accent"
                            aria-hidden
                          />
                        ) : null}
                        <span
                          className="relative z-[1] flex items-center justify-center"
                          style={{ width: RAIL_W }}
                        >
                          <item.icon
                            className="size-[18px] shrink-0 text-white"
                            strokeWidth={isActive ? 2.25 : 1.75}
                          />
                        </span>
                        <span
                          className={cn(
                            "relative z-[1] min-w-0 truncate pr-3 text-white transition-opacity duration-150",
                            showLabels ? "opacity-100" : "opacity-0",
                          )}
                          aria-hidden={!showLabels}
                        >
                          {label}
                        </span>
                      </>
                    )}
                  </NavLink>
                );

                if (!showTooltips) return link;

                return (
                  <Tooltip key={item.to} delayDuration={200}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8} className="text-xs">
                      {label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/[0.08] py-1.5">
          <div
            className={cn(
              "flex",
              expanded ? "flex-row pl-1" : "flex-col items-center",
            )}
            style={expanded ? undefined : { width: RAIL_W }}
          >
            <SidebarIconAction
              active={pinned}
              label={pinned ? t("sidebar.unpin") : t("sidebar.pin")}
              side={expanded ? "top" : "right"}
              onClick={togglePinned}
            >
              {pinned ? <Pin className="size-4" /> : <PinOff className="size-4" />}
            </SidebarIconAction>
            <SidebarIconAction
              active={autoHide && !pinned}
              label={
                pinned ? t("sidebar.pinnedHint") : autoHide ? t("sidebar.autoHideOff") : t("sidebar.autoHide")
              }
              side={expanded ? "top" : "right"}
              onClick={toggleAutoHide}
              disabled={pinned}
            >
              <PanelLeftDashed className="size-4" />
            </SidebarIconAction>
            <SidebarIconAction
              label={expanded ? t("sidebar.collapse") : t("sidebar.expand")}
              side={expanded ? "top" : "right"}
              onClick={toggleCollapsed}
              className="hidden lg:flex"
            >
              {expanded ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
            </SidebarIconAction>
          </div>
          {showLabels && showFullChrome && (
            <p className="mt-1.5 text-center text-[10px] text-sidebar-muted/60">
              v1.0 · {isEnterprise ? t("sidebar.editionEnterprise") : t("sidebar.editionStandard")}
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2.5 size-9 rounded-full text-sidebar-muted hover:bg-white/[0.06] hover:text-white lg:hidden"
          onClick={onClose}
          aria-label={t("topbar.menu")}
        >
          <X className="size-4" strokeWidth={1.5} />
        </Button>
      </aside>
    </>
  );
}
