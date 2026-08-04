export function tabListArrowTarget(key: string, currentIndex: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (currentIndex + 1) % count
    case 'ArrowLeft':
      return (currentIndex - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
