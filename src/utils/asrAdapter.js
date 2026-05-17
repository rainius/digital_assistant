/**
 * ASR (Automatic Speech Recognition) 适配器
 * 负责：麦克风录音、音频格式转换 (WAV)、调用后端识别接口
 */
import Recorder from 'recorder-core';
// 引入 wav 编码引擎，保证输出的音频格式兼容绝大多数 AI 语音识别模型
import 'recorder-core/src/engine/wav';

export class ASRAdapter {
  /**
   * @param {string} apiUrl - 语音识别的后端 API 地址 (默认 '/api/asr')
   */
  constructor(apiUrl = '/api/asr') {
    this.apiUrl = apiUrl;
    this.rec = null; // 录音机实例
  }

  /**
   * 唤醒麦克风并开始录音
   * @returns {Promise} 成功则 resolve，失败(如拒绝权限)则 reject
   */
  start() {
    return new Promise((resolve, reject) => {
      // 初始化录音实例，强制为 16kHz 采样率、16位深度的单声道 WAV
      // 这是业界绝大多数语音识别模型（包括 SenseVoice / Whisper）的最佳标准输入
      this.rec = Recorder({ type: "wav", sampleRate: 16000, bitRate: 16 });

      this.rec.open(() => {
        // 麦克风打开成功，开始录制
        this.rec.start();
        resolve();
      }, (msg) => {
        // 打开失败（通常是因为浏览器未授权麦克风权限，或者非 https 环境）
        reject(new Error(msg));
      });
    });
  }

  /**
   * 停止录音并立即向后端发送识别请求
   * @returns {Promise<string>} 识别出的文本内容
   */
  stopAndRecognize() {
    return new Promise((resolve, reject) => {
      // 如果没有录音实例，直接返回空字符串
      if (!this.rec) return resolve("");

      // 停止录音，回调函数会返回一个包含音频数据的 blob 对象
      this.rec.stop(async (blob) => {
        // 立即关闭麦克风，释放系统资源
        this.rec.close();
        this.rec = null;

        try {
          // 构建标准的 FormData 进行文件上传
          const formData = new FormData();
          // 将 blob 包装成 File 对象，命名为 voice.wav
          formData.append('files', new File([blob], 'voice.wav', { type: 'audio/wav' }));
          formData.append('lang', 'auto'); // 语言自动检测

          // 发送 POST 请求到你的 ASR 接口
          const response = await fetch(this.apiUrl, { method: 'POST', body: formData });
          if (!response.ok) throw new Error('ASR 接口请求失败');

          const data = await response.json();
          // 提取返回结果中的文本内容 (根据你后端的实际返回格式调整这里)
          resolve(data.result?.[0]?.clean_text || "");
        } catch (error) {
          reject(error);
        }
      }, reject);
    });
  }
}