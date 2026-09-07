import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addTask,
  deleteTask,
  formatWeekRange,
  loadStore,
  refreshStore,
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
            <li key={task.id} className={task.done ? 'done' : undefined}>
              <label>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() =>
                    setStore((current) => toggleTask(current, task.id))
                  }
                />
                <span>{task.title}</span>
              </label>
              <button
                type="button"
                className="delete"
                onClick={() =>
                  setStore((current) => deleteTask(current, task.id))
                }
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
