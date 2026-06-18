import React, { useState, useEffect } from 'react';
import { useDb } from '../context/DbContext';
import { priceRepository } from '../api/price';
import type { PriceInfo } from '../api/price';
import { optimizeStockPurchase } from '../optimizer/optimizer';
import type { OptimizationSuggestion } from '../optimizer/optimizer';
import { 
  Search, Calculator, Star, Sparkles, RefreshCw, AlertCircle, 
  ChevronDown, Check, Coins, Layers
} from 'lucide-react';

export const OptimizerPage: React.FC = () => {
  const { brokers, activeBroker, saveTrade, trades } = useDb();

  // 股票查詢
  const [symbol, setSymbol] = useState<string>(() => sessionStorage.getItem('opt_symbol') || '');
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(() => {
    try {
      const val = sessionStorage.getItem('opt_priceInfo');
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  });
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [priceError, setPriceError] = useState<string>('');
  const [isManualPrice, setIsManualPrice] = useState<boolean>(() => sessionStorage.getItem('opt_isManualPrice') === 'true');

  // 試算輸入
  const [currentQty, setCurrentQty] = useState<number>(() => parseInt(sessionStorage.getItem('opt_currentQty') || '0'));
  const [currentAvgPrice, setCurrentAvgPrice] = useState<number>(() => parseFloat(sessionStorage.getItem('opt_currentAvgPrice') || '0'));
  const [targetPrice, setTargetPrice] = useState<number>(() => parseFloat(sessionStorage.getItem('opt_targetPrice') || '0')); // Pc (試算時用的股價)
  const [budget, setBudget] = useState<number>(() => parseInt(sessionStorage.getItem('opt_budget') || '100000')); // 預設 10 萬元
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>(() => sessionStorage.getItem('opt_selectedBrokerId') || '');

  // 用於 UI 顯示與限制輸入的字串狀態
  const [qtyInput, setQtyInput] = useState<string>(() => {
    const val = sessionStorage.getItem('opt_currentQty') || '0';
    return val === '0' ? '' : val;
  });
  const [avgPriceInput, setAvgPriceInput] = useState<string>(() => {
    const val = sessionStorage.getItem('opt_currentAvgPrice') || '0';
    return val === '0' ? '' : val;
  });
  const [budgetInput, setBudgetInput] = useState<string>(() => sessionStorage.getItem('opt_budget') || '100000');



  const [showAllCandidates, setShowAllCandidates] = useState<boolean>(false);
  
  // 記帳備忘
  const [noteText, setNoteText] = useState<string>(() => sessionStorage.getItem('opt_noteText') || '');
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

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

  // 新增/重構行情查詢與演算法展開狀態
  const [showAlgoInfo, setShowAlgoInfo] = useState<boolean>(false);

  const fetchPriceDirectly = async (sym: string) => {
    if (!sym.trim()) return;
    setIsLoadingPrice(true);
    setPriceError('');
    setIsManualPrice(false);
    setPriceInfo(null);

    try {
      const info = await priceRepository.fetchPrice(sym);
      setPriceInfo(info);
      setTargetPrice(info.price);
    } catch (err: any) {
      setPriceError(err.message || '查詢失敗，已切換至手動輸入價格模式。');
      setIsManualPrice(true);
      setTargetPrice(0);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleFetchPrice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    fetchPriceDirectly(symbol);
  };
  // 選擇券商設定
  const brokerToUse = brokers.find(b => b.id === selectedBrokerId) || activeBroker;

  // 衍生狀態計算 (智慧試算結果與錯誤提示)
  const { optResult, errorPrompt } = React.useMemo(() => {
    if (!brokerToUse) {
      return { optResult: null, errorPrompt: '請先在設定中建立券商資料' };
    }
    if (targetPrice <= 0) {
      return { optResult: null, errorPrompt: symbol ? '請輸入大於 0 的當前市價' : '' };
    }
    const result = optimizeStockPurchase(
      currentQty,
      currentAvgPrice,
      targetPrice,
      budget,
      brokerToUse.discount,
      brokerToUse.minFee
    );
    return { optResult: result, errorPrompt: '' };
  }, [currentQty, currentAvgPrice, targetPrice, budget, brokerToUse, symbol]);

  // 當狀態變更時，將試算狀態寫入 sessionStorage
  useEffect(() => {
    sessionStorage.setItem('opt_symbol', symbol);
    sessionStorage.setItem('opt_priceInfo', priceInfo ? JSON.stringify(priceInfo) : '');
    sessionStorage.setItem('opt_isManualPrice', String(isManualPrice));
    sessionStorage.setItem('opt_currentQty', String(currentQty));
    sessionStorage.setItem('opt_currentAvgPrice', String(currentAvgPrice));
    sessionStorage.setItem('opt_targetPrice', String(targetPrice));
    sessionStorage.setItem('opt_budget', String(budget));
    sessionStorage.setItem('opt_selectedBrokerId', selectedBrokerId);
    sessionStorage.setItem('opt_optResult', optResult ? JSON.stringify(optResult) : '');
    sessionStorage.setItem('opt_noteText', noteText);
  }, [symbol, priceInfo, isManualPrice, currentQty, currentAvgPrice, targetPrice, budget, selectedBrokerId, optResult, noteText]);

  // 星級評分渲染
  const renderQualityStars = (deviation: number) => {
    let stars = 5;
    if (deviation > 0.8) stars = 1;
    else if (deviation > 0.5) stars = 2;
    else if (deviation > 0.2) stars = 3;
    else if (deviation > 0.01) stars = 4;
    
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Star
            key={idx}
            className={`h-3 w-3 ${
              idx < stars ? 'fill-amber-400 text-amber-400 font-bold' : 'text-slate-700'
            }`}
          />
        ))}
      </div>
    );
  };

  // 股數變化比例圖 (水平條狀圖)
  const renderQtyBar = (suggestion: any) => {
    const total = suggestion.totalQty;
    const prevPercent = total > 0 ? (currentQty / total) * 100 : 0;
    const newPercent = total > 0 ? (suggestion.qtyToBuy / total) * 100 : 0;
    return (
      <div className="space-y-1.5 mt-2 bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/40">
        <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
          <span>原持股: {currentQty.toLocaleString()} 股 ({Math.round(prevPercent)}%)</span>
          <span>新買入: +{suggestion.qtyToBuy.toLocaleString()} 股 ({Math.round(newPercent)}%)</span>
        </div>
        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex border border-slate-900">
          <div className="bg-slate-600 h-full" style={{ width: `${prevPercent}%` }} />
          <div className="bg-emerald-500 h-full" style={{ width: `${newPercent}%` }} />
        </div>
      </div>
    );
  };

  // 均價優化軌跡
  const renderPriceTrajectory = (suggestion: any) => {
    const prices = [currentAvgPrice, targetPrice, suggestion.avgPrice].filter(p => p > 0);
    if (prices.length === 0) return null;
    const min = Math.min(...prices) * 0.99;
    const max = Math.max(...prices) * 1.01;
    const range = max - min;
    const getPercent = (val: number) => {
      if (range === 0) return 50;
      return 15 + ((val - min) / range) * 70; // 限制在 15% - 85% 之間
    };

    const prevLeft = currentQty > 0 ? getPercent(currentAvgPrice) : 0;
    const targetLeft = getPercent(targetPrice);
    const newLeft = getPercent(suggestion.avgPrice);

    return (
      <div className="space-y-1.5 mt-2 bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/40">
        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">均價變化軌跡 ($Pc / $Pe / $Pavg)</span>
        <div className="relative h-10 mt-1">
          {/* 軸線 */}
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-slate-800" />
          
          {/* 原均價點 */}
          {currentQty > 0 && (
            <div className="absolute flex flex-col items-center -translate-x-1/2" style={{ left: `${prevLeft}%` }}>
              <div className="h-2 w-2 rounded-full bg-slate-500" />
              <span className="text-[8px] text-slate-500 mt-1 font-outfit font-medium">原:${currentAvgPrice.toFixed(1)}</span>
            </div>
          )}
          
          {/* 當前市價點 */}
          <div className="absolute flex flex-col items-center -translate-x-1/2" style={{ left: `${targetLeft}%` }}>
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-[8px] text-blue-400 mt-1 font-outfit font-medium">市價:${targetPrice.toFixed(1)}</span>
          </div>
          
          {/* 交易後均價點 */}
          <div className="absolute flex flex-col items-center -translate-x-1/2 animate-pulse" style={{ left: `${newLeft}%` }}>
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
            <span className="text-[8px] text-emerald-400 mt-1 font-outfit font-bold">新:${suggestion.avgPrice.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderStrategyCard = (
    title: string,
    tagColor: string,
    borderColor: string,
    icon: React.ReactNode,
    suggestion: any,
    btnBgColor: string,
    isRecommended = false
  ) => {
    if (!suggestion) return null;

    // 計算均價變化顯示
    const diffVal = suggestion.avgPriceDiff;
    const diffPercent = suggestion.avgPriceDiffPercent;
    let diffText = '無變化';
    let diffColor = 'text-slate-400';
    if (currentQty === 0) {
      diffText = '新建倉';
    } else if (diffVal < 0) {
      diffText = `${diffVal.toFixed(2)}元 (${diffPercent.toFixed(2)}%)`;
      diffColor = 'text-emerald-400 font-bold';
    } else if (diffVal > 0) {
      diffText = `+${diffVal.toFixed(2)}元 (+${diffPercent.toFixed(2)}%)`;
      diffColor = 'text-rose-400';
    }

    return (
      <div className={`glass-panel border-l-4 ${borderColor} rounded-2xl p-5 border border-slate-800/60 shadow-xl space-y-4 relative overflow-hidden transition-smooth hover:border-slate-700/80 ${
        isRecommended ? 'ring-1 ring-emerald-500/30 shadow-emerald-950/20' : ''
      }`}>
        {isRecommended && (
          <div className="absolute right-0 top-0 bg-gradient-to-l from-amber-500/20 to-transparent text-[9px] font-black text-amber-400 py-1 px-3 rounded-bl-xl border-l border-b border-amber-500/30 tracking-wider">
            ★ GOLDEN CHOICE
          </div>
        )}

        {/* 標題與星等 */}
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <span className={`flex items-center gap-1 text-[10px] font-bold ${tagColor} bg-slate-900/60 py-0.5 px-2.5 rounded-full border border-slate-800/80 w-fit`}>
              {icon}
              {title}
            </span>
            <h4 className="text-2xl font-black text-white font-outfit mt-1.5">
              +{suggestion.qtyToBuy.toLocaleString()} <span className="text-xs text-slate-400 font-normal">股</span>
            </h4>
          </div>
          <div className="text-right space-y-1">
            <span className="text-[9px] text-slate-500 block uppercase tracking-wider">配置品質</span>
            {renderQualityStars(suggestion.evenDeviation)}
            <span className="text-[8px] text-slate-400 block font-outfit">偏差: {suggestion.evenDeviation.toFixed(4).replace(/\.?0+$/, '')}</span>
          </div>
        </div>

        {/* 5大指標九宮格網格 */}
        <div className="grid grid-cols-2 gap-2.5 bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 text-xs">
          <div>
            <span className="text-[9px] text-slate-500 block">預算利用率</span>
            <strong className="text-slate-200 font-outfit font-bold">
              {suggestion.capitalEfficiency.toFixed(1)}%
            </strong>
            <span className="text-[8px] text-slate-500 block mt-0.5">({suggestion.cost.toLocaleString()} 元)</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block">剩餘預算</span>
            <strong className="text-slate-200 font-outfit font-bold">
              ${Math.floor(suggestion.remainingBudget).toLocaleString()} <span className="text-[9px] font-normal text-slate-400">元</span>
            </strong>
          </div>
          <div className="border-t border-slate-900/80 pt-2 col-span-2 flex justify-between">
            <div>
              <span className="text-[9px] text-slate-500 block">交易後持有均價</span>
              <strong className="text-white font-outfit font-extrabold text-sm">
                ${suggestion.avgPrice.toFixed(2)} <span className="text-[9px] font-normal text-slate-400">元</span>
              </strong>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-slate-500 block">均價成本變化</span>
              <strong className={`font-outfit text-[11px] ${diffColor}`}>
                {diffText}
              </strong>
            </div>
          </div>
          <div className="border-t border-slate-900/80 pt-2 col-span-2 flex justify-between">
            <div>
              <span className="text-[9px] text-slate-500 block">持股股數增加比率</span>
              <strong className="text-slate-300 font-outfit font-bold">
                +{suggestion.qtyIncreasePercent.toFixed(1)}%
              </strong>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-slate-500 block">交易後總市值</span>
              <strong className="text-slate-300 font-outfit font-bold">
                ${Math.floor(suggestion.postMarketValue).toLocaleString()} 元
              </strong>
            </div>
          </div>
        </div>

        {/* 視覺化圖表：股數條形圖與均價軌跡 */}
        <div className="space-y-2">
          {renderQtyBar(suggestion)}
          {renderPriceTrajectory(suggestion)}
        </div>

        <button
          onClick={() => handleRecordTrade(suggestion)}
          className={`w-full ${btnBgColor} hover:brightness-110 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-smooth shadow-md active:scale-98`}
        >
          一鍵記錄此筆交易
        </button>
      </div>
    );
  };



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
        setSymbol('');
        setPriceInfo(null);
        setTargetPrice(0);
        // 自動更新現有持股數 (為剛才交易後的總股數) 與均價
        setCurrentQty(suggestion.totalQty);
        setQtyInput(suggestion.totalQty === 0 ? '' : String(suggestion.totalQty));
        setCurrentAvgPrice(suggestion.avgPrice);
        setAvgPriceInput(suggestion.avgPrice === 0 ? '' : String(suggestion.avgPrice));
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

      {/* Hero 說明區塊 */}
      <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/20 border border-slate-800 shadow-2xl">
        <div className="relative z-10 space-y-2">
          <h1 className="text-base font-extrabold text-white tracking-tight font-outfit flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-emerald-400 animate-pulse" />
            台股智慧湊整投資智慧試算
          </h1>
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
            輸入本次買入預算與現有持股狀態，系統將自動演算並推薦最接近「完美偶數整數均價」或「整張股數」的配置方案，優化均價的同時也能將摩擦手續費減至最低！
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-emerald-500/5 blur-xl pointer-events-none" />
      </div>

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

        {/* 熱門股票快捷標籤 */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { symbol: '2330', name: '台積電' },
            { symbol: '2317', name: '鴻海' },
            { symbol: '0050', name: '元大台灣50' },
            { symbol: '00878', name: '國泰永續高股息' }
          ].map(stock => (
            <button
              key={stock.symbol}
              type="button"
              onClick={() => {
                setSymbol(stock.symbol);
                fetchPriceDirectly(stock.symbol);
              }}
              className="text-[10px] font-bold text-slate-400 bg-slate-900/30 hover:bg-slate-900/70 border border-slate-800/80 hover:border-emerald-500/50 py-1 px-2.5 rounded-full transition-smooth active:scale-95"
            >
              {stock.symbol} {stock.name}
            </button>
          ))}
        </div>

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
              setQtyInput(String(matchedHolding.qty));
              setCurrentAvgPrice(parseFloat(matchedHolding.avgPrice.toFixed(4)));
              setAvgPriceInput(matchedHolding.avgPrice.toFixed(4).replace(/\.?0+$/, ''));
            }}
            className="w-full text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/5 border border-emerald-500/20 py-2 rounded-xl transition-smooth flex items-center justify-center gap-1"
          >
            📋 一鍵帶入現有持股 ({matchedHolding.qty.toLocaleString()} 股 @ ${matchedHolding.avgPrice.toFixed(2)})
          </button>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              現有持股數 (QE)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={qtyInput}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setQtyInput(val);
                setCurrentQty(val ? parseInt(val) : 0);
              }}
              placeholder="0 (無持股)"
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/80 text-xs font-outfit"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
              現有持股均價 (PE)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={avgPriceInput}
              onChange={e => {
                let val = e.target.value.replace(/[^0-9.]/g, '');
                const parts = val.split('.');
                if (parts.length > 2) {
                  val = parts[0] + '.' + parts.slice(1).join('');
                }
                setAvgPriceInput(val);
                setCurrentAvgPrice(val ? parseFloat(val) : 0);
              }}
              placeholder="0.0"
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
            <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-700/50 rounded-xl px-2.5 py-1">
              <span className="text-emerald-400 font-bold">$</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={budgetInput}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setBudgetInput(val);
                  setBudget(val ? parseInt(val) : 0);
                }}
                className="w-20 bg-transparent text-emerald-400 font-black font-outfit focus:outline-none text-right"
              />
              <span className="text-emerald-400 font-bold">元</span>
            </div>
          </div>
          
          <input
            type="range"
            min="1000"
            max="1000000"
            step="1000"
            value={budget || 0}
            onChange={e => {
              const val = parseInt(e.target.value) || 0;
              setBudget(val);
              setBudgetInput(String(val));
            }}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          
          {/* 預算快捷鍵 */}
          <div className="flex gap-1.5">
            {[10000, 50000, 100000, 300000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setBudget(val);
                  setBudgetInput(String(val));
                }}
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
            {optResult.perfect && renderStrategyCard(
              "完美均價整數優先 (推薦)", 
              "text-amber-400", 
              "border-l-amber-500", 
              <Star className="h-3 w-3 fill-current text-amber-400" />, 
              optResult.perfect, 
              "bg-emerald-500 hover:bg-emerald-400", 
              true
            )}

            {/* 策略 B: 整張股數優先 */}
            {optResult.quantity && optResult.quantity.qtyToBuy !== optResult.perfect?.qtyToBuy && renderStrategyCard(
              "整張股數湊整優先", 
              "text-blue-400", 
              "border-l-blue-500", 
              <Layers className="h-3 w-3 text-blue-400" />, 
              optResult.quantity, 
              "bg-blue-500 hover:bg-blue-400"
            )}

            {/* 策略 C: 預算最大化 */}
            {optResult.budgetMax && optResult.budgetMax.qtyToBuy !== optResult.perfect?.qtyToBuy && optResult.budgetMax.qtyToBuy !== optResult.quantity?.qtyToBuy && renderStrategyCard(
              "預算利用最大化", 
              "text-purple-400", 
              "border-l-purple-500", 
              <Coins className="h-3 w-3 text-purple-400" />, 
              optResult.budgetMax, 
              "bg-purple-500 hover:bg-purple-400"
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

      {/* 💡 智慧湊整演算法運作原理 */}
      <div className="glass-panel rounded-3xl p-5 border border-slate-800/60 shadow-xl space-y-3">
        <button
          onClick={() => setShowAlgoInfo(!showAlgoInfo)}
          className="w-full flex items-center justify-between text-left focus:outline-none"
        >
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5 text-emerald-400" />
            💡 智慧湊整演算法運作原理
          </h2>
          <span className="text-xs text-slate-500 font-bold">
            {showAlgoInfo ? '收合 ▲' : '了解更多 ▼'}
          </span>
        </button>

        {showAlgoInfo && (
          <div className="text-[11px] text-slate-400 leading-relaxed space-y-3 pt-2 border-t border-slate-900">
            <div>
              <strong className="text-white block mb-0.5">步驟一：搜尋空間過濾 (Candidates Search)</strong>
              <p>為了防範預算極大時，逐股窮舉（例如幾十萬股）導致瀏覽器網頁畫面卡死，演算法會在最大股數大於 5,000 股時，智慧生成關鍵候選集合。該集合包含：1-999 股的所有零股、整百與整張股數，以及能使交易後總股數剛好湊滿最近整百與整張的「互補股數」，精準過濾無用搜尋空間。</p>
            </div>
            <div>
              <strong className="text-white block mb-0.5">步驟二：多目標優化計算 (Multi-Objective Evaluation)</strong>
              <p>針對每個擬購入股數候選人，精算其包含折扣後的券商手續費、實際交易金額、交易後之新總股數與新持有均價 $P_&#123;avg&#125; = (Q_e P_e + Q_n P_c + F_n) / (Q_e + Q_n)$。接著，計算該均價與最近偶數整數的絕對偏差（Deviation）。</p>
            </div>
            <div>
              <strong className="text-white block mb-0.5">步驟三：權重獎勵與黃金策略推薦</strong>
              <p>當交易後總股數為整張（1000 的倍數）或整百股時，給予評分獎勵。最後，結合偏差度與股數湊整度進行加權算分。綜合分數最低的將作為三大策略推薦：最完美整除的「完美均價整數優先」、股數最平整的「整股湊整優先」，與花費最接近預算的「預算利用最大化」。</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
