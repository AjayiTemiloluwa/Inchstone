import { create } from 'zustand'

export type Item = {
  id: string
  userId: string
  layer: number // 0: Year, 1: Category, 2: Yearly, 3: Quarterly, 4: Monthly, 5: Weekly, 6: Daily
  parentId: string | null
  title: string
  description: string | null
  weight: number
  status: string
  completed: boolean
  progress: number // 0-100
  scoreMode?: string // 'auto' | 'manual'
  category: string | null // Legacy
  startDate: string | null
  endDate: string | null
  isRecurring: boolean
  recurrencePattern: string | null
  recurrenceEnd: string | null
  theme: string | null
  focusQuestion: string | null
  anchorScripture: string | null
  reflection: string | null
  children?: Item[]
  tasks?: Task[]
}

export type Task = {
  id: string
  userId: string
  goalId: string
  categoryId: string | null
  title: string
  weight: number
  progress: number // 0-100
  completed: boolean
  date: string
  startTime: string | null
  endTime: string | null
  scheduledTime: string | null
  estimatedDuration: number | null
  actualDuration: number | null
  priority: string | null
  isFrog: boolean
  isHabit: boolean
  isRecurring: boolean
  recurrencePattern: string | null
  recurrenceEnd: string | null
  color: string | null
  reflection: string | null
}

type HierarchyState = {
  items: Item[]
  completionMap: Record<string, number> // 0-100 weighted completion
  completedMap: Record<string, boolean>

  setItems: (items: Item[]) => void
  updateItem: (id: string, updates: Partial<Item>) => void
  updateTask: (goalId: string, taskId: string, updates: Partial<Task>) => void
  recalculateRollups: () => void
  getFlatItems: () => Item[]
  updateItemScoreMode: (id: string, mode: 'auto' | 'manual', score?: number) => Promise<void>
}

export const useHierarchyStore = create<HierarchyState>((set, get) => ({
  items: [],
  completionMap: {},
  completedMap: {},

  getFlatItems: () => {
    const result: Item[] = []
    const traverse = (nodes: Item[]) => {
      nodes.forEach(n => {
        result.push(n)
        if (n.children) traverse(n.children)
      })
    }
    traverse(get().items)
    return result
  },

  setItems: (items) => {
    set({ items })
    get().recalculateRollups()
  },

  updateItem: (id, updates) => {
    const newItems = updateItemInTree(get().items, id, updates)
    set({ items: newItems })
    get().recalculateRollups()

    fetch(`/api/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(console.error)
  },

  updateTask: (goalId, taskId, updates) => {
    const newItems = updateTaskInTree(get().items, goalId, taskId, updates)
    set({ items: newItems })
    get().recalculateRollups()

    fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(console.error)
  },

  updateItemScoreMode: async (id, mode, score) => {
    const body = mode === 'manual'
      ? JSON.stringify({ mode: 'manual', score: score || 0 })
      : JSON.stringify({ mode: 'auto' })

    await fetch(`/api/items/${id}/score`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body
    })

    // Refresh items to get updated data
    const res = await fetch('/api/items')
    const data = await res.json()
    if (data.items) {
      const itemMap = new Map()
      data.items.forEach((item: any) => itemMap.set(item.id, { ...item, children: [], tasks: item.tasks || [] }))
      const tree: any[] = []
      data.items.forEach((item: any) => {
        if (item.parentId) { const parent = itemMap.get(item.parentId); if (parent) parent.children.push(itemMap.get(item.id)) }
        else { tree.push(itemMap.get(item.id)) }
      })
      set({ items: tree })
    }
  },

  recalculateRollups: () => {
    const { items } = get()
    const completionMap: Record<string, number> = {}
    const completedMap: Record<string, boolean> = {}

    // Tasks are mapped to their goalId directly now.

    const calculateForNode = (node: Item): { earnedScore: number; totalWeight: number } => {
      const children = node.children || []
      const tasks = node.tasks || []

      let earnedScore = 0
      let totalWeight = 0

      // If it has tasks directly linked
      if (tasks.length > 0) {
        tasks.forEach(t => {
          totalWeight += t.weight
          earnedScore += t.completed ? t.weight : (t.progress / 100) * t.weight
        })
      }

      // Layer children
      if (children.length > 0) {
        children.forEach(child => {
          const childResult = calculateForNode(child)
          totalWeight += child.weight
          // child progress acts as the percentage completion of its weight
          const childProgress = childResult.totalWeight > 0
            ? (childResult.earnedScore / childResult.totalWeight)
            : (completionMap[child.id] || 0) / 100
          earnedScore += childProgress * child.weight
        })
      }

      let pct = node.progress || 0

      if (totalWeight > 0) {
        pct = (earnedScore / totalWeight) * 100
      } else if (node.completed) {
        pct = 100
      }

      completionMap[node.id] = pct
      completedMap[node.id] = pct >= 100

      // The node's internal state doesn't instantly dictate what we pass up,
      // but rather we calculate what this node earned and its total weight
      // wait, the parent just looks at this node's weight and completion pct.
      // So returning earnedScore and totalWeight isn't really needed for the parent to read,
      // the parent recalculates based on its children's completionMap percentage.

      return { earnedScore, totalWeight }
    }

    items.forEach(item => calculateForNode(item))
    set({ completionMap, completedMap })
  }
}))

// Helper to immutably update a nested node
function updateItemInTree(nodes: Item[], id: string, updates: Partial<Item>): Item[] {
  return nodes.map(node => {
    if (node.id === id) {
      return { ...node, ...updates }
    }
    if (node.children) {
      return { ...node, children: updateItemInTree(node.children, id, updates) }
    }
    return node
  })
}

// Helper to immutably update a task within a goal
function updateTaskInTree(nodes: Item[], goalId: string, taskId: string, updates: Partial<Task>): Item[] {
  return nodes.map(node => {
    if (node.id === goalId && node.tasks) {
      return {
        ...node,
        tasks: node.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
      }
    }
    if (node.children) {
      return { ...node, children: updateTaskInTree(node.children, goalId, taskId, updates) }
    }
    return node
  })
}
