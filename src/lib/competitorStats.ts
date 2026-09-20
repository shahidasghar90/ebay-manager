export type CompetitorPrice = {
  platform: string;
  price: number;
};

export type CompetitorStats = {
  min: number | null;
  max: number | null;
  avg: number | null;
};

export function summarizeCompetitorPrices(prices: CompetitorPrice[]): CompetitorStats {
  const values = prices.map((p) => p.price).filter((price) => Number.isFinite(price) && price > 0);

  if (values.length === 0) {
    return { min: null, max: null, avg: null };
  }

  const sum = values.reduce((total, price) => total + price, 0);

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round((sum / values.length + Number.EPSILON) * 100) / 100
  };
}
