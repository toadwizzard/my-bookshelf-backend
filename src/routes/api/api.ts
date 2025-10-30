import express, { Request, Response, NextFunction } from "express";
import indexRouter from "./index.js";
import profileRouter from "./profile.js";
import registerRouter from "./register.js";
import wishlistRouter from "./wishlist.js";
import createHttpError from "http-errors";
import { expressjwt } from "express-jwt";
import { login } from "../../controllers/userController.js";
import config from "../../config.js";

const router = express.Router();

router.post("/login", login);
router.use("/register", registerRouter);

router.use(
  expressjwt({
    secret: config.jwtSecret,
    algorithms: ["HS256"],
  })
);

router.use("/profile", profileRouter);
router.use("/wishlist", wishlistRouter);
router.use("/", indexRouter);

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
