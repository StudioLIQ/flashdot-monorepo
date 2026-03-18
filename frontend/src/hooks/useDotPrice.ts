"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchDotUsdPrice(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=polkadot&vs_currencies=usd",
    { next: { revalidate: 60 } }
  );
  const data = (await res.json()) as { polkadot?: { usd?: number } };
  const price = data?.polkadot?.usd;
  if (!price || typeof price !== "number") throw new Error("No price data");
  return price;
}

/** Returns the DOT/USD price, or null while loading or on error. */
export function useDotPrice(): number | null {
  const query = useQuery({
    queryKey: ["dotUsdPrice"],
    queryFn: fetchDotUsdPrice,
    staleTime: 60_000,
    retry: 1,
    // Fallback to reasonable default on error
    placeholderData: 8,
  });

  return query.data ?? null;
}
