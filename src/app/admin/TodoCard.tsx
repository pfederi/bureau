import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Todo } from '@/lib/dashboard/todos'
import TodoList from './TodoList'

const SICHTBAR = 6

/** Liegengebliebenes mit direktem Weg zur Erledigung; dringende Punkte amber. */
export default function TodoCard({ todos }: { todos: Todo[] }) {
  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-base font-semibold">Todos</h2>
          {todos.length > 0 && <div className="text-xs text-muted-foreground">{todos.length} {todos.length === 1 ? 'Punkt' : 'Punkte'}</div>}
        </div>
        {todos.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-400" aria-hidden />Alles erledigt: nichts überfällig, keine alten Entwürfe oder Stunden.
          </p>
        ) : (
          <TodoList todos={todos.slice(0, SICHTBAR)} />
        )}
        {todos.length > SICHTBAR && (
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">und {todos.length - SICHTBAR} weitere</p>
        )}
      </CardContent>
    </Card>
  )
}
