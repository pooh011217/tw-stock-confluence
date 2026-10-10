# AV 方程式 1.10

操作入口：https://av-stock-levels.peachygenet4.chatgpt.site

最新查詢與歷史分析採用本專案 src/worker.js 同一組 TWSE／TPEx 官方月行情與既有中繼路徑，移除 FinMind 依賴。來源無法取得時停止計算；內嵌快照提供代號與股票簡稱名錄，不替代歷史日期行情。

上市順序：TWSE STOCK_DAY → tpex-official-relay.onrender.com/twse/month。
上櫃順序：/tpex/month 中繼 → TPEx st43_result.php → tradingStock。

同月份請求快取五分鐘，合併同時重複請求，支援跨月次交易日查詢，保留 AV 公式。

驗證：9 項 Node 測試通過；2026-10-08 真實來源驗證 1303、3217、2454、6223、3529、2344、4979、6146 共八檔成功取得基準日收盤。

執行測試：cd av-stock-levels && npm test

本目錄為獨立 AV Worker。wrangler.jsonc 可用於 Cloudflare 部署；現有操作入口已透過既有網站发布流程更新。GitHub 原始碼與已發布版本一致。
