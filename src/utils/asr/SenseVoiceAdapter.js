import Recorder from 'recorder-core';
import 'recorder-core/src/engine/wav'; 

/**
 * 引擎一：阿里 SenseVoice 语音识别适配器
 * 特点：极其适合多语言、带情绪标记和富文本清洗的快速识别
 */
export class SenseVoiceAdapter {
  constructor(config) {
    this.apiUrl = config.apiUrl || '/api/asr';
    this.lang = config.lang || 'auto'; // 默认自动识别语言
    this.rec = null;
  }

  // 开始录音
  start() {
    return new Promise((resolve, reject) => {
      // 初始化录音：16kHz, 16bit, 单声道 WAV（SenseVoice 的标准输入）
      this.rec = Recorder({ type: "wav", sampleRate: 16000, bitRate: 16 });
      
      this.rec.open(() => {
        this.rec.start();
        resolve();
      }, (msg) => reject(new Error(`麦克风启动失败: ${msg}`)));
    });
  }

  // 停止录音并上传识别
  stopAndRecognize() {
    return new Promise((resolve, reject) => {
      if (!this.rec) return resolve("");
      
      this.rec.stop(async (blob) => {
        this.rec.close();
        this.rec = null;
        
        try {
          const formData = new FormData();
          formData.append('files', new File([blob], 'voice.wav', { type: 'audio/wav' }));
          formData.append('lang', this.lang);
          
          const response = await fetch(this.apiUrl, { method: 'POST', body: formData });
          if (!response.ok) throw new Error('SenseVoice API 响应错误');
          
          const data = await response.json();
          
          // 针对 SenseVoice 特有的返回格式进行解析取值
          // 提取 clean_text，自动过滤掉类似 <|happy|> 这种情绪标签
          resolve(data.result?.[0]?.clean_text || "");
        } catch (error) {
          reject(error);
        }
      }, reject);
    });
  }
}