import httpx


def _parse_openai_models_list(payload: dict) -> list[str]:
    """Parse OpenAI-compatible GET /v1/models (data may be null on some Ollama builds)."""
    raw = payload.get("data")
    if not isinstance(raw, list):
        return []
    names: list[str] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id") or item.get("name")
        if model_id:
            names.append(str(model_id))
    return names


def _parse_ollama_tags(payload: dict) -> list[str]:
    models = payload.get("models")
    if not isinstance(models, list):
        return []
    names: list[str] = []
    for item in models:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("model")
        if name:
            names.append(str(name))
    return names


def _ollama_root_from_v1_base(base_url: str) -> str | None:
    base = base_url.rstrip("/")
    if base.endswith("/v1"):
        return base[:-3].rstrip("/") or None
    return None


class AiGateway:
    def __init__(self) -> None:
        self.timeout = httpx.Timeout(120.0)

    async def _fetch_model_names(self, client: httpx.AsyncClient, url: str) -> list[str]:
        response = await client.get(url)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            return []
        names = _parse_openai_models_list(payload)
        if names:
            return names
        return _parse_ollama_tags(payload)

    async def list_text_models(self, base_url: str) -> list[str]:
        base = base_url.rstrip("/")
        urls = [f"{base}/models"]
        ollama_root = _ollama_root_from_v1_base(base)
        if ollama_root:
            urls.append(f"{ollama_root}/api/tags")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            last_error: Exception | None = None
            for url in urls:
                try:
                    names = await self._fetch_model_names(client, url)
                    if names or url == urls[-1]:
                        return sorted(set(names))
                except Exception as exc:  # noqa: BLE001
                    last_error = exc
            if last_error:
                raise last_error
            return []

    async def list_transcription_models(self, base_url: str) -> list[str]:
        base = base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            names = await self._fetch_model_names(client, f"{base}/models")
            return sorted(set(names))

    async def transcribe_audio(
        self,
        base_url: str,
        model: str,
        language: str,
        filename: str,
        content: bytes,
        content_type: str | None,
    ) -> str:
        transcription_hints = (
            "Bu kayıt Türkçe radyoloji diktesidir. Çıktıyı Türkçe Latin alfabesiyle yaz. "
            "İbranice, Arapça veya başka alfabe kullanma."
        )
        radiology_hotwords = (
            "akciğer, grafisi, sol, sağ, bronkovasküler, opasite, infiltrasyon, plevral, "
            "efüzyon, pnömotoraks, kardiyotorasik, mediasten, diyafragma, radyoloji"
        )
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{base_url.rstrip('/')}/audio/transcriptions",
                data={
                    "model": model,
                    "language": language,
                    "prompt": transcription_hints,
                    "hotwords": radiology_hotwords,
                    "response_format": "json",
                    "temperature": "0",
                    "vad_filter": "true",
                },
                files={"file": (filename, content, content_type or "application/octet-stream")},
            )
            response.raise_for_status()
            payload = response.json()
            return payload.get("text", "")

    async def format_report(self, base_url: str, model: str, transcript: str, template: str | None = None) -> str:
        system_prompt = (
            "Sen kıdemli bir radyoloji uzmanısın. Görevin, ses transkripsiyonundan gelen Türkçe radyoloji "
            "metnini yalnızca yazım, noktalama, tıbbi terminoloji ve rapor düzeni açısından düzeltmektir.\n\n"
            "Kesin kurallar:\n"
            "- ASLA yeni bulgu, tanı, ölçüm, taraf bilgisi veya klinik öneri ekleme.\n"
            "- ASLA 'normal', 'akut bulgu yok', 'patoloji saptanmadı' gibi sonuçları kullanıcı metninde açıkça yoksa üretme.\n"
            "- ASLA Dictated By, Physician, Patient ID, Date, Study Type gibi placeholder veya idari alan üretme.\n"
            "- ASLA İngilizce başlık veya İngilizce rapor formatı kullanma.\n"
            "- Emin olmadığın ifadeyi değiştirme; anlamı koru.\n"
            "- Test/deneme içerikleri varsa bunları rapora dönüştürme, sadece mevcut metni temizle.\n"
            "- Raporu her zaman şu başlıklarla ve bu sırayla düzenle: İNCELEME, KLİNİK BİLGİ, "
            "KARŞILAŞTIRMA, BULGULAR, SONUÇ, ÖNERİ.\n"
            "- Her başlığı büyük harfle yaz ve başlığın sonuna iki nokta koy.\n"
            "- KLİNİK BİLGİ, KARŞILAŞTIRMA veya ÖNERİ alanlarında kullanıcı metninde açık bilgi yoksa "
            "'Belirtilmedi.' yaz; yeni klinik öneri üretme.\n"
            "- BULGULAR ve SONUÇ alanlarına yalnızca kullanıcı metninde geçen radyolojik bilgileri yerleştir; "
            "metinde olmayan normal/negatif bulgu cümlesi ekleme.\n"
            "- Çıktı yalnızca düzeltilmiş Türkçe rapor metni olsun; açıklama, uyarı veya gerekçe yazma."
        )
        if template:
            system_prompt += (
                "\n\nAşağıdaki taslağı yalnızca inceleme türü ve içerik rehberi olarak kullan. "
                "Çıktıda yine zorunlu başlık sırasını koru: İNCELEME, KLİNİK BİLGİ, KARŞILAŞTIRMA, BULGULAR, SONUÇ, ÖNERİ. "
                "Taslakta yer alan boşlukları, örnek ifadeleri veya placeholder alanları doldurma; "
                "sadece kullanıcı metninde bulunan bilgileri uygun başlıkların altına yerleştir.\n"
                f"{template}"
            )

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                json={
                    "model": model,
                    "temperature": 0.1,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Düzeltilecek transkripsiyon:\n{transcript}"},
                    ],
                },
            )
            response.raise_for_status()
            payload = response.json()
            return payload["choices"][0]["message"]["content"]

    async def _chat(self, base_url: str, model: str, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                json={
                    "model": model,
                    "temperature": temperature,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
            response.raise_for_status()
            payload = response.json()
            return payload["choices"][0]["message"]["content"]

    SUGGESTION_PROMPTS = {
        "improve": (
            "Sen kıdemli bir radyoloji editörüsün. Aşağıdaki Türkçe radyoloji metnini akıcılık, "
            "netlik ve profesyonel ton açısından iyileştir. Yeni klinik bulgu ekleme. Yalnızca düzeltilmiş metni döndür."
        ),
        "grammar": (
            "Sen bir Türkçe dilbilgisi ve imla düzeltici uzmanısın. Aşağıdaki radyoloji metninin yalnızca "
            "yazım, noktalama ve dilbilgisini düzelt. Anlamı ve klinik içeriği değiştirme. Yalnızca düzeltilmiş metni döndür."
        ),
        "terminology": (
            "Sen bir radyoloji terminoloji uzmanısın. Aşağıdaki metindeki günlük ifadeleri uygun tıbbi "
            "terminolojiyle değiştir, ancak yeni bulgu ekleme. Yalnızca düzeltilmiş metni döndür."
        ),
        "structure": (
            "Sen bir radyoloji raporu editörüsün. Aşağıdaki metni şu başlıklarla yeniden yapılandır: "
            "İNCELEME, KLİNİK BİLGİ, KARŞILAŞTIRMA, BULGULAR, SONUÇ, ÖNERİ. Bilgi yoksa 'Belirtilmedi.' yaz. "
            "Yeni klinik bilgi ekleme. Yalnızca yapılandırılmış metni döndür."
        ),
    }

    async def suggest(self, base_url: str, model: str, text: str, kind: str) -> str:
        system_prompt = self.SUGGESTION_PROMPTS.get(kind, self.SUGGESTION_PROMPTS["improve"])
        return await self._chat(base_url, model, system_prompt, text, temperature=0.2)

    async def assistant_reply(self, base_url: str, model: str, messages: list[dict], report_context: str | None) -> str:
        system_prompt = (
            "Sen Medarix platformunda çalışan, radyolojiye özel bir yapay zeka asistanısın. "
            "Radyologlara raporlama, terminoloji, ayırıcı tanı listeleri ve protokoller konusunda yardımcı olursun. "
            "Türkçe, kısa ve klinik açıdan doğru yanıtlar ver. Kesin tanı koyma; karar desteği sağla ve "
            "her zaman uzman değerlendirmesinin gerekli olduğunu hatırlat."
        )
        if report_context:
            system_prompt += f"\n\nKullanıcının üzerinde çalıştığı mevcut rapor bağlamı:\n{report_context}"
        allowed_roles = {"user", "assistant"}
        chat_messages = [{"role": "system", "content": system_prompt}]
        for message in messages:
            role = (message.get("role") or "user").lower()
            if role not in allowed_roles:
                continue
            content = message.get("content")
            if content is None:
                continue
            chat_messages.append({"role": role, "content": str(content)})
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                json={"model": model, "temperature": 0.3, "messages": chat_messages},
            )
            response.raise_for_status()
            payload = response.json()
            return payload["choices"][0]["message"]["content"]


ai_gateway = AiGateway()
