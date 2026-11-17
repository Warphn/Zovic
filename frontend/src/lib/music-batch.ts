// Cadastro de várias músicas de uma vez, como as faixas de um álbum (HU-41). Cada música usa a mesma
// rota do cadastro avulso (POST /api/admin/musics), uma de cada vez.

/** "01 - Nome.mp3", "02. Nome.mp3", "3 Nome.mp3" e "04_Nome.mp3": o número da faixa e o separador. */
const LEADING_TRACK_NUMBER = /^\d{1,3}(?:\s*[-.)_]\s*|\s+)/
const FILE_EXTENSION = /\.[^.]+$/

/** The name the file suggests for the music: without the extension and the leading track number. */
export function musicNameFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(FILE_EXTENSION, "").replaceAll("_", " ").trim()
  const withoutTrackNumber = withoutExtension.replace(LEADING_TRACK_NUMBER, "").trim()
  return withoutTrackNumber || withoutExtension
}

/** Items in track order: by file name, reading the numbers as numbers ("10 - …" after "9 - …"). */
export function sortByFileName<Item>(items: Item[], fileNameOf: (item: Item) => string): Item[] {
  return items.toSorted((first, second) => fileNameOf(first).localeCompare(fileNameOf(second), "pt-BR", { numeric: true }))
}

/** The list with the item at `fromIndex` moved to `toIndex`; unchanged when `toIndex` is out of the list. */
export function moveItem<Item>(items: Item[], fromIndex: number, toIndex: number): Item[] {
  const item = items[fromIndex]
  if (item === undefined || toIndex < 0 || toIndex >= items.length) return items
  return items.toSpliced(fromIndex, 1).toSpliced(toIndex, 0, item)
}

/** The items in the order of `ids`, the order a drag in SortableList hands back. */
export function orderByIds<Item>(items: Item[], ids: string[], idOf: (item: Item) => string): Item[] {
  return items.toSorted((first, second) => ids.indexOf(idOf(first)) - ids.indexOf(idOf(second)))
}

export interface BatchResult {
  createdCount: number
  /** The failure that stopped the batch; null when every music was created. */
  error: unknown
}

/**
 * Creates the musics one at a time, in order. The API makes each one the album's last track, so
 * sending them together would shuffle the tracks. It stops at the first failure: creating the rest
 * would give them the track numbers of the one that failed.
 */
export async function createMusicsInOrder<Input>(
  inputs: Input[],
  create: (input: Input) => Promise<unknown>,
  onCreated?: (input: Input) => void
): Promise<BatchResult> {
  let createdCount = 0
  for (const input of inputs) {
    try {
      await create(input)
    } catch (error) {
      return { createdCount, error }
    }
    createdCount += 1
    onCreated?.(input)
  }
  return { createdCount, error: null }
}
