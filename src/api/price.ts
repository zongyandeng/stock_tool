/**
 * 股票行情數據源模組 (Price Data Source)
 * 整合 TWSE MIS API、Yahoo Finance 與 Mock 模擬數據，並設計 CORS 代理與 Fallback 機制
 */

export interface PriceInfo {
  symbol: string;
  name: string;
  price: number;
  isRealTime: boolean;
  source: 'TWSE' | 'Yahoo' | 'Mock' | 'Manual';
}

// 基礎數據源策略介面
export interface IPriceDataSource {
  fetchPrice(symbol: string): Promise<PriceInfo>;
}

/**
 * 1. MockPriceDataSource (模擬數據源 - 開發與測試模式)
 * 根據股票代號生成隨機波動的價格，避免觸發 API 限流
 */
export class MockPriceDataSource implements IPriceDataSource {
  // 固定一些常用個股的基準價，使其更具真實感
  private bases: Record<string, { name: string; price: number }> = {
    '2330': { name: '台積電', price: 940.0 },
    '2317': { name: '鴻海', price: 200.0 },
    '2454': { name: '聯發科', price: 1380.0 },
    '0050': { name: '元大台灣50', price: 185.0 },
    '0056': { name: '元大高股息', price: 41.5 },
    '00878': { name: '國泰永續高股息', price: 23.8 },
  };

  async fetchPrice(symbol: string): Promise<PriceInfo> {
    // 模擬網路延遲 300ms
    await new Promise(resolve => setTimeout(resolve, 300));

    const cleanSymbol = symbol.trim();
    let base = this.bases[cleanSymbol];

    if (!base) {
      // 若非預設個股，依據代號 hash 算出一個基準價 [30 - 300]
      let hash = 0;
      for (let i = 0; i < cleanSymbol.length; i++) {
        hash = cleanSymbol.charCodeAt(i) + ((hash << 5) - hash);
      }
      const price = 30 + Math.abs(hash % 270);
      base = { name: `模擬股-${cleanSymbol}`, price };
    }

    // 隨機波動 -0.5% 到 +0.5% 之間
    const fluctuation = (Math.random() - 0.5) * 0.01;
    const finalPrice = Math.round(base.price * (1 + fluctuation) * 100) / 100;

    return {
      symbol: cleanSymbol,
      name: base.name,
      price: finalPrice,
      isRealTime: true,
      source: 'Mock'
    };
  }
}

/**
 * 2. RealPriceDataSource (真實公開數據源)
 * 串接證交所 (TWSE) 與 Yahoo Finance 公開行情，使用 CORS 代理以避免瀏覽器跨網域限制
 */
export class RealPriceDataSource implements IPriceDataSource {
  /**
   * 使用代理伺服器發送請求，支援多個 CORS 代理的 Fallback 機制
   */
  private async fetchFromProxy(targetUrl: string): Promise<any> {
    // 1. 優先使用 corsproxy.io (直接返回原始資料，適用於瀏覽器端)
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const text = await response.text();
        return JSON.parse(text);
      }
    } catch (e) {
      console.warn('corsproxy.io failed, trying allorigins fallback...', e);
    }

    // 2. 備用方案：allorigins (會包裝在 contents 欄位中)
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const json = await response.json();
        return JSON.parse(json.contents);
      }
    } catch (e) {
      console.warn('allorigins failed...', e);
    }

    throw new Error('All CORS proxies failed to fetch data');
  }

  /**
   * 嘗試從台灣證券交易所 (TWSE) MIS 取得即時報價
   */
  private async fetchFromTWSE(symbol: string): Promise<PriceInfo> {
    // 決定是上市 (tse) 還是上櫃 (otc)
    // 大多數 4 位數股票可用 tse/otc 嘗試。我們先嘗試 tse，若無再嘗試 otc
    // 為了降低流量，我們先同時查詢 tse 和 otc (使用 | 分隔)
    const tseCh = `tse_${symbol}.tw`;
    const otcCh = `otc_${symbol}.tw`;
    
    const targetUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${tseCh}|${otcCh}`;
    const contents = await this.fetchFromProxy(targetUrl);

    if (!contents || !contents.msgArray || contents.msgArray.length === 0) {
      throw new Error(`TWSE returns empty data for ${symbol}`);
    }

    // 找到有效的資料 (有時候 tse 沒資料但 otc 有，反之亦然)
    const stockData = contents.msgArray.find((item: any) => item.z && item.z !== '-');
    const fallbackData = contents.msgArray[0]; // 若都沒交易，取第一個

    const data = stockData || fallbackData;
    if (!data) throw new Error('No valid array in TWSE response');

    // z: 最近成交價, y: 昨收價, o: 開盤價, g: 買進價, a: 賣出價
    const priceStr = data.z && data.z !== '-' ? data.z : (data.y && data.y !== '-' ? data.y : data.o);
    const finalPrice = parseFloat(priceStr);

    if (isNaN(finalPrice) || finalPrice <= 0) {
      throw new Error('Invalid price extracted from TWSE');
    }

    // n: 公司簡稱
    const name = data.n ? data.n.trim() : `台股-${symbol}`;

    return {
      symbol,
      name,
      price: finalPrice,
      isRealTime: true,
      source: 'TWSE'
    };
  }

  /**
   * 備份方案：從 Yahoo Finance API 取得盤後/即時報價
   */
  private async fetchFromYahoo(symbol: string): Promise<PriceInfo> {
    // 試算台股在 Yahoo 的代號格式 (通常是 2330.TW 或 2330.TWO)
    // 我們優先嘗試 .TW，失敗時通常會有返回
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW`;
    const contents = await this.fetchFromProxy(targetUrl);

    const result = contents?.chart?.result?.[0];
    if (!result) throw new Error(`Yahoo returned empty chart for ${symbol}`);

    const meta = result.meta;
    const finalPrice = meta?.regularMarketPrice;
    
    if (!finalPrice || isNaN(finalPrice) || finalPrice <= 0) {
      throw new Error('Invalid price extracted from Yahoo');
    }

    const name = meta?.symbol || `台股-${symbol}`;

    return {
      symbol,
      name,
      price: finalPrice,
      isRealTime: false, // Yahoo API 透過 proxy 會有約 15 分鐘延遲
      source: 'Yahoo'
    };
  }

  async fetchPrice(symbol: string): Promise<PriceInfo> {
    const cleanSymbol = symbol.trim();
    
    // 1. 優先嘗試證交所即時 API
    try {
      return await this.fetchFromTWSE(cleanSymbol);
    } catch (e1) {
      console.warn(`TWSE API failed for ${cleanSymbol}, trying Yahoo fallback...`, e1);
      
      // 2. 證交所失敗，嘗試 Yahoo 報價
      try {
        return await this.fetchFromYahoo(cleanSymbol);
      } catch (e2) {
        console.error(`Yahoo Finance API also failed for ${cleanSymbol}`, e2);
        throw new Error(`無法取得股票 ${cleanSymbol} 的最新股價，請手動輸入。`);
      }
    }
  }
}

/**
 * 3. PriceRepository (數據庫儲存庫 - 前端唯一入口)
 * 負責在 Mock 與 Real 模式之間路由，並處理例外錯誤
 */
export class PriceRepository {
  private mockSource = new MockPriceDataSource();
  private realSource = new RealPriceDataSource();
  private _useMock: boolean;

  constructor() {
    // 在開發環境下預設啟用 Mock 模式
    this._useMock = import.meta.env.DEV;
  }

  get useMock(): boolean {
    return this._useMock;
  }

  set useMock(value: boolean) {
    this._useMock = value;
  }

  async fetchPrice(symbol: string): Promise<PriceInfo> {
    if (this._useMock) {
      return this.mockSource.fetchPrice(symbol);
    } else {
      return this.realSource.fetchPrice(symbol);
    }
  }
}

// 導出單例
export const priceRepository = new PriceRepository();
