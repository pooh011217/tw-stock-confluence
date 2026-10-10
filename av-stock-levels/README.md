# AV 方程式 1.11

操作入口：https://av-stock-levels.peachygenet4.chatgpt.site

多檔掃描結果顯示已完成檔數、成功數、失敗數、基準日。歷史模式顯示所選日期；最新模式顯示實際行情日期，若各檔不同則列出多個基準日。

新增 A4 = 收盤價 × 1.045 × 1.018 × 1.018 = 收盤價 × 1.08295858。個股分析、手動計算、多檔掃描、複製輸出及次日區間核對皆包含 A4，保留完整計算精度，顯示取小數兩位。

最新查詢與歷史分析使用本專案 src/worker.js 同一組 TWSE／TPEx 官方月行情及中繼路徑。上市順序：TWSE STOCK_DAY → /twse/month 中繼；上櫃順序：/tpex/month 中繼 → TPEx st43_result.php → tradingStock。來源無法取得時停止計算。名錄快照不替代歷史所選日期行情。

同月份請求快取五分鐘，合併同時重複請求，支援跨月次交易日查詢。

執行測試：cd av-stock-levels && npm test

驗證：12 項 Node 測試通過，包含 A4、日期摘要、瀏覽器腳本語法及行情來源處理。未執行瀏覽器視覺檢查。

本目錄為獨立 AV Worker。wrangler.jsonc 提供 Cloudflare 部署設定，現有操作入口由既有網站發布流程更新。
