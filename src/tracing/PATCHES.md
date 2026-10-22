# 埋点补丁清单

一共 5 个文件需要改动，每处新增 1~3 行代码，均为**加行不删行**，不改变原逻辑。所有埋点都通过 `import { tracer } from '@/tracing/tracer'` 引入。

未 `begin()` 时 `mark()` 静默忽略,所以关掉埋点(不 begin)不会影响正常使用。

---

## 埋点点位对照表

| 时间点 | 语义 | 文件 | 定位行为 |
|---|---|---|---|
| `t0_speech_end` | 用户结束说话 | `composables/useVoiceRecorder.js` | `asr.stopAndRecognize()` 之前 |
| `t1_asr_return` | ASR 返回文本 | `composables/useVoiceRecorder.js` | `stopAndRecognize()` 返回后 |
| `t2_llm_first_chunk` | LLM 首字 | `composables/useChatStream.js` | `onChunk` 首次进入 |
| `t3_first_sentence` | 首个整句 | `composables/useChatStream.js` | 首次触发 `onSentence` 前 |
| `t4_tts_first_return` | 首段音频就绪 | `composables/useTTSQueue.js` | `tts.fetchAudio` 返回后(首次) |
| `t5_play_start` (Live2D) | 数字人开口 | `utils/avatar/Live2DAdapter.js` | `model.speak` 调用瞬间 |
| `t5_play_start` (LiveTalking) | 视频首帧 | `utils/avatar/LiveTalkingAdapter.js` | `pc.ontrack` 首次触发 |

---

## Patch 1 —— `src/composables/useVoiceRecorder.js`

**位置**: `toggle()` 函数内的 `else` 分支(停止录音路径)。

```diff
 import { ref, onUnmounted } from 'vue';
+import { tracer } from '@/tracing/tracer';

 export function useVoiceRecorder({ asr, onText }) {
   ...
     } else {
       // 停止录音并识别
       isRecording.value = false;
       isRecognizing.value = true;

+      tracer.begin();                       // 新一轮开始
+      tracer.mark('t0_speech_end');         // 用户结束说话
+
       try {
         const text = await asr.stopAndRecognize();
+        tracer.mark('t1_asr_return');       // ASR 返回文本
         if (text) {
           onText?.(text); // 通知上层
         }
```

> 说明：把 `begin()` 放在这里是最简单的做法。语音链路每轮都从这里起。如果做纯文本对话对照，需要在 `DigitalAssistant.vue` 的 `handleAISend` 或 `chat.send` 入口手动 `begin()` + `mark('t0_speech_end')`(以文本提交时刻代替 t0)。

---

## Patch 2 —— `src/composables/useChatStream.js`

**位置**: `send()` 中 `onChunk` 回调的顶部 + 句子切分成功后。

```diff
 import { ref } from 'vue';
+import { tracer } from '@/tracing/tracer';
 import { cleanTextForTTS, cleanTextForParagraphTTS } from '@/utils/text/cleanTextForTTS';
 import { containsSentenceEnd } from '@/utils/text/sentenceSplitter';

     try {
       await llm.streamChat(
         trimmedText,
         // onChunk: 打字机效果 + 句子切分
         (chunk) => {
           // 世代号守卫:如果不是当前世代,丢弃这个 chunk
           if (myGen !== currentGen.value) {
             console.log(`[Chat Stream] 丢弃旧世代 ${myGen} 的 chunk`);
             return;
           }

+          tracer.mark('t2_llm_first_chunk');  // 首字到达(内部只记首次)
+
           // 1. 更新 UI
           messages.value[aiMsgIndex].content += chunk;

           // 2. 积攒到句子 / 段落缓冲区
           sentenceBuffer += chunk;
           paragraphBuffer += chunk;

           // 3. 检测句末标点 → 切分完整句子 → 送 TTS
           if (containsSentenceEnd(chunk)) {
             const cleanedSentence = cleanTextForTTS(sentenceBuffer);
             if (cleanedSentence) {
+              tracer.mark('t3_first_sentence');  // 首个整句就绪
               onSentence?.(cleanedSentence);
             }
             sentenceBuffer = '';
           }
         },
```

> 说明：`tracer.mark` 内部只保留首次,所以每个 chunk 都写不用担心重复。这也是把埋点放这里最省事的原因。

---

## Patch 3 —— `src/composables/useTTSQueue.js`

**位置**: `enqueueText` 中 `fetchAudio` 返回之后。段模式(LiveTalking)走 `enqueueParagraph`,那一路 TTS 是服务端做的,前端拿不到 t4,一律在服务端旁路测(或用整段进入 `enqueueParagraph` 的时间近似)。

```diff
 import { ref, onUnmounted } from 'vue';
+import { tracer } from '@/tracing/tracer';

   async function enqueueText(sentence) {
     if (!sentence || stopped) return;
     if (avatar?.value?.streamMode === 'paragraph') return;

     try {
       // 文本驱动型适配器（如 LiveTalking）不需要外部 TTS，跳过合成
       const skipTTS = avatar?.value && avatar.value.needsTTS === false;
       const audioUrl = skipTTS ? null : await tts.fetchAudio(sentence);
+      if (!skipTTS) tracer.mark('t4_tts_first_return');  // 首段音频就绪

       if (stopped) return;
       if (!skipTTS && !audioUrl) return;
```

段模式路径,在 `enqueueParagraph` 里同样加一行(t4 语义此时代表"整段一次性合成返回"):

```diff
   async function enqueueParagraph(paragraph) {
     if (!paragraph || stopped) return;
     if (avatar?.value?.streamMode !== 'paragraph') return;

     try {
       const skipTTS = avatar?.value && avatar.value.needsTTS === false;
       const audioUrl = skipTTS ? null : await tts.fetchAudio(paragraph);
+      if (!skipTTS) tracer.mark('t4_tts_first_return');

       if (stopped) return;
```

> 说明：LiveTalking 走 `enqueueParagraph` 且 `skipTTS===true`,不会打 t4,这是正确行为(t4 在 LiveTalking 服务端内部)。

---

## Patch 4 —— `src/utils/avatar/Live2DAdapter.js`(Live2D 路径)

**位置**: `speak()` 里 `model.speak` 调用瞬间。t5 定义为"数字人开口",Live2D 的 `model.speak` 是**同步开始**加载并播放的,近似认为 API 调用即开口(工程上够用,10ms 级不影响结论)。

```diff
+import { tracer } from '@/tracing/tracer';
+
 export class Live2DAdapter {
   ...
   async speak(audioUrl /* , text */) {
     if (!this.model) return;
+    tracer.mark('t5_play_start');
     return new Promise((resolve) => {
```

> 如果要更严格：Live2D 的 `model.speak` 支持 `onLoad` 或用 HTMLAudioElement 的 `playing` 事件二次校准。但差距 <30 ms,论文里没必要区分。

---

## Patch 5 —— `src/utils/avatar/LiveTalkingAdapter.js`(LiveTalking 路径)

**位置**: `_connectWebRTC` 的 `pc.ontrack`。t5 = 视频首帧真正到达浏览器。**只记"当轮"打过 `/human` 之后第一次收到的视频帧**,靠 tracer.mark 内部"只记首次"防重复。

```diff
+import { tracer } from '@/tracing/tracer';
+
 export class LiveTalkingAdapter {
   ...
     this.pc.ontrack = (event) => {
       if (!this.videoEl) return;
       // 音频和视频共享同一个 MediaStream，srcObject 设一次即可
       if (this.videoEl.srcObject !== event.streams[0]) {
         this.videoEl.srcObject = event.streams[0];
+        // 首个远端轨道就绪 ≈ 首帧准备开始渲染。
+        // 由 tracer 内部"只记首次"保证每轮只打一次。
+        if (event.track.kind === 'video') tracer.mark('t5_play_start');
       }
       console.log('[LiveTalking] 远端', event.track.kind, '轨道就绪');
     };
```

> 更精细方案：监听 `videoEl` 的 `loadeddata` / `playing` 事件,能拿到"确实解码出第一帧"的时刻。ontrack 是"轨道就绪",两者相差通常 <100 ms。**注意**:LiveTalking 是**持续 WebRTC 连接**,ontrack 只在最初建连时触发一次,后续轮次不会重新触发。要严格测每轮 t5,需要改用 `<video>` 元素的 `playing`/`timeupdate` 事件、或用 canvas 抽帧检测像素变化 —— 这一部分需要另做,先按"首轮"数据发论文,或者只报告 Live2D 那一路。

---

## 一次会话结束的操作

浏览器 DevTools Console 里手动:

```js
__tracer.all()            // 看一眼记了多少轮
__tracer.download()       // 触发下载 traces-YYYYMMDD-HHmmss.jsonl
__tracer.clear()          // 清空,准备下一批实验
```

跑不同配置(Live2D vs LiveTalking / Dify vs Coze / 有RAG vs 无RAG)时,在**开始每一批之前**调一次 `__tracer.meta({...})` 打上标签,分析时按 meta 分组。
