import { useRef, useEffect, useState, useMemo } from 'react'
import { Mafs, Coordinates, useMovablePoint, Text, usePaneContext } from 'mafs'
import { parse, derivative } from 'mathjs'
import 'mafs/core.css'
import 'mathlive'
import './App.css'

const FACTORIALS = Array.from({ length: 51 }, (_, k) =>
  k === 0 ? 1 : Array.from({ length: k }, (_, i) => i + 1).reduce((a, b) => a * b, 1)
)

function FunctionPlot({ fn, color, weight = 2 }) {
  const { xPaneRange: [xMin, xMax], yPaneRange: [yMin, yMax] } = usePaneContext()
  const d = useMemo(() => {
    const N = Math.max(1000, Math.ceil((xMax - xMin) * 100))
    const dx = (xMax - xMin) / N
    const jumpThreshold = (yMax - yMin) * 0.5
    let path = ''
    let penDown = false
    let prevY = NaN
    for (let i = 0; i <= N; i++) {
      const x = xMin + i * dx
      const y = fn(x)
      if (!isFinite(y) || Math.abs(y - prevY) > jumpThreshold) {
        penDown = false
      }
      if (!isFinite(y)) {
        prevY = NaN
      } else if (!penDown) {
        path += `M ${x} ${y} `
        penDown = true
        prevY = y
      } else {
        path += `L ${x} ${y} `
        prevY = y
      }
    }
    return path
  }, [fn, xMin, xMax, yMin, yMax])
  return (
    <path d={d} strokeWidth={weight} fill="none" strokeLinecap="round" strokeLinejoin="round"
      style={{ stroke: color, vectorEffect: 'non-scaling-stroke', transform: 'var(--mafs-view-transform)' }} />
  )
}

function buildTaylorFn(asciiExpr, n, a = 0) {
  try {
    let expr = parse(asciiExpr)
    const coeffs = []
    for (let k = 0; k <= n; k++) {
      if (k > 0) expr = derivative(expr, 'x')
      const val = expr.evaluate({ x: a })
      coeffs.push(typeof val === 'number' && isFinite(val) ? val / FACTORIALS[k] : 0)
    }
    return (x) => {
      const t = x - a
      let sum = coeffs[n]
      for (let k = n - 1; k >= 0; k--) sum = sum * t + coeffs[k]
      return isFinite(sum) && Math.abs(sum) < 1000 ? sum : NaN
    }
  } catch {
    return null
  }
}

export default function App() {
  const mathRef = useRef(null)
  const plotRef = useRef(null)
  const [asciiExpr, setAsciiExpr] = useState('sin(x)')
  const [n, setN] = useState(3)
  const [plotHeight, setPlotHeight] = useState(500)

  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setPlotHeight(entry.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const mf = mathRef.current
    if (!mf) return
    mf.setValue('\\sin(x)')
    const handler = () => setAsciiExpr(mf.getValue('ascii-math'))
    mf.addEventListener('input', handler)
    return () => mf.removeEventListener('input', handler)
  }, [])

  const { plotFn, hasError } = useMemo(() => {
    try {
      const compiled = parse(asciiExpr).compile()
      return {
        plotFn: (x) => {
          try {
            const r = compiled.evaluate({ x })
            return typeof r === 'number' && isFinite(r) && Math.abs(r) < 1000 ? r : NaN
          } catch { return NaN }
        },
        hasError: false,
      }
    } catch {
      return { plotFn: null, hasError: true }
    }
  }, [asciiExpr])

  const center = useMovablePoint([0, 0], {
    constrain: ([x]) => [x, 0],
    color: '#a3e635',
  })

  const taylorFn = useMemo(
    () => buildTaylorFn(asciiExpr, n, center.x),
    [asciiExpr, n, center.x]
  )

  return (
    <div className="app">
      <div className={`input-section${hasError ? ' error' : ''}`}>
        <div className="input-row">
          <span className="fn-label"><i>f</i>(<i>x</i>) =</span>
          <math-field ref={mathRef} class="math-field" />
        </div>
        <div className="slider-row">
          <span className="fn-label"><i>n</i></span>
          <input
            type="range"
            min={0}
            max={50}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className="slider"
          />
          <span className="n-value">{n}</span>
        </div>
      </div>

      <div className="plot" ref={plotRef}>
        <Mafs height={plotHeight} zoom={{ min: 0.4, max: 100 }} viewBox={{ y: [-3, 3] }}>
          <Coordinates.Cartesian />
          {plotFn && <FunctionPlot fn={plotFn} color="#f97316" />}
          {taylorFn && <FunctionPlot fn={taylorFn} color="#58a6ff" />}
          {center.element}
          <Text x={center.x} y={-0.35} color="#a3e635" size={20}>c</Text>
        </Mafs>
      </div>
    </div>
  )
}
