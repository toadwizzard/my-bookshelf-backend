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
import mongoose from "mongoose";

const OL_BASE_URL = "https://openlibrary.org";
interface BookData {
  author_name?: string[];
  title: string;
  key: string;
}
const log = debug("my-bookshelf-backend:olRequest");

export const bookshelf_get = (isWishlist: boolean): RequestHandler[] => [
  statusFilterValidator(isWishlist),
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
        {
          owner: req.auth.id,
          status: isWishlist
            ? BookStatus.Wishlist
            : { $ne: BookStatus.Wishlist },
        },
        `book${isWishlist ? "" : " status other_name date"}`
      )
        .populate<{
          book: { title: string; author: string[] | undefined; key: string };
        }>({
          path: "book",
          select: "title author key",
        })
        .exec();

      const booksWithData = books
        .map((bookInfo) => ({
          id: bookInfo._id,
          title: bookInfo.book.title,
          author: bookInfo.book.author,
          status: bookInfo.status,
          full_status: bookInfo.full_status,
          owner_name: bookInfo.owner_name,
        }))
        .filter((book) => {
          let isValid: boolean = true;
          const status = req.query.status as string | undefined;
          if (!isWishlist && status) {
            const statuses = status.split(",");
            isValid =
              statuses.length === 0 ||
              statuses.some(
                (st) => st.toLowerCase() === book.status.toLowerCase()
              );
          }
          const owner = req.query.owner as string | undefined;
          if (!isWishlist && owner)
            isValid = isValid && stringMatches(book.owner_name, owner);
          const title = req.query.title as string | undefined;
          if (title) isValid = isValid && stringMatches(book.title, title);
          const author = req.query.author as string | undefined;
          if (author)
            isValid =
              isValid &&
              Boolean(book.author?.some((auth) => stringMatches(auth, author)));
          return isValid;
        });

      if (!isWishlist && req.query.owner_sort) {
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

export const bookshelf_get_book = (isWishlist: boolean): RequestHandler => {
  return async (req: JWTRequest, res: Response, next: NextFunction) => {
    if (!req.auth || req.auth.id === undefined)
      return res.status(401).json(createHttpError(401));
    try {
      if (!mongoose.isObjectIdOrHexString(req.params.id)) {
        return res.status(404).json(createHttpError(404, "Book not found"));
      }
      const book = await BookInfo.findById(req.params.id)
        .populate<{
          book: { title: string; author: string[] | undefined; key: string };
        }>({
          path: "book",
          select: "title author key",
        })
        .exec();
      if (!book || (isWishlist && book.status !== BookStatus.Wishlist))
        return res.status(404).json(createHttpError(404, "Book not found"));
      if (book.owner.toString() !== req.auth.id)
        return res
          .status(401)
          .json(
            createHttpError(401, "User does not have permission to delete book")
          );
      return res.status(200).json({
        id: book._id,
        status: book.status,
        book_key: book.book.key,
        title: book.book.title,
        author: book.book.author,
        other_name: book.other_name,
        date: book.date,
      });
    } catch (err) {
      next(err);
    }
  };
};

export const bookshelf_add = (isWishlist: boolean): RequestHandler[] => [
  keyValidator,
  statusValidator(isWishlist),
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
        status: isWishlist ? BookStatus.Wishlist : status,
        other_name:
          isWishlist || status === BookStatus.Default ? undefined : other_name,
        date: isWishlist || status === BookStatus.Default ? undefined : date,
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

export const bookshelf_update_book = (
  isWishlist: boolean
): RequestHandler[] => [
  keyValidator,
  statusValidator(isWishlist),
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

      if (!mongoose.isObjectIdOrHexString(req.params.id)) {
        return res.status(404).json(createHttpError(404, "Book not found"));
      }
      const bookInfo = await BookInfo.findById(req.params.id).exec();
      if (!bookInfo)
        return res.status(404).json(createHttpError(404, "Book not found"));

      const origBook = await Book.findById(bookInfo.book, "key").exec();
      const searchKey = stripBookKey(book_key);
      if (searchKey !== origBook?.key) {
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
        bookInfo.book = book._id;
      }

      bookInfo.status = isWishlist
        ? status && status !== BookStatus.Wishlist
          ? BookStatus.Default
          : BookStatus.Wishlist
        : status;
      bookInfo.other_name =
        bookInfo.status === BookStatus.Default ||
        bookInfo.status === BookStatus.Wishlist
          ? undefined
          : other_name;
      bookInfo.date =
        bookInfo.status === BookStatus.Default ||
        bookInfo.status === BookStatus.Wishlist
          ? undefined
          : date;

      await bookInfo.save();
      await bookInfo.populate("book");
      return res.status(200).json(bookInfo);
    } catch (err) {
      next(err);
    }
  },
];

export const bookshelf_delete_book: RequestHandler = async (
  req: JWTRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.auth || req.auth.id === undefined)
    return res.status(401).json(createHttpError(401));

  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(404).json(createHttpError(404, "Book not found"));
    }
    const book = await BookInfo.findById(req.params.id).exec();
    if (!book)
      return res.status(404).json(createHttpError(404, "Book not found"));
    if (book.owner.toString() !== req.auth.id)
      return res
        .status(401)
        .json(
          createHttpError(401, "User does not have permission to delete book")
        );
    const { deletedCount } = await BookInfo.deleteOne({
      _id: req.params.id,
      owner: req.auth.id,
    }).exec();
    if (deletedCount !== 1) return res.status(409).json(createHttpError(409));
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};
