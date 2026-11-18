/**
 * ============================================================
 *  BATLANTAS – Backend Penjualan Kaos (Google Apps Script)
 *  PO T-Shirt Batlantas #3 Anniversary
 * ============================================================
 *  Cara update:
 *  1. Tempel seluruh isi file ini ke Code.gs di Apps Script
 *  2. Pastikan ADMIN_PIN sesuai keinginan Anda
 *  3. Klik Save, lalu jalankan fungsi `setup` sekali
 *  4. Deploy > Manage deployments > Edit (ikon pensil) >
 *     Version: New version > Deploy
 * ============================================================
 */

// PIN untuk aksi admin: edit, ubah status bayar, ubah harga/anggota, hapus, reset.
const ADMIN_PIN = "1234"; // <-- GANTI PIN INI!

const CATEGORIES = ["Cowok", "Cewek", "Anak2"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const DEFAULT_PRICES = { Cowok: 130000, Cewek: 130000, Anak2: 110000 };
const DEFAULT_COSTS = { Cowok: 80000, Cewek: 80000, Anak2: 80000 };
const DEFAULT_MEMBERS = [
  "Pande kembar",
  "Dewa bola",
  "Dewa aditya",
  "Dewa enjang",
  "Dewa ayu",
  "Dewa sukariawan",
  "Wayan balon",
  "Pande aris",
  "Angga AU",
  "Mang hendra",
  "Angga mahendra",
  "Agus juliarta",
  "Agus doplah",
  "Pak mangku",
  "komang pande",
  "Jodi",
  "Mang okik",
  "Leyong",
  "Dewa suata",
  "Wahyu wardana"
];
const MEMBER_COUNT = DEFAULT_MEMBERS.length;

const SH_SALES = "Penjualan";
const SH_MEMBERS = "Anggota";
const SH_PRICES = "Harga";
const SALES_HEADER = [
  "ID", "Tanggal", "No Anggota", "Nama Anggota", "Pembeli",
  "Kategori", "Ukuran", "Jumlah", "Harga Satuan", "Total Harga",
  "Status Bayar", "Waktu Input"
];

// ---------- Setup & migrasi sheet (aman dijalankan berulang kali) ----------
function setup() {
  const ss = SpreadsheetApp.getActive();

  let members = ss.getSheetByName(SH_MEMBERS) || ss.insertSheet(SH_MEMBERS);
  const needMemberInit = members.getLastRow() < MEMBER_COUNT + 1 ||
    (members.getLastRow() >= 2 && String(members.getRange(2, 2).getValue()).trim() === "Anggota 1");
  if (needMemberInit) {
    members.clear();
    const rows = [["No", "Nama Anggota"]].concat(DEFAULT_MEMBERS.map((n, i) => [i + 1, n]));
    members.getRange(1, 1, rows.length, 2).setValues(rows);
    members.setFrozenRows(1);
    members.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#ff7a1a");
  }

  let prices = ss.getSheetByName(SH_PRICES) || ss.insertSheet(SH_PRICES);
  const firstPriceKey = prices.getLastRow() >= 2 ? String(prices.getRange(2, 1).getValue()).trim() : "";
  if (prices.getLastRow() === 0 || CATEGORIES.indexOf(firstPriceKey) < 0) {
    prices.clear();
    const rows = [["Kategori", "Harga", "Biaya Sablon"]].concat(CATEGORIES.map((c) => [c, DEFAULT_PRICES[c], DEFAULT_COSTS[c]]));
    prices.getRange(1, 1, rows.length, 3).setValues(rows);
    prices.setFrozenRows(1);
    prices.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#ff7a1a");
    prices.getRange("B:C").setNumberFormat("#,##0");
  } else if (String(prices.getRange(1, 3).getValue()).trim() !== "Biaya Sablon") {
    prices.getRange(1, 3).setValue("Biaya Sablon").setFontWeight("bold").setBackground("#ff7a1a");
    const rows = CATEGORIES.map((c) => [DEFAULT_COSTS[c]]);
    prices.getRange(2, 3, rows.length, 1).setValues(rows);
    prices.getRange("C:C").setNumberFormat("#,##0");
  }

  let sales = ss.getSheetByName(SH_SALES) || ss.insertSheet(SH_SALES);
  if (sales.getLastRow() === 0) {
    sales.appendRow(SALES_HEADER);
    sales.setFrozenRows(1);
    sales.getRange(1, 1, 1, SALES_HEADER.length).setFontWeight("bold").setBackground("#ff7a1a");
    sales.getRange("A:B").setNumberFormat("@");
    sales.getRange("I:J").setNumberFormat("#,##0");
  } else {
    // Migrasi otomatis jika sheet Penjualan masih memakai header lama
    if (String(sales.getRange(1, 6).getValue()).trim() !== "Kategori") {
      sales.insertColumnBefore(6);
      sales.getRange(1, 6).setValue("Kategori").setFontWeight("bold").setBackground("#ff7a1a");
      if (sales.getLastRow() > 1) {
        sales.getRange(2, 6, sales.getLastRow() - 1, 1).setValue("Cowok");
      }
    }
    if (String(sales.getRange(1, 11).getValue()).trim() !== "Status Bayar") {
      sales.insertColumnBefore(11);
      sales.getRange(1, 11).setValue("Status Bayar").setFontWeight("bold").setBackground("#ff7a1a");
      if (sales.getLastRow() > 1) {
        sales.getRange(2, 11, sales.getLastRow() - 1, 1).setValue("Belum");
      }
    }
    // Perbaiki baris lama jika harga satuan masih 0
    if (sales.getLastRow() > 1) {
      const rng = sales.getRange(2, 6, sales.getLastRow() - 1, 5); // F..J
      const vals = rng.getValues();
      let changed = false;
      vals.forEach((r) => {
        const cat = CATEGORIES.indexOf(String(r[0])) >= 0 ? String(r[0]) : "Cowok";
        const qty = Number(r[2]) || 0;
        const unitPrice = Number(r[3]) || 0;
        if (qty > 0 && unitPrice === 0) {
          const p = DEFAULT_PRICES[cat];
          r[0] = cat;
          r[3] = p;
          r[4] = p * qty;
          changed = true;
        }
      });
      if (changed) rng.setValues(vals);
    }
    sales.getRange("I:J").setNumberFormat("#,##0");
  }

  const def = ss.getSheetByName("Sheet1");
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
}

// ---------- HTTP handlers ----------
function doGet(e) {
  try {
    setup();
    return json({ ok: true, data: getAll() });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: "Request tidak valid" });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    setup();
    switch (body.action) {
      case "addSale":     addSale(body.sale); break;
      case "editSale":    requirePin(body.pin); editSale(body.id, body.sale); break;
      case "togglePaid":  requirePin(body.pin); togglePaid(body.id); break;
      case "deleteSale":  requirePin(body.pin); deleteSale(body.id); break;
      case "savePrices":  requirePin(body.pin); savePrices(body.prices); break;
      case "saveCosts":   requirePin(body.pin); saveCosts(body.costs); break;
      case "saveMembers": requirePin(body.pin); saveMembers(body.members); break;
      case "resetSales":  requirePin(body.pin); resetSales(); break;
      case "checkPin":    requirePin(body.pin); break;
      default: throw new Error("Aksi tidak dikenal");
    }
    return json({ ok: true, data: getAll() });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- Data ----------
function getAll() {
  const ss = SpreadsheetApp.getActive();
  const tz = Session.getScriptTimeZone();

  const members = ss.getSheetByName(SH_MEMBERS).getRange(2, 2, MEMBER_COUNT, 1).getValues()
    .map((r, i) => String(r[0] || "").trim() || DEFAULT_MEMBERS[i] || ("Anggota " + (i + 1)));

  const prices = Object.assign({}, DEFAULT_PRICES);
  const costs = Object.assign({}, DEFAULT_COSTS);
  const pSheet = ss.getSheetByName(SH_PRICES);
  if (pSheet.getLastRow() > 1) {
    const cols = Math.min(3, pSheet.getLastColumn());
    pSheet.getRange(2, 1, pSheet.getLastRow() - 1, cols).getValues().forEach((r) => {
      const c = String(r[0]).trim();
      if (CATEGORIES.indexOf(c) >= 0) {
        prices[c] = Number(r[1]) || 0;
        if (cols >= 3 && r[2] !== "" && r[2] !== null) costs[c] = Number(r[2]) || 0;
      }
    });
  }

  const sSheet = ss.getSheetByName(SH_SALES);
  const sales = [];
  if (sSheet.getLastRow() > 1) {
    sSheet.getRange(2, 1, sSheet.getLastRow() - 1, SALES_HEADER.length).getValues().forEach((r) => {
      if (!r[0]) return;
      const date = r[1] instanceof Date ? Utilities.formatDate(r[1], tz, "yyyy-MM-dd") : String(r[1]);
      sales.push({
        id: String(r[0]),
        date: date,
        member: Number(r[2]) - 1,
        buyer: String(r[4] || ""),
        category: String(r[5] || "Cowok"),
        size: String(r[6]),
        qty: Number(r[7]) || 0,
        price: Number(r[8]) || 0,
        total: Number(r[9]) || 0,
        paid: String(r[10] || "").trim().toLowerCase() === "sudah",
      });
    });
  }

  return { members: members, prices: prices, costs: costs, sales: sales };
}

function validateSale(sale) {
  if (!sale) throw new Error("Data penjualan kosong");
  const member = parseInt(sale.member, 10);
  const qty = parseInt(sale.qty, 10);
  const category = String(sale.category || "");
  const size = String(sale.size || "");
  if (!(member >= 0 && member < MEMBER_COUNT)) throw new Error("Anggota tidak valid");
  if (CATEGORIES.indexOf(category) < 0) throw new Error("Kategori tidak valid");
  if (SIZES.indexOf(size) < 0) throw new Error("Ukuran tidak valid");
  if (!(qty >= 1 && qty <= 1000)) throw new Error("Jumlah tidak valid");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sale.date) ? sale.date
    : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const buyer = String(sale.buyer || "").slice(0, 100);
  const paid = sale.paid ? "Sudah" : "Belum";
  return { member, qty, category, size, date, buyer, paid };
}

function addSale(raw) {
  const s = validateSale(raw);
  const data = getAll();
  const price = data.prices[s.category];
  const id = Utilities.getUuid().slice(0, 8);

  SpreadsheetApp.getActive().getSheetByName(SH_SALES).appendRow([
    id, s.date, s.member + 1, data.members[s.member], s.buyer,
    s.category, s.size, s.qty, price, price * s.qty, s.paid, new Date(),
  ]);
}

function findSaleRow(id) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH_SALES);
  if (sh.getLastRow() < 2) throw new Error("Transaksi tidak ditemukan");
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return { sh, row: i + 2 };
  }
  throw new Error("Transaksi tidak ditemukan");
}

function editSale(id, raw) {
  const { sh, row } = findSaleRow(id);
  const s = validateSale(raw);
  const data = getAll();
  const price = data.prices[s.category];

  sh.getRange(row, 2, 1, 10).setValues([[
    s.date, s.member + 1, data.members[s.member], s.buyer,
    s.category, s.size, s.qty, price, price * s.qty, s.paid,
  ]]);
}

function togglePaid(id) {
  const { sh, row } = findSaleRow(id);
  const cur = String(sh.getRange(row, 11).getValue()).trim().toLowerCase() === "sudah";
  sh.getRange(row, 11).setValue(cur ? "Belum" : "Sudah");
}

function deleteSale(id) {
  const { sh, row } = findSaleRow(id);
  sh.deleteRow(row);
}

function savePrices(prices) {
  if (!prices) throw new Error("Data harga kosong");
  const rows = CATEGORIES.map((c) => [c, Math.max(0, parseInt(prices[c], 10) || 0)]);
  SpreadsheetApp.getActive().getSheetByName(SH_PRICES).getRange(2, 1, rows.length, 2).setValues(rows);
}

function saveCosts(costs) {
  if (!costs) throw new Error("Data biaya sablon kosong");
  const rows = CATEGORIES.map((c) => [Math.max(0, parseInt(costs[c], 10) || 0)]);
  SpreadsheetApp.getActive().getSheetByName(SH_PRICES).getRange(2, 3, rows.length, 1).setValues(rows);
}

function saveMembers(members) {
  if (!Array.isArray(members)) throw new Error("Data anggota kosong");
  const names = [];
  for (let i = 0; i < MEMBER_COUNT; i++) {
    names.push(String(members[i] || "").trim().slice(0, 60) || DEFAULT_MEMBERS[i] || ("Anggota " + (i + 1)));
  }
  const ss = SpreadsheetApp.getActive();
  ss.getSheetByName(SH_MEMBERS).getRange(2, 1, MEMBER_COUNT, 2)
    .setValues(names.map((n, i) => [i + 1, n]));

  const sh = ss.getSheetByName(SH_SALES);
  if (sh.getLastRow() > 1) {
    const rng = sh.getRange(2, 3, sh.getLastRow() - 1, 2);
    const vals = rng.getValues().map((r) => [r[0], names[Number(r[0]) - 1] || r[1]]);
    rng.setValues(vals);
  }
}

function resetSales() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH_SALES);
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
}

// ---------- Util ----------
function requirePin(pin) {
  if (String(pin || "") !== String(ADMIN_PIN)) throw new Error("PIN admin salah");
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
