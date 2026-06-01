from app.services.patient_crypto import build_name_search, encrypt_value, normalize_name, patient_hash


def test_patient_hash_is_stable():
    assert patient_hash("12345678901") == patient_hash("12345678901")
    assert patient_hash("12345678901") != patient_hash("12345678902")


def test_normalize_name_turkish():
    assert "sukru" in normalize_name("Şükrü")
    assert normalize_name("  Ali  ") == "ali"


def test_build_name_search():
    assert "ali veli" in build_name_search("Ali", "Veli", None)


def test_encrypt_decrypt_roundtrip():
    value = "Deneme Hasta"
    encrypted = encrypt_value(value, raw_key="test-key")
    assert encrypted != value
    from app.services.patient_crypto import decrypt_value

    assert decrypt_value(encrypted, raw_key="test-key") == value
