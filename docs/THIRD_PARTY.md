# 第三方來源

## DotGothic16

- 作者：The DotGothic16 Project Authors / Fontworks。
- 原始專案：[fontworks-fonts/DotGothic16](https://github.com/fontworks-fonts/DotGothic16)。
- 字體：原版遊戲使用的 Google Fonts DotGothic16，轉封裝為 WOFF2，未修改字形。
- 授權：SIL Open Font License 1.1，原文位於 `assets/fonts/OFL.txt`。

## Fusion Pixel Font

- 作者：The Fusion Pixel Font Project Authors。
- 專案：[TakWolf/fusion-pixel-font](https://github.com/TakWolf/fusion-pixel-font)。
- 來源版本：2026.09.25，12px proportional、zh-TW，WOFF2。
- 用途：繁體中文的像素字形補足。
- 主授權位於 `assets/fonts/FusionPixel-OFL.txt`；上游素材授權位於 `assets/fonts/fusion-licenses/`。

## 遊戲素材

圖片從使用者提供的 `index.html` 分離出來，轉為無損 WebP。11 張圖片的解碼 RGBA 像素與原 PNG 逐位元組相同。素材來源與公開授權尚待原作者確認。

音樂與音效沿用原版的 Web Audio 合成程式，不依賴外部音檔。README 提及的歌名屬原有角色介紹，沒有加入歌曲錄音。

## 開發工具

Prettier 3.6.2：只用於格式化開發檔案，不會在遊戲執行時下載或載入。
