<template>
  <div class="page-container">
    <!-- 左侧侧边栏 (添加 overflow: hidden) -->
    <aside class="sidebar" :class="{ 'collapsed': !isSidebarOpen }">
      <div class="sidebar-inner">
        <!-- ... 这里保留原本的所有侧边栏内容 ... -->

        <!-- 测试音频按钮 -->
        <div class="row">
          <button class="btn btn-default" @click="handlePlayTestAudio">测试音频</button>
        </div>

        <!-- 场景选择 -->
        <div class="row control-group">
          <label>选择数字人模型：</label>
          <div class="flex-row">
            <select v-model="selectedScene" class="form-select" ref="selected">
              <option value="eva">EVA RIN</option>
              <option value="hiyori">Hiyori</option>
              <option value="kei">kei_vowels_pro</option>
              <option value="march7th">March 7th</option>
              <option value="nova">Nova</option>
              <option value="pachan">Pachan</option>
            </select>
            <button class="btn btn-default">更新场景</button>
          </div>
        </div>

        <!-- 眼神跟随 -->
        <div class="row control-group">
          <label>眼神跟随鼠标：</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" value="follow" v-model="eyeTracking" />
              <span class="radio-text">跟随鼠标</span>
            </label>
            <label class="radio-label">
              <input type="radio" value="straight" v-model="eyeTracking" />
              <span class="radio-text">前方直视</span>
            </label>
          </div>
        </div>

        <!-- 聊天交互卡片 -->
        <div class="card">
          <div class="card-header">聊天交互</div>
          <div class="card-body">
            <div class="flex-row mb-2">
              <input type="text" v-model="chatInput" class="form-input" placeholder="输入消息..." />
              <button class="btn btn-default" @click="sendMessage">发送消息</button>
            </div>
            <textarea class="form-textarea readonly" readonly v-model="chatResponse"></textarea>
          </div>
        </div>

        <!-- 语音合成卡片 -->
        <div class="card">
          <div class="card-header">语音合成</div>
          <div class="card-body">
            <textarea class="form-textarea mb-2" v-model="ttsInput"></textarea>
            <div class="flex-row button-group">
              <button class="btn btn-default">并行推理</button>
              <button class="btn btn-default">流式推理</button>
              <button class="btn btn-default">停止讲话</button>
            </div>
          </div>
        </div>

      </div>
    </aside>

    <!-- ★ 重点：按钮移到了这里，并根据状态控制位置 -->
    <div class="toggle-btn" :class="{ 'collapsed': !isSidebarOpen }" @click="toggleSidebar" title="切换侧边栏">
      <span>{{ isSidebarOpen ? '❮' : '❯' }}</span>
    </div>

    <!-- 右侧主内容区 -->
    <main class="main-content">
      <!-- 顶部工具栏 -->
      <div class="top-bar">
        <span>调整大小: {{ modelSize }}</span>
        <div class="slider-container">
          <input type="range" min="0.5" max="3.0" step="0.1" v-model="modelSize" class="slider" />
        </div>
      </div>

      <!-- 模型展示区 -->
      <div class="model-viewport">
        <div class="character-wrapper" :style="{
          transform: `scale(${modelSize / 2}) translate(${characterPosition.x}px, ${characterPosition.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }" @mousedown="startDrag">
          <div class="live2d-container" ref="live2dContainer">
            <canvas ref="canvas" id="live2d-canvas"></canvas>
          </div>
        </div>
        <div class="subtitle">怎么去发布和上架</div>

        <div class="voice-interaction-container">
          <button class="voice-btn" :class="{ 'recording': isRecording }" @click="toggleVoiceRecording" title="点击开始对话">
            <svg class="mic-icon" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path
                d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>

            <div class="voice-ripple" v-if="isRecording"></div>
          </button>
          <span class="voice-status" v-if="isRecording">正在聆听...</span>
          <span class="voice-status processing" v-if="isRecognizing">正在识别...</span>
        </div>
      </div>
    </main>
    <!-- AI 面板区 -->
    <!-- 1. 悬浮触发按钮 -->
    <button class="ai-float-btn" @click="toggleAISidebar">
      <svg class="ai-icon" viewBox="0 0 24 24">
        <path
          d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z" />
      </svg>
    </button>

    <!-- 2. AI 侧边栏主体 -->
    <div :class="['ai-sidebar', { active: isOpen }]">
      <!-- 头部 -->
      <div class="ai-header">
        <div class="ai-title">
          <span class="status-dot"></span>
          AI Assistant
        </div>
        <button class="close-btn" @click="toggleAISidebar">&times;</button>
      </div>

      <!-- 聊天内容区域 -->
      <div class="ai-chat-body" ref="chatBodyRef">
        <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
          <!-- 使用 v-html 可以支持简单的格式，或者只用 {{ }} 纯文本 -->
          <span v-html="msg.content"></span>
        </div>

        <!-- Loading 动画占位 -->
        <div v-if="isThinking" class="message ai thinking">
          <span>●</span><span>●</span><span>●</span>
        </div>
      </div>

      <!-- 底部输入框 -->
      <div class="ai-input-wrapper">
        <div class="input-container">
          <input ref="inputRef" v-model="inputText" type="text" class="chat-input" placeholder="输入您的问题..."
            @keydown.enter="sendAIMessage" />
          <button class="send-btn" @click="sendAIMessage">
            <svg style="width:16px;height:16px;fill:white;transform:translateX(2px)" viewBox="0 0 24 24">
              <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
// 【新增】引入录音库核心和wav编码器
import Recorder from 'recorder-core';
import 'recorder-core/src/engine/wav';
// --- 新增：语音输入逻辑 ---
// --- 语音识别核心逻辑 ---
const isRecording = ref(false); // 是否正在录音
const isRecognizing = ref(false); // 是否正在请求API识别
const asrApiUrl = '/api/asr'; // SenseVoice API 地址

// 【修改】不再使用 mediaRecorder，改用 recorder-core 实例
let rec = null;
// let audioChunks = [];

// 1. 切换录音状态（绑定到按钮点击）
const toggleVoiceRecording = async () => {
  // 如果正在识别中，忽略点击，防止重复提交
  if (isRecognizing.value) return;

  if (!isRecording.value) {
    // -> 开始录音
    await startCapture();
  } else {
    // -> 停止录音 (会自动触发识别)
    stopCapture();
  }
};

// 2. 开始捕获音频
const startCapture = async () => {
  try {
    // 初始化录音实例
    rec = Recorder({
      type: "wav",       // 【关键】强制输出 wav 格式
      sampleRate: 16000, // 【关键】强制采样率 16k (SenseVoice 最佳)
      bitRate: 16,       // 16位
      onProcess: (buffers, powerLevel, bufferDuration, bufferSampleRate) => {
        // 如果需要做可视化波形图，可以在这里获取 powerLevel
        console.log(buffers, powerLevel, bufferDuration, bufferSampleRate);
      }
    });

    // 打开麦克风
    rec.open(() => {
      // 打开成功，开始录音
      rec.start();
      isRecording.value = true;
      console.log('[Audio] 开始录音 (WAV 16k)...');
    }, (msg, isUserNotAllow) => {
      // 打开失败
      console.error('无法启动麦克风:', msg);
      alert((isUserNotAllow ? "用户拒绝了权限" : "无法打开麦克风") + ": " + msg);
    });
  } catch (error) {
    console.error('无法启动麦克风:', error);
    alert('无法启动麦克风，请检查权限。');
  }
};

// 3. 停止捕获
const stopCapture = () => {
  if (rec && isRecording.value) {
    console.log('[Audio] 停止录音，处理中...');

    // 停止录音，获取 Blob
    rec.stop((blob, duration) => {
      console.log(duration);
      isRecording.value = false;

      // 关闭麦克风，释放资源
      rec.close();
      rec = null;

      // ★ 核心整合：立即触发识别
      // blob 已经是标准的 wav 文件流了
      processRecognition(blob);

    }, (msg) => {
      console.error("录音失败:", msg);
      isRecording.value = false;
    });
  }
};

// 4. 调用 API 进行识别
const processRecognition = async (blob) => {
  isRecognizing.value = true; //以此状态在UI上显示“转圈/分析中”

  try {
    const formData = new FormData();
    const audioFile = new File([blob], 'voice_input.webm', { type: 'audio/webm' });

    // 组装 API 参数
    formData.append('files', audioFile);
    formData.append('lang', 'auto'); // 自动检测语言，也可以写死 'zh'

    console.log('[API] 发送音频数据到 SenseVoice...');

    const response = await fetch(asrApiUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const responseData = await response.json();
    console.log('[API] 识别结果:', responseData);

    // 获取文本 (根据你的API返回结构，可能是 result.text 或 result)
    let text = "";
    if (responseData.result && responseData.result.length > 0) {
      text = responseData.result[0].clean_text;
    }

    console.log('[API] 提取文本:', text);

    if (text) {
      // ★ 核心整合：将识别结果填入 AI 侧边栏的输入框并发送
      // 1. 打开侧边栏（如果没开）
      if (!isOpen.value) toggleAISidebar();

      // 2. 填入文本
      inputText.value = text;

      // 3. 稍作延迟后自动发送 (可选，为了让用户看到识别出的字)
      setTimeout(() => {
        sendAIMessage();
      }, 500);
    }

  } catch (error) {
    console.error('语音识别失败:', error);
    inputText.value = "[语音识别失败，请重试]";
  } finally {
    isRecognizing.value = false;
  }
};

// 侧边栏状态
const isSidebarOpen = ref(true);
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

// ... (保留原本的其他所有 script 逻辑，无需改动) ...
const selectedScene = ref('nova');
const eyeTracking = ref('follow');
const modelSize = ref(2.0);
const chatInput = ref('你能做什么');
const defaultText = '我可以基于【马斯克·陈】提供的关爱老婆百事通里包含的老婆喜好、喜欢的东西、习惯、身体状况等信息，分析老婆的情况并给出行动建议。';
const chatResponse = ref(defaultText);
const ttsInput = ref(defaultText);
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const characterPosition = ref({ x: 0, y: 0 });

const startDrag = (e) => {
  if (e.button !== 0) return;
  isDragging.value = true;
  dragStart.value = {
    x: e.clientX - characterPosition.value.x,
    y: e.clientY - characterPosition.value.y,
  };
  e.preventDefault();
};

const onDrag = (e) => {
  if (!isDragging.value) return;
  e.preventDefault();
  const modelViewport = document.querySelector('.model-viewport');
  const characterWrapper = document.querySelector('.character-wrapper');
  if (!modelViewport || !characterWrapper) return;
  const viewportRect = modelViewport.getBoundingClientRect();
  const wrapperRect = characterWrapper.getBoundingClientRect();
  const maxX = viewportRect.width / 2 - wrapperRect.width / 2;
  const maxY = viewportRect.height / 2 - wrapperRect.height / 2;
  characterPosition.value = {
    x: Math.min(Math.max(e.clientX - dragStart.value.x, -maxX), maxX),
    y: Math.min(Math.max(e.clientY - dragStart.value.y, -maxY), maxY),
  };
};

const stopDrag = () => {
  isDragging.value = false;
};
const sendMessage = () => console.log('发送消息:', chatInput.value);


//---------- 数字人 ---------------
// 引用canvas元素
const canvas = ref(null);
const live2dContainer = ref(null);
// 保存model引用以便在组件中使用
let model = null;
// let motionSync = null;
let app1 = null;

// 定义测试音频的函数
const handlePlayTestAudio = () => {
  console.log('开始播放测试音频...');
  let spk = "./Keira.wav";
  playTestAudio(spk);
};

// 播放测试音频
const playTestAudio = (spk) => {
  console.log("播放测试音频");
  console.log(model);
  console.log(model.speak);
  if (model) {
    // 使用模型说话功能播放音频
    model.speak(spk, {
      volume: 1,
      expression: 8,
      resetExpression: true,
      crossOrigin: "anonymous",
    });
  } else {
    console.warn("模型未加载，无法播放音频");
  }
};

onMounted(async () => {
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);

  // 实际项目中可以计算图片宽度居中，这里暂时写死
  // 确保所需的库已经在全局可用
  const PIXI = window.PIXI;
  const live2d = PIXI.live2d;

  if (!PIXI || !live2d) {
    console.error("PIXI或live2d库未加载");
    return;
  }
  console.log("Resize", live2dContainer.value);
  try {
    // 创建第一个应用和渲染上下文
    app1 = new PIXI.Application({
      view: canvas.value,
      autoStart: true,
      resizeTo: live2dContainer.value,
      autoResize: true,
      transparent: true,
      backgroundAlpha: 0,
      antialias: true,
    });

  } catch (error) {
    console.error(error);
  }

  setTimeout(async () => {
    try {
      // const modelPath = "./models/${selectedScene.value}/${selectedScene.value}.model3.json";
      const modelPath = "./models/pachan/pachan.model3.json";
      console.log("Model", selectedScene.value);
      const loadedModel2 = await live2d.Live2DModel.from(modelPath, { autoInteract: true });
      loadedModel2.position.x = 0
      loadedModel2.position.y = 0

      // 设置模型大小和位置...
      const containerWidth = live2dContainer.value.clientWidth;
      const containerHeight = live2dContainer.value.clientHeight;
      const scale = Math.min(
        containerWidth / loadedModel2.width,
        containerHeight / loadedModel2.height
      );
      loadedModel2.scale.set(scale);
      model = loadedModel2;
      // 设置点击事件
      loadedModel2.on("hit", (hitAreas) => {
        if (hitAreas.includes("Body")) {
          loadedModel2.motion("Tap");
        }
        if (hitAreas.includes("Head")) {
          loadedModel2.expression();
        }
      });
      app1.stage.addChild(loadedModel2);
    } catch (error) {
      console.error(error);
    }
  }, 3000); // 500毫秒延迟
});
onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
});

// -------- AI边栏 ----------
// --- 状态定义 ---
const isOpen = ref(false);
const inputText = ref('');
const isThinking = ref(false);
const chatBodyRef = ref(null);
const inputRef = ref(null);

// 初始消息数据
const messages = ref([
  {
    role: 'ai',
    content: '您好！我是您的智能助手。<br>有什么我可以帮您的吗？'
  }
]);

// --- 方法逻辑 ---

// 1. 切换侧边栏状态
const toggleAISidebar = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    // 展开时自动聚焦输入框
    nextTick(() => {
      inputRef.value?.focus();
      scrollToBottom();
    });
  }
};

// 配置您的凭证（注意：在生产环境中，这些敏感信息不应硬编码在前端代码中）
const botId = '7581057336081989658';
const accessToken = 'pat_w1UVPk6EFIsDBokCWBRvbWpn8lSoSXUBM09fhRpCWuFtvtHQkeqrFGvfc8D0Hehe';
const userId = '123456789'; // 例如 '123456789'

// 定义全局变量用于管理队列
var audioQueue = [];
var isPlaying = false;

// 队列处理函数
const processAudioQueue = async (model) => {
  if (isPlaying || audioQueue.length === 0) return;

  isPlaying = true;
  const audioUrl = audioQueue.shift();

  try {
    console.log("开始播放片段...");

    // await 会一直暂停在这里，直到 talk 里的 onFinish 被触发
    await talk(model, audioUrl);

    // (可选) 极短的缓冲，让连续发音之间的衔接更自然（比如 50ms）
    // 如果想要机关枪语速，可以去掉这行
    await new Promise(r => setTimeout(r, 50));

  } catch (err) {
    console.error("队列错误:", err);
  } finally {
    // 释放内存
    URL.revokeObjectURL(audioUrl);
    isPlaying = false;
    // 递归处理下一段
    processAudioQueue(model);
  }
}

const talk = (model, audio_link) => {
  return new Promise((resolve) => {

    model.speak(audio_link, {
      volume: 1,
      expression: 8,
      resetExpression: true,
      crossOrigin: "anonymous",

      // 【核心逻辑】
      // 当音频自然播放结束时，库会调用这个函数
      onFinish: () => {
        console.log("当前片段播放完毕");
        resolve(); // 解除 await 阻塞，允许队列播放下一段
      },

      // 如果加载出错，也要 resolve，防止队列卡死
      onError: (err) => {
        console.error("播放出错:", err);
        resolve();
      }
    }).catch(e => {
      // 捕获 speak 方法本身的同步错误
      console.error("调用 speak 失败:", e);
      resolve();
    });

  });
}

// 2. 发送消息
const sendAIMessage = async () => {
  const text = inputText.value.trim();
  console.log("[COZE] text", text);
  if (!text) return;

  // 添加用户消息
  messages.value.push({ role: 'user', content: text });
  inputText.value = '';
  scrollToBottom();

  // 模拟 AI 思考状态
  isThinking.value = true;
  await scrollToBottom();

  // 1. 构建请求体
  const requestBody = {
    bot_id: botId,
    user_id: userId,
    stream: true, // 启用流式传输
    additional_messages: [
      {
        role: 'user',
        content: text,
        content_type: 'text',
        type: 'question'
      }
    ]
  };

  try {
    // 2. 发起Fetch请求
    const response = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(requestBody)
    });

    // 3. 检查响应是否正常
    if (!response.ok) {
      throw new Error(`网络响应异常: ${response.status}`);
    }

    // 4. 获取可读流
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let currentEventType = "";   // 记录当前行的事件类型
    var accumulatedContent = ''; // 用于累积AI返回的消息

    messages.value.push({ role: 'ai', content: "" });
    const lastMsgIndex = messages.value.length - 1;
    // 5. 循环读取流数据
    for (; ;) {
      const { done, value } = await reader.read();
      if (done) break; // 流读取结束

      // 解码数据块
      const chunk = decoder.decode(value, { stream: true });
      // 按换行符分割，因为SSE数据是以"data: "开头的多行文本 [1](@ref)
      const lines = chunk.split('\n');

      for (const line of lines) {
        console.log(line);
        const trimmedLine = line.trim();
        if (!trimmedLine) continue; // 忽略空行和结束信号

        // 1. 识别事件类型行
        if (trimmedLine.startsWith('event:')) {
          currentEventType = trimmedLine.replace('event:', '').trim();
        }
        // 2. 识别数据行
        else if (trimmedLine.startsWith('data:') && currentEventType) {
          const jsonDataStr = trimmedLine.replace('data:', '').trim();

          // 检查流式传输结束标志[3](@ref)
          if (jsonDataStr === '[DONE]') {
            console.log('Stream finished.');
            break;
          }

          try {
            const data = JSON.parse(jsonDataStr);

            // 3. 核心逻辑：根据事件类型进行分支处理
            if (currentEventType === 'conversation.message.delta') {
              // 处理增量内容
              if (data.type === 'answer' && data.content) {
                accumulatedContent += data.content; // 累积内容
                messages.value[lastMsgIndex].content += data.content;
                // 实时更新UI，实现打字机效果[3](@ref)
                // updateUI(accumulatedContent);
              }
            } else if (currentEventType === 'conversation.message.completed') {
              // 处理完成事件
              if (data.type === 'verbose') {
                const contentObj = JSON.parse(data.content);
                if (contentObj.msg_type === 'generate_answer_finish') {
                  // 确认对话完成，进行收尾工作[1](@ref)
                  // handleConversationComplete(accumulatedContent);
                  console.log("Result", accumulatedContent);
                }
              }
            }
          } catch (e) {
            console.error('Parsing error:', e, 'Raw data:', jsonDataStr);
          }
          // 重置当前事件类型，等待下一组事件/数据
          currentEventType = "";
        }
      }
    }
    // 对话完成，可以将完整的accumulatedMessage存入历史记录
    //数字人朗读，后续来做精细处理，先实现
    // console.log("Answer", accumulatedContent);
    const resp = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: accumulatedContent,
        text_lang: 'zh',
        ref_audio_path: 'examples/teacher.wav',
        prompt_lang: 'zh',
        prompt_text: '同学们，我们一起来学习人工智能，探索AI科技的奇幻世界吧',
        text_split_method: 'cut5',
        batch_size: 1,
        media_type: 'ogg',
        speed_factor: 1.0,
        streaming_mode: "true"
      }),
    });

    const ttsReader = resp.body.getReader();
    let count = 0;
    while (count === 0) {
      const { done, value } = await ttsReader.read();
      if (done) {
        console.log("Stream done");
        //用户界面元素激活
        // $("#start_stream").prop("disabled", false);
        break;
      }

      // 【关键修改】过滤掉过小的数据包（例如小于 100 字节的可能是头部信息或静音帧）
      // 避免无效的 speak 调用导致播放队列混乱
      if (!value || value.byteLength === 0) {
        console.log("Skipping empty chunk:", value ? value.byteLength : 0);
        continue;
      }

      console.log("--------------------value");
      console.log(value);

      oggBuf = concatU8(oggBuf, value);

      const { files, rest } = extractOggByEOS(oggBuf);
      oggBuf = rest;

      for (const oneOgg of files) {
        const audioBlob = new Blob([oneOgg], { type: "audio/ogg" });
        if (DEBUG_SAVE) {
          saveBlob(audioBlob, `tts_seg_${String(segIndex++).padStart(4, "0")}.ogg`);
        }
        const audioUrl = URL.createObjectURL(audioBlob);
        audioQueue.push(audioUrl);
        processAudioQueue(model);
      }
    }
  } catch (error) {
    console.error('调用Coze API时发生错误:', error);
  }
  isThinking.value = false;
  scrollToBottom();
};

let oggBuf = new Uint8Array(0);

function concatU8(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function extractOggByEOS(buf) {
  const files = [];
  let pos = 0;

  // 从 buf 中逐页解析
  // eslint-disable-next-line
  while (true) {
    // 至少要有 page header
    if (buf.length - pos < 27) break;

    // 同步到 "OggS"
    if (buf[pos] !== 0x4f || buf[pos + 1] !== 0x67 || buf[pos + 2] !== 0x67 || buf[pos + 3] !== 0x53) {
      pos += 1;
      continue;
    }

    const headerType = buf[pos + 5];     // header_type_flag
    const segCount = buf[pos + 26];    // page_segments
    const segStart = pos + 27;

    if (buf.length - segStart < segCount) break;

    let bodyLen = 0;
    for (let i = 0; i < segCount; i++) bodyLen += buf[segStart + i];

    const pageLen = 27 + segCount + bodyLen;
    if (buf.length - pos < pageLen) break;

    pos += pageLen;

    // EOS page => 一个完整 ogg 结束
    if (headerType & 0x04) {
      files.push(buf.slice(0, pos));
      buf = buf.slice(pos);
      pos = 0;
    }
  }

  return { files, rest: buf.slice(pos) /* 保险：丢弃 pos 前的噪声 */ };
}

const DEBUG_SAVE = true;
let segIndex = 0;

function saveBlob(blob, filename) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// 3. 滚动到底部工具函数
const scrollToBottom = async () => {
  await nextTick(); // 等待 DOM 更新
  if (chatBodyRef.value) {
    chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight;
  }
};

</script>
<style scoped>
/* 全局容器 */
.page-container {
  display: flex;
  height: 100vh;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #333;
  background-color: #f5f7fa;
  overflow: hidden;
  position: relative;
  /* 为绝对定位的按钮提供参考 */

  --primary-gradient: linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%);
  --glass-bg: rgba(255, 255, 255, 0.75);
  --text-main: #1e293b;
  --text-secondary: #64748b;
  --ai-bubble-bg: #f1f5f9;
  --user-text: #ffffff;
  --shadow-float: 0 10px 40px -10px rgba(0, 0, 0, 0.15);
  --panel-width: 400px;

}

/* --- 侧边栏样式 --- */
.sidebar {
  width: 360px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  /* 关键：必须设置为 hidden，否则宽度变0时内容依然可见 */
  overflow: hidden;
  /* 关键：防止 flex 布局自动压缩侧边栏，确保宽度完全由 width 控制 */
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  z-index: 10;
}

/* 折叠状态 */
.sidebar.collapsed {
  width: 0;
  border-right: none;
  /* 折叠时隐藏边框 */
}

/* 内部内容容器：固定宽度 */
.sidebar-inner {
  width: 360px;
  /* 固定宽度，防止内容被挤压 */
  min-width: 360px;
  /* 强制最小宽度 */
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  /* 滚动条加在这里 */
  height: 100%;
  box-sizing: border-box;
}

/* --- 悬浮切换按钮样式 --- */
.toggle-btn {
  position: absolute;
  top: 50%;
  /* 默认位置：侧边栏宽度(360px)处 */
  left: 360px;
  transform: translateY(-50%);
  width: 16px;
  height: 60px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-left: none;
  /* 看起来像是粘在侧边栏上 */
  border-radius: 0 8px 8px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #909399;
  font-size: 12px;
  user-select: none;
  z-index: 20;
  transition: left 0.3s ease;
  /* 关键：跟随侧边栏移动 */
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
}

.toggle-btn:hover {
  background-color: #f0f2f5;
  color: #409eff;
}

/* 按钮折叠状态的位置 */
.toggle-btn.collapsed {
  left: 0;
  /* 折叠时回到最左侧 */
  border-left: 1px solid #e4e7ed;
  /* 补上左边框 */
}

/* --- 原有样式保留 --- */
.row {
  margin-bottom: 5px;
}

.control-group label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
  display: block;
}

.btn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn:hover {
  color: #409eff;
  border-color: #c6e2ff;
  background-color: #ecf5ff;
}

.form-select,
.form-input {
  width: 100%;
  padding: 6px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  border-color: #409eff;
}

.flex-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.mb-2 {
  margin-bottom: 8px;
}

.radio-group {
  display: flex;
  gap: 15px;
}

.radio-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 13px;
}

.radio-label input {
  margin-right: 4px;
  accent-color: #409eff;
}

.card {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
  flex-shrink: 0;
}

.card-header {
  padding: 10px 15px;
  color: #409eff;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid #ebeef5;
}

.card-body {
  padding: 15px;
}

.form-textarea {
  width: 100%;
  height: 100px;
  padding: 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  resize: none;
  font-size: 12px;
  line-height: 1.5;
  color: #606266;
  box-sizing: border-box;
}

.form-textarea.readonly {
  background-color: #f5f7fa;
  color: #909399;
}

.button-group {
  display: flex;
  justify-content: space-between;
}

/* 右侧主内容样式 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
  transition: all 0.3s ease;
  /* 确保右侧内容在左侧折叠时平滑扩展 */
}

.top-bar {
  height: 50px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 20px;
  background: #fdfdfd;
}

.slider-container {
  width: 200px;
}

.slider {
  width: 100%;
  accent-color: #409eff;
}

.model-viewport {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 水平居中 */
  justify-content: center;
  /* 垂直居中 */
  position: relative;
  background: radial-gradient(circle at center, #ffffff 0%, #f0f2f5 100%);
  overflow: hidden;
  padding: 20px;
  /* 防止正方形贴边 */
}

.character-wrapper {
  transition: transform 0.1s;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.live2d-container {
  /* 核心：强制宽高比为 1:1 */
  aspect-ratio: 1 / 1;

  /* 响应式大小控制：
     让它尽可能大，但不要超过父容器宽度的 90%，
     也不要超过父容器高度的 80% (留出底部字幕空间) 
  */
  width: min(90%, 80vh);

  /* 只是为了调试看清楚区域，可以加个临时背景色，正式版删掉 */
  /* background: rgba(0,0,0,0.05); */
  /* border: 1px dashed #ccc; */

  position: relative;
}

.character-img {
  height: 400px;
  width: auto;
}

.subtitle {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 24px;
  font-weight: bold;
  color: #000;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
  font-family: sans-serif;
  max-width: 80%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}

/* ================= 悬浮按钮 ================= */
.ai-float-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--primary-gradient);
  box-shadow: 0 8px 20px rgba(79, 70, 229, 0.4);
  border: 2px solid white;
  cursor: pointer;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ai-float-btn:hover {
  transform: translateY(-5px) scale(1.05);
  box-shadow: 0 15px 30px rgba(79, 70, 229, 0.5);
}

.ai-icon {
  width: 28px;
  height: 28px;
  fill: white;
}

/* ================= 侧边栏 ================= */
.ai-sidebar {
  position: fixed;
  top: 10px;
  bottom: 10px;
  right: calc(var(--panel-width) * -1.2);
  width: var(--panel-width);
  background: var(--glass-bg);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 20px;
  box-shadow: var(--shadow-float);
  z-index: 10000;
  /* 确保在最上层 */
  transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

.ai-sidebar.active {
  right: 10px;
}

/* ================= 头部 ================= */
.ai-header {
  padding: 18px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 20px 20px 0 0;
}

.ai-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-main);
  font-weight: 700;
  font-size: 1.05rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  background-color: #10b981;
  border-radius: 50%;
  position: relative;
}

.status-dot::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #10b981;
  opacity: 0.5;
  animation: ripple 1.5s infinite;
}

@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }

  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

.close-btn {
  background: #f1f5f9;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e2e8f0;
  color: var(--text-main);
}

/* ================= 聊天区 ================= */
.ai-chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgba(255, 255, 255, 0.2);
}

.ai-chat-body::-webkit-scrollbar {
  width: 5px;
}

.ai-chat-body::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

.message {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 0.95rem;
  line-height: 1.6;
  position: relative;
  word-wrap: break-word;
  /* 防止长单词撑开 */
  animation: slideUp 0.3s ease;
}

/* 角色样式区分 */
.message.ai {
  align-self: flex-start;
  background: var(--ai-bubble-bg);
  color: var(--text-main);
  border-bottom-left-radius: 4px;
}

.message.user {
  align-self: flex-end;
  background: var(--primary-gradient);
  color: var(--user-text);
  border-bottom-right-radius: 4px;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

/* 思考中动画点 */
.message.thinking {
  display: flex;
  gap: 4px;
  padding: 16px 20px;
}

.message.thinking span {
  width: 4px;
  height: 4px;
  background-color: #94a3b8;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.message.thinking span:nth-child(1) {
  animation-delay: -0.32s;
}

.message.thinking span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {

  0%,
  80%,
  100% {
    transform: scale(0);
  }

  40% {
    transform: scale(1);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ================= 输入区 ================= */
.ai-input-wrapper {
  padding: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  background: rgba(255, 255, 255, 0.6);
  border-radius: 0 0 20px 20px;
}

.input-container {
  display: flex;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 5px 5px 5px 20px;
  transition: all 0.3s;
}

.input-container:focus-within {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.95rem;
  color: var(--text-main);
}

.chat-input::placeholder {
  color: #94a3b8;
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--primary-gradient);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  transition: transform 0.2s;
}

.send-btn:hover {
  transform: scale(1.05);
}

/* ================= 移动端适配 ================= */
@media (max-width: 480px) {
  .ai-sidebar {
    --panel-width: 100%;
    top: 0;
    bottom: 0;
    right: -100%;
    border-radius: 0;
  }

  .ai-sidebar.active {
    right: 0;
  }

  .ai-header {
    border-radius: 0;
  }

  .ai-input-wrapper {
    border-radius: 0;
  }
}

/* ================= 语音交互按钮 ================= */
.voice-interaction-container {
  position: absolute;
  bottom: 80px;
  /* 位于字幕上方 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  /* 保证在模型之上，但低于侧边栏 */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.voice-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

  /* 默认状态：高识别度的主题色 */
  background: var(--primary-gradient);
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
}

.mic-icon {
  width: 28px;
  height: 28px;
  fill: white;
  z-index: 2;
  /* 确保图标在光晕之上 */
  transition: transform 0.3s ease;
}

/* 悬停效果 */
.voice-btn:hover:not(.recording) {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(79, 70, 229, 0.6);
}

/* ================= 录音状态 (Siri 风格) ================= */

/* 1. 按钮主体的变化 */
.voice-btn.recording {
  /* Siri 经典的混合渐变色 */
  background: linear-gradient(135deg, #1AF0DC, #A044FF, #FF0055);
  background-size: 200% 200%;
  animation: siri-gradient 3s ease infinite, breathe-btn 2s ease-in-out infinite;
  box-shadow: none;
  /* 阴影交给 ripple 处理 */
}

/* 2. 图标的微动 */
.voice-btn.recording .mic-icon {
  transform: scale(0.9);
  fill: rgba(255, 255, 255, 0.95);
}

/* 3. 外部波纹/光晕层 */
.voice-ripple {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  z-index: 1;
  box-shadow: 0 0 20px 5px rgba(160, 68, 255, 0.6),
    0 0 40px 10px rgba(26, 240, 220, 0.4);
  animation: ripple-pulse 2s infinite;
}

/* 4. 状态文字 */
.voice-status {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.8);
  padding: 4px 12px;
  border-radius: 12px;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.3s ease;
}

/* ================= 动画关键帧 ================= */

/* 背景色流动 */
@keyframes siri-gradient {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}

/* 按钮本体呼吸 (缩放) */
@keyframes breathe-btn {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.1);
  }

  100% {
    transform: scale(1);
  }
}

/* 光晕扩散 */
@keyframes ripple-pulse {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }

  50% {
    transform: scale(1.3);
    opacity: 0.4;
  }

  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}


/* === 新增：处理中状态 (API请求时) === */
.voice-btn.processing {
  background: #cbd5e1;
  /* 灰色背景表示等待 */
  cursor: wait;
  transform: scale(0.95);
  box-shadow: none;
}

.voice-status.processing {
  color: #4f46e5;
  background: rgba(255, 255, 255, 0.9);
}

/* Loading 旋转动画 */
.spinner-icon {
  width: 28px;
  height: 28px;
  fill: #4f46e5;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* 优化之前的 mic-icon 样式，确保它在 v-else 切换时平滑 */
.mic-icon {
  width: 28px;
  height: 28px;
  fill: white;
  z-index: 2;
  transition: transform 0.3s ease;
}
</style>
