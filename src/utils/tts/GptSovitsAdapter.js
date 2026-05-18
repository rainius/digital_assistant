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

  async streamTTS(text, onAudioReady) {
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