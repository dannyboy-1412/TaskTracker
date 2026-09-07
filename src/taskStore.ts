export type Subtask = {
  id: string
  title: string
  done: boolean
}

export type Task = {
  id: string
  title: string
  done: boolean
  createdAt: string
  subtasks: Subtask[]
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

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

export function taskOriginLabel(createdAt: string, weekStart: string): string {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return ''
  const createdWeek = mondayOf(created).getTime()
  const currentWeek = parseIsoDate(weekStart).getTime()
  const weeksAgo = Math.round((currentWeek - createdWeek) / MS_PER_WEEK)
  if (weeksAgo <= 0) {
    return created.toLocaleDateString('en-GB', { weekday: 'long' })
  }
  if (weeksAgo === 1) return 'last week'
  return `${weeksAgo} weeks before`
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

export type TaskListSection =
  | { kind: 'earlier'; tasks: Task[] }
  | { kind: 'pastDay'; date: string; label: string; tasks: Task[] }
  | { kind: 'today'; tasks: Task[] }

export function openTaskCount(tasks: Task[]): number {
  return tasks.filter((task) => !task.done).length
}

function weekdayLabel(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString('en-GB', { weekday: 'long' })
}

export function groupTasksForList(
  tasks: Task[],
  weekStart: string,
  now = new Date(),
): TaskListSection[] {
  const today = toIsoDate(now)
  const earlier: Task[] = []
  const todayTasks: Task[] = []
  const pastByDate = new Map<string, Task[]>()

  for (const task of tasks) {
    const date = toIsoDate(new Date(task.createdAt))
    if (date < weekStart) {
      earlier.push(task)
      continue
    }
    if (date >= today) {
      todayTasks.push(task)
      continue
    }
    const existing = pastByDate.get(date)
    if (existing) {
      existing.push(task)
    } else {
      pastByDate.set(date, [task])
    }
  }

  const sections: TaskListSection[] = []
  if (earlier.length > 0) {
    sections.push({ kind: 'earlier', tasks: earlier })
  }
  const pastDays = [...pastByDate.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )
  for (const [date, dayTasks] of pastDays) {
    sections.push({
      kind: 'pastDay',
      date,
      label: weekdayLabel(date),
      tasks: dayTasks,
    })
  }
  if (todayTasks.length > 0) {
    sections.push({ kind: 'today', tasks: todayTasks })
  }
  return sections
}

export function emptyStore(now = new Date()): TaskStore {
  return {
    weekStart: toIsoDate(mondayOf(now)),
    tasks: [],
  }
}

export function normalizeStore(store: TaskStore, now = new Date()): TaskStore {
  const cutoff = now.getTime() - TASK_TTL_MS
  const tasks = store.tasks
    .map((task) => ({ ...task, subtasks: task.subtasks ?? [] }))
    .filter((task) => {
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

function isSubtask(value: unknown): value is Subtask {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.done === 'boolean'
  )
}

function parseTask(value: unknown): Task | null {
  if (typeof value !== 'object' || value === null) return null
  const task = value as Record<string, unknown>
  if (
    typeof task.id !== 'string' ||
    typeof task.title !== 'string' ||
    typeof task.done !== 'boolean' ||
    typeof task.createdAt !== 'string'
  ) {
    return null
  }
  return {
    id: task.id,
    title: task.title,
    done: task.done,
    createdAt: task.createdAt,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.filter(isSubtask) : [],
  }
}

function parseStore(raw: string): TaskStore | null {
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const store = data as Record<string, unknown>
    if (typeof store.weekStart !== 'string' || !Array.isArray(store.tasks)) {
      return null
    }
    return {
      weekStart: store.weekStart,
      tasks: store.tasks
        .map(parseTask)
        .filter((task): task is Task => task !== null),
    }
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
        subtasks: [],
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

function updateTask(
  store: TaskStore,
  taskId: string,
  update: (task: Task) => Task,
): TaskStore {
  const next: TaskStore = {
    ...store,
    tasks: store.tasks.map((task) => (task.id === taskId ? update(task) : task)),
  }
  saveStore(next)
  return next
}

export function addSubtask(store: TaskStore, taskId: string, title: string): TaskStore {
  const trimmed = title.trim()
  if (!trimmed) return store
  return updateTask(store, taskId, (task) => ({
    ...task,
    subtasks: [
      ...task.subtasks,
      { id: crypto.randomUUID(), title: trimmed, done: false },
    ],
  }))
}

export function toggleSubtask(
  store: TaskStore,
  taskId: string,
  subtaskId: string,
): TaskStore {
  return updateTask(store, taskId, (task) => ({
    ...task,
    subtasks: task.subtasks.map((item) =>
      item.id === subtaskId ? { ...item, done: !item.done } : item,
    ),
  }))
}

export function deleteSubtask(
  store: TaskStore,
  taskId: string,
  subtaskId: string,
): TaskStore {
  return updateTask(store, taskId, (task) => ({
    ...task,
    subtasks: task.subtasks.filter((item) => item.id !== subtaskId),
  }))
}
