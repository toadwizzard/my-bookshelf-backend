import mongoose, { Schema } from "mongoose";

const BookSchema = new Schema({
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  author: [String],
});

export default mongoose.model("Book", BookSchema);
