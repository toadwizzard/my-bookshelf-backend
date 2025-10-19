import express from "express";
import {
  user_delete,
  user_get,
  user_update,
} from "../../controllers/userController.js";

const router = express.Router();

router.get("/", user_get);
router.patch("/", user_update);
router.delete("/", user_delete);

export default router;
