/* =========================================================
   قائمة أصناف سور شوكلت — تستخدمها صفحة الطلب وشاشة الكاشير
   ⚠️ أصناف تجريبية: بدّلها بأصنافكم الفعلية
   كل صنف: ar / en / ur = الاسم، img = رابط الصورة (اختياري)،
   extra = زيادة على سعر البكج قبل الخصم (اختياري)
   كل بكج يختار من كل فئة عدد أصناف = picks في صفحة الطلب
   ========================================================= */
const MENU_CATEGORIES = [
    { name: { ar: "شوكولاتة", en: "Chocolates", ur: "چاکلیٹ" }, items: [
      { ar: "شوكولاتة داكنة", en: "Dark Chocolate", ur: "ڈارک چاکلیٹ", img: "" },
      { ar: "شوكولاتة بالحليب", en: "Milk Chocolate", ur: "ملک چاکلیٹ", img: "" },
      { ar: "شوكولاتة بيضاء", en: "White Chocolate", ur: "وائٹ چاکلیٹ", img: "" },
      { ar: "شوكولاتة بالبندق", en: "Hazelnut Chocolate", ur: "ہیزل نٹ چاکلیٹ", img: "" },
      { ar: "شوكولاتة بالفستق", en: "Pistachio Chocolate", ur: "پستہ چاکلیٹ", img: "", extra: 20 } ]},
    { name: { ar: "حلويات", en: "Desserts", ur: "میٹھے" }, items: [
      { ar: "براونيز", en: "Brownies", ur: "براؤنیز", img: "" },
      { ar: "كوكيز", en: "Cookies", ur: "کوکیز", img: "" },
      { ar: "تشيز كيك", en: "Cheesecake", ur: "چیز کیک", img: "" },
      { ar: "كيك شوكولاتة", en: "Chocolate Cake", ur: "چاکلیٹ کیک", img: "" } ]},
    { name: { ar: "مغطّسات", en: "Chocolate Dipped", ur: "چاکلیٹ ڈپ" }, items: [
      { ar: "فراولة بالشوكولاتة", en: "Chocolate Strawberries", ur: "چاکلیٹ اسٹرابیری", img: "" },
      { ar: "تمر بالشوكولاتة", en: "Chocolate Dates", ur: "چاکلیٹ کھجور", img: "" },
      { ar: "مكسرات بالشوكولاتة", en: "Chocolate Nuts", ur: "چاکلیٹ میوے", img: "" } ]},
];
