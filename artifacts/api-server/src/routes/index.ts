import { Router, type IRouter } from "express";
import healthRouter from "./health";
import musicRouter from "./music";
import aiRouter from "./ai";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(musicRouter);
router.use(aiRouter);
router.use(uploadRouter);

export default router;
