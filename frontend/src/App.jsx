import { useState } from "react";
import "./App.css";
import MetamaskDapp from "./MetamaskDapp";
import BuiltInWallet from "./wallet/BuiltInWallet";

export default function App() {
  const [mode, setMode] = useState("wallet");

  return (
    <div className="app-shell">
      <div className="container">
        <div className="header">
          <div className="brand">
            <h1>Blockchain Wallet Demo</h1>
            <p>Built-in Wallet (local encrypted vault) + MetaMask DApp (Sepolia)</p>
          </div>

          <div className="tabs" role="tablist" aria-label="App mode">
            <button
              className={`tab ${mode === "wallet" ? "active" : ""}`}
              onClick={() => setMode("wallet")}
              type="button"
              role="tab"
              aria-selected={mode === "wallet"}
            >
              Built-in Wallet
            </button>
            <button
              className={`tab ${mode === "metamask" ? "active" : ""}`}
              onClick={() => setMode("metamask")}
              type="button"
              role="tab"
              aria-selected={mode === "metamask"}
            >
              MetaMask DApp
            </button>
          </div>
        </div>

        {mode === "wallet" ? <BuiltInWallet /> : <MetamaskDapp />}

        <div className="footer-note">
          Lưu ý: Built-in Wallet là demo học tập, seed phrase được mã hoá và lưu trên máy.
        </div>
      </div>
    </div>
  );
}