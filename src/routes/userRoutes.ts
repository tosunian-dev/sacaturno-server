import { Router } from "express";
import {
  createUser,
  editUser,
  getUser,
  updateUserImage,
  loginUser,
  googleAuth,
  getProfilePic,
  verifyConfirmToken,
  sendPasswordRecoveryEmail,
  updatePasswordOnRecovery,
  getUserByEmail,
  updateFirstLoginStatus,
  resendConfirmationEmail,
  getServicesByBusinessID,
  setBackupPassword,
  getPasswordStatus,
} from "../controllers/userController";
import multerMiddleware from "../middlewares/multerMiddleware";
import { checkAuth } from "../middlewares/authMiddleware";
const router = Router();

router.post("/user/create", createUser);
router.post("/user/login", loginUser);
router.post("/user/google", googleAuth);
router.put("/user/editprofile", checkAuth, editUser);
router.get("/user/get/:ID", checkAuth, getUser);
router.get("/user/getbyemail/:email", getUserByEmail);

router.post(
  "/user/updateimage",
  checkAuth,
  multerMiddleware.single("profile_image"),
  updateUserImage
);
router.get("/user/getprofilepic/:img", getProfilePic);
router.post("/user/verify/:token", verifyConfirmToken);
router.post("/user/resend-confirmation/:email", resendConfirmationEmail);
// SEND PASSWORD RECOVERY EMAIL
router.post("/user/password/recovery/:ownerID", sendPasswordRecoveryEmail);
// UPDATE PASSWORD ON RECOVERY MAIL CONFIRMATION
router.post("/user/password/recovery/set/:token", updatePasswordOnRecovery);

// BACKUP PASSWORD (logged-in user without password, e.g. Google accounts)
router.get("/user/password/status", checkAuth, getPasswordStatus);
router.post("/user/password/set", checkAuth, setBackupPassword);

// UPDATE USER'S FIRST LOGIN -- SET isFirstLogin TO FALSE 
router.put("/user/firstlogin/:userID", checkAuth, updateFirstLoginStatus);

// get services by business ID in public views
router.get(
  "/user/business/service/get/:businessID",
  getServicesByBusinessID
);


export default router;
