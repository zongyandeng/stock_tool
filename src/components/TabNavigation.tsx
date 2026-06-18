import React from 'react';
import { Calculator, History, Landmark, Settings } from 'lucide-react';

export type TabId = 'optimizer' | 'history' | 'brokers' | 'settings';

interface TabNavigationProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'optimizer' as TabId, label: '智慧試算', icon: Calculator },
    { id: 'history' as TabId, label: '持股歷史', icon: History },
    { id: 'brokers' as TabId, label: '券商設定', icon: Landmark },
    { id: 'settings' as TabId, label: '系統設定', icon: Settings }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-2 pb-safe pt-2">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-smooth ${
                isActive
                  ? 'text-emerald-400 bg-emerald-500/5'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`h-5 w-5 mb-1 transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`} />
              <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
