import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
