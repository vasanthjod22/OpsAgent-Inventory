import React, { useState } from 'react';

export const ActionBtn = ({ color, hover, icon, title, onClick }) => {
  const [isHover, setIsHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      style={{
        width: 32, height: 32, borderRadius: 6, border: 'none',
        background: isHover ? hover : color, color: 'white', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s ease', flexShrink: 0
      }}
    >
      {icon}
    </button>
  );
};

export const ColHeader = ({ label, tooltip }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{label}</span>
    {tooltip && (
      <span
        title={tooltip}
        style={{
          fontSize: 10, color: '#94A3B8', cursor: 'help', border: '1px solid #CBD5E1',
          borderRadius: '50%', width: 14, height: 14, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}
      >
        ?
      </span>
    )}
  </div>
);

const PageBtn = ({ children, active, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: 32, height: 32, borderRadius: 6,
      border: active ? 'none' : '1px solid #E2E8F0',
      background: active ? '#2563EB' : 'white',
      color: active ? 'white' : disabled ? '#CBD5E1' : '#374151',
      fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}
  >
    {children}
  </button>
);

export const Pagination = ({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange, onLimitChange }) => {
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  if (totalItems === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid #E2E8F0' }}>
      <span style={{ fontSize: 13, color: '#0F172A' }}>
        Showing {startItem}–{endItem} of <strong>{totalItems}</strong> items
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <PageBtn onClick={() => onPageChange(1)} disabled={currentPage === 1}>«</PageBtn>
        <PageBtn onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>‹</PageBtn>
        {getPageNumbers().map((page, i) => (
          page === '...' ? (
            <span key={i} style={{ padding: '0 8px', color: '#1E293B' }}>...</span>
          ) : (
            <PageBtn key={i} active={page === currentPage} onClick={() => onPageChange(page)}>{page}</PageBtn>
          )
        ))}
        <PageBtn onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>›</PageBtn>
        <PageBtn onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages}>»</PageBtn>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#0F172A' }}>Per page:</span>
        <select
          value={itemsPerPage}
          onChange={e => onLimitChange(Number(e.target.value))}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A', outline: 'none' }}
        >
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
};
