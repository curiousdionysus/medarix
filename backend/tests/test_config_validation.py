import pytest

from app.core.config import Settings
from app.core.config_validation import validate_settings


def _production_settings(**overrides) -> Settings:
    base = {
        "environment": "production",
        "session_jwt_secret": "x" * 40,
        "audit_hmac_secret": "y" * 40,
        "license_signing_secret": "z" * 40,
        "patient_data_key": "dedicated-patient-encryption-key-32",
        "redis_url": "redis://localhost:6379/0",
        "allow_bootstrap_admin": False,
        "allow_license_issue": False,
        "allow_legacy_ui": False,
        "cookie_secure": True,
        "default_admin_password": "not-the-default-password",
        "orthanc_password": "strong-orthanc-secret",
    }
    base.update(overrides)
    return Settings(**base)


def test_production_valid_settings_pass():
    validate_settings(_production_settings())


def test_production_requires_patient_data_key():
    with pytest.raises(RuntimeError, match="PATIENT_DATA_KEY"):
        validate_settings(_production_settings(patient_data_key=""))


def test_production_requires_redis_url():
    with pytest.raises(RuntimeError, match="REDIS_URL"):
        validate_settings(_production_settings(redis_url=""))


def test_development_skips_validation():
    validate_settings(Settings(environment="development"))
