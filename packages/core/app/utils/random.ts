export const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min

export const randomFrom = <T>(items: readonly T[]): T => {
  const item = items[randomInt(0, items.length - 1)]
  if (item === undefined) {
    throw new Error('Cannot select a random item from an empty array')
  }
  return item
}
