/**
 * Suggest checkpoint labels for a book: groups of chapters, then "Ending".
 *
 *   suggestCheckpoints(10, 2) → Chapters 1-2, 3-4, 5-6, 7-8, 9-10, Ending
 *   suggestCheckpoints(7, 3)  → Chapters 1-3, 4-6, Chapter 7, Ending
 *
 * Owners can rename, add or remove checkpoints before saving.
 */
export function suggestCheckpoints(chapterCount: number, chaptersPerCheckpoint = 2): string[] {
  const chapters = Math.max(0, Math.floor(chapterCount))
  const size = Math.max(1, Math.floor(chaptersPerCheckpoint))
  const labels: string[] = []
  for (let start = 1; start <= chapters; start += size) {
    const end = Math.min(start + size - 1, chapters)
    labels.push(start === end ? `Chapter ${start}` : `Chapters ${start}-${end}`)
  }
  labels.push('Ending')
  return labels
}
