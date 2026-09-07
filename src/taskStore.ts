export type Task = {
  id: string
  title: string
  done: boolean
  createdAt: string
}

export type TaskStore = {
  weekStart: string
  tasks: Task[]
}

const STORAGE_KEY = 'task-tracker.v1'
const TASK_TTL_MS = 30 * 24 * 60 * 60 * 1000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function mondayOf(date: Date): Date {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = local.getDay()
  const offset = weekday === 0 ? -6 : 1 - weekday
  local.setDate(local.getDate() + offset)
  return local
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatWeekRange(weekStart: string): string {
  const start = parseIsoDate(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const startLabel = start.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
  const endLabel = end.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

export function emptyStore(now = new Date()): TaskStore {
  return {
    weekStart: toIsoDate(mondayOf(now)),
    tasks: [],
  }
}

export function normalizeStore(store: TaskStore, now = new Date()): TaskStore {
  const cutoff = now.getTime() - TASK_TTL_MS
  const tasks = store.tasks.filter((task) => {
    const created = Date.parse(task.createdAt)
    return !Number.isNaN(created) && created >= cutoff
  })

  const currentWeekStart = toIsoDate(mondayOf(now))
  const storedWeek = ISO_DATE.test(store.weekStart)
    ? parseIsoDate(store.weekStart)
    : null
  const needsRollover =
    storedWeek === null ||
    Number.isNaN(storedWeek.getTime()) ||
    storedWeek.getTime() < parseIsoDate(currentWeekStart).getTime()

  if (needsRollover) {
    return {
      weekStart: currentWeekStart,
      tasks: tasks.filter((task) => !task.done),
    }
  }

  return { weekStart: store.weekStart, tasks }
}

function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false
  const task = value as Record<string, unknown>
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.done === 'boolean' &&
    typeof task.createdAt === 'string'
  )
}

function parseStore(raw: string): TaskStore | null {
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const store = data as Record<string, unknown>
    if (typeof store.weekStart !== 'string' || !Array.isArray(store.tasks)) {
      return null
    }
    return { weekStart: store.weekStart, tasks: store.tasks.filter(isTask) }
  } catch {
    return null
  }
}

export function saveStore(store: TaskStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function loadStore(now = new Date()): TaskStore {
  const raw = localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? parseStore(raw) : null
  const next = normalizeStore(parsed ?? emptyStore(now), now)
  saveStore(next)
  return next
}

export function refreshStore(store: TaskStore, now = new Date()): TaskStore {
  const next = normalizeStore(store, now)
  saveStore(next)
  return next
}

export function addTask(
  store: TaskStore,
  title: string,
  now = new Date(),
): TaskStore {
  const trimmed = title.trim()
  if (!trimmed) return store
  const next: TaskStore = {
    ...store,
    tasks: [
      ...store.tasks,
      {
        id: crypto.randomUUID(),
        title: trimmed,
        done: false,
        createdAt: now.toISOString(),
      },
    ],
  }
  saveStore(next)
  return next
}

export function toggleTask(store: TaskStore, id: string): TaskStore {
  const next: TaskStore = {
    ...store,
    tasks: store.tasks.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task,
    ),
  }
  saveStore(next)
  return next
}

export function deleteTask(store: TaskStore, id: string): TaskStore {
  const next: TaskStore = {
    ...store,
    tasks: store.tasks.filter((task) => task.id !== id),
  }
  saveStore(next)
  return next
}
