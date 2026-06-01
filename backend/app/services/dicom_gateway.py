import json
from datetime import date, datetime, timedelta, timezone

import httpx

from app.core.config import get_settings
from app.models import Report, Study
from app.services.orthanc_http import orthanc_basic_auth
from app.schemas import PacsQueryRequest, PacsRetrieveRequest
from app.services.dicom_sr import build_basic_text_sr
from app.services.pacs_qr_client import PacsConnectionError, PacsMoveParams, PacsQueryParams, find_studies, move_study
from app.services.pacs_query_sync import parse_study_find_dataset


class DicomGateway:
    """Boundary for PACS C-FIND/C-MOVE/C-STORE and DICOMweb integration."""

    def _connection(self, system_settings: dict[str, str]) -> tuple[str, int, str, str]:
        host = (system_settings.get("pacs.host") or "").strip()
        port = int(system_settings["pacs.port"])
        local_ae = (system_settings.get("pacs.ae_title") or "MEDARIX").strip()
        called_ae = (system_settings.get("pacs.called_ae_title") or "").strip()
        return host, port, local_ae, called_ae

    def _date_window(
        self,
        system_settings: dict[str, str],
        study_date: str | None,
    ) -> tuple[date, date]:
        if study_date and len(study_date) >= 8:
            token = study_date.replace("-", "")[:8]
            try:
                d = date(int(token[0:4]), int(token[4:6]), int(token[6:8]))
                return d, d
            except ValueError:
                pass
        today = datetime.now(timezone.utc).date()
        days = int(
            system_settings.get("pacs.query_sync_days")
            or system_settings.get("pacs.mwl_sync_days", "7")
            or "7"
        )
        days = max(0, min(days, 90))
        return today - timedelta(days=days), today + timedelta(days=days)

    def query_studies(self, request: PacsQueryRequest, system_settings: dict[str, str]) -> list[dict]:
        host, port, local_ae, called_ae = self._connection(system_settings)
        from_date, to_date = self._date_window(system_settings, request.study_date)
        params = PacsQueryParams(
            local_ae_title=local_ae,
            called_ae_title=called_ae,
            host=host,
            port=port,
            from_date=from_date,
            to_date=to_date,
            modality=request.modality,
            patient_id=request.patient_id,
            accession_number=request.accession_number,
        )
        datasets = find_studies(params)
        results: list[dict] = []
        for ds in datasets:
            item = parse_study_find_dataset(ds)
            if not item:
                continue
            results.append(
                {
                    "source": "pacs_query_retrieve",
                    "study_instance_uid": item.study_instance_uid,
                    "patient_id": item.patient_id,
                    "patient_name": item.patient_name,
                    "accession_number": item.accession_number,
                    "modality": item.modality,
                    "study_date": item.study_date.isoformat() if item.study_date else None,
                    "study_description": item.study_description,
                    "pacs_host": host,
                    "pacs_port": port,
                    "called_ae_title": called_ae,
                }
            )
        return results

    def retrieve_study(self, request: PacsRetrieveRequest, system_settings: dict[str, str]) -> dict:
        host, port, local_ae, called_ae = self._connection(system_settings)
        move_dest = (
            request.destination_ae_title
            or system_settings.get("pacs.move_destination_ae")
            or local_ae
        ).strip()
        params = PacsMoveParams(
            local_ae_title=local_ae,
            called_ae_title=called_ae,
            host=host,
            port=port,
            study_instance_uid=request.study_instance_uid,
            move_destination_ae=move_dest,
        )
        try:
            return move_study(params)
        except PacsConnectionError as exc:
            return {
                "study_instance_uid": request.study_instance_uid,
                "move_destination_ae": move_dest,
                "status": "failed",
                "detail": str(exc),
            }

    def dicomweb_viewer_url(self, study_instance_uid: str, system_settings: dict[str, str]) -> str:
        settings = get_settings()
        prefix = settings.api_prefix.rstrip("/")
        return (
            f"/viewer?StudyInstanceUIDs={study_instance_uid}"
            f"&dicomweb={prefix}/pacs/dicomweb"
        )

    def store_report(
        self,
        report: Report,
        study: Study,
        system_settings: dict[str, str],
        author_name: str = "Radiology",
    ) -> dict:
        status = {
            "report_id": str(report.id),
            "study_instance_uid": study.study_instance_uid,
            "accession_number": study.accession_number,
            "pacs_host": system_settings["pacs.host"],
            "called_ae_title": system_settings["pacs.called_ae_title"],
            "status": "queued_for_pacs_report_store_adapter",
        }

        orthanc_base_url = self._orthanc_rest_base_url(system_settings.get("pacs.dicomweb_base_url", ""))
        if not orthanc_base_url:
            return status

        auth = orthanc_basic_auth()
        try:
            with httpx.Client(timeout=30.0, auth=auth) as client:
                response = client.post(
                    f"{orthanc_base_url}/tools/find",
                    json={
                        "Level": "Study",
                        "Query": {"StudyInstanceUID": study.study_instance_uid},
                        "Expand": False,
                    },
                )
                response.raise_for_status()
                study_ids = response.json()
                if not study_ids:
                    status["status"] = "queued_for_pacs_report_store_adapter"
                    status["detail"] = "Study was not found in Orthanc REST store."
                    return status

                orthanc_study_id = study_ids[0]
                payload = {
                    "report_id": str(report.id),
                    "study_id": str(study.id),
                    "study_instance_uid": study.study_instance_uid,
                    "accession_number": study.accession_number,
                    "status": report.status.value,
                    "signed_at": report.signed_at.isoformat() if report.signed_at else None,
                    "content": report.content,
                }
                store_response = client.put(
                    f"{orthanc_base_url}/studies/{orthanc_study_id}/attachments/report-{report.id}.json",
                    content=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                store_response.raise_for_status()
                status["status"] = "stored_in_orthanc_study_attachment"
                status["orthanc_study_id"] = orthanc_study_id

                sr_bytes = build_basic_text_sr(report, study, author_name)
                sr_response = client.post(
                    f"{orthanc_base_url}/instances",
                    content=sr_bytes,
                    headers={"Content-Type": "application/dicom"},
                )
                sr_response.raise_for_status()
                sr_payload = sr_response.json()
                status["dicom_sr_instance_id"] = sr_payload.get("ID")
                status["dicom_sr_status"] = "stored"
                return status
        except httpx.HTTPError as exc:
            status["detail"] = str(exc)
            return status

    def _orthanc_rest_base_url(self, dicomweb_base_url: str) -> str | None:
        base_url = dicomweb_base_url.rstrip("/")
        if not base_url:
            return None
        if base_url.endswith("/dicom-web"):
            return base_url[: -len("/dicom-web")]
        return None


dicom_gateway = DicomGateway()
