# Job Radar — Dashboard Loker Remote

Dashboard pribadi untuk mencari loker remote (Remotive + WeWorkRemotely),
mencocokkan ke skill kamu, dan generate cover letter otomatis pakai Claude.

## Struktur project

```
job-radar-app/
├── api/
│   ├── jobs.js                  ← ambil & gabungkan loker dari Remotive + WeWorkRemotely
│   └── generate-cover-letter.js ← panggil Claude API pakai API key di server (aman)
├── src/
│   ├── App.jsx                  ← tampilan dashboard
│   └── main.jsx
├── index.html
├── package.json
└── .env.example
```

## 1. Install dependencies

```bash
npm install
```

## 2. Siapkan API key Anthropic

1. Buat API key di https://console.anthropic.com/settings/keys
2. Copy `.env.example` jadi `.env`:
   ```bash
   cp .env.example .env
   ```
3. Isi `ANTHROPIC_API_KEY` di file `.env` dengan key kamu.

**Penting:** jangan pernah commit file `.env` ke git atau taruh API key langsung
di kode frontend — key ini punya akses billing ke akun Anthropic kamu.

## 3. Jalankan secara lokal

Karena project ini pakai **serverless functions** (folder `api/`), cara paling
gampang menjalankannya secara lokal adalah lewat Vercel CLI (gratis untuk
development):

```bash
npm install -g vercel
vercel dev
```

Ini akan menjalankan frontend (Vite) sekaligus `api/jobs.js` dan
`api/generate-cover-letter.js` di satu server lokal, biasanya di
`http://localhost:3000`.

Kalau kamu cuma mau lihat tampilan tanpa fitur backend (fetch loker & generate
cover letter tidak akan jalan), bisa juga pakai `npm run dev` (Vite saja).

## 4. Deploy ke Vercel (gratis untuk pemakaian pribadi)

1. Push project ini ke repo GitHub.
2. Buka https://vercel.com → **Add New Project** → import repo tersebut.
3. Di halaman **Environment Variables**, tambahkan:
   - `ANTHROPIC_API_KEY` = API key kamu
4. Klik **Deploy**. Vercel otomatis mendeteksi folder `api/` sebagai
   serverless functions dan `src/` sebagai frontend Vite.
5. Setelah selesai, kamu dapat URL publik (misal `job-radar-agus.vercel.app`)
   yang bisa dibuka dari HP atau laptop mana saja.

## Cara pakai

1. Buka dashboard → loker otomatis termuat dari Remotive & WeWorkRemotely.
2. Klik loker di daftar kiri → lihat skor kecocokan skill & deskripsi lengkap.
3. Pilih bahasa (EN/ID) lalu klik **Generate cover letter**.
4. Edit teksnya kalau perlu, klik **Copy**, lalu kirim manual ke email/portal
   perusahaan (aplikasi ini sengaja tidak auto-submit ke LinkedIn/job board,
   karena itu melanggar Terms of Service kebanyakan platform).
5. Klik **Mark as applied** untuk menandai loker yang sudah dilamar — status
   ini tersimpan di browser kamu (localStorage), jadi tetap ada walau kamu
   tutup dan buka lagi tab-nya (tapi tidak ikut ter-sync ke device lain).

## Catatan biaya

Generate cover letter memanggil Claude API dengan API key kamu sendiri, jadi
akan kena biaya sesuai pemakaian (per token) dari akun Anthropic kamu —
biasanya sangat murah untuk pemakaian personal seperti ini
(hitungan sen dolar per surat lamaran).
