import express from "express";
import {
  bookshelf_add,
  bookshelf_get,
  bookshelf_search,
} from "../../controllers/bookshelfController.js";

const router = express.Router();

router.use("/search", bookshelf_search);
router.get("/", bookshelf_get);
router.post("/", bookshelf_add);

export default router;
