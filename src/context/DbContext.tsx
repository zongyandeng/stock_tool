import React, { createContext, useContext, useState, useEffect } from 'react';
import * as db from '../db/db';
import * as crypto from '../db/crypto';
import type { BrokerProfile, TradeRecord, EncryptedTradeRecord } from '../db/db';

interface DbContextType {
  isInitialized: boolean;
  isUnlocked: boolean;
  brokers: BrokerProfile[];
  trades: TradeRecord[];
  activeBroker: BrokerProfile | null;
  initializeKey: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  // Broker actions
  saveBroker: (broker: BrokerProfile) => Promise<void>;
  deleteBroker: (id: string) => Promise<void>;
  setDefaultBroker: (id: string) => Promise<void>;
  // Trade actions
  saveTrade: (trade: Omit<TradeRecord, 'id' | 'timestamp'>) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  clearAllTrades: () => Promise<void>;
  // Backup actions
  exportBackup: () => Promise<string>;
  importBackup: (backupJson: string, passwordUsed: string) => Promise<boolean>;
}

const DbContext = createContext<DbContextType | undefined>(undefined);

export const DbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  
  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);

  // 1. 偵測資料庫是否已初始化 PIN 碼
  useEffect(() => {
    async function checkInit() {
      const salt = await db.getSetting('auth_salt');
      const verify = await db.getSetting('auth_verify');
      if (salt && verify) {
        setIsInitialized(true);
      } else {
        setIsInitialized(false);
      }
    }
    checkInit();
  }, []);

  // 當解鎖成功時，載入資料
  useEffect(() => {
    if (isUnlocked && masterKey) {
      loadData();
    } else {
      setBrokers([]);
      setTrades([]);
    }
  }, [isUnlocked, masterKey]);

  // 載入券商與解密交易紀錄
  async function loadData() {
    try {
      // 載入券商
      const brokersList = await db.getBrokers();
      setBrokers(brokersList);

      // 載入並解密交易紀錄
      if (masterKey) {
        const encryptedTrades = await db.getEncryptedTrades();
        const decryptedList: TradeRecord[] = [];
        
        for (const et of encryptedTrades) {
          try {
            const decryptedJson = await crypto.decryptData(et.encryptedData, et.iv, masterKey);
            const rawRecord = JSON.parse(decryptedJson);
            decryptedList.push({
              id: et.id,
              symbol: et.symbol,
              name: rawRecord.name,
              qty: rawRecord.qty,
              price: rawRecord.price,
              fee: rawRecord.fee,
              brokerId: rawRecord.brokerId,
              timestamp: rawRecord.timestamp,
              notes: rawRecord.notes
            });
          } catch (e) {
            console.error(`Failed to decrypt trade record ${et.id}`, e);
          }
        }
        setTrades(decryptedList);
      }
    } catch (e) {
      console.error('Failed to load DB data', e);
    }
  }

  // 取得當前預設券商
  const activeBroker = brokers.find(b => b.isDefault) || brokers[0] || null;

  // 2. 初始化 PIN 碼 (首次使用)
  const initializeKey = async (password: string) => {
    const salt = crypto.generateSalt();
    const key = await crypto.deriveKey(password, salt);
    const verifyPayload = await crypto.generateVerificationPayload(key);

    await db.setSetting('auth_salt', crypto.bufferToBase64(salt.buffer as ArrayBuffer));
    await db.setSetting('auth_verify', verifyPayload);

    setMasterKey(key);
    setIsUnlocked(true);
    setIsInitialized(true);
  };

  // 3. 輸入 PIN 碼解鎖
  const unlock = async (password: string): Promise<boolean> => {
    try {
      const saltBase64 = await db.getSetting('auth_salt');
      const verifyPayload = await db.getSetting('auth_verify');
      
      if (!saltBase64 || !verifyPayload) return false;

      const salt = crypto.base64ToBuffer(saltBase64);
      const key = await crypto.deriveKey(password, salt);

      const isValid = await crypto.verifyKey(verifyPayload.ciphertext, verifyPayload.iv, key);
      if (isValid) {
        setMasterKey(key);
        setIsUnlocked(true);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Unlock error', e);
      return false;
    }
  };

  // 4. 上鎖
  const lock = () => {
    setMasterKey(null);
    setIsUnlocked(false);
  };

  // --- 券商設定操作 ---
  const saveBroker = async (broker: BrokerProfile) => {
    await db.saveBroker(broker);
    await loadData();
  };

  const deleteBroker = async (id: string) => {
    await db.deleteBroker(id);
    await loadData();
  };

  const setDefaultBroker = async (id: string) => {
    await db.setDefaultBroker(id);
    await loadData();
  };

  // --- 交易歷史操作 (需要加密) ---
  const saveTrade = async (trade: Omit<TradeRecord, 'id' | 'timestamp'>) => {
    if (!masterKey) throw new Error('DB is locked');

    const id = window.crypto.randomUUID();
    const timestamp = Date.now();

    const dataToEncrypt = {
      name: trade.name,
      qty: trade.qty,
      price: trade.price,
      fee: trade.fee,
      brokerId: trade.brokerId,
      timestamp: timestamp,
      notes: trade.notes
    };

    // 使用 AES-GCM 加密交易明細
    const { ciphertext, iv } = await crypto.encryptData(JSON.stringify(dataToEncrypt), masterKey);

    const encryptedRecord: EncryptedTradeRecord = {
      id,
      encryptedData: ciphertext,
      iv,
      symbol: trade.symbol,
      createdAt: timestamp
    };

    await db.saveEncryptedTrade(encryptedRecord);
    await loadData();
  };

  const deleteTrade = async (id: string) => {
    await db.deleteTrade(id);
    await loadData();
  };

  const clearAllTrades = async () => {
    await db.clearAllTrades();
    await loadData();
  };

  // --- 加密備份與還原 ---
  const exportBackup = async (): Promise<string> => {
    if (!masterKey) throw new Error('DB is locked');

    // 取得所有原始的 IndexedDB 交易密文與券商明文
    const encryptedTrades = await db.getEncryptedTrades();
    const brokerProfiles = await db.getBrokers();
    const saltBase64 = await db.getSetting('auth_salt');
    const verifyPayload = await db.getSetting('auth_verify');

    const backupData = {
      version: 1,
      salt: saltBase64,
      verify: verifyPayload,
      brokers: brokerProfiles,
      trades: encryptedTrades
    };

    // 整包 JSON 字串
    const backupJson = JSON.stringify(backupData);
    
    // 再次以 AES-GCM 加密，確保備份檔案本身在傳輸與雲端儲存時也是加密的
    const { ciphertext, iv } = await crypto.encryptData(backupJson, masterKey);

    return JSON.stringify({
      ciphertext,
      iv,
      salt: saltBase64 // 保留 salt 以供還原時進行 PBKDF2 衍生金鑰
    });
  };

  const importBackup = async (backupJson: string, passwordUsed: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(backupJson);
      if (!parsed.ciphertext || !parsed.iv || !parsed.salt) return false;

      // 1. 使用匯入時輸入的密碼與備份檔案中的 salt 衍生金鑰
      const salt = crypto.base64ToBuffer(parsed.salt);
      const key = await crypto.deriveKey(passwordUsed, salt);

      // 2. 解密備份封包
      const decryptedBackupJson = await crypto.decryptData(parsed.ciphertext, parsed.iv, key);
      const backupData = JSON.parse(decryptedBackupJson);

      if (backupData.version !== 1) return false;

      // 3. 寫入資料庫
      const activeDb = await db.getDB();
      
      // 寫入 settings (重設 PIN 碼與驗證)
      await db.setSetting('auth_salt', backupData.salt);
      await db.setSetting('auth_verify', backupData.verify);

      // 寫入券商
      const txBrokers = activeDb.transaction('broker_profiles', 'readwrite');
      await txBrokers.store.clear();
      for (const b of backupData.brokers) {
        await txBrokers.store.put(b);
      }
      await txBrokers.done;

      // 寫入交易紀錄
      const txTrades = activeDb.transaction('trade_history', 'readwrite');
      await txTrades.store.clear();
      for (const t of backupData.trades) {
        await txTrades.store.put(t);
      }
      await txTrades.done;

      // 4. 更新前端狀態
      setMasterKey(key);
      setIsUnlocked(true);
      setIsInitialized(true);
      
      await loadData();
      return true;
    } catch (e) {
      console.error('Backup import failed', e);
      return false;
    }
  };

  return (
    <DbContext.Provider
      value={{
        isInitialized,
        isUnlocked,
        brokers,
        trades,
        activeBroker,
        initializeKey,
        unlock,
        lock,
        saveBroker,
        deleteBroker,
        setDefaultBroker,
        saveTrade,
        deleteTrade,
        clearAllTrades,
        exportBackup,
        importBackup
      }}
    >
      {children}
    </DbContext.Provider>
  );
};

export const useDb = () => {
  const context = useContext(DbContext);
  if (context === undefined) {
    throw new Error('useDb must be used within a DbProvider');
  }
  return context;
};
