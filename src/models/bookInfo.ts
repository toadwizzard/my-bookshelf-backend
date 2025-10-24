import mongoose, { Schema } from "mongoose";

const BookInfoSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  other_name: String,
  status: {
    type: String,
    required: true,
    enum: ["Default", "Lent", "Borrowed", "LibraryBorrowed", "Wishlist"],
    default: "Default",
  },
  date: Date,
});

export default mongoose.model("BookInfo", BookInfoSchema);
