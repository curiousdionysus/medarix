import * as React from "react";

const STORAGE_COLLAPSED = "medarixSidebarCollapsed";
const STORAGE_PINNED = "medarixSidebarPinned";
const STORAGE_AUTO_HIDE = "medarixSidebarAutoHide";

function readBool(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    if (v === "1" || v === "true") return true;
    if (v === "0" || v === "false") return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

interface SidebarLayoutState {
  collapsed: boolean;
  pinned: boolean;
  autoHide: boolean;
  hovered: boolean;
  iconOnly: boolean;
  setCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
  setPinned: (value: boolean) => void;
  togglePinned: () => void;
  setAutoHide: (value: boolean) => void;
  toggleAutoHide: () => void;
  setHovered: (value: boolean) => void;
}

const SidebarLayoutContext = React.createContext<SidebarLayoutState | null>(null);

export function SidebarLayoutProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = React.useState(() => readBool(STORAGE_COLLAPSED, false));
  const [pinned, setPinnedState] = React.useState(() => readBool(STORAGE_PINNED, true));
  const [autoHide, setAutoHideState] = React.useState(() => readBool(STORAGE_AUTO_HIDE, false));
  const [hovered, setHovered] = React.useState(false);

  const setCollapsed = React.useCallback((value: boolean) => {
    setCollapsedState(value);
    writeBool(STORAGE_COLLAPSED, value);
  }, []);

  const setPinned = React.useCallback((value: boolean) => {
    setPinnedState(value);
    writeBool(STORAGE_PINNED, value);
  }, []);

  const setAutoHide = React.useCallback((value: boolean) => {
    setAutoHideState(value);
    writeBool(STORAGE_AUTO_HIDE, value);
    if (value) setHovered(false);
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    const next = !collapsed;
    if (autoHide && !pinned) {
      setAutoHide(false);
      setCollapsed(next);
      return;
    }
    setCollapsed(next);
  }, [collapsed, autoHide, pinned, setCollapsed, setAutoHide]);

  const togglePinned = React.useCallback(() => {
    setPinned(!pinned);
  }, [pinned, setPinned]);

  const toggleAutoHide = React.useCallback(() => {
    setAutoHide(!autoHide);
  }, [autoHide, setAutoHide]);

  const iconOnly = pinned ? collapsed : autoHide ? !hovered : collapsed;

  const value = React.useMemo(
    () => ({
      collapsed,
      pinned,
      autoHide,
      hovered,
      iconOnly,
      setCollapsed,
      toggleCollapsed,
      setPinned,
      togglePinned,
      setAutoHide,
      toggleAutoHide,
      setHovered,
    }),
    [
      collapsed,
      pinned,
      autoHide,
      hovered,
      iconOnly,
      setCollapsed,
      toggleCollapsed,
      setPinned,
      togglePinned,
      setAutoHide,
      toggleAutoHide,
    ],
  );

  return <SidebarLayoutContext.Provider value={value}>{children}</SidebarLayoutContext.Provider>;
}

export function useSidebarLayout() {
  const ctx = React.useContext(SidebarLayoutContext);
  if (!ctx) throw new Error("useSidebarLayout must be used within SidebarLayoutProvider");
  return ctx;
}
