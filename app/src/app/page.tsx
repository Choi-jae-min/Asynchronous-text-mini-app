"use client";
import { useState } from "react";

export default function Page() {
  const [sessionId, setSessionId] = useState("sess-123");
  const [token, setToken] = useState("valid-token");
  const [logs, setLogs] = useState<string[]>([]);
  const [clickBurst, setClickBurst] = useState(3);

  async function callBurst() {
    setLogs((p) => [`[UI] burst x${clickBurst}`, ...p]);
    await Promise.all(
        Array.from({ length: clickBurst }).map(() =>
            fetch("/api/async-test", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId, token, payload: { msisdn: "01012345678" } }),
            })
                .then(async (r) => ({ ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) }))
                .then((res) =>
                    setLogs((p) => [`[OK:${res.status}] ${JSON.stringify(res.json)}`, ...p])
                )
                .catch((e) => setLogs((p) => [`[ERR] ${String(e)}`, ...p]))
        )
    );
  }

  async function callOnceBadToken() {
    const r = await fetch("/api/async-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, token: "bad-token", payload: { msisdn: "010..." } }),
    });
    const j = await r.json().catch(() => ({}));
    setLogs((p) => [`[BAD:${r.status}] ${JSON.stringify(j)}`, ...p]);
  }

  async function reset() {
    await fetch("/api/reset", { method: "POST" });
    setLogs((p) => [`[RESET] state cleared`, ...p]);
  }

  return (
      <main className="p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Async Stability Test</h1>
        <div className="space-y-2">
          <label className="block">Session ID</label>
          <input className="border p-2 w-full" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
          <label className="block">Token</label>
          <input className="border p-2 w-full" value={token} onChange={(e) => setToken(e.target.value)} />
          <label className="block">Burst Clicks</label>
          <input
              type="number"
              min={1}
              className="border p-2 w-full"
              value={clickBurst}
              onChange={(e) => setClickBurst(Number(e.target.value))}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={callBurst} className="border px-3 py-2">Burst Call</button>
          <button onClick={callOnceBadToken} className="border px-3 py-2">Bad Token</button>
          <button onClick={reset} className="border px-3 py-2">Reset</button>
        </div>
        <div>
          <h2 className="font-semibold mt-6">Logs</h2>
          <pre className="border p-3 h-80 overflow-auto bg-black text-green-200 text-sm">
{logs.join("\n")}
        </pre>
        </div>
      </main>
  );
}
