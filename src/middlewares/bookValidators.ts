import { body, query } from "express-validator";
import { statusArray } from "../helpers/status.js";

export const keyValidator = body("book_key", "Book key is required.")
  .exists()
  .bail()
  .trim()
  .notEmpty();

export const statusValidator = (isWishlist: boolean) =>
  body("status", "Status is required.")
    .if((value, { req }) => req.body?.status || !isWishlist)
    .exists()
    .bail()
    .trim()
    .notEmpty()
    .bail()
    .isIn(statusArray())
    .withMessage("Invalid status.");

export const otherNameValidator = body("other_name")
  .optional()
  .trim()
  .notEmpty()
  .withMessage("Name cannot be blank.")
  .bail()
  .isAlphanumeric("en-US", { ignore: " " })
  .withMessage(
    "Name must only contain alphanumeric characters (letters and numbers)."
  )
  .isLength({ min: 4, max: 30 })
  .withMessage("Name must be between 4 and 30 characters.");

export const dateValidator = body("date")
  .optional()
  .isDate()
  .withMessage("Date must be in a valid date format.");

export const statusFilterValidator = (isWishlist: boolean) =>
  query("status")
    .optional()
    .custom((status) => {
      if (isWishlist) return true;
      if (typeof status !== "string")
        throw new Error("Status must be a single query parameter.");
      const statuses = status.split(",");
      const hasInvalid = statuses.some(
        (st) => !statusArray().some((valSt) => valSt.toLowerCase() === st)
      );
      if (hasInvalid)
        throw new Error("Status query values must be valid status values.");
      return true;
    });

export const sortValidator = (paramName: string) =>
  query(paramName)
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort value must be 'asc' or 'desc'.");
