# Hướng Dẫn Deploy Lên Firebase

Hệ thống đã được chuẩn bị sẵn sàng trong thư mục `firebase_build`.

## Các bước thực hiện:

1.  **Mở Terminal** tại thư mục `final`:

    ```powershell
    cd "g:\TK Web\final\firebase_build"
    ```

2.  **Đăng nhập Firebase** (nếu chưa):

    ```powershell
    firebase login
    ```

3.  **Deploy toàn bộ (Hosting + Functions)**:
    ```powershell
    firebase deploy
    ```

## Lưu ý quan trọng:

- **Backend**: Mã nguồn server đã được chuyển thành Cloud Functions trong thư mục `functions`.
- **Frontend**: Mã nguồn web đã được copy vào `public`, nén (minify) và trỏ API về Cloud Functions tự động.
- **Biến môi trường**: File `.env` đã được copy từ server sang functions.

Nếu gặp lỗi `Error: missing bundle...`, hãy đảm bảo bạn đã login đúng tài khoản và project được chọn trong `.firebaserc` là chính xác.
Để chọn project: `firebase use default` (hoặc tên project của bạn).
