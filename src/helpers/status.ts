export enum BookStatus {
  Default = "Default",
  Lent = "Lent",
  Borrowed = "Borrowed",
  LibraryBorrowed = "LibraryBorrowed",
  Wishlist = "Wishlist",
}

export function statusArray(): string[] {
  return Object.values(BookStatus);
}
