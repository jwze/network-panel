// DOM 事件与初始化：原 index.html 的内联脚本 / onchange / onclick / oninput 等
// 全部改为 addEventListener，去掉对 window 全局函数的依赖
import { state, getCookie, setCookie, setMax } from './core.js'
import { bottonClicked } from './speedtest.js'

function musiccontrol() {
  if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
    if (document.getElementById('customSwitch2').checked) document.getElementById('music').play()
    else document.getElementById('music').pause()
  }
}

export function initUI() {
  const select = document.getElementById('select')
  const link = document.getElementById('link')
  const diy = document.getElementById('diy')
  const thread = document.getElementById('thread')
  const doBtn = document.getElementById('do')
  const sw = document.getElementById('customSwitch2')
  const music = document.getElementById('music')

  // 禁用双击放大（防止按加减按钮误触）
  let lastTouchEnd = 0
  if ('ontouchstart' in window || navigator.maxTouchPoints) {
    document.documentElement.addEventListener('touchend', event => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) event.preventDefault()
      lastTouchEnd = now
    }, { passive: false })
  }

  music.addEventListener('pause', () => {
    document.title = '网络面板'
    if (state.run && !state.visibl) bottonClicked()
    sw.checked = false
  })
  music.addEventListener('play', () => {
    if (!(state.run || state.visibl)) bottonClicked()
    sw.checked = true
  })

  // Cookie 恢复：自定义地址、上次选中项、流量上限
  diy.value = getCookie('diy')
  if (getCookie('select')) select.selectedIndex = getCookie('select')
  link.value = select.options[select.selectedIndex].value
  setMax(getCookie('Max'))

  select.addEventListener('change', () => {
    link.value = select.options[select.selectedIndex].value
    setCookie('select', select.selectedIndex, 365)
  })

  link.addEventListener('input', () => {
    select.selectedIndex = 0
    diy.value = link.value
    setCookie('diy', link.value, 365)
    setCookie('select', 0, 365)
  })

  const dec = document.querySelector('.np-step[aria-label="减少线程"]')
  const inc = document.querySelector('.np-step[aria-label="增加线程"]')
  dec.addEventListener('click', () => {
    if (thread.value != thread.min) thread.value--
  })
  inc.addEventListener('click', () => {
    if (thread.value != thread.max) thread.value++
  })
  thread.addEventListener('change', () => {
    if (thread.value < thread.min) thread.value = thread.min
    if (thread.value > thread.max) thread.value = thread.max
  })

  sw.addEventListener('click', musiccontrol)
  doBtn.addEventListener('click', bottonClicked)

  document.querySelector('.np-readout-clickable').addEventListener('click', () => {
    const inputMax = prompt('请输入流量上限(GB)\n不填为不设置上限', '')
    if (inputMax !== null) setMax(inputMax)
  })

  document.onkeydown = function (e) {
    const ev = e || window.event
    if (!ev) return
    if (ev.keyCode === 123) {
      alert('F12被禁用')
      ev.returnValue = false
    }
    if (ev.keyCode === 13) {
      // 原脚本尝试改写只读 keyCode（浏览器忽略），保持不产生额外行为
    }
    if (ev.keyCode === 8) {
      alert('请使用Del键进行字符的删除操作！')
      ev.returnValue = false
    }
  }

  document.addEventListener('visibilitychange', () => {
    const string = document.visibilityState
    if (string === 'hidden') {
      state.visibl = false
      if (state.run && !sw.checked) bottonClicked()
    }
    if (string === 'visible') {
      state.visibl = true
      document.title = '网络面板'
    }
  })
}
