import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import clsx from 'clsx'

export default function AppLayout({ children, wsStatus }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className={clsx(
        'flex flex-col min-h-screen transition-all duration-300',
        collapsed ? 'md:ml-[72px]' : 'md:ml-[260px]'
      )}>
        <Header wsStatus={wsStatus} />
        <main className="flex-1 p-4 md:p-6 w-full pb-20 md:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
