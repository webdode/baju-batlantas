# 🏍️ Batlantas – Sistem Penjualan Kaos

Website pencatatan penjualan kaos untuk 19 anggota club motor Batlantas.

- **Hosting:** GitHub Pages (gratis)
- **Database:** Google Spreadsheet (lewat Google Apps Script)

```
batlantas-kaos/
├── index.html          ← halaman website
├── style.css           ← tampilan
├── app.js              ← logika website
├── config.js           ← ISI URL Apps Script di sini
└── apps-script/
    └── Code.gs         ← kode backend (ditempel ke Google Apps Script)
```

---

## Langkah 1 – Siapkan Google Spreadsheet

1. Buka <https://sheets.google.com> → buat spreadsheet baru, beri nama **Penjualan Kaos Batlantas**.
2. Menu **Extensions → Apps Script**.
3. Hapus isi `Code.gs` bawaan, lalu **tempel seluruh isi** file `apps-script/Code.gs`.
4. Di baris atas, **ganti PIN admin**:
   ```js
   const ADMIN_PIN = "1234"; // ganti dengan PIN rahasia Anda
   ```
5. Klik 💾 **Save**.
6. Pilih fungsi **`setup`** di dropdown atas → klik **Run**.
   - Akan muncul permintaan izin → **Review permissions** → pilih akun Google →
     **Advanced → Go to (nama project) (unsafe)** → **Allow**.
   - Setelah selesai, spreadsheet akan punya 3 sheet: **Penjualan**, **Anggota**, **Harga**.

## Langkah 2 – Deploy sebagai Web App

1. Di Apps Script klik **Deploy → New deployment**.
2. Klik ⚙️ di samping "Select type" → pilih **Web app**.
3. Isi:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Klik **Deploy** → salin **Web app URL** (berakhiran `/exec`).

## Langkah 3 – Hubungkan website

Buka `config.js`, tempel URL tadi:

```js
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
```

Tes dengan membuka `index.html` di browser → status di kanan atas harus **● Tersinkron**.

## Langkah 4 – Hosting di GitHub Pages

1. Buat repository baru di <https://github.com/new>, misalnya `batlantas-kaos` (Public).
2. Upload semua file (`index.html`, `style.css`, `app.js`, `config.js`, folder `apps-script`)
   lewat **Add file → Upload files**, atau via git:
   ```bash
   git init
   git add .
   git commit -m "Website penjualan kaos Batlantas"
   git branch -M main
   git remote add origin https://github.com/USERNAME/batlantas-kaos.git
   git push -u origin main
   ```
3. Di repo: **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `(root)` → **Save**.
4. Tunggu 1–2 menit. Website aktif di:
   `https://USERNAME.github.io/batlantas-kaos/`

Bagikan link tersebut ke 19 anggota. 🎉

---

## Cara Pakai

| Siapa | Bisa apa |
|---|---|
| Semua anggota | Input penjualan, lihat rekap & data |
| Admin (pakai PIN) | Ubah harga, ubah nama anggota, hapus transaksi, reset data |

- Nama anggota & harga juga bisa diubah langsung di Google Sheets (sheet **Anggota** / **Harga**).
- Data di website otomatis diperbarui tiap 60 detik, atau klik **🔄 Muat Ulang**.

## Jika mengubah Code.gs

Setelah edit kode Apps Script, wajib deploy ulang agar perubahan aktif:
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
URL tetap sama, tidak perlu ubah `config.js`.

## Catatan Keamanan

- URL Apps Script terlihat publik di `config.js`. Siapa pun yang tahu URL bisa **menambah** penjualan,
  tetapi **tidak bisa** mengubah harga/anggota atau menghapus data tanpa PIN.
- Harga selalu dihitung ulang di server dari sheet **Harga**, jadi tidak bisa dimanipulasi dari browser.
- Jangan upload PIN ke GitHub — PIN hanya ada di Apps Script (bukan di file website).
- Spreadsheet tetap privat milik Anda; anggota tidak perlu akses ke spreadsheet.

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Status "Belum terhubung" | `SCRIPT_URL` di `config.js` belum diisi |
| "Gagal memuat: Failed to fetch" | Pastikan deploy dengan akses **Anyone** dan URL berakhiran `/exec` |
| Perubahan Code.gs tidak berpengaruh | Deploy ulang dengan **New version** |
| "PIN admin salah" | Cek `ADMIN_PIN` di Code.gs (lalu deploy ulang jika diubah) |
