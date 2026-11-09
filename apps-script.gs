/* =========================================================
   كود Google Sheet لطلبات سور شوكلت
   الصقه في: الشيت ← الإضافات ← Apps Script
   ========================================================= */

// كلمة سر شاشة الكاشير — غيّرها لكلمة خاصة فيك، ونفسها تكتبها في شاشة الكاشير
const SECRET = "CHANGE-ME-1234";

// إيميل تنبيه لكل طلب جديد: يوصل إشعار للجوال حتى لو شاشة الكاشير مسكرة
// تقدر تحط أكثر من إيميل بينها فاصلة، مثل: "a@gmail.com, b@gmail.com" (فاضي = بدون إيميل)
const NOTIFY_EMAILS = "brand.kuzama@gmail.com";

// دخول المحرر في شاشة الكاشير (يعدّل البكجات والأصناف والصور والخصم)
// اكتب هنا إيميل المحرر وكلمة سره. فاضي = المحرر مقفل
const EDITOR_EMAIL = "";
const EDITOR_PASSWORD = "";

const SHEET_NAME = "الطلبات";
const CONFIG_SHEET = "الإعدادات";          // تبويب يحفظ إعدادات المحرر
const IMG_FOLDER = "صور سور شوكلت";        // مجلد في درايف لصور الأصناف المرفوعة من المحرر
const HEADERS = ["رقم الطلب", "وقت الطلب", "الحالة", "البكج", "الأصناف", "الإجمالي",
                 "الاسم", "الجوال", "طريقة التواصل", "تاريخ الاستلام", "ملاحظات", "لغة العميل", "الحي", "العنوان الوطني", "رابط الموقع"];
const STATUSES = ["جديد", "مؤكد", "جاهز", "تم التسليم", "ملغي"];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sh.setRightToLeft(true);
  }
  if (sh.getLastColumn() < HEADERS.length) {   // يضيف الأعمدة الجديدة لشيت قديم
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v, max) {
  return String(v == null ? "" : v).slice(0, max || 500).replace(/^[=+\-@]/, "'$&"); // يمنع تنفيذ معادلات
}

// ===== إعدادات المحرر =====
function getConfig_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
  if (!sh) return null;
  const v = String(sh.getRange(1, 1).getValue() || "");
  if (!v) return null;
  try { return JSON.parse(v); } catch (x) { return null; }
}

function setConfig_(cfg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG_SHEET);
  if (!sh) { sh = ss.insertSheet(CONFIG_SHEET); sh.hideSheet(); }
  sh.getRange(1, 1).setNumberFormat("@").setValue(JSON.stringify(cfg));
  sh.getRange(1, 2).setValue(new Date());
}

const txt_ = (v, max) => String(v == null ? "" : v).trim().slice(0, max || 80);
const num_ = (v, lo, hi) => { const n = Number(v); return isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : lo; };
const names_ = n => ({ ar: txt_(n && n.ar), en: txt_(n && n.en), ur: txt_(n && n.ur) });
const img_ = v => { const u = txt_(v, 500); return /^https:\/\/\S+$/i.test(u) ? u : ""; };

// ينظّف إعدادات المحرر قبل الحفظ
function cleanConfig_(c) {
  if (!c || !Array.isArray(c.sufras) || !Array.isArray(c.categories)) throw new Error("shape");
  const sufras = c.sufras.slice(0, 12).map(s => {
    const min = num_(s.min, 1, 1000), max = num_(s.max, min, 1000);
    return { name: names_(s.name), min: min, max: max, picks: num_(s.picks, 1, 20), price: num_(s.price, 0, 100000) };
  }).filter(s => s.name.ar);
  const categories = c.categories.slice(0, 30).map(cat => ({
    name: names_(cat.name),
    items: (Array.isArray(cat.items) ? cat.items : []).slice(0, 100).map(it => {
      const o = names_(it); o.img = img_(it.img);
      const ex = num_(it.extra, 0, 100000); if (ex) o.extra = ex;
      return o;
    }).filter(it => it.ar)
  })).filter(cat => cat.name.ar && cat.items.length);
  if (!sufras.length) throw new Error("no_sufras");
  if (!categories.length) throw new Error("no_cats");
  return { sufras: sufras, categories: categories, discount: num_(c.discount, 0, 90), coupon: txt_(c.coupon, 20) };
}

// دخول المحرر: إيميل + كلمة سر، ويرجع رمز دخول صالح ١٢ ساعة
function editorLogin_(d) {
  if (!EDITOR_EMAIL || !EDITOR_PASSWORD) return { ok: false, error: "editor_off" };
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get("ed_fail") || 0);
  if (fails >= 5) return { ok: false, error: "locked" };   // ٥ محاولات غلط = قفل ١٥ دقيقة
  const email = String(d.email || "").trim().toLowerCase();
  if (email !== EDITOR_EMAIL.trim().toLowerCase() || String(d.password || "") !== EDITOR_PASSWORD) {
    cache.put("ed_fail", String(fails + 1), 900);
    return { ok: false, error: "bad_login" };
  }
  cache.remove("ed_fail");
  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put("ed_" + token, email, 43200);
  return { ok: true, token: token, email: email };
}

function isEditor_(token) {
  return !!(token && CacheService.getScriptCache().get("ed_" + String(token).slice(0, 80)));
}

// رفع صورة صنف من المحرر إلى مجلد في درايف (مشاركة للعرض فقط)
function uploadImage_(d) {
  const mime = String(d.mime || "");
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return { ok: false, error: "type" };
  const bytes = Utilities.base64Decode(String(d.data || ""));
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) return { ok: false, error: "size" };
  const it = DriveApp.getFoldersByName(IMG_FOLDER);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(IMG_FOLDER);
  const name = txt_(d.name, 60).replace(/[\\/:*?"<>|]/g, "") || "صنف";
  const f = folder.createFile(Utilities.newBlob(bytes, mime, name));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: "https://drive.google.com/thumbnail?id=" + f.getId() + "&sz=w800" };
}

// استقبال طلب جديد، أو تغيير حالة طلب من الكاشير
function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: "bad_json" }); }

  if (d.action === "editorLogin") return json_(editorLogin_(d));
  if (d.action === "uploadImage") {
    if (!isEditor_(d.token)) return json_({ ok: false, error: "auth" });
    try { return json_(uploadImage_(d)); } catch (x) { return json_({ ok: false, error: "upload" }); }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (d.action === "saveConfig") {   // المحرر يحفظ البكجات والأصناف والخصم
      if (!isEditor_(d.token)) return json_({ ok: false, error: "auth" });
      let cfg;
      try { cfg = cleanConfig_(d.config); } catch (x) { return json_({ ok: false, error: String(x.message || "bad_config") }); }
      if (JSON.stringify(cfg).length > 45000) return json_({ ok: false, error: "too_big" });
      setConfig_(cfg);
      return json_({ ok: true, config: cfg });
    }

    if (d.action === "avail") {   // الكاشير يحدّث الأصناف الغير متوفرة
      if (d.key !== SECRET) return json_({ ok: false, error: "key" });
      const off = (Array.isArray(d.off) ? d.off : []).map(x => String(x).slice(0, 100)).slice(0, 300);
      PropertiesService.getScriptProperties().setProperty("off", JSON.stringify(off));
      return json_({ ok: true, off: off });
    }

    const sh = sheet_();

    if (d.action === "status") {
      if (d.key !== SECRET) return json_({ ok: false, error: "key" });
      if (STATUSES.indexOf(d.status) < 0) return json_({ ok: false, error: "status" });
      const last = sh.getLastRow();
      if (last < 2) return json_({ ok: false, error: "not_found" });
      const ids = sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0]));
      const i = ids.indexOf(String(d.id));
      if (i < 0) return json_({ ok: false, error: "not_found" });
      sh.getRange(i + 2, 3).setValue(d.status);
      return json_({ ok: true });
    }

    const o = d.order || {};
    if (!o.name || !o.phone || !o.sufra) return json_({ ok: false, error: "missing" });
    sh.appendRow([
      clean_(o.id, 20), new Date(), "جديد",
      clean_(o.sufra), clean_(o.items, 3000), clean_(o.total, 200),
      clean_(o.name, 120), "'" + String(o.phone).replace(/[^0-9+\s]/g, "").slice(0, 20), clean_(o.contact, 20),
      clean_(o.date, 20), clean_(o.notes, 1000), clean_(o.lang, 20), clean_(o.district, 100),
      clean_(o.naddr, 40), /^https:\/\/\S+$/i.test(String(o.maplink || "")) ? String(o.maplink).slice(0, 500) : ""
    ]);
    try { notify_(o); } catch (x) {}   // فشل التنبيه ما يوقف حفظ الطلب
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function notify_(o) {
  if (!NOTIFY_EMAILS) return;
  const rows = [
    ["رقم الطلب", "#" + o.id], ["تاريخ الاستلام", o.date], ["البكج", o.sufra],
    ["الأصناف", String(o.items || "").replace(/\n/g, "<br>")], ["الإجمالي", o.total],
    ["الاسم", o.name], ["الجوال", o.phone], ["الحي", o.district || "-"], ["العنوان الوطني", o.naddr || "-"], ["رابط الموقع", o.maplink || "-"], ["طريقة التواصل", o.contact],
    ["ملاحظات", o.notes || "-"], ["لغة العميل", o.lang || "-"]
  ];
  const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const html = '<div dir="rtl" style="font-family:Tahoma,Arial;font-size:15px">' +
    '<h2 style="color:#4A2C1D;margin:0 0 12px">طلب سور شوكلت جديد #' + esc(o.id) + '</h2>' +
    '<table cellpadding="8" style="border-collapse:collapse">' +
    rows.map(r => '<tr><td style="color:#7A6666;border-bottom:1px solid #eee;white-space:nowrap">' + r[0] +
      '</td><td style="border-bottom:1px solid #eee">' + (r[0] === "الأصناف" ? esc(r[1]).replace(/&lt;br&gt;/g, "<br>") : esc(r[1])) + '</td></tr>').join("") +
    '</table></div>';
  MailApp.sendEmail({
    to: NOTIFY_EMAILS,
    subject: "🔔 طلب سور شوكلت جديد #" + o.id + " - " + o.name,
    htmlBody: html, name: "طلبات سور شوكلت"
  });
}

// شاشة الكاشير تقرأ آخر الطلبات (تحتاج كلمة السر)
function off_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("off") || "[]"); } catch (x) { return []; }
}

function doGet(e) {
  // صفحة الطلب تقرأ الأصناف الغير متوفرة (بدون كلمة سر، ما فيها بيانات عملاء)
  if (e.parameter.action === "menu") return json_({ ok: true, off: off_(), config: getConfig_() });
  if ((e.parameter.key || "") !== SECRET) return json_({ ok: false, error: "key" });
  const v = sheet_().getDataRange().getValues();
  v.shift();
  const tz = "Asia/Riyadh";
  const fmtDate = x => x instanceof Date ? Utilities.formatDate(x, tz, "yyyy-MM-dd") : String(x);
  const orders = v.slice(-300).map(r => ({
    id: String(r[0]),
    time: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
    status: r[2], sufra: r[3], items: r[4], total: r[5],
    name: r[6], phone: String(r[7]), contact: r[8],
    date: fmtDate(r[9]), notes: r[10], lang: r[11], district: r[12] || "", naddr: r[13] || "", maplink: r[14] || ""
  })).reverse();
  return json_({ ok: true, orders: orders, off: off_(), config: getConfig_() });
}
