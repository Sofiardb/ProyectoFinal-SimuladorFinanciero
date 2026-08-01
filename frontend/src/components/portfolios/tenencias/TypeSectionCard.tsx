import type { ReactNode } from 'react'

export default function TypeSectionCard({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>
}
