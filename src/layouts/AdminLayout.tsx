import {
  ApiOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  BellOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  LogoutOutlined,
  NotificationOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  TagsOutlined,
  TeamOutlined,
  ToolOutlined,
  UsergroupAddOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Badge, Dropdown, Layout, Menu, Tag, theme } from 'antd'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useMock } from '@/api/http'
import { RequestDrawer } from '@/components/RequestDrawer'
import { useAuth } from '@/auth'
import type { MenuNode, NotificationItem } from '@/types'
import { connectNotifications } from '@/realtime'

const { Header, Sider, Content } = Layout

const iconMap: Record<string, ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  SettingOutlined: <SettingOutlined />,
  UserOutlined: <UserOutlined />,
  TeamOutlined: <TeamOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  BookOutlined: <FileSearchOutlined />,
  FileSearchOutlined: <FileSearchOutlined />,
  ToolOutlined: <ToolOutlined />,
  ShopOutlined: <ShopOutlined />,
  TagsOutlined: <TagsOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  ShoppingOutlined: <ShoppingOutlined />,
  ShoppingCartOutlined: <ShoppingCartOutlined />,
  UsergroupAddOutlined: <UsergroupAddOutlined />,
  NotificationOutlined: <NotificationOutlined />,
  FolderOpenOutlined: <FolderOpenOutlined />,
  ApiOutlined: <ApiOutlined />,
}

function toItems(nodes: MenuNode[]): { key: string; icon?: ReactNode; label: string; children?: ReturnType<typeof toItems> }[] {
  return nodes.map((node) => ({
    key: node.path || `dir-${node.id}`,
    icon: iconMap[node.icon],
    label: node.name,
    children: node.children?.length ? toItems(node.children) : undefined,
  }))
}

function pathsOf(nodes: MenuNode[]): string[] {
  return nodes.flatMap((node) => [node.path, ...(node.children ? pathsOf(node.children) : [])]).filter(Boolean)
}

export function AdminLayout() {
  const { token } = theme.useToken()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [unread, setUnread] = useState(0)
  const [notes, setNotes] = useState<NotificationItem[]>([])

  const menus = user?.menus || []
  const selected = useMemo(() => {
    const found = pathsOf(menus)
      .filter((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))
      .sort((a, b) => b.length - a.length)[0]
    return found || location.pathname
  }, [location.pathname, menus])

  const loadNotes = async () => {
    const [count, page] = await Promise.all([api.unreadCount(), api.notifications({ page: 1, pageSize: 5 })])
    setUnread(count.count)
    setNotes(page.list)
  }

  useEffect(() => {
    loadNotes().catch(() => undefined)
    return connectNotifications(() => {
      loadNotes().catch(() => undefined)
    })
  }, [])

  return (
    <Layout style={{ minHeight: '100%' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark" width={220}>
        <div className="admin-logo">
          <ApiOutlined />
          {!collapsed && 'ManageFE'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          defaultOpenKeys={menus.filter((item) => item.children?.length).map((item) => item.path || `dir-${item.id}`)}
          items={toItems(menus)}
          onClick={({ key }) => key.startsWith('/') && navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: token.colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, paddingInline: 20 }}>
          <Tag color={useMock ? 'purple' : 'green'}>{useMock ? 'Mock 数据' : 'Live API'}</Tag>
          <Dropdown
            menu={{
              items: [
                ...notes.map((item) => ({
                  key: String(item.id),
                  label: (
                    <div style={{ maxWidth: 280 }}>
                      <b>{item.title}</b>
                      <div style={{ color: '#64748b' }}>{item.content}</div>
                    </div>
                  ),
                })),
                { type: 'divider' as const },
                { key: 'all', label: '查看全部' },
                { key: 'read', label: '全部已读' },
              ],
              onClick: async ({ key }) => {
                if (key === 'all') {
                  navigate('/account/notifications')
                  return
                }
                if (key === 'read') {
                  const result = await api.readAllNotifications()
                  setUnread(result.unread)
                  loadNotes().catch(() => undefined)
                  return
                }
                await api.readNotification(Number(key))
                navigate('/account/notifications')
              },
            }}
          >
            <Badge count={unread} size="small">
              <BellOutlined style={{ fontSize: 18 }} />
            </Badge>
          </Dropdown>
          <Dropdown
            menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: '个人设置' },
                { key: 'logout', icon: <LogoutOutlined />, label: '退出' },
              ],
              onClick: async ({ key }) => {
                if (key === 'profile') navigate('/account/profile')
                if (key === 'logout') {
                  await logout()
                  navigate('/login')
                }
              },
            }}
          >
            <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Avatar size="small" src={user?.avatar} icon={<UserOutlined />} />
              {user?.nickname}
            </span>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
      <RequestDrawer />
    </Layout>
  )
}
