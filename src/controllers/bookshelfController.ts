import { Response, NextFunction, RequestHandler } from "express";
import proxy from "express-http-proxy";
import { Request as JWTRequest } from "express-jwt";
import https from "https";
import Book from "../models/book.js";
import BookInfo from "../models/bookInfo.js";
import createHttpError from "http-errors";
import debug from "debug";
import {
  dateValidator,
  keyValidator,
  otherNameValidator,
  sortValidator,
  statusFilterValidator,
  statusValidator,
} from "../middlewares/bookValidators.js";
import { BookStatus } from "../helpers/status.js";
import { validationResult } from "express-validator";
import { queryParamToNumber, stringMatches } from "../helpers/utils.js";

const OL_BASE_URL = "https://openlibrary.org";
interface BookData {
  author_name?: string[];
  title: string;
  key: string;
}
const log = debug("my-bookshelf-backend:olRequest");

export const bookshelf_get: RequestHandler[] = [
  statusFilterValidator,
  sortValidator("owner_sort"),
  sortValidator("title_sort"),
  async (req: JWTRequest, res: Response, next: NextFunction) => {
    const result = validationResult(req);
    if (!result.isEmpty())
      return res.status(400).json(
        createHttpError(400, "Invalid query parameters", {
          errors: result.array(),
        })
      );

    try {
      if (!req.auth || req.auth.id === undefined)
        return res.status(401).json(createHttpError(401));

      const pageNumber = queryParamToNumber(
        req.query.page,
        1,
        (page) => page > 0
      );
      const pageLimit = queryParamToNumber(
        req.query.limit,
        20,
        (limit) => limit > 0
      );

      const books = await BookInfo.find(
        { owner: req.auth.id },
        "book status other_name date"
      )
        .populate<{ book: { title: string; author: string[] | undefined } }>({
          path: "book",
          select: "title author",
        })
        .exec();

      const booksWithData = books
        .map((bookInfo) => ({
          title: bookInfo.book.title,
          author: bookInfo.book.author,
          status: bookInfo.status,
          full_status: bookInfo.full_status,
          owner_name: bookInfo.owner_name,
        }))
        .filter((book) => {
          let isValid: boolean = true;
          const status = req.query.status as string | undefined;
          if (status) {
            const statuses = status.split(",");
            isValid =
              statuses.length === 0 ||
              statuses.some((st) => st === book.status.toLowerCase());
          }
          const owner = req.query.owner as string | undefined;
          if (owner) isValid = isValid && stringMatches(book.owner_name, owner);
          const title = req.query.title as string | undefined;
          if (title) isValid = isValid && stringMatches(book.title, title);
          const author = req.query.author as string | undefined;
          if (author)
            isValid =
              isValid &&
              Boolean(book.author?.some((auth) => stringMatches(auth, author)));
          return isValid;
        });

      if (req.query.owner_sort) {
        if (req.query.owner_sort === "asc")
          booksWithData.sort((a, b) =>
            a.owner_name.localeCompare(b.owner_name)
          );
        else if (req.query.owner_sort === "desc")
          booksWithData.sort((a, b) =>
            b.owner_name.localeCompare(a.owner_name)
          );
      }
      if (req.query.title_sort) {
        if (req.query.title_sort === "asc")
          booksWithData.sort((a, b) => a.title.localeCompare(b.title));
        else if (req.query.title_sort === "desc")
          booksWithData.sort((a, b) => b.title.localeCompare(a.title));
      }

      const lastPageIndex =
        booksWithData.length % pageLimit > 0
          ? Math.floor(booksWithData.length / pageLimit)
          : Math.floor(booksWithData.length / pageLimit) - 1;
      const pageIndex =
        (pageNumber - 1) * pageLimit < booksWithData.length
          ? pageNumber - 1
          : lastPageIndex;
      const page = booksWithData.slice(
        pageIndex * pageLimit,
        (pageIndex + 1) * pageLimit <= booksWithData.length
          ? (pageIndex + 1) * pageLimit
          : undefined
      );
      res.status(200).json({
        books: page,
        page: pageIndex + 1,
        last_page: lastPageIndex + 1,
      });
    } catch (err) {
      next(err);
    }
  },
];

export const bookshelf_add: RequestHandler[] = [
  keyValidator,
  statusValidator,
  otherNameValidator,
  dateValidator,
  async (req: JWTRequest, res: Response, next: NextFunction) => {
    const result = validationResult(req);
    if (!result.isEmpty())
      return res.status(400).json(
        createHttpError(400, "Invalid field values", {
          errors: result.array(),
        })
      );

    const { book_key, status, other_name, date } = req.body;

    try {
      if (!req.auth || req.auth.id === undefined)
        return res.status(401).json(createHttpError(401));

      const searchKey = stripBookKey(book_key);
      let book = await Book.findOne({ key: searchKey }).exec();
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
        owner: req.auth.id,
        book: book._id,
        status,
        other_name: status === BookStatus.Default ? undefined : other_name,
        date: status === BookStatus.Default ? undefined : date,
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
