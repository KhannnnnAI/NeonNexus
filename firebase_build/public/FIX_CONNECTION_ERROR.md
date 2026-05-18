# 🔧 Sửa Lỗi "CONNECTING_TO_SERVER..."

## 🎯 Vấn đề
Sau khi sửa CORS, trang web hiển thị "CONNECTING_TO_SERVER..." mà không kết nối được.

## ✅ Nguyên Nhân & Cách Sửa

### 1. **Kiểm tra Server Node.js Đang Chạy**

```bash
# Mở terminal tại thư mục /server
cd g:\TK Web\final\server

# Khởi động server
npm start

# Hoặc
node server.js
```

**Kết quả mong đợi:**
```
Server running on http://localhost:5000
```

---

### 2. **Kiểm tra Port 5000 Có Bị Chiếm Không**

#### Windows (PowerShell - Run as Admin):
```powershell
# Xem process chiếm port 5000
Get-Process -Name node

# Hoặc
netstat -ano | findstr :5000

# Kill process (nếu cần)
Stop-Process -Id <PID> -Force
```

#### Mac/Linux:
```bash
# Xem process chiếm port 5000
lsof -i :5000

# Kill process (nếu cần)
kill -9 <PID>
```

---

### 3. **Kiểm tra API_BASE Trong Console**

Mở **DevTools** (F12) và chạy trong console:

```javascript
// Kiểm tra API Base được detect
console.log('API_BASE:', API_BASE);
console.log('Hostname:', window.location.hostname);
console.log('Protocol:', window.location.protocol);

// Kiểm tra CheapShark URL
console.log('SERVER_URL:', CheapSharkAPI.SERVER_URL);
console.log('PROXY_URL:', CheapSharkAPI.PROXY_URL);
console.log('useProxy:', CheapSharkAPI.useProxy);
```

---

### 4. **Kiểm tra Kết Nối Server**

Trong console, chạy:

```javascript
// Test kết nối tới server
fetch(`${API_BASE}/api/steam/featured`, {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Headers:', Object.fromEntries(r.headers));
  return r.json();
})
.then(data => console.log('Data:', data))
.catch(e => console.error('Error:', e));
```

**Kết quả:**
- ✅ Status: 200 = Server chạy tốt
- ❌ Status: 404 = Endpoint không tìm thấy
- ❌ CORS Error = Vấn đề CORS
- ❌ Network Error = Server không chạy

---

### 5. **Cấu Hình API Base Tự Động**

**Code tự detect được cập nhật:**

```javascript
function getAPIBase() {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  
  // Firebase
  if (hostname.includes('web.app') || hostname.includes('firebaseapp.com')) {
    return ''; // Same origin
  }
  
  // Localhost → Use local server on port 5000
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:5000`;
  }
  
  // Default to Firebase
  return 'https://nenonexus-digital-game-store.web.app';
}
```

---

## 🚀 Các Trường Hợp

### Trường Hợp 1: Chạy Localhost (Development)
```
✅ Nên chạy:
  - Frontend: http://localhost:8080 (hoặc port khác)
  - Server: http://localhost:5000
  
⚠️ Cách sửa:
  1. npm start (từ /server)
  2. Reload trang web
  3. Kiểm tra console: API_BASE phải là "http://localhost:5000"
```

### Trường Hợp 2: Chạy Firebase (Production)
```
✅ Nên chạy:
  - Frontend & Backend: https://nenonexus-digital-game-store.web.app
  
⚠️ Cách sửa:
  1. firebase deploy --only functions hosting
  2. Reload trang web
  3. Kiểm trap console: API_BASE phải là "" (same origin)
```

---

## 🔍 Debugging Checklist

- [ ] Server Node.js đang chạy trên port 5000
- [ ] Trang web tải được (không lỗi 404)
- [ ] Console DevTools hiển thị "API_BASE: http://localhost:5000" (local) hoặc "" (Firebase)
- [ ] CORS headers xuất hiện trong Network tab
- [ ] Fetch test trả về status 200
- [ ] Games danh sách tải được
- [ ] Không có lỗi trong console

---

## 📱 Lỗi Thông Dụng

### Lỗi 1: "Failed to fetch"
```
❌ Nguyên nhân: Server không chạy
✅ Cách sửa:
  1. npm start (từ /server)
  2. Reload trang
```

### Lỗi 2: "CORS Error"
```
❌ Nguyên nhân: CORS middleware chưa load
✅ Cách sửa:
  1. Chắc cors-config.js tồn tại
  2. Restart server
  3. Clear browser cache (Ctrl+Shift+Delete)
```

### Lỗi 3: "404 Not Found"
```
❌ Nguyên nhân: Endpoint không tồn tại
✅ Cách sửa:
  1. Kiểm tra server.js có endpoint /api/cheapshark
  2. Kiểm tra cors-config.js có được import
  3. Restart server
```

### Lỗi 4: "ERR_INVALID_PROTOCOL"
```
❌ Nguyên nhân: API_BASE format sai
✅ Cách sửa:
  1. Console check: console.log('API_BASE:', API_BASE)
  2. Phải bắt đầu với http:// hoặc https://
  3. Kiểm tra cors-client.js getAPIBase() function
```

---

## 💡 Mẹo

### Restart Everything
```bash
# 1. Kill server cũ (nếu còn chạy)
# Ctrl+C trong terminal

# 2. Clear cache
# Browser DevTools → Network → "Disable cache"

# 3. Restart server
npm start

# 4. Reload trang (Ctrl+F5 hard reload)
```

### Xem Request Details
```
1. Mở DevTools (F12)
2. Tab "Network"
3. Reload trang
4. Click vào request đầu tiên (example: games?...)
5. Xem "Response" tab để kiểm tra dữ liệu
6. Xem "Headers" tab để kiểm tra CORS
```

### Enable Verbose Logging
```javascript
// Chạy trong console để see log chi tiết
localStorage.setItem('DEBUG', 'true');
location.reload();
```

---

## 📋 Quick Start

**Để khởi động lại từ đầu:**

```bash
# 1. Terminal 1 - Server
cd g:\TK Web\final\server
npm install  # (nếu cần)
npm start

# 2. Terminal 2 - Firebase (tùy chọn)
cd g:\TK Web\final\firebase_build
firebase serve --only functions,hosting

# 3. Browser
# Local: http://localhost:5000
# Firebase: https://nenonexus-digital-game-store.web.app
```

---

## ✨ Files Được Sửa

- ✅ `API/index.js` - Smart API_BASE detection
- ✅ `API/cheapshark-api.js` - Smart SERVER_URL detection  
- ✅ `API/cors-client.js` - CORS wrapper (mới)
- ✅ `server/cors-config.js` - CORS middleware (mới)
- ✅ `firebase_build/functions/cors-config.js` - CORS config (mới)

---

**Nếu vẫn gặp lỗi, check console.log output và report error message!** 🚀
