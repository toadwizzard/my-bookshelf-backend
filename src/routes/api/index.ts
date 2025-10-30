import express from "express";
import {
  bookshelf_add,
  bookshelf_delete_book,
  bookshelf_get,
  bookshelf_search,
  bookshelf_update_book,
} from "../../controllers/bookshelfController.js";

const router = express.Router();

router.use("/search", bookshelf_search);
router.patch("/book/:id", bookshelf_update_book(false));
router.delete("/book/:id", bookshelf_delete_book);
router.get("/", bookshelf_get(false));
router.post("/", bookshelf_add(false));

export default router;
