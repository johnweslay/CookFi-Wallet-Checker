"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";
import { PublicKey } from "@solana/web3.js";
import type { Mint, PhaseEligibility } from "../lib/supabase";

function isValidSolanaAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function shortAddr(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

function explorerUrl(chain: Mint["chain"], address: string) {
  const map: Record<Mint["chain"], string> = {
    ethereum: `https://etherscan.io/address/${address}`,
    polygon: `https://polygonscan.com/address/${address}`,
    base: `https://basescan.org/address/${address}`,
    arbitrum: `https://arbiscan.io/address/${address}`,
    robinhood: `https://robinhoodchain.blockscout.com/address/${address}`,
    arc: `https://testnet.arcscan.app/address/${address}`,
    solana: `https://solscan.io/account/${address}`,
  };
  return map[chain];
}

function chainLabel(chain: Mint["chain"]) {
  const map: Record<Mint["chain"], string> = {
    ethereum: "Ethereum",
    polygon: "Polygon",
    base: "Base",
    arbitrum: "Arbitrum",
    robinhood: "Robinhood",
    arc: "Arc (testnet)",
    solana: "Solana",
  };
  return map[chain];
}

function formatCountdown(target: string | null, now: number): string {
  if (!target) return "";
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return "now";
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

type SortMode = "date" | "today" | "tomorrow" | "eligible" | "popularity";

export default function Home() {
  const [mints, setMints] = useState<Mint[]>([]);
  const [results, setResults] = useState<Record<string, PhaseEligibility[]>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [evmAddress, setEvmAddress] = useState("");
  const [solanaAddress, setSolanaAddress] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("date");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetch("/api/mints")
      .then((r) => r.json())
      .then((d) => setMints(d.mints ?? []));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
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
    setResults((prev) => ({ ...prev, [mint.id]: data.phases ?? [] }));
    setChecking(null);
  }

  const visibleMints = useMemo(() => {
    let list = mints.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

    if (sort === "today") {
      list = list.filter((m) => m.mint_start && isSameDay(new Date(m.mint_start), new Date(now)));
    } else if (sort === "tomorrow") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      list = list.filter((m) => m.mint_start && isSameDay(new Date(m.mint_start), tomorrow));
    } else if (sort === "eligible") {
      list = list.filter((m) => (results[m.id] ?? []).some((p) => p.eligible));
    } else if (sort === "popularity") {
      list = [...list].sort((a, b) => (b.total_minted ?? 0) - (a.total_minted ?? 0));
    }

    if (sort === "date" || sort === "today" || sort === "tomorrow") {
      list = [...list].sort((a, b) => {
        const at = a.mint_start ? new Date(a.mint_start).getTime() : Infinity;
        const bt = b.mint_start ? new Date(b.mint_start).getTime() : Infinity;
        return at - bt;
      });
    }

    return list;
  }, [mints, search, sort, results, now]);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Drops</h1>
        <p style={styles.subtitle}>A shared, mint-time-sorted catalog. Pick a drop and check your wallets in a couple of clicks.</p>

        <div style={styles.walletRow}>
          <input
            style={styles.walletInput}
            type="text"
            placeholder="EVM wallet address (0x...)"
            value={evmAddress}
            onChange={(e) => setEvmAddress(e.target.value)}
          />
          <input
            style={styles.walletInput}
            type="text"
            placeholder="Solana wallet address"
            value={solanaAddress}
            onChange={(e) => setSolanaAddress(e.target.value)}
          />
        </div>

        <div style={styles.controlsRow}>
          <div style={styles.sortGroup}>
            {(["date", "today", "tomorrow", "eligible", "popularity"] as SortMode[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{ ...styles.sortPill, ...(sort === s ? styles.sortPillActive : {}) }}
              >
                {s === "date" ? "Mint date" : s === "today" ? "Today" : s === "tomorrow" ? "Tomorrow" : s === "eligible" ? "Eligible" : "Popularity"}
              </button>
            ))}
          </div>
        </div>

        <input
          style={styles.search}
          type="text"
          placeholder="Search drops..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {visibleMints.length === 0 && <p style={{ color: "#8892a6", marginTop: "2rem" }}>No drops match right now.</p>}

        {visibleMints.map((mint) => (
          <MintCard
            key={mint.id}
            mint={mint}
            now={now}
            checking={checking === mint.id}
            phaseResults={results[mint.id]}
            onCheck={() => checkEligibility(mint)}
          />
        ))}
      </div>
    </main>
  );
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function MintCard({
  mint,
  now,
  checking,
  phaseResults,
  onCheck,
}: {
  mint: Mint;
  now: number;
  checking: boolean;
  phaseResults?: PhaseEligibility[];
  onCheck: () => void;
}) {
  const nextPhase = (mint.phases ?? []).find((p) => p.opens_at && new Date(p.opens_at).getTime() > now);
  const opensLabel = mint.status === "live" ? "Live now" : nextPhase ? `Opens in ${formatCountdown(nextPhase.opens_at, now)}` : "";

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        {mint.image_url ? (
          <img src={mint.image_url} alt={mint.name} style={styles.thumb} />
        ) : (
          <div style={{ ...styles.thumb, ...styles.thumbPlaceholder }}>{mint.name.slice(0, 2).toUpperCase()}</div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.cardTitleRow}>
            <span style={styles.cardTitle}>{mint.name}</span>
          </div>
          <div style={styles.metaRow}>
            <span>{chainLabel(mint.chain)}</span>
            <span style={styles.dot}>·</span>
            <span>{shortAddr(mint.contract_address)}</span>
            <span style={styles.dot}>·</span>
            <span>
              {mint.total_minted ?? 0} / {mint.total_supply ?? "?"} minted
            </span>
          </div>
        </div>

        <div style={styles.linkRow}>
          {mint.website_url && (
            <a href={mint.website_url} target="_blank" rel="noreferrer" style={styles.linkPill}>
              🌐
            </a>
          )}
          {mint.twitter_url && (
            <a href={mint.twitter_url} target="_blank" rel="noreferrer" style={styles.linkPill}>
              𝕏
            </a>
          )}
          <a href={explorerUrl(mint.chain, mint.contract_address)} target="_blank" rel="noreferrer" style={styles.linkPillText}>
            Explorer ↗
          </a>
          {mint.source_url && (
            <a href={mint.source_url} target="_blank" rel="noreferrer" style={styles.linkPillText}>
              {mint.source === "opensea" ? "OpenSea ↗" : mint.source === "magiceden" ? "Magic Eden ↗" : "Source ↗"}
            </a>
          )}
        </div>
      </div>

      <div style={styles.statusRow}>
        <span style={{ ...styles.statusPill, ...(mint.status === "live" ? styles.statusPillLive : {}) }}>
          {mint.status === "live" ? "Live" : "Upcoming"}
        </span>
        {opensLabel && <span style={styles.opensLabel}>{opensLabel}</span>}
        <button onClick={onCheck} disabled={checking} style={styles.checkButton}>
          {checking ? "Checking..." : "Check"}
        </button>
      </div>

      <div style={styles.phaseList}>
        {(mint.phases ?? []).map((phase) => {
          const result = phaseResults?.find((r) => r.phase_id === phase.id);
          return (
            <div key={phase.id} style={styles.phaseRow}>
              <span style={styles.phaseSupply}>
                {phase.phase_minted}/{phase.phase_supply ?? "∞"}
              </span>
              <span style={styles.phaseName}>{phase.name}</span>
              <span style={styles.phaseDetail}>
                {phase.price_display} · {phase.per_wallet_limit} per wallet
                {phase.opens_at && ` · opens in ${formatCountdown(phase.opens_at, now)}`}
              </span>
              {result && (
                <span style={result.eligible ? styles.eligibleBadge : styles.notEligibleBadge}>
                  {result.eligible ? "✓ Eligible" : "✕ Not eligible"}
                </span>
              )}
            </div>
          );
        })}
        {(mint.phases ?? []).length === 0 && <p style={{ color: "#8892a6", fontSize: "0.85rem" }}>No phases configured yet.</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b0b14",
    color: "#f4f4f8",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "2rem 1rem 4rem",
  },
  container: { maxWidth: 760, margin: "0 auto" },
  title: { fontSize: "2rem", fontWeight: 800, marginBottom: "0.25rem" },
  subtitle: { color: "#9aa0b4", marginBottom: "1.5rem", fontSize: "0.95rem" },
  walletRow: { display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" },
  walletInput: {
    background: "#151521",
    border: "1px solid #262638",
    borderRadius: 8,
    color: "#f4f4f8",
    padding: "0.6rem 0.8rem",
    fontSize: "0.9rem",
  },
  controlsRow: { display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" },
  sortGroup: { display: "flex", gap: "0.4rem", flexWrap: "wrap" },
  sortPill: {
    background: "transparent",
    border: "1px solid #262638",
    color: "#9aa0b4",
    borderRadius: 999,
    padding: "0.35rem 0.8rem",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  sortPillActive: { background: "#f4f4f8", color: "#0b0b14", borderColor: "#f4f4f8" },
  search: {
    width: "100%",
    background: "#151521",
    border: "1px solid #262638",
    borderRadius: 10,
    color: "#f4f4f8",
    padding: "0.75rem 1rem",
    fontSize: "0.9rem",
    marginBottom: "1.5rem",
  },
  card: {
    background: "#12121e",
    border: "1px solid #22222f",
    borderRadius: 14,
    padding: "1.25rem",
    marginBottom: "1.25rem",
  },
  cardHeader: { display: "flex", gap: "0.9rem", alignItems: "flex-start" },
  thumb: { width: 56, height: 56, borderRadius: 12, objectFit: "cover", flexShrink: 0 },
  thumbPlaceholder: {
    background: "#22222f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "#9aa0b4",
  },
  cardTitleRow: { display: "flex", alignItems: "center", gap: "0.5rem" },
  cardTitle: { fontSize: "1.1rem", fontWeight: 700 },
  metaRow: { display: "flex", gap: "0.4rem", color: "#8892a6", fontSize: "0.82rem", marginTop: "0.15rem", flexWrap: "wrap" },
  dot: { opacity: 0.5 },
  linkRow: { display: "flex", gap: "0.4rem", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" },
  linkPill: {
    background: "#1c1c2a",
    border: "1px solid #262638",
    borderRadius: 999,
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#f4f4f8",
    textDecoration: "none",
    fontSize: "0.85rem",
  },
  linkPillText: {
    background: "#1c1c2a",
    border: "1px solid #262638",
    borderRadius: 999,
    padding: "0.3rem 0.7rem",
    color: "#f4f4f8",
    textDecoration: "none",
    fontSize: "0.78rem",
    whiteSpace: "nowrap",
  },
  statusRow: { display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "1rem" },
  statusPill: {
    background: "#22222f",
    color: "#9aa0b4",
    borderRadius: 999,
    padding: "0.3rem 0.75rem",
    fontSize: "0.78rem",
    fontWeight: 600,
  },
  statusPillLive: { background: "#1a3a2a", color: "#4ade80" },
  opensLabel: { color: "#8892a6", fontSize: "0.82rem", flex: 1 },
  checkButton: {
    background: "#f4f4f8",
    color: "#0b0b14",
    border: "none",
    borderRadius: 8,
    padding: "0.5rem 1.1rem",
    fontWeight: 700,
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  phaseList: { marginTop: "0.9rem", display: "flex", flexDirection: "column", gap: "0.4rem" },
  phaseRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    background: "#161622",
    borderRadius: 8,
    padding: "0.5rem 0.75rem",
    fontSize: "0.82rem",
    flexWrap: "wrap",
  },
  phaseSupply: { color: "#8892a6", minWidth: 44, fontVariantNumeric: "tabular-nums" },
  phaseName: { fontWeight: 700, minWidth: 90 },
  phaseDetail: { color: "#9aa0b4", flex: 1 },
  eligibleBadge: { color: "#4ade80", fontWeight: 700, fontSize: "0.78rem" },
  notEligibleBadge: { color: "#f87171", fontWeight: 700, fontSize: "0.78rem" },
};
