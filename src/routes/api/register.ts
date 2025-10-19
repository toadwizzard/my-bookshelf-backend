import express from "express";
import {
  register,
  validate_email,
  validate_password,
  validate_username,
} from "../../controllers/userController.js";

const router = express.Router();

router.post("/", register);
router.post("/username", validate_username);
router.post("/email", validate_email);
router.post("/password", validate_password);

export default router;
