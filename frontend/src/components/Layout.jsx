import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/results', label: 'Match Results' },
  { to: '/exceptions', label: 'Exceptions' },
  { to: '/rules', label: 'Rules' },
  { to: '/statements', label: 'Statements' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/revenue', label: 'Revenue' },
]

export default function Layout() {
  return (
    <div className="flex h-screen">
      <nav className="w-56 bg-gray-900 text-gray-300 flex flex-col flex-shrink-0">
        <div className="px-4 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <img src={`${import.meta.env.BASE_URL}jason.png`} alt="Jason" className="w-9 h-9 rounded-full ring-2 ring-gray-600 object-cover" />
            <div>
              <div className="text-white font-semibold text-sm leading-tight">Jason's</div>
              <div className="text-gray-400 text-xs leading-tight">Commission Recon</div>
            </div>
          </div>
        </div>
        <ul className="flex-1 py-3">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `block px-4 py-2 text-sm ${
                    isActive
                      ? 'bg-gray-800 text-white font-medium'
                      : 'hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="px-4 py-3 text-xs text-gray-500 border-t border-gray-700">
          Demo &middot; jeffborowitz.com
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
