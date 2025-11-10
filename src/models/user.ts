import mongoose, { Schema } from "mongoose";
import BookInfo from "./bookInfo.js";

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    minLength: 4,
    maxLength: 30,
  },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, minLength: 8 },
  admin: { type: Boolean, default: false },
});

UserSchema.pre("deleteOne", async function (next) {
  const userId = this.getQuery()._id;
  await BookInfo.deleteMany({ owner: userId }).exec();
  next();
});

export default mongoose.model("User", UserSchema);
