import React, { useState } from 'react';
import { useDb } from '../context/DbContext';
import type { BrokerProfile } from '../db/db';
import { Landmark, Plus, Trash2, Star, Edit, X } from 'lucide-react';

export const BrokersPage: React.FC = () => {
  const { brokers, saveBroker, deleteBroker, setDefaultBroker } = useDb();
  
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Form fields
  const [name, setName] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(60); // 60 代表 6折 (0.6)
  const [minFee, setMinFee] = useState<number>(20);
  const [isDefault, setIsDefault] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleOpenAdd = () => {
    setIsEditing(true);
    setEditId(null);
    setName('');
    setDiscountPercent(60);
    setMinFee(20);
    setIsDefault(brokers.length === 0);
    setError('');
  };

  const handleOpenEdit = (broker: BrokerProfile) => {
    setIsEditing(true);
    setEditId(broker.id);
    setName(broker.name);
    setDiscountPercent(Math.round(broker.discount * 100));
    setMinFee(broker.minFee);
    setIsDefault(broker.isDefault);
    setError('');
  };

  const handleClose = () => {
    setIsEditing(false);
    setEditId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('請輸入券商名稱');
      return;
    }

    if (discountPercent < 0 || discountPercent > 100) {
      setError('手續費折扣必須介於 0% 到 100% 之間');
      return;
    }

    if (minFee < 0) {
      setError('最低手續費不能小於 0 元');
      return;
    }

    const discount = discountPercent / 100;
    const id = editId || window.crypto.randomUUID();

    try {
      await saveBroker({
        id,
        name: name.trim(),
        discount,
        minFee,
        isDefault,
        createdAt: editId 
          ? (brokers.find(b => b.id === editId)?.createdAt || Date.now())
          : Date.now()
      });
      handleClose();
    } catch (err) {
      setError('儲存失敗，請重試');
      console.error(err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`確定要刪除券商「${name}」嗎？`)) {
      try {
        await deleteBroker(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-6 max-w-md mx-auto w-full">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-outfit">券商手續費模板</h1>
          <p className="text-xs text-slate-400">設定不同券商的電子單折讓折扣與最低手續費限制</p>
        </div>
        {!isEditing && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2 px-3 rounded-full transition-smooth shadow-md shadow-emerald-500/10 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            新增券商
          </button>
        )}
      </div>

      {isEditing ? (
        /* 券商表單 */
        <form onSubmit={handleSave} className="glass-panel rounded-3xl p-6 shadow-xl border border-slate-800/60 mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
            <h2 className="text-lg font-bold text-white">
              {editId ? '編輯券商設定' : '新增券商設定'}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 text-rose-400 text-xs font-semibold bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                券商名稱
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例如：富果證券、國泰證券"
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 transition-smooth text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  手續費折讓折扣 (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={discountPercent}
                    onChange={e => setDiscountPercent(parseInt(e.target.value) || 0)}
                    placeholder="如 60"
                    min="0"
                    max="100"
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/80 transition-smooth text-sm pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-semibold">%</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">註：60% 代表 6 折</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  最低手續費 (元)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={minFee}
                    onChange={e => setMinFee(parseInt(e.target.value) || 0)}
                    placeholder="如 20"
                    min="0"
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/80 transition-smooth text-sm pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-semibold">元</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">註：零股最低通常為 1 元</span>
              </div>
            </div>

            <div className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={isDefault}
                disabled={brokers.length === 0 || (editId !== null && brokers.find(b => b.id === editId)?.isDefault)}
                onChange={e => setIsDefault(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-slate-700 bg-slate-900/50 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
              />
              <label htmlFor="isDefault" className="text-sm text-slate-300 font-medium cursor-pointer select-none">
                設定為試算時的預設券商
              </label>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 border border-slate-700 hover:bg-slate-800/40 text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition-smooth"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2.5 rounded-xl text-xs font-bold transition-smooth shadow-md shadow-emerald-500/10"
              >
                儲存設定
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {/* 券商列表 */}
      <div className="space-y-4">
        {brokers.length === 0 ? (
          <div className="glass-panel rounded-3xl p-10 text-center border border-dashed border-slate-800">
            <Landmark className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">尚未新增任何券商設定</p>
            <p className="text-slate-500 text-xs mt-1">請點擊上方「新增券商」來建立手續費折扣模板</p>
          </div>
        ) : (
          brokers.map((broker) => (
            <div
              key={broker.id}
              className={`glass-panel rounded-2xl p-4 transition-smooth relative border ${
                broker.isDefault 
                  ? 'border-emerald-500/30 bg-emerald-950/5' 
                  : 'border-slate-800/60 hover:border-slate-700/80'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-2 rounded-xl border ${
                    broker.isDefault 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-slate-800/50 text-slate-400 border-slate-700/30'
                  }`}>
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-1.5 font-outfit">
                      {broker.name}
                      {broker.isDefault && (
                        <span className="flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] py-0.5 px-2 rounded-full font-bold border border-emerald-500/20">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          預設
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 font-medium">
                      <span>折扣折讓: <strong className="text-slate-200">{Math.round(broker.discount * 100)}% ({Math.round(broker.discount * 10) / 10}折)</strong></span>
                      <span className="h-3 w-px bg-slate-800" />
                      <span>最低手續費: <strong className="text-slate-200">{broker.minFee} 元</strong></span>
                    </div>
                  </div>
                </div>

                {/* 操作按鈕 */}
                <div className="flex items-center gap-1.5">
                  {!broker.isDefault && (
                    <button
                      onClick={() => setDefaultBroker(broker.id)}
                      title="設為預設"
                      className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-slate-800/40 rounded-xl transition-smooth"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenEdit(broker)}
                    title="編輯"
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800/40 rounded-xl transition-smooth"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  {/* 禁止刪除系統寫入的唯一券商 (為安全起見，若只剩一個則不可刪) */}
                  <button
                    onClick={() => handleDelete(broker.id, broker.name)}
                    disabled={brokers.length <= 1}
                    title="刪除"
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800/40 rounded-xl transition-smooth disabled:opacity-30 disabled:hover:text-slate-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
