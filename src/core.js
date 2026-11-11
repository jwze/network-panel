// 共享状态与纯工具函数（原 index.html 内联脚本 + main.js 中的全局变量）
// 状态收敛到一个对象，避免 ES Module 作用域下再往 window 上挂全局函数

export const state = {
  maxtheard: undefined,
  testurl: '',
  lsatDate: 0,
  allDownSum: 0,
  run: false,
  checkIP: true,
  visibl: true,
  threadDown: [],
  lsatAllDown: 0,
  refreshLay: 5000,
  nowSpeed: 0,
  nowLocalPing: 0,
  nowGlobalPing: 0,
  Maximum: 0,
  startTime: 0,
  cnip: '',
  gbip: ''
}

export const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
export const RATE_UNITS = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s', 'PB/s']
export const BPS_UNITS = ['Bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps', 'Pbps']
export const FLO_2 = [0, 0, 1, 2, 2, 2]
export const FLO_0 = [0, 0, 0, 2, 2, 2]

export function show(num, des, flo) {
  let cnum = num
  let totalIndex = 0
  while (cnum >= 1024) {
    if (totalIndex === des.length - 1) break
    cnum = cnum / 1024
    totalIndex++
  }
  return cnum.toFixed(flo[totalIndex]) + des[totalIndex]
}

export function setCookie(cname, cvalue, exdays) {
  const d = new Date()
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000)
  const expires = 'expires=' + d.toGMTString()
  document.cookie = cname + '=' + cvalue + '; ' + expires
}

export function getCookie(cname) {
  const name = cname + '='
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    const c = ca[i].trim()
    if (c.indexOf(name) === 0) return c.substring(name.length, c.length)
  }
  return ''
}

export function setMax(inputMax) {
  if (inputMax > 0) {
    setCookie('Max', inputMax, 365)
    state.Maximum = inputMax * 1073741824
    document.getElementById('showMax').innerText =
      '/' + show(state.Maximum, BYTE_UNITS, FLO_2)
  } else {
    state.Maximum = 0
    document.getElementById('showMax').innerText = ''
    setCookie('Max', 0, 365)
  }
}

export function sum(arr) {
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i]
  return s
}

export function checkURL(URL) {
  const Expression = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/
  return new RegExp(Expression).test(URL)
}
