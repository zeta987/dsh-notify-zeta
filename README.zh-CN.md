[English](https://github.com/zeta987/dsh-notify-zeta/blob/main/README.md) | [繁體中文](https://github.com/zeta987/dsh-notify-zeta/blob/main/README.zh-TW.md) | [简体中文](https://github.com/zeta987/dsh-notify-zeta/blob/main/README.zh-CN.md)

# Zeta Notify（Zeta 通知）

DSH（DeepSeek Harness）第三方社区插件：在 DSH 内提供应用内通知中心、Windows 原生交互卡片以及浏览器系统通知。
除下方列出的前置要求外，无需安装 .NET 10 或下载可执行文件，无 npm 运行时依赖，安装过程不执行生命周期脚本；原生卡片基于 Windows 自带的 Windows PowerShell 5.1 + WPF。

**版本** 0.1.1 · **许可证** MIT · **仓库** https://github.com/zeta987/dsh-notify-zeta

> 本插件为第三方社区项目，与 DeepSeek 无隶属关系。插件界面目前仅提供繁体中文；本仓库的 README 提供多语言版本，但本版本未提供英文或简体中文界面本地化。

## 主要功能

- **应用内通知中心**：位于 Settings → Zeta 通知，支持未读/类型筛选、已读状态、清空最近历史，以及安全的合成测试按钮（浏览器 / 原生 / 问题 / 审批）。合成测试不会运行真实工具，也不会调用模型。
- **Windows 原生交互卡片（WPF）**：支持多个问题、单选、多选、自由文本、计划详情，以及显式的一次性允许/拒绝。这些是独立的 WPF 窗口，并非 Windows 通知中心里的内联回复输入框。
- **浏览器系统通知**：需要页面保持存活、处于安全上下文（HTTPS 或 loopback），并且该确切来源/端口已获得通知权限。
- **14 个默认开启的触发开关**：任务完成、错误、中止、中断、被阻断、token 上限、审批、提问、计划审核、压缩（compaction）、后台任务完成/失败/终止，以及重要目标状态变化（暂停/阻断/完成）。
- **子智能体事件**使用单独开关，默认关闭；DSH 自身关于禁止子智能体向人类实时提问的限制仍然有效。
- **通知抑制**：常规通知仅可针对当前可见会话抑制；其他会话与待处理的交互卡片仍会照常通知。
- **送达方式**：即使浏览器标签页已关闭，Windows 主机仍可发送卡片，但 DSH 进程必须在该 Windows 机器上保持运行。
- 两个通道、声音与内容预览默认开启。原生声音使用 Windows 系统音量；浏览器声音在用户交互后播放本地合成的提示音，不下载远程音频。

## 截图

以下截图为使用合成/虚构演示数据拍摄的演示画面，不是真实会话记录。

![应用内通知中心：设置、14 个触发开关与最近通知](https://raw.githubusercontent.com/zeta987/dsh-notify-zeta/main/docs/images/notification-center.png)

*图 1：应用内通知中心（Settings → Zeta 通知）中的 14 个触发开关与最近通知。*

![Windows 原生提问卡片：包含单选、多选与自由文本的多个问题](https://raw.githubusercontent.com/zeta987/dsh-notify-zeta/main/docs/images/windows-question.png)

*图 2：Windows 原生提问卡片，包含两个问题、单选/多选与自由文本（使用虚构演示数据）。*

![Windows 原生审批卡片：对一次无害的虚构操作进行一次性允许或拒绝](https://raw.githubusercontent.com/zeta987/dsh-notify-zeta/main/docs/images/windows-approval.png)

*图 3：Windows 原生审批卡片，对一次无害的虚构操作进行一次性允许/拒绝（使用虚构演示数据）。*

## 环境要求

- Windows 10/11（用于原生 WPF 卡片）。浏览器通道可在其他平台加载，但完整原生功能仅限 Windows；目前仅在 Windows 11 上测试过。
- Node.js >= 22.19.0；已在 Node 24.19.0 上测试。
- Windows PowerShell 5.1（随 Windows 提供）。
- DSH 已安装且 web profile 已初始化；`pnpm` 在 PATH 中可用。
- 测试组合：DSH CLI 0.1.5-rc.1，搭配 0.1.5-rc.2 版的 interaction/session 依赖。DSH 的开发者预览 API 可能发生变化，本插件不保证支持所有 DSH 版本。

安装与卸载不需要更改安全策略，也不需要以管理员身份运行。

## 安装

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-notify-zeta
npx @deepseek-ai/dsh web
```

安装完成后：

1. 重启正在运行的 DSH 进程；
2. 刷新浏览器页面；
3. 打开 Settings → Zeta 通知。

说明：

- 如果本地已安装真实的 `dsh` CLI，可直接使用 `dsh`；示例使用 `npx` 是为了避免 shell 别名带来的干扰。
- 无需手动编辑补丁：包自身声明了 `dsh.bundle.patch`。

## 快速验证

在通知中心点击合成测试按钮（浏览器 / 原生 / 问题 / 审批），确认各通道可以正常显示通知。合成测试不会运行真实工具，也不会调用模型。

## 卸载

```sh
npx @deepseek-ai/dsh plugin --profile web remove dsh-notify-zeta
```

卸载后重启 DSH。无需删除其他 profile 或全局配置。

## 默认值

| 项目 | 默认值 | 说明 |
| --- | --- | --- |
| 14 个触发开关 | 开启 | 任务完成、错误、中止、中断、被阻断、token 上限、审批、提问、计划审核、压缩、后台任务完成/失败/终止、重要目标状态变化 |
| 子智能体事件开关 | 关闭 | DSH 对子智能体实时提问的限制仍然有效 |
| 原生（Windows WPF）通道 | 开启 | 交互式请求在原生不可用、被禁用、启动失败或请求不受支持时转交标准 DSH UI；普通通知在原生显示未获确认时，仅对该条新通知回退一次到浏览器通道，已显示的旧通知不会被重放 |
| 浏览器系统通知通道 | 开启 | 需要页面存活、安全上下文与确切来源/端口的权限 |
| 声音 | 开启 | 原生使用系统音量；浏览器播放本地合成提示音 |
| 内容预览 | 开启 | 关闭后隐藏普通通知详情 |

## 隐私与安全

- 设置保存在当前启用的 DSH profile 的 `zeta-notify.settings.json` 中。
- 最近记录最多 200 条，仅保存在内存中；重启后历史即清空。
- 回答文本不会写入通知历史。
- 内容预览关闭后，普通通知的详情会被隐藏；交互式卡片仍会保留作答所需的完整问题/操作信息。
- 本插件无遥测、无外部推送传输、无 webhook；此说明不涉及 DSH 主机本身或其他插件的网络行为。
- 浏览器 API 使用 DSH 的身份验证与来源校验；POST JSON 变更要求同源，并对请求体大小设有上限。
- 原生助手通过父子管道交换 JSON；文本不会作为 PowerShell/XAML 执行。
- 每个回答都绑定确切的会话、原始活动智能体、请求身份与随机一次性令牌。系统会校验回答 ID、选项以及单选与多选类型，并拒绝过期、重复、已取消或类型不匹配的提交。
- 原生通道与自定义 Web 通知中心共享同一个由主机持有的请求，不会各自独立竞争处理标准 DSH 对话框所对应的请求。

## 0.1.1 版本说明

- 审批卡片会显示实际匹配到的操作详情；无法匹配时转交 DSH 常规审批 UI。
- 原生投递失败时，仅对显示未获确认的新通知回退一次到浏览器通道；已成功显示的旧通知，以及已解决或已取消的请求，不会在后续助手失败时被重放。
- 助手的就绪计时器归属于其自身进程。

上述行为已通过最终本地自动化测试套件（62/62 通过，其中包含一项集成的原生助手恢复测试）；测试并未覆盖所有真实世界的事件路径。

## 限制

- 最多 32 个待处理请求。
- 每个请求最多 20 个问题。
- 每个问题最多 100 个选项。
- 请求的问题 JSON 最大 96 KB。
- 自定义回答最大 16000 个字符。
- 每个问题都需要一个有效选项或非空的自定义回答。
- 重复的问题 ID，以及不支持或超限的请求，会转交官方 DSH UI（此为请求级回退，与上节所述提交级回答校验不同）。

## 故障排查

- **收不到通知**：确认对应的触发开关已开启，然后重启 DSH 并刷新浏览器页面。
- **浏览器通知不出现**：确认页面保持打开（可在后台标签页，但未关闭）、处于安全上下文（HTTPS 或 loopback），并且已为确切的来源/端口授予通知权限。
- **关闭浏览器标签页后**：原生卡片仍可送达，但 DSH 进程必须在该 Windows 机器上保持运行。
- **普通通知的原生投递未获确认**：插件仅对该条新通知回退一次到浏览器通道；已成功显示的旧通知，以及已解决或已取消的请求，不会在后续助手失败时被重放。
- **交互式卡片无法通过原生通道显示**：请求将转交标准 DSH UI 处理；浏览器系统通知不承担交互式作答功能。
- **界面语言**：当前界面为繁体中文，本版本未提供英文或简体中文界面。

## 开发

- 源码测试：`npm test`。

## 许可证

MIT。

## 相关链接与致谢

- GitHub 仓库：https://github.com/zeta987/dsh-notify-zeta
- npm 包：`dsh-notify-zeta`
- DSH 插件主题：https://github.com/topics/dsh-plugin
- DSH 开发文档：https://deepseek-harness.github.io/deepseek-harness/develop/basic/
- 灵感来源：dsh-notify-yimit（npm）、https://github.com/610la/dsh-notification-center 、https://github.com/Ycet/dsh-notifications 、https://github.com/blauerberg/dsh-web-push-notification 、https://github.com/Andyqwe44/dsh-notify-win 。
