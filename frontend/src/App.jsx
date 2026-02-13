import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './screens/Dashboard'
import MatchResults from './screens/MatchResults'
import Exceptions from './screens/Exceptions'
import Rules from './screens/Rules'
import Statements from './screens/Statements'
import Transactions from './screens/Transactions'
import Review from './screens/Review'
import Revenue from './screens/Revenue'
import AuditTrail from './screens/AuditTrail'
import Accruals from './screens/Accruals'
import Journal from './screens/Journal'
import Exports from './screens/Exports'
import Producers from './screens/Producers'
import Aging from './screens/Aging'
import Carriers from './screens/Carriers'
import Splits from './screens/Splits'
import Netting from './screens/Netting'
import Close from './screens/Close'
import CarrierMappings from './screens/CarrierMappings'
import RunComparison from './screens/RunComparison'

const basename = import.meta.env.VITE_BASE_PATH || '/'

export default function App() {
  return (
    <BrowserRouter basename={basename.replace(/\/$/, '') || '/'}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="results" element={<MatchResults />} />
          <Route path="exceptions" element={<Exceptions />} />
          <Route path="rules" element={<Rules />} />
          <Route path="statements" element={<Statements />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="review/:lineId" element={<Review />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="audit" element={<AuditTrail />} />
          <Route path="accruals" element={<Accruals />} />
          <Route path="journal" element={<Journal />} />
          <Route path="exports" element={<Exports />} />
          <Route path="producers" element={<Producers />} />
          <Route path="aging" element={<Aging />} />
          <Route path="carriers" element={<Carriers />} />
          <Route path="splits" element={<Splits />} />
          <Route path="netting" element={<Netting />} />
          <Route path="close" element={<Close />} />
          <Route path="mappings" element={<CarrierMappings />} />
          <Route path="run-comparison" element={<RunComparison />} />
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-6xl font-bold text-gray-200 mb-4">404</div>
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Page not found</h2>
              <p className="text-sm text-gray-500 mb-6">The page you're looking for doesn't exist.</p>
              <Link to="/" className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
                Go to Dashboard
              </Link>
            </div>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
