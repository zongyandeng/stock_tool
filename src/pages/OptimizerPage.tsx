import React, { useState, useEffect } from 'react';
import { useDb } from '../context/DbContext';
import { priceRepository } from '../api/price';
import type { PriceInfo } from '../api/price';
import { optimizeStockPurchase } from '../optimizer/optimizer';
import type { OptimizationResult, OptimizationSuggestion } from '../optimizer/optimizer';
import { 
  Search, Calculator, Star, Sparkles, RefreshCw, AlertCircle, 
  ChevronDown, Check, Coins, Layers
} from 'lucide-react';

export const OptimizerPage: React.FC = () => {
  const { brokers, activeBroker, saveTrade, trades } = useDb();

  // 股票查詢
  const [symbol, setSymbol] = useState<string>('');
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [priceError, setPriceError] = useState<string>('');
  const [isManualPrice, setIsManualPrice] = useState<boolean>(false);

  // 試算輸入
  const [currentQty, setCurrentQty] = useState<number>(0);
  const [currentAvgPrice, setCurrentAvgPrice] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<number>(0); // Pc (試算時用的股價)
  const [budget, setBudget] = useState<number>(100000); // 預設 10 萬元
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('');
  
  // 試算結果
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [showAllCandidates, setShowAllCandidates] = useState<boolean>(false);
  
  // 記帳備忘
  const [noteText, setNoteText] = useState<string>('');
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // 初始化選擇券商
  useEffect(() => {
    if (activeBroker) {
      setSelectedBrokerId(activeBroker.id);
    }
  }, [activeBroker]);

  // 偵測輸入的股票代號是否在歷史交易中已有持股，以供一鍵填入
  const matchedHolding = React.useMemo(() => {
    if (!symbol.trim()) return null;
    
    // 依個股 GroupBy 統計持股
    const holdingsMap = new Map<string, { symbol: string, name: string, qty: number, totalCost: number }>();
    trades.forEach((t) => {
      const cost = t.qty * t.price + t.fee;
      const existing = holdingsMap.get(t.symbol);
      if (existing) {
        existing.qty += t.qty;
        existing.totalCost += cost;
      } else {
        holdingsMap.set(t.symbol, { symbol: t.symbol, name: t.name, qty: t.qty, totalCost: cost });
      }
    });

    const holding = holdingsMap.get(symbol.trim());
    if (holding && holding.qty > 0) {
      return {
        qty: holding.qty,
        avgPrice: holding.totalCost / holding.qty
      };
    }
    return null;
  }, [symbol, trades]);

  // 查詢最新行情
  const handleFetchPrice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!symbol.trim()) return;

    setIsLoadingPrice(true);
    setPriceError('');
    setIsManualPrice(false);
    setPriceInfo(null);
    setOptResult(null);

    try {
      const info = await priceRepository.fetchPrice(symbol);
      setPriceInfo(info);
      setTargetPrice(info.price);
      
      // 自動填入股票代號
      setErrorPrompt('');
    } catch (err: any) {
      setPriceError(err.message || '查詢失敗，已切換至手動輸入價格模式。');
      setIsManualPrice(true);
      // 提供一個預設值以防出錯
      setTargetPrice(0);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const [errorPrompt, setErrorPrompt] = useState<string>('');

  // 選擇券商設定
  const brokerToUse = brokers.find(b => b.id === selectedBrokerId) || activeBroker;

  // 開始試算
  const handleCalculate = () => {
    if (targetPrice <= 0) {
      setErrorPrompt('請輸入大於 0 的當前市價');
      return;
    }
    if (!brokerToUse) {
      setErrorPrompt('請先在設定中建立券商資料');
      return;
    }

    setErrorPrompt('');

    const result = optimizeStockPurchase(
      currentQty,
      currentAvgPrice,
      targetPrice,
      budget,
      brokerToUse.discount,
      brokerToUse.minFee
    );
    setOptResult(result);
  };

  // 即時重新計算 (當 budget, broker 變更時，若已有結果則自動重算)
  useEffect(() => {
    if (targetPrice > 0 && brokerToUse) {
      const result = optimizeStockPurchase(
        currentQty,
        currentAvgPrice,
        targetPrice,
        budget,
        brokerToUse.discount,
        brokerToUse.minFee
      );
      setOptResult(result);
    }
  }, [budget, selectedBrokerId, currentQty, currentAvgPrice, targetPrice]);

  // 一鍵記帳
  const handleRecordTrade = async (suggestion: OptimizationSuggestion) => {
    if (!brokerToUse) return;
    
    const stockName = priceInfo?.name || `台股-${symbol}`;
    
    if (window.confirm(`確定要記錄此筆交易嗎？\n股票：${stockName} (${symbol})\n購入股數：${suggestion.qtyToBuy.toLocaleString()} 股\n單價：$${targetPrice} 元\n手續費：$${suggestion.fee} 元`)) {
      try {
        await saveTrade({
          symbol: symbol.trim(),
          name: stockName,
          qty: suggestion.qtyToBuy,
          price: targetPrice,
          fee: suggestion.fee,
          brokerId: brokerToUse.id,
          notes: noteText.trim() || undefined
        });

        // 成功提示
        setToastMessage(`記帳成功！購入 ${suggestion.qtyToBuy.toLocaleString()} 股 ${stockName}`);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
        
        // 成功後重設
        setNoteText('');
        // 自動更新現有持股數 (為剛才交易後的總股數) 與均價
        setCurrentQty(suggestion.totalQty);
        setCurrentAvgPrice(suggestion.avgPrice);
        setOptResult(null); // 清空推薦，引導下次操作
      } catch (err) {
        console.error(err);
        alert('記帳失敗，資料庫加密未解鎖');
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-28 pt-6 max-w-md mx-auto w-full space-y-5">
      {/* 成功記帳 Toast */}
      {showSuccessToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-500 text-slate-950 font-bold py-3 px-6 rounded-2xl shadow-xl transition-all duration-300 transform scale-100 border border-emerald-400">
          <Check className="h-5 w-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. 行情查詢區塊 */}
      <div className="glass-panel rounded-3xl p-5 border border-slate-800/60 shadow-xl space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-emerald-400" />
          1. 台股行情即時查詢
        </h2>
        
        <form onSubmit={handleFetchPrice} className="flex gap-2">
          <input
            type="text"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="輸入台股代碼 (如 2330, 2317)"
            className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 transition-smooth text-sm font-outfit"
          />
          <button
            type="submit"
            disabled={isLoadingPrice || !symbol.trim()}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 rounded-2xl font-bold text-xs transition-smooth disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
          >
            {isLoadingPrice ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                查詢
              </>
            )}
          </button>
        </form>

        {/* 查詢結果 */}
        {priceError && (
          <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{priceError}</span>
          </div>
        )}

        {priceInfo && (
          <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 transition-smooth">
            <div>
              <span className="text-xs text-slate-400 block font-semibold">
                {priceInfo.name} ({priceInfo.symbol})
              </span>
              <div className="flex items-center gap-2 mt-1">
                <strong className="text-2xl font-black text-white font-outfit">
                  ${priceInfo.price.toFixed(2)}
                </strong>
                <span className="text-[10px] text-slate-500">元</span>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold border ${
                priceInfo.source === 'TWSE' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : priceInfo.source === 'Yahoo'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
              }`}>
                {priceInfo.source === 'TWSE' && '證交所即時'}
                {priceInfo.source === 'Yahoo' && 'Yahoo延遲'}
                {priceInfo.source === 'Mock' && '模擬報價'}
              </span>
              <span className="text-[9px] text-slate-500 block mt-1">
                {priceInfo.isRealTime ? '即時更新中' : '15分鐘延遲'}
              </span>
            </div>
          </div>
        )}

        {/* 手動輸入股價 (Fallback) */}
        {isManualPrice && (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              手動輸入當前市價 ($Pc)
            </label>
            <div className="relative">
              <input
                type="number"
                value={targetPrice || ''}
                onChange={e => setTargetPrice(parseFloat(e.target.value) || 0)}
                placeholder="例如 942.0"
                step="any"
                className="w-full bg-slate-950 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/80 text-sm font-outfit"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-semibold">元</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. 持股與設定輸入區塊 */}
      <div className="glass-panel rounded-3xl p-5 border border-slate-800/60 shadow-xl space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-emerald-400" />
          2. 持有狀態與預算設定
        </h2>

        {/* 快速帶入現有持股 */}
        {matchedHolding && (
          <button
            onClick={() => {
              setCurrentQty(matchedHolding.qty);
              setCurrentAvgPrice(parseFloat(matchedHolding.avgPrice.toFixed(4)));
            }}
            className="w-full text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/5 border border-emerald-500/20 py-2 rounded-xl transition-smooth flex items-center justify-center gap-1"
          >
            📋 一鍵帶入現有持股 ({matchedHolding.qty.toLocaleString()} 股 @ ${matchedHolding.avgPrice.toFixed(2)})
          </button>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              現有持股數 (Qe)
            </label>
            <input
              type="number"
              value={currentQty || ''}
              onChange={e => setCurrentQty(parseInt(e.target.value) || 0)}
              placeholder="0 (無持股)"
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/80 text-xs font-outfit"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              現有持股均價 (Pe)
            </label>
            <input
              type="number"
              value={currentAvgPrice || ''}
              onChange={e => setCurrentAvgPrice(parseFloat(e.target.value) || 0)}
              placeholder="0.0"
              step="any"
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/80 text-xs font-outfit"
            />
          </div>
        </div>

        {/* 券商選擇 */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
            使用計算券商手續費
          </label>
          <div className="relative">
            <select
              value={selectedBrokerId}
              onChange={e => setSelectedBrokerId(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/80 text-xs appearance-none cursor-pointer"
            >
              {brokers.map(b => (
                <option key={b.id} value={b.id} className="bg-slate-950 text-white">
                  {b.name} (折扣:{Math.round(b.discount * 100)}%, 最低:{b.minFee}元)
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4 pointer-events-none" />
          </div>
        </div>

        {/* 預算上限 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <label className="font-bold text-slate-400 uppercase tracking-wider">
              本次買入預算上限 (B)
            </label>
            <strong className="text-emerald-400 font-black font-outfit">
              ${budget.toLocaleString()} 元
            </strong>
          </div>
          
          <input
            type="range"
            min="1000"
            max="1000000"
            step="1000"
            value={budget}
            onChange={e => setBudget(parseInt(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          
          {/* 預算快捷鍵 */}
          <div className="flex gap-1.5">
            {[10000, 50000, 100000, 300000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setBudget(val)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-smooth ${
                  budget === val 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-500' 
                    : 'bg-slate-900/30 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                ${val / 10000}萬
              </button>
            ))}
          </div>
        </div>

        {errorPrompt && (
          <div className="text-xs text-rose-400 font-semibold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
            {errorPrompt}
          </div>
        )}

        <button
          onClick={handleCalculate}
          disabled={targetPrice <= 0}
          className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold py-3 rounded-2xl transition-smooth shadow-lg shadow-emerald-500/10 active:scale-95 text-sm"
        >
          <Calculator className="h-4.5 w-4.5" />
          開始智慧湊整試算
        </button>
      </div>

      {/* 3. 試算推薦展示區塊 */}
      {optResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
              3. 黃金優化推薦策略
            </h3>
            <span className="text-[10px] text-slate-500">已計入估算手續費</span>
          </div>

          {/* 備忘錄欄位 (記帳用) */}
          <div className="glass-panel rounded-2xl p-4 border border-slate-800/60 shadow-md">
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              記帳備忘備註 (選填，如：定期定額、折讓均價)
            </label>
            <input
              type="text"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="為這筆買入寫下一些備註..."
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/80 text-xs"
            />
          </div>

          {/* 三大策略卡片 */}
          <div className="space-y-4">
            {/* 策略 A: 均價整數優先 */}
            {optResult.perfect && (
              <div className="glass-panel border-l-4 border-l-emerald-500 rounded-2xl p-4 border border-slate-800/60 shadow-xl space-y-3 relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 py-0.5 px-2.5 rounded-full border border-emerald-500/20 w-fit">
                      <Star className="h-3 w-3 fill-current" />
                      完美均價整數優先 (推薦)
                    </span>
                    <h4 className="text-2xl font-black text-white font-outfit mt-2">
                      +{optResult.perfect.qtyToBuy.toLocaleString()} <span className="text-xs text-slate-400 font-normal">股</span>
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block">偏差度</span>
                    <strong className="text-sm font-bold text-slate-200 font-outfit block mt-0.5">
                      {optResult.perfect.evenDeviation.toFixed(4).replace(/\.?0+$/, '')}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-850 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 block">需準備資金 (含手續費)</span>
                    <strong className="text-slate-200 font-outfit font-bold">${optResult.perfect.cost.toLocaleString()} 元</strong>
                    <span className="text-[8px] text-slate-500 block mt-0.5">(手續費: ${optResult.perfect.fee} 元)</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">交易後持有均價</span>
                    <strong className="text-emerald-400 font-outfit font-bold">${optResult.perfect.avgPrice.toFixed(4).replace(/\.?0+$/, '')} 元</strong>
                    <span className="text-[8px] text-slate-500 block mt-0.5">(交易後總股數: {optResult.perfect.totalQty.toLocaleString()} 股)</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRecordTrade(optResult.perfect!)}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded-xl text-xs transition-smooth shadow-md shadow-emerald-500/10 active:scale-95"
                >
                  一鍵記錄此筆交易
                </button>
              </div>
            )}

            {/* 策略 B: 整張股數優先 */}
            {optResult.quantity && optResult.quantity.qtyToBuy !== optResult.perfect?.qtyToBuy && (
              <div className="glass-panel border-l-4 border-l-blue-500 rounded-2xl p-4 border border-slate-800/60 shadow-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 py-0.5 px-2.5 rounded-full border border-blue-500/20 w-fit">
                      <Layers className="h-3 w-3" />
                      整張股數湊整優先
                    </span>
                    <h4 className="text-2xl font-black text-white font-outfit mt-2">
                      +{optResult.quantity.qtyToBuy.toLocaleString()} <span className="text-xs text-slate-400 font-normal">股</span>
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block">偏差度</span>
                    <strong className="text-sm font-bold text-slate-200 font-outfit block mt-0.5">
                      {optResult.quantity.evenDeviation.toFixed(4).replace(/\.?0+$/, '')}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-850 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 block">需準備資金 (含手續費)</span>
                    <strong className="text-slate-200 font-outfit font-bold">${optResult.quantity.cost.toLocaleString()} 元</strong>
                    <span className="text-[8px] text-slate-500 block mt-0.5">(手續費: ${optResult.quantity.fee} 元)</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">交易後持有均價</span>
                    <strong className="text-blue-400 font-outfit font-bold">${optResult.quantity.avgPrice.toFixed(4).replace(/\.?0+$/, '')} 元</strong>
                    <span className="text-[8px] text-slate-500 block mt-0.5">(交易後總股數: {optResult.quantity.totalQty.toLocaleString()} 股)</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRecordTrade(optResult.quantity!)}
                  className="w-full bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold py-2 rounded-xl text-xs transition-smooth shadow-md shadow-blue-500/10 active:scale-95"
                >
                  一鍵記錄此筆交易
                </button>
              </div>
            )}

            {/* 策略 C: 預算最大化 */}
            {optResult.budgetMax && optResult.budgetMax.qtyToBuy !== optResult.perfect?.qtyToBuy && optResult.budgetMax.qtyToBuy !== optResult.quantity?.qtyToBuy && (
              <div className="glass-panel border-l-4 border-l-purple-500 rounded-2xl p-4 border border-slate-800/60 shadow-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-500/10 py-0.5 px-2.5 rounded-full border border-purple-500/20 w-fit">
                      <Coins className="h-3 w-3" />
                      預算利用最大化
                    </span>
                    <h4 className="text-2xl font-black text-white font-outfit mt-2">
                      +{optResult.budgetMax.qtyToBuy.toLocaleString()} <span className="text-xs text-slate-400 font-normal">股</span>
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block">偏差度</span>
                    <strong className="text-sm font-bold text-slate-200 font-outfit block mt-0.5">
                      {optResult.budgetMax.evenDeviation.toFixed(4).replace(/\.?0+$/, '')}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-850 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 block">需準備資金 (含手續費)</span>
                    <strong className="text-slate-200 font-outfit font-bold">${optResult.budgetMax.cost.toLocaleString()} 元</strong>
                    <span className="text-[8px] text-slate-500 block mt-0.5">(手續費: ${optResult.budgetMax.fee} 元)</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">交易後持有均價</span>
                    <strong className="text-purple-400 font-outfit font-bold">${optResult.budgetMax.avgPrice.toFixed(4).replace(/\.?0+$/, '')} 元</strong>
                    <span className="text-[8px] text-slate-500 block mt-0.5">(交易後總股數: {optResult.budgetMax.totalQty.toLocaleString()} 股)</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRecordTrade(optResult.budgetMax!)}
                  className="w-full bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold py-2 rounded-xl text-xs transition-smooth shadow-md shadow-purple-500/10 active:scale-95"
                >
                  一鍵記錄此筆交易
                </button>
              </div>
            )}
          </div>

          {/* 4. 展開所有候選清單 */}
          <div className="pt-2">
            <button
              onClick={() => setShowAllCandidates(!showAllCandidates)}
              className="w-full py-2.5 text-xs text-slate-400 hover:text-white border border-slate-800 rounded-xl bg-slate-900/20 transition-smooth font-bold"
            >
              {showAllCandidates ? '收起候選清單 ▲' : '展開所有候選清單 (Top 20) ▼'}
            </button>

            {showAllCandidates && (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 text-left">
                <table className="w-full border-collapse text-left text-xs text-slate-400">
                  <thead className="bg-slate-900 text-[10px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">購入股數</th>
                      <th className="py-2.5 px-3">準備金額</th>
                      <th className="py-2.5 px-3">交易後總股</th>
                      <th className="py-2.5 px-3">估計均價</th>
                      <th className="py-2.5 px-3 text-right">偶數偏差</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {optResult.all.slice(0, 20).map((cand, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/30">
                        <td className="py-2 px-3 font-bold text-white">+{cand.qtyToBuy.toLocaleString()}</td>
                        <td className="py-2 px-3">${cand.cost.toLocaleString()}</td>
                        <td className="py-2 px-3">{cand.totalQty.toLocaleString()}</td>
                        <td className={`py-2 px-3 font-semibold ${cand.evenDeviation < 1e-9 ? 'text-emerald-400' : 'text-slate-300'}`}>
                          ${cand.avgPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-outfit text-slate-400">
                          {cand.evenDeviation.toFixed(4).replace(/\.?0+$/, '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
