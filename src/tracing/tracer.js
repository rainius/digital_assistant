/**
 * 极简端到端时延埋点器 —— 一次会话一条轨迹。
 *
 * 定位:论文实验数据采集,不做上报、不做压缩、不做聚合。
 *      浏览器里跑,退出前手动导出 JSONL,拿到本地用 Python/pandas 算 mean/p50/p95。
 *
 * 用法概览:
 *   import { tracer } from '@/tracing/tracer';
 *
 *   tracer.begin('turn-1');           // 一轮问答开始
 *   tracer.mark('t0_speech_end');     // 用户松开录音按钮（时间原点）
 *   ...
 *   tracer.mark('t5_play_start');     // 数字人开始说话/首帧到达
 *   tracer.end();                     // 一轮结束,自动落盘到 sessionStorage
 *
 *   tracer.download();                // 结束实验后一次性导出 traces.jsonl
 *
 * 时间点(与论文 3.x 节图2对应):
 *   t0_speech_end        用户结束说话(本轮时间原点)
 *   t1_asr_return        ASR 返回识别文本
 *   t2_llm_first_chunk   LLM 首个 chunk 到达(打字机首字)
 *   t3_first_sentence    编排层切出第一个完整句子(送去 TTS 前)
 *   t4_tts_first_return  TTS 返回第一段音频 URL / LiveTalking 文本送达
 *   t5_play_start        数字人开始播讲(Live2D speak / LiveTalking 首帧)
 *
 * 记录格式 (schemaVersion: dh-trace/2.0):
 *   - marks:       相对 t0 的毫秒偏移量
 *   - eventUnixMs: 各标记的绝对 Unix 毫秒时间戳（可跨系统对齐）
 *   - t0UnixMs:    t0 时刻的 Unix 毫秒时间戳（marks 原点）
 *   - startedAt:   t0 时刻的 UTC ISO 字符串
 *
 * 附加元数据(可选):
 *   tracer.meta({ avatar: 'live2d', llm: 'dify', tts: 'gpt-sovits' });
 */

const STORAGE_KEY = 'dh_traces_v1';
const SCHEMA_VERSION = 'dh-trace/2.0';

// 允许的标记名(拼错会抛错,避免"t2_first_chunk" 和 "t2_llm_first_chunk" 混用)
const KNOWN_MARKS = [
  't0_speech_end',
  't1_asr_return',
  't2_llm_first_chunk',
  't3_first_sentence',
  't4_tts_first_return',
  't5_play_start',
];

class Tracer {
  constructor() {
    this.current = null;   // 当前正在记录的一轮
    this.globalMeta = {};  // 整个 session 共用的元数据(如 avatar 类型)
  }

  /** 设置整个 session 的固定元数据(avatar/llm/tts 组合等) */
  meta(obj) {
    Object.assign(this.globalMeta, obj || {});
  }

  /** 开始一轮问答。若上一轮未 end,自动 end 落盘。 */
  begin(id) {
    if (this.current) this.end();
    const turnId = id || `turn-${Date.now()}`;
    // 预初始化:所有标记 null,等 t0_speech_end 锚定后才开始记录
    const emptyMarks = {};
    const emptyEvents = {};
    for (const m of KNOWN_MARKS) {
      emptyMarks[m] = null;
      emptyEvents[m] = null;
    }
    this.current = {
      id: turnId,
      traceId: turnId,
      startedAt: null,          // t0 时刻填充
      t0UnixMs: null,           // t0 时刻填充
      t0PerfMs: null,           // t0 时刻 performance.now() 锚点
      marks: emptyMarks,
      eventUnixMs: emptyEvents,
      meta: { ...this.globalMeta },
      answer: '',
    };
  }

  /**
   * 记录一个时间点。同名标记只保留第一次(t2/t3/t4/t5 都是"首次"语义)。
   * t0_speech_end 作为本轮唯一时间原点,调用时锚定 t0PerfMs / t0UnixMs / startedAt。
   * 未 begin() 直接调用会静默忽略。
   */
  mark(name, extra) {
    if (!this.current) return;
    if (!KNOWN_MARKS.includes(name)) {
      console.warn('[tracer] 未知标记名:', name);
      return;
    }
    if (this.current.marks[name] !== null) return; // 只记首次

    const isT0 = (name === 't0_speech_end');

    if (isT0) {
      const now = Date.now();
      this.current.t0UnixMs = now;
      this.current.t0PerfMs = performance.now();
      this.current.startedAt = new Date(now).toISOString();
      this.current.marks[name] = 0;
      this.current.eventUnixMs[name] = now;
    } else {
      // t0 还未锚定时不记录（正常流程不会发生）
      if (this.current.t0PerfMs === null) return;
      const elapsed = performance.now() - this.current.t0PerfMs;
      this.current.marks[name] = elapsed;
      this.current.eventUnixMs[name] = this.current.t0UnixMs + elapsed;
    }

    if (extra) {
      this.current.meta[`${name}_extra`] = extra;
    }
  }

  /** 追加/覆写当前轮的元数据 */
  annotate(obj) {
    if (!this.current) return;
    Object.assign(this.current.meta, obj || {});
  }

  /** 记录本轮 AI 回答的完整文本 */
  content(text) {
    if (!this.current) return;
    this.current.answer = text || '';
  }

  /** 结束当前轮,落盘到 sessionStorage */
  end() {
    if (!this.current) return;
    const rec = this.current;
    const record = {
      schemaVersion: SCHEMA_VERSION,
      id: rec.id,
      traceId: rec.traceId,
      startedAt: rec.startedAt,
      t0UnixMs: rec.t0UnixMs,
      marks: { ...rec.marks },
      eventUnixMs: { ...rec.eventUnixMs },
      meta: { ...rec.meta },
      answer: rec.answer || '',
    };
    this._persist(record);
    this.current = null;
    return record;
  }

  _persist(record) {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(record);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.error('[tracer] 写入 sessionStorage 失败:', e);
    }
  }

  /** 返回本 session 所有已完成的轮 */
  all() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /** 清空本 session 已保存的轨迹(重跑实验前调用) */
  clear() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  /**
   * 触发浏览器下载 JSONL 文件。
   * @param {string} [filename] 默认 traces-YYYYMMDD-HHmmss.jsonl
   */
  download(filename) {
    if (this.current) this.end();  // 把还没结束的最后一轮也落盘
    const records = this.all();
    if (records.length === 0) {
      console.warn('[tracer] 没有可导出的轨迹');
      return;
    }
    const jsonl = records.map((r) => JSON.stringify(r)).join('\n');
    const blob = new Blob([jsonl], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || this._defaultFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _defaultFilename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `traces-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jsonl`
    );
  }
}

export const tracer = new Tracer();

// 方便开发时在 DevTools Console 里手工 tracer.download() / tracer.clear()
if (typeof window !== 'undefined') {
  window.__tracer = tracer;
}
