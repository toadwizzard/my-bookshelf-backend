import mongoose, { Schema } from "mongoose";
import { BookStatus, statusArray } from "../helpers/status.js";
import dayjs from "dayjs";

const BookInfoSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    other_name: String,
    status: {
      type: String,
      required: true,
      enum: statusArray(),
      default: BookStatus.Default,
    },
    date: Date,
  },
  {
    virtuals: {
      owner_name: {
        get() {
          if (
            this.status === BookStatus.Default ||
            this.status === BookStatus.Lent
          )
            return "Me";
          if (this.status === BookStatus.Borrowed)
            return this.other_name ?? "Other";
          if (this.status === BookStatus.LibraryBorrowed)
            return this.other_name ?? "Library";
          return "";
        },
      },
      full_status: {
        get() {
          const date = this.date
            ? dayjs(this.date).format("YYYY. MM. DD.")
            : "";
          if (this.status === BookStatus.Lent)
            return (
              "Lent" +
              (this.other_name ? ` to ${this.other_name}` : "") +
              (this.date ? ` on ${date}` : "")
            );
          if (this.status === BookStatus.Borrowed)
            return "Borrowed" + (this.date ? ` on ${date}` : "");
          if (this.status === BookStatus.LibraryBorrowed)
            return "Borrowed" + (this.date ? ` (due ${date})` : "");
          return "";
        },
      },
    },
  }
);

export default mongoose.model("BookInfo", BookInfoSchema);
