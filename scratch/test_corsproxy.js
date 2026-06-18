async function test() {
  const symbol = '2330';
  const tseCh = `tse_${symbol}.tw`;
  const otcCh = `otc_${symbol}.tw`;
  const targetUrlTWSE = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${tseCh}|${otcCh}`;
  const targetUrlYahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW`;

  const headers = {
    'Origin': 'http://localhost:5173',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'http://localhost:5173/'
  };

  const proxies = [
    { name: 'corsproxy.io', getUrl: (url) => `https://corsproxy.io/?${url}` },
    { name: 'allorigins', getUrl: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}` },
    { name: 'codetabs', getUrl: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` },
  ];

  for (const proxy of proxies) {
    console.log(`\n=== Testing proxy: ${proxy.name} ===`);
    
    // TWSE
    try {
      const url = proxy.getUrl(targetUrlTWSE);
      console.log(`Fetching TWSE from ${proxy.name}...`);
      const res = await fetch(url, { headers });
      const text = await res.text();
      console.log(`TWSE Response (first 200 chars):`, text.substring(0, 200));
      
      let content = text;
      if (proxy.name === 'allorigins') {
        const json = JSON.parse(text);
        content = json.contents;
      }
      const parsed = JSON.parse(content);
      console.log(`TWSE Success! msgArray length:`, parsed?.msgArray?.length);
    } catch (e) {
      console.log(`TWSE Failed via ${proxy.name}:`, e.message);
    }

    // Yahoo
    try {
      const url = proxy.getUrl(targetUrlYahoo);
      console.log(`Fetching Yahoo from ${proxy.name}...`);
      const res = await fetch(url, { headers });
      const text = await res.text();
      console.log(`Yahoo Response (first 200 chars):`, text.substring(0, 200));
      
      let content = text;
      if (proxy.name === 'allorigins') {
        const json = JSON.parse(text);
        content = json.contents;
      }
      const parsed = JSON.parse(content);
      console.log(`Yahoo Success! result length:`, parsed?.chart?.result?.length);
    } catch (e) {
      console.log(`Yahoo Failed via ${proxy.name}:`, e.message);
    }
  }
}

test();
