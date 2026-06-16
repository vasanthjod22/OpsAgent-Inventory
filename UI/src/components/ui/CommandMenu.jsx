import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Package, Users, ShoppingCart, BarChart2, Settings, ArrowRight } from 'lucide-react';

const CommandMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Keyboard shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const routes = [
    { name: 'Dashboard', path: '/dashboard', icon: BarChart2 },
    { name: 'Create New Bill', path: '/billing', icon: FileText },
    { name: 'Manage Inventory', path: '/inventory', icon: Package },
    { name: 'Customers Directory', path: '/customers', icon: Users },
    { name: 'Purchase Orders', path: '/purchase_orders', icon: ShoppingCart },
    { name: 'Financial Reports', path: '/reports', icon: BarChart2 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const filteredRoutes = routes.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm animate-fadein" onClick={() => setIsOpen(false)}>
      <div 
        className="w-full max-w-lg bg-[var(--bg-card)] rounded-xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-[var(--border)] gap-3">
          <Search size={20} className="text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] text-lg placeholder-[var(--text-muted)]"
            placeholder="Search commands or pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-[var(--bg-main)] text-[var(--text-muted)] text-xs rounded border border-[var(--border)] font-mono">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredRoutes.length === 0 ? (
            <div className="px-4 py-8 text-center text-[var(--text-muted)]">
              No results found for "{query}"
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredRoutes.map((route, i) => (
                <button
                  key={i}
                  className="flex items-center gap-3 px-3 py-3 w-full text-left rounded-lg hover:bg-[var(--bg-main)] transition-colors group"
                  onClick={() => handleSelect(route.path)}
                >
                  <div className="p-2 bg-[var(--bg-main)] rounded-md text-[var(--text-secondary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                    <route.icon size={18} />
                  </div>
                  <span className="flex-1 text-[var(--text-primary)] font-medium">{route.name}</span>
                  <ArrowRight size={16} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandMenu;
