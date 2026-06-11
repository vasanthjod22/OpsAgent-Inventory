// Consistent colors for all charts
export const CHART_COLORS = [
  '#2563EB', // blue
  '#7C3AED', // purple
  '#16A34A', // green
  '#EA580C', // orange
  '#0891B2', // cyan
  '#DB2777', // pink
  '#CA8A04', // yellow
  '#9333EA', // violet
  '#0D9488', // teal
  '#DC2626', // red
]

// Recharts common props
export const CHART_DEFAULTS = {
  margin: { top: 5, right: 20, 
            left: 10, bottom: 5 },
  style: { fontSize: 12 }
}

// Tooltip style
export const tooltipStyle = {
  contentStyle: {
    background: '#0F172A',
    border: '1px solid #1E293B',
    borderRadius: 8,
    color: 'white',
    fontSize: 12
  },
  labelStyle: {
    color: '#94A3B8',
    marginBottom: 4
  }
}

// Grid style for charts
export const gridStyle = {
  strokeDasharray: '3 3',
  stroke: '#E2E8F0',
  strokeOpacity: 0.5
}

// Axis style
export const axisStyle = {
  tick: { fontSize: 11, fill: '#94A3B8' },
  axisLine: { stroke: '#E2E8F0' }
}
