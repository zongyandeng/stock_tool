async function test() {
  const corsProxy = 'https://api.allorigins.win/get?url=';
  const symbol = '2330';
  
  // Test TWSE
  const tseCh = `tse_${symbol}.tw`;
  const otcCh = `otc_${symbol}.tw`;
  const targetUrlTWSE = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${tseCh}|${otcCh}`;
  const proxyUrlTWSE = `${corsProxy}${encodeURIComponent(targetUrlTWSE)}`;
  
  console.log('Fetching TWSE via proxy:', proxyUrlTWSE);
  try {
    const res = await fetch(proxyUrlTWSE);
    const json = await res.json();
    console.log('TWSE raw json keys:', Object.keys(json));
    console.log('TWSE content length:', json.contents ? json.contents.length : null);
    if (json.contents) {
      const contents = JSON.parse(json.contents);
      console.log('TWSE contents msgArray length:', contents.msgArray ? contents.msgArray.length : 'undefined/null');
      console.log('TWSE contents msgArray:', contents.msgArray);
    }
  } catch (err) {
    console.error('TWSE failed:', err);
  }

  // Test Yahoo
  const targetUrlYahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW`;
  const proxyUrlYahoo = `${corsProxy}${encodeURIComponent(targetUrlYahoo)}`;
  console.log('Fetching Yahoo via proxy:', proxyUrlYahoo);
  try {
    const res = await fetch(proxyUrlYahoo);
    const json = await res.json();
    console.log('Yahoo content length:', json.contents ? json.contents.length : null);
    if (json.contents) {
      const contents = JSON.parse(json.contents);
      console.log('Yahoo contents chart keys:', Object.keys(contents?.chart || {}));
      console.log('Yahoo contents chart result:', contents?.chart?.result);
      console.log('Yahoo contents chart error:', contents?.chart?.error);
    }
  } catch (err) {
    console.error('Yahoo failed:', err);
  }
}

test();
