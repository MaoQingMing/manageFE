import { Button, Result } from 'antd'
import { Navigate, createBrowserRouter, useNavigate, useSearchParams } from 'react-router-dom'
import { getAccess } from '@/api/http'
import { loginPath, postLoginPath } from '@/authNavigation'
import { useAuth } from '@/auth'
import { AdminLayout } from '@/layouts/AdminLayout'
import { AuditsPage } from '@/pages/Audits'
import { CategoriesPage } from '@/pages/Categories'
import { CustomersPage } from '@/pages/Customers'
import { DashboardPage } from '@/pages/Dashboard'
import { DepartmentsPage } from '@/pages/Departments'
import { DictsPage } from '@/pages/Dicts'
import { FilesPage } from '@/pages/Files'
import { LabPage } from '@/pages/Lab'
import { LoginPage } from '@/pages/Login'
import { MenusPage } from '@/pages/Menus'
import { NoticeDetailPage } from '@/pages/NoticeDetail'
import { NoticesPage } from '@/pages/Notices'
import { NotificationsPage } from '@/pages/Notifications'
import { OrderDetailPage } from '@/pages/OrderDetail'
import { OrdersPage } from '@/pages/Orders'
import { ProductsPage } from '@/pages/Products'
import { ProfilePage } from '@/pages/Profile'
import { RolesPage } from '@/pages/Roles'
import { SettingsPage } from '@/pages/Settings'
import { TagsPage } from '@/pages/Tags'
import { UsersPage } from '@/pages/Users'

function RequireAuth() {
  const { user } = useAuth()
  if (!user || !getAccess()) return <Navigate to={loginPath()} replace />
  return <AdminLayout />
}

function GuestOnly() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  if (user && getAccess()) return <Navigate to={postLoginPath(params.get('redirect'))} replace />
  return <LoginPage />
}

function NotFound() {
  const navigate = useNavigate()
  return <Result status="404" title="页面不存在" extra={<Button onClick={() => navigate('/dashboard')}>回工作台</Button>} />
}

export const router = createBrowserRouter([
  { path: '/login', element: <GuestOnly /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'system/users', element: <UsersPage /> },
      { path: 'system/roles', element: <RolesPage /> },
      { path: 'system/menus', element: <MenusPage /> },
      { path: 'system/departments', element: <DepartmentsPage /> },
      { path: 'system/dicts', element: <DictsPage /> },
      { path: 'system/audits', element: <AuditsPage /> },
      { path: 'system/settings', element: <SettingsPage /> },
      { path: 'catalog/categories', element: <CategoriesPage /> },
      { path: 'catalog/tags', element: <TagsPage /> },
      { path: 'catalog/products', element: <ProductsPage /> },
      { path: 'trade/customers', element: <CustomersPage /> },
      { path: 'trade/orders', element: <OrdersPage /> },
      { path: 'trade/orders/:id', element: <OrderDetailPage /> },
      { path: 'content/notices', element: <NoticesPage /> },
      { path: 'content/notices/:id', element: <NoticeDetailPage /> },
      { path: 'content/files', element: <FilesPage /> },
      { path: 'account/profile', element: <ProfilePage /> },
      { path: 'account/notifications', element: <NotificationsPage /> },
      { path: 'lab', element: <LabPage /> },
    ],
  },
  { path: '*', element: <NotFound /> },
])
