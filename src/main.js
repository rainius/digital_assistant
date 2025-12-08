import { createApp } from 'vue'
import App from './App.vue'
// 引入 Element Plus
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
// 引入 Element Plus X
import ElementPlusX from 'vue-element-plus-x';


// createApp(App).mount('#app')
const app = createApp(App);
app.use(ElementPlus);
app.use(ElementPlusX); // 全局注册所有组件
app.mount('#app');