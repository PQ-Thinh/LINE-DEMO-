// api/proxy.js
// Serverless proxy chạy trên Vercel (region hnd1 - Tokyo, xem vercel.json).
// Nhiệm vụ: nhận request từ trình duyệt (frontend), gọi hộ tới API đích
// bằng server-to-server (không bị CORS chặn), rồi trả kết quả về lại cho frontend.
//
// Cách gọi từ frontend:
// POST /api/proxy
// Body JSON: { "url": "https://...", "method": "GET", "headers": {...}, "body": "..." }

export default async function handler(req, res) {
  // Cho phép gọi từ mọi origin (đổi thành domain cụ thể nếu muốn siết lại)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Trình duyệt sẽ gửi preflight OPTIONS trước khi POST — trả OK ngay
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Chỉ hỗ trợ method POST cho /api/proxy' });
    return;
  }

  const { url, method = 'GET', headers = {}, body } = req.body || {};

  if (!url) {
    res.status(400).json({ error: 'Thiếu "url" trong body request.' });
    return;
  }

  try {
    const upstreamOptions = { method, headers };

    // Chỉ gắn body khi method không phải GET/HEAD
    if (body && method !== 'GET' && method !== 'HEAD') {
      upstreamOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const upstreamRes = await fetch(url, upstreamOptions);
    const contentType = upstreamRes.headers.get('content-type') || '';

    let data;
    if (contentType.includes('application/json')) {
      data = await upstreamRes.json();
    } else {
      data = await upstreamRes.text();
    }

    // Trả về nguyên trạng status + data của API đích, kèm metadata để debug
    res.status(200).json({
      proxied: true,
      targetUrl: url,
      targetStatus: upstreamRes.status,
      targetOk: upstreamRes.ok,
      contentType,
      data
    });
  } catch (err) {
    res.status(502).json({
      proxied: true,
      error: 'Không gọi được tới URL đích từ server proxy.',
      message: err.message
    });
  }
}
