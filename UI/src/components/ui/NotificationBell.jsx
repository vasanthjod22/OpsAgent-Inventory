import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';

const NotificationBell = ({ token }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/notifications`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error(err);
    }
  };

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkRead = async (id) => {
    await fetch(
      `${import.meta.env.VITE_API_URL}/notifications/${id}/read`,
      {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}` 
        }
      }
    );
    setNotifications(prev =>
      prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await fetch(
      `${import.meta.env.VITE_API_URL}/notifications/mark-all-read`,
      {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}` 
        }
      }
    );
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    setUnreadCount(0);
  };

  const handleDelete = async (id) => {
    await fetch(
      `${import.meta.env.VITE_API_URL}/notifications/${id}`,
      {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${token}` 
        }
      }
    );
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const typeColors = {
    success: { border: '#16A34A', bg: '#F0FDF4', dot: '#16A34A' },
    warning: { border: '#D97706', bg: '#FFFBEB', dot: '#D97706' },
    danger:  { border: '#DC2626', bg: '#FEF2F2', dot: '#DC2626' },
    info:    { border: '#2563EB', bg: '#EFF6FF', dot: '#2563EB' }
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: open ? '#F8FAFC' : 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease'
        }}
      >
        <Bell size={18} color="#64748B" />
        
        {/* Unread badge */}
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            borderRadius: 999,
            background: '#DC2626',
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid white',
            animation: 'pulse 2s infinite'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 48,
          right: 0,
          width: 380,
          maxHeight: 520,
          background: 'var(--bg-card)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          zIndex: 1000,
          animation: 'fadeInDown 0.2s ease',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                Notifications
              </h3>
              {unreadCount > 0 && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  {unreadCount} unread
                </p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563EB',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div style={{ overflowY: 'auto', maxHeight: 400 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map(notif => {
                const colors = typeColors[notif.type] || typeColors.info;

                return (
                  <div
                    key={notif.id}
                    className="notification-item"
                    onClick={() => {
                      handleMarkRead(notif.id);
                      if (notif.link) {
                        // In a real app we'd use react-router here
                      }
                      setOpen(false);
                    }}
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid #F8FAFC',
                      borderLeft: notif.read ? '3px solid transparent' : `3px solid ${colors.border}`,
                      background: notif.read ? 'white' : colors.bg,
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 12,
                      transition: 'background 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    {/* Icon */}
                    <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>
                      {notif.icon || '🔔'}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: notif.read ? 400 : 600,
                        color: 'var(--text-primary)',
                        marginBottom: 3
                      }}>
                        {notif.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {notif.message}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                        {timeAgo(notif.created_at)}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!notif.read && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.dot, flexShrink: 0, marginTop: 6 }}/>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notif.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'none',
                        border: 'none',
                        color: '#CBD5E1',
                        cursor: 'pointer',
                        fontSize: 14,
                        opacity: 0,
                        transition: 'opacity 0.2s ease'
                      }}
                      className="delete-btn"
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #F1F5F9',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <button
                onClick={async () => {
                  await fetch(`${import.meta.env.VITE_API_URL}/notifications`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  setNotifications([]);
                  setUnreadCount(0);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#DC2626',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
