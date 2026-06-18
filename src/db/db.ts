import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

// 1. 定義資料庫 Schema 介面
export interface BrokerProfile {
  id: string;        // UUID
  name: string;      // 券商名稱
  discount: number;  // 手續費折扣 (例如 6折為 0.6)
  minFee: number;    // 最低手續費 (例如 零股 1元, 整股 20元)
  isDefault: boolean;// 是否預設
  createdAt: number;
}

export interface EncryptedTradeRecord {
  id: string;           // UUID
  encryptedData: string;// AES-GCM 加密後的 JSON 密文
  iv: string;           // 初始向量 (Base64)
  symbol: string;       // 股票代號 (明文，供快速索引/搜尋)
  createdAt: number;    // 時間戳記
}

export interface TradeRecord {
  id: string;
  symbol: string;       // 股票代號 (例如 "2330")
  name: string;         // 股票名稱
  qty: number;          // 購買股數
  price: number;        // 購買單價
  fee: number;          // 手續費
  brokerId: string;     // 關聯券商 Profile ID
  timestamp: number;    // 交易日期時間戳記
  notes?: string;
}

export interface AppSetting {
  key: string;
  value: any;
}

interface StockDB extends DBSchema {
  app_settings: {
    key: string;
    value: AppSetting;
  };
  broker_profiles: {
    key: string;
    value: BrokerProfile;
  };
  trade_history: {
    key: string;
    value: EncryptedTradeRecord;
  };
}

const DB_NAME = 'stock_optimizer_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<StockDB>> | null = null;

// 初始化/取得資料庫實例
export function getDB(): Promise<IDBPDatabase<StockDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StockDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 建立 object stores
        if (!db.objectStoreNames.contains('app_settings')) {
          db.createObjectStore('app_settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('broker_profiles')) {
          db.createObjectStore('broker_profiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('trade_history')) {
          db.createObjectStore('trade_history', { keyPath: 'id' });
        }
      },
    }).then(async (db) => {
      // 在初次建立時寫入預設券商模板
      const brokers = await db.getAll('broker_profiles');
      if (brokers.length === 0) {
        const defaultBrokers: BrokerProfile[] = [
          {
            id: 'broker-default-stock',
            name: '一般券商 (整股常用)',
            discount: 0.6, // 6 折
            minFee: 20,    // 最低 20 元
            isDefault: true,
            createdAt: Date.now()
          },
          {
            id: 'broker-discount-odd',
            name: '優惠券商 (零股常用)',
            discount: 0.6, // 6 折
            minFee: 1,     // 最低 1 元
            isDefault: false,
            createdAt: Date.now() + 1
          }
        ];
        
        const tx = db.transaction('broker_profiles', 'readwrite');
        for (const broker of defaultBrokers) {
          await tx.store.put(broker);
        }
        await tx.done;
      }
      return db;
    });
  }
  return dbPromise;
}

// --- AppSettings API ---

export async function getSetting(key: string): Promise<any> {
  const db = await getDB();
  const setting = await db.get('app_settings', key);
  return setting ? setting.value : null;
}

export async function setSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('app_settings', { key, value });
}

// --- BrokerProfiles API ---

export async function getBrokers(): Promise<BrokerProfile[]> {
  const db = await getDB();
  const brokers = await db.getAll('broker_profiles');
  // 依建立時間排序
  return brokers.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveBroker(broker: BrokerProfile): Promise<void> {
  const db = await getDB();
  
  // 如果此券商被設定為預設，需先將其他券商設為非預設
  if (broker.isDefault) {
    const brokers = await db.getAll('broker_profiles');
    const tx = db.transaction('broker_profiles', 'readwrite');
    for (const b of brokers) {
      if (b.id !== broker.id && b.isDefault) {
        b.isDefault = false;
        await tx.store.put(b);
      }
    }
    await tx.store.put(broker);
    await tx.done;
  } else {
    // 確保至少有一家是預設券商
    const brokers = await db.getAll('broker_profiles');
    const hasOtherDefault = brokers.some(b => b.id !== broker.id && b.isDefault);
    if (!hasOtherDefault) {
      broker.isDefault = true; // 如果是唯一一家，強迫成為預設
    }
    await db.put('broker_profiles', broker);
  }
}

export async function deleteBroker(id: string): Promise<void> {
  const db = await getDB();
  const broker = await db.get('broker_profiles', id);
  
  if (broker?.isDefault) {
    // 如果要刪除的是預設券商，需將其它的某一間設為預設
    const brokers = await db.getAll('broker_profiles');
    const other = brokers.find(b => b.id !== id);
    if (other) {
      other.isDefault = true;
      const tx = db.transaction('broker_profiles', 'readwrite');
      await tx.store.put(other);
      await tx.store.delete(id);
      await tx.done;
      return;
    }
  }
  
  await db.delete('broker_profiles', id);
}

export async function setDefaultBroker(id: string): Promise<void> {
  const db = await getDB();
  const brokers = await db.getAll('broker_profiles');
  const tx = db.transaction('broker_profiles', 'readwrite');
  for (const b of brokers) {
    const wasDefault = b.isDefault;
    b.isDefault = b.id === id;
    if (wasDefault !== b.isDefault) {
      await tx.store.put(b);
    }
  }
  await tx.done;
}

// --- TradeHistory API ---

export async function saveEncryptedTrade(record: EncryptedTradeRecord): Promise<void> {
  const db = await getDB();
  await db.put('trade_history', record);
}

export async function getEncryptedTrades(): Promise<EncryptedTradeRecord[]> {
  const db = await getDB();
  const trades = await db.getAll('trade_history');
  // 依建立時間遞減排序 (最新在最前)
  return trades.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteTrade(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('trade_history', id);
}

export async function clearAllTrades(): Promise<void> {
  const db = await getDB();
  await db.clear('trade_history');
}
