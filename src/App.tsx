import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  addSubtask,
  addTask,
  deleteSubtask,
  deleteTask,
  formatWeekRange,
  groupTasksForList,
  loadStore,
  openTaskCount,
  refreshStore,
  taskOriginLabel,
  toggleSubtask,
  toggleTask,
  type Task,
  type TaskStore,
} from './taskStore'
import './App.css'

type Filter = 'all' | 'active' | 'done'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
]

function visibleTasks(tasks: Task[], filter: Filter): Task[] {
  if (filter === 'active') return tasks.filter((task) => !task.done)
  if (filter === 'done') return tasks.filter((task) => task.done)
  return tasks
}

function emptyMessage(taskCount: number, filter: Filter): string {
  if (taskCount === 0) return 'No tasks this week.'
  if (filter === 'active') return 'No active tasks.'
  if (filter === 'done') return 'No completed tasks.'
  return 'No tasks this week.'
}

function DayGroup({
  id,
  label,
  remaining,
  open,
  onToggle,
  children,
}: {
  id: string
  label: string
  remaining: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <li className="day-group">
      <button
        type="button"
        className="day-toggle"
        aria-expanded={open}
        aria-controls={`day-${id}`}
        onClick={onToggle}
      >
        <span className="day-label">{label}</span>
        <span className="origin">{remaining} left</span>
      </button>
      {open ? (
        <ul id={`day-${id}`} className="day-tasks">
          {children}
        </ul>
      ) : null}
    </li>
  )
}

function TaskItem({
  task,
  weekStart,
  showOrigin,
  onToggle,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: {
  task: Task
  weekStart: string
  showOrigin: boolean
  onToggle: () => void
  onDelete: () => void
  onAddSubtask: (title: string) => void
  onToggleSubtask: (subtaskId: string) => void
  onDeleteSubtask: (subtaskId: string) => void
}) {
  const [open, setOpen] = useState(task.subtasks.length > 0)
  const [itemTitle, setItemTitle] = useState('')
  const doneCount = task.subtasks.filter((item) => item.done).length
  const itemLabel =
    task.subtasks.length === 0
      ? 'Items'
      : `Items ${doneCount}/${task.subtasks.length}`

  function onAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onAddSubtask(itemTitle)
    setItemTitle('')
    setOpen(true)
  }

  return (
    <li className={task.done ? 'done' : undefined}>
      <div className="task-row">
        <label>
          <input type="checkbox" checked={task.done} onChange={onToggle} />
          <span className="task-copy">
            <span className="task-title">{task.title}</span>
            {showOrigin ? (
              <span className="origin">
                {taskOriginLabel(task.createdAt, weekStart)}
              </span>
            ) : null}
          </span>
        </label>
        <div className="task-actions">
          <button
            type="button"
            className="items-toggle"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {itemLabel}
          </button>
          <button type="button" className="delete" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      {open ? (
        <div className="subtasks">
          {task.subtasks.length === 0 ? (
            <p className="subtasks-empty">Add items for this task.</p>
          ) : (
            <ul>
              {task.subtasks.map((item) => (
                <li key={item.id} className={item.done ? 'done' : undefined}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => onToggleSubtask(item.id)}
                    />
                    <span className="task-title">{item.title}</span>
                  </label>
                  <button
                    type="button"
                    className="delete"
                    onClick={() => onDeleteSubtask(item.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="item-composer" onSubmit={onAddItem}>
            <label className="sr-only" htmlFor={`item-${task.id}`}>
              New item
            </label>
            <input
              id={`item-${task.id}`}
              value={itemTitle}
              onChange={(event) => setItemTitle(event.target.value)}
              placeholder="Add an item"
              autoComplete="off"
            />
            <button type="submit">Add</button>
          </form>
        </div>
      ) : null}
    </li>
  )
}

export default function App() {
  const [store, setStore] = useState<TaskStore>(() => loadStore())
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openGroups, setOpenGroups] = useState<Readonly<Record<string, boolean>>>(
    {},
  )

  useEffect(() => {
    const applyRollover = () => {
      setStore((current) => refreshStore(current))
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') applyRollover()
    }
    window.addEventListener('focus', applyRollover)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', applyRollover)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const sections = useMemo(
    () => groupTasksForList(store.tasks, store.weekStart),
    [store.tasks, store.weekStart],
  )

  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          section,
          visible: visibleTasks(section.tasks, filter),
        }))
        .filter((item) => item.visible.length > 0),
    [sections, filter],
  )

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStore((current) => addTask(current, title))
    setTitle('')
  }

  function toggleGroup(id: string) {
    setOpenGroups((current) => ({ ...current, [id]: !current[id] }))
  }

  function renderTask(task: Task, showOrigin: boolean) {
    return (
      <TaskItem
        key={task.id}
        task={task}
        weekStart={store.weekStart}
        showOrigin={showOrigin}
        onToggle={() => setStore((current) => toggleTask(current, task.id))}
        onDelete={() => setStore((current) => deleteTask(current, task.id))}
        onAddSubtask={(itemTitle) =>
          setStore((current) => addSubtask(current, task.id, itemTitle))
        }
        onToggleSubtask={(subtaskId) =>
          setStore((current) => toggleSubtask(current, task.id, subtaskId))
        }
        onDeleteSubtask={(subtaskId) =>
          setStore((current) => deleteSubtask(current, task.id, subtaskId))
        }
      />
    )
  }

  return (
    <main className="app">
      <header className="header">
        <h1>Task tracker</h1>
        <p className="week">{formatWeekRange(store.weekStart)}</p>
      </header>

      <form className="composer" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="task-title">
          New task
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task"
          autoComplete="off"
          enterKeyHint="done"
        />
        <button type="submit">Add</button>
      </form>

      <div className="filters" role="group" aria-label="Filter tasks">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visibleSections.length === 0 ? (
        <p className="empty">{emptyMessage(store.tasks.length, filter)}</p>
      ) : (
        <ul className="tasks">
          {visibleSections.flatMap(({ section, visible }) => {
            switch (section.kind) {
              case 'today':
                return visible.map((task) => renderTask(task, true))
              case 'earlier':
              case 'pastDay': {
                const groupId =
                  section.kind === 'earlier' ? 'earlier' : section.date
                const label =
                  section.kind === 'earlier' ? 'Earlier' : section.label
                const showOrigin = section.kind === 'earlier'
                return [
                  <DayGroup
                    key={groupId}
                    id={groupId}
                    label={label}
                    remaining={openTaskCount(section.tasks)}
                    open={Boolean(openGroups[groupId])}
                    onToggle={() => toggleGroup(groupId)}
                  >
                    {visible.map((task) => renderTask(task, showOrigin))}
                  </DayGroup>,
                ]
              }
              default: {
                const _exhaustive: never = section
                return _exhaustive
              }
            }
          })}
        </ul>
      )}
    </main>
  )
}
