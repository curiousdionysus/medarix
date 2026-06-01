import * as React from "react";
import { usePublicBranding } from "@/features/branding/api";
import { applyBrandingToDocument, mergeBranding, pickLogoSrc } from "@/features/branding/branding-utils";
import type { PublicBranding } from "@/features/branding/types";
import { useTheme } from "@/features/theme/theme-context";

interface BrandingState {
  branding: PublicBranding;
  isLoading: boolean;
  logoSrc: string | null;
  refresh: () => void;
}

const BrandingContext = React.createContext<BrandingState | null>(null);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { resolved } = useTheme();
  const { data, isLoading, refetch } = usePublicBranding();
  const branding = React.useMemo(() => mergeBranding(data), [data]);
  const logoSrc = React.useMemo(() => pickLogoSrc(branding, resolved), [branding, resolved]);

  React.useEffect(() => {
    if (!isLoading) applyBrandingToDocument(branding);
  }, [branding, isLoading]);

  const value = React.useMemo(
    () => ({
      branding,
      isLoading,
      logoSrc,
      refresh: () => void refetch(),
    }),
    [branding, isLoading, logoSrc, refetch],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = React.useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
