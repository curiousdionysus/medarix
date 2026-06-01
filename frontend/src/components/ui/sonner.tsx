import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/features/theme/theme-context";

export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-lg border border-border bg-card text-foreground shadow-lg",
        },
      }}
    />
  );
}
