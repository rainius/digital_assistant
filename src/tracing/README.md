# 端到端时延埋点方案

配合论文《面向中职课堂的轻量级实时交互数字人系统》3.x 节实验数据采集使用。

## 一、目的

沿论文图2的时序,把每一轮问答的 6 个时间点采集下来,导出 JSONL,在本地用 pandas 计算均值/中位数/P95,填入实验结果表格。

```
    t0 ──ASR──▶ t1 ──LLM首字──▶ t2 ──首句成形──▶ t3 ──TTS──▶ t4 ──开口──▶ t5
    用户结束说话                                                          数字人开始播讲
```

## 二、文件

```
src/tracing/
├── tracer.js       —— 埋点器本体(浏览器侧,零依赖)
├── PATCHES.md      —— 5 个文件的最小改动清单(加行不删行)
└── analyze.py      —— 离线分析脚本
```

## 三、快速上手

### 3.1 打埋点

按 [PATCHES.md](./PATCHES.md) 手工把 5 处 `tracer.mark(...)` 加进去(总共 7 行左右)。所有埋点都是**加行不删行**,不影响功能。关闭埋点很简单:不调 `tracer.begin()` 时,所有 `mark()` 静默失效。

### 3.2 跑实验

1. 启动前端 (`npm run dev`),打开 DevTools Console。
2. 可选:标注这一批实验的配置
   ```js
   __tracer.meta({ avatar: 'live2d', llm: 'dify', tts: 'gpt-sovits', hardware: 'school' });
   ```
3. 正常做 N 轮语音问答。每轮完成后自动落盘。
4. Console 里检查:
   ```js
   __tracer.all().length   // 记录的轮数
   ```
5. 一批做完,导出:
   ```js
   __tracer.download()     // 触发下载 traces-YYYYMMDD-HHmmss.jsonl
   __tracer.clear()        // 清掉,再跑下一组配置
   ```

### 3.3 离线分析

```bash
pip install pandas
python analyze.py traces-20260705-143022.jsonl
```

或合并多批:
```bash
python analyze.py traces-*.jsonl
```

输出示例:
```
                     ASR   LLM首字  首句成形  TTS首段    开口    端到端
n                    32.0    32.0     32.0     32.0    32.0    32.0
mean(ms)            420.5   380.2    850.1    210.4    45.2   1906.4
p50(ms)             410.0   350.0    780.0    195.0    40.0   1830.0
p95(ms)             620.0   620.0   1350.0    380.0   110.0   2830.0
```

## 四、时间点定义

| 标记 | 含义 | 埋点位置 |
|---|---|---|
| `t0_speech_end` | 用户结束说话 | `useVoiceRecorder.js` `stopAndRecognize` 前 |
| `t1_asr_return` | ASR 返回识别文本 | `useVoiceRecorder.js` `stopAndRecognize` 后 |
| `t2_llm_first_chunk` | LLM 首个 chunk | `useChatStream.js` `onChunk` 首次 |
| `t3_first_sentence` | 编排层切出首句 | `useChatStream.js` 句子切分后 |
| `t4_tts_first_return` | TTS 首段音频就绪 | `useTTSQueue.js` `fetchAudio` 后 |
| `t5_play_start` | 数字人开始播讲 | `Live2DAdapter` `speak` / `LiveTalking` `ontrack` |

## 五、实验矩阵建议

按下面几组配置各跑 ≥30 轮,填 `meta` 时标注清楚:

| 组别 | avatar | llm | 硬件 | 说明 |
|---|---|---|---|---|
| A | live2d | dify(RAG) | school | 主推方案,学校 GPU |
| B | livetalking | dify(RAG) | school | 视频合成路径(t5 只测首轮见 PATCHES) |
| C | live2d | dify(no-RAG) | school | 关掉 RAG 看知识召回耗时占比 |
| D | live2d | coze(云端) | school | 云平台对照组 |

前三组是本地/校内硬件,论文数据核心。D 组是"轻量级"合理性论证,若时间紧可留到后续版本。

## 六、注意事项

1. **只算真正走通的轮次**。异常/被打断的轨迹在 analyze.py 里会自动被 `None` 屏蔽,但如果一批里失败很多,建议标注 `__tracer.meta({ note: 'flaky-network' })` 并单独分析。
2. **LiveTalking 的 t5 只能测首轮**。原因:WebRTC ontrack 只在初次建连触发。要严格测每轮,得改用 `<video>` 元素的 `playing` 事件或 canvas 抽帧,PATCHES.md 里有说明,是后续增强点。
3. **文本对话对照组**。目前 `begin()` 是从录音结束开始的。要跑文本模式,需要在 `handleAISend` 入口手工调 `tracer.begin()` + `tracer.mark('t0_speech_end')`(以文本提交作为 t0)。
