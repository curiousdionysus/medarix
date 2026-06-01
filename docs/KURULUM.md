# Medarix Yükleme Kılavuzu

Bu kılavuz, **Medarix** deposunu (uygulama, PostgreSQL, Redis, Orthanc, Ollama, Whisper) Docker ile kurup çalıştırmanız için hazırlanmıştır.

## 1. Gereksinimler

| Bileşen | Önerilen |
|--------|----------|
| **Docker Desktop** (Windows/macOS) veya **Docker Engine** (Linux) | 4.x+ |
| **Git** | Depoyu almak için |
| **Disk alanı** | ~30 GB (AI modelleri, veritabanı, Orthanc) |
| **RAM** | 16 GB minimum, 32 GB önerilir |
| **NVIDIA GPU** | İsteğe bağlı; transkripsiyon ve dil modeli için önerilir |

GPU yoksa servisler CPU ile çalışabilir; performans belirgin şekilde düşer. `docker-compose.yml` içinde NVIDIA ayarları varsa ve sürücü yoksa ilgili `deploy.resources` bölümünü kaldırmanız gerekebilir (Bölüm 9).

## 2. Depoyu alma

```powershell
git clone <depo-url> medarix
cd medarix
```

Alternatif: klasörü arşiv veya ağ üzerinden kopyalayın. **`.env` dosyasını repoya eklemeyin**; her kurulumda Bölüm 3’te oluşturulur.

## 3. Ortam yapılandırması

Ortam dosyası **depo kök dizininde** olmalıdır:

```powershell
cd medarix
copy .env.example .env
```

`.env` içinde en az şu değerleri güçlü ve benzersiz değerlerle değiştirin:

```env
POSTGRES_PASSWORD=<güçlü-parola>
ORTHANC_PASSWORD=<güçlü-parola>
MEDARIX_SESSION_JWT_SECRET=<en-az-32-karakter>
MEDARIX_AUDIT_HMAC_SECRET=<en-az-32-karakter>
MEDARIX_LICENSE_SIGNING_SECRET=<en-az-32-karakter>
```

PowerShell ile rastgele secret:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

`medarix/.env` yalnızca backend’i Docker dışında geliştirme modunda çalıştırırken kullanılabilir. Tam stack için kök `.env` yeterlidir.

## 4. Docker volume (Ollama)

Dil modelleri proje klasöründe değil, Docker volume içinde saklanır (`/root/.ollama`).

Varsayılan volume adı: **`medarix-ollama-data`** (`docker-compose.yml` içinde tanımlı).

Mevcut bir Ollama volume’ünü kullanmak için `docker-compose.yml` içinde:

```yaml
  ollama:
    name: <mevcut-volume-adı>
    external: true
```

## 5. Dil modellerini yükleme

Önce Ollama servisini başlatın:

```powershell
docker compose up -d ollama
```

Modelleri indirin:

```powershell
docker exec ollama ollama pull llama3.1:latest
docker exec ollama ollama pull qwen2.5:14b
docker exec ollama ollama list
```

### Medarix AI modeli (Modelfile)

Özel Medarix model adı: **`medarix-ai`** (`ollama create` komutundaki isim listede görünür).

```powershell
cd ollama
Get-Content Modelfile.medarix | docker exec -i ollama ollama create medarix-ai -f -
```

Alternatif (dosyayı konteynere kopyalayarak):

```powershell
docker cp ollama/Modelfile.medarix ollama:/tmp/Modelfile.medarix
docker exec ollama ollama create medarix-ai -f /tmp/Modelfile.medarix
```

`Modelfile.medarix` içindeki `FROM` satırını (`qwen2.5:14b` vb.) kendi taban modelinize göre düzenleyin.

Eski adlı bir model varsa:

```powershell
docker exec ollama ollama cp <eski-model-adı>:latest medarix-ai:latest
```

### Modelleri yedekleme veya taşıma (isteğe bağlı)

Volume adını öğrenmek için:

```powershell
docker volume ls
```

Yedek:

```powershell
docker run --rm -v medarix-ollama-data:/data -v ${PWD}:/backup alpine tar czf /backup/ollama-models.tar.gz -C /data .
```

Geri yükleme:

```powershell
docker volume create medarix-ollama-data
docker run --rm -v medarix-ollama-data:/data -v ${PWD}:/backup alpine sh -c "cd /data && tar xzf /backup/ollama-models.tar.gz"
```

## 6. Tüm stack’i başlatma

```powershell
cd medarix
docker compose up -d --build
```

İlk derleme birkaç dakika sürebilir (SPA + backend imajı).

### Sağlık kontrolü

```powershell
docker compose ps
curl http://localhost:8088/healthz
```

Beklenen yanıt: `{"status":"ok","service":"Medarix"}`

### Erişim adresleri

| Servis | Adres |
|--------|--------|
| **Medarix** | http://localhost:8088 |
| Orthanc | http://127.0.0.1:8042 |
| Ollama API | http://localhost:11434 |
| Whisper API | http://localhost:10300 |

## 7. İlk giriş

Geliştirme ortamı varsayılanları (`MEDARIX_ENVIRONMENT=development`):

| Alan | Değer |
|------|--------|
| Kullanıcı | `admin` (veya `.env` → `MEDARIX_DEFAULT_ADMIN_USERNAME`) |
| Parola | `.env` → `MEDARIX_DEFAULT_ADMIN_PASSWORD` |

Örnek şablonda parola `admin-change-me` olabilir. İlk girişten sonra parolayı değiştirin.

Giriş bilgilerini not için (Git’e eklemeyin): `.credentials.local.txt` (depo kökünde, `.gitignore` içinde)

## 8. Yönetim paneli

### Dil modeli listesi nereden gelir?

**Listele** düğmesi Medarix veritabanından değil, **Ollama sunucusundan** canlı çeker:

1. Arayüz → `GET /api/v1/admin/ai/models/text?base_url=...`
2. Backend → `GET {dil modeli sunucusu}/models` (OpenAI uyumlu) veya `/api/tags` (Ollama yerel)
3. Dönen `id` değerleri = `docker exec ollama ollama list` çıktısındaki isimler

Görünen isimler (`medarix-ai:latest`, `llama3.1:latest` vb.) **`ollama pull` / `ollama create`** ile Ollama volume’üne kaydedildiğinde oluşur. Modelfile metni (`ollama/Modelfile.medarix`) yalnızca `ollama create` sırasında modele gömülen sistem talimatıdır.

1. **Yönetim → Sistem Ayarları → Yapay Zeka Servisleri**
   - **Dil modeli sunucusu:** `http://ollama:11434/v1`
   - **Dil modeli** satırında **Listele** → `medarix-ai` seçin
   - **Transkripsiyon sunucusu:** `http://whisper:8000/v1`
   - **Transkripsiyon modeli** satırında **Listele**

2. **Kimlik Doğrulama** — LDAP için alanları doldurup **Bağlantıyı Doğrula**

3. **Lisans** — Enterprise özellikleri için **Yönetim → Lisans**

## 9. GPU yapılandırması

NVIDIA Container Toolkit kurulu değilse `docker-compose.yml` içinde `ollama` ve `whisper` servislerindeki `deploy.resources` bölümünü kaldırın veya yorum satırı yapın.

Whisper imajı (`fedirz/faster-whisper-server:latest-cuda`) GPU içindir; CPU ortamında alternatif imaj araştırmanız gerekebilir.

## 10. Veritabanı parola hatası

`POSTGRES_PASSWORD` değiştirildikten sonra Postgres volume eski parolayı tutuyorsa backend bağlanamaz. **Tüm Medarix veritabanı verisi silinir:**

```powershell
docker compose down
docker volume rm medarix-postgres
docker compose up -d
```

## 11. Üretim ortamı

Paylaşımlı veya hastane ağında:

- `MEDARIX_ENVIRONMENT=production`
- `MEDARIX_ALLOW_BOOTSTRAP_ADMIN=false`
- `MEDARIX_ALLOW_LICENSE_ISSUE=false`
- `MEDARIX_ALLOW_LEGACY_UI=false`
- `MEDARIX_COOKIE_SECURE=true` (HTTPS)
- `MEDARIX_PATIENT_DATA_KEY` ve güçlü secret’lar

Ayrıntı: [SECURITY-CHECKLIST.md](SECURITY-CHECKLIST.md)

## 12. Güncelleme

```powershell
cd medarix
git pull
docker compose up -d --build
```

Yalnızca uygulama katmanı:

```powershell
docker compose up -d --build medarix-backend
```

SQL migration dosyaları backend açılışında otomatik uygulanır (initdb yalnızca ilk Postgres kurulumunda çalışır).

## 13. GitHub’a yüklemeden önce

- `.env`, `.credentials.local.txt` ve gerçek parolalar **commit edilmemeli** (`.gitignore` bunları dışlar).
- `frontend/node_modules/` ve `frontend/dist/` repoda olmamalı.
- İlk push: `git init`, `git add .`, `git commit`, `git remote add origin …`, `git push -u origin main`

## 14. Sık karşılaşılan sorunlar

| Belirti | Çözüm |
|--------|--------|
| `external volume ... not found` | Bölüm 4: volume adını düzeltin veya `external: true` kaldırın |
| Dil modeli listesi boş | `docker exec ollama ollama pull <model>` |
| Postgres authentication failed | Bölüm 10 |
| Port 8088 kullanımda | Çakışan süreci durdurun veya compose portunu değiştirin |
| GPU / CUDA hatası | Bölüm 9 |

---

## Hızlı kurulum özeti

```powershell
git clone <depo-url> medarix
cd medarix
copy .env.example .env
# .env: parola ve secret'ları düzenle
docker compose up -d --build
docker exec ollama ollama pull llama3.1:latest
```

Tarayıcı: **http://localhost:8088**
