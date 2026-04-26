
import "dotenv/config";
import { fetchMarkets } from "./lib/polymarket/client";

async function test() {
  console.log("--- DEBUG POLYMARKET API ---");
  console.log("Checking environment variables...");
  console.log("POLYMARKET_API_KEY:", process.env.POLYMARKET_API_KEY ? "PRESENT (length: " + process.env.POLYMARKET_API_KEY.length + ")" : "MISSING");
  
  try {
    console.log("\nFetching markets...");
    const markets = await fetchMarkets({ limit: 5 });
    console.log("SUCCESS! Fetched", markets.length, "markets.");
    
    if (markets.length > 0) {
      console.log("\nFirst Market Data:");
      console.log(JSON.stringify(markets[0], null, 2));
    }
  } catch (err) {
    console.error("\nFAILED to fetch markets:");
    if (err instanceof Error) {
      console.error(err.message);
      if (err.message.includes("502") || err.message.includes("500")) {
        console.error("This usually means the API key is invalid or the endpoint is unreachable.");
      }
    } else {
      console.error(String(err));
    }
  }
}

test();
