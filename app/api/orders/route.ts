import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { symbol?: string; side?: string; quantity?: number };
    const symbol = body.symbol?.trim().toUpperCase();
    const side = body.side?.toLowerCase();
    const quantity = Number(body.quantity);
    if (!symbol || (side !== "buy" && side !== "sell") || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) return NextResponse.json({ error: "Enter a valid symbol, side and quantity." }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("place_demo_order", { p_symbol: symbol, p_side: side, p_quantity: quantity });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ order: data });
  } catch (error) {
    console.error("Order failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to place order." }, { status: 500 });
  }
}
