import mongoose, { Schema } from "mongoose";

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

export default mongoose.model("User", UserSchema);
