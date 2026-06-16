import React from 'react'

export function Skeleton({ className = '', style = {} }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded ${className}`}
      style={style}
    ></div>
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="w-1/2 h-4 mb-2" />
          <Skeleton className="w-3/4 h-6" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonChart({ className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-end ${className}`}>
      <Skeleton className="w-1/3 h-6 mb-4" />
      <div className="flex items-end gap-2 h-48 mt-auto">
        <Skeleton className="w-1/6 h-1/3 rounded-t-sm" />
        <Skeleton className="w-1/6 h-2/3 rounded-t-sm" />
        <Skeleton className="w-1/6 h-1/2 rounded-t-sm" />
        <Skeleton className="w-1/6 h-3/4 rounded-t-sm" />
        <Skeleton className="w-1/6 h-full rounded-t-sm" />
        <Skeleton className="w-1/6 h-1/4 rounded-t-sm" />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between">
        <Skeleton className="w-1/4 h-5" />
        <Skeleton className="w-1/4 h-5" />
        <Skeleton className="w-1/4 h-5" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex justify-between">
            <Skeleton className="w-1/4 h-4" />
            <Skeleton className="w-1/4 h-4" />
            <Skeleton className="w-1/4 h-4" />
          </div>
        ))}
      </div>
    </div>
  )
}
