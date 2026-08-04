import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const [{ data: account, error: accountError }, { data: holdings, error: holdingsError }, { data: stocks, error: stocksError }, { data: orders, error: ordersError }] = await Promise.all([
      admin.from("demo_accounts").select("id,cash").eq("id", "demo-user").single(),
      admin.from("demo_holdings").select("symbol,quantity,average_cost").eq("account_id", "demo-user").order("symbol"),
      admin.from("stocks").select("symbol,price,change"),
      admin.from("demo_orders").select("id,symbol,side,quantity,price,total,created_at").eq("account_id", "demo-user").order("created_at", { ascending: false }).limit(8)
    ]);
    if (accountError || holdingsError || stocksError || ordersError) throw accountError || holdingsError || stocksError || ordersError;
    const stockMap = new Map((stocks ?? []).map(stock => [stock.symbol, stock]));
    const enriched = (holdings ?? []).map(holding => { const stock = stockMap.get(holding.symbol); const price = Number(stock?.price ?? 0); const quantity = Number(holding.quantity); const averageCost = Number(holding.average_cost); return { ...holding, quantity, average_cost: averageCost, price, marketValue: +(price * quantity).toFixed(2), unrealizedGainLoss: +((price - averageCost) * quantity).toFixed(2), change: Number(stock?.change ?? 0) }; });
    const cash = Number(account?.cash ?? 0);
    const investedValue = enriched.reduce((sum, holding) => sum + holding.marketValue, 0);
    const unrealizedGainLoss = enriched.reduce((sum, holding) => sum + holding.unrealizedGainLoss, 0);
    const normalizedOrders = (orders ?? []).map(order => ({ ...order, quantity: Number(order.quantity), price: Number(order.price), total: Number(order.total) }));
    return NextResponse.json({ accountId: "demo-user", cash, investedValue: +investedValue.toFixed(2), totalValue: +(cash + investedValue).toFixed(2), unrealizedGainLoss: +unrealizedGainLoss.toFixed(2), holdings: enriched, orders: normalizedOrders });
  } catch (error) {
    console.error("Portfolio fetch failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load portfolio." }, { status: 500 });
  }
}
