# 多P單J 東京・會動的海報

像素風東京探索遊戲：點擊海報找出 16 個秘密，認識 7 位團員，挑戰雜貨店、喫茶店與販賣機三款小遊戲。

## 立即試玩

這是純前端靜態網站，不需要伺服器後端、資料庫、API 金鑰或建置步驟。請從 HTTP 網址開啟，直接雙擊 `index.html` 的 `file://` 模式可能阻擋 JavaScript 模組。

在這個資料夾開啟終端機：

```sh
python3 -m http.server 8000
```

再開啟 `http://localhost:8000`。圖片與字體都放在 `assets/`，遊戲執行時不連線 Google Fonts 或其他外部服務。進度保存在目前瀏覽器的 localStorage，不會跨裝置同步；無法使用儲存空間時仍能正常遊玩。

## 操作

- 點海報上的閃光處探索秘密，點地面移動團員，點角色開啟檔案。
- 方向鍵／WASD 移動；手帳的「探索」分頁也能選擇所有探索地點。
- 雜貨店：點貨架，或按 1–9；技能亮起後點團員，或按 Q、W、E、R、T、Y、U。
- 喫茶店：點畫面、按空白鍵或 Enter 倒奶泡。
- 販賣機：左右拖曳籃子，或使用方向鍵／A、D。
- Tab 切換按鈕、Enter 啟用、Esc 關閉目前視窗。
- 「結局」按兩次可觀看完整原版結局，保留原文與指定分行；收集進度不會被預覽改動。
- 手帳「重新冒險」按兩次可清除本機進度與最高分。
- 結局字幕可暫停、續播、重播，播放結束會停在最後一幕。
- 手機橫向採用可捲動海報；販賣機遊戲內左右拖曳控制籃子。

## 用 GitHub Pages 上線

1. 在 GitHub 建立 repository，例如 `tokyo-quest`。若要公開分享，使用 Public。
2. 將**這個資料夾內的內容**上傳到 repository 根目錄，讓 `index.html`、`styles.css`、`src/`、`assets/` 在同一層。不要只上傳 HTML，也不要只上傳 ZIP。
3. 開啟 repository 的 **Settings → Pages**。
4. 在 **Build and deployment** 選 **Deploy from a branch**，選 `main`、`/(root)`，按 Save。
5. 等 GitHub 完成發佈，使用 Pages 顯示的網址試玩。通常會是 `https://你的帳號.github.io/tokyo-quest/`。
6. 每次修改後上傳／push 到 `main`，GitHub 就會重新發佈。發佈前可先用本機預覽驗收。

程式使用相對路徑，可放在 GitHub Pages 的 repository 子路徑。`.github/workflows/check.yml` 只執行檢查，不會自行發佈網站。

官方步驟：[設定 GitHub Pages 的發佈來源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 修改位置

| 想修改什麼                   | 檔案                       |
| ---------------------------- | -------------------------- |
| 角色名稱、故事、技能與能力   | `src/characters.js`        |
| 圖片、角色位置與車子尺寸     | `src/assets.js`、`assets/` |
| 色彩、按鈕、視窗、響應式版面 | `styles.css`               |
| 探索地點、玩法、難度、結局   | `src/game.js`              |
| 音效與背景音樂               | `src/audio.js`             |
| 存檔格式與資料驗證           | `src/storage.js`           |
| 視窗焦點與鍵盤切換           | `src/ui.js`                |

海報的設計座標為 887 × 1774，CSS 等比例縮放。角色資料使用完整欄位名稱：`name`、`title`、`element`、`stats`、`skill`、`item`、`biography`。`stats` 順序是體力、購物力、美食雷達、方向感、拍照力，範圍 1–5。

遊戲主程式依狀態、介面、探索地點、輸入、更新、繪圖、小遊戲、手帳／載入／結局分段。小遊戲代號 A＝雜貨店、B＝喫茶店、C＝販賣機。畫布的幾何參數保留常見 `x`、`y`、`w`、`h` 表示座標與尺寸。

## 像素字體

所有介面與 Canvas 文字共用 `DotGothic16 → FusionPixelTW`。前者保留原版風格，後者補齊繁中缺字；不再使用黑體或系統中文字體做正常文字的 fallback。開場等待兩套像素字體載入。圖片內的字維持原美術，Emoji 保留原遊戲的圖示用途。

字體檔與授權原文一起提供，詳見 [第三方來源](docs/THIRD_PARTY.md)。新增文案後應再檢查字體有沒有對應字形。

## 開發檢查

安裝 Node.js 22 或更新版本後：

```sh
npm ci
npm test
npm run format:check
```

用 `npm run format` 統一排版。格式化是開發工具，遊戲本身沒有 npm 執行依賴。

測試覆蓋存檔驗證、載入失敗、結局預覽、三款小遊戲、場景切換、角色邊界、點擊／滑動區分，以及 60/120 Hz 特效生命週期。引擎測試使用模擬 DOM／Canvas，不能取代實機驗收。測試紀錄與尚待驗收項目見 [檢查報告](docs/REVIEW.md)。

## 授權是什麼？

授權是告訴大家「拿到原始碼後，可以怎麼使用」的規則，例如可否修改、再次分享、商用，以及需要保留哪些作者資訊。這些規則通常寫在 repository 根目錄的 `LICENSE`。

網站可以先上線供大家遊玩；正式開源時，再決定原始碼的使用規則。程式碼、美術與字體可以分開說明。本版保留字體的既有授權文件，尚未替你的原始程式、美術與故事自動選定授權。

GitHub 說明：[為 repository 選擇授權](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)。
