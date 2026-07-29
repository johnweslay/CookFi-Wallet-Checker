"use client";

import { useEffect, useState } from "react";
import { isAddress } from "viem";
import { PublicKey } from "@solana/web3.js";
import type { Mint } from "../lib/supabase";

function isValidSolanaAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export default function Home() {
  const [mints, setMints] = useState<Mint[]>([]);
  const [results, setResults] = useState<Record<string, { eligible: boolean; reason: string }>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [evmAddress, setEvmAddress] = useState("");
  const [solanaAddress, setSolanaAddress] = useState("");

  useEffect(() => {
    fetch("/api/mints")
      .then((r) => r.json())
      .then((d) => setMints(d.mints ?? []));
  }, []);

  async function checkEligibility(mint: Mint) {
    const isSolana = mint.chain === "solana";
    const wallet = isSolana ? solanaAddress.trim() : evmAddress.trim();

    if (!wallet) {
      alert(isSolana ? "Enter a Solana wallet address first." : "Enter an EVM wallet address first.");
      return;
    }
    if (isSolana && !isValidSolanaAddress(wallet)) {
      alert("That doesn't look like a valid Solana address.");
      return;
    }
    if (!isSolana && !isAddress(wallet)) {
      alert("That doesn't look like a valid EVM address.");
      return;
    }

    setChecking(mint.id);
    const res = await fetch("/api/check-eligibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mintId: mint.id, wallet }),
    });
    const data = await res.json();
    setResults((prev) => ({ ...prev, [mint.id]: data }));
    setChecking(null);
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>NFT Mint Eligibility Checker</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Enter your wallet address to check eligibility for upcoming and live mints — EVM and Solana.
        No wallet connection needed, this is a read-only lookup.
      </p>

      <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
        <label style={{ fontSize: "0.85rem", color: "#333" }}>
          EVM wallet address
          <input
            type="text"
            placeholder="0x..."
            value={evmAddress}
            onChange={(e) => setEvmAddress(e.target.value)}
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          />
        </label>
        <label style={{ fontSize: "0.85rem", color: "#333" }}>
          Solana wallet address
          <input
            type="text"
            placeholder="Solana address..."
            value={solanaAddress}
            onChange={(e) => setSolanaAddress(e.target.value)}
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          />
        </label>
      </section>

      <section>
        {mints.length === 0 && <p>No mints listed yet.</p>}
        {mints.map((mint) => (
          <div
            key={mint.id}
            style={{
              border: "1px solid #e2e2e2",
              borderRadius: 8,
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{mint.name}</strong>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  {mint.chain} · {mint.status}
                </div>
              </div>
              <button disabled={checking === mint.id} onClick={() => checkEligibility(mint)}>
                {checking === mint.id ? "Checking..." : "Check eligibility"}
              </button>
            </div>
            {results[mint.id] && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem 0.75rem",
                  borderRadius: 6,
                  background: results[mint.id].eligible ? "#e6f7ea" : "#fdeaea",
                  color: results[mint.id].eligible ? "#1a7f37" : "#c0392b",
                  fontSize: "0.9rem",
                }}
              >
                {results[mint.id].eligible ? "✅ Eligible" : "❌ Not eligible"} — {results[mint.id].reason}
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
