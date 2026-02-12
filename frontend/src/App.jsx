import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './screens/Dashboard'
import MatchResults from './screens/MatchResults'
import Exceptions from './screens/Exceptions'
import Rules from './screens/Rules'
import Statements from './screens/Statements'
import Transactions from './screens/Transactions'

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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
