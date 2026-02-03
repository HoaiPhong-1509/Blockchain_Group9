import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { ERC20_ABI } from "./erc20Abi";

const DEFAULT_TOKEN_ADDRESS = "0xDc434C7D3CB8487285d8694e77692B5804513d87";
const SEPOLIA_CHAIN_ID = 11155111;

export default function MetamaskDapp() {
  const [error, setError] = useState("");
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);

  const [name, setName] = useState("-");
  const [symbol, setSymbol] = useState("-");
  const [decimals, setDecimals] = useState(18);
  const [balance, setBalance] = useState("-");

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("1");
  const [txHash, setTxHash] = useState("");

  const hasMM = typeof window !== "undefined" && window.ethereum;
  const tokenAddress = import.meta.env.VITE_TOKEN_ADDRESS || DEFAULT_TOKEN_ADDRESS;

  const provider = useMemo(() => {
    if (!hasMM) return null;
    return new ethers.BrowserProvider(window.ethereum);
  }, [hasMM]);

  async function connect() {
    try {
      setError("");
      if (!provider) throw new Error("Bạn chưa cài MetaMask.");

      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      setAccount(await signer.getAddress());
      const net = await provider.getNetwork();
      setChainId(Number(net.chainId));
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  async function refresh() {
    try {
      setError("");
      if (!provider) throw new Error("Chưa có provider.");
      if (!account) throw new Error("Hãy Connect wallet trước.");

      const net = await provider.getNetwork();
      setChainId(Number(net.chainId));

      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [n, s, d, bal] = await Promise.all([
        token.name(),
        token.symbol(),
        token.decimals(),
        token.balanceOf(account),
      ]);

      setName(n);
      setSymbol(s);
      setDecimals(Number(d));
      setBalance(ethers.formatUnits(bal, d));
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  async function send() {
    try {
      setError("");
      setTxHash("");

      if (!provider) throw new Error("Chưa có provider.");
      if (!account) throw new Error("Hãy Connect wallet trước.");
      if (!ethers.isAddress(to)) throw new Error("Địa chỉ nhận (to) không hợp lệ.");

      const net = await provider.getNetwork();
      if (Number(net.chainId) !== SEPOLIA_CHAIN_ID) {
        throw new Error("Hãy chuyển MetaMask sang mạng Sepolia (chainId 11155111).");
      }

      const signer = await provider.getSigner();
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const value = ethers.parseUnits(amount || "0", decimals);
      const tx = await token.transfer(to, value);
      setTxHash(tx.hash);

      await tx.wait();
      await refresh();
    } catch (e) {
      setError(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    if (!hasMM) return;

    const onAccountsChanged = (accs) => {
      setAccount(accs?.[0] || "");
      setTxHash("");
    };

    const onChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged", onChainChanged);
    };
  }, [hasMM]);

  return (
    <div className="page">
      <div className="page-title">
        <h2>MetaMask DApp</h2>
        <div className="pill">
          <span>Network</span>
          <b>Sepolia</b>
        </div>
      </div>

      {!hasMM && (
        <div className="error-banner">
          Bạn chưa cài MetaMask. Hãy cài MetaMask để dùng DApp.
        </div>
      )}

      <div className="card">
        <div className="row">
          <button className="btn-primary" onClick={connect} disabled={!hasMM}>
            Connect Wallet
          </button>
          <button onClick={refresh} disabled={!account}>
            Load token / balance
          </button>
        </div>

        <div style={{ marginTop: 12, lineHeight: 1.7, textAlign: "left" }}>
          <div>
            <b>Account:</b> {account || "-"}
          </div>
          <div>
            <b>ChainId:</b> {chainId ?? "-"}
          </div>
          <div className="muted" style={{ wordBreak: "break-all" }}>
            <b>Token:</b> {tokenAddress}
          </div>
          <div>
            <b>Name:</b> {name}
          </div>
          <div>
            <b>Symbol:</b> {symbol}
          </div>
          <div>
            <b>Balance:</b> {balance}
          </div>
        </div>
      </div>

      <div className="card" style={{ textAlign: "left" }}>
        <div className="stack" style={{ maxWidth: 680, margin: "0 auto" }}>
          <h3 style={{ margin: 0 }}>Transfer ERC-20</h3>
          <input placeholder="To address: 0x..." value={to} onChange={(e) => setTo(e.target.value)} />
          <input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn-primary" onClick={send} disabled={!account}>
            Send {symbol !== "-" ? symbol : "token"}
          </button>

          {txHash && (
            <div>
              <b>Tx hash:</b>{" "}
              <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
                {txHash}
              </a>
            </div>
          )}

          {error && (
            <div className="error-banner">
              <b>Error:</b> {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
