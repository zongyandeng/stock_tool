/**
 * 核心湊整數與均價優化演算法 (The Optimizer)
 * 根據現有持股、當前股價、自訂手續費與預算上限，計算出最佳購入股數建議
 */

export interface OptimizationSuggestion {
  qtyToBuy: number;       // 擬購股數 Qn
  cost: number;           // 預計交易金額 Cn (含手續費)
  fee: number;            // 該筆交易手續費 Fn
  totalQty: number;       // 交易後總股數 Qt
  avgPrice: number;       // 交易後持有均價 Pavg
  evenDeviation: number;  // 均價與最近偶數整數的絕對偏差 Sdev
  isPerfect: boolean;     // 是否完美整除且為偶數
  score: number;          // 綜合評分 (分數越低越優)
  capitalEfficiency: number;  // 投入資金利用率 (%)
  remainingBudget: number;    // 剩餘資金金額
  avgPriceDiff: number;       // 買入前後平均成本變化 (元)
  avgPriceDiffPercent: number; // 買入前後平均成本變化比例 (%)
  qtyIncreasePercent: number;  // 持股股數增加比例 (%)
  postMarketValue: number;     // 本次交易後總持股市值
}

export interface OptimizationResult {
  perfect: OptimizationSuggestion | null;   // 均價整數優先
  quantity: OptimizationSuggestion | null;  // 整張股數優先
  budgetMax: OptimizationSuggestion | null; // 預算最大化
  all: OptimizationSuggestion[];            // 所有候選組合 (已依評分排序)
}

/**
 * 計算台股買入手續費
 * 法定費率：0.001425 (0.1425%)
 * 手續費採無條件捨去至整數元
 */
export function calculateFee(
  qty: number,
  price: number,
  discount: number,
  minFee: number
): number {
  if (qty <= 0 || price <= 0) return 0;
  const rawFee = qty * price * 0.001425 * discount;
  return Math.max(Math.floor(rawFee), minFee);
}

/**
 * 產生優化的擬購入股數候選集 (Candidates Search Space)
 * 當預算極大時，此優化能防範窮舉百萬次導致瀏覽器畫面凍結 (UI Lagging)
 */
export function generateCandidates(
  currentQty: number,
  price: number,
  budget: number
): number[] {
  // 最小交易單位為 1 股，最大可購股數依預算決定 (先不考慮手續費，預留空間)
  const maxQty = Math.floor(budget / price);
  if (maxQty <= 0) return [];

  // 1. 若最大股數小於等於 5000 股，進行全面逐股窮舉，以求最精確解
  if (maxQty <= 5000) {
    const candidates: number[] = [];
    for (let i = 1; i <= maxQty; i++) {
      candidates.push(i);
    }
    return candidates;
  }

  // 2. 若最大股數大於 5000 股，啟用啟發式搜尋空間優化
  const candidatesSet = new Set<number>();

  // A. 零股精確湊整區間：1 至 999 股的所有股數
  const limitOdd = Math.min(999, maxQty);
  for (let i = 1; i <= limitOdd; i++) {
    candidatesSet.add(i);
  }

  // B. 整百與整張股數：100, 200, ..., 900 以及 1000, 2000, ...
  for (let i = 100; i <= maxQty; i += 100) {
    candidatesSet.add(i);
  }

  // C. 互補湊整股數：能使交易後總股數 Qt = Qe + Qn 剛好湊滿最近 of 100 或 1000 倍數的 Qn
  // 湊滿整千(整張)的互補股數
  const oddToThousand = 1000 - (currentQty % 1000);
  if (oddToThousand > 0 && oddToThousand <= maxQty) {
    candidatesSet.add(oddToThousand);
    // 累加整千張
    for (let k = 1; k * 1000 + oddToThousand <= maxQty; k++) {
      candidatesSet.add(k * 1000 + oddToThousand);
    }
  }

  // 湊滿整百的互補股數
  const oddToHundred = 100 - (currentQty % 100);
  if (oddToHundred > 0 && oddToHundred <= maxQty) {
    candidatesSet.add(oddToHundred);
    for (let k = 1; k * 100 + oddToHundred <= maxQty; k++) {
      candidatesSet.add(k * 100 + oddToHundred);
    }
  }

  // 將 Set 轉換回排序後的陣列
  return Array.from(candidatesSet).sort((a, b) => a - b);
}

/**
 * 執行湊整與均價整數化多目標優化演算法
 */
export function optimizeStockPurchase(
  currentQty: number,       // Qe (已持有股數)
  currentAvgPrice: number,  // Pe (已持有均價)
  currentPrice: number,     // Pc (當前市價)
  budget: number,           // B (預算上限)
  discount: number,         // D (手續費折扣率，例如 0.6)
  minFee: number            // Fmin (最低手續費，例如 20)
): OptimizationResult {
  const currentCost = currentQty * currentAvgPrice;
  const candidates = generateCandidates(currentQty, currentPrice, budget);
  
  const suggestions: OptimizationSuggestion[] = [];

  for (const qn of candidates) {
    const fee = calculateFee(qn, currentPrice, discount, minFee);
    const purchaseCost = qn * currentPrice + fee;

    // 超過預算則剔除
    if (purchaseCost > budget) continue;

    const totalQty = currentQty + qn;
    const totalCost = currentCost + purchaseCost;
    
    // 計算新均價 (Pavg = 總成本 / 總股數)
    const avgPrice = totalCost / totalQty;

    // 尋找最接近的偶數整數
    const pEven = Math.round(avgPrice / 2) * 2;
    const evenDeviation = Math.abs(avgPrice - pEven);

    // 完美整除且為偶數的條件：偏差非常接近 0 (小於浮點數誤差 1e-9)
    // 且新均價的四捨五入整數為偶數
    const isInteger = Math.abs(totalCost % totalQty) === 0;
    const isPerfect = isInteger && (Math.round(avgPrice) % 2 === 0);

    // 股數湊整獎勵 (Rqty)
    let qtyReward = 0;
    if (totalQty % 1000 === 0) {
      qtyReward = 10.0;
    } else if (totalQty % 100 === 0) {
      qtyReward = 1.0;
    } else if (totalQty % 10 === 0) {
      qtyReward = 0.1;
    }

    // 評分 (Score = Sdev - Rqty)。分數越低代表越優
    const score = evenDeviation - qtyReward;

    // 新增指標計算
    const capitalEfficiency = (purchaseCost / budget) * 100;
    const remainingBudget = budget - purchaseCost;
    const avgPriceDiff = currentQty === 0 ? 0 : avgPrice - currentAvgPrice;
    const avgPriceDiffPercent = currentQty === 0 ? 0 : ((avgPrice - currentAvgPrice) / currentAvgPrice) * 100;
    const qtyIncreasePercent = currentQty === 0 ? 100 : (qn / currentQty) * 100;
    const postMarketValue = totalQty * currentPrice;

    suggestions.push({
      qtyToBuy: qn,
      cost: purchaseCost,
      fee,
      totalQty,
      avgPrice,
      evenDeviation,
      isPerfect,
      score,
      capitalEfficiency,
      remainingBudget,
      avgPriceDiff,
      avgPriceDiffPercent,
      qtyIncreasePercent,
      postMarketValue
    });
  }

  // 依照 Score 升序排列
  const sorted = suggestions.sort((a, b) => a.score - b.score);

  if (sorted.length === 0) {
    return { perfect: null, quantity: null, budgetMax: null, all: [] };
  }

  // 策略 1：均價整數優先 (Perfect Rounding)
  // 優先尋找 isPerfect 的解。若無，則尋找偏差最低且能整除（無小數點）的解，最後才是偏差最低的解。
  let perfectMatch = sorted.find(s => s.isPerfect);
  if (!perfectMatch) {
    // 尋找偏差小於 1e-9 的解 (即能整除但可能是奇數)
    perfectMatch = sorted.find(s => s.evenDeviation < 1e-9);
  }
  if (!perfectMatch) {
    // 尋找偏差最低的解
    perfectMatch = sorted[0];
  }

  // 策略 2：整張股數優先 (Quantity Rounding)
  // 在均價偏差小於 0.5 (四捨五入可視為整數) 的條件下，優先推薦使交易後總股數為 1000 倍數的組合
  // 若沒有 1000 倍數，尋找 100 倍數。若都沒有，則取 score 最低的。
  let qtyMatch = sorted.find(s => s.evenDeviation < 0.5 && s.totalQty % 1000 === 0);
  if (!qtyMatch) {
    qtyMatch = sorted.find(s => s.evenDeviation < 0.5 && s.totalQty % 100 === 0);
  }
  if (!qtyMatch) {
    qtyMatch = sorted.find(s => s.evenDeviation < 0.5);
  }
  // 保障 fallback
  if (!qtyMatch) {
    qtyMatch = sorted[0];
  }

  // 策略 3：預算最大化 (Budget Maximization)
  // 在均價偏差小於 1.0 的條件下，推薦實際購入金額最接近預算上限 B 的組合
  const budgetCandidates = sorted.filter(s => s.evenDeviation < 1.0);
  let budgetMatch: OptimizationSuggestion | null = null;
  if (budgetCandidates.length > 0) {
    // 依購入金額遞減排序，取最大者
    budgetMatch = [...budgetCandidates].sort((a, b) => b.cost - a.cost)[0];
  } else {
    // fallback
    budgetMatch = sorted[0];
  }

  return {
    perfect: perfectMatch,
    quantity: qtyMatch,
    budgetMax: budgetMatch,
    all: sorted
  };
}
