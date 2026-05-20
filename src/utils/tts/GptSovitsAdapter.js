/**
 * 引擎一：GPT-SoVITS 适配器
 * 特点：支持 OGG 二进制流式边推边播，适合长文本
 */
export class GptSovitsAdapter {
  constructor(config) {
    this.apiUrl = config.apiUrl || '/api/tts';
    this.refAudio = config.refAudio || 'examples/dbes01.wav';
    this.promptText = config.promptText || '同学们，我们一起来学习人工智能';
  }

  /**
   * 【新增】全量短句获取模式 (推荐使用)
   * 配合大模型前端流式断句，直接获取这段短句的完整 WAV 音频
   * @param {string} text - 已经被截断的干净单句（如："你好呀，"）
   */
  async fetchAudio(text) {
    console.log('[GPT-SoVITS] 正在合成短句：', text);
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          text_lang: 'zh',
          ref_audio_path: this.refAudio,
          prompt_lang: 'zh',
          prompt_text: this.promptText,

          // 【核心变化】
          text_split_method: 'cut0', // 前端已经断好句了，后端不需要再切
          batch_size: 1,
          media_type: 'wav',         // 强制返回 WAV，浏览器原生支持极好
          streaming_mode: "false"    // 关闭后端的流式分发
        })
      });

      if (!response.ok) throw new Error(`GPT-SoVITS 响应失败: ${response.status}`);

      // 等待这 0.1 秒的短句音频完整下载完毕
      const blob = await response.blob();

      // 生成本地 Blob URL 供数字人队列播放
      return URL.createObjectURL(blob);

    } catch (error) {
      console.error('[GPT-SoVITS] 音频获取失败:', error);
      return null;
    }
  }

  /**
   * 【保留】旧版的 OGG 纯流式解析模式
   * 如果以后要发送超长文本不切片，可以随时切换回来调用这个方法
   */
  async streamTTS(text, onAudioReady) {
    console.log('GPT-SoVITS TTS请求参数：', this.apiUrl);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        text_lang: 'zh',
        ref_audio_path: this.refAudio,
        prompt_lang: 'zh',
        prompt_text: this.promptText,
        text_split_method: 'cut5',
        batch_size: 1,
        media_type: 'ogg',
        streaming_mode: "true"
      })
    });

    const reader = response.body.getReader();
    let oggBuf = new Uint8Array(0);

    let isReading = true;
    while (isReading) {
      const { done, value } = await reader.read();
      if (done) {
        isReading = false;
        break;
      }
      if (!value || value.byteLength === 0) continue;

      oggBuf = this._concatU8(oggBuf, value);
      const { files, rest } = this._extractOggByEOS(oggBuf);
      oggBuf = rest;

      for (const oneOgg of files) {
        const audioBlob = new Blob([oneOgg], { type: "audio/ogg" });
        const audioUrl = URL.createObjectURL(audioBlob);
        onAudioReady(audioUrl);
      }
    }
  }

  _concatU8(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0); out.set(b, a.length);
    return out;
  }

  _extractOggByEOS(buf) {
    const files = [];
    let pos = 0;
    let hasMoreData = true;
    while (hasMoreData) {
      if (buf.length - pos < 27) { hasMoreData = false; break; }
      if (buf[pos] !== 0x4f || buf[pos + 1] !== 0x67 || buf[pos + 2] !== 0x67 || buf[pos + 3] !== 0x53) {
        pos += 1; continue;
      }
      const headerType = buf[pos + 5];
      const segCount = buf[pos + 26];
      const segStart = pos + 27;
      if (buf.length - segStart < segCount) { hasMoreData = false; break; }

      let bodyLen = 0;
      for (let i = 0; i < segCount; i++) bodyLen += buf[segStart + i];
      const pageLen = 27 + segCount + bodyLen;
      if (buf.length - pos < pageLen) { hasMoreData = false; break; }

      pos += pageLen;
      if (headerType & 0x04) {
        files.push(buf.slice(0, pos));
        buf = buf.slice(pos);
        pos = 0;
      }
    }
    return { files, rest: buf.slice(pos) };
  }
}