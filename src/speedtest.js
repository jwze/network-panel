// 多线程下载测速：原 main.js 的 start_thread / cale / total / start / stop / botton_clicked
import {
  state, show, sum, checkURL,
  BYTE_UNITS, RATE_UNITS, BPS_UNITS, FLO_2, FLO_0
} from './core.js'

export async function startThread(index) {
  try {
    const response = await fetch(state.testurl, {
      cache: 'no-store',
      mode: 'cors',
      referrerPolicy: 'no-referrer'
    })
    const reader = response.body.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        reader.cancel()
        startThread(index)
        break
      }
      if (!state.run) {
        reader.cancel()
        break
      }
      state.threadDown[index] += value.length
    }
  } catch (err) {
    console.log(err)
    if (state.run) startThread(index)
  }
}

export async function cale() {
  const allDownA = sum(state.threadDown)
  const elapsed = Date.now() - state.lsatDate
  state.nowSpeed = (allDownA - state.lsatAllDown) / elapsed * 1000 / 1024 / 1024

  if (state.visibl) {
    document.getElementById('speed').innerText =
      show((allDownA - state.lsatAllDown) / elapsed * 1000, RATE_UNITS, FLO_2)
    document.getElementById('mbps').innerText =
      show((allDownA - state.lsatAllDown) / elapsed * 8000, BPS_UNITS, FLO_0)
  }
  if (!state.visibl) {
    document.title =
      show(state.allDownSum + allDownA, BYTE_UNITS, FLO_0) + ' ' +
      show((allDownA - state.lsatAllDown) / elapsed * 1000, RATE_UNITS, FLO_0)
  }

  state.lsatAllDown = allDownA
  state.lsatDate = Date.now()

  if (state.run) {
    setTimeout(cale, 1000)
  } else {
    const avgSpeed = 1000 * allDownA / (Date.now() - state.startTime)
    document.title = '网络面板'
    state.nowSpeed = 0
    document.getElementById('speed').innerText = show(avgSpeed, RATE_UNITS, FLO_2)
    document.getElementById('mbps').innerText = show(avgSpeed * 8, BPS_UNITS, FLO_0)
    state.lsatAllDown = 0
    document.getElementById('describe').innerText = '平均速度'
  }
}

export async function total() {
  const allDown = sum(state.threadDown)
  if (state.visibl) {
    document.getElementById('total').innerText =
      show(state.allDownSum + allDown, BYTE_UNITS, FLO_2)
  }
  if (state.allDownSum + allDown >= state.Maximum && state.Maximum !== 0) stop()
  if (state.run) {
    setTimeout(total, 16)
  } else {
    state.allDownSum += allDown
    document.getElementById('total').innerText = show(state.allDownSum, BYTE_UNITS, FLO_2)
  }
}

export async function start() {
  if (state.allDownSum >= state.Maximum && state.Maximum !== 0) {
    state.allDownSum = 0
  }
  state.maxtheard = document.getElementById('thread').value
  state.testurl = document.getElementById('link').value

  if (state.testurl.length < 10) {
    alert('链接不合法')
    return
  }
  state.testurl = state.testurl.substring(0, 5).toLowerCase() + state.testurl.substring(5)
  if (!checkURL(state.testurl)) {
    alert('链接不合法')
    return
  }
  if (state.testurl.startsWith('http://')) {
    alert('由于浏览器安全限制，不支持http协议，请使用https协议')
    return
  }
  if (!state.testurl.startsWith('https://')) {
    alert('链接不合法')
    return
  }

  document.getElementById('do').innerText = '正在检验链接...'
  document.getElementById('do').disabled = true

  try {
    const response = await fetch(state.testurl, {
      cache: 'no-store',
      mode: 'cors',
      referrerPolicy: 'no-referrer'
    })
    const reader = response.body.getReader()
    const { value } = await reader.read()
    if (value.length <= 0) throw '资源响应异常'
    reader.cancel()
  } catch (err) {
    console.warn(err)
    document.getElementById('do').innerText = '开始'
    document.getElementById('do').disabled = false
    alert('该链接不可用，如果你能够正常访问该链接，那么很有可能是浏览器的跨域限制')
    return
  }

  document.getElementById('describe').innerText = '实时速度'
  document.getElementById('do').innerText = '停止'
  document.getElementById('do').disabled = false
  document.body.classList.add('is-running')

  let num = state.maxtheard
  state.lsatAllDown = 0
  state.startTime = Date.now()
  state.run = true
  state.threadDown = []
  while (num--) {
    state.threadDown[num] = 0
    startThread(num)
  }
  cale()
  total()
}

export function stop() {
  state.run = false
  document.body.classList.remove('is-running')
  document.getElementById('do').innerText = '开始'
}

export function bottonClicked() {
  if (state.run) stop()
  else start()
}
