import { useRef } from 'react'
import { tabListArrowTarget } from '@/lib/a11y'
import { cn } from '@/lib/utils'

export interface TabListItem {
  id: number | null
  label: string
}

interface TabListProps {
  idPrefix: string
  panelId: string
  tabs: TabListItem[]
  activeId: number | null
  onChange: (id: number | null) => void
  wrapperClassName?: string
  dataTour?: string
}

export default function TabList({
  idPrefix,
  panelId,
  tabs,
  activeId,
  onChange,
  wrapperClassName,
  dataTour,
}: TabListProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = tabListArrowTarget(e.key, index, tabs.length)
    if (target === null) return
    e.preventDefault()
    onChange(tabs[target].id)
    tabRefs.current[target]?.focus()
  }

  return (
    <div className={cn('-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', wrapperClassName)}>
      <div role="tablist" data-tour={dataTour} className="flex gap-2 border-b-[1.5px] border-line">
        {tabs.map((tab, index) => {
          const isActive = activeId === tab.id
          const domId = tab.id ?? 'todos'
          return (
            <button
              key={domId}
              ref={(el) => {
                tabRefs.current[index] = el
              }}
              id={`tab-${idPrefix}-${domId}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                'tab-trigger',
                isActive ? 'border-navy-950 text-navy-950' : 'text-ink-soft hover:text-navy-950',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
