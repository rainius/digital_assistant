<template>
  <aside class="user-panel">
    <!-- 用户信息头部 -->
    <div class="user-header">
      <div class="avatar">
        <svg viewBox="0 0 24 24" class="avatar-icon">
          <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
        </svg>
      </div>
      <div class="user-meta">
        <span class="user-name">张同学</span>
        <span class="user-class">数字媒体技术 · 2024级</span>
      </div>
    </div>

    <!-- 我的课程 -->
    <div class="courses-section">
      <h3 class="section-title">我的课程</h3>
      <ul class="course-list">
        <li
          v-for="course in courses"
          :key="course.name"
          class="course-item"
        >
          <span class="course-icon" :style="{ background: course.color }">
            <svg viewBox="0 0 24 24" class="icon">
              <path :d="course.icon" />
            </svg>
          </span>
          <span class="course-name">{{ course.name }}</span>
        </li>
      </ul>
    </div>
  </aside>
</template>

<script setup>
const courses = [
  {
    name: '人工智能导论',
    color: '#4f46e5',
    icon: 'M12,3L1,9L12,15L21,10.09V17H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z',
  },
  {
    name: '用户界面设计',
    color: '#0891b2',
    icon: 'M12,19.2C9.5,19.2 7.29,17.92 6,16C6.03,14 10,12.9 12,12.9C14,12.9 17.97,14 18,16C16.71,17.92 14.5,19.2 12,19.2M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,6.47 17.5,2 12,2Z',
  },
  {
    name: '虚拟现实技术基础',
    color: '#7c3aed',
    icon: 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M8.56,16.44L12,19.88L15.44,16.44L12,13L8.56,16.44M15.44,7.56L12,4.12L8.56,7.56L12,11L15.44,7.56Z',
  },
];
</script>

<style scoped>
.user-panel {
  width: 20%;
  min-width: 240px;
  background: #fff;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid #e4e7ed;
  overflow-y: auto;
}

/* 用户头部 */
.user-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 24px 20px;
  border-bottom: 1px solid #f1f5f9;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-icon {
  width: 26px;
  height: 26px;
  fill: #fff;
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-main);
}

.user-class {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* 课程区域 */
.courses-section {
  flex: 1;
  padding: 20px;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 14px;
  padding-left: 4px;
}

.course-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.course-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  background: #fafbfc;
  cursor: pointer;
  transition: all 0.2s;
}

.course-item:hover {
  background: #f1f5f9;
  border-color: #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.course-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.course-icon .icon {
  width: 20px;
  height: 20px;
  fill: #fff;
}

.course-name {
  font-size: 0.95rem;
  color: var(--text-main);
}
</style>
