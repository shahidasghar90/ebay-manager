'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/products', label: 'Products', icon: '◫' },
  { href: '/products/new', label: 'Add Product', icon: '＋' },
  { href: '/orders', label: 'Orders', icon: '▤' },
  { href: '/research', label: 'Product Research', icon: '⌕' },
  { href: '/inventory', label: 'Inventory', icon: '▣' },
  { href: '/accounts', label: 'Accounts', icon: '$' },
  { href: '/returns', label: 'Returns', icon: '↩' },
  { href: '/settings', label: 'Settings', icon: '⚙' }
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email || '');
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-navy/50 z-[250] md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`
          fixed md:static top-0 left-0 bottom-0 z-[300] w-[250px]
          bg-navy text-white flex flex-col p-6
          transition-transform duration-200 ease-out shadow-2xl md:shadow-none
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex items-center gap-3 pb-7 border-b border-white/10 relative">
          <div className="w-9 h-9 rounded-lg bg-blue grid place-items-center font-bold text-xl">
            T
          </div>
          <div>
            <h1 className="text-base font-bold m-0">TradePilot</h1>
            <p className="text-xs text-slate-400 m-0">Business Console</p>
          </div>
          <button
            className="md:hidden absolute right-0 top-0 text-white text-lg p-1"
            onClick={onClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="mt-6 grid gap-1.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  rounded-lg px-3 py-2.5 font-semibold text-sm
                  ${active ? 'bg-blue/20 text-white' : 'text-slate-300 hover:bg-blue/10 hover:text-white'}
                `}
              >
                <span className="inline-block w-6">{item.icon}</span> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 grid gap-3">
          {email && (
            <div className="text-xs text-slate-400 leading-relaxed">
              <p className="m-0">Logged in as</p>
              <p className="m-0 text-slate-200 break-all">{email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-left text-sm font-semibold text-slate-300 hover:text-white"
          >
            ⏻ Log out
          </button>
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block" />
            Supabase backend connected
          </div>
        </div>
      </aside>
    </>
  );
}
