import type { Item, Task } from '@/stores/hierarchyStore'

/** Shape of an item as returned (flat) by GET /api/items. */
export type RawItem = Omit<Item, 'children' | 'tasks'> & { tasks?: Task[] }

/** Turn the flat /api/items list into the nested tree the store expects. */
export function buildItemTree(rawItems: RawItem[]): Item[] {
  const itemMap = new Map<string, Item>()
  rawItems.forEach(item => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
  const tree: Item[] = []
  rawItems.forEach(item => {
    const node = itemMap.get(item.id)
    if (!node) return
    if (item.parentId) {
      const parent = itemMap.get(item.parentId)
      if (parent) parent.children?.push(node)
    } else {
      tree.push(node)
    }
  })
  return tree
}

/** Depth-first search for an item by id. */
export function findItemById(nodes: Item[], id: string): Item | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const found = findItemById(n.children, id)
      if (found) return found
    }
  }
  return undefined
}

/** Equal split of 100 across `count` siblings, rounded to 1 decimal. */
export function equalWeight(count: number): number {
  return Math.round((100 / count) * 10) / 10
}
