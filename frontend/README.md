# Frontend (Vite + React)

Gồm 2 chế độ:
- **Built-in Wallet**: demo ví non-custodial, lưu vault mã hoá trong localStorage.
- **MetaMask DApp**: tương tác ERC-20 qua MetaMask.

## Cấu hình

Copy file [frontend/.env.example](frontend/.env.example) thành `frontend/.env`.

Biến môi trường quan trọng:
- `VITE_SEPOLIA_RPC_URLS` (1 hoặc nhiều RPC Sepolia, ngăn cách bằng dấu phẩy)
- `VITE_TOKEN_ADDRESS` (tuỳ chọn)

## Chạy

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`.
