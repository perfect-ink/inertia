// Whether a drag carries files from outside the page (not an item being moved inside it).
export const hasFiles = (transfer: DataTransfer | null) => !!transfer && Array.from(transfer.types).includes('Files')
