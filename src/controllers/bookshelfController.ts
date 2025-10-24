import { Response, NextFunction, RequestHandler } from "express";
import proxy from "express-http-proxy";
import { Request as JWTRequest } from "express-jwt";
import https from "https";
import Book from "../models/book.js";
import BookInfo from "../models/bookInfo.js";
import User from "../models/user.js";
import createHttpError from "http-errors";
import debug from "debug";

const OL_BASE_URL = "https://openlibrary.org";
interface BookData {
  author_name?: string[];
  title: string;
  key: string;
}
const log = debug("my-bookshelf-backend:olRequest");

export const bookshelf_get = async (
  req: JWTRequest,
  res: Response,
  next: NextFunction
) => {
  res.json({ message: "bookshelf get" });
};

export const bookshelf_add: RequestHandler[] = [
  async (req: JWTRequest, res: Response, next: NextFunction) => {
    const { book_key, status, other_name, date } = req.body;

    try {
      if (!req.auth || req.auth.id === undefined)
        return res.status(401).json(createHttpError(401));
      const user = await User.findById(req.auth.id);
      if (!user) return res.status(401).json(createHttpError(401));

      const searchKey = stripBookKey(book_key);
      let book = await Book.findOne({ key: searchKey });
      if (!book) {
        const bookData = await get_book(searchKey);
        book = new Book({
          key: stripBookKey(bookData.key),
          title: bookData.title,
          author: bookData.author_name,
        });
        await book.save();
      }

      const bookInfo = new BookInfo({
        owner: user._id,
        book: book._id,
        other_name,
        status,
        date,
      });
      await bookInfo.save();
      await bookInfo.populate("book");
      return res.status(201).json(bookInfo);
    } catch (err) {
      next(err);
    }
  },
];

function stripBookKey(bookKey: string): string {
  return bookKey.replace(/^(\/works\/)/, "");
}

function get_book(bookKey: string) {
  return new Promise<BookData>((resolve, reject) => {
    https
      .get(`${OL_BASE_URL}${getSearchQuery(bookKey)}`, (res) => {
        log(`GET ${OL_BASE_URL}${getSearchQuery(bookKey)} ${res.statusCode}`);
        let data: any[] = [];

        if (!res.statusCode || res.statusCode >= 400) {
          res.resume();
          return reject(createHttpError(res.statusCode ?? 500));
        }

        res.on("data", (chunk) => {
          data.push(chunk);
        });

        res.on("end", () => {
          try {
            const { docs: bookList }: { docs: BookData[] } = JSON.parse(
              Buffer.concat(data).toString()
            );
            const book = bookList.find(
              (book) => book.key === `/works/${bookKey}`
            );
            if (!book)
              return reject(
                createHttpError(400, "Invalid book key", { book_key: bookKey })
              );
            resolve(book);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

export const bookshelf_search = proxy(OL_BASE_URL, {
  proxyReqPathResolver: function (req) {
    return getSearchQuery(req.query.q);
  },
  filter: function (req) {
    return req.method === "GET";
  },
});

function getSearchQuery(query: any): string {
  let q;
  if (!query) q = "";
  else q = query as string;
  return `/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name`;
}

export const bookshelf_update_book: RequestHandler[] = [
  async (req: JWTRequest, res: Response, next: NextFunction) => {
    res.json({ message: "bookshelf update book" });
  },
];

export const bookshelf_delete_book: RequestHandler = async (
  req: JWTRequest,
  res: Response,
  next: NextFunction
) => {
  res.json({ message: "bookshelf delete book" });
};
