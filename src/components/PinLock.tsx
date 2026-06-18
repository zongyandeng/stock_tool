import React, { useState } from 'react';
import { useDb } from '../context/DbContext';
import { Lock, ShieldAlert, KeyRound } from 'lucide-react';

export const PinLock: React.FC = () => {
  const { isInitialized, initializeKey, unlock } = useDb();
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [step, setStep] = useState<'enter' | 'setup' | 'confirm'>('enter');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 當 isInitialized 為 false 時，自動轉入 setup 步驟
  React.useEffect(() => {
    if (!isInitialized) {
      setStep('setup');
    } else {
      setStep('enter');
    }
  }, [isInitialized]);

  const handleKeyPress = (num: string) => {
    setError('');
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setError('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError('');
    setPin('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length !== 6) {
      setError('請輸入完整 6 位數字 PIN 碼');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (step === 'enter') {
        const success = await unlock(pin);
        if (!success) {
          setError('密碼錯誤，請重新輸入');
          setPin('');
        }
      } else if (step === 'setup') {
        // 進入確認密碼步驟
        setConfirmPin(pin);
        setPin('');
        setStep('confirm');
      } else if (step === 'confirm') {
        if (pin !== confirmPin) {
          setError('密碼不一致，請重新設定');
          setPin('');
          setConfirmPin('');
          setStep('setup');
        } else {
          await initializeKey(pin);
        }
      }
    } catch (err) {
      setError('系統錯誤，請稍後再試');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 自動在輸入滿 6 位時送出
  React.useEffect(() => {
    if (pin.length === 6) {
      handleSubmit();
    }
  }, [pin]);

  const numpad = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-12">
      <div className="w-full max-w-md text-center">
        {/* 圖示 */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
          {step === 'enter' ? (
            <Lock className="h-10 w-10 animate-pulse" />
          ) : (
            <KeyRound className="h-10 w-10 animate-bounce" />
          )}
        </div>

        {/* 標題與說明 */}
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2 font-outfit">
          {step === 'enter' && '安全金鑰解鎖'}
          {step === 'setup' && '設定安全 PIN 碼'}
          {step === 'confirm' && '確認安全 PIN 碼'}
        </h1>
        <p className="text-sm text-slate-400 mb-8 max-w-xs mx-auto">
          {step === 'enter' && '請輸入 6 位數字 PIN 碼以解密您的交易資料庫與 API 金鑰'}
          {step === 'setup' && '請設定 6 位數字 PIN 碼作為您本地資料庫的最高加解密鑰'}
          {step === 'confirm' && '請再次輸入剛才設定的 6 位數 PIN 碼進行確認'}
        </p>

        {/* PIN 顯示小點 */}
        <div className="flex justify-center items-center gap-4 mb-8">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className={`h-4 w-4 rounded-full border transition-all duration-200 ${
                index < pin.length
                  ? 'bg-emerald-400 border-emerald-400 scale-125 shadow-md shadow-emerald-500/40'
                  : 'bg-transparent border-slate-600 scale-100'
              }`}
            />
          ))}
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div className="flex items-center justify-center gap-2 mb-6 text-rose-400 text-sm font-semibold bg-rose-500/10 py-2.5 px-4 rounded-xl border border-rose-500/20 max-w-xs mx-auto">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 數字鍵盤 (行動端優化) */}
        <div className="glass-panel mx-auto max-w-xs rounded-3xl p-6 shadow-2xl mb-6">
          <div className="grid grid-cols-3 gap-4">
            {numpad.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                disabled={isSubmitting}
                className="flex h-16 items-center justify-center rounded-2xl bg-slate-800/40 border border-slate-700/30 text-2xl font-bold text-white transition-all active:bg-slate-700/60 active:scale-95 disabled:opacity-50"
              >
                {num}
              </button>
            ))}

            {/* 功能鍵：清空 */}
            <button
              type="button"
              onClick={handleClear}
              disabled={isSubmitting || pin.length === 0}
              className="flex h-16 items-center justify-center rounded-2xl text-sm font-semibold text-slate-400 transition-all active:text-white disabled:opacity-30"
            >
              重填
            </button>

            {/* 數字 0 */}
            <button
              key="0"
              type="button"
              onClick={() => handleKeyPress('0')}
              disabled={isSubmitting}
              className="flex h-16 items-center justify-center rounded-2xl bg-slate-800/40 border border-slate-700/30 text-2xl font-bold text-white transition-all active:bg-slate-700/60 active:scale-95 disabled:opacity-50"
            >
              0
            </button>

            {/* 功能鍵：刪除 */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting || pin.length === 0}
              className="flex h-16 items-center justify-center rounded-2xl text-sm font-semibold text-slate-400 transition-all active:text-white disabled:opacity-30"
            >
              刪除
            </button>
          </div>
        </div>

        {/* PIN 碼安全宣示 */}
        <div className="text-xs text-slate-500">
          🔒 100% 本地硬體級衍生加密 · 絕不傳送至任何伺服器
        </div>
      </div>
    </div>
  );
};
