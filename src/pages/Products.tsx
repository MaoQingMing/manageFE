import { App, Button, Checkbox, Drawer, Form, Image, Input, InputNumber, Modal, Select, Space, Table, Tag, Upload } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { useAuth } from '@/auth'
import { EndpointAlert } from '@/components/EndpointAlert'
import { productStatusMeta } from '@/constants'
import type { CategoryNode, PageData, Product, TagItem } from '@/types'
import { can, downloadBlob, fenToYuan, filenameFromDisposition, formatMoney, yuanToFen } from '@/utils'

function flat(nodes: CategoryNode[], prefix = ''): { label: string; value: number }[] {
  return nodes.flatMap((node) => [{ label: `${prefix}${node.name}`, value: node.id }, ...flat(node.children || [], `${prefix}— `)])
}

export function ProductsPage() {
  const { message, modal } = App.useApp()
  const { user } = useAuth()
  const perms = user?.permissions || []
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '', status: undefined as string | undefined, categoryId: undefined as number | undefined })
  const [data, setData] = useState<PageData<Product>>({ list: [], total: 0, page: 1, pageSize: 10 })
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [tags, setTags] = useState<TagItem[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [current, setCurrent] = useState<Product | null>(null)
  const [open, setOpen] = useState(false)
  const [stale, setStale] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)
  const [form] = Form.useForm()
  const [stockForm] = Form.useForm()

  const load = async () => setData(await api.products(query))
  useEffect(() => { load().catch(() => undefined) }, [query])
  useEffect(() => {
    api.categoryTree().then(setCategories).catch(() => undefined)
    api.tags({ page: 1, pageSize: 100 }).then((result) => setTags(result.list)).catch(() => undefined)
  }, [])

  const openProduct = async (id?: number) => {
    setStale(false)
    if (!id) {
      setCurrent(null)
      form.resetFields()
      form.setFieldsValue({ status: 'draft', stock: 0, price: 0, tagIds: [] })
      setOpen(true)
      return
    }
    const detail = await api.product(id)
    setCurrent(detail)
    form.setFieldsValue({ ...detail, price: fenToYuan(detail.price) })
    setOpen(true)
  }

  return (
    <div>
      <EndpointAlert groups={['商品']} />
      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search placeholder="名称 / SKU" allowClear onSearch={(keyword) => setQuery({ ...query, keyword, page: 1 })} />
        <Select allowClear placeholder="状态" style={{ width: 120 }} options={Object.entries(productStatusMeta).map(([value, meta]) => ({ value, label: meta.text }))} onChange={(status) => setQuery({ ...query, status, page: 1 })} />
        <Select allowClear placeholder="分类" style={{ width: 160 }} options={flat(categories)} onChange={(categoryId) => setQuery({ ...query, categoryId, page: 1 })} />
        {can(perms, 'catalog:product:create') && <Button type="primary" onClick={() => openProduct()}>新建</Button>}
        {can(perms, 'catalog:product:update') && <Button disabled={!selected.length} onClick={async () => { await api.batchProductStatus(selected, 'on'); message.success('已上架'); load() }}>批量上架</Button>}
        {can(perms, 'catalog:product:update') && <Button disabled={!selected.length} onClick={async () => { await api.batchProductStatus(selected, 'off'); message.success('已下架'); load() }}>批量下架</Button>}
        {can(perms, 'catalog:product:delete') && <Button danger disabled={!selected.length} onClick={() => modal.confirm({ title: '物理删除所选商品？', onOk: async () => { const result = await api.batchDeleteProducts(selected); message.success(`删除 ${result.deleted} 个`); setSelected([]); load() } })}>批量删除</Button>}
        <Button onClick={async () => { const file = await api.exportProducts(query); downloadBlob(file.blob, filenameFromDisposition(file.disposition, 'products.csv')) }}>导出</Button>
        <Button onClick={async () => { const file = await api.productTemplate(); downloadBlob(file.blob, 'product-import-template.csv') }}>模板</Button>
        {can(perms, 'catalog:product:create') && (
          <Upload showUploadList={false} accept=".csv" customRequest={async ({ file, onSuccess }) => {
            const result = await api.importProducts(file as File)
            message.info(`成功 ${result.success}，失败 ${result.failed}`)
            onSuccess?.(result)
            load()
          }}>
            <Button>导入</Button>
          </Upload>
        )}
      </Space>
      <Table
        rowKey="id"
        dataSource={data.list}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as number[]) }}
        pagination={{ current: data.page, pageSize: data.pageSize, total: data.total, onChange: (page, pageSize) => setQuery({ ...query, page, pageSize }) }}
        columns={[
          { title: '商品', dataIndex: 'name' },
          { title: 'SKU', dataIndex: 'sku' },
          { title: '分类', dataIndex: 'categoryName' },
          { title: '价格', dataIndex: 'price', render: formatMoney },
          { title: '库存', dataIndex: 'stock' },
          { title: '状态', dataIndex: 'status', render: (status: keyof typeof productStatusMeta) => <Tag color={productStatusMeta[status].color}>{productStatusMeta[status].text}</Tag> },
          { title: '标签', dataIndex: 'tags', render: (list: Product['tags']) => list.map((tag) => <Tag key={tag.id} color={tag.color}>{tag.name}</Tag>) },
          { title: '版本', dataIndex: 'version' },
          { title: '操作', render: (_, row) => <Button type="link" onClick={() => openProduct(row.id)}>编辑</Button> },
        ]}
      />
      <Drawer title={current ? `编辑商品 v${current.version}` : '新建商品'} open={open} width={560} onClose={() => setOpen(false)} extra={<Button type="primary" onClick={() => form.submit()}>保存</Button>}>
        <Form form={form} layout="vertical" onFinish={async (values) => {
          const payload = { ...values, price: yuanToFen(Number(values.price)) }
          if (!current) {
            const created = await api.createProduct(payload)
            message.success('已创建，可继续上传图片')
            setCurrent(created)
            form.setFieldsValue({ ...created, price: fenToYuan(created.price) })
            load()
            return
          }
          const saved = await api.updateProduct(current.id, { ...payload, version: stale ? current.version - 1 : current.version })
          message.success('已保存')
          setCurrent(saved)
          load()
        }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sku" label="SKU" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="categoryId" label="分类" rules={[{ required: true }]}><Select options={flat(categories)} /></Form.Item>
          <Form.Item name="price" label="价格（元）" rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="stock" label="库存" rules={[{ required: true }]}><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={Object.entries(productStatusMeta).map(([value, meta]) => ({ value, label: meta.text }))} /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea /></Form.Item>
          {!current && <Form.Item name="tagIds" label="标签"><Select mode="multiple" options={tags.map((tag) => ({ value: tag.id, label: tag.name }))} /></Form.Item>}
        </Form>
        {current && (
          <>
            <Checkbox checked={stale} onChange={(event) => setStale(event.target.checked)}>用过期 version 提交，触发 40900</Checkbox>
            <div style={{ margin: '12px 0' }}>
              <Select mode="multiple" style={{ width: '70%' }} value={current.tagIds} options={tags.map((tag) => ({ value: tag.id, label: tag.name }))} onChange={(tagIds) => setCurrent({ ...current, tagIds })} />
              <Button style={{ marginLeft: 8 }} onClick={async () => { const saved = await api.productTags(current.id, current.tagIds); setCurrent(saved); message.success('标签已覆盖') }}>保存标签</Button>
              <Button style={{ marginLeft: 8 }} onClick={() => { stockForm.setFieldsValue({ stock: current.stock }); setStockOpen(true) }}>局部改库存</Button>
            </div>
            <Space wrap>
              {current.images.map((image, index) => (
                <div key={image.id}>
                  <Image src={image.url} width={72} height={72} />
                  <div>
                    <Button type="link" disabled={index === 0} onClick={async () => {
                      const ids = current.images.map((item) => item.id)
                      ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
                      const images = await api.sortProductImages(current.id, ids)
                      setCurrent({ ...current, images })
                    }}>前移</Button>
                    <Button type="link" danger onClick={async () => { await api.deleteProductImage(current.id, image.id); setCurrent(await api.product(current.id)) }}>删除</Button>
                  </div>
                </div>
              ))}
            </Space>
            <Upload showUploadList={false} customRequest={async ({ file, onSuccess }) => {
              await api.uploadProductImage(current.id, file as File)
              setCurrent(await api.product(current.id))
              onSuccess?.({})
            }}>
              <Button style={{ marginTop: 12 }}>上传图片</Button>
            </Upload>
            <Button danger style={{ marginTop: 12, marginLeft: 8 }} onClick={() => modal.confirm({ title: '物理删除商品？', onOk: async () => { await api.deleteProduct(current.id); setOpen(false); load() } })}>删除商品</Button>
          </>
        )}
      </Drawer>
      <Modal title="局部更新库存" open={stockOpen} onCancel={() => setStockOpen(false)} onOk={() => stockForm.submit()}>
        <Form form={stockForm} onFinish={async (values) => {
          if (!current) return
          const saved = await api.patchProduct(current.id, { version: current.version, stock: values.stock })
          setCurrent(saved)
          setStockOpen(false)
          message.success('库存已更新')
          load()
        }}>
          <Form.Item name="stock" label="库存" rules={[{ required: true }]}><InputNumber min={0} precision={0} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
