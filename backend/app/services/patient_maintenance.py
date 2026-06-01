from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Patient
from app.services.patient_crypto import build_name_search, decrypt_value, encrypt_value, patient_hash
from app.services.system_settings import get_settings_map


def _patient_encryption_key(settings_map: dict[str, str]) -> str | None:
    raw = settings_map.get("security.patient_data_key", "").strip()
    if raw and raw != "********":
        return raw
    return None


def ensure_patient_encryption(db: Session) -> int:
    settings_map = get_settings_map(db)
    enc_key = _patient_encryption_key(settings_map)
    updated = 0
    for patient in db.scalars(select(Patient)):
        changed = False
        plain_name = decrypt_value(patient.name_enc, raw_key=enc_key) if patient.name_enc else None
        plain_id = decrypt_value(patient.patient_id_enc, raw_key=enc_key) if patient.patient_id_enc else None

        if plain_name and patient.name_enc == plain_name:
            patient.name_enc = encrypt_value(plain_name, raw_key=enc_key)
            changed = True
        if plain_id and patient.patient_id_enc == plain_id:
            patient.patient_id_enc = encrypt_value(plain_id, raw_key=enc_key)
            changed = True

        search = build_name_search(None, None, plain_name)
        if search and patient.name_search != search:
            patient.name_search = search
            changed = True
        if plain_id:
            hashed = patient_hash(plain_id)
            if patient.patient_hash != hashed:
                patient.patient_hash = hashed
                changed = True
        if changed:
            updated += 1
    if updated:
        db.commit()
    return updated
