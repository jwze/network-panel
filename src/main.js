// 网络面板 — Vite 入口
// 样式仍由 index.html 的 <link rel="stylesheet" href="./res/style.css"> 引入，
// Vite 会把它作为入口依赖打包，保持原有加载顺序与渲染结果。
import { initUI } from './ui.js'
import { startProbes } from './info.js'
import { initChart } from './chart.js'

initUI()
startProbes()
initChart()
