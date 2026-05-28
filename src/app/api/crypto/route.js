import { NextResponse } from "next/server";

const CACHE_DURATION = 60_000; // 60 seconds
let cache = { data: null, timestamp: 0 };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids");
  const type = searchParams.get("type") || "prices"; // "prices" | "history"
  const coinId = searchParams.get("coinId");
  const days = searchParams.get("days") || "30";

  try {
    if (type === "history" && coinId) {
      return await fetchHistory(coinId, days);
    }

    if (!ids) {
      return NextResponse.json({ error: "Missing ids parameter" }, { status: 400 });
    }

    // Check cache
    const now = Date.now();
    if (cache.data && now - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(cache.data);
    }

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,eur&include_24hr_change=true&include_24hr_vol=true`,
      { headers: { Accept: "application/json" }, next: { revalidate: 60 } }
    );

    if (!res.ok) {
      throw new Error(`CoinGecko API error: ${res.status}`);
    }

    const data = await res.json();
    cache = { data, timestamp: now };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Crypto API error:", error);
    // Return cached data if available, even if stale
    if (cache.data) {
      return NextResponse.json(cache.data);
    }
    return NextResponse.json({ error: "Failed to fetch crypto prices" }, { status: 500 });
  }
}

async function fetchHistory(coinId, days) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=${days > 90 ? "daily" : days > 7 ? "daily" : "hourly"}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 300 } }
    );

    if (!res.ok) {
      throw new Error(`CoinGecko history error: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Crypto history error:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
