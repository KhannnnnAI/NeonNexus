# Tài Liệu Giải Thích Chi Tiết Cấu Trúc Codebase NeonNexus

Chào bạn, đây là tài liệu giải thích **rất chi tiết** và đầy đủ về toàn bộ kiến trúc, cấu trúc thư mục, chức năng từng file, cũng như các luồng dữ liệu (Data Flow) cốt lõi trong dự án **NeonNexus** - nền tảng bán key game bản quyền.

Dự án này sử dụng kiến trúc **Frontend thuần (HTML/CSS/Vanilla JS)** kết hợp với **Node.js Express (Backend Proxy & Payment)** và **Firebase (Database & Authentication)**.

---

## 1. Cấu Trúc Thư Mục Tổng Quan

```text
https://nenonexus-digital-game-store.web.app/
├── API/                 # Logic JavaScript phía Client xử lý gọi API, Firebase, giao diện
├── css/                 # Các file CSS (Hỗ trợ Dark/Light mode)
├── dashboard/           # Giao diện và logic dành cho Admin (Quản trị viên)
├── html/                # Các trang con của website (ngoài trang chủ)
├── img/ / Image/ / font/# Các tài sản tĩnh (hình ảnh, font chữ, banner)
├── server/              # Backend Node.js (Proxy Server & Payment Webhooks)
├── tools/               # Các công cụ hỗ trợ (scripts batch/powershell)
├── firebase_build/      # Thư mục chứa code dùng để deploy lên Firebase Hosting
├── index.html           # Trang chủ ứng dụng
├── package.json         # Cấu hình npm của Frontend
└── firestore.rules      # Phân quyền bảo mật cho cơ sở dữ liệu Firebase
```

---

## 2. Phân Tích Chi Tiết: Frontend (`html/` và root)

Đây là nơi chứa giao diện hiển thị cho người dùng cuối (End-User).

*   **`index.html`**: Trang chủ. Nơi gọi `API/index.js` để tải danh sách các game mới nhất, game đang giảm giá, slider banner nổi bật, và tin tức RSS về game.
*   **`html/game.html`**: Trang chi tiết sản phẩm. Dùng `gameId` hoặc `appId` truyền trên URL để kéo thông tin chi tiết (ảnh, trailer, mô tả, giá) từ Steam hoặc CheapShark.
*   **`html/keygen.html`**: Đây thực chất là trang **Giỏ Hàng & Thanh Toán**. Khi người dùng ấn "Buy", hệ thống sẽ chuyển đến đây. File này tích hợp UI các phương thức thanh toán (Stripe, PayOS, MoMo, ZaloPay), đồng thời giả lập việc "sinh ra key game" (Key Generator) sau khi thanh toán thành công và lưu vào Firebase.
*   **`html/account.html`**: Bảng điều khiển cá nhân của người dùng. Hiển thị avatar, thông tin tài khoản, và liệt kê **Lịch sử mua hàng (Purchase History)** được lấy từ Firestore.
*   **`html/trending.html`**: Trang hiển thị danh sách các tựa game đang hot hoặc giảm giá sốc. Dữ liệu được fetch qua `API/trending.js`.
*   **`html/community.html` & `html/event.html`**: Trang cộng đồng và sự kiện.
*   **`html/support.html`**: Cổng hỗ trợ khách hàng, nơi người dùng (hoặc khách) có thể tạo ticket gửi cho Admin.

---

## 3. Phân Tích Chi Tiết: Client API (`API/`)

Chứa toàn bộ logic vận hành website. Dự án sử dụng Vanilla JavaScript kết hợp với **Firebase Compat SDK** (tải qua thẻ `<script>`).

### A. Hệ thống Xác thực (`API/auth.js`)
File lớn nhất và quan trọng bậc nhất. 
*   **Chức năng**: Quản lý đăng nhập Email/Password, Google, Steam và Guest (Khách).
*   **Logic Steam & Khách**: Firebase mặc định không hỗ trợ trực tiếp Steam. Code đã tuỳ biến: khi User đăng nhập Steam thành công qua Backend, Client sẽ tạo một tài khoản **Firebase Anonymous (Ẩn danh)** và gán (link) `steamId` vào đó. Tài khoản "Khách" cũng sử dụng Firebase Anonymous.
*   **Quản lý Session**: Dùng LocalStorage (các key như `DASHBOARD_SESSION_KEY`, `steam_user`) để giữ trạng thái đăng nhập khi người dùng chuyển trang.
*   Cung cấp các hàm `updateUI`, `startFirebaseSafe()` để tự động retry tải thư viện Firebase nếu mạng lỗi.

### B. Tích hợp Dữ Liệu Game 
*   **`cheapshark-api.js`**: Module chuyên gọi API của CheapShark để lấy dữ liệu game giảm giá đa nền tảng.
*   **`steam-sale-api.js`**: Lấy danh sách game sale từ Steam (thường gọi qua proxy server).
*   **`game-detail.js`**: Chạy trên `game.html`, chịu trách nhiệm phân tích URL ID, gọi API lấy trailer/ảnh và render lên giao diện chi tiết.
*   **`index.js`**: Khởi chạy trên trang chủ để load carousel, deals, banner.

### C. Quản lý Tài Khoản & Giao dịch
*   **`account.js`**: Kiểm tra session Firebase, móc vào Firestore (ví dụ: collection `users` hoặc `orders`) để lấy danh sách key game người dùng đã mua.
*   **`momo.js` / `zalo test.js` / `cors-client.js`**: Chứa logic gọi API lên Backend để tạo link thanh toán (Ví dụ: `fetch('/create-payment-intent')` của Stripe hoặc ZaloPay).

### D. Tiện ích (Utils)
*   **`theme-toggle.js`**: Ghi nhớ và thay đổi CSS class cho Dark Mode / Light Mode.
*   **`support.js`**: Gửi form tạo ticket lên Firestore collection `support_tickets`.

---

## 4. Phân Tích Chi Tiết: Backend Server (`server/`)

Do Steam và CheapShark áp dụng chính sách chặn **CORS (Cross-Origin Resource Sharing)** và giới hạn truy cập (Rate Limit) nếu gọi từ Client, dự án bắt buộc phải có 1 Backend Node.js đứng ra làm trung gian (Proxy).

*   **`server.js` (Cốt lõi Server)**:
    *   **OpenID Auth (`/auth/steam` & `/auth/steam/return`)**: Thực hiện chuẩn giao thức OpenID để đưa người dùng sang trang Steam đăng nhập, nhận về `steamId`, tự động fetch Avatar Steam và trả về cho trang Web qua `window.postMessage`.
    *   **Proxy Steam API (`/api/steam/details`, `/api/steam/price`)**: Nhận request từ Web, mang lên Steam hỏi dữ liệu, và trả lại Web. Có **Caching In-Memory** (như `steamPriceCache`, `steamFeaturedCache`) để tránh bị Steam khoá IP do Spam.
    *   **Proxy Steam Image (`/api/steam/image`)**: Đóng giả User-Agent để tải ảnh bìa game từ máy chủ Akamai (bình thường bị 403 Forbidden nếu nhúng trực tiếp lên web).
    *   **Proxy CheapShark (`/api/cheapshark/:endpoint`)**: Tương tự như Steam, bypass lỗi 429 Too Many Requests của CheapShark bằng cách cache dữ liệu.
    *   **Thanh Toán**: Khởi tạo cấu hình PayOS, ZaloPay (từ biến môi trường `.env`) và xử lý tạo phiên thanh toán (Session/Order).
    *   **Twitch API Proxy**: Lấy Token của Twitch để search Trailer game từ IGDB (cơ sở dữ liệu game thuộc Twitch).
*   **`cors-config.js`**: Lọc IP, chỉ cho phép các domain whitelist (như `localhost:5000` hoặc domain thật của bạn) được gọi API server, chống hacker xài chùa API.
*   **`news.js`**: Parse RSS feed từ trang tin tức game (ví dụ GameSpot, IGN) chuyển sang JSON cho trang chủ.

---

## 5. Phân Tích Chi Tiết: Admin Dashboard (`dashboard/`)

Khu vực này dùng để Admin vận hành sàn thương mại điện tử.
*   **`dashboard.html`**: Trang tổng quan, hiển thị biểu đồ, thống kê số lượng đơn hàng, doanh thu (doanh thu tính tổng từ Firebase orders).
*   **`customers.html`**: Danh sách người dùng (Customer list), hỗ trợ cấm (ban) hoặc quản lý tài khoản.
*   **`orders-revenue.html`**: Lịch sử đơn hàng tổng của hệ thống.
*   **`products-services.html`**: Có thể dùng để quản lý kho key game, thêm bớt tựa game.
*   **`support-errors.html` / `fraud-review.html`**: Quản lý các ticket hỗ trợ của khách, đánh giá các giao dịch có dấu hiệu lừa đảo (fraud).
*   **`sidebar-auth.js`**: Logic riêng để chặn truy cập, yêu cầu Admin phải đăng nhập mới được vào các trang này.

---

## 6. Luồng Dữ Liệu Các Chức Năng Chính (Data Flows)

### Flow 1: Đăng Nhập Bằng Steam
1. User nhấn "Login with Steam" -> Mở popup gọi endpoint Backend `GET /auth/steam`.
2. Backend redirect popup sang cổng đăng nhập an toàn của Steam.
3. User gõ tài khoản Steam -> Steam trả về callback cho Backend tại `/auth/steam/return`.
4. Backend dùng OpenID xác minh, gọi API Steam lấy Avatar + Tên -> Render đoạn HTML chứa thẻ `<script>` gọi `window.opener.postMessage()`.
5. Frontend (`auth.js`) nhận được Message -> Tạo Firebase Anonymous Auth -> Gắn `steamId` vào -> Cập nhật LocalStorage -> Cập nhật UI avatar.

### Flow 2: Hiển Thị Giá Game Nhanh Chóng
1. `index.html` load -> `API/index.js` lấy danh sách ID game muốn hiển thị.
2. Web gọi `GET server/api/steam/price?appids=123,456`
3. Server kiểm tra Cache (RAM). Nếu có sẵn, trả về ngay lập tức (X-Price-Cache: HIT).
4. Nếu chưa có, Server chia lô 40 ID/lần, gửi request lên Steam (kèm cookie lách qua bộ đếm tuổi Mature content) để lấy giá VND và USD. Lưu vào Cache 24 giờ.
5. Web nhận JSON chứa thông tin giá và render CSS tag giảm giá.

### Flow 3: Quá Trình Mua Hàng & Lấy Key
1. User truy cập `keygen.html`, chọn Game + Cổng thanh toán (Vd: PayOS).
2. Frontend gọi Backend tạo link thanh toán (QR code). Người dùng quét mã.
3. (Mô phỏng hoặc thực tế) Khi trạng thái thanh toán thành công, Frontend/Backend kích hoạt hàm tạo Order.
4. Một đoạn Key giả lập (Vd: `XXXXX-YYYYY-ZZZZZ`) được tạo bằng `Math.random()`.
5. Dữ liệu (Tên game, Key, Giá tiền, Thời gian) được đẩy lên **Firestore DB** vào tài khoản của User (`db.collection('users').doc(uid).collection('orders')`).
6. User qua trang `account.html` -> Code lấy dữ liệu từ Firestore và hiển thị cho người dùng chép Key vào Steam.

---

## Tổng Kết

**NeonNexus** là một dự án phức tạp với sự kết hợp nhuần nhuyễn giữa:
*   **Frontend**: Xử lý UI/UX phức tạp, quản lý session cục bộ, hiển thị animation.
*   **Backend Node.js**: Giải quyết triệt để các rào cản kỹ thuật của các nền tảng lớn (CORS, Age-gate, Rate-limit của Steam/CheapShark) và là cổng thanh toán an toàn.
*   **Firebase**: Đóng vai trò là hệ cơ sở dữ liệu thời gian thực (Real-time Database) và bảo mật người dùng mà không cần tự xây dựng hệ thống DB SQL phức tạp.
