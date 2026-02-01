import { useState } from "react";
import "./App.css";
import MetamaskDapp from "./MetamaskDapp";
import BuiltInWallet from "./wallet/BuiltInWallet";

export default function App() {
  const [mode, setMode] = useState("wallet");

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setMode("wallet")}>Built-in Wallet</button>
        <button onClick={() => setMode("metamask")}>MetaMask DApp</button>
      </div>

      {mode === "wallet" ? <BuiltInWallet /> : <MetamaskDapp />}

      <div style={{ marginTop: 18, opacity: 0.75, fontSize: 12, lineHeight: 1.5 }}>
        Lưu ý: Built-in Wallet là demo học tập, seed phrase được mã hoá và lưu trên máy.
      </div>
    </div>
  );
}