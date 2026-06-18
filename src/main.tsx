import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 載入時初始化全域字型大小 (解決老花調整)
const savedFontSize = localStorage.getItem('stock_tool_font_size') || '100%';
document.documentElement.style.fontSize = savedFontSize;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 註冊 PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('PWA ServiceWorker registered with scope: ', registration.scope);
      })
      .catch((err) => {
        console.error('PWA ServiceWorker registration failed: ', err);
      });
  });
}
