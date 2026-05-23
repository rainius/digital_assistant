# 数字人前端系统架构设计

## 概述

本系统是一个基于 Vue 3 的实时数字人交互前端，整合了语音识别（ASR）、大语言模型对话（LLM）、语音合成（TTS）和 Live2D 数字人渲染四大能力，形成 “**语音入 → 文本理解 → 语音出 + 口型同步**” 的完整闭环。

---

## 一、整体架构

系统采用 **三层解耦** 架构：

```
┌─────────────────────────────────────────────────┐
│                   UI 组件层                        │
│  UserInfoPanel  │  AvatarStage  │  AIChatPanel   │
└──────────────────────┬──────────────────────────┘
                       │ props / emits
┌──────────────────────▼──────────────────────────┐
│                Composable 逻辑层                   │
│  useAvatar │ useChatStream │ useTTSQueue         │
│  useVoiceRecorder │ useDraggable                 │
└──────────────────────┬──────────────────────────┘
                       │ inject(ServicesKey)
┌──────────────────────▼──────────────────────────┐
│                 服务 + 适配器层                      │
│  ASRFactory  │  LLMFactory  │  TTSFactory        │
│  SenseVoice  │  Dify/Coze   │  GPT-SoVITS/Edge   │
│  AvatarFactory (Live2D)                          │
└─────────────────────────────────────────────────┘
```

**核心设计理念**：每一层只与下一层通过抽象接口通信。UI 不知道 LLM 是 Dify 还是 Coze，Composable 不关心 TTS 是 GPT-SoVITS 还是 Edge。这保证了引擎可替换、模块可测试。

---

## 二、创新设计要点

### 2.1 全链路策略模式

ASR、LLM、TTS、Avatar 四个领域均采用 **Factory + Adapter** 模式。每个工厂暴露统一的 `create(type, config)` 接口，返回实现相同协议的适配器实例。

```
LLMFactory.create('dify', config)  →  DifyAdapter
LLMFactory.create('coze', config)  →  CozeAdapter
```

**创新价值**：切换 LLM 引擎只需改一行环境变量（`VUE_APP_LLM_PROVIDER=dify|coze`），上层 Composable 和 UI 代码零改动。四个领域统一遵循此模式，形成一致的扩展范式——新增引擎只需编写一个 Adapter 类并注册到 Factory。

### 2.2 Composable 回调串联

五个 Composable 各自封装独立关注点，**不直接互相引用**，而是通过回调在编排层（DigitalAssistant.vue）串联：

```js
// 句子切分 → TTS 队列，通过 onSentence 回调连接
const chat = useChatStream({
  llm,
  onSentence: (sentence) => ttsQueue.enqueueText(sentence),
});

// 语音识别 → 对话发送，通过 onText 回调连接
const recorder = useVoiceRecorder({
  asr,
  onText: (text) => {
    inputText.value = text;
    setTimeout(() => handleAISend(text), 500);
  },
});
```

**创新价值**：每个 Composable 可独立进行单元测试——useChatStream 的测试只需 mock LLM 适配器，无需关心 TTS 或 Avatar。生产环境中则通过薄薄一层编排代码串联，形成完整的 “语音 → LLM → TTS → 口型” 管道。

### 2.3 流式句子边界检测

传统做法是等 LLM 完整返回后再整段送 TTS，用户等待时间长。本系统创新地在 **流式接收 chunk 时实时检测句子边界**：

```
LLM 流式输出: "你好！今天天气不错。你想聊什么？"
                    ↑                 ↑
               检测到！            检测到。
                    │                 │
            立即送 TTS 播放    送 TTS 播放
```

`sentenceSplitter` 模块在每收到一个 chunk 时，用中英文混合正则检测句末标点。**LLM 还在继续生成时，已完成的第一句就已经开始播放**，大幅降低首句延迟。

### 2.4 世代号竞态控制

由于浏览器 SSE（Server-Sent Events）不支持 `AbortController` 中断，用户快速连续发送两条消息时，旧请求的回调可能覆盖新请求的 UI 状态。

系统引入 **世代号（Generation ID）** 机制：每次 `send()` 递增 `currentGen`，每个流式回调携带当时的世代号，回调触发时比对当前世代号——旧世代的结果直接丢弃。

```js
const gen = ++currentGen;
llm.streamChat(text, {
  onChunk: (chunk) => {
    if (gen !== currentGen) return; // 旧请求，丢弃
    // 更新 UI...
  }
});
```

**创新价值**：零依赖解决 SSE 竞态问题，无需引入 WebSocket 或第三方流控库。

### 2.5 TTS 串行队列与内存安全

`useTTSQueue` 维护一个 **串行播放队列**，每个句子独立获取音频 blob，前一句播放完毕后才开始下一句。队列支持：

- **动态入队**：LLM 一边流式输出一边有新的句子涌入
- **全局打断**：`stop()` 清空队列并销毁所有已生成的 blob URL
- **内存回收**：每句播放后立即 `URL.revokeObjectURL()`，停止时遍历销毁未播放的 blob

数字人在每句播放期间自动切换表情（`thinking`），句间恢复 `neutral`，形成自然的“思考→说话”节奏。

### 2.6 文本清洗管道

LLM 原始输出包含 Markdown 格式、URL、不规范的标点，直接送 TTS 会导致生硬的朗读效果。`cleanTextForTTS` 管道执行：

1. 去除 Markdown 标记（`# * _ ~ -`）
2. 清除 URL
3. 换行符 → 中文逗号
4. 中文标点规范化：`。！？` → `. ! ? `（英文标点 + 空格强制 TTS 呼吸停顿）

每一步都是独立的纯函数，可组合、可测试、可扩展。

### 2.7 依赖注入与可测试性

服务实例通过 Vue 的 `provide/inject` 机制注入组件树：

```js
// main.js
app.provide(ServicesKey, createServices());

// 任意子组件
const { asr, llm, tts } = inject(ServicesKey);
```

**创新价值**：测试时只需 `provide` mock 服务，组件代码无需任何修改。这与 Angular 的 DI 理念一致，但在 Vue 生态中很少被这样系统性地使用。

---

## 三、数据流全景

```
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ 语音输入  │───▶│ SenseVoice   │───▶│  识别文本     │───▶│          │
│ (麦克风)  │    │ /api/asr     │    │              │    │          │
└──────────┘    └──────────────┘    └──────┬───────┘    │          │
                                           │            │ LLM 适配器│
┌──────────┐                               │            │ Dify/Coze │
│ 文本输入  │───────────────────────────────┘            │ streamChat│
│ (对话面板)│                                            │          │
└──────────┘                                            └────┬─────┘
                                                             │
                              ┌──────────────────────────────┘
                              │ 流式 chunk
                              ▼
                    ┌─────────────────┐
                    │ useChatStream   │─── 实时更新 messages[] (打字机效果)
                    │ 句子边界检测      │
                    └────────┬────────┘
                             │ onSentence(sentence)
                             ▼
                    ┌─────────────────┐
                    │ cleanTextForTTS │─── Markdown 清洗 / 标点规范化
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ useTTSQueue     │─── 串行播放队列
                    │ enqueueText()   │
                    └────────┬────────┘
                             │ fetchAudio(sentence)
                             ▼
                    ┌─────────────────┐
                    │ GPT-SoVITS      │─── /api/tts → WAV blob URL
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Live2DAdapter   │─── speak(audioUrl)
                    │ 口型同步 + 音频   │     表情: thinking → neutral
                    └─────────────────┘
```

---

## 四、总结

本系统的核心设计思路可归纳为三条原则：

1. **分层解耦**：UI / Composable / Adapter 三层，每层通过抽象协议通信，引擎可替换
2. **流式优先**：充分利用 SSE 流式特性，在数据到达的第一时间开始处理——打字机效果更新 UI、句子边界检测即时触发 TTS
3. **鲁棒性内置**：世代号防竞态、blob URL 生命周期管理、队列打断机制，这些不是事后打的补丁，而是从架构设计阶段就融入的保障
