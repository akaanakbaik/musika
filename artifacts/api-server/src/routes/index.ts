import { Router, type IRouter } from "express";
import healthRouter from "./health";
import musicRouter from "./music";
import aiRouter from "./ai";
import uploadRouter from "./upload";
import authRouter from "./auth";
import dbRouter from "./db";
import webhookRouter from "./webhook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(musicRouter);
router.use(dbRouter);
router.use(aiRouter);
router.use(uploadRouter);
router.use(webhookRouter);

export default router;
