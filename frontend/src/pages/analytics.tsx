import * as React from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, FileText, CheckCircle2, Timer, Sparkles, Mic, Users } from "lucide-react";
import { useKpis, useProductivity, useTrends, useDashboard } from "@/features/analytics/api";
import { useLocale, useT } from "@/features/i18n/locale-context";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDuration, initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

const RANGE_KEYS = [
  { days: 7, labelKey: "analytics.range7" },
  { days: 14, labelKey: "analytics.range14" },
  { days: 30, labelKey: "analytics.range30" },
  { days: 90, labelKey: "analytics.range90" },
] as const;

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
};

export default function AnalyticsPage() {
  const t = useT();
  const { locale } = useLocale();
  const [days, setDays] = React.useState(30);
  const kpis = useKpis(days);
  const productivity = useProductivity(days);
  const trends = useTrends(days > 30 ? 30 : days);
  const dashboard = useDashboard();

  const dateLocale = locale === "tr" ? "tr-TR" : "en-US";
  const trendData = (trends.data ?? []).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit" }),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("analytics.title")}
        description={t("analytics.description")}
        icon={<BarChart3 className="size-5" />}
        actions={
          <div className="flex rounded-lg border border-border p-0.5">
            {RANGE_KEYS.map((r) => (
              <Button
                key={r.days}
                variant={days === r.days ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-7 px-3 text-xs", days === r.days && "shadow-sm")}
                onClick={() => setDays(r.days)}
              >
                {t(r.labelKey)}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={t("analytics.totalReports")}
          value={kpis.data?.total_reports ?? 0}
          icon={FileText}
          tone="primary"
          loading={kpis.isLoading}
        />
        <StatCard
          label={t("analytics.signRate")}
          value={`%${kpis.data?.signed_rate ?? 0}`}
          icon={CheckCircle2}
          tone="success"
          loading={kpis.isLoading}
        />
        <StatCard
          label={t("analytics.avgTurnaround")}
          value={formatDuration(kpis.data?.avg_turnaround_minutes)}
          icon={Timer}
          tone="warning"
          loading={kpis.isLoading}
        />
        <StatCard
          label={t("analytics.aiUsage")}
          value={kpis.data?.ai_usage_count ?? 0}
          icon={Sparkles}
          tone="accent"
          loading={kpis.isLoading}
        />
        <StatCard
          label={t("analytics.transcriptions")}
          value={kpis.data?.transcriptions ?? 0}
          icon={Mic}
          tone="info"
          loading={kpis.isLoading}
        />
        <StatCard
          label={t("analytics.activeRadiologists")}
          value={kpis.data?.active_radiologists ?? 0}
          icon={Users}
          tone="primary"
          loading={kpis.isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("analytics.activityTrend")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("analytics.trendSubtitle")}</p>
          </CardHeader>
          <CardContent>
            {trends.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={288}>
                <LineChart data={trendData} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    stroke="hsl(var(--muted-foreground))"
                    width={32}
                  />
                  <RTooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="reports"
                    name={t("analytics.seriesReport")}
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="signed"
                    name={t("analytics.seriesSign")}
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="transcriptions"
                    name={t("analytics.seriesTranscribe")}
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("analytics.modalityDist")}</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : dashboard.data?.modality_breakdown.length ? (
              <ResponsiveContainer width="100%" height={288}>
                <PieChart>
                  <Pie
                    data={dashboard.data.modality_breakdown}
                    dataKey="count"
                    nameKey="modality"
                    innerRadius={56}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {dashboard.data.modality_breakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">{t("analytics.noData")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.radiologistProductivity")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("analytics.productivityDays", { days: String(days) })}</p>
        </CardHeader>
        <CardContent>
          {productivity.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : productivity.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("roles.radiologist")}</TableHead>
                  <TableHead className="text-right">{t("analytics.created")}</TableHead>
                  <TableHead className="text-right">{t("analytics.signedCol")}</TableHead>
                  <TableHead className="text-right">{t("analytics.avgTurnaroundCol")}</TableHead>
                  <TableHead className="text-right">{t("analytics.aiUsage")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productivity.data.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px]">{initials(row.display_name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{row.display_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.reports_created}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.reports_signed}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(row.avg_turnaround_minutes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.ai_formats}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              className="border-0"
              icon={Users}
              title={t("analytics.noData")}
              description={t("analytics.noProductivity")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
