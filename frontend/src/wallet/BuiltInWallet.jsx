import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { ERC20_ABI } from "../erc20Abi";
import {
  clearLegacyData,
  clearAllLocalData,
  createAccount,
  deleteAccount,
  exportAccountBackup,
  hasAccount,
  importAccountBackup,
  listLocalAccounts,
  loadVault,
  saveVault,
} from "./cryptoStore";

const SEPOLIA_CHAIN_ID = 11155111;
const DEFAULT_TOKEN_ADDRESS = "0xDc434C7D3CB8487285d8694e77692B5804513d87";
const DEFAULT_SEPOLIA_RPC_URLS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.sepolia.org",
];

function shortAddr(a) {
  if (!a) return "";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeTrim(s) {
  return (s || "").trim();
}

export default function BuiltInWallet() {
  const [error, setError] = useState("");
  const [screen, setScreen] = useState("auth"); // auth | vault

  useEffect(() => {
    // One-time cleanup: remove leftover legacy single-wallet storage.
    clearLegacyData();
  }, []);

  const [accounts, setAccounts] = useState(() => listLocalAccounts());
  const [username, setUsername] = useState(() => listLocalAccounts()[0] || "");

  const [loginPassword, setLoginPassword] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPassword2, setRegisterPassword2] = useState("");

  const [sessionPassword, setSessionPassword] = useState("");
  const [vault, setVault] = useState(null);

  const [selectedWalletId, setSelectedWalletId] = useState(null);

  const [ethBalance, setEthBalance] = useState("-");
  const [tokenMeta, setTokenMeta] = useState({ name: "-", symbol: "-", decimals: 18 });
  const [tokenBalance, setTokenBalance] = useState("-");
  const [chainId, setChainId] = useState(null);
  const [txHash, setTxHash] = useState("");

  const [to, setTo] = useState("");
  const [ethAmount, setEthAmount] = useState("0.001");
  const [tokenAmount, setTokenAmount] = useState("1");

  const [walletMode, setWalletMode] = useState("none"); // none | create | import
  const [draftName, setDraftName] = useState("");
  const [draftMnemonic, setDraftMnemonic] = useState("");
  const [savedConfirm, setSavedConfirm] = useState(false);

  const [backupOverwrite, setBackupOverwrite] = useState(false);

  const [backupFileKey, setBackupFileKey] = useState(0);

  const rpcUrlsRaw = import.meta.env.VITE_SEPOLIA_RPC_URLS;
  const rpcUrlSingle = import.meta.env.VITE_SEPOLIA_RPC_URL;
  const tokenAddress = import.meta.env.VITE_TOKEN_ADDRESS || DEFAULT_TOKEN_ADDRESS;

  const provider = useMemo(() => {
    const urls = (rpcUrlsRaw || rpcUrlSingle || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const effectiveUrls = urls.length > 0 ? urls : DEFAULT_SEPOLIA_RPC_URLS;

    if (effectiveUrls.length === 1) return new ethers.JsonRpcProvider(effectiveUrls[0]);

    const providers = effectiveUrls.map((u) => new ethers.JsonRpcProvider(u));
    return new ethers.FallbackProvider(providers);
  }, [rpcUrlsRaw, rpcUrlSingle]);

  const wallets = useMemo(() => vault?.wallets ?? [], [vault]);

  const activeWallet = useMemo(() => {
    if (!vault) return null;
    const id = selectedWalletId || vault.selectedWalletId;
    return wallets.find((w) => w.id === id) || wallets[0] || null;
  }, [vault, wallets, selectedWalletId]);

  const activeEthersWallet = useMemo(() => {
    if (!activeWallet?.mnemonic) return null;
    try {
      return ethers.Wallet.fromPhrase(activeWallet.mnemonic);
    } catch {
      return null;
    }
  }, [activeWallet]);

  const address = activeEthersWallet?.address || "";

  function resetRuntimeBalances() {
    setEthBalance("-");
    setTokenBalance("-");
    setTokenMeta({ name: "-", symbol: "-", decimals: 18 });
    setChainId(null);
    setTxHash("");
  }

  function refreshAccountsList(nextSelected) {
    const list = listLocalAccounts();
    setAccounts(list);
    if (typeof nextSelected === "string") setUsername(nextSelected);
    else if (list.length > 0 && !list.includes(username)) setUsername(list[0]);
  }

  function wipeAllLocalData() {
    try {
      setError("");
      const ok = window.confirm(
        "Bạn có chắc muốn XÓA TOÀN BỘ accounts/vault đang lưu trên máy (localStorage)?\n\nHành động này không thể hoàn tác nếu bạn không có seed phrase/backup."
      );
      if (!ok) return;

      const removed = clearAllLocalData();

      // Reset UI state
      setScreen("auth");
      setVault(null);
      setSessionPassword("");
      setSelectedWalletId(null);
      setUsername("");
      setLoginPassword("");
      resetRuntimeBalances();
      refreshAccountsList("");

      setError(removed > 0 ? `Đã xoá ${removed} mục dữ liệu local.` : "Không có dữ liệu local để xoá.");
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  async function onRegister() {
    try {
      setError("");
      const u = safeTrim(username);
      if (!u) throw new Error("Username trống.");
      if (!registerPassword || registerPassword.length < 8) throw new Error("Mật khẩu tối thiểu 8 ký tự.");
      if (registerPassword !== registerPassword2) throw new Error("Mật khẩu nhập lại không khớp.");
      await createAccount({ username: u, password: registerPassword });
      refreshAccountsList(u);
      setLoginPassword(registerPassword);
      await onLogin(registerPassword);
      setRegisterPassword("");
      setRegisterPassword2("");
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  async function onLogin(pwOverride) {
    try {
      setError("");
      setTxHash("");

      const u = safeTrim(username);
      if (!u) throw new Error("Username trống.");
      const pw = pwOverride ?? loginPassword;
      if (!pw) throw new Error("Password trống.");
      if (!hasAccount(u)) throw new Error("Account không tồn tại trên máy.");

      const v = await loadVault({ username: u, password: pw });

      const selected = v.selectedWalletId || v.wallets?.[0]?.id || null;
      v.selectedWalletId = selected;

      setVault(v);
      setSessionPassword(pw);
      setSelectedWalletId(selected);
      resetRuntimeBalances();
      setScreen("vault");
      setWalletMode("none");
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  async function persistVault(nextVault) {
    if (!nextVault) return;
    await saveVault({ username, password: sessionPassword, vault: nextVault });
    setVault(nextVault);
  }

  async function chooseWallet(id) {
    try {
      setError("");
      if (!vault) return;
      const next = { ...vault, selectedWalletId: id };
      setSelectedWalletId(id);
      await persistVault(next);
      resetRuntimeBalances();
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  function startCreateWallet() {
    setError("");
    const w = ethers.Wallet.createRandom();
    const phrase = w.mnemonic?.phrase;
    setWalletMode("create");
    setDraftMnemonic(phrase || "");
    setDraftName(`Wallet ${wallets.length + 1}`);
    setSavedConfirm(false);
  }

  function startImportWallet() {
    setError("");
    setWalletMode("import");
    setDraftMnemonic("");
    setDraftName(`Wallet ${wallets.length + 1}`);
    setSavedConfirm(false);
  }

  async function addWalletToAccount() {
    try {
      setError("");
      if (!vault) throw new Error("Chưa đăng nhập.");
      const phrase = safeTrim(draftMnemonic);
      if (!phrase) throw new Error("Mnemonic trống.");
      if (!savedConfirm) throw new Error("Hãy xác nhận bạn đã lưu seed phrase.");

      let w;
      try {
        w = ethers.Wallet.fromPhrase(phrase);
      } catch {
        throw new Error("Mnemonic không hợp lệ.");
      }

      const entry = {
        id: newId(),
        name: safeTrim(draftName) || shortAddr(w.address),
        mnemonic: phrase,
        createdAt: Date.now(),
      };

      const nextVault = {
        ...vault,
        wallets: [...vault.wallets, entry],
        selectedWalletId: entry.id,
      };

      await persistVault(nextVault);
      setSelectedWalletId(entry.id);
      setWalletMode("none");
      setDraftMnemonic("");
      setDraftName("");
      setSavedConfirm(false);
      resetRuntimeBalances();
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  async function deleteWalletFromAccount(id) {
    try {
      setError("");
      if (!vault) return;
      const remaining = vault.wallets.filter((w) => w.id !== id);
      const nextSelected = remaining[0]?.id || null;
      const nextVault = {
        ...vault,
        wallets: remaining,
        selectedWalletId: nextSelected,
      };
      await persistVault(nextVault);
      setSelectedWalletId(nextSelected);
      resetRuntimeBalances();
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  const refreshBalances = useCallback(async () => {
    try {
      setError("");
      if (!activeEthersWallet) throw new Error("Chưa chọn ví.");

      const [net, ethBal] = await Promise.all([
        provider.getNetwork(),
        provider.getBalance(activeEthersWallet.address),
      ]);

      setChainId(Number(net.chainId));
      setEthBalance(ethers.formatEther(ethBal));

      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [name, symbol, decimals, bal] = await Promise.all([
        token.name(),
        token.symbol(),
        token.decimals(),
        token.balanceOf(activeEthersWallet.address),
      ]);

      setTokenMeta({ name, symbol, decimals: Number(decimals) });
      setTokenBalance(ethers.formatUnits(bal, decimals));
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }, [activeEthersWallet, provider, tokenAddress]);

  useEffect(() => {
    if (screen !== "vault") return;
    if (!provider || !activeEthersWallet) return;
    refreshBalances();
  }, [screen, provider, activeEthersWallet, tokenAddress, refreshBalances]);

  async function sendEth() {
    try {
      setError("");
      setTxHash("");
      if (!activeEthersWallet) throw new Error("Chưa chọn ví.");
      if (!ethers.isAddress(to)) throw new Error("Địa chỉ nhận không hợp lệ.");

      const net = await provider.getNetwork();
      if (Number(net.chainId) !== SEPOLIA_CHAIN_ID) {
        throw new Error("RPC hiện không phải Sepolia (chainId 11155111).");
      }

      const signer = activeEthersWallet.connect(provider);
      const tx = await signer.sendTransaction({
        to,
        value: ethers.parseEther(ethAmount || "0"),
      });

      setTxHash(tx.hash);
      await tx.wait();
      await refreshBalances();
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  async function sendToken() {
    try {
      setError("");
      setTxHash("");
      if (!activeEthersWallet) throw new Error("Chưa chọn ví.");
      if (!ethers.isAddress(to)) throw new Error("Địa chỉ nhận không hợp lệ.");

      const net = await provider.getNetwork();
      if (Number(net.chainId) !== SEPOLIA_CHAIN_ID) {
        throw new Error("RPC hiện không phải Sepolia (chainId 11155111).");
      }

      const signer = activeEthersWallet.connect(provider);
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const value = ethers.parseUnits(tokenAmount || "0", tokenMeta.decimals);

      const tx = await token.transfer(to, value);
      setTxHash(tx.hash);
      await tx.wait();

      await refreshBalances();
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  function logout() {
    setError("");
    setScreen("auth");
    setSessionPassword("");
    setVault(null);
    setSelectedWalletId(null);
    setLoginPassword("");
    resetRuntimeBalances();
    setWalletMode("none");
    setDraftMnemonic("");
    setDraftName("");
    setSavedConfirm(false);
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onExportBackup() {
    try {
      setError("");
      const u = safeTrim(username);
      const backup = exportAccountBackup(u);
      downloadJson(`${backup.username}_backup.json`, backup);
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  async function onImportBackupFile(file) {
    try {
      setError("");
      if (!file) return;
      const text = await file.text();
      let backup;
      try {
        backup = JSON.parse(text);
      } catch {
        throw new Error("File không phải JSON hợp lệ.");
      }

      const importedUsername = importAccountBackup({ backup, overwrite: backupOverwrite });
      refreshAccountsList(importedUsername);
      setUsername(importedUsername);
      setLoginPassword("");
      setBackupFileKey((k) => k + 1);
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  return (
    <div style={{ fontFamily: "system-ui" }}>
      <h2>Built-in Wallet (Accounts + Multi-wallet, Sepolia)</h2>

      {!rpcUrlsRaw && !rpcUrlSingle && (
        <div style={{ marginBottom: 12, opacity: 0.8, fontSize: 12, lineHeight: 1.4 }}>
          Chưa cấu hình <b>VITE_SEPOLIA_RPC_URLS</b>/<b>VITE_SEPOLIA_RPC_URL</b> — app sẽ dùng RPC public mặc định.
        </div>
      )}

      {screen === "auth" && (
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "left" }}>
          <p>
            Tài khoản và ví được lưu <b>cục bộ trên trình duyệt</b> (localStorage) và được <b>mã hoá</b> bằng mật khẩu.
            Đây là demo học tập — đừng dùng để giữ tiền thật.
          </p>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: 16 }}>
              <h3>Đăng nhập</h3>
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username (vd: nhom9)"
                />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Password"
                />
                <button onClick={() => onLogin()} disabled={!safeTrim(username)}>
                  Login
                </button>

                {accounts.length > 0 && (
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Accounts trên máy: {accounts.join(", ")}
                  </div>
                )}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: 16 }}>
              <h3>Tạo account</h3>
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username (a-z,0-9,_ . -; 3-32 ký tự)"
                />
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="Password (≥ 8 ký tự)"
                />
                <input
                  type="password"
                  value={registerPassword2}
                  onChange={(e) => setRegisterPassword2(e.target.value)}
                  placeholder="Nhập lại password"
                />
                <button onClick={onRegister} disabled={!safeTrim(username)}>
                  Create account
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: 16 }}>
            <h3>Backup/Restore (1 account)</h3>
            <div style={{ display: "grid", gap: 8, maxWidth: 620 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={backupOverwrite}
                  onChange={(e) => setBackupOverwrite(e.target.checked)}
                />
                Overwrite nếu account đã tồn tại
              </label>

              <input
                key={backupFileKey}
                type="file"
                accept="application/json"
                onChange={(e) => onImportBackupFile(e.target.files?.[0])}
              />

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Import backup sẽ khôi phục vault đã mã hoá; bạn vẫn cần password để Login.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, border: "1px solid rgba(220,0,0,0.35)", borderRadius: 12, padding: 16 }}>
            <h3>Xoá dữ liệu local</h3>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
              Nút này sẽ xoá toàn bộ accounts/vault đã lưu trong localStorage của ứng dụng trên máy này.
            </div>
            <button onClick={wipeAllLocalData} style={{ borderColor: "crimson" }}>
              Xoá tất cả accounts trên máy
            </button>
          </div>
        </div>
      )}

      {screen === "vault" && (
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ textAlign: "left" }}>
              <div>
                <b>Account:</b> {safeTrim(username) || "-"}
              </div>
              <div>
                <b>Wallet:</b> {activeWallet?.name || "-"}
              </div>
              <div>
                <b>Address:</b> {address || "-"} {address ? `(${shortAddr(address)})` : ""}
              </div>
              <div>
                <b>ChainId:</b> {chainId ?? "-"}
              </div>
              <div>
                <b>ETH:</b> {ethBalance}
              </div>
              <div>
                <b>Token:</b> {tokenMeta.symbol} — {tokenBalance}
              </div>
              <div style={{ opacity: 0.8, fontSize: 12 }}>
                Token address: {tokenAddress}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap" }}>
              <button onClick={refreshBalances} disabled={!activeEthersWallet}>
                Refresh
              </button>
              <button onClick={onExportBackup}>Export backup</button>
              <button onClick={logout}>Logout</button>
              <button
                onClick={() => {
                  if (window.confirm("Xoá account khỏi máy? Không thể khôi phục nếu bạn mất seed phrase.")) {
                    deleteAccount(username);
                    refreshAccountsList();
                    logout();
                  }
                }}
                style={{ borderColor: "crimson" }}
              >
                Delete account
              </button>
            </div>
          </div>

          <hr style={{ margin: "16px 0" }} />

          <div style={{ display: "grid", gap: 12, textAlign: "left" }}>
            <div>
              <h3>Wallets trong account</h3>
              {wallets.length === 0 && <div style={{ opacity: 0.75 }}>Chưa có wallet nào. Hãy tạo/import bên dưới.</div>}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {wallets.map((w) => (
                  <div key={w.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      onClick={() => chooseWallet(w.id)}
                      style={{
                        borderColor: (activeWallet?.id === w.id) ? "#646cff" : undefined,
                      }}
                    >
                      {w.name}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Xoá ví '${w.name}' khỏi account?`)) deleteWalletFromAccount(w.id);
                      }}
                      style={{ borderColor: "crimson" }}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={startCreateWallet}>Create wallet</button>
              <button onClick={startImportWallet}>Import wallet</button>
              {walletMode !== "none" && (
                <button
                  onClick={() => {
                    setWalletMode("none");
                    setDraftMnemonic("");
                    setDraftName("");
                    setSavedConfirm(false);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            {walletMode !== "none" && (
              <div style={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: 12 }}>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>
                  {walletMode === "create" ? "Tạo ví mới" : "Import ví"}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Tên ví (vd: ví phụ, ví test...)"
                  />
                  <textarea
                    rows={3}
                    value={draftMnemonic}
                    onChange={(e) => setDraftMnemonic(e.target.value)}
                    readOnly={walletMode === "create"}
                    style={{ width: "100%" }}
                    placeholder={walletMode === "create" ? "Mnemonic sẽ hiện ở đây" : "Nhập mnemonic 12/24 từ"}
                  />

                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={savedConfirm}
                      onChange={(e) => setSavedConfirm(e.target.checked)}
                    />
                    Tôi đã lưu seed phrase ở nơi an toàn.
                  </label>

                  <button onClick={addWalletToAccount}>
                    Add wallet to account
                  </button>
                </div>
              </div>
            )}
          </div>

          <hr style={{ margin: "16px 0" }} />

          <div style={{ display: "grid", gap: 8, maxWidth: 720, margin: "0 auto" }}>
            <h3>Send ETH</h3>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To address: 0x..." />
            <input value={ethAmount} onChange={(e) => setEthAmount(e.target.value)} placeholder="Amount ETH" />
            <button onClick={sendEth} disabled={!activeEthersWallet}>Send ETH</button>

            <h3 style={{ marginTop: 12 }}>Send ERC-20</h3>
            <input value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} placeholder={`Amount ${tokenMeta.symbol || "token"}`} />
            <button onClick={sendToken} disabled={!activeEthersWallet}>Send {tokenMeta.symbol || "token"}</button>

            {txHash && (
              <div>
                <b>Tx hash:</b>{" "}
                <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
                  {txHash}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: "crimson", marginTop: 12 }}>
          <b>Error:</b> {error}
        </div>
      )}
    </div>
  );
}
