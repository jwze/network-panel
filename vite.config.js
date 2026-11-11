import { defineConfig } from 'vite'

// 纯静态单页：base 用相对路径，构建产物可直接丢到任意子目录托管
export default defineConfig({
  base: './',
  // 本机 ::1（IPv6 回环）被过滤驱动拦掉，Vite 默认绑 localhost 会只监听 [::1]，
  // 于是 http://127.0.0.1:5173 直接拒绝连接。显式绑 IPv4 回环，两种写法都能打开。
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    // 保活音频保持独立文件，不内联成 base64（与原静态版一致）
    assetsInlineLimit: 0,
    // ECharts 按需引入后主包约 540 kB / gzip 182 kB，属预期体积
    chunkSizeWarningLimit: 600
  }
})
