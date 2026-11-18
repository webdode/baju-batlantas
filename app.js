// ====== Konfigurasi ======
const CATEGORIES = ["Cowok", "Cewek", "Anak2"];
const CATEGORY_LABEL = { Cowok: "Dewasa Cowok", Cewek: "Dewasa Cewek", Anak2: "Anak-anak" };
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const DEFAULT_PRICES = { Cowok: 130000, Cewek: 130000, Anak2: 110000 };
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
const CACHE_KEY = "batlantas_cache_v3";
const PIN_KEY = "batlantas_pin";
const AUTO_REFRESH_MS = 60000;

const configured = typeof SCRIPT_URL === "string" && SCRIPT_URL.startsWith("https://script.google.com/");

// ====== State (tampilkan cache dulu agar cepat, lalu sinkron dari Google Sheets) ======
let state = { members: [...DEFAULT_MEMBERS], prices: { ...DEFAULT_PRICES }, sales: [] };
try {
  const c = JSON.parse(localStorage.getItem(CACHE_KEY));
  if (c && c.members && c.prices && c.sales) state = c;
} catch (e) {}
let busy = false;

// ====== Helper ======
const $ = (id) => document.getElementById(id);
const rp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2600);
}
function setStatus(type, text) {
  const el = $("syncStatus");
  el.className = "status " + type;
  el.textContent = text;
}

// ====== API Google Apps Script ======
async function apiGet() {
  const r = await fetch(`${SCRIPT_URL}?action=getAll&t=${Date.now()}`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}
async function apiPost(payload) {
  // Body string => Content-Type text/plain, sehingga tidak memicu CORS preflight
  const r = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}

function applyData(d) {
  const oldBackend = !Array.isArray(d.members) || d.members.length < DEFAULT_MEMBERS.length || d.prices?.Cowok === undefined;
  const prices = d.prices?.Cowok !== undefined ? d.prices : { ...DEFAULT_PRICES };
  const sales = (Array.isArray(d.sales) ? d.sales : []).map((s) => {
    if (SIZES.includes(s.category) && Number(s.size) > 0 && s.total > 1e11) {
      const qty = Number(s.size) || 1;
      const price = prices.Cowok || 130000;
      return { ...s, size: s.category, category: "Cowok", qty, price, total: price * qty };
    }
    return s;
  });
  state = {
    members: oldBackend && d.members?.[0] === "Anggota 1" ? [...DEFAULT_MEMBERS] : (d.members?.length >= DEFAULT_MEMBERS.length ? d.members : [...DEFAULT_MEMBERS]),
    prices,
    sales,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  fillSelects();
  updateFormTotal();
  render();
  if (!$("tab-setting").classList.contains("active")) renderSettings();
  return oldBackend;
}

async function refresh() {
  if (!configured) {
    setStatus("err", "Belum terhubung: isi SCRIPT_URL di config.js");
    return;
  }
  if (busy) return;
  busy = true;
  setStatus("load", "Memuat data...");
  try {
    const oldBackend = applyData(await apiGet());
    if (oldBackend) {
      setStatus("err", "Apps Script perlu di-update (masih versi 19 anggota)");
    } else {
      setStatus("ok", "Tersinkron " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    }
  } catch (e) {
    setStatus("err", "Gagal memuat: " + e.message);
  } finally {
    busy = false;
  }
}

async function adminAction(payload, okMsg) {
  if (!configured) return toast("Isi SCRIPT_URL di config.js dulu");
  let pin = sessionStorage.getItem(PIN_KEY);
  if (!pin) pin = prompt("Masukkan PIN admin:");
  if (!pin) return false;
  busy = true;
  setStatus("load", "Menyimpan...");
  try {
    const d = await apiPost({ ...payload, pin });
    sessionStorage.setItem(PIN_KEY, pin);
    applyData(d);
    renderSettings();
    setStatus("ok", "Tersinkron " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    toast(okMsg);
    return true;
  } catch (e) {
    if (/PIN/i.test(e.message)) sessionStorage.removeItem(PIN_KEY);
    setStatus("err", "Gagal: " + e.message);
    toast("❌ " + e.message);
    return false;
  } finally {
    busy = false;
  }
}

// ====== Tabs ======
document.querySelectorAll(".tab").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "setting") renderSettings();
  })
);

// ====== Form Input ======
function fillSelects() {
  const keep = {
    m: $("fMember").value,
    c: $("fCategory").value,
    s: $("fSize").value,
    fm: $("filterMember").value,
    fc: $("filterCategory").value,
    fs: $("filterSize").value,
  };
  const memberOpts = state.members.map((m, i) => `<option value="${i}">${i + 1}. ${esc(m)}</option>`).join("");
  const catOpts = CATEGORIES.map((c) => `<option value="${c}">${CATEGORY_LABEL[c]} – ${rp(state.prices[c])}</option>`).join("");

  $("fMember").innerHTML = `<option value="" disabled selected>-- Pilih Nama Anggota --</option>` + memberOpts;
  $("fCategory").innerHTML = catOpts;
  $("fSize").innerHTML = SIZES.map((s) => `<option value="${s}">${s}</option>`).join("");

  $("eMember").innerHTML = memberOpts;
  $("eCategory").innerHTML = catOpts;
  $("eSize").innerHTML = SIZES.map((s) => `<option value="${s}">${s}</option>`).join("");

  $("filterMember").innerHTML = `<option value="">Semua Anggota</option>` + memberOpts;
  $("filterCategory").innerHTML = `<option value="">Semua Kategori</option>` + CATEGORIES.map((c) => `<option value="${c}">${CATEGORY_LABEL[c]}</option>`).join("");
  $("filterSize").innerHTML = `<option value="">Semua Ukuran</option>` + SIZES.map((s) => `<option>${s}</option>`).join("");

  if (keep.m) $("fMember").value = keep.m;
  if (keep.c) $("fCategory").value = keep.c;
  if (keep.s) $("fSize").value = keep.s;
  $("filterMember").value = keep.fm;
  $("filterCategory").value = keep.fc;
  $("filterSize").value = keep.fs;
}

function updateFormTotal() {
  const cat = $("fCategory").value || "Cowok";
  const price = state.prices[cat] || 0;
  const qty = Math.max(0, parseInt($("fQty").value) || 0);
  $("fPrice").value = rp(price);
  $("fTotal").textContent = rp(price * qty);
}
["fCategory", "fQty"].forEach((id) => $(id).addEventListener("input", updateFormTotal));

$("saleForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!configured) return toast("Isi SCRIPT_URL di config.js dulu");
  if ($("fMember").value === "") return toast("Pilih nama anggota dulu");
  const qty = parseInt($("fQty").value);
  if (!qty || qty < 1) return toast("Jumlah minimal 1");

  const btn = $("btnSubmit");
  btn.disabled = true;
  btn.textContent = "Menyimpan...";
  busy = true;
  try {
    const d = await apiPost({
      action: "addSale",
      sale: {
        member: parseInt($("fMember").value),
        buyer: $("fBuyer").value.trim(),
        category: $("fCategory").value,
        size: $("fSize").value,
        qty,
        date: $("fDate").value,
        paid: $("fPaid").value === "1",
      },
    });
    applyData(d);
    $("fMember").value = "";
    $("fBuyer").value = "";
    $("fQty").value = 1;
    $("fPaid").value = "0";
    updateFormTotal();
    setStatus("ok", "Tersinkron " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    toast("✅ Penjualan tersimpan ke Google Sheets");
  } catch (err) {
    setStatus("err", "Gagal menyimpan: " + err.message);
    toast("❌ Gagal menyimpan: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan Penjualan";
    busy = false;
  }
});

// ====== Render ======
function memberStats() {
  return state.members.map((name, i) => {
    const rows = state.sales.filter((s) => s.member === i);
    const bySize = Object.fromEntries(SIZES.map((sz) => [sz, rows.filter((r) => r.size === sz).reduce((a, r) => a + r.qty, 0)]));
    const byCat = Object.fromEntries(CATEGORIES.map((c) => [c, rows.filter((r) => r.category === c).reduce((a, r) => a + r.qty, 0)]));
    return {
      i, name, bySize, byCat,
      qty: rows.reduce((a, r) => a + r.qty, 0),
      total: rows.reduce((a, r) => a + r.total, 0),
    };
  });
}

function render() {
  const totalQty = state.sales.reduce((a, s) => a + s.qty, 0);
  const totalRp = state.sales.reduce((a, s) => a + s.total, 0);
  const ms = memberStats();
  const top = [...ms].sort((a, b) => b.total - a.total)[0];

  $("statQty").textContent = totalQty;
  $("statTotal").textContent = rp(totalRp);
  $("statTrx").textContent = state.sales.length;
  $("statTop").textContent = top && top.total > 0 ? top.name : "-";

  // Daftar harga per kategori
  $("priceList").innerHTML = CATEGORIES.map((c) => {
    const sold = state.sales.filter((x) => x.category === c).reduce((a, x) => a + x.qty, 0);
    return `<tr><td><span class="badge">${CATEGORY_LABEL[c]}</span></td><td>${rp(state.prices[c])}</td><td>${sold} pcs</td></tr>`;
  }).join("");

  // Transaksi terakhir
  const recent = [...state.sales].slice(-6).reverse();
  $("recentList").innerHTML = recent.length
    ? recent.map((s) => `<li><div>${esc(state.members[s.member])} <small>• ${s.qty}x ${esc(s.category || "")} ${esc(s.size)}</small></div><strong>${rp(s.total)}</strong></li>`).join("")
    : `<li><small>Belum ada transaksi</small></li>`;

  // Rekap anggota (urut berdasarkan total)
  const sorted = [...ms].sort((a, b) => b.total - a.total || a.i - b.i);
  $("rekapTable").innerHTML = `
    <thead><tr>
      <th>Rank</th><th>Nama Anggota</th>
      ${CATEGORIES.map((c) => `<th class="num">${c}</th>`).join("")}
      ${SIZES.map((s) => `<th class="num">${s}</th>`).join("")}
      <th class="num">Total Kaos</th><th class="num">Total Harga</th>
    </tr></thead>
    <tbody>${sorted.map((m, r) => `<tr>
      <td class="rank">${m.total > 0 ? "#" + (r + 1) : "-"}</td><td>${esc(m.name)}</td>
      ${CATEGORIES.map((c) => `<td class="num">${m.byCat[c] || "-"}</td>`).join("")}
      ${SIZES.map((s) => `<td class="num">${m.bySize[s] || "-"}</td>`).join("")}
      <td class="num"><b>${m.qty}</b></td><td class="num"><b>${rp(m.total)}</b></td></tr>`).join("")}
    </tbody>
    <tfoot><tr><th colspan="2">TOTAL KESELURUHAN</th>
      ${CATEGORIES.map((c) => `<th class="num">${ms.reduce((a, m) => a + m.byCat[c], 0)}</th>`).join("")}
      ${SIZES.map((s) => `<th class="num">${ms.reduce((a, m) => a + m.bySize[s], 0)}</th>`).join("")}
      <th class="num">${totalQty}</th><th class="num">${rp(totalRp)}</th></tr></tfoot>`;

  renderData();
}

function filteredSales() {
  const fm = $("filterMember").value, fc = $("filterCategory").value, fs = $("filterSize").value, fp = $("filterPaid").value;
  return state.sales.filter((s) =>
    (fm === "" || s.member === parseInt(fm)) &&
    (fc === "" || s.category === fc) &&
    (fs === "" || s.size === fs) &&
    (fp === "" || (fp === "1" ? !!s.paid : !s.paid))
  );
}

function renderData() {
  const rows = filteredSales();
  $("dataBody").innerHTML = rows.length
    ? rows.map((s, i) => `<tr>
        <td>${i + 1}</td><td>${esc(s.date)}</td><td>${esc(state.members[s.member])}</td><td>${esc(s.buyer) || "-"}</td>
        <td><span class="badge">${esc(s.category || "-")}</span></td>
        <td><span class="badge">${esc(s.size)}</span></td><td>${s.qty}</td><td>${rp(s.price)}</td><td><b>${rp(s.total)}</b></td>
        <td><button type="button" class="paid-btn ${s.paid ? "yes" : "no"}" data-id="${esc(s.id)}" title="Klik untuk ubah status bayar">${s.paid ? "✅ Sudah" : "❌ Belum"}</button></td>
        <td><div class="actions"><button type="button" class="btn small edit" data-id="${esc(s.id)}">Edit</button><button type="button" class="btn small del" data-id="${esc(s.id)}">Hapus</button></div></td></tr>`).join("")
    : `<tr><td colspan="11" style="text-align:center;color:var(--muted)">Tidak ada data</td></tr>`;
  $("dataQty").textContent = rows.reduce((a, s) => a + s.qty, 0);
  $("dataTotal").textContent = rp(rows.reduce((a, s) => a + s.total, 0));
}
["filterMember", "filterCategory", "filterSize", "filterPaid"].forEach((id) => $(id).addEventListener("change", renderData));

$("dataBody").addEventListener("click", (e) => {
  const paidBtn = e.target.closest(".paid-btn");
  if (paidBtn) {
    adminAction({ action: "togglePaid", id: paidBtn.dataset.id }, "Status bayar diperbarui");
    return;
  }
  const editBtn = e.target.closest(".edit");
  if (editBtn) {
    const s = state.sales.find((x) => String(x.id) === String(editBtn.dataset.id));
    if (s) openEdit(s);
    return;
  }
  const delBtn = e.target.closest(".del");
  if (delBtn) {
    if (!confirm("Hapus transaksi ini? (butuh PIN admin)")) return;
    adminAction({ action: "deleteSale", id: delBtn.dataset.id }, "Transaksi dihapus");
  }
});

// ====== Modal Edit ======
function updateEditTotal() {
  const cat = $("eCategory").value || "Cowok";
  const price = state.prices[cat] || 0;
  const qty = Math.max(0, parseInt($("eQty").value) || 0);
  $("eTotal").textContent = rp(price * qty);
}
["eCategory", "eQty"].forEach((id) => $(id).addEventListener("input", updateEditTotal));

function openEdit(s) {
  $("eId").value = s.id;
  $("eMember").value = String(s.member);
  $("eBuyer").value = s.buyer || "";
  $("eCategory").value = CATEGORIES.includes(s.category) ? s.category : "Cowok";
  $("eSize").value = SIZES.includes(s.size) ? s.size : "L";
  $("eQty").value = s.qty || 1;
  $("eDate").value = s.date || today();
  $("ePaid").value = s.paid ? "1" : "0";
  updateEditTotal();
  $("editModal").classList.add("show");
}
function closeEdit() { $("editModal").classList.remove("show"); }
$("btnCloseEdit").addEventListener("click", closeEdit);
$("editModal").addEventListener("click", (e) => { if (e.target === $("editModal")) closeEdit(); });

$("editForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const qty = parseInt($("eQty").value);
  if (!qty || qty < 1) return toast("Jumlah minimal 1");
  const ok = await adminAction({
    action: "editSale",
    id: $("eId").value,
    sale: {
      member: parseInt($("eMember").value),
      buyer: $("eBuyer").value.trim(),
      category: $("eCategory").value,
      size: $("eSize").value,
      qty,
      date: $("eDate").value,
      paid: $("ePaid").value === "1",
    },
  }, "✏️ Transaksi diperbarui");
  if (ok) closeEdit();
});

// ====== Pengaturan ======
function renderSettings() {
  $("priceSettings").innerHTML = CATEGORIES.map((c) =>
    `<label>${CATEGORY_LABEL[c]}<input type="number" min="0" step="1000" data-cat="${c}" value="${state.prices[c]}" /></label>`).join("");
  $("memberSettings").innerHTML = state.members.map((m, i) =>
    `<input type="text" data-idx="${i}" value="${esc(m)}" placeholder="${esc(DEFAULT_MEMBERS[i] || `Anggota ${i + 1}`)}" />`).join("");
}

$("btnSavePrices").addEventListener("click", () => {
  const prices = {};
  document.querySelectorAll("#priceSettings input").forEach((inp) => {
    prices[inp.dataset.cat] = Math.max(0, parseInt(inp.value) || 0);
  });
  adminAction({ action: "savePrices", prices }, "💰 Harga disimpan");
});

$("btnSaveMembers").addEventListener("click", () => {
  const members = [];
  document.querySelectorAll("#memberSettings input").forEach((inp) => {
    members[parseInt(inp.dataset.idx)] = inp.value.trim();
  });
  adminAction({ action: "saveMembers", members }, "👥 Nama anggota disimpan");
});

$("btnReset").addEventListener("click", () => {
  if (!confirm("Yakin hapus SEMUA data penjualan di Google Sheets? Tindakan ini tidak bisa dibatalkan.")) return;
  adminAction({ action: "resetSales" }, "Semua data penjualan dihapus");
});

$("btnLogout").addEventListener("click", () => {
  sessionStorage.removeItem(PIN_KEY);
  toast("PIN admin dilupakan dari browser ini");
});

$("btnSync").addEventListener("click", refresh);

// ====== Export CSV ======
function downloadCSV(name, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = name; a.click();
}
$("btnExportData").addEventListener("click", () => {
  downloadCSV(`penjualan-batlantas-${today()}.csv`, [
    ["No", "Tanggal", "Anggota", "Pembeli", "Kategori", "Ukuran", "Jumlah", "Harga", "Total", "Status Bayar"],
    ...filteredSales().map((s, i) => [i + 1, s.date, state.members[s.member], s.buyer, s.category, s.size, s.qty, s.price, s.total, s.paid ? "Sudah Bayar" : "Belum Bayar"]),
  ]);
});
$("btnExportRekap").addEventListener("click", () => {
  downloadCSV(`rekap-anggota-batlantas-${today()}.csv`, [
    ["No", "Nama Anggota", ...CATEGORIES, ...SIZES, "Total Kaos", "Total Harga"],
    ...memberStats().map((m) => [m.i + 1, m.name, ...CATEGORIES.map((c) => m.byCat[c]), ...SIZES.map((s) => m.bySize[s]), m.qty, m.total]),
  ]);
});

// ====== Init ======
$("fDate").value = today();
fillSelects(); renderSettings(); updateFormTotal(); render();
refresh();
setInterval(() => { if (document.visibilityState === "visible") refresh(); }, AUTO_REFRESH_MS);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
