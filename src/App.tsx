import { useState } from 'react';
import { DbProvider, useDb } from './context/DbContext';
import { PinLock } from './components/PinLock';
import { TabNavigation } from './components/TabNavigation';
import type { TabId } from './components/TabNavigation';
import { OptimizerPage } from './pages/OptimizerPage';
import { HistoryPage } from './pages/HistoryPage';
import { BrokersPage } from './pages/BrokersPage';
import { SettingsPage } from './pages/SettingsPage';
import { priceRepository } from './api/price';

function MainApp() {
  const { isUnlocked } = useDb();
  const [activeTab, setActiveTab] = useState<TabId>('optimizer');
  const [useMock, setUseMock] = useState<boolean>(priceRepository.useMock);

  const handleToggleMock = (value: boolean) => {
    priceRepository.useMock = value;
    setUseMock(value);
  };

  if (!isUnlocked) {
    return <PinLock />;
  }

  return (
    <div className="flex flex-col min-h-svh bg-slate-950 text-slate-100 pb-20">
      {/* 頂部 Header */}
      <header className="sticky top-0 z-30 border-b border-slate-900 bg-slate-950/80 backdrop-blur-xl px-4 py-3">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-sm font-outfit shadow-md shadow-emerald-500/20">
              整
            </div>
            <span className="font-extrabold text-sm tracking-tight text-white font-outfit">台股整數化試算</span>
          </div>
          {useMock && (
            <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[9px] font-bold py-0.5 px-2 rounded-full animate-pulse">
              ⚠️ 模擬數據中
            </span>
          )}
        </div>
      </header>

      {/* 頁面內容區 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'optimizer' && <OptimizerPage />}
        {activeTab === 'history' && <HistoryPage />}
        {activeTab === 'brokers' && <BrokersPage />}
        {activeTab === 'settings' && (
          <SettingsPage useMock={useMock} onToggleMock={handleToggleMock} />
        )}
      </main>

      {/* 底部導覽列 */}
      <TabNavigation activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
}

function App() {
  return (
    <DbProvider>
      <MainApp />
    </DbProvider>
  );
}

export default App;
