"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CircleHelp, Plus, Search, Wifi } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "../lib/supabase";

type RangeKey = "1D" | "1W" | "1M" | "1Y";
type Stock = { symbol:string; name:string; exchange:string; price:number; open:number; high:number; low:number; change:number; volatility:number; tone:string; history:HistoryPoint[] };
type HistoryPoint = { time:string; value:number; recordedAt:string };
type Holding = { symbol:string; quantity:number; average_cost:number; price:number; marketValue:number; unrealizedGainLoss:number; change:number };
type Order = { id:string; symbol:string; side:"buy"|"sell"; quantity:number; price:number; total:number; created_at:string };
type Portfolio = { cash:number; investedValue:number; totalValue:number; unrealizedGainLoss:number; holdings:Holding[]; orders:Order[] };

const ranges: RangeKey[] = ["1D", "1W", "1M", "1Y"];
const rangeMs: Record<RangeKey, number> = { "1D": 24 * 60 * 60 * 1000, "1W": 7 * 24 * 60 * 60 * 1000, "1M": 30 * 24 * 60 * 60 * 1000, "1Y": 365 * 24 * 60 * 60 * 1000 };
const seed: Stock[] = [
  {symbol:"AAPL",name:"Apple Inc.",exchange:"NASDAQ",price:227.64,open:224.88,high:229.12,low:223.41,change:1.23,volatility:.55,tone:"apple",history:[]},
  {symbol:"TSLA",name:"Tesla, Inc.",exchange:"NASDAQ",price:342.11,open:347.01,high:349.7,low:337.88,change:-1.42,volatility:.95,tone:"tesla",history:[]},
  {symbol:"MSFT",name:"Microsoft Corp.",exchange:"NASDAQ",price:415.56,open:411.22,high:418.04,low:410.68,change:.84,volatility:.42,tone:"microsoft",history:[]},
  {symbol:"GOOGL",name:"Alphabet Inc.",exchange:"NASDAQ",price:176.89,open:175.41,high:178.34,low:174.8,change:.67,volatility:.5,tone:"google",history:[]}
];

const fallbackHistory = (stock:Stock, range:RangeKey):HistoryPoint[] => {
  const points = range === "1D" ? 36 : range === "1W" ? 28 : range === "1M" ? 30 : 52;
  const span = range === "1D" ? 24 * 60 * 60 * 1000 : rangeMs[range];
  return Array.from({length:points},(_,i)=>{ const recordedAt = new Date(Date.now() - span + (span * i) / Math.max(1, points - 1)); return { recordedAt: recordedAt.toISOString(), time: formatTime(recordedAt, range), value: +(stock.price * (1 + Math.sin(i * .66 + stock.symbol.length) * .008 + (i - points) * .00015)).toFixed(2) }; });
};
const formatTime = (date:Date, range:RangeKey) => range === "1D" ? date.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : range === "1Y" ? date.toLocaleDateString([], {month:"short"}) : date.toLocaleDateString([], {month:"short",day:"numeric"});
const emptyPortfolio:Portfolio = {cash:12400, investedValue:0, totalValue:12400, unrealizedGainLoss:0, holdings:[], orders:[]};

export default function Home() {
  const [stocks,setStocks] = useState<Stock[]>(() => seed.map(stock=>({...stock,history:fallbackHistory(stock,"1D")})));
  const [selected,setSelected] = useState("AAPL");
  const [range,setRange] = useState<RangeKey>("1D");
  const [chartHistory,setChartHistory] = useState<HistoryPoint[]>([]);
  const [historyLoading,setHistoryLoading] = useState(false);
  const [historyMessage,setHistoryMessage] = useState("");
  const [portfolio,setPortfolio] = useState<Portfolio>(emptyPortfolio);
  const [connection,setConnection] = useState<"local"|"connecting"|"connected"|"error">(supabase ? "connecting" : "local");
  const [controlPrice,setControlPrice] = useState("");
  const [controlVolatility,setControlVolatility] = useState("");
  const [controlMessage,setControlMessage] = useState("");
  const [orderSide,setOrderSide] = useState<"buy"|"sell">("buy");
  const [orderQuantity,setOrderQuantity] = useState("");
  const [orderMessage,setOrderMessage] = useState("");
  const [orderSubmitting,setOrderSubmitting] = useState(false);
  const active = stocks.find(stock=>stock.symbol===selected) ?? stocks[0];
  const stocksRef = useRef(stocks);
  stocksRef.current = stocks;
  const isUp = active.change >= 0;
  const chartData = chartHistory.length ? chartHistory : active.history;
  const quantity = Number(orderQuantity);
  const estimatedTotal = Number.isFinite(quantity) && quantity > 0 ? +(quantity * active.price).toFixed(2) : 0;
  const portfolioChange = portfolio.unrealizedGainLoss >= 0;

  const loadPortfolio = useCallback(async() => {
    if (!supabase) return;
    try {
      const response = await fetch("/api/portfolio", {cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load portfolio");
      setPortfolio(data);
    } catch (error) { setOrderMessage(error instanceof Error ? error.message : "Unable to load portfolio"); }
  },[]);

  const loadHistory = useCallback(async(symbol:string, selectedRange:RangeKey) => {
    setHistoryLoading(true); setHistoryMessage("");
    if (!supabase) {
      const localStock = stocksRef.current.find(stock=>stock.symbol===symbol) ?? seed.find(stock=>stock.symbol===symbol) ?? seed[0];
      setChartHistory(fallbackHistory(localStock, selectedRange)); setHistoryLoading(false); return;
    }
    const since = new Date(Date.now() - rangeMs[selectedRange]).toISOString();
    const base = supabase.from("stock_price_history").select("price,recorded_at,granularity").eq("symbol",symbol).gte("recorded_at",since);
    const result = selectedRange === "1D" ? await base.eq("granularity","tick").order("recorded_at",{ascending:true}).limit(600) : await base.eq("granularity","day").order("recorded_at",{ascending:true}).limit(500);
    if (result.error) { setHistoryMessage(result.error.message); setChartHistory([]); } else if (!result.data?.length) { setHistoryMessage("No historical data for this range yet."); setChartHistory([]); } else setChartHistory(result.data.map(point=>{ const recordedAt = new Date(point.recorded_at); return {recordedAt:point.recorded_at,time:formatTime(recordedAt,selectedRange),value:Number(point.price)}; }));
    setHistoryLoading(false);
  },[]);

  useEffect(()=>{ setControlPrice(active.price.toFixed(2)); setControlVolatility(active.volatility.toFixed(3)); },[active]);
  useEffect(()=>{ void loadHistory(selected,range); },[loadHistory,range,selected]);
  useEffect(()=>{
    if (supabase) return;
    const timer = setInterval(()=>setStocks(current=>current.map(stock=>{ const movement=(Math.random()-.48)*(stock.volatility/100); const price=+(Math.max(.01,stock.price*(1+movement))).toFixed(2); const point={recordedAt:new Date().toISOString(),time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),value:price}; return {...stock,price,change:+(((price-stock.open)/stock.open)*100).toFixed(2),high:Math.max(stock.high,price),low:Math.min(stock.low,price),history:[...stock.history.slice(-599),point]}; })),3500);
    return()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    const client = supabase;
    if (!client) return;
    void loadPortfolio();
    void client.from("stocks").select("symbol,name,exchange,price,open,high,low,change,volatility").then(({data,error})=>{
      if (error) { setConnection("error"); return; }
      if (data?.length) setStocks(current=>data.map(row=>{ const old=current.find(stock=>stock.symbol===row.symbol) ?? seed.find(stock=>stock.symbol===row.symbol) ?? seed[0]; return {...old,...row,price:Number(row.price),open:Number(row.open),high:Number(row.high),low:Number(row.low),change:Number(row.change),volatility:Number(row.volatility)}; }));
    });
    const channel=client.channel("broker-live").on("postgres_changes",{event:"*",schema:"public",table:"stocks"},payload=>{
      const incoming=payload.new as Partial<Stock> & {symbol?:string};
      if (!incoming.symbol) return;
      const point={recordedAt:new Date().toISOString(),time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),value:Number(incoming.price)};
      setStocks(current=>current.map(stock=>stock.symbol===incoming.symbol?{...stock,...incoming,price:Number(incoming.price ?? stock.price),change:Number(incoming.change ?? stock.change),volatility:Number(incoming.volatility ?? stock.volatility),history:[...stock.history.slice(-599),point]}:stock));
      if (incoming.symbol === selected && range === "1D") setChartHistory(current=>[...current.slice(-599),point]);
      void loadPortfolio();
    }).on("postgres_changes",{event:"*",schema:"public",table:"demo_accounts"},()=>void loadPortfolio()).on("postgres_changes",{event:"*",schema:"public",table:"demo_holdings"},()=>void loadPortfolio()).on("postgres_changes",{event:"*",schema:"public",table:"demo_orders"},()=>void loadPortfolio()).subscribe(status=>{ if (status === "SUBSCRIBED") setConnection("connected"); if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("error"); });
    return()=>{ void client.removeChannel(channel); };
  },[loadHistory,loadPortfolio,range,selected]);

  const applyControl = async(event:FormEvent) => {
    event.preventDefault(); setControlMessage("");
    try {
      const response=await fetch("/api/simulator/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:active.symbol,price:Number(controlPrice),volatility:Number(controlVolatility)})});
      const data=await response.json(); if (!response.ok) throw new Error(data.error || "Unable to update stock"); setControlMessage("Update sent to Supabase.");
    } catch(error) { setControlMessage(error instanceof Error ? error.message : "Unable to update stock."); }
  };
  const submitOrder = async(event:FormEvent) => {
    event.preventDefault(); setOrderMessage("");
    if (!Number.isFinite(quantity) || quantity <= 0) { setOrderMessage("Enter a quantity greater than zero."); return; }
    setOrderSubmitting(true);
    try { const response=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:active.symbol,side:orderSide,quantity})}); const data=await response.json(); if (!response.ok) throw new Error(data.error || "Order failed"); setOrderMessage(`${orderSide === "buy" ? "Bought" : "Sold"} ${quantity} ${active.symbol} at $${Number(data.order.price).toFixed(2)}.`); setOrderQuantity(""); await loadPortfolio(); } catch(error) { setOrderMessage(error instanceof Error ? error.message : "Order failed."); } finally { setOrderSubmitting(false); }
  };

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-mark"><Activity size={18}/></span><span>pulse<span className="brand-accent">board</span></span></div><nav className="nav"><a className="active" href="#overview">Overview</a><a href="#markets">Markets</a><a href="#portfolio">Portfolio</a></nav><div className="top-actions"><button className="icon-button" aria-label="Search"><Search size={16}/></button><div className="live-pill"><span className="live-dot"/> {connection === "connected" ? "Realtime" : connection === "connecting" ? "Connecting" : connection === "error" ? "Connection error" : "Local demo"}</div></div></header>
    <section className="hero" id="overview"><div><p className="eyebrow">Good morning · 04 Aug 2026</p><h1>Your money,<br/><span>in motion.</span></h1></div><p className="hero-copy">A realtime market view built for your daily investing routine. Track your watchlist, portfolio and simulated orders in one calm, focused space.</p></section>
    <section className="portfolio-strip" id="portfolio"><div className="portfolio-main"><span className="portfolio-label">Total portfolio value <span className="eye">●</span></span><strong>${portfolio.totalValue.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><span className={`portfolio-change ${portfolioChange?"up":"down"}`}>{portfolioChange?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>} {portfolioChange?"+":""}${Math.abs(portfolio.unrealizedGainLoss).toFixed(2)} unrealized</span></div><div className="portfolio-divider"/><div className="cash-block"><span>Available to invest</span><strong>${portfolio.cash.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><small>Demo account · USD</small></div><button className="fund-button"><Plus size={15}/> Add funds</button></section>
    <section className="grid" id="markets"><div className="card watchlist"><div className="card-head"><div><p className="card-kicker">Markets</p><p className="card-title">My watchlist</p></div><span className="caption">{stocks.length} symbols <span className="tiny-live"/></span></div>{stocks.map(stock=><button key={stock.symbol} className={`stock-row ${selected===stock.symbol?"selected":""}`} onClick={()=>setSelected(stock.symbol)}><span className={`ticker-badge ${stock.tone}`}>{stock.symbol.slice(0,1)}</span><span><p className="stock-name">{stock.symbol}</p><span className="exchange">{stock.name}</span></span><span className="row-price"><p className="price">${stock.price.toFixed(2)}</p><span className={`change ${stock.change>=0?"up":"down"}`}>{stock.change>=0?"+":""}{stock.change.toFixed(2)}%</span></span></button>)}</div>
      <div className="card detail"><div className="detail-top"><div className="detail-ticker"><span className={`ticker-badge ${active.tone}`}>{active.symbol.slice(0,1)}</span><div><span className="card-kicker">Stock detail</span><h2>{active.symbol}</h2><p>{active.name} · {active.exchange}</p></div></div><div className="detail-price"><strong>${active.price.toFixed(2)}</strong><span className={`change ${isUp?"up":"down"}`}>{isUp?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>} {isUp?"+":""}{active.change.toFixed(2)}% today</span><span className="updated">Updated just now</span></div></div>
        <div className="range">{ranges.map(item=><button className={range===item?"active":""} onClick={()=>setRange(item)} key={item}>{item}</button>)}</div><div className="chart">{historyLoading?<div className="chart-state">Loading {range} history…</div>:historyMessage?<div className="chart-state">{historyMessage}</div>:<ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:8,right:10,left:0,bottom:0}}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={isUp?"#75dc91":"#ff7868"} stopOpacity={.24}/><stop offset="100%" stopColor={isUp?"#75dc91":"#ff7868"} stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#253238"/><XAxis dataKey="time" axisLine={false} tickLine={false} minTickGap={34} tick={{fontSize:10,fill:"#748586"}}/><YAxis domain={["dataMin - 1","dataMax + 1"]} orientation="right" axisLine={false} tickLine={false} tick={{fontSize:10,fill:"#748586"}} tickFormatter={value=>`$${value}`}/><Tooltip contentStyle={{background:"#182126",border:"1px solid #34434a",borderRadius:10,fontSize:11,color:"#f2f7f5"}} labelStyle={{color:"#8a999a"}} formatter={value=>[`$${Number(value).toFixed(2)}`,active.symbol]}/><Area type="monotone" dataKey="value" stroke={isUp?"#75dc91":"#ff7868"} strokeWidth={2.5} fill="url(#fill)" dot={false}/></AreaChart></ResponsiveContainer>}</div>
        <div className="stats"><div><div className="stat-label">Open</div><div className="stat-value">${active.open.toFixed(2)}</div></div><div><div className="stat-label">Day high</div><div className="stat-value">${active.high.toFixed(2)}</div></div><div><div className="stat-label">Day low</div><div className="stat-value">${active.low.toFixed(2)}</div></div><div><div className="stat-label">Volatility</div><div className="stat-value">{active.volatility.toFixed(3)}%</div></div></div>
        <div className="detail-actions"><form className="control-box" onSubmit={applyControl}><div className="box-title">Simulator controls</div><div className="form-row"><label>Price<input type="number" step="0.01" min="0.01" value={controlPrice} onChange={event=>setControlPrice(event.target.value)}/></label><label>Volatility %<input type="number" step="0.001" min="0" max="20" value={controlVolatility} onChange={event=>setControlVolatility(event.target.value)}/></label></div><button className="secondary-button" type="submit">Apply update</button>{controlMessage&&<p className="form-message">{controlMessage}</p>}</form><form className="order-box" onSubmit={submitOrder}><div className="box-title">Market order <span>${active.price.toFixed(2)} now</span></div><div className="side-switch"><button type="button" className={orderSide==="buy"?"selected-buy":""} onClick={()=>setOrderSide("buy")}>Buy</button><button type="button" className={orderSide==="sell"?"selected-sell":""} onClick={()=>setOrderSide("sell")}>Sell</button></div><label>Quantity<input type="number" step="0.0001" min="0" placeholder="0" value={orderQuantity} onChange={event=>setOrderQuantity(event.target.value)}/></label><div className="estimate"><span>Estimated total</span><strong>${estimatedTotal.toFixed(2)}</strong></div><button className={`order-button ${orderSide}`} type="submit" disabled={orderSubmitting}>{orderSubmitting?"Submitting…":`${orderSide === "buy" ? "Buy" : "Sell"} ${active.symbol}`}</button>{orderMessage&&<p className="form-message">{orderMessage}</p>}</form></div>
      </div></section>
    <section className="below-grid"><div className="card holdings-card"><div className="card-head"><div><p className="card-kicker">Portfolio</p><p className="card-title">Your holdings</p></div><span className="caption">${portfolio.investedValue.toLocaleString("en-US",{minimumFractionDigits:2})} invested</span></div>{portfolio.holdings.length ? portfolio.holdings.map(holding=><div className="holding-row" key={holding.symbol}><span className="ticker-badge small-badge">{holding.symbol.slice(0,1)}</span><span><strong>{holding.symbol}</strong><small>{holding.quantity} shares · avg ${holding.average_cost.toFixed(2)}</small></span><span className="holding-value"><strong>${holding.marketValue.toFixed(2)}</strong><small className={holding.unrealizedGainLoss>=0?"up":"down"}>{holding.unrealizedGainLoss>=0?"+":""}${holding.unrealizedGainLoss.toFixed(2)}</small></span></div>) : <div className="empty-row">No holdings yet. Place a market order to get started.</div>}</div><div className="card orders-card"><div className="card-head"><div><p className="card-kicker">Activity</p><p className="card-title">Recent orders</p></div><span className="caption">Demo only</span></div>{portfolio.orders.length ? portfolio.orders.map(order=><div className="order-row" key={order.id}><span className={`order-side ${order.side}`}>{order.side.toUpperCase()}</span><span><strong>{order.quantity} {order.symbol}</strong><small>{new Date(order.created_at).toLocaleString()}</small></span><span className="holding-value"><strong>${order.total.toFixed(2)}</strong><small>${order.price.toFixed(2)} / share</small></span></div>) : <div className="empty-row">No orders yet.</div>}</div></section>
    <footer className="footnote"><span><CircleHelp size={13} style={{verticalAlign:"-2px",marginRight:5}}/>Demo account · Simulated data only. Not investment advice.</span><span className="simulator"><Wifi size={13} className="pulse"/><strong>{connection === "connected" ? "Realtime connected" : connection === "connecting" ? "Connecting…" : connection === "error" ? "Realtime error" : "Local simulation"}</strong> · <span>{connection === "local" ? "3.5s interval" : "Supabase"}</span></span></footer>
  </main>;
}
