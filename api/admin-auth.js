// Vercel Serverless Function - Xác thực đăng nhập Admin an toàn trên Server
// Mật khẩu KHÔNG BAO GIỜ hiển thị trong code JavaScript ở trình duyệt khách!

const crypto = require("crypto");

// Danh sách email quản trị viên hợp lệ
const ALLOWED_EMAILS = [
  "mt11022009mt@gmail.com",
  "admin@shopbybrays.com"
];

// Danh sách mật khẩu được chấp nhận (chỉ lưu trên server)
// Có thể tùy biến qua biến môi trường Vercel ADMIN_PASSWORD
const SERVER_MASTER_PASSWORDS = [
  process.env.ADMIN_PASSWORD,
  "0976976627",
  "mt11022009mt",
  "br34@admin2026"
].filter(Boolean);

const JWT_SECRET = process.env.JWT_SECRET || "br34_smm_panel_secure_key_2026_super_secret";

function createSessionToken(email) {
  const payload = {
    email,
    role: "admin",
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 ngày
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPass = (password || "").trim();

    if (!cleanEmail || !cleanPass) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ Email và Mật khẩu!" });
    }

    const isEmailValid = ALLOWED_EMAILS.includes(cleanEmail) || cleanEmail.includes("mt11022009mt");
    const isPassValid = SERVER_MASTER_PASSWORDS.includes(cleanPass);

    if (isEmailValid && isPassValid) {
      const token = createSessionToken(cleanEmail);
      return res.status(200).json({
        success: true,
        token: token,
        email: cleanEmail,
        message: "Xác thực thành công!"
      });
    }

    // Trả về lỗi 401 nếu sai
    return res.status(401).json({
      success: false,
      error: "Email hoặc Mật khẩu Quản trị không chính xác!"
    });
  } catch (err) {
    console.error("[API Admin Auth] Error:", err);
    return res.status(500).json({ error: "Lỗi máy chủ xác thực" });
  }
};
