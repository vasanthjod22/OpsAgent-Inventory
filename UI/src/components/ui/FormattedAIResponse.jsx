const FormattedAIResponse = ({ text }) => {
  if (!text) return null

  const lines = text.split('\n')

  return (
    <div style={{ 
      fontSize: 13, 
      lineHeight: 1.7,
      color: '#374151'
    }}>
      {lines.map((line, i) => {
        if (!line.trim()) return (
          <br key={i} />
        )

        // Bold text
        const formatted = line
          .replace(/\*\*(.*?)\*\*/g, 
            '<strong>$1</strong>'
          )
          .replace(/\*(.*?)\*/g, 
            '<em>$1</em>'
          )

        // Bullet points
        if (line.trim().startsWith('- ') || 
            line.trim().startsWith('• ')) {
          return (
            <div key={i} style={{
              display: 'flex',
              gap: 8,
              marginBottom: 4,
              paddingLeft: 8
            }}>
              <span style={{ 
                color: '#2563EB',
                flexShrink: 0,
                marginTop: 2
              }}>
                •
              </span>
              <span
                dangerouslySetInnerHTML={{
                  __html: formatted.replace(
                    /^[-•]\s/, ''
                  )
                }}
              />
            </div>
          )
        }

        // Section headers (1. 2. etc)
        if (/^\d+\.\s/.test(line.trim())) {
          return (
            <div key={i} style={{
              fontWeight: 600,
              color: '#1E40AF',
              marginTop: 12,
              marginBottom: 4,
              fontSize: 14
            }}
            dangerouslySetInnerHTML={{
              __html: formatted
            }}
            />
          )
        }

        // Regular line
        return (
          <div key={i} 
            style={{ marginBottom: 4 }}
            dangerouslySetInnerHTML={{
              __html: formatted
            }}
          />
        )
      })}
    </div>
  )
}

export default FormattedAIResponse
