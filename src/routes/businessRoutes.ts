import { Router } from "express"
import { 
    createBusiness, 
    getBusinessByOwnerID,
    editBusinessData,
    updateBusinessImage
} from "../controllers/businessController"
import { checkAuth } from "../middlewares/authMiddleware"
import multerMiddleware from "../middlewares/multerMiddleware"
const router = Router()

router.post('/business/create', checkAuth, createBusiness)
router.get('/business/get/:ownerID', checkAuth, getBusinessByOwnerID)
router.put('/business/edit', checkAuth, editBusinessData)
router.post('/business/updateimage', checkAuth, multerMiddleware.single('profile_image'), updateBusinessImage)

export default router