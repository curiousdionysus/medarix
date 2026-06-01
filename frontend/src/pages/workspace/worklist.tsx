import * as React from "react";

import { useNavigate } from "react-router-dom";

import { ListChecks } from "lucide-react";

import { toast } from "sonner";

import { useStudies, type StudyFilters } from "@/features/studies/api";

import { useSyncPacsWorklist } from "@/features/pacs/api";

import { useIsEnterprise } from "@/features/license/api";

import { StudyFilterBar } from "@/features/studies/filter-bar";

import { WorklistList } from "@/features/worklist/worklist-list";

import { useApiError } from "@/features/i18n/helpers";

import { useT } from "@/features/i18n/locale-context";

import { PageHeader } from "@/components/shared/page-header";

import { EmptyState } from "@/components/shared/empty-state";

import type { StudyOut } from "@/types/api";



export default function WorklistPage() {

  const t = useT();

  const apiErr = useApiError();

  const [filters, setFilters] = React.useState<StudyFilters>({ limit: 150, include_imaging: true });

  const { data, isLoading, isFetching } = useStudies(filters);

  const navigate = useNavigate();

  const isEnterprise = useIsEnterprise();

  const syncPacs = useSyncPacsWorklist();



  const pullMwlBeforeSearch = React.useCallback(

    async (next: StudyFilters) => {

      if (!isEnterprise) {

        toast.error(t("worklist.pacsEnterpriseRequired"));

        return;

      }

      try {

        const res = await syncPacs.mutateAsync({

          from_date: next.from_date,

          to_date: next.to_date,

          modality: next.modality?.[0],

          accession_number: next.accession_number,

          patient_id: next.patient_tc,

        });

        toast.success(

          t("worklist.pacsSyncDone", {

            fetched: String(res.fetched),

            created: String(res.created),

            updated: String(res.updated),

          }),

        );

        if (res.errors.length) {

          toast.warning(t("worklist.pacsSyncPartial", { count: String(res.errors.length) }));

        }

      } catch (err) {

        toast.error(apiErr(err, "worklist.pacsSyncFail"));

        throw err;

      }

    },

    [apiErr, isEnterprise, syncPacs, t],

  );



  const openStudy = React.useCallback(

    (s: StudyOut) => {

      navigate(`/workspace/dictation?studyId=${s.id}`, { state: { study: s } });

    },

    [navigate],

  );



  const studies = data ?? [];

  const total = studies.length;

  const studiesLoading = isLoading;

  const studiesFetching = isFetching && !isLoading;



  return (

    <div className="space-y-5">

      <PageHeader

        title={t("worklist.title")}

        description={t("worklist.description")}

        icon={<ListChecks className="size-5" />}

      />



      <StudyFilterBar

        value={filters}

        onChange={setFilters}

        onBeforeSearch={pullMwlBeforeSearch}

        searchPending={syncPacs.isPending}

      />



      {!studiesLoading && total > 0 && filters.limit && total >= filters.limit ? (

        <p className="text-center text-xs text-muted-foreground">

          {t("worklist.studiesLimit", { limit: String(filters.limit) })}

        </p>

      ) : null}



      {(studiesLoading || total > 0) && (

        <WorklistList

          studies={studies}

          loading={studiesLoading}

          fetching={studiesFetching || syncPacs.isPending}

          patientFallback={t("common.unnamedPatient")}

          onOpenStudy={openStudy}

        />

      )}



      {!studiesLoading && total === 0 && (

        <EmptyState icon={ListChecks} title={t("worklist.empty")} description={t("filter.search")} />

      )}

    </div>

  );

}

