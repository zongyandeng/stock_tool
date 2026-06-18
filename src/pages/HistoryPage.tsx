import React, { useState } from 'react';
import { useDb } from '../context/DbContext';
import { History, Trash2, TrendingUp, Calendar, BarChart3, MessageSquare, ArrowUpRight } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const { trades, deleteTrade, brokers } = useDb();
  const [activeTab, setActiveTab] = useState<'holdings' | 'logs'>('holdings');
  const [hoveredSector, setHoveredSector] = useState<any>(null);

  const handleDelete = async (id: string, symbol: string, qty: number) => {
    if (window.confirm(`確定要刪除此筆「${symbol}」${qty} 股的交易紀錄嗎？`)) {
      try {
        await deleteTrade(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // 1. 依個股 GroupBy 統計持股狀態 (均價與總股數)
  const holdingsMap = new Map<string, {
    symbol: string;
    name: string;
    totalQty: number;
    totalCost: number; // 購買總金額 (含手續費)
    avgPrice: number;  // 均價 (總成本 / 總股數)
  }>();

  trades.forEach((t) => {
    const existing = holdingsMap.get(t.symbol);
    // 交易金額 = 股數 * 單價 + 手續費
    const cost = t.qty * t.price + t.fee;
    
    if (existing) {
      existing.totalQty += t.qty;
      existing.totalCost += cost;
      existing.avgPrice = existing.totalCost / existing.totalQty;
    } else {
      holdingsMap.set(t.symbol, {
        symbol: t.symbol,
        name: t.name,
        totalQty: t.qty,
        totalCost: cost,
        avgPrice: cost / t.qty
      });
    }
  });

  const holdingsList = Array.from(holdingsMap.values()).filter(h => h.totalQty > 0);

  // 計算整體投資組合總投入與環狀圖區塊數據
  const totalPortfolioCost = holdingsList.reduce((sum, h) => sum + h.totalCost, 0);
  const colors = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e'];
  
  let accumulatedPercent = 0;
  const sectors = holdingsList.map((h, idx) => {
    const percent = totalPortfolioCost > 0 ? (h.totalCost / totalPortfolioCost) * 100 : 0;
    const color = colors[idx % colors.length];
    const strokeDashoffset = 251.327 - (accumulatedPercent / 100) * 251.327;
    accumulatedPercent += percent;
    return {
      ...h,
      percent,
      color,
      strokeDasharray: `${(percent / 100) * 251.327} 251.327`,
      strokeDashoffset
    };
  });

  const getBrokerName = (id: string) => {
    return brokers.find(b => b.id === id)?.name || '未知券商';
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-6 max-w-md mx-auto w-full">
      {/* 頁面標題 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight font-outfit">持股歷史紀錄</h1>
        <p className="text-xs text-slate-400">檢視已持有個股統計及所有加密交易歷史明細</p>
      </div>

      {/* 切換分頁 */}
      <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 mb-6">
        <button
          onClick={() => setActiveTab('holdings')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-smooth flex items-center justify-center gap-1.5 ${
            activeTab === 'holdings'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          目前持股統計 ({holdingsList.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-smooth flex items-center justify-center gap-1.5 ${
            activeTab === 'logs'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          詳細交易日誌 ({trades.length})
        </button>
      </div>

      {activeTab === 'holdings' ? (
        /* 持股統計列表 */
        <div className="space-y-4">
          {holdingsList.length === 0 ? (
            <div className="glass-panel rounded-3xl p-10 text-center border border-dashed border-slate-800">
              <TrendingUp className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">尚無持股統計資料</p>
              <p className="text-slate-500 text-xs mt-1">當您在試算頁面點擊「記錄此筆交易」後，此處將自動彙整您的平均持股成本。</p>
            </div>
          ) : (
            <>
              {/* 環狀圖區塊 */}
              <div className="glass-panel rounded-3xl p-5 border border-slate-800/60 shadow-xl flex items-center justify-between gap-4">
                {/* 左側 SVG 圖 */}
                <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
                  <svg width="112" height="112" viewBox="0 0 100 100" className="-rotate-90">
                    <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="10" fill="transparent" />
                    {sectors.map((sector) => (
                      <circle
                        key={sector.symbol}
                        cx="50"
                        cy="50"
                        r="40"
                        stroke={sector.color}
                        strokeWidth="10"
                        strokeDasharray={sector.strokeDasharray}
                        strokeDashoffset={sector.strokeDashoffset}
                        fill="transparent"
                        strokeLinecap="round"
                        className="transition-all duration-300 hover:stroke-[12px] cursor-pointer"
                        onMouseEnter={() => setHoveredSector(sector)}
                        onMouseLeave={() => setHoveredSector(null)}
                      />
                    ))}
                  </svg>
                  {/* 中間顯示資訊 */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-1">
                    {hoveredSector ? (
                      <>
                        <span className="text-[9px] text-slate-400 font-bold max-w-[65px] truncate">{hoveredSector.name}</span>
                        <strong className="text-[12px] font-black font-outfit mt-0.5" style={{ color: hoveredSector.color }}>
                          {hoveredSector.percent.toFixed(1)}%
                        </strong>
                      </>
                    ) : (
                      <>
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">總投入</span>
                        <strong className="text-[10px] font-black text-white font-outfit truncate max-w-[75px]">
                          ${Math.floor(totalPortfolioCost).toLocaleString()}
                        </strong>
                        <span className="text-[7px] text-slate-500">元</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 右側圖例 */}
                <div className="flex-1 space-y-1.5 overflow-y-auto max-h-28 pr-1">
                  {sectors.slice(0, 6).map((sector) => (
                    <div key={sector.symbol} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 truncate max-w-[100px]">
                        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: sector.color }} />
                        <span className="text-slate-300 font-medium truncate">{sector.name}</span>
                      </div>
                      <span className="font-outfit font-bold text-slate-400">{sector.percent.toFixed(1)}%</span>
                    </div>
                  ))}
                  {sectors.length > 6 && (
                    <div className="text-[8px] text-slate-500 text-right font-medium">以及其他 {sectors.length - 6} 檔...</div>
                  )}
                </div>
              </div>

              {/* 持股卡片列表 */}
              {holdingsList.map((holding) => (
                <div
                  key={holding.symbol}
                  className="glass-panel rounded-3xl p-5 border border-slate-800/60 shadow-xl"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
                    <div>
                      <h3 className="font-extrabold text-white text-lg font-outfit flex items-center gap-2">
                        {holding.name}
                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold">
                          {holding.symbol}
                        </span>
                      </h3>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">持有總股數</span>
                      <strong className="text-2xl font-black text-white font-outfit mt-0.5 block">
                        {holding.totalQty.toLocaleString()} <span className="text-xs text-slate-400 font-normal">股</span>
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">平均持有成本 (均價)</span>
                      <strong className="text-2xl font-black text-emerald-400 font-outfit mt-0.5 block">
                        ${holding.avgPrice.toFixed(4).replace(/\.?0+$/, '')} <span className="text-xs text-slate-400 font-normal">元</span>
                      </strong>
                      {/* 提示是否為偶數與整數 */}
                      <span className="text-[9px] text-slate-500 mt-1 block">
                        {holding.avgPrice % 2 === 0 && holding.avgPrice % 1 === 0 ? (
                          <span className="text-emerald-400 font-bold">✓ 完美偶數整數</span>
                        ) : (
                          <span>未湊整 (有小數或為奇數)</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        /* 詳細交易日誌 */
        <div className="space-y-4">
          {trades.length === 0 ? (
            <div className="glass-panel rounded-3xl p-10 text-center border border-dashed border-slate-800">
              <History className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">尚無交易日誌</p>
              <p className="text-slate-500 text-xs mt-1">此處會以時間遞減順列顯示您加密儲存的每一筆買入紀錄。</p>
            </div>
          ) : (
            trades.map((trade) => (
              <div
                key={trade.id}
                className="glass-panel rounded-2xl p-4 border border-slate-800/60 shadow-md relative group hover:border-slate-700/60 transition-smooth"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm font-outfit">{trade.name} ({trade.symbol})</span>
                      <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                        {getBrokerName(trade.brokerId)}
                      </span>
                    </div>
                    
                    {/* 買入價格與股數 */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-300 font-medium">
                      <span>買入: <strong className="text-white">{trade.qty.toLocaleString()} 股</strong></span>
                      <span className="h-2 w-px bg-slate-800" />
                      <span>單價: <strong className="text-white">${trade.price}</strong></span>
                      <span className="h-2 w-px bg-slate-800" />
                      <span>手續費: <strong className="text-white">${trade.fee}</strong></span>
                    </div>

                    {/* 日期與備忘 */}
                    <div className="flex flex-col gap-1 mt-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(trade.timestamp).toLocaleString('zh-TW')}</span>
                      </div>
                      {trade.notes && (
                        <div className="flex items-start gap-1 text-[10px] text-slate-400 bg-slate-900/40 p-2 rounded-lg border border-slate-800/50 mt-1">
                          <MessageSquare className="h-3 w-3 mt-0.5 text-slate-500 shrink-0" />
                          <span>{trade.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(trade.id, trade.symbol, trade.qty)}
                    className="text-slate-500 hover:text-rose-400 p-2 rounded-xl hover:bg-slate-800/50 transition-smooth shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
