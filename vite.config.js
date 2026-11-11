import { defineConfig } from 'vite'

// 纯静态单页：base 用相对路径，构建产物可直接丢到任意子目录托管
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    // 保活音频保持独立文件，不内联成 base64（与原静态版一致）
    assetsInlineLimit: 0,
    // ECharts 按需引入后主包约 540 kB / gzip 182 kB，属预期体积
    chunkSizeWarningLimit: 600
  }
})
