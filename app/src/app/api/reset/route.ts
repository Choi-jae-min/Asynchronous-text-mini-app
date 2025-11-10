import { NextResponse } from "next/server";

// 간단히 프로세스 재시작 효과로 충분. 실제로는 글로벌 store를 모듈로 분리해 clear하는 편.
export async function POST() {
    return NextResponse.json({ ok: true });
}
