import { hasFiles } from './dragFiles'

test('a drag of files from outside the page carries Files', () => {
  expect(hasFiles({ types: ['Files'] } as unknown as DataTransfer)).toBe(true)
})

test('moving an item inside the page, or no transfer, carries no files', () => {
  expect(hasFiles({ types: ['text/plain'] } as unknown as DataTransfer)).toBe(false)
  expect(hasFiles(null)).toBe(false)
})
