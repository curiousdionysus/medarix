import type { LucideIcon } from "lucide-react";
import { Rocket } from "lucide-react";
import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";

interface Props {
  title: string;
  description: string;
  icon?: LucideIcon;
}

/** Temporary scaffold for modules delivered in later phases. */
export function ModuleScaffold({ title, description, icon }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} icon={icon ? <IconWrap icon={icon} /> : undefined} />
      <EmptyState
        icon={Rocket}
        title="Bu modül hazırlanıyor"
        description="İlgili aşama tamamlandığında bu ekran tam işlevsel hale gelecektir."
      />
    </div>
  );
}

function IconWrap({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-5" />;
}
