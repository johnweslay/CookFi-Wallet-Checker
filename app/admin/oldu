"use client";

import { useState } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [form, setForm] = useState({
    name: "",
    chain: "ethereum",
    contract_address: "",
    mint_type: "unknown",
    source: "manual",
    source_url: "",
    gate_token_address: "",
    gate_min_balance: "1",
    mint_start: "",
    mint_end: "",
    status: "upcoming",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      chain: form.chain,
      contract_address: form.contract_address,
      mint_type: form.mint_type,
      source: form.source || "manual",
      status: form.status,
    };
    if (form.source_url) payload.source_url = form.source_url;
    if (form.gate_token_address) payload.gate_token_address = form.gate_token_address;
    if (form.gate_token_address) payload.gate_min_balance = Number(form.gate_min_balance) || 1;
    if (form.mint_start) payload.mint_start = new Date(form.mint_start).toISOString();
    if (form.mint_end) payload.mint_end = new Date(form.mint_end).toISOString();

    try {
      const res = await fetch("/api/mints/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Error: ${data.error ?? "unknown error"}`);
      } else {
        setMessage(`✅ Added "${data.mint.name}" successfully.`);
        setForm((prev) => ({ ...prev, name: "", contract_address: "", source_url: "" }));
      }
    } catch (err) {
      setMessage("Network error — check the console.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "0.5rem",
    marginTop: "0.25rem",
    marginBottom: "1rem",
    border: "1px solid #ccc",
    borderRadius: 6,
  };
  const labelStyle: React.CSSProperties = { fontSize: "0.85rem", color: "#333", fontWeight: 600 };

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Admin — Add a Mint</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        This page just calls the existing /api/mints/add route from the browser — same as curl would,
        no admin auth beyond the secret below. Don't share this URL publicly.
      </p>

      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>
          Admin Secret
          <input
            style={inputStyle}
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            required
          />
        </label>

        <label style={labelStyle}>
          Mint name
          <input
            style={inputStyle}
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
        </label>

        <label style={labelStyle}>
          Chain
          <select style={inputStyle} value={form.chain} onChange={(e) => update("chain", e.target.value)}>
            <option value="ethereum">Ethereum</option>
            <option value="polygon">Polygon</option>
            <option value="base">Base</option>
            <option value="arbitrum">Arbitrum</option>
            <option value="solana">Solana</option>
            <option value="arc">Arc</option>
            <option value="robinhood">Robinhood</option>
          </select>
        </label>

        <label style={labelStyle}>
          Contract address {form.chain === "solana" ? "(Candy Machine ID)" : "(drop contract)"}
          <input
            style={inputStyle}
            type="text"
            value={form.contract_address}
            onChange={(e) => update("contract_address", e.target.value)}
            required
          />
        </label>

        <label style={labelStyle}>
          Mint type
          <select style={inputStyle} value={form.mint_type} onChange={(e) => update("mint_type", e.target.value)}>
            <option value="unknown">Unknown</option>
            <option value="thirdweb_drop">Thirdweb Drop (EVM)</option>
            <option value="manifold">Manifold (EVM)</option>
            <option value="highlight">Highlight (EVM)</option>
            <option value="seaport_drop">Seaport Drop (EVM)</option>
            <option value="candy_machine_v3">Candy Machine v3 (Solana)</option>
          </select>
        </label>

        <label style={labelStyle}>
          Source
          <select style={inputStyle} value={form.source} onChange={(e) => update("source", e.target.value)}>
            <option value="manual">Manual</option>
            <option value="opensea">OpenSea</option>
            <option value="magiceden">Magic Eden</option>
            <option value="launchmynft">LaunchMyNFT</option>
          </select>
        </label>

        <label style={labelStyle}>
          Source URL (optional)
          <input
            style={inputStyle}
            type="text"
            value={form.source_url}
            onChange={(e) => update("source_url", e.target.value)}
          />
        </label>

        <label style={labelStyle}>
          Holder-gate token/collection address (optional)
          <input
            style={inputStyle}
            type="text"
            value={form.gate_token_address}
            onChange={(e) => update("gate_token_address", e.target.value)}
          />
        </label>

        {form.gate_token_address && (
          <label style={labelStyle}>
            Minimum balance required
            <input
              style={inputStyle}
              type="number"
              min="1"
              value={form.gate_min_balance}
              onChange={(e) => update("gate_min_balance", e.target.value)}
            />
          </label>
        )}

        <label style={labelStyle}>
          Mint start (optional)
          <input
            style={inputStyle}
            type="datetime-local"
            value={form.mint_start}
            onChange={(e) => update("mint_start", e.target.value)}
          />
        </label>

        <label style={labelStyle}>
          Mint end (optional)
          <input
            style={inputStyle}
            type="datetime-local"
            value={form.mint_end}
            onChange={(e) => update("mint_end", e.target.value)}
          />
        </label>

        <label style={labelStyle}>
          Status
          <select style={inputStyle} value={form.status} onChange={(e) => update("status", e.target.value)}>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="ended">Ended</option>
          </select>
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? "Adding..." : "Add Mint"}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: "1rem", fontWeight: 600, color: message.startsWith("Error") ? "#c0392b" : "#1a7f37" }}>
          {message}
        </p>
      )}
    </main>
  );
}
