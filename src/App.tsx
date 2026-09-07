import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addSubtask,
  addTask,
  deleteSubtask,
  deleteTask,
  formatWeekRange,
  loadStore,
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

function TaskItem({
  task,
  weekStart,
  onToggle,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: {
  task: Task
  weekStart: string
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
            <span className="origin">
              {taskOriginLabel(task.createdAt, weekStart)}
            </span>
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

  const shown = useMemo(
    () => visibleTasks(store.tasks, filter),
    [store.tasks, filter],
  )

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStore((current) => addTask(current, title))
    setTitle('')
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

      {shown.length === 0 ? (
        <p className="empty">{emptyMessage(store.tasks.length, filter)}</p>
      ) : (
        <ul className="tasks">
          {shown.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              weekStart={store.weekStart}
              onToggle={() =>
                setStore((current) => toggleTask(current, task.id))
              }
              onDelete={() =>
                setStore((current) => deleteTask(current, task.id))
              }
              onAddSubtask={(itemTitle) =>
                setStore((current) => addSubtask(current, task.id, itemTitle))
              }
              onToggleSubtask={(subtaskId) =>
                setStore((current) =>
                  toggleSubtask(current, task.id, subtaskId),
                )
              }
              onDeleteSubtask={(subtaskId) =>
                setStore((current) =>
                  deleteSubtask(current, task.id, subtaskId),
                )
              }
            />
          ))}
        </ul>
      )}
    </main>
  )
}
