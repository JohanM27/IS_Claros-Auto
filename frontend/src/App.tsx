import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ServicesPage } from './pages/ServicesPage'
import { WorkOrdersPage } from './pages/WorkOrdersPage'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/ordenes" element={<WorkOrdersPage />} />
      <Route path="/admin/ordenes/nueva" element={<WorkOrdersPage />} />
      <Route path="/admin/ordenes/:id" element={<WorkOrdersPage />} />
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/servicios" element={<ServicesPage />} />
        <Route path="/citas" element={<AppointmentsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
