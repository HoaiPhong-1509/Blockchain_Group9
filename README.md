# Blockchain_Nhom9

Repo gồm 2 phần:
- **Frontend (Vite + React)**: tab **Built-in Wallet** (demo non-custodial, lưu localStorage + mã hoá) và tab **MetaMask DApp**.
- **Hardhat**: hợp đồng mẫu + scripts/test.

## Yêu cầu
- Node.js (khuyên dùng LTS: 18/20)
- npm

## Chạy frontend sau khi clone

### 1) Cài dependencies

```bash
npm install
npm --prefix frontend install
```

### 2) Tạo file môi trường cho frontend

Copy file mẫu [frontend/.env.example](frontend/.env.example) thành `frontend/.env` rồi điền giá trị phù hợp.

Ví dụ:

```bash
# Windows PowerShell
Copy-Item frontend\.env.example frontend\.env
```

### 3) Run

```bash
npm run dev
```

Mở `http://localhost:5173`.

## Build frontend

```bash
npm run build
```

## Deploy frontend (GitHub Pages)

Repo đã có workflow GitHub Actions để deploy frontend lên GitHub Pages.

Các bước trên GitHub:
- Vào **Settings → Pages**
- **Build and deployment**: chọn **Source = GitHub Actions**
- Push lên nhánh `main` (workflow sẽ tự build và publish)

Sau khi chạy xong workflow, trang sẽ có dạng:
`https://<username>.github.io/<repo>/`

## Hardhat (tuỳ chọn)

### Compile/Test

```bash
npx hardhat compile
npx hardhat test
```

### Deploy (Sepolia)

Tạo file `.env` ở thư mục root (KHÔNG commit lên GitHub):

```dotenv
SEPOLIA_RPC_URL=...
PRIVATE_KEY=...
```

Sau đó deploy theo module:

```bash
npx hardhat ignition deploy ./ignition/modules/Lock.js --network sepolia
```

Lưu ý: ví của `PRIVATE_KEY` cần có SepoliaETH để trả gas.

## Lưu ý bảo mật
- Không commit `.env` (repo đã ignore).
- Built-in Wallet chỉ là demo học tập, không dùng giữ tiền thật.
