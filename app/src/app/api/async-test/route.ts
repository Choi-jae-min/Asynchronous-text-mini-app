import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";

// ===== In-memory state (테스트용) =====
type State = { completed: boolean; lastResult?: any; lastIdemKey?: string; inflight?: Promise<any> };
const store = new Map<string, State>(); // key = sessionId

// ===== Utils =====
const ReqSchema = z.object({
    sessionId: z.string().min(3),
    token: z.string().min(3),
    payload: z.object({ msisdn: z.string().optional() }).optional(),
});

function idemKeyOf(body: unknown) {
    return crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function retry<T>(fn: () => Promise<T>, tries = 3, baseMs = 300): Promise<T> {
    let last: any;
    for (let i = 0; i < tries; i++) {
        try {
            return await fn();
        } catch (e: any) {
            last = e;
            // 간단 재시도(실무: 429/5xx만 재시도)
            await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
        }
    }
    throw last;
}

// ===== Route =====
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionId, token, payload } = ReqSchema.parse(body);

        // 1) 멱등키 (요청 본문 기반)
        const idemKey = idemKeyOf({ sessionId, token, payload });

        // 2) 상태 조회/초기화
        const st = store.get(sessionId) ?? { completed: false };
        store.set(sessionId, st);

        // 3) 멱등 처리: 이전 동일 요청이면 결과 재사용
        if (st.lastIdemKey === idemKey && st.lastResult) {
            return NextResponse.json({ reused: true, ...st.lastResult }, { status: 200 });
        }

        // 4) single-flight: 같은 세션의 동시요청은 합쳐서 1회만 수행
        if (st.inflight) {
            const res = await st.inflight;
            return NextResponse.json({ inflightReused: true, ...res }, { status: 200 });
        }

        // 5) 비즈니스 전제(간단 인증)
        if (token !== "valid-token") {
            const err = { code: "AUTH", message: "invalid token" };
            st.lastIdemKey = idemKey;
            st.lastResult = err;
            return NextResponse.json(err, { status: 401 });
        }

        // 6) 외부업체 호출 시뮬레이션 (간헐 실패/지연)
        const job = retry(async () => {
            const r = await fetchWithTimeout(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/mock-company`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Idempotency-Key": idemKey },
                body: JSON.stringify({ sessionId, payload }),
            }, 2000);
            if (!r.ok) throw new Error(`MOCK_HTTP_${r.status}`);
            const j = await r.json();
            if (j.code !== "0000") throw new Error(`MOCK_BIZ_${j.code}`);
            return j; // { code:"0000", data:{...} }
        }, 3, 200);

        st.inflight = job;

        const result = await job;

        // 7) 결과 저장(멱등 재사용 가능)
        st.completed = true;
        st.lastIdemKey = idemKey;
        st.lastResult = result;
        st.inflight = undefined;

        return NextResponse.json({ ok: true, ...result }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
    }
}


