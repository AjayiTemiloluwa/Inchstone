import { create } from 'zustand'

export type Item = {
  id: string
  userId: string
  layer: number // 1: Yearly, 2: Quarterly, 3: Monthly, 4: Weekly, 5: Daily
  parentId: string | null
  title: string
  description: string | null
  weight: number
  status: string
  completed: boolean
  progress: number // 0-100
  category: string | null
  startDate: string | null
  endDate: string | null
  isRecurring: boolean
  recurrencePattern: string | null
  recurrenceEnd: string | null
  theme: string | null
  focusQuestion: string | null
  anchorScripture: string | null
  children?: Item[]
  tasks?: Task[]
}

export type Task = {
  id: string
  userId: string
  deedId: string
  itemId: string | null
  title: string
  weight: number
  progress: number // 0-100
  completed: boolean
  date: string
  startTime: string | null
  endTime: string | null
  scheduledTime: string | null
  isRecurring: boolean
  recurrencePattern: string | null
  recurrenceEnd: string | null
}

export type UserCategory = {
  id: string
  userId: string
  name: string
  color: string
  icon: string
}

type HierarchyState = {
  items: Item[]
  completionMap: Record<string, number> // 0-100 weighted completion
  completedMap: Record<string, boolean>
  userCategories: UserCategory[]

  setItems: (items: Item[]) => void
  setUserCategories: (categories: UserCategory[]) => void
  updateItem: (id: string, updates: Partial<Item>) => void
  updateTask: (deedId: string, taskId: string, updates: Partial<Task>) => void
  recalculateRollups: () => void
}

export const useHierarchyStore = create<HierarchyState>((set, get) => ({
  items: [],
  completionMap: {},
  completedMap: {},
  userCategories: [],

  setItems: (items) => {
    set({ items })
    get().recalculateRollups()
  },

  setUserCategories: (userCategories) => set({ userCategories }),

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

  updateTask: (deedId, taskId, updates) => {
    const newItems = updateTaskInTree(get().items, deedId, taskId, updates)
    set({ items: newItems })
    get().recalculateRollups()

    fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(console.error)
  },

  recalculateRollups: () => {
    const { items } = get()
    const completionMap: Record<string, number> = {}
    const completedMap: Record<string, boolean> = {}
    // Map of tasks by itemId for any-level linking
    const tasksByItemId: Record<string, Task[]> = {}
    const collectAllTasks = (nodes: Item[]) => {
      nodes.forEach(n => {
        if (n.tasks) n.tasks.forEach(t => {
          if (t.itemId) {
            if (!tasksByItemId[t.itemId]) tasksByItemId[t.itemId] = []
            tasksByItemId[t.itemId].push(t)
          }
        })
        if (n.children) collectAllTasks(n.children)
      })
    }
    collectAllTasks(items)

    const calculateForNode = (node: Item): { weightedScore: number; totalWeight: number } => {
      const children = node.children || []
      const directTasks = node.tasks || []
      const linkedTasks = tasksByItemId[node.id] || []
      const allTasks = [...directTasks, ...linkedTasks]

      // Any node with tasks: score = weighted avg of its tasks
      if (allTasks.length > 0) {
        const totalTaskWeight = allTasks.reduce((sum, t) => sum + t.weight, 0)
        const weightedSum = allTasks.reduce((sum, t) => sum + (t.progress * t.weight), 0)
        const score = totalTaskWeight > 0 ? (weightedSum / totalTaskWeight) : 0
        completionMap[node.id] = score
        completedMap[node.id] = score >= 100
        return { weightedScore: score * (node.weight || 1), totalWeight: node.weight || 1 }
      }

      // Leaf nodes (no children)
      if (children.length === 0) {
        const pct = node.progress || 0
        completionMap[node.id] = pct
        completedMap[node.id] = pct >= 100
        return { weightedScore: pct * (node.weight || 1), totalWeight: node.weight || 1 }
      }

      // Layers 1-5: weighted avg of children
      let totalWeightedScore = 0
      let totalChildWeight = 0
      children.forEach(child => {
        const { weightedScore, totalWeight } = calculateForNode(child)
        totalWeightedScore += weightedScore
        totalChildWeight += totalWeight
      })

      const pct = totalChildWeight > 0 ? (totalWeightedScore / totalChildWeight) : 0
      completionMap[node.id] = pct
      completedMap[node.id] = pct >= 100
      return { weightedScore: pct * (node.weight || 1), totalWeight: node.weight || 1 }
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

// Helper to immutably update a task within a deed
function updateTaskInTree(nodes: Item[], deedId: string, taskId: string, updates: Partial<Task>): Item[] {
  return nodes.map(node => {
    if (node.id === deedId && node.tasks) {
      return {
        ...node,
        tasks: node.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
      }
    }
    if (node.children) {
      return { ...node, children: updateTaskInTree(node.children, deedId, taskId, updates) }
    }
    return node
  })
}