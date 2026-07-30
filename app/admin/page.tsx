"use client";

import { useState } from "react";

type PhaseForm = {
  name: string;
  requirement_type: "public" | "allowlist" | "holder_gate" | "team";
  price_display: string;
  per_wallet_limit: string;
  opens_at: string;
  phase_supply: string;
  gate_token_address: string;
  gate_min_balance: string;
};

function emptyPhase(): PhaseForm {
  return {
    name: "",
    requirement_type: "public",
    price_display: "Free",
    per_wallet_limit: "1",
    opens_at: "",
    phase_supply: "",
    gate_token_address: "",
    gate_min_balance: "1",
  };
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [form, setForm] = useState({
    name: "",
    chain: "ethereum",
    contract_address: "",
    mint_type: "unknown",
    source: "manual",
    source_url: "",
    website_url: "",
    twitter_url: "",
    image_url: "",
    total_supply: "",
    status: "upcoming",
  });
  const [phases, setPhases] = useState<PhaseForm[]>([emptyPhase()]);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [fetchingKey, setFetchingKey] = useState(false);
  const [openseaKeyResult, setOpenseaKeyResult] = useState<string | null>(null);

  const [existingChain, setExistingChain] = useState("robinhood");
  const [existingContract, setExistingContract] = useState("");
  const [existingPhases, setExistingPhases] = useState<PhaseForm[]>([emptyPhase()]);
  const [existingSubmitting, setExistingSubmitting] = useState(false);
  const [existingMessage, setExistingMessage] = useState<string | null>(null);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
  function updatePhase(index: number, field: keyof PhaseForm, value: string) {
    setPhases((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }
  function addPhase() {
    setPhases((prev) => [...prev, emptyPhase()]);
  }
  function removePhase(index: number) {
    setPhases((prev) => prev.filter((_, i) => i !== index));
  }

  function updateExistingPhase(index: number, field: keyof PhaseForm, value: string) {
    setExistingPhases((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }
  function addExistingPhase() {
    setExistingPhases((prev) => [...prev, emptyPhase()]);
  }
  function removeExistingPhase(index: number) {
    setExistingPhases((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitExistingPhases(e: React.FormEvent) {
    e.preventDefault();
    if (!secret) {
      alert("Enter the admin secret above first.");
      return;
    }
    setExistingSubmitting(true);
    setExistingMessage(null);

    const payloadPhases = existingPhases
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name,
        requirement_type: p.requirement_type,
        price_display: p.price_display || "Free",
        per_wallet_limit: Number(p.per_wallet_limit) || 1,
        opens_at: p.opens_at ? new Date(p.opens_at).toISOString() : null,
        phase_supply: p.phase_supply ? Number(p.phase_supply) : null,
        gate_token_address: p.requirement_type === "holder_gate" ? p.gate_token_address : null,
        gate_min_balance: Number(p.gate_min_balance) || 1,
      }));

    try {
      const res = await fetch("/api/mints/add-phases", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ chain: existingChain, contract_address: existingContract, phases: payloadPhases }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExistingMessage(`Error: ${data.error ?? "unknown error"}`);
      } else {
        setExistingMessage(`✅ Added ${data.phases_added} phase(s) to "${data.mint_name}".`);
        setExistingPhases([emptyPhase()]);
      }
    } catch {
      setExistingMessage("Network error — check the console.");
    } finally {
      setExistingSubmitting(false);
    }
  }

  async function getOpenSeaKey() {
    if (!secret) {
      alert("Enter the admin secret above first.");
      return;
    }
    setFetchingKey(true);
    setOpenseaKeyResult(null);
    try {
      const res = await fetch("/api/admin/opensea-key", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setOpenseaKeyResult(`Error: ${JSON.stringify(data.error ?? data)}`);
      } else {
        setOpenseaKeyResult(
          `Key: ${data.api_key}\nExpires: ${data.expires_at}\n\nCopy the "Key:" value above into OPENSEA_API_KEY in Vercel.`
        );
      }
    } catch {
      setOpenseaKeyResult("Network error — check the console.");
    } finally {
      setFetchingKey(false);
    }
  }

  async function syncOpenSea() {
    if (!secret) {
      alert("Enter the admin secret above first.");
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync/opensea", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncMessage(`Error: ${data.error ?? "unknown error"}`);
      } else {
        setSyncMessage(
          `✅ Synced ${data.synced} drop(s). ${data.skipped_chain ? `${data.skipped_chain} skipped (unsupported chain). ` : ""}${
            data.errors?.length ? `${data.errors.length} error(s):\n${data.errors.join("\n")}` : ""
          }`
        );
      }
    } catch {
      setSyncMessage("Network error — check the console.");
    } finally {
      setSyncing(false);
    }
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
    if (form.website_url) payload.website_url = form.website_url;
    if (form.twitter_url) payload.twitter_url = form.twitter_url;
    if (form.image_url) payload.image_url = form.image_url;
    if (form.total_supply) payload.total_supply = Number(form.total_supply);

    const submittedPhases = phases
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name,
        requirement_type: p.requirement_type,
        price_display: p.price_display || "Free",
        per_wallet_limit: Number(p.per_wallet_limit) || 1,
        opens_at: p.opens_at ? new Date(p.opens_at).toISOString() : null,
        phase_supply: p.phase_supply ? Number(p.phase_supply) : null,
        gate_token_address: p.requirement_type === "holder_gate" ? p.gate_token_address : null,
        gate_min_balance: Number(p.gate_min_balance) || 1,
      }));
    payload.phases = submittedPhases;

    try {
      const res = await fetch("/api/mints/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Error: ${data.error ?? "unknown error"}`);
      } else {
        setMessage(`✅ Added "${data.mint.name}" with ${submittedPhases.length} phase(s).`);
        setForm((prev) => ({ ...prev, name: "", contract_address: "", source_url: "", image_url: "" }));
        setPhases([emptyPhase()]);
      }
    } catch {
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
    marginBottom: "0.75rem",
    border: "1px solid #ccc",
    borderRadius: 6,
  };
  const labelStyle: React.CSSProperties = { fontSize: "0.85rem", color: "#333", fontWeight: 600 };
  const sectionStyle: React.CSSProperties = {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: "1rem",
    marginBottom: "1rem",
    background: "#fafafa",
  };

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui", background: "#fff", color: "#111", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Admin — Add a Mint</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        Calls /api/mints/add from the browser. Don't share this URL publicly.
      </p>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", background: "#fff8ea" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginTop: 0 }}>Get an OpenSea API Key</h2>
        <p style={{ fontSize: "0.85rem", color: "#555" }}>
          OpenSea's dashboard "Create key" flow requires collection trading volume this project doesn't have.
          This gets an instant free-tier key instead (no volume requirement, but expires in 30 days — fine to
          start with). Enter the admin secret above first, then tap below.
        </p>
        <button type="button" onClick={getOpenSeaKey} disabled={fetchingKey}>
          {fetchingKey ? "Fetching..." : "Get OpenSea instant key"}
        </button>
        {openseaKeyResult && (
          <pre style={{ marginTop: "0.75rem", fontSize: "0.8rem", whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#fff", padding: "0.75rem", borderRadius: 6, border: "1px solid #eee" }}>
            {openseaKeyResult}
          </pre>
        )}
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", background: "#f5f8ff" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginTop: 0 }}>OpenSea Sync</h2>
        <p style={{ fontSize: "0.85rem", color: "#555" }}>
          Runs automatically once a day. Use this to pull in new drops right now instead of waiting.
          Enter the admin secret above first.
        </p>
        <button type="button" onClick={syncOpenSea} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync from OpenSea now"}
        </button>
        {syncMessage && (
          <pre style={{ marginTop: "0.75rem", fontSize: "0.8rem", whiteSpace: "pre-wrap", wordBreak: "break-word", fontWeight: 600, fontFamily: "inherit" }}>
            {syncMessage}
          </pre>
        )}
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", background: "#f0fff4" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginTop: 0 }}>Add Phases to an Existing Mint</h2>
        <p style={{ fontSize: "0.85rem", color: "#555" }}>
          For mints already created (manually, or on a chain OpenSea sync doesn't cover — like Robinhood or Arc)
          that don't have phases yet. Find the mint by chain + contract address, exactly as it was entered.
        </p>
        <form onSubmit={submitExistingPhases}>
          <label style={labelStyle}>
            Chain
            <select style={inputStyle} value={existingChain} onChange={(e) => setExistingChain(e.target.value)}>
              <option value="ethereum">Ethereum</option>
              <option value="polygon">Polygon</option>
              <option value="base">Base</option>
              <option value="arbitrum">Arbitrum</option>
              <option value="robinhood">Robinhood Chain</option>
              <option value="arc">Arc (testnet only)</option>
              <option value="solana">Solana</option>
            </select>
          </label>
          <label style={labelStyle}>
            Contract address
            <input
              style={inputStyle}
              type="text"
              value={existingContract}
              onChange={(e) => setExistingContract(e.target.value)}
              required
            />
          </label>

          {existingPhases.map((phase, i) => (
            <div key={i} style={sectionStyle}>
              <label style={labelStyle}>
                Phase name
                <input
                  style={inputStyle}
                  type="text"
                  value={phase.name}
                  onChange={(e) => updateExistingPhase(i, "name", e.target.value)}
                  placeholder="e.g. GTD Phase"
                />
              </label>
              <label style={labelStyle}>
                Requirement type
                <select
                  style={inputStyle}
                  value={phase.requirement_type}
                  onChange={(e) => updateExistingPhase(i, "requirement_type", e.target.value)}
                >
                  <option value="public">Public — open to everyone once it opens</option>
                  <option value="allowlist">Allowlist — specific addresses (upload after saving)</option>
                  <option value="holder_gate">Holder-gate — must hold another NFT/token</option>
                  <option value="team">Team — internal allocation, not wallet-checkable</option>
                </select>
              </label>
              {phase.requirement_type === "holder_gate" && (
                <>
                  <label style={labelStyle}>
                    Gate token/collection address
                    <input
                      style={inputStyle}
                      type="text"
                      value={phase.gate_token_address}
                      onChange={(e) => updateExistingPhase(i, "gate_token_address", e.target.value)}
                    />
                  </label>
                  <label style={labelStyle}>
                    Minimum balance
                    <input
                      style={inputStyle}
                      type="number"
                      min="1"
                      value={phase.gate_min_balance}
                      onChange={(e) => updateExistingPhase(i, "gate_min_balance", e.target.value)}
                    />
                  </label>
                </>
              )}
              <label style={labelStyle}>
                Price (display text)
                <input
                  style={inputStyle}
                  type="text"
                  value={phase.price_display}
                  onChange={(e) => updateExistingPhase(i, "price_display", e.target.value)}
                  placeholder="Free or 0.001 ETH"
                />
              </label>
              <label style={labelStyle}>
                Per-wallet limit
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  value={phase.per_wallet_limit}
                  onChange={(e) => updateExistingPhase(i, "per_wallet_limit", e.target.value)}
                />
              </label>
              <label style={labelStyle}>
                Opens at
                <input
                  style={inputStyle}
                  type="datetime-local"
                  value={phase.opens_at}
                  onChange={(e) => updateExistingPhase(i, "opens_at", e.target.value)}
                />
              </label>
              <label style={labelStyle}>
                Phase supply (optional)
                <input
                  style={inputStyle}
                  type="number"
                  value={phase.phase_supply}
                  onChange={(e) => updateExistingPhase(i, "phase_supply", e.target.value)}
                />
              </label>
              {existingPhases.length > 1 && (
                <button type="button" onClick={() => removeExistingPhase(i)} style={{ color: "#c0392b" }}>
                  Remove this phase
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addExistingPhase} style={{ marginBottom: "1rem" }}>
            + Add another phase
          </button>
          <div>
            <button type="submit" disabled={existingSubmitting}>
              {existingSubmitting ? "Saving..." : "Save Phases to This Mint"}
            </button>
          </div>
        </form>
        {existingMessage && (
          <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", fontWeight: 600 }}>{existingMessage}</p>
        )}
        <p style={{ fontSize: "0.78rem", color: "#888", marginTop: "0.5rem" }}>
          Note: submitting replaces this mint's existing manually-added phases (not ones synced from OpenSea).
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>
          Admin Secret
          <input style={inputStyle} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} required />
        </label>

        <label style={labelStyle}>
          Mint name
          <input style={inputStyle} type="text" value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </label>

        <label style={labelStyle}>
          Chain
          <select style={inputStyle} value={form.chain} onChange={(e) => update("chain", e.target.value)}>
            <option value="ethereum">Ethereum</option>
            <option value="polygon">Polygon</option>
            <option value="base">Base</option>
            <option value="arbitrum">Arbitrum</option>
            <option value="robinhood">Robinhood Chain</option>
            <option value="arc">Arc (testnet only)</option>
            <option value="solana">Solana</option>
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
          <input style={inputStyle} type="text" value={form.source_url} onChange={(e) => update("source_url", e.target.value)} />
        </label>
        <label style={labelStyle}>
          Website URL (optional)
          <input style={inputStyle} type="text" value={form.website_url} onChange={(e) => update("website_url", e.target.value)} />
        </label>
        <label style={labelStyle}>
          Twitter/X URL (optional)
          <input style={inputStyle} type="text" value={form.twitter_url} onChange={(e) => update("twitter_url", e.target.value)} />
        </label>
        <label style={labelStyle}>
          Image URL (optional)
          <input style={inputStyle} type="text" value={form.image_url} onChange={(e) => update("image_url", e.target.value)} />
        </label>
        <label style={labelStyle}>
          Total supply (optional)
          <input style={inputStyle} type="number" value={form.total_supply} onChange={(e) => update("total_supply", e.target.value)} />
        </label>
        <label style={labelStyle}>
          Status
          <select style={inputStyle} value={form.status} onChange={(e) => update("status", e.target.value)}>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="ended">Ended</option>
          </select>
        </label>

        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "1.5rem" }}>Phases</h2>
        <p style={{ fontSize: "0.85rem", color: "#666" }}>
          Add one row per phase (Team, OG, GTD, FCFS, Public, etc). Order here is mint order.
        </p>

        {phases.map((phase, i) => (
          <div key={i} style={sectionStyle}>
            <label style={labelStyle}>
              Phase name
              <input style={inputStyle} type="text" value={phase.name} onChange={(e) => updatePhase(i, "name", e.target.value)} placeholder="e.g. GTD Phase" />
            </label>
            <label style={labelStyle}>
              Requirement type
              <select style={inputStyle} value={phase.requirement_type} onChange={(e) => updatePhase(i, "requirement_type", e.target.value)}>
                <option value="public">Public — open to everyone once it opens</option>
                <option value="allowlist">Allowlist — specific addresses (upload after saving)</option>
                <option value="holder_gate">Holder-gate — must hold another NFT/token</option>
                <option value="team">Team — internal allocation, not wallet-checkable</option>
              </select>
            </label>
            {phase.requirement_type === "holder_gate" && (
              <>
                <label style={labelStyle}>
                  Gate token/collection address
                  <input
                    style={inputStyle}
                    type="text"
                    value={phase.gate_token_address}
                    onChange={(e) => updatePhase(i, "gate_token_address", e.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Minimum balance
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    value={phase.gate_min_balance}
                    onChange={(e) => updatePhase(i, "gate_min_balance", e.target.value)}
                  />
                </label>
              </>
            )}
            <label style={labelStyle}>
              Price (display text)
              <input style={inputStyle} type="text" value={phase.price_display} onChange={(e) => updatePhase(i, "price_display", e.target.value)} placeholder="Free or 0.001 ETH" />
            </label>
            <label style={labelStyle}>
              Per-wallet limit
              <input style={inputStyle} type="number" min="1" value={phase.per_wallet_limit} onChange={(e) => updatePhase(i, "per_wallet_limit", e.target.value)} />
            </label>
            <label style={labelStyle}>
              Opens at
              <input style={inputStyle} type="datetime-local" value={phase.opens_at} onChange={(e) => updatePhase(i, "opens_at", e.target.value)} />
            </label>
            <label style={labelStyle}>
              Phase supply (optional)
              <input style={inputStyle} type="number" value={phase.phase_supply} onChange={(e) => updatePhase(i, "phase_supply", e.target.value)} />
            </label>
            {phases.length > 1 && (
              <button type="button" onClick={() => removePhase(i)} style={{ color: "#c0392b" }}>
                Remove this phase
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addPhase} style={{ marginBottom: "1.5rem" }}>
          + Add another phase
        </button>

        <div>
          <button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add Mint"}
          </button>
        </div>
      </form>

      {message && (
        <p style={{ marginTop: "1rem", fontWeight: 600, color: message.startsWith("Error") ? "#c0392b" : "#1a7f37" }}>
          {message}
        </p>
      )}

      <p style={{ marginTop: "2rem", fontSize: "0.8rem", color: "#999" }}>
        For allowlist-type phases, save the mint first, then use POST /api/phases/allowlist with{" "}
        {"{ phaseId, addresses: [...] }"} to upload the wallet list for that phase.
      </p>
    </main>
  );
}
