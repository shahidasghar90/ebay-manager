'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type IconName = 'home' | 'products' | 'orders' | 'menu';

const ICON_PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  products: 'M4 7.5 12 3l8 4.5v9L12 21l-8-4.5zM4 7.5l8 4.5 8-4.5M12 12v9',
  orders: 'M6 3h12a1 1 0 0 1 1 1v17l-3-2-2.5 2-2.5-2-2.5 2L6 19l-3 2V4a1 1 0 0 1 1-1zM8 8h8M8 12h8M8 16h5',
  menu: 'M4 6h16M4 12h16M4 18h16'
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

const TABS: { href: string; label: string; icon: IconName; match: (path: string) => boolean }[] = [
  { href: '/dashboard', label: 'Home', icon: 'home', match: (path) => path.startsWith('/dashboard') },
  {
    href: '/products',
    label: 'Products',
    icon: 'products',
    match: (path) => path.startsWith('/products') && !path.startsWith('/products/new')
  },
  { href: '/orders', label: 'Orders', icon: 'orders', match: (path) => path.startsWith('/orders') }
];

/** Phone-only tab bar: main sections, a raised "Add Product" button, and the full menu. */
export default function BottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();

  const tab = (item: (typeof TABS)[number]) => {
    const active = item.match(pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
          active ? 'text-blue' : 'text-slate-500'
        }`}
      >
        <Icon name={item.icon} />
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 inset-x-0 z-[200] bg-white border-t border-border shadow-[0_-2px_10px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-16">
        {tab(TABS[0])}
        {tab(TABS[1])}

        <div className="grid place-items-center">
          <Link
            href="/products/new"
            aria-label="Add Product"
            className="-mt-6 w-14 h-14 rounded-full bg-blue text-white grid place-items-center shadow-lg border-4 border-white"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>

        {tab(TABS[2])}

        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-500"
        >
          <Icon name="menu" />
          More
        </button>
      </div>
    </nav>
  );
}
