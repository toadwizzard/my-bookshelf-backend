import express from "express";
import { user_get } from "../../controllers/userController.js";

const router = express.Router();

router.get("/", user_get);

export default router;
