# Medarix

**Yapay zeka destekli radyoloji raporlama ve klinik zeka platformu**

Medarix; radyoloji diktesi, ses transkripsiyonu, yapılandırılmış rapor yazımı, çalışma listesi, hasta ve görüntüleme çalışması yönetimi ile kurumsal denetim (audit) özelliklerini tek bir web platformunda birleştirir. Hastane veya klinik ağında pilot veya üretim ortamına Docker ile kurulabilir.

**Depo:** [github.com/curiousdionysus/medarix](https://github.com/curiousdionysus/medarix)

---

## İçindekiler

- [Özellikler](#özellikler)
- [Mimari](#mimari)
- [Teknoloji yığını](#teknoloji-yığını)
- [Depo yapısı](#depo-yapısı)
- [Gereksinimler](#gereksinimler)
- [Hızlı kurulum](#hızlı-kurulum)
- [Docker servisleri ve portlar](#docker-servisleri-ve-portlar)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [Yapay zeka servisleri](#yapay-zeka-servisleri)
- [Geliştirme modu](#geliştirme-modu)
- [Veritabanı ve migration](#veritabanı-ve-migration)
- [İlk giriş ve yönetim](#ilk-giriş-ve-yönetim)
- [Üretim ortamı](#üretim-ortamı)
- [Sık sorunlar](#sık-sorunlar)
- [Lisans](#lisans)

---

## Özellikler

### Çalışma alanı (Workspace)

- **Dikte:** Tarayıcıda ses kaydı, dalga formu, transkripsiyon ve AI ile metin düzenleme
- **Rapor editörü:** Bölümlü rapor şablonları, otomatik kaydetme, sürüm geçmişi, AI önerileri
- **Çalışma listesi:** Önceliklendirilmiş inceleme kuyruğu

### Çalışmalar ve hastalar

- Görüntüleme çalışmaları tablosu ve filtreleme
- Hasta kayıtları ve çalışma zaman çizelgesi
- Orthanc üzerinden DICOMweb entegrasyonu (PACS geçidi)

### Yapay zeka merkezi

- AI asistan sohbeti
- Akıllı öneriler ve şablon yönetimi
- **Dil modeli:** Ollama (OpenAI uyumlu API)
- **Transkripsiyon:** Whisper / faster-whisper sunucusu
- Özel radyoloji modeli: **`medarix-ai`** (`ollama/Modelfile.medarix`)

### Kurumsal (Enterprise lisans)

- Verimlilik, dönüş süresi ve AI kullanım analitiği (Recharts)
- Departman KPI’ları

### Yönetim ve güvenlik

- Kullanıcı ve grup yönetimi
- **Esnek RBAC:** Özel roller, hazır şablonlar (Görüntüleyici, Raportör, Radyolog, Admin)
- LDAP / Active Directory bağlantı testi
- Sistem ayarları (AI uç noktaları, kimlik doğrulama, lisans)
- Değiştirilemez denetim günlüğü (HMAC imzalı)
- Oturum: kısa ömürlü Bearer token + httpOnly yenileme çerezi

### Ayarlar

- Profil, tema (açık/koyu), yüksek kontrast
- Hesap ve lisans bilgisi

---

## Mimari

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Tarayıcı   │────▶│ medarix-backend  │────▶│  PostgreSQL │
│  (React SPA)│     │    (FastAPI)     │     │   (metadata)│
└─────────────┘     └────────┬─────────┘     └─────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌──────────┐       ┌──────────┐       ┌──────────┐
   │  Redis   │       │ medarix-ai│      │medarix-  │
   │ (oturum) │       │ (Ollama) │       │ whisper  │
   └──────────┘       └──────────┘       └──────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │medarix-orthanc│
                      │  (DICOMweb)  │
                      └──────────────┘
```

- **Üretim:** `backend/Dockerfile` içinde SPA derlenir; FastAPI `app/spa` altından `/` adresinde sunar. API: `/api/v1`, sağlık: `/healthz`.
- **Geliştirme:** Vite dev sunucusu (`:5173`) istekleri `:8088` backend’e proxy eder.
- **Ağ:** Tüm konteynerler `medarix-network` üzerinde; servis DNS adları `postgres`, `ollama`, `whisper` vb. (konteyner adları farklı olabilir).

---

## Teknoloji yığını

| Katman | Teknoloji |
|--------|-----------|
| Ön yüz | React 19, TypeScript, Vite, Tailwind CSS, React Query, React Router |
| API | FastAPI, Pydantic, SQLAlchemy |
| Veritabanı | PostgreSQL 16 |
| Önbellek / oturum | Redis 7 |
| PACS | Orthanc (DICOMweb) |
| Dil modeli | Ollama |
| Transkripsiyon | faster-whisper-server (CUDA imajı) |

---

## Depo yapısı

| Yol | Açıklama |
|-----|----------|
| `frontend/` | React SPA kaynak kodu |
| `backend/` | FastAPI uygulaması, servisler, testler |
| `backend/migrations/` | PostgreSQL SQL migration dosyaları (`001`–`005`) |
| `ollama/Modelfile.medarix` | `medarix-ai` özel model tanımı |
| `docker-compose.yml` | Tam yığın (uygulama + AI + veritabanı + Orthanc) |
| `.env.example` | Ortam şablonu (`.env` asla commit edilmez) |
| `docs/KURULUM.md` | Adım adım kurulum kılavuzu |
| `docs/SECURITY-CHECKLIST.md` | Üretim güvenlik kontrol listesi |

---

## Gereksinimler

| Bileşen | Öneri |
|---------|--------|
| Docker Desktop / Docker Engine | 4.x+ |
| Git | Depoyu klonlamak için |
| Disk | ~30 GB (AI modelleri, DB, Orthanc) |
| RAM | En az 16 GB, önerilen 32 GB |
| NVIDIA GPU | İsteğe bağlı; Ollama ve Whisper için önerilir |

GPU yoksa CPU ile çalışır; transkripsiyon ve dil modeli yanıt süreleri uzar. NVIDIA Toolkit yoksa `docker-compose.yml` içindeki `deploy.resources` (GPU) bölümlerini kaldırın veya yorumlayın.

---

## Hızlı kurulum

### 1. Depoyu alın

```bash
git clone https://github.com/curiousdionysus/medarix.git
cd medarix
```

Windows (PowerShell):

```powershell
git clone https://github.com/curiousdionysus/medarix.git
cd medarix
```

### 2. Ortam dosyası

```bash
cp .env.example .env
```

Windows: `copy .env.example .env`

`.env` içinde **mutlaka** güçlü ve benzersiz değerler verin:

- `POSTGRES_PASSWORD` ve `MEDARIX_DATABASE_PASSWORD` (aynı olmalı)
- `ORTHANC_PASSWORD` / `MEDARIX_ORTHANC_PASSWORD`
- `MEDARIX_SESSION_JWT_SECRET`, `MEDARIX_AUDIT_HMAC_SECRET`, `MEDARIX_LICENSE_SIGNING_SECRET` (en az 32 karakter)

Rastgele secret (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

### 3. Stack’i başlatın

```bash
docker compose up -d --build
```

### 4. Dil modeli (isteğe bağlı, ilk kurulum)

```bash
docker exec medarix-ai ollama pull llama3.1:latest
docker exec medarix-ai ollama pull qwen2.5:14b
```

Özel Medarix modeli:

```bash
docker cp ollama/Modelfile.medarix medarix-ai:/tmp/Modelfile.medarix
docker exec medarix-ai ollama create medarix-ai -f /tmp/Modelfile.medarix
```

### 5. Uygulamayı açın

Tarayıcı: **http://localhost:8088**

Sağlık kontrolü:

```bash
curl http://localhost:8088/healthz
```

Beklenen: `{"status":"ok","service":"Medarix"}`

Ayrıntılı kurulum, GPU, volume yedekleme: **[docs/KURULUM.md](docs/KURULUM.md)**

---

## Docker servisleri ve portlar

| Konteyner adı | Rol | Host portu |
|---------------|-----|------------|
| `medarix-backend` | Web + API | `8088` |
| `medarix-postgres` | PostgreSQL | `127.0.0.1:15432` |
| `medarix-redis` | Redis | `127.0.0.1:16379` |
| `medarix-orthanc` | DICOM / DICOMweb | `127.0.0.1:8042`, `4242` |
| `medarix-ai` | Ollama | `11434` |
| `medarix-whisper` | Transkripsiyon | `10300` |

Compose **servis adları** (`ollama`, `whisper`, `postgres`) ağ içi DNS için kullanılır; backend varsayılan URL’ler buna göredir (`http://ollama:11434/v1`).

Kalıcı veriler Docker volume’lerinde:

- `medarix-postgres` — uygulama veritabanı
- `medarix-orthanc` — DICOM arşivi
- `medarix-ollama-data` — indirilen LLM modelleri

---

## Ortam değişkenleri

Kök dizindeki `.env` hem Compose hem backend tarafından okunur.

| Değişken | Açıklama |
|----------|----------|
| `POSTGRES_*` | PostgreSQL bağlantısı (compose + backend) |
| `ORTHANC_PASSWORD` | Orthanc kullanıcı parolası |
| `MEDARIX_ENVIRONMENT` | `development` veya `production` |
| `MEDARIX_SESSION_JWT_SECRET` | Oturum JWT imzası |
| `MEDARIX_AUDIT_HMAC_SECRET` | Denetim günlüğü HMAC |
| `MEDARIX_PATIENT_DATA_KEY` | Üretimde hasta verisi şifreleme (zorunlu) |
| `MEDARIX_OLLAMA_BASE_URL` | Docker içi: `http://ollama:11434/v1` |
| `MEDARIX_OLLAMA_MODEL` | Örn. `medarix-ai` veya `llama3.1:latest` |
| `MEDARIX_WHISPER_BASE_URL` | Docker içi: `http://whisper:8000/v1` |
| `MEDARIX_ALLOW_BOOTSTRAP_ADMIN` | İlk admin oluşturma (üretimde `false`) |

Tam liste: `.env.example` ve `backend/app/core/config.py`.

**Git’e asla eklemeyin:** `.env`, `.credentials.local.txt`, gerçek parolalar ve anahtarlar.

---

## Yapay zeka servisleri

| Servis | Docker ağı içi adres | Arayüzde (Yönetim → AI) |
|--------|----------------------|-------------------------|
| Ollama | `http://ollama:11434/v1` | Dil modeli sunucusu |
| Whisper | `http://whisper:8000/v1` | Transkripsiyon sunucusu |

**Listele** düğmesi modelleri Ollama/Whisper API’sinden canlı çeker; liste veritabanından gelmez.

Önerilen radyoloji düzeltme modeli: **`medarix-ai`** — `ollama/Modelfile.medarix` dosyasından `ollama create` ile üretilir; taban model satırı (`FROM qwen2.5:14b` vb.) ihtiyaca göre değiştirilir.

---

## Geliştirme modu

### Ön yüz (hot reload)

```bash
cd frontend
npm install
npm run dev
```

Adres: http://localhost:5173 — `/api` ve `/healthz` istekleri `:8088`’e yönlendirilir.

### Yalnızca backend

Postgres ve Redis çalışır durumda olmalı. `.env` içinde host’ları `127.0.0.1` ve compose portlarına (`15432`, `16379`) ayarlayın; `backend` dizininden:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8088 --reload
```

### SPA derleme

```bash
cd frontend && npm run build
```

Üretim imajı bu adımı Dockerfile içinde otomatik yapar.

---

## Veritabanı ve migration

- **İlk kurulum:** Postgres volume oluşurken `backend/migrations/001`–`005` dosyaları `docker-entrypoint-initdb.d` ile uygulanır.
- **Her backend başlangıcı:** SQLAlchemy `create_all` + `002`–`005` migration’ları (`schema_migrations` ile tek sefer).

Mevcut volume’de parola değiştirdiyseniz ve bağlantı hatası alıyorsanız: `POSTGRES_PASSWORD` ile volume’deki parola uyumlu olmalı; aksi halde volume sıfırlama gerekir (veri silinir) — bkz. [KURULUM.md §10](docs/KURULUM.md).

---

## İlk giriş ve yönetim

Geliştirme ortamında (`MEDARIX_ALLOW_BOOTSTRAP_ADMIN=true`):

| Alan | Varsayılan |
|------|------------|
| Kullanıcı | `admin` (veya `MEDARIX_DEFAULT_ADMIN_USERNAME`) |
| Parola | `.env` → `MEDARIX_DEFAULT_ADMIN_PASSWORD` (şablonda `admin-change-me`) |

**Paylaşımlı veya üretim sunucusunda bu parolaları kullanmayın.** İlk girişten sonra değiştirin veya LDAP’a geçin.

Yönetim panelinden:

1. **Yapay Zeka** — model URL’leri ve **Listele** ile model seçimi  
2. **Kimlik Doğrulama** — LDAP alanları ve bağlantı testi  
3. **Lisans** — Enterprise özellikleri  
4. **Roller** — özel rol ve izin tanımları  

---

## Üretim ortamı

Üretimde en az şunlar gerekir:

- `MEDARIX_ENVIRONMENT=production`
- Güçlü secret’lar ve `MEDARIX_PATIENT_DATA_KEY`
- `MEDARIX_ALLOW_BOOTSTRAP_ADMIN=false`
- `MEDARIX_ALLOW_LICENSE_ISSUE=false`
- `MEDARIX_ALLOW_LEGACY_UI=false`
- `MEDARIX_COOKIE_SECURE=true` ve HTTPS (ingress)
- Redis zorunlu; denetim loglarının SIEM’e aktarımı

Ayrıntılı liste: **[docs/SECURITY-CHECKLIST.md](docs/SECURITY-CHECKLIST.md)**

---

## Sık sorunlar

| Belirti | Olası çözüm |
|---------|-------------|
| Backend sürekli yeniden başlıyor | Postgres parolası: `POSTGRES_PASSWORD` = `MEDARIX_DATABASE_PASSWORD`; bkz. KURULUM §10 |
| `password authentication failed` | Eski volume + yeni parola uyumsuzluğu |
| Dil modeli listesi boş | `docker exec medarix-ai ollama pull <model>` |
| Push / compose GPU hatası | NVIDIA bölümünü kaldırın veya sürücü + Container Toolkit kurun |
| Port 8088 dolu | Çakışan süreci durdurun veya compose portunu değiştirin |

---

## Katkı ve destek

Hata ve özellik istekleri için GitHub **Issues** kullanılabilir. Kurulum sorularında önce [docs/KURULUM.md](docs/KURULUM.md) dosyasına bakın.

---

## Lisans

Tescilli yazılım. Depo sahibi aksi belirtilmedikçe tüm hakları saklıdır.
