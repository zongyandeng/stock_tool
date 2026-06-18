import React, { useState } from 'react';
import { useDb } from '../context/DbContext';
import { Download, Upload, ShieldCheck, Database, ToggleLeft, ToggleRight, KeyRound, AlertTriangle, Type } from 'lucide-react';

interface SettingsPageProps {
  useMock: boolean;
  onToggleMock: (value: boolean) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ useMock, onToggleMock }) => {
  const { exportBackup, importBackup, clearAllTrades, lock } = useDb();
  
  const [backupPassword, setBackupPassword] = useState<string>('');
  const [fontSize, setFontSize] = useState<string>(() => localStorage.getItem('stock_tool_font_size') || '100%');

  const handleFontSizeChange = (size: string) => {
    setFontSize(size);
    localStorage.setItem('stock_tool_font_size', size);
    document.documentElement.style.fontSize = size;
  };
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupError, setBackupError] = useState<string>('');
  const [backupSuccess, setBackupSuccess] = useState<string>('');
  const [isBackupLoading, setIsBackupLoading] = useState<boolean>(false);

  // 匯出加密備份
  const handleExport = async () => {
    try {
      setIsBackupLoading(true);
      setBackupError('');
      setBackupSuccess('');
      
      const backupStr = await exportBackup();
      const blob = new Blob([backupStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const link = document.createElement('a');
      link.href = url;
      link.download = `stock_optimizer_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setBackupSuccess('加密備份檔案匯出成功，請妥善保存。');
    } catch (err) {
      setBackupError('匯出失敗，請確認資料庫是否正常解鎖。');
      console.error(err);
    } finally {
      setIsBackupLoading(false);
    }
  };

  // 匯入加密備份
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupFile) {
      setBackupError('請選擇要匯入的備份檔案 (.json)');
      return;
    }
    if (!backupPassword) {
      setBackupError('請輸入此備份檔案的 PIN 碼/密碼以供解密');
      return;
    }

    setIsBackupLoading(true);
    setBackupError('');
    setBackupSuccess('');

    try {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          const jsonStr = event.target?.result as string;
          const success = await importBackup(jsonStr, backupPassword);
          if (success) {
            setBackupSuccess('備份資料解密並匯入成功！系統已更新。');
            setBackupFile(null);
            setBackupPassword('');
            // 清理 file input
            const fileInput = document.getElementById('backupFileInput') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
          } else {
            setBackupError('解密失敗，可能密碼錯誤或檔案損毀。');
          }
        } catch (err) {
          setBackupError('檔案格式錯誤，無法解析。');
          console.error(err);
        } finally {
          setIsBackupLoading(false);
        }
      };
      fileReader.readAsText(backupFile);
    } catch (err) {
      setBackupError('讀取檔案失敗');
      setIsBackupLoading(false);
      console.error(err);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('⚠️ 警告：確定要清空所有歷史交易紀錄嗎？此動作將無法復原！')) {
      try {
        await clearAllTrades();
        alert('交易歷史已全部清空。');
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-6 max-w-md mx-auto w-full">
      {/* 頁面標題 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight font-outfit">系統設定</h1>
        <p className="text-xs text-slate-400">管理行情數據模式、資料加密備份與隱私控制</p>
      </div>

      <div className="space-y-6">
        {/* 1. 數據模式切換 */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-800/60 shadow-xl">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-400" />
            行情數據源配置
          </h2>
          <div className="flex items-center justify-between py-1">
            <div>
              <span className="text-sm font-bold text-white block">模擬行情模式 (Mock Mode)</span>
              <span className="text-xs text-slate-400 mt-0.5 block max-w-[240px]">
                啟用時提供隨機股價，避免頻繁調用真實 API 導致限流。適合測試介面。
              </span>
            </div>
            <button
              onClick={() => onToggleMock(!useMock)}
              className="text-emerald-400 hover:text-emerald-300 transition-smooth p-1"
            >
              {useMock ? (
                <ToggleRight className="h-10 w-10 text-emerald-400" />
              ) : (
                <ToggleLeft className="h-10 w-10 text-slate-600" />
              )}
            </button>
          </div>
          <div className="mt-3 bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-400">
            📌 當前報價模式：{useMock ? (
              <strong className="text-yellow-400">模擬數據 (免金鑰無流量限制)</strong>
            ) : (
              <strong className="text-emerald-400">真實行情 (TWSE MIS / Yahoo)</strong>
            )}
          </div>
        </div>

        {/* 2. 加密備份與還原 */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-800/60 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            安全備份與數據復原
          </h2>
          
          {backupError && (
            <div className="text-rose-400 text-xs font-semibold bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              {backupError}
            </div>
          )}

          {backupSuccess && (
            <div className="text-emerald-400 text-xs font-semibold bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
              {backupSuccess}
            </div>
          )}

          {/* 匯出 */}
          <div className="pb-4 border-b border-slate-800/80">
            <span className="text-sm font-bold text-white block mb-1">加密下載備份</span>
            <span className="text-xs text-slate-400 mb-3 block">
              將所有交易紀錄與券商 Profile 打包並使用您目前的 PIN 碼加密導出 JSON 檔案。
            </span>
            <button
              onClick={handleExport}
              disabled={isBackupLoading}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-smooth disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              匯出加密 JSON 備份檔
            </button>
          </div>

          {/* 匯入 */}
          <div>
            <span className="text-sm font-bold text-white block mb-1">匯入並還原備份</span>
            <span className="text-xs text-slate-400 mb-3 block">
              上傳先前匯出的加密 JSON 檔案，輸入該檔案當時設定的 PIN 碼即可還原所有資料。
            </span>
            <form onSubmit={handleImport} className="space-y-3">
              <div>
                <input
                  type="file"
                  id="backupFileInput"
                  accept=".json"
                  onChange={e => setBackupFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20 cursor-pointer"
                />
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={backupPassword}
                  onChange={e => setBackupPassword(e.target.value)}
                  placeholder="輸入備份檔案的 PIN 碼"
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 transition-smooth text-xs"
                />
                <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
              </div>
              <button
                type="submit"
                disabled={isBackupLoading || !backupFile || !backupPassword}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs transition-smooth disabled:opacity-40"
              >
                <Upload className="h-4 w-4" />
                上傳並開始還原
              </button>
            </form>
          </div>
        </div>

        {/* 3. 顯示與個人化設定 */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-800/60 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Type className="h-4 w-4 text-emerald-400" />
            顯示與個人化設定
          </h2>
          <div>
            <span className="text-sm font-bold text-white block mb-1">字型大小 (老花眼友善調整)</span>
            <span className="text-xs text-slate-400 mb-3 block">
              您可以放大整個應用程式的字型，讓閱讀股價、試算與交易紀錄更清晰。
            </span>
            <div className="flex gap-2">
              {[
                { label: '標準', size: '100%' },
                { label: '略大', size: '115%' },
                { label: '放大', size: '130%' },
                { label: '特大', size: '145%' }
              ].map(item => (
                <button
                  key={item.size}
                  type="button"
                  onClick={() => handleFontSizeChange(item.size)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-smooth ${
                    fontSize === item.size
                      ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-900/30 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. 隱私控制與鎖定 */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-800/60 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            隱私安全控制
          </h2>

          <div className="flex gap-3">
            <button
              onClick={lock}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-smooth active:scale-95"
            >
              🔒 立即上鎖 App
            </button>
            
            <button
              onClick={handleClearHistory}
              className="flex-1 border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 font-semibold py-2.5 px-4 rounded-xl text-xs transition-smooth active:scale-95"
            >
              🗑️ 清空交易紀錄
            </button>
          </div>
        </div>

        {/* 5. 未來發展藍圖 (Roadmap) */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-800/60 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span className="text-emerald-400">🚀</span>
            未來發展藍圖 (Roadmap)
          </h2>
          
          <div className="space-y-4 text-xs">
            <div className="relative pl-5 border-l border-emerald-500/30">
              <div className="absolute -left-1 top-0.5 h-2 w-2 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50" />
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>階段一：複數持股投資組合優化</span>
                <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded font-black">規劃中</span>
              </div>
              <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">
                支援多檔個股的資產配置目標比例試算。使用者輸入理想配置百分比（例如：台積電 40%, 鴻海 30%...），系統一鍵計算使整體投資組合最接近目標比例且均價最優的購買組合。
              </p>
            </div>

            <div className="relative pl-5 border-l border-slate-800">
              <div className="absolute -left-1 top-0.5 h-2 w-2 rounded-full bg-slate-700" />
              <div className="font-bold text-slate-300">階段二：定期定額湊整歷史回測</div>
              <p className="text-slate-500 mt-1 text-[11px] leading-relaxed">
                引入台股歷史股價數據，模擬並回測「智慧湊整定期定額」與「傳統定期定額」的實際扣款成果。量化比較兩者在均價整平度、與手續費摩擦成本上的磨損差異。
              </p>
            </div>

            <div className="relative pl-5 border-l border-slate-800">
              <div className="absolute -left-1 top-0.5 h-2 w-2 rounded-full bg-slate-700" />
              <div className="font-bold text-slate-300">階段三：風險評估與績效分析</div>
              <p className="text-slate-500 mt-1 text-[11px] leading-relaxed">
                計算投資組合的 Beta 值、波動度與夏普值（Sharpe Ratio），並與台灣加權指數（大盤）進行自動績效對比，評估整數化持股偏好在風險分散上的實際表現。
              </p>
            </div>
            
            <div className="relative pl-5">
              <div className="absolute -left-1 top-0.5 h-2 w-2 rounded-full bg-slate-700" />
              <div className="font-bold text-slate-300">階段四：證券商 API 自動下單串接</div>
              <p className="text-slate-500 mt-1 text-[11px] leading-relaxed">
                與合作國內券商 API 進行串接，實現試算完畢後「一鍵送出委託單」，讓智慧配股從算帳、記帳，跨越到自動下單交易閉環。
              </p>
            </div>
          </div>
        </div>

        {/* 版本資訊 */}
        <div className="text-center text-[10px] text-slate-600 font-outfit">
          台股整數化試算工具 v1.0.0 (PWA RWD) <br />
          100% Local Encrypted Database System
        </div>
      </div>
    </div>
  );
};
