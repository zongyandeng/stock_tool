import type { BrokerProfile, TradeRecord, EncryptedTradeRecord } from '../db/db';
import type { PriceInfo } from '../api/price';
import type { OptimizationSuggestion, OptimizationResult } from '../optimizer/optimizer';

export type {
  BrokerProfile,
  TradeRecord,
  EncryptedTradeRecord,
  PriceInfo,
  OptimizationSuggestion,
  OptimizationResult
};

export interface AppState {
  isUnlocked: boolean;
  masterKey: CryptoKey | null;
  hasVerificationData: boolean;
}
