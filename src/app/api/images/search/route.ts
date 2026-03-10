import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { message: "Image search route placeholder" },
    { status: 501 },
  );
}
