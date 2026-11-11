// ECharts 速率/延迟图表：原 main.js 尾部图表代码 + index.html 尾部 resize 内联脚本
// 用 echarts/core 按需注册，替代原先 CDN 全量脚本
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent, TooltipComponent, ToolboxComponent, LegendComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { state } from './core.js'

echarts.use([
  LineChart, GridComponent, TooltipComponent, ToolboxComponent, LegendComponent,
  CanvasRenderer
])

export function initChart() {
  const chartDom = document.getElementById('dv')
  const myChart = echarts.init(chartDom)

  const chartMono = 'IBM Plex Mono, SFMono-Regular, Consolas, monospace'
  const chartInk = '#1a1e24'
  const chartInk2 = '#525b66'
  const chartInk3 = '#7d8691'
  const chartLine = 'rgba(26, 30, 36, 0.08)'
  const chartAccent = '#c1440e'
  const chartQuiet = '#b0b7be'

  const option = {
    backgroundColor: 'transparent',
    animationDuration: 300,
    textStyle: { fontFamily: chartMono, color: chartInk2 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: 'rgba(26, 30, 36, 0.16)',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: chartInk, fontSize: 12, fontFamily: chartMono },
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(26, 30, 36, 0.28)', width: 1, type: 'dashed' } }
    },
    legend: { show: false, data: ['速率', '延迟'] },
    toolbox: {
      right: 4,
      top: 0,
      itemSize: 14,
      iconStyle: { borderColor: chartInk3 },
      emphasis: { iconStyle: { borderColor: chartAccent } },
      feature: { saveAsImage: { title: '保存图片', pixelRatio: 2 } }
    },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: [{
      type: 'category',
      boundaryGap: false,
      axisLine: { lineStyle: { color: chartLine } },
      axisTick: { show: false },
      axisLabel: { color: chartInk3, fontSize: 11, fontFamily: chartMono },
      splitLine: { show: false }
    }],
    yAxis: [{
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: chartInk3, fontSize: 11, fontFamily: chartMono },
      splitLine: { show: true, lineStyle: { color: chartLine, width: 1 } }
    }, {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: chartInk3, fontSize: 11, fontFamily: chartMono },
      splitLine: { show: false }
    }],
    series: [{
      name: '速率',
      type: 'line',
      yAxisIndex: 1,
      showSymbol: false,
      smooth: 0.25,
      lineStyle: { color: chartAccent, width: 2.5 },
      itemStyle: { color: chartAccent },
      areaStyle: { color: 'rgba(193, 68, 14, 0.10)' },
      emphasis: { focus: 'series' },
      data: [{ name: new Date(), value: state.nowGlobalPing }]
    }, {
      name: '延迟',
      type: 'line',
      showSymbol: false,
      smooth: 0.25,
      lineStyle: { color: chartQuiet, width: 1.5 },
      itemStyle: { color: chartQuiet },
      data: [{ name: new Date(), value: state.nowGlobalPing }]
    }]
  }

  myChart.setOption(option)

  // 图表高度由分区撑开；窄屏收紧轴标签并收起导出按钮
  const apply = () => {
    const narrow = chartDom.clientWidth < 420
    myChart.setOption({
      toolbox: { show: !narrow },
      grid: narrow
        ? { left: 4, right: 4, top: 12, bottom: 4, containLabel: true }
        : { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
      xAxis: [{ axisLabel: { fontSize: narrow ? 10 : 11 } }],
      yAxis: [
        { axisLabel: { fontSize: narrow ? 10 : 11 } },
        { axisLabel: { fontSize: narrow ? 10 : 11 } }
      ]
    })
    myChart.resize()
  }
  if (window.ResizeObserver) new ResizeObserver(apply).observe(chartDom)
  window.addEventListener('resize', apply)
  apply()

  function dv() {
    if (state.visibl) {
      const now = new Date()
      option.series[0].data.push({
        name: now.toString(),
        value: [now.getTime(), state.nowSpeed.toFixed(1)]
      })
      option.series[1].data.push({
        name: now.toString(),
        value: [now.getTime(), state.nowLocalPing]
      })
      myChart.setOption({ series: option.series })
    }
    setTimeout(dv, 1000)
  }

  dv()
}
