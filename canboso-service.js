/**
 * CANBOSO BUYER API & PRICING SERVICE
 * BR-34 SMM Panel (ShopByBrays)
 */

const CANBOSO_SERVICE = (function () {
  const DEFAULT_KEY = "tgb_0e970ffebbe8c5d6249715d579f3e3f9e54048b6e6fd7bbd";
  const API_BASE = "https://canboso.com/api/v2/telegram-buyer";

  const STORAGE_KEY_SETTINGS = "shop_canboso_settings";
  const STORAGE_KEY_CUSTOM_PRICES = "shop_canboso_custom_prices";
  const STORAGE_KEY_CACHE = "shop_canboso_cache";

  function getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        return Object.assign({
          apiKey: DEFAULT_KEY,
          marginType: "fixed", // 'fixed' | 'percent' | 'none'
          marginValue: 15000,
          hiddenProducts: []
        }, JSON.parse(raw));
      }
    } catch (e) {
      console.warn("Lỗi đọc settings:", e);
    }
    return {
      apiKey: DEFAULT_KEY,
      marginType: "fixed",
      marginValue: 15000,
      hiddenProducts: []
    };
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }

  function getCustomPrices() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_PRICES);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Lỗi đọc custom prices:", e);
    }
    return {};
  }

  function saveCustomPrices(prices) {
    localStorage.setItem(STORAGE_KEY_CUSTOM_PRICES, JSON.stringify(prices));
  }

  function calculateSellPrice(basePrice, productId, settings, customPrices) {
    if (!settings) settings = getSettings();
    if (!customPrices) customPrices = getCustomPrices();

    if (customPrices && customPrices[productId] !== undefined && customPrices[productId] !== null && customPrices[productId] !== "") {
      const custom = Number(customPrices[productId]);
      if (!isNaN(custom) && custom > 0) return custom;
    }

    const base = Number(basePrice || 0);
    if (settings.marginType === "fixed") {
      return base + Number(settings.marginValue || 0);
    } else if (settings.marginType === "percent") {
      const pct = Number(settings.marginValue || 0);
      const calculated = base * (1 + pct / 100);
      return Math.round(calculated / 1000) * 1000; // Làm tròn theo nghìn VND
    }
    return base;
  }

  function detectCategory(name, desc) {
    const text = ((name || "") + " " + (desc || "")).toLowerCase();
    if (text.includes("chatgpt") || text.includes("gpt") || text.includes("openai") || text.includes("codex")) {
      return "chatgpt";
    }
    if (text.includes("antigravity") || text.includes("veo") || text.includes("claude") || text.includes("gemini") || text.includes("midjourney") || text.includes("ai")) {
      return "ai";
    }
    if (text.includes("youtube") || text.includes("netflix") || text.includes("spotify") || text.includes("canva") || text.includes("capcut") || text.includes("locket")) {
      return "entertainment";
    }
    if (text.includes("mail") || text.includes("gmail") || text.includes("proxy") || text.includes("facebook") || text.includes("via") || text.includes("clone") || text.includes("tiktok")) {
      return "resource";
    }
    return "other";
  }

  function getCategoryLabel(cat) {
    const map = {
      chatgpt: "ChatGPT & OpenAI",
      ai: "AI Pro & Antigravity",
      entertainment: "Giải Trí & Ứng Dụng",
      resource: "Tài Nguyên & MMO",
      other: "Dịch Vụ Khác"
    };
    return map[cat] || "Khác";
  }

  function getCategoryIcon(cat) {
    const map = {
      chatgpt: "https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg",
      ai: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg",
      entertainment: "https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg",
      resource: "https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg",
      other: "https://cdn-icons-png.flaticon.com/512/3524/3524636.png"
    };
    return map[cat] || map.other;
  }

  async function fetchBalance(keyOverride) {
    const key = keyOverride || getSettings().apiKey || DEFAULT_KEY;
    const url = `${API_BASE}/balance?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      headers: { "x-buyer-key": key }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return await res.json();
  }

  async function fetchProducts(keyOverride, forceRefresh = false) {
    const settings = getSettings();
    const key = keyOverride || settings.apiKey || DEFAULT_KEY;
    const customPrices = getCustomPrices();

    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(STORAGE_KEY_CACHE);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 60000 && parsed.products) {
            return enrichProducts(parsed.products, settings, customPrices);
          }
        }
      } catch (e) {}
    }

    const url = `${API_BASE}/products?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      headers: { "x-buyer-key": key }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Lỗi tải sản phẩm (HTTP ${res.status})`);
    }

    const data = await res.json();
    const rawList = data.products || [];

    try {
      sessionStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify({
        timestamp: Date.now(),
        products: rawList
      }));
    } catch (e) {}

    return enrichProducts(rawList, settings, customPrices);
  }

  function enrichProducts(rawList, settings, customPrices) {
    const hiddenSet = new Set(settings.hiddenProducts || []);

    return rawList.map(p => {
      const basePrice = Number(p.price?.amount || 0);
      const sellPrice = calculateSellPrice(basePrice, p.productId, settings, customPrices);
      const category = detectCategory(p.name, p.description);
      const isCustomPrice = customPrices && customPrices[p.productId] !== undefined && customPrices[p.productId] !== null && customPrices[p.productId] !== "";

      const avail = p.availability?.available;
      const inStock = avail === null || (typeof avail === "number" && avail > 0);
      const stockText = avail === null ? "Slot Order" : `Còn: ${avail}`;

      return {
        id: p.productId,
        name: p.name,
        desc: p.description || "",
        basePrice: basePrice,
        basePriceFormatted: Number(basePrice).toLocaleString("vi-VN") + "đ",
        sellPrice: sellPrice,
        sellPriceFormatted: Number(sellPrice).toLocaleString("vi-VN") + "đ",
        isCustomPrice: isCustomPrice,
        category: category,
        categoryLabel: getCategoryLabel(category),
        icon: p.image ? ("https://canboso.com" + p.image) : getCategoryIcon(category),
        productType: p.productType || "account",
        stock: avail,
        stockText: stockText,
        inStock: inStock,
        soldCount: p.availability?.sold || 0,
        badge: (p.name.includes("[SALE]") || p.name.includes("SALE")) ? "SALE" : (p.name.includes("BH") ? "BẢO HÀNH" : "HOT"),
        isVisible: !hiddenSet.has(p.productId),
        purchaseRequirements: p.purchaseRequirements || {}
      };
    });
  }

  return {
    DEFAULT_KEY,
    API_BASE,
    getSettings,
    saveSettings,
    getCustomPrices,
    saveCustomPrices,
    calculateSellPrice,
    fetchBalance,
    fetchProducts
  };
})();

if (typeof window !== "undefined") {
  window.CANBOSO_SERVICE = CANBOSO_SERVICE;
}
