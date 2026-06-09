import React, { useState, useEffect } from 'react';
import { Receipt, Check, Package } from 'lucide-react';

const StockItem = ({ name, oldQty, newQty, min, unit }) => {
  const [displayQty, setDisplayQty] = useState(oldQty)
  
  useEffect(() => {
    // Count down animation
    const diff = oldQty - newQty
    const steps = diff
    let current = 0
    // Make sure we have at least 1 step
    if (steps <= 0) return setDisplayQty(newQty)
    
    const interval = setInterval(() => {
      current++
      setDisplayQty(oldQty - current)
      if (current >= steps) clearInterval(interval)
    }, Math.max(30, 800 / steps)) // adjust speed based on amount
    return () => clearInterval(interval)
  }, [oldQty, newQty])

  const max = Math.max(oldQty, min * 2, 100)
  const percentage = Math.max(0, Math.min(100, (displayQty / max) * 100))
  const isLow = displayQty <= min

  return (
    <div style={{
      padding: '12px 16px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 12,
      marginBottom: 8,
      border: isLow ? '1px solid rgba(220,38,38,0.3)' : '1px solid rgba(255,255,255,0.05)',
      animation: 'slideInRight 0.4s ease'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 8
      }}>
        <span style={{
          fontSize: 13, 
          color: 'white',
          fontWeight: 500
        }}>
          📦 {name}
        </span>
        <span style={{
          fontSize: 12,
          color: isLow ? '#EF4444' : '#94A3B8'
        }}>
          {parseFloat(Number(oldQty).toFixed(6))} → {parseFloat(Number(displayQty).toFixed(6))} {unit}
          {isLow && ' ⚠️'}
        </span>
      </div>
      
      {/* Animated stock bar */}
      <div style={{
        height: 3,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 999
      }}>
        <div style={{
          height: '100%',
          width: `${percentage}%`,
          background: isLow ? '#EF4444' : '#16A34A',
          borderRadius: 999,
          transition: 'width 0.1s ease, background 0.3s ease'
        }}/>
      </div>
    </div>
  )
}

export const BillProcessingModal = ({ 
  isOpen, 
  onComplete,
  billNumber,
  customerName,
  itemCount,
  grandTotal,
  updatedItems = [] // { name, oldQty, newQty, min, unit }
}) => {
  const [phase, setPhase] = useState('processing')
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    { id: 1, label: 'Validating bill items', duration: 400 },
    { id: 2, label: 'Generating invoice PDF', duration: 500 },
    { id: 3, label: 'Saving to database', duration: 400 },
    { id: 4, label: 'Deducting from inventory', duration: updatedItems.length ? 1500 : 400 },
    { id: 5, label: 'Updating stock levels', duration: updatedItems.length ? 500 : 300 },
  ]

  useEffect(() => {
    if (!isOpen) {
      setPhase('processing');
      setProgress(0);
      setCurrentStep(0);
      return;
    }

    let isMounted = true;
    let stepIndex = 0;
    
    const runSteps = async () => {
      let totalTime = steps.reduce((a, b) => a + b.duration, 0);
      let elapsed = 0;
      
      // Progress updater
      const progInterval = setInterval(() => {
        if (!isMounted) return;
        elapsed += 50;
        const targetProg = Math.min(99, (elapsed / totalTime) * 100);
        setProgress(targetProg);
      }, 50);

      // Run each step sequentially
      for (let i = 0; i < steps.length; i++) {
        if (!isMounted) break;
        setCurrentStep(i);
        
        if (i === 3 && updatedItems.length > 0) {
          setPhase('updating');
        }
        
        await new Promise(r => setTimeout(r, steps[i].duration));
      }
      
      if (!isMounted) return;
      clearInterval(progInterval);
      setProgress(100);
      setCurrentStep(steps.length);
      setPhase('success');

      // Auto dismiss after success completes its animations
      setTimeout(() => {
        if (isMounted) onComplete();
      }, 3500);
    };

    runSteps();

    return () => {
      isMounted = false;
    };
  }, [isOpen, updatedItems.length, onComplete]);

  if (!isOpen) return null;

  const lowStockItems = updatedItems.filter(item => item.newQty <= item.min);
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    angle: (i / 20) * 360,
    distance: 80 + Math.random() * 60,
    size: 4 + Math.random() * 6,
    color: ['#16A34A', '#2563EB', '#7C3AED', '#F59E0B'][Math.floor(Math.random() * 4)],
    duration: 0.6 + Math.random() * 0.4
  }));

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: phase === 'success' ? 'rgba(0, 20, 0, 0.9)' : 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.5s ease'
    }}>
      <div style={{
        background: '#0F172A',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: 48,
        width: 480,
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        
        {(phase === 'processing' || phase === 'updating') && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{
              width: 80, height: 80,
              position: 'relative',
              margin: '0 auto 24px'
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                borderRadius: '50%',
                border: '3px solid transparent',
                borderTopColor: '#2563EB', borderRightColor: '#2563EB',
                animation: 'spin 1s linear infinite'
              }}/>
              <div style={{
                position: 'absolute', inset: 8,
                borderRadius: '50%',
                border: '2px solid transparent',
                borderTopColor: '#7C3AED', borderLeftColor: '#7C3AED',
                animation: 'spin 1.5s linear infinite reverse'
              }}/>
              <div style={{
                position: 'absolute', inset: 20,
                background: 'rgba(37,99,235,0.2)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {phase === 'updating' ? <Package size={20} color="#2563EB" /> : <Receipt size={20} color="#2563EB" />}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                {phase === 'updating' ? 'Updating Inventory' : 'Processing Bill'}
              </div>
              <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 32 }}>
                {phase === 'updating' ? 'Deducting stock from inventory database' : 'Please wait while we process your transaction'}
              </div>
            </div>

            {phase === 'updating' && updatedItems.length > 0 ? (
              <div style={{ marginBottom: 24 }}>
                {updatedItems.map(item => (
                  <StockItem key={item.id} {...item} />
                ))}
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                {steps.map((step, index) => (
                  <div key={step.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    {index < currentStep ? (
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: '#16A34A',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'scaleIn 0.3s ease'
                      }}>
                        <Check size={14} color="white" />
                      </div>
                    ) : index === currentStep ? (
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(37,99,235,0.2)', border: '2px solid #2563EB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'pulse 1s ease infinite'
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', animation: 'ping 1s ease infinite' }}/>
                      </div>
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)' }}/>
                    )}
                    <span style={{
                      fontSize: 14,
                      color: index <= currentStep ? 'white' : '#475569',
                      fontWeight: index === currentStep ? 600 : 400,
                      transition: 'color 0.3s ease'
                    }}>
                      {step.label}
                    </span>
                    {index < currentStep && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#16A34A' }}>Done ✓</span>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 24, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 999 }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                background: 'linear-gradient(90deg, #2563EB, #7C3AED)',
                borderRadius: 999, transition: 'width 0.4s ease',
                boxShadow: '0 0 12px rgba(37,99,235,0.6)'
              }}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#64748B' }}>
              <span>Processing...</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        )}

        {phase === 'success' && (
          <div style={{ textAlign: 'center', animation: 'fadeInUp 0.5s ease' }}>
            <div style={{ position: 'relative', height: 100, display: 'flex', justifyContent: 'center' }}>
              {particles.map(p => (
                <div key={p.id} style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: p.size, height: p.size, borderRadius: '50%', background: p.color,
                  '--tx': `${Math.cos(p.angle * Math.PI/180) * p.distance}px`,
                  '--ty': `${Math.sin(p.angle * Math.PI/180) * p.distance}px`,
                  animation: `particle ${p.duration}s ease forwards`
                }}/>
              ))}
              <svg viewBox="0 0 100 100" style={{ width: 100, height: 100, zIndex: 10 }}>
                <circle cx="50" cy="50" r="46" fill="none" stroke="#16A34A" strokeWidth="3" strokeDasharray="289" strokeDashoffset="289" style={{ animation: 'drawCircle 0.6s ease forwards' }} />
                <circle cx="50" cy="50" r="43" fill="rgba(22,163,74,0.1)" style={{ animation: 'fadeIn 0.4s ease 0.4s forwards', opacity: 0 }} />
                <path d="M30 52 L43 65 L70 35" fill="none" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="60" style={{ animation: 'drawCheck 0.4s ease 0.5s forwards' }} />
              </svg>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '20px 0 8px', animation: 'fadeInUp 0.4s ease 0.8s both' }}>
              Bill Generated Successfully!
            </h2>
            <p style={{ fontSize: 14, color: '#94A3B8', marginBottom: 24, animation: 'fadeInUp 0.4s ease 1s both' }}>
              Invoice created and inventory updated
            </p>

            <div style={{
              background: 'rgba(22,163,74,0.08)',
              border: '1px solid rgba(22,163,74,0.2)',
              borderLeft: '4px solid #16A34A',
              borderRadius: 12, padding: '16px 20px',
              textAlign: 'left', marginBottom: 16,
              animation: 'fadeInUp 0.4s ease 1.2s both'
            }}>
              {[
                ['Bill Number', billNumber || '...'],
                ['Customer', customerName || '...'],
                ['Items', `${itemCount || 0} items`],
                ['Total Amount', `₹${Number(grandTotal||0).toLocaleString('en-IN')}`],
                ['Inventory', 'Updated ✓'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                  <span style={{ color: '#64748B' }}>{label}</span>
                  <span style={{ color: 'white', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>

            {lowStockItems.length > 0 && (
              <div style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                animation: 'fadeInUp 0.4s ease 1.4s both', textAlign: 'left'
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B', marginBottom: 8 }}>
                  ⚠️ Low Stock Alert
                </div>
                {lowStockItems.map(item => (
                  <div key={item.id} style={{ fontSize: 12, color: '#94A3B8', padding: '2px 0' }}>
                    • {item.name}: only {item.newQty} {item.unit} remaining
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>Closing automatically...</div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#16A34A', borderRadius: 999, animation: 'depleteBar 2s linear 1.5s forwards' }}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
