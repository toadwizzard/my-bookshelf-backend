import { NextFunction, RequestHandler, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request as JWTRequest } from "express-jwt";
import User from "../models/user.js";
import config from "../config.js";
import createHttpError from "http-errors";
import { body, validationResult } from "express-validator";
import {
  emailValidator,
  newPasswordValidator,
  oldPasswordValidator,
  passwordValidator,
  usernameValidator,
} from "../middlewares/userValidators.js";
import mongoose from "mongoose";

const validate_field: RequestHandler = (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty())
    return res
      .status(400)
      .json(
        createHttpError(400, "Invalid field value", { errors: result.array() })
      );
  res.sendStatus(204);
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

export const user_get = async (
  req: JWTRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.auth?.id)) {
      return res.status(404).json(createHttpError(404, "User not found"));
    }
    const user = await User.findById(req.auth?.id, "username email");
    if (!user)
      return res.status(404).json(createHttpError(404, "User not found"));
    res.status(200).json({ username: user.username, email: user.email });
  } catch (err) {
    next(err);
  }
};

export const user_update = [
  usernameValidator,
  emailValidator,
  oldPasswordValidator,
  newPasswordValidator,
  async (req: JWTRequest, res: Response, next: NextFunction) => {
    const result = validationResult(req);
    if (!result.isEmpty())
      return res.status(400).json(
        createHttpError(400, "Invalid field values", {
          errors: result.array(),
        })
      );
    try {
      if (!mongoose.isObjectIdOrHexString(req.auth?.id)) {
        return res.status(404).json(createHttpError(404, "User not found"));
      }
      const user = await User.findById(req.auth?.id).exec();
      if (!user)
        return res.status(404).json(createHttpError(404, "User not found"));
      const isMatch = await bcrypt.compare(req.body.oldPassword, user.password);
      if (!isMatch)
        return res.status(400).json(
          createHttpError(400, "Invalid field values", {
            errors: [
              {
                type: "field",
                msg: "Password doesn't match current password.",
                path: "oldPassword",
                location: "body",
              },
            ],
          })
        );
      user.username = req.body.username;
      user.email = req.body.email;
      if (req.body.newPassword) {
        user.password = await bcrypt.hash(req.body.newPassword, 10);
      }
      await user.save();
      res.status(200).json({ username: user.username, email: user.email });
    } catch (err) {
      next(err);
    }
  },
];

export const user_delete = async (
  req: JWTRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.auth?.id)) {
      return res.status(404).json(createHttpError(404, "User not found"));
    }
    const { deletedCount } = await User.deleteOne({ _id: req.auth?.id }).exec();
    if (deletedCount !== 1)
      return res.status(404).json(createHttpError(404, "User not found"));
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};
