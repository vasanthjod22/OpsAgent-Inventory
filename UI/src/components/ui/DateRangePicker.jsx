import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useState } from 'react'

const PRESETS = [
  { label: 'Today',      value: 'today' },
  { label: 'Yesterday',  value: 'yesterday' },
  { label: 'Last 7 Days',value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Quarter',value:'quarter' },
  { label: 'This Year',  value: 'year' },
  { label: 'Custom',     value: 'custom' },
]

export const getDateRange = (preset) => {
  const now = new Date()
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  )

  switch(preset) {
    case 'today':
      return {
        from: today.toISOString(),
        to: new Date(
          today.getTime() + 86399999
        ).toISOString()
      }
    case 'yesterday': {
      const y = new Date(today)
      y.setDate(today.getDate() - 1)
      return {
        from: y.toISOString(),
        to: new Date(
          y.getTime() + 86399999
        ).toISOString()
      }
    }
    case 'week': {
      const w = new Date(today)
      w.setDate(today.getDate() - 6)
      return {
        from: w.toISOString(),
        to: new Date(
          today.getTime() + 86399999
        ).toISOString()
      }
    }
    case 'month':
      return {
        from: new Date(
          now.getFullYear(),
          now.getMonth(), 1
        ).toISOString(),
        to: new Date(
          today.getTime() + 86399999
        ).toISOString()
      }
    case 'last_month': {
      const lm = new Date(
        now.getFullYear(),
        now.getMonth() - 1, 1
      )
      const lme = new Date(
        now.getFullYear(),
        now.getMonth(), 0
      )
      return {
        from: lm.toISOString(),
        to: new Date(
          lme.getTime() + 86399999
        ).toISOString()
      }
    }
    case 'quarter': {
      const qStart = new Date(
        now.getFullYear(),
        Math.floor(now.getMonth() / 3) * 3,
        1
      )
      return {
        from: qStart.toISOString(),
        to: new Date(
          today.getTime() + 86399999
        ).toISOString()
      }
    }
    case 'year':
      return {
        from: new Date(
          now.getFullYear(), 0, 1
        ).toISOString(),
        to: new Date(
          today.getTime() + 86399999
        ).toISOString()
      }
    default:
      return {
        from: new Date(
          now.getFullYear(),
          now.getMonth(), 1
        ).toISOString(),
        to: new Date(
          today.getTime() + 86399999
        ).toISOString()
      }
  }
}

const DateRangePicker = ({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomChange
}) => {
  const [showCustom, setShowCustom] = 
    useState(false)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }}>
      {/* Preset buttons */}
      <div style={{
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap'
      }}>
        {PRESETS.map(preset => (
          <button
            key={preset.value}
            onClick={() => {
              onChange(preset.value)
              setShowCustom(
                preset.value === 'custom'
              )
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: value === preset.value
                ? '#2563EB' : '#E2E8F0',
              background: value === preset.value
                ? '#2563EB' : 'white',
              color: value === preset.value
                ? 'white' : '#64748B',
              fontSize: 12,
              fontWeight: value === preset.value
                ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {(value === 'custom' || showCustom) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: '#F8FAFC',
          borderRadius: 8,
          border: '1px solid #E2E8F0'
        }}>
          <span style={{
            fontSize: 12,
            color: '#64748B'
          }}>
            From
          </span>
          <DatePicker
            selected={customFrom}
            onChange={date =>
              onCustomChange('from', date)
            }
            selectsStart
            startDate={customFrom}
            endDate={customTo}
            maxDate={new Date()}
            dateFormat="dd MMM yyyy"
            placeholderText="Start date"
            customInput={
              <input style={{
                width: 110,
                height: 32,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid #E2E8F0',
                fontSize: 12,
                color: '#374151',
                cursor: 'pointer'
              }}/>
            }
          />
          <span style={{
            fontSize: 12,
            color: '#64748B'
          }}>
            To
          </span>
          <DatePicker
            selected={customTo}
            onChange={date =>
              onCustomChange('to', date)
            }
            selectsEnd
            startDate={customFrom}
            endDate={customTo}
            minDate={customFrom}
            maxDate={new Date()}
            dateFormat="dd MMM yyyy"
            placeholderText="End date"
            customInput={
              <input style={{
                width: 110,
                height: 32,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid #E2E8F0',
                fontSize: 12,
                color: '#374151',
                cursor: 'pointer'
              }}/>
            }
          />
        </div>
      )}
    </div>
  )
}

export default DateRangePicker
