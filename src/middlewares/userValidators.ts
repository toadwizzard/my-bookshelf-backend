import { body, ValidationChain } from "express-validator";
import User from "../models/user.js";

export const usernameValidator = body("username")
  .exists()
  .withMessage("Username is required.")
  .bail()
  .trim()
  .notEmpty()
  .withMessage("Username is required.")
  .bail()
  .isAlphanumeric()
  .withMessage(
    "Username must only contain alphanumeric characters (letters and numbers)."
  )
  .isLength({ min: 4, max: 30 })
  .withMessage("Username must be between 4 and 30 characters.")
  .custom(async (username, { req }) => {
    const existingUser = await User.findOne({ username }, "_id").exec();
    if (existingUser && existingUser._id.toString() !== req.auth?.id) {
      throw new Error("User with username already exists.");
    }
  });

export const emailValidator = body("email")
  .exists()
  .withMessage("Email is required.")
  .bail()
  .trim()
  .notEmpty()
  .withMessage("Email is required.")
  .bail()
  .isEmail()
  .withMessage("Email must be a valid email address.")
  .custom(async (email, { req }) => {
    const existingUser = await User.findOne({ email }, "_id").exec();
    if (existingUser && existingUser._id.toString() !== req.auth?.id) {
      throw new Error("User with email already exists.");
    }
  });

const passwordValidatorFactory = (passwordValidator: ValidationChain) =>
  passwordValidator
    .bail()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters.");

export const passwordValidator = passwordValidatorFactory(
  body("password")
    .exists()
    .withMessage("Password is required.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Password is required.")
);

export const oldPasswordValidator = body("oldPassword")
  .exists()
  .withMessage("Password is required.")
  .bail()
  .trim()
  .notEmpty()
  .withMessage("Password is required.");

export const newPasswordValidator = passwordValidatorFactory(
  body("newPassword").optional()
);
