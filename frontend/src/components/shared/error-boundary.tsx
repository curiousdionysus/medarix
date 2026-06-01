import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translateForLocale, getStoredLocale } from "@/features/i18n/locale-context";

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      const loc = getStoredLocale();
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="size-12 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold">{translateForLocale(loc, "errors.boundaryTitle")}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {translateForLocale(loc, "errors.boundaryDesc")}
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>{translateForLocale(loc, "errors.refreshPage")}</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
