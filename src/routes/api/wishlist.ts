import express from "express";
import {
  bookshelf_add,
  bookshelf_get,
  bookshelf_get_book,
  bookshelf_update_book,
} from "../../controllers/bookshelfController.js";

const router = express.Router();

router.get("/book/:id", bookshelf_get_book(true));
router.patch("/book/:id", bookshelf_update_book(true));
router.get("/", bookshelf_get(true));
router.post("/", bookshelf_add(true));

export default router;
