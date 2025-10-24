import express from "express";
import {
  bookshelf_add,
  bookshelf_search,
} from "../../controllers/bookshelfController.js";

const router = express.Router();

router.post("/", bookshelf_add);
router.use("/search", bookshelf_search);

export default router;
