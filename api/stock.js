// Vercel Serverless Function - Bảo mật API Key nhà cung cấp 100% trên Server
// Khách mở F12/Source ở trình duyệt hoàn toàn KHÔNG THỂ THẤY BUYER_KEY!

const BUYER_KEY = process.env.BUYER_KEY || "tgb_0e970ffebbe8c5d6249715d579f3e3f9e54048b6e6fd7bbd";
const CANBOSO_ENDPOINT = "https://canboso.com/api/v2/telegram-buyer/products";

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const upstreamRes = await fetch(CANBOSO_ENDPOINT, {
      headers: {
        "x-buyer-key": BUYER_KEY,
        "Accept": "application/json"
      }
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: "Upstream error", status: upstreamRes.status });
    }

    const data = await upstreamRes.json();
    const rawProducts = data.products || [];

    // Chỉ trả về dữ liệu cần thiết (tồn kho, giá, tên) - KHÔNG để lộ thông tin nhạy cảm của bot/partner
    const sanitizedProducts = rawProducts.map(p => ({
      productId: p.productId,
      name: p.name,
      availability: {
        available: p.availability && p.availability.available !== undefined ? p.availability.available : 0
      },
      price: {
        amount: p.price && p.price.amount !== undefined ? p.price.amount : 0
      },
      description: (p.description || '').slice(0, 400)
    }));

    return res.status(200).json({ products: sanitizedProducts, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[API Stock] Fetch error:", err);
    return res.status(500).json({ error: "Lỗi đồng bộ dữ liệu máy chủ" });
  }
};
