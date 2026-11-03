import type { Product } from '@/types'
import { bodyOf, fileResult, type Route } from './context'
import {
  conflict,
  csv,
  includes,
  invalid,
  isDescendant,
  notFound,
  num,
  optionalNum,
  pageOf,
  sortBy,
  svgData,
  nowIso,
  text,
  toTree,
  versionConflict,
} from './kit'
import { categoryName, categoryPlain, db, nextId, presentProduct, type DbProduct } from './store'

function productStatus(value: unknown): Product['status'] {
  if (value !== 'draft' && value !== 'on' && value !== 'off') throw invalid('商品状态非法')
  return value
}

function mustCategory(id: number) {
  const item = db.categories.find((category) => category.id === id)
  if (!item) throw notFound('分类不存在')
  return item
}

function mustTag(id: number) {
  const item = db.tags.find((tag) => tag.id === id)
  if (!item) throw notFound('标签不存在')
  return item
}

function mustProduct(id: number) {
  const item = db.products.find((product) => product.id === id)
  if (!item) throw notFound('商品不存在')
  return item
}

function ids(value: unknown) {
  if (!Array.isArray(value)) throw invalid('需要 id 数组')
  return value.map((item) => {
    const id = Number(item)
    if (!Number.isInteger(id) || id <= 0) throw invalid('id 非法')
    return id
  })
}

function referenced(id: number) {
  return db.orders.some((order) => order.items.some((item) => item.productId === id))
}

function filterProducts(query: Record<string, string>) {
  let list = [...db.products]
  if (query.keyword) list = list.filter((item) => includes(`${item.name}${item.sku}`, query.keyword))
  const categoryId = optionalNum(query.categoryId)
  if (categoryId) list = list.filter((item) => item.categoryId === categoryId)
  if (query.status) list = list.filter((item) => item.status === query.status)
  const tagId = optionalNum(query.tagId)
  if (tagId) list = list.filter((item) => item.tagIds.includes(tagId))
  if (query.minPrice) list = list.filter((item) => item.price >= Number(query.minPrice))
  if (query.maxPrice) list = list.filter((item) => item.price <= Number(query.maxPrice))
  return sortBy(list, query.sortField, query.sortOrder)
}

function lock(product: DbProduct, version: unknown) {
  if (Number(version) !== product.version) throw versionConflict()
  product.version += 1
  product.updatedAt = nowIso()
}

function applyTags(product: DbProduct, tagIds: number[]) {
  tagIds.forEach((id) => mustTag(id))
  product.tagIds = [...new Set(tagIds)]
}

async function readUpload(body: unknown) {
  if (!(body instanceof FormData)) throw invalid('请使用 multipart/form-data')
  const file = body.get('file')
  if (!(file instanceof File)) throw invalid('缺少文件')
  const max = Number(db.settings.find((item) => item.key === 'upload.maxSizeMB')?.value || 20) * 1024 * 1024
  if (file.size > max) throw invalid('文件超过大小限制')
  return file
}

export const catalogRoutes: Route[] = [
  { method: 'GET', pattern: '/api/v1/categories/tree', auth: true, perm: 'catalog:category:list', handle: () => toTree(db.categories) },
  {
    method: 'GET',
    pattern: '/api/v1/categories/:id',
    auth: true,
    perm: 'catalog:category:list',
    handle: (ctx) => categoryPlain(mustCategory(num(ctx.params.id, 'id'))),
  },
  {
    method: 'POST',
    pattern: '/api/v1/categories',
    auth: true,
    perm: 'catalog:category:update',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const parentId = Number(body.parentId) || 0
      if (parentId) mustCategory(parentId)
      const item = { id: nextId('category'), parentId, name: text(body.name, '名称', 32), sort: Number(body.sort) || 0, status: Number(body.status) === 0 ? 0 : 1 }
      db.categories.push(item)
      return item
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/categories/:id',
    auth: true,
    perm: 'catalog:category:update',
    handle: (ctx) => {
      const item = mustCategory(num(ctx.params.id, 'id'))
      const body = bodyOf(ctx)
      item.name = text(body.name, '名称', 32)
      item.sort = Number(body.sort) || 0
      item.status = Number(body.status) === 0 ? 0 : 1
      return item
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/categories/:id',
    auth: true,
    perm: 'catalog:category:update',
    handle: (ctx) => {
      const item = mustCategory(num(ctx.params.id, 'id'))
      if (db.categories.some((category) => category.parentId === item.id)) throw conflict('请先删除子分类')
      if (db.products.some((product) => product.categoryId === item.id)) throw conflict('分类下仍有商品')
      db.categories = db.categories.filter((category) => category.id !== item.id)
      return { id: item.id }
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/categories/:id/move',
    auth: true,
    perm: 'catalog:category:update',
    handle: (ctx) => {
      const item = mustCategory(num(ctx.params.id, 'id'))
      const parentId = Number(bodyOf(ctx).parentId) || 0
      if (parentId === item.id) throw invalid('不能移动到自身')
      if (parentId) mustCategory(parentId)
      if (parentId && isDescendant(db.categories, item.id, parentId)) throw invalid('不能移动到自己的子分类下')
      item.parentId = parentId
      if (bodyOf(ctx).sort !== undefined) item.sort = Number(bodyOf(ctx).sort) || 0
      return item
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/tags',
    auth: true,
    perm: 'catalog:tag:list',
    handle: (ctx) => {
      let list = [...db.tags]
      if (ctx.query.keyword) list = list.filter((item) => includes(item.name, ctx.query.keyword))
      return pageOf(list, ctx.query)
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/tags/:id',
    auth: true,
    perm: 'catalog:tag:list',
    handle: (ctx) => mustTag(num(ctx.params.id, 'id')),
  },
  {
    method: 'POST',
    pattern: '/api/v1/tags',
    auth: true,
    perm: 'catalog:tag:update',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const name = text(body.name, '名称', 16)
      if (db.tags.some((item) => item.name === name)) throw conflict('标签已存在')
      const item = { id: nextId('tag'), name, color: String(body.color || '#1677ff'), createdAt: nowIso() }
      db.tags.unshift(item)
      return item
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/tags/:id',
    auth: true,
    perm: 'catalog:tag:update',
    handle: (ctx) => {
      const item = mustTag(num(ctx.params.id, 'id'))
      const name = text(bodyOf(ctx).name, '名称', 16)
      if (db.tags.some((tag) => tag.name === name && tag.id !== item.id)) throw conflict('标签已存在')
      item.name = name
      item.color = String(bodyOf(ctx).color || item.color)
      return item
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/tags/:id',
    auth: true,
    perm: 'catalog:tag:update',
    handle: (ctx) => {
      const item = mustTag(num(ctx.params.id, 'id'))
      if (db.products.some((product) => product.tagIds.includes(item.id))) throw conflict('标签仍被商品使用')
      db.tags = db.tags.filter((tag) => tag.id !== item.id)
      return { id: item.id }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/products/export',
    auth: true,
    perm: 'catalog:product:list',
    handle: (ctx) => {
      const rows = [['name', 'sku', 'categoryId', 'price', 'stock', 'status'], ...filterProducts(ctx.query).map((item) => [item.name, item.sku, String(item.categoryId), String(item.price), String(item.stock), item.status])]
      return fileResult(csv(rows), 'products.csv', 'text/csv;charset=utf-8')
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/products/import-template',
    auth: true,
    perm: 'catalog:product:list',
    handle: () => fileResult(csv([['name', 'sku', 'categoryId', 'price', 'stock', 'status'], ['示例耳机', 'SKU-DEMO-1', '3', '19900', '20', 'on']]), 'product-import-template.csv', 'text/csv;charset=utf-8'),
  },
  {
    method: 'POST',
    pattern: '/api/v1/products/import',
    auth: true,
    perm: 'catalog:product:create',
    handle: async (ctx) => {
      const file = await readUpload(ctx.body)
      const table = parseCsv(await file.text())
      if (table.length < 2) throw invalid('文件没有数据行')
      const errors: { row: number; message: string }[] = []
      let success = 0
      table.slice(1).forEach((row, index) => {
        const rowNo = index + 2
        try {
          const [name, sku, categoryId, price, stock, status] = row
          if (!name || !sku) throw invalid('名称和 SKU 必填')
          if (db.products.some((item) => item.sku === sku)) throw conflict('SKU 已存在')
          mustCategory(Number(categoryId))
          const item: DbProduct = {
            id: nextId('product'),
            name,
            sku,
            categoryId: Number(categoryId),
            categoryName: categoryName(Number(categoryId)),
            price: integer(price, '价格'),
            stock: integer(stock, '库存'),
            status: productStatus(status),
            description: '',
            tagIds: [],
            tags: [],
            images: [],
            version: 1,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          }
          db.products.unshift(item)
          success += 1
        } catch (error) {
          errors.push({ row: rowNo, message: error instanceof Error ? error.message : '导入失败' })
        }
      })
      return { total: table.length - 1, success, failed: errors.length, errors }
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/products/batch-delete',
    auth: true,
    perm: 'catalog:product:delete',
    handle: (ctx) => {
      const list = ids(bodyOf(ctx).ids)
      if (list.some((id) => referenced(id))) throw conflict('存在已被订单引用的商品，本次未删除')
      const before = db.products.length
      db.products = db.products.filter((item) => !list.includes(item.id))
      return { deleted: before - db.products.length }
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/products/batch-status',
    auth: true,
    perm: 'catalog:product:update',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const status = productStatus(body.status)
      const list = ids(body.ids)
      let updated = 0
      list.forEach((id) => {
        const product = mustProduct(id)
        product.status = status
        product.version += 1
        product.updatedAt = nowIso()
        updated += 1
      })
      return { updated }
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/products',
    auth: true,
    perm: 'catalog:product:list',
    handle: (ctx) => {
      const page = pageOf(filterProducts(ctx.query), ctx.query)
      return { ...page, list: page.list.map((item) => presentProduct(item)) }
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/products',
    auth: true,
    perm: 'catalog:product:create',
    handle: (ctx) => {
      const body = bodyOf(ctx)
      const sku = text(body.sku, 'SKU', 32)
      if (db.products.some((item) => item.sku === sku)) throw conflict('SKU 已存在')
      const categoryId = Number(body.categoryId)
      mustCategory(categoryId)
      const product: DbProduct = {
        id: nextId('product'),
        name: text(body.name, '名称', 64),
        sku,
        categoryId,
        categoryName: categoryName(categoryId),
        price: integer(body.price, '价格'),
        stock: integer(body.stock, '库存'),
        status: productStatus(body.status || 'draft'),
        description: String(body.description ?? ''),
        tagIds: [],
        tags: [],
        images: [],
        version: 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      if (body.tagIds) applyTags(product, ids(body.tagIds))
      db.products.unshift(product)
      return presentProduct(product)
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/products/:id',
    auth: true,
    perm: 'catalog:product:list',
    handle: (ctx) => presentProduct(mustProduct(num(ctx.params.id, 'id'))),
  },
  {
    method: 'PUT',
    pattern: '/api/v1/products/:id',
    auth: true,
    perm: 'catalog:product:update',
    handle: (ctx) => {
      const product = mustProduct(num(ctx.params.id, 'id'))
      const body = bodyOf(ctx)
      lock(product, body.version)
      const sku = text(body.sku, 'SKU', 32)
      if (db.products.some((item) => item.sku === sku && item.id !== product.id)) throw conflict('SKU 已存在')
      const categoryId = Number(body.categoryId)
      mustCategory(categoryId)
      product.name = text(body.name, '名称', 64)
      product.sku = sku
      product.categoryId = categoryId
      product.price = integer(body.price, '价格')
      product.stock = integer(body.stock, '库存')
      product.status = productStatus(body.status)
      product.description = String(body.description ?? '')
      return presentProduct(product)
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/products/:id',
    auth: true,
    perm: 'catalog:product:update',
    handle: (ctx) => {
      const product = mustProduct(num(ctx.params.id, 'id'))
      const body = bodyOf(ctx)
      lock(product, body.version)
      if ('price' in body) product.price = integer(body.price, '价格')
      if ('stock' in body) product.stock = integer(body.stock, '库存')
      if ('status' in body) product.status = productStatus(body.status)
      if ('description' in body) product.description = String(body.description ?? '')
      return presentProduct(product)
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/products/:id',
    auth: true,
    perm: 'catalog:product:delete',
    handle: (ctx) => {
      const product = mustProduct(num(ctx.params.id, 'id'))
      if (referenced(product.id)) throw conflict('商品已被订单引用，请改为下架')
      db.products = db.products.filter((item) => item.id !== product.id)
      return { id: product.id }
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/products/:id/tags',
    auth: true,
    perm: 'catalog:product:update',
    handle: (ctx) => {
      const product = mustProduct(num(ctx.params.id, 'id'))
      applyTags(product, ids(bodyOf(ctx).tagIds))
      product.version += 1
      product.updatedAt = nowIso()
      return presentProduct(product)
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/products/:id/images',
    auth: true,
    perm: 'catalog:product:update',
    handle: async (ctx) => {
      const product = mustProduct(num(ctx.params.id, 'id'))
      const file = await readUpload(ctx.body)
      const url = file.type.startsWith('image/') ? await fileToDataUrl(file) : svgData(file.name.slice(0, 2), '#334155')
      const image = { id: nextId('image'), url, name: file.name, sort: product.images.length }
      product.images.push(image)
      product.version += 1
      product.updatedAt = nowIso()
      return image
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/products/:id/images/:imageId',
    auth: true,
    perm: 'catalog:product:update',
    handle: (ctx) => {
      const product = mustProduct(num(ctx.params.id, 'id'))
      const imageId = num(ctx.params.imageId, 'imageId')
      if (!product.images.some((item) => item.id === imageId)) throw notFound('图片不存在')
      product.images = product.images.filter((item) => item.id !== imageId)
      product.version += 1
      return { id: imageId }
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/products/:id/images/sort',
    auth: true,
    perm: 'catalog:product:update',
    handle: (ctx) => {
      const product = mustProduct(num(ctx.params.id, 'id'))
      const imageIds = ids(bodyOf(ctx).imageIds)
      if (imageIds.length !== product.images.length || imageIds.some((id) => !product.images.some((image) => image.id === id))) {
        throw invalid('图片列表不匹配')
      }
      product.images = imageIds.map((id, index) => {
        const image = product.images.find((item) => item.id === id)!
        return { ...image, sort: index }
      })
      return presentProduct(product).images
    },
  },
]

function integer(value: unknown, name: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw invalid(`${name}必须是非负整数，金额单位为分`)
  return parsed
}

function parseCsv(text: string) {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const cells: string[] = []
      let current = ''
      let quoted = false
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i]
        if (quoted) {
          if (char === '"' && line[i + 1] === '"') {
            current += '"'
            i += 1
          } else if (char === '"') quoted = false
          else current += char
        } else if (char === '"') quoted = true
        else if (char === ',') {
          cells.push(current)
          current = ''
        } else current += char
      }
      cells.push(current)
      return cells.map((cell) => cell.trim())
    })
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
