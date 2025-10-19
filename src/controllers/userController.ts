import { RequestHandler, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request as JWTRequest } from "express-jwt";
import User from "../models/user.js";
import config from "../config.js";
import createHttpError from "http-errors";
import { body, validationResult } from "express-validator";
import {
  emailValidator,
  passwordValidator,
  usernameValidator,
} from "../middlewares/userValidators.js";

const validate_field: RequestHandler = (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty())
    return res
      .status(400)
      .json(
        createHttpError(400, "Invalid field value", { errors: result.array() })
      );
  res.sendStatus(200);
};

export const validate_username = [usernameValidator, validate_field];
export const validate_email = [emailValidator, validate_field];
export const validate_password = [passwordValidator, validate_field];

export const register: RequestHandler[] = [
  usernameValidator,
  emailValidator,
  passwordValidator,
  async (req, res, next) => {
    const result = validationResult(req);
    if (!result.isEmpty())
      return res.status(400).json(
        createHttpError(400, "Invalid field values", {
          errors: result.array(),
        })
      );

    const { username, email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ username, email, password: hashedPassword });
      await user.save();
      res.sendStatus(201);
    } catch (err) {
      next(err);
    }
  },
];

export const login: RequestHandler[] = [
  body("username")
    .exists()
    .withMessage("Username is required.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Username is required."),
  body("password")
    .exists()
    .withMessage("Password is required.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Password is required."),
  async (req, res, next) => {
    const result = validationResult(req);
    if (!result.isEmpty())
      return res.status(400).json(
        createHttpError(400, "Invalid field values", {
          errors: result.array(),
        })
      );

    const { username, password } = req.body;
    try {
      const user = await User.findOne({ username }).exec();
      if (!user)
        return res
          .status(400)
          .json(createHttpError(400, "Username or password is incorrect."));

      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch)
        return res
          .status(400)
          .json(createHttpError(400, "Username or password is incorrect."));

      const token = jwt.sign(
        { id: user._id, admin: user.admin },
        config.jwtSecret,
        { expiresIn: config.jwtExpiration }
      );
      res.status(200).json({ token, expiresIn: config.jwtExpiration });
    } catch (err) {
      next(err);
    }
  },
];

export const user_get = (req: JWTRequest, res: Response) => {
  res.json({ message: "user get", user_id: req.auth?.id });
};
