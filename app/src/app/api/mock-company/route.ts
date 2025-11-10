import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const idem = req.headers.get("x-idempotency-key") ?? "none";
    const { sessionId } = await req.json().catch(() => ({}));

    // 랜덤 지연(0~1200ms)
    await new Promise((r) => setTimeout(r, Math.random() * 1200));

    // 20%: 500, 10%: 429 (재시도 유도), 70%: 성공
    const roll = Math.random();
    if (roll < 0.2) return NextResponse.json({ code: "E500" }, { status: 500 });
    if (roll < 0.3) return NextResponse.json({ code: "E429" }, { status: 429 });

    // 성공
    return NextResponse.json(
        { code: "0000", data: { sessionId, idem } },
        { status: 200 }
    );
}
