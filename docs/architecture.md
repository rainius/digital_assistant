# 数字人交互系统分层架构设计

## 概述

本系统是一个基于 Vue 3 的实时数字人交互平台，整合语音识别（ASR）、大语言模型对话（LLM）、语音合成（TTS）和 Live2D 数字人渲染四大 AI 能力，形成“**语音入 → 文本理解 → 语音出 + 口型同步**”的完整闭环。系统采用四层分层架构，以策略模式与 Composable 组合模式实现引擎可替换、模块可测试、协议可扩展。

---

## 一、分层架构

系统按抽象级别划分为四层，层间遵循严格的单向依赖原则——上层依赖下层，下层不感知上层。

```
┌──────────────────────────────────────────────────────┐
│  表现层  Presentation Layer                          │
│  Vue 组件树 · Live2D 渲染 · 语音交互 UI · 波形反馈      │
│  UserInfoPanel | AvatarStage | AIChatPanel | ...     │
├──────────────────────────────────────────────────────┤
│  应用逻辑层  Application Logic Layer                  │
│  Composable 组合 · 流式编排 · TTS 队列调度 · 状态管理   │
│  useAvatar | useChatStream | useTTSQueue | ...       │
├──────────────────────────────────────────────────────┤
│  服务适配层  Service Adapter Layer                    │
│  Factory + Adapter · 引擎抽象 · 协议封装 · 异构通信     │
│  ASRFactory | LLMFactory | TTSFactory | AvatarFactory│
├──────────────────────────────────────────────────────┤
│  基础设施层  Infrastructure Layer                     │
│  外部 AI 引擎 · 网络传输 · 模型推理 · 第三方 SDK         │
│  SenseVoice | Dify/Coze | GPT-SoVITS | Live2D SDK   │
└──────────────────────────────────────────────────────┘
```

### 1.1 表现层

用户直接感知的界面层。Vue 组件树负责三列布局（用户信息—数字人舞台—AI 对话面板）、Live2D 模型渲染与口型同步、语音交互按钮与录音波形反馈。该层仅关心“如何展示”，不持有业务逻辑。

### 1.2 应用逻辑层

系统核心中枢。五个 Composable 函数各自封装独立关注点，通过回调在编排层（DigitalAssistant.vue）串联为完整工作流：

- **useChatStream** — 流式对话管理、句子边界检测、世代号竞态控制
- **useTTSQueue** — 串行音频播放队列、Blob URL 生命周期管理
- **useVoiceRecorder** — 录音状态机、ASR 回调衔接
- **useAvatar** — Live2D 模型生命周期管理、运行时模型切换
- **useDraggable** — 通用拖拽交互

Composable 之间不直接相互依赖，使得每个模块可独立进行单元测试。系统的主要技术创新均集中在这一层。

### 1.3 服务适配层

对第三方 AI 引擎的统一抽象。四个领域（ASR / LLM / TTS / Avatar）均采用 **Factory + Adapter** 策略模式，上层仅依赖适配器接口，不感知具体引擎实现。

该层的另一个关键职责是**异构通信协议的封装**：ASR 与 TTS 基于 HTTP REST 请求-响应模式；LLM 基于 SSE（Server-Sent Events）单向流式推送；未来接入实时视频数字人（如 LiveTalking）时将新增 WebRTC Adapter。上层 Composable 不感知协议差异，协议切换仅需替换 Adapter 实例。

### 1.4 基础设施层

外部 AI 引擎与第三方运行时。包含 SenseVoice 语音识别服务、Dify/Coze 大语言模型平台、GPT-SoVITS / Edge TTS 语音合成服务、Live2D Cubism SDK。网络通信、模型推理、音频合成均在此层完成。

---

## 二、模块间通信协议

### 2.1 协议选型

系统模块间采用 HTTP/1.1 协议通信，根据交互模式选择不同的上层机制：

| 通信场景 | 协议 | 模式 | 说明 |
|---------|------|------|------|
| ASR 语音识别 | HTTP REST | 请求-响应 | 上传 WAV 文件，返回识别文本 |
| TTS 语音合成 | HTTP REST | 请求-响应 | 发送文本，返回音频 blob |
| LLM 流式对话 | SSE | 单向流式 | 服务端推送 token 增量 |
| Avatar 模型资源 | HTTP | 静态加载 | Live2D 模型文件的按需获取 |
| 实时视频数字人（预留） | WebRTC | 双向实时 | 音视频流传输与数据通道 |

### 2.2 协议选择与设计创新的因果链

SSE 的选择是系统设计中一个“约束催生创新”的关键决策点。相比 WebSocket 双向全双工方案，SSE 基于标准 HTTP 协议，连接管理更简单，且天然支持浏览器自动重连。但 SSE 的一个根本限制是**不支持 AbortController 中断正在进行的流**——用户快速连续发送两条消息时，旧请求的回调仍在执行，可能污染新对话的 UI 状态。

这一约束直接催生了应用逻辑层的**世代号（Generation ID）竞态控制机制**：每次发送消息时递增全局世代号，每个流式回调携带自身的世代号；回调触发时比对当前世代号，不匹配则直接丢弃。该机制零外部依赖，在 SSE 的协议约束下保障了并发对话的数据一致性。

上述因果链体现了本系统的一个架构设计原则：**协议约束不应被视为缺陷，而是驱动应用层创新的设计输入**。

---

## 三、创新设计要点

### 3.1 全链路策略模式

ASR、LLM、TTS、Avatar 四个领域均采用 Factory + Adapter 模式。每个工厂暴露统一的 `create(type, config)` 接口，返回实现相同协议的适配器实例。

```
LLMFactory.create('dify', config)  →  DifyAdapter
LLMFactory.create('coze', config)  →  CozeAdapter
```

切换 LLM 引擎只需改一行环境变量（`VUE_APP_LLM_PROVIDER=dify|coze`），上层 Composable 和 UI 代码零改动。四个领域统一遵循此模式，新增引擎仅需编写一个 Adapter 类并注册到 Factory。

### 3.2 Composable 回调串联

五个 Composable 各自封装独立关注点，不直接互相引用，通过回调在编排层串联：

```js
// 句子切分 → TTS 队列
const chat = useChatStream({
  llm,
  onSentence: (sentence) => ttsQueue.enqueueText(sentence),
});

// 语音识别 → 对话发送
const recorder = useVoiceRecorder({
  asr,
  onText: (text) => {
    inputText.value = text;
    setTimeout(() => handleAISend(text), 500);
  },
});
```

每个 Composable 可独立进行单元测试——useChatStream 的测试只需 mock LLM 适配器，无需关心 TTS 或 Avatar。

### 3.3 流式句子边界检测

传统做法是等 LLM 完整返回后再整段送 TTS，用户等待时间长。本系统在流式接收 chunk 时实时检测句子边界：

```
LLM 流式输出: "你好！今天天气不错。你想聊什么？"
                    ↑                 ↑
               检测到！            检测到。
                    │                 │
            立即送 TTS 播放    送 TTS 播放
```

`sentenceSplitter` 模块用中英文混合正则检测句末标点。LLM 还在继续生成时，已完成的第一句就已经开始播放，大幅降低首句延迟。

### 3.4 世代号竞态控制

SSE 不支持 AbortController 中断正在进行的流。系统引入世代号机制解决此问题：

```js
const gen = ++currentGen;
llm.streamChat(text, {
  onChunk: (chunk) => {
    if (gen !== currentGen) return; // 旧世代，丢弃
  }
});
```

零依赖解决 SSE 竞态问题，无需引入 WebSocket 或第三方流控库。

### 3.5 TTS 串行队列与内存安全

`useTTSQueue` 维护串行播放队列，每个句子独立获取音频 blob，前一句播放完毕后才开始下一句：

- **动态入队**：LLM 一边流式输出一边有新的句子涌入队列
- **全局打断**：`stop()` 清空队列并销毁所有已生成的 blob URL
- **内存回收**：每句播放后立即 `URL.revokeObjectURL()`，停止时遍历销毁未播放的 blob

数字人在每句播放期间自动切换表情（thinking），句间恢复 neutral，形成自然的“思考→说话”节奏。

### 3.6 文本清洗管道

LLM 原始输出包含 Markdown 格式、URL、不规范的标点。`cleanTextForTTS` 管道以纯函数组合的方式清洗文本：

1. 去除 Markdown 标记
2. 清除 URL
3. 换行符 → 中文逗号
4. 中文标点规范化（`。！？` → `. ! ? `，强制 TTS 呼吸停顿）

### 3.7 依赖注入与可测试性

服务实例通过 Vue 的 `provide/inject` 机制注入组件树。测试时只需 provide mock 服务，组件代码无需任何修改。

---

## 四、数据流全景

```
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ 语音输入  │───▶│ SenseVoice   │───▶│  识别文本     │───▶│          │
│ (麦克风)  │    │ HTTP REST    │    │              │    │          │
└──────────┘    └──────────────┘    └──────┬───────┘    │          │
                                           │            │ LLM 适配器│
┌──────────┐                               │            │ SSE 流   │
│ 文本输入  │───────────────────────────────┘            │ Dify/Coze│
│ (对话面板)│                                            │          │
└──────────┘                                            └────┬─────┘
                                                             │
                              ┌──────────────────────────────┘
                              │ 流式 chunk (SSE)
                              ▼
                    ┌─────────────────┐
                    │ useChatStream   │─── 实时更新 messages[] (打字机效果)
                    │ 句子边界检测      │
                    │ 世代号守卫        │
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
                             │ fetchAudio (HTTP REST)
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

## 五、总结

本系统的核心设计原则：

1. **抽象分层，关注点分离**：四层架构按抽象级别划分，每层有明确职责边界，非按业务功能的平级堆叠
2. **协议封装，适配器统一异构通信**：HTTP REST、SSE、WebRTC 的差异被服务适配层封装，上层不感知
3. **约束驱动创新**：SSE 的协议约束催生了世代号竞态控制机制，协议选择与架构决策之间有清晰的因果链
4. **流式优先、鲁棒性内置**：句子边界检测、Blob URL 生命周期管理、队列打断等保障机制是架构设计阶段的决策，而非事后补丁
