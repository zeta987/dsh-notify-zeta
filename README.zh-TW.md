[![English](https://raw.githubusercontent.com/zeta987/dsh-notify-zeta/main/docs/images/lang-en.svg)](https://github.com/zeta987/dsh-notify-zeta/blob/main/README.md) [![繁體中文](https://raw.githubusercontent.com/zeta987/dsh-notify-zeta/main/docs/images/lang-zh-tw.svg)](https://github.com/zeta987/dsh-notify-zeta/blob/main/README.zh-TW.md) [![简体中文](https://raw.githubusercontent.com/zeta987/dsh-notify-zeta/main/docs/images/lang-zh-cn.svg)](https://github.com/zeta987/dsh-notify-zeta/blob/main/README.zh-CN.md)

# Zeta 通知

為 DeepSeek Harness（DSH）提供通知與可互動的 Windows 卡片。只要 DSH 持續在 Windows 主機上執行，即使瀏覽器分頁已經關閉，也能透過原生卡片掌握任務進度、回答提問並處理一次性核准。

`dsh-notify-zeta`（版本 0.1.1）是獨立的社群外掛，與 DeepSeek 沒有隸屬關係。外掛本身的介面目前為繁體中文；本 README 提供英文、繁體中文與簡體中文版本。

## 功能

- **整合於 DSH 介面的通知中心。** 開啟 **Settings → Zeta 通知** 即可檢視最近通知、依未讀狀態或類型篩選、標示為已讀，並清除最近紀錄。
- **可互動的 Windows 卡片。** 一張卡片可回答多個問題，支援單選、多選與自由文字，也能閱讀計畫細節，並明確允許或拒絕單一操作。這些是 WPF 視窗，不是 Windows 通知中心內的回覆欄位。
- **兩種通知管道。** 只要 DSH 程序仍在那台 Windows 機器上執行，原生 Windows 卡片在瀏覽器分頁關閉時照樣送達。瀏覽器系統通知則需要頁面保持開啟、處於安全環境（HTTPS 或 loopback），並對確切的來源與連接埠授予通知權限。
- **自行決定要收到什麼。** 14 個事件開關、獨立的子代理開關、聲音、內容預覽，以及只針對目前檢視中的工作階段抑制一般通知。
- **安全的測試按鈕。** 內建瀏覽器、原生、提問與核准測試，只會產生模擬通知，不會執行真實工具，也不會呼叫模型。

## 截圖

![Zeta 通知的設定、14 個事件開關與最近通知](https://raw.githubusercontent.com/zeta987/dsh-notify-zeta/main/docs/images/notification-center.png)

DSH 介面內通知中心的設定、14 個事件開關與最近通知。

![含兩個示範問題、單選與多選選項及自由文字的 Windows 卡片](https://raw.githubusercontent.com/zeta987/dsh-notify-zeta/main/docs/images/windows-question.png)

使用虛構示範資料的原生提問卡片，包含單選、多選與自由文字輸入。

![顯示無害示範操作與一次性允許、拒絕按鈕的 Windows 核准卡片](https://raw.githubusercontent.com/zeta987/dsh-notify-zeta/main/docs/images/windows-approval.png)

原生核准卡片會先顯示操作細節，再由你決定允許或拒絕這一次的操作。

## 系統需求

- 已安裝 DSH，且 `web` profile 已完成初始化。請參考 [DSH 開發基礎](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)。
- Node.js 22.19.0 或更新版本，且 `pnpm` 位於 `PATH`。
- 原生卡片需要 Windows 10 或 11。外掛的原生輔助程式使用 Windows 內建的 Windows PowerShell 5.1 與 WPF，不需要安裝 .NET 10，也不會下載輔助程式的 EXE。
- 瀏覽器通知需要以 HTTPS 或 loopback 位址提供的頁面、頁面保持開啟，並對確切的來源（含連接埠）授予通知權限。

瀏覽器管道可以在其他平台載入，但完整的原生功能僅限 Windows，而且目前只在 Windows 11 測試過。測試環境為 Node.js 24.19.0、Windows PowerShell 5.1，以及 DSH CLI 0.1.5-rc.1（互動／工作階段相依套件解析為 0.1.5-rc.2）。DSH 的 developer-preview API 可能變動，其他 DSH 版本不一定可用。

## 安裝

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-notify-zeta
npx @deepseek-ai/dsh web
```

如果 DSH 已在執行中，安裝後請重新啟動該程序，重新整理瀏覽器頁面，再開啟 **Settings → Zeta 通知**。

套件已宣告 `dsh.bundle.patch`，不需要手動編輯 patch。範例使用 `npx` 以避開 shell 別名；若已安裝的 `dsh` 指令確實指向真正的 DSH CLI，也可以直接使用。

### 快速測試

1. 開啟 **Settings → Zeta 通知**。
2. 如果想使用瀏覽器管道，先授予瀏覽器通知權限。
3. 按下瀏覽器與原生測試按鈕，再試試模擬的提問卡片與核准卡片。

瀏覽器聲音要等你與頁面互動過後才會播放。原生卡片需要 DSH 程序持續在 Windows 主機上執行，即使瀏覽器分頁已經關閉。

### 移除

```sh
npx @deepseek-ai/dsh plugin --profile web remove dsh-notify-zeta
```

移除後請重新啟動 DSH。不需要刪除其他 profile 或全域設定。

## 預設值

| 設定 | 預設值與行為 |
| --- | --- |
| 原生與瀏覽器管道 | 兩者都啟用。 |
| 聲音 | 啟用。原生聲音跟隨 Windows 系統音量；瀏覽器聲音是頁面互動後在本機合成的提示音，不會下載遠端音訊。 |
| 內容預覽 | 啟用。 |
| 14 個事件開關 | 全部啟用：任務完成、錯誤、中止、中斷、受阻、token 上限、核准、提問、計畫審閱、壓縮、背景工作完成、背景工作失敗、背景工作被終止，以及重要目標狀態變更（暫停、受阻或完成）。 |
| 子代理事件 | 停用。DSH 對執行中子代理不得向人類提問的限制維持不變。 |

你可以只針對目前檢視中的工作階段抑制一般通知；其他工作階段與待處理的互動卡片仍會通知。

關閉預覽後會隱藏一般通知的細節。互動卡片仍會顯示完整的問題或操作內容，讓你在了解完整內容後再回答。

## 回答與核准

核准卡片會顯示實際比對到的操作細節。若外掛無法顯示這些細節，會交由 DSH 的標準核准介面處理。

每個回答都綁定於確切的工作階段、原始的執行中代理、特定的請求，以及隨機的單次使用 token。外掛會檢查問題 ID、允許的選項，以及單選與多選的區別，並拒絕過期、重複或已取消的提交。

原生卡片與自訂網頁通知中心共用一個由 DSH 主程式持有的請求，不會各自與 DSH 標準對話框競爭。當原生互動不可用、已停用、啟動失敗或無法處理該請求時，改由 DSH 的標準介面處理。

## 隱私與儲存

- 設定以 `zeta-notify.settings.json` 儲存在目前使用的 DSH profile 中。
- 最多保留 200 筆最近紀錄，而且只存放在記憶體。重新啟動 DSH 會清除這些紀錄；回答內容不會寫入通知紀錄。
- 外掛不包含任何遙測、外部推播傳輸或 webhook。這只描述本外掛，不涵蓋 DSH 本身或其他外掛的網路活動。
- 瀏覽器 API 使用 DSH 的驗證與來源檢查。會變更狀態的 JSON POST 請求必須來自相同來源，且內容大小受限。
- 原生輔助程式透過管線與父程序交換 JSON。文字一律視為資料，不會被當成 PowerShell 或 XAML 執行。
- 套件沒有 npm 執行期相依套件，也沒有安裝生命週期指令碼。

## 限制與疑難排解

### 互動請求限制

| 限制 | 上限 |
| --- | ---: |
| 待處理請求 | 32 |
| 每個請求的問題數 | 20 |
| 每個問題的選項數 | 100 |
| 請求問題 JSON | 96 KB |
| 自訂回答 | 16,000 字元 |

每個問題都需要有效的選項或非空白的自訂回答。問題 ID 重複、不支援或過大的請求會退回 DSH 的標準介面。

### 收不到瀏覽器通知

確認頁面仍然開啟、以 HTTPS 或 loopback 位址提供，而且已對確切的來源與連接埠授予通知權限；不同的連接埠需要各自授權。也請檢查對應的事件開關是否開啟，以及是否啟用了目前工作階段的抑制設定。

### 收不到 Windows 卡片

確認 DSH 仍在該 Windows 主機上執行，且原生管道已啟用。原生卡片需要 Windows 10 或 11，搭配 Windows PowerShell 5.1 與 WPF，而且目前只在 Windows 11 測試過。

若新觀察到的通知在原生傳送時失敗，外掛允許退回瀏覽器管道傳送一次；歷史快照不會重新以新通知送出。原生卡片無法處理的互動請求改由 DSH 的標準介面處理。

## 開發

執行原始碼測試：

```sh
npm test
```

DSH 外掛探索：[GitHub 上的 dsh-plugin 主題](https://github.com/topics/dsh-plugin)。

## 授權與致謝

以 [MIT 授權](LICENSE) 發布。

靈感來自 [dsh-notify-yimit](https://www.npmjs.com/package/dsh-notify-yimit)、[dsh-notification-center](https://github.com/610la/dsh-notification-center)、[dsh-notifications](https://github.com/Ycet/dsh-notifications)、[dsh-web-push-notification](https://github.com/blauerberg/dsh-web-push-notification) 與 [dsh-notify-win](https://github.com/Andyqwe44/dsh-notify-win)。
