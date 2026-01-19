import React from 'react'

export function ShimmerBlock({ className = '', style }) {
  return <div className={`cv-shimmer ${className}`.trim()} style={style} aria-hidden="true" />
}

export function ShimmerCard({ titleWidth = '55%', rows = 6, className = '' }) {
  return (
    <div className={`cv-shimmerCard ${className}`.trim()} aria-hidden="true">
      <div className="cv-shimmerStack">
        <ShimmerBlock className="cv-shimmerH1" style={{ width: titleWidth }} />
        {Array.from({ length: rows }).map((_, idx) => (
          <ShimmerBlock
            key={idx}
            className="cv-shimmerText"
            style={{ width: `${Math.max(35, 92 - idx * 7)}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function ShimmerTableCard({ rows = 8 }) {
  return (
    <div className="cv-shimmerCard" aria-hidden="true">
      <div className="cv-shimmerStack">
        <ShimmerBlock className="cv-shimmerH1" style={{ width: '40%' }} />
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="cv-shimmerRow">
            <ShimmerBlock className="cv-shimmerText" style={{ width: '28%' }} />
            <ShimmerBlock className="cv-shimmerText" style={{ width: '22%' }} />
            <ShimmerBlock className="cv-shimmerText" style={{ width: '18%' }} />
            <ShimmerBlock className="cv-shimmerText" style={{ width: '16%' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ShimmerDashboardLayout() {
  return (
    <>
      <div className="cv-dashboardCol cv-dashboardCol--main">
        <div className="cv-dashboardSection">
          <div className="cv-shimmerCard">
            <div className="cv-shimmerGrid2" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <ShimmerCard titleWidth="45%" rows={3} />
              <ShimmerCard titleWidth="45%" rows={3} />
              <ShimmerCard titleWidth="45%" rows={3} />
              <ShimmerCard titleWidth="45%" rows={3} />
            </div>
          </div>
        </div>
        <div className="cv-dashboardSection">
          <ShimmerCard titleWidth="30%" rows={10} />
        </div>
      </div>

      <div className="cv-dashboardCol cv-dashboardCol--side">
        <div className="cv-dashboardSection">
          <ShimmerCard titleWidth="40%" rows={10} />
        </div>
        <div className="cv-dashboardSection">
          <ShimmerTableCard rows={6} />
        </div>
      </div>
    </>
  )
}
