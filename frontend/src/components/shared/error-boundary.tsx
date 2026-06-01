import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Medarix] UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
              <AlertTriangle className="size-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Medarix servisi bir sorunla karşılaştı</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Medarix Platform bu bölümü görüntülerken beklenmeyen bir hata oluştu. Sayfayı yeniden
                yükleyin.
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>Sayfayı Yenile</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
