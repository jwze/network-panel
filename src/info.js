// 出口 IP（IPv4 / IPv6 / 归属地及运营商三列）与延迟探测
// 原 main.js 的 ipcn / ipgb / laycn / laygb / ckbl / ckip
import { state } from './core.js'
import { CountryCode_Zh_cn } from './country-codes.js'

// ---- 出口 IP 数据源 ----
// 原 forge.speedtest.cn/api/location/info 已下线（404 且不带 CORS 头）；
// 原 api.ip.sb/geoip 在部分网络下不可达，且原代码带的 Sec-Fetch-* 是浏览器禁止自定义的请求头。
// 每个出口按三列展示：IPv4、IPv6、归属地及运营商。主源给出带归属地的 IP，
// 单栈端点补齐另一协议；任何一列取不到就留空（不显示占位符、不显示失败文案）。
const SOURCE_TIMEOUT = 5000
const FAMILY_TIMEOUT = 3500
let ipSbRetryAfter = 0
let cnBusy = false
let gbBusy = false
let cnResult = null
let gbResult = null
let families = { v4: '', v6: '' }
let familiesBusy = false
let familiesRetryAt = 0

async function readSource(url, timeout = SOURCE_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

// Cloudflare 的 trace 端点带 Access-Control-Allow-Origin: *，返回 ip / loc / colo 等键值对。
// 两个等价域名并行竞速，单个域名被代理抽风时不影响结果。
async function cloudflareTrace() {
  const kv = {}
  const text = await firstSuccess([
    () => readSource('https://www.cloudflare.com/cdn-cgi/trace'),
    () => readSource('https://speed.cloudflare.com/cdn-cgi/trace')
  ])
  text.trim().split(/\r?\n/).forEach(line => {
    const i = line.indexOf('=')
    if (i > 0) kv[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  })
  if (!kv.ip) throw new Error('invalid trace response')
  return kv
}

const regionOf = kv => CountryCode_Zh_cn[kv.loc] || kv.loc || ''

// 等价源并行竞速，取最先成功的一个；全部失败才 reject
function firstSuccess(tasks) {
  return new Promise((resolve, reject) => {
    let failed = 0
    tasks.forEach(task => task().then(resolve, () => {
      if (++failed === tasks.length) reject(new Error('all ip sources failed'))
    }))
  })
}

// 按优先级串行回退：前一个源失败才尝试下一个，保证「国内出口」优先使用国内数据源
async function withFallback(tasks) {
  let lastError
  for (const task of tasks) {
    try { return await task() } catch (err) { lastError = err }
  }
  throw lastError || new Error('no ip source available')
}

// 主源统一返回 { ip, region }：ip 只含地址，region 只含归属地 + 运营商
function loadCn() {
  return withFallback([
    // 国内源：ipip.net，返回中文省/市/运营商
    async () => {
      const d = JSON.parse(await readSource('https://myip.ipip.net/json', 1500))
      if (!d || !d.data || !d.data.ip) throw new Error('invalid ipip payload')
      const l = d.data.location || []
      return {
        ip: d.data.ip,
        region: [l[1], l[2], l[3], l[4]].filter(Boolean).join(' ')
      }
    },
    async () => {
      const kv = await cloudflareTrace()
      return { ip: kv.ip, region: regionOf(kv) }
    }
  ])
}

function loadGb() {
  return withFallback([
    async () => {
      const kv = await cloudflareTrace()
      return {
        ip: kv.ip,
        region: [regionOf(kv), 'Cloudflare'].filter(Boolean).join(' ')
      }
    },
    // 原接口保留为备用：去掉 forbidden headers；失败后 60s 内不再重试，避免每 5s 制造无效请求
    async () => {
      if (Date.now() < ipSbRetryAfter) throw new Error('cooling down')
      try {
        const d = JSON.parse(await readSource('https://api.ip.sb/geoip'))
        if (!d || !d.ip) throw new Error('invalid ip.sb payload')
        return {
          ip: d.ip,
          region: [CountryCode_Zh_cn[d.country_code] || d.country_code || '', d.isp || '']
            .filter(Boolean).join(' ')
        }
      } catch (err) {
        ipSbRetryAfter = Date.now() + 60000
        throw err
      }
    }
  ])
}

// ---- 单栈探测：只解析 A / AAAA 的端点，天然区分本机是否有该协议出口 ----
// 并行竞速（哪个先回来用哪个，多源不增加延迟），都带 Access-Control-Allow-Origin: *。
// 每族放多个不同服务商 / 不同网络的端点：任何一个域名被墙、被代理规则拦掉、
// 或出口节点单栈，都不会让整列空白——这正是「只有 IPv6 没有 IPv4」的主因。
// ipw.cn 是国内 IPv4 / IPv6 专用端点，国内网络下几十毫秒就能回，不依赖代理。
const V4_SOURCES = [
  'https://api4.ipify.org',
  'https://v4.ident.me/.json',
  'https://ipv4.icanhazip.com',
  'https://api-ipv4.ip.sb/ip',
  'https://ipv4.myip.wtf/text',
  'https://4.ipw.cn/'
]
const V6_SOURCES = [
  'https://api6.ipify.org',
  'https://v6.ident.me/.json',
  'https://ipv6.icanhazip.com',
  'https://api-ipv6.ip.sb/ip',
  'https://ipv6.myip.wtf/text',
  'https://6.ipw.cn/'
]

const isV6 = ip => !!ip && ip.includes(':')

// wantV6 强制校验协议族：端点偶尔会返回「另一族」的地址（NAT64 / 代理串味），
// 不校验就会把 IPv6 写进 IPv4 列，或反之。
function probeFamily(urls, wantV6) {
  return firstSuccess(urls.map(url => async () => {
    const text = (await readSource(url, FAMILY_TIMEOUT)).trim()
    let ip = ''
    try {
      const d = JSON.parse(text)
      ip = d.address || d.ip || ''
    } catch {
      ip = text.split(/\s+/)[0] || ''
    }
    ip = String(ip).trim()
    if (!/^[\da-fA-F:.]+$/.test(ip) || ip.length < 7) throw new Error('invalid ip payload')
    if (isV6(ip) !== wantV6) throw new Error('unexpected address family')
    return ip
  }))
}

// 写入三列：主源的 IP 覆盖对应协议列，另一协议用单栈结果补齐，归属地单独成列
// 空单元格挂 title：鼠标悬停能看出是「真的没有该协议」还是「探测端点全挂」，不占版面。
function renderEgress(row, main, fam) {
  if (!row) return
  const v4 = main && !isV6(main.ip) ? main.ip : (fam.v4 || '')
  const v6 = main && isV6(main.ip) ? main.ip : (fam.v6 || '')
  const region = main ? (main.region || '') : ''
  const set = (suffix, value, hint) => {
    const el = document.getElementById(row.id + suffix)
    if (!el) return
    el.textContent = value || ''
    el.title = value || hint || ''
  }
  set('4', v4, familiesHint.v4)
  set('6', v6, familiesHint.v6)
  set('Region', region, '')
}

// 双栈探测失败时给空单元格用的说明（不显示在版面上，只做悬停提示）
const familiesHint = {
  v4: `未探测到 IPv4 出口：${V4_SOURCES.length} 个 IPv4 专用端点全部不可达，通常是对代理只放行 IPv6、或本地 IPv4 出口异常`,
  v6: `未探测到 IPv6 出口：${V6_SOURCES.length} 个 IPv6 专用端点全部不可达，通常是本机或代理出口没有 IPv6`
}

// 双栈探测结果两行共用，成功后 30s 内不重复请求；有任一族失败则 5s 后重试
async function refreshFamilies() {
  if (familiesBusy || Date.now() < familiesRetryAt) return
  familiesBusy = true
  try {
    const [v4, v6] = await Promise.all([
      probeFamily(V4_SOURCES, false).catch(() => ''),
      probeFamily(V6_SOURCES, true).catch(() => '')
    ])
    // 单侧失败时保留上一次成功值：偶发超时不该把已经拿到的 IP 抹成空白
    families = { v4: v4 || families.v4, v6: v6 || families.v6 }
    familiesRetryAt = Date.now() + (v4 && v6 ? 30000 : 5000)
    renderEgress(document.getElementById('ipcn'), cnResult, families)
    renderEgress(document.getElementById('ipgb'), gbResult, families)
  } finally {
    familiesBusy = false
  }
}

export function ckip(ip, tag) {
  if (!state.checkIP) return
  readSource('https://down.ljxnet.cn/?headers=%7B%22referer%22%3A%22https%3A%2F%2Fipinfo.io%2F%22%2C%22origin%22%3A%22https%3A%2F%2Fipinfo.io%2F%22%7D&url=https%3A%2F%2Fipinfo.io%2Fwidget%2Fdemo%2F' + ip)
    .then(text => JSON.parse(text))
    .then(data => {
      const company = data && data.data && data.data.company
      if (company && company.type === 'isp') tag.style.color = '#15803d'
    })
    .catch(() => { /* 第三方归属检测不可用，忽略 */ })
}

export function ipcn() {
  if (state.visibl && !cnBusy) {
    cnBusy = true
    loadCn()
      .then(data => {
        cnResult = data
        const row = document.getElementById('ipcn')
        renderEgress(row, data, families)
        if (data.ip !== state.cnip) {
          const cell = document.getElementById('ipcn' + (isV6(data.ip) ? '6' : '4'))
          if (cell) cell.style.color = ''
          ckip(data.ip, cell || row)
        }
        state.cnip = data.ip
      })
      // 偶发失败保留上一次成功值；从未成功过则只显示单栈探测结果，取不到就留空
      .catch(() => { renderEgress(document.getElementById('ipcn'), cnResult, families) })
      .finally(() => { cnBusy = false })
  }
  setTimeout(ipcn, 5000)
}

export function ipgb() {
  if (state.visibl && !gbBusy) {
    gbBusy = true
    loadGb()
      .then(data => {
        gbResult = data
        const row = document.getElementById('ipgb')
        renderEgress(row, data, families)
        if (data.ip !== state.gbip) {
          const cell = document.getElementById('ipgb' + (isV6(data.ip) ? '6' : '4'))
          if (cell) cell.style.color = ''
          ckip(data.ip, cell || row)
        }
        state.gbip = data.ip
      })
      .catch(() => { renderEgress(document.getElementById('ipgb'), gbResult, families) })
      .finally(() => { gbBusy = false })
  }
  setTimeout(ipgb, state.refreshLay)
}

export function laycn() {
  if (state.visibl) {
    const startTi = Date.now()
    fetch('https://connectivitycheck.platform.hicloud.com/generate_204', {
      method: 'HEAD', cache: 'no-store', mode: 'no-cors', referrerPolicy: 'no-referrer'
    })
      .then(() => {
        const lay = Date.now() - startTi
        state.nowLocalPing = lay
        document.getElementById('laycn').innerText = lay + 'ms'
      })
      .catch(() => { document.getElementById('laycn').innerText = '-ms' })
  }
  setTimeout(laycn, 1000)
}

export function laygb() {
  if (state.visibl) {
    const startTi = Date.now()
    fetch('\thttps://cp.cloudflare.com/', {
      method: 'HEAD', cache: 'no-store', mode: 'no-cors', referrerPolicy: 'no-referrer'
    })
      .then(() => {
        const lay = Date.now() - startTi
        state.nowGlobalPing = lay
        document.getElementById('laygb').innerText = lay + 'ms'
      })
      .catch(() => { document.getElementById('laygb').innerText = '-ms' })
  }
  setTimeout(laygb, 1000)
}

export function ckbl() {
  if (state.visibl) {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 2000)
    fetch('https://www.google.com/', {
      signal: controller.signal, method: 'HEAD', cache: 'no-store',
      mode: 'no-cors', referrerPolicy: 'no-referrer'
    })
      .then(() => { document.getElementById('laygb').style.color = '#15803d' })
      .catch(() => { document.getElementById('laygb').style.color = '#b91c1c' })
  }
  setTimeout(ckbl, 1000)
}

export function startProbes() {
  ipcn()
  ipgb()
  laycn()
  laygb()
  ckbl()
  refreshFamilies()
  setInterval(() => { if (state.visibl) refreshFamilies() }, 30000)
}
