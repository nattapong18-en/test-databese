import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const interval = Math.max(1000, Number(process.env.SIMULATOR_INTERVAL_MS || 3500));
if (!url || !key || key === "your-service-role-key" || key === "your-secret-key") {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const money = value => +Number(value).toFixed(2);

async function tick() {
  const { data: stocks, error: readError } = await supabase.from("stocks").select("symbol,price,open,high,low,volatility,manual_override_until").order("symbol");
  if (readError) throw readError;
  for (const stock of stocks ?? []) {
    if (stock.manual_override_until && new Date(stock.manual_override_until).getTime() > Date.now()) {
      console.log(`${new Date().toLocaleTimeString()}  ${stock.symbol.padEnd(5)}  manual hold active`);
      continue;
    }
    const volatility = Number(stock.volatility || 0.55);
    const movement = (Math.random() - 0.48) * (volatility / 100);
    const price = Math.max(0.01, money(Number(stock.price) * (1 + movement)));
    const updatedAt = new Date().toISOString();
    const update = { price, high: Math.max(Number(stock.high), price), low: Math.min(Number(stock.low), price), change: +(((price - Number(stock.open)) / Number(stock.open)) * 100).toFixed(2), updated_at: updatedAt };
    const { error: updateError } = await supabase.from("stocks").update(update).eq("symbol", stock.symbol);
    if (updateError) throw updateError;
    const { error: historyError } = await supabase.from("stock_price_history").insert({ symbol: stock.symbol, price, recorded_at: updatedAt, granularity: "tick", sample_date: updatedAt.slice(0, 10) });
    if (historyError) throw historyError;
    console.log(`${new Date().toLocaleTimeString()}  ${stock.symbol.padEnd(5)}  $${price.toFixed(2)}  ${update.change >= 0 ? "+" : ""}${update.change.toFixed(2)}%`);
  }
}

console.log(`Pulseboard simulator running every ${interval}ms. Press Ctrl+C to stop.`);
await tick().catch(error => console.error("Initial tick failed:", error.message));
setInterval(() => tick().catch(error => console.error("Tick failed:", error.message)), interval);
