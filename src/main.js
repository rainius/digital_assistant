import { createApp } from 'vue'
import App from './App.vue'
// 引入 Element Plus
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
// 引入 Element Plus X
import ElementPlusX from 'vue-element-plus-x';
// 引入服务层
import { ServicesKey, createServices } from '@/services';

// createApp(App).mount('#app')
const app = createApp(App);
app.use(ElementPlus);
app.use(ElementPlusX); // 全局注册所有组件

// 注入服务实例(ASR / LLM / TTS / Avatar 配置)
app.provide(ServicesKey, createServices());

app.mount('#app');