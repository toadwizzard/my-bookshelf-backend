import express, { Request, Response, NextFunction } from "express";
import profileRouter from "./profile.js";
import createHttpError from "http-errors";
import { expressjwt } from "express-jwt";
import { login, register } from "../../controllers/userController.js";
import config from "../../config.js";

const router = express.Router();

router.use(
  "/profile",
  expressjwt({
    secret: config.jwtSecret,
    algorithms: ["HS256"],
  }),
  profileRouter
);
router.post("/login", login);
router.post("/register", register);

router.use((req, res, next) => {
  next(createHttpError(404));
});
router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;
  res.status(status).json({
    status,
    message: err.message || "An error occurred",
    error: req.app.get("env") === "development" ? err : {},
  });
});

export default router;
