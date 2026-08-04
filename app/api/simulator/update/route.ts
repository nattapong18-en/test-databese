import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { symbol?: string; price?: number; volatility?: number };
    const symbol = body.symbol?.trim().toUpperCase();
    const price = Number(body.price);
    const volatility = Number(body.volatility);
    if (!symbol || !Number.isFinite(price) || price <= 0 || price > 1_000_000) {
      return NextResponse.json({ error: "Price must be a positive number." }, { status: 400 });
    }
    if (!Number.isFinite(volatility) || volatility < 0 || volatility > 20) {
      return NextResponse.json({ error: "Volatility must be between 0 and 20." }, { status: 400 });
    }
    const admin = getSupabaseAdmin();
    const { data: current, error: readError } = await admin.from("stocks").select("symbol,open,high,low").eq("symbol", symbol).single();
    if (readError || !current) return NextResponse.json({ error: "Stock was not found." }, { status: 404 });
    const open = Number(current.open);
    const holdSeconds = Math.min(300, Math.max(5, Number(process.env.MANUAL_HOLD_SECONDS || 15)));
    const update = { price: +price.toFixed(2), volatility: +volatility.toFixed(3), high: Math.max(Number(current.high), price), low: Math.min(Number(current.low), price), change: +(((price - open) / open) * 100).toFixed(2), manual_override_until: new Date(Date.now() + holdSeconds * 1000).toISOString(), updated_at: new Date().toISOString() };
    const { data, error } = await admin.from("stocks").update(update).eq("symbol", symbol).select().single();
    if (error) throw error;
    const { error: historyError } = await admin.from("stock_price_history").insert({ symbol, price: update.price, recorded_at: update.updated_at, granularity: "tick", sample_date: update.updated_at.slice(0, 10) });
    if (historyError) throw historyError;
    return NextResponse.json({ stock: data });
  } catch (error) {
    console.error("Simulator update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update stock." }, { status: 500 });
  }
}
