import { create } from 'zustand'

export type Item = {
  id: string
  userId: string
  layer: number
  parentId: string | null
  title: string
  description: string | null
  weight: number
  status: string
  completed: boolean
  category: string | null
  startDate: string | null
  endDate: string | null
  theme: string | null
  focusQuestion: string | null
  anchorScripture: string | null
  children?: Item[]
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
  completionMap: Record<string, number>
  completedMap: Record<string, boolean>
  userCategories: UserCategory[]
  
  setItems: (items: Item[]) => void
  setUserCategories: (categories: UserCategory[]) => void
  toggleDeed: (id: string, completed: boolean) => void
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

  toggleDeed: (id, completed) => {
    // Optimistic update
    const newItems = updateItemInTree(get().items, id, { completed })
    set({ items: newItems })
    get().recalculateRollups()
    
    // In a real implementation we would also fire an API call here to persist it.
    fetch(`/api/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed })
    }).catch(console.error)
  },

  recalculateRollups: () => {
    const { items } = get()
    const completionMap: Record<string, number> = {}
    const completedMap: Record<string, boolean> = {}

    // Calculate completions recursively from bottom (layer 5) to top (layer 1)
    const calculateForNode = (node: Item): { completedWeight: number; totalWeight: number; completed: boolean } => {
      let totalW = 0
      let compW = 0
      
      if (node.layer === 5) {
        // Deed layer
        totalW = node.weight || 1
        compW = node.completed ? totalW : 0
        completedMap[node.id] = node.completed
        completionMap[node.id] = node.completed ? 100 : 0
        return { completedWeight: compW, totalWeight: totalW, completed: node.completed }
      }

      // Layers 1-4: Calculate based on children
      const children = node.children || []
      if (children.length === 0) {
        completionMap[node.id] = 0
        completedMap[node.id] = false
        return { completedWeight: 0, totalWeight: 0, completed: false }
      }

      children.forEach(child => {
        const { completedWeight, totalWeight } = calculateForNode(child)
        // If it's a win (layer 4), we sum the weights of deeds
        // If it's a higher layer, we average the completion percentages
        // Actually PRD says:
        // 1. Win completion = sum of deed weights completed / total deed weights
        // 2. Milestone completion = average of win completions
        // 3. Quest completion = average of milestone completions  
        // 4. Why completion = average of quest completions
        if (node.layer === 4) {
          totalW += totalWeight
          compW += completedWeight
        }
      })

      if (node.layer === 4) {
        const pct = totalW > 0 ? (compW / totalW) * 100 : 0
        completionMap[node.id] = pct
        completedMap[node.id] = pct === 100
        return { completedWeight: compW, totalWeight: totalW, completed: pct === 100 }
      } else {
        // Layers 1-3: Average of children completions
        let sumPct = 0
        children.forEach(child => {
          sumPct += completionMap[child.id] || 0
        })
        const pct = children.length > 0 ? sumPct / children.length : 0
        completionMap[node.id] = pct
        completedMap[node.id] = pct === 100
        return { completedWeight: 0, totalWeight: 0, completed: pct === 100 }
      }
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
