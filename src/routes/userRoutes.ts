import { Router } from "express";
import {
  createUser,
  editUser,
  getUser,
  updateUserImage,
  loginUser,
  getProfilePic,
  verifyConfirmToken,
  sendPasswordRecoveryEmail,
  updatePasswordOnRecovery,
} from "../controllers/userController";
import multerMiddleware from "../middlewares/multerMiddleware";
import { checkAuth } from "../middlewares/authMiddleware";
const router = Router();

router.post("/user/create", createUser);
router.post("/user/login", loginUser);
router.put("/user/editprofile", checkAuth, editUser);
router.get("/user/get/:ID", checkAuth, getUser);
router.post(
  "/user/updateimage",
  checkAuth,
  multerMiddleware.single("profile_image"),
  updateUserImage
);
router.get("/user/getprofilepic/:img", getProfilePic);
router.post("/user/verify/:token", verifyConfirmToken);
// SEND PASSWORD RECOVERY EMAIL
router.post("/user/password/recovery/:ownerID", sendPasswordRecoveryEmail);
// UPDATE PASSWORD ON RECOVERY MAIL CONFIRMATION
router.post("/user/password/recovery/set/:token", updatePasswordOnRecovery);

export default router;
