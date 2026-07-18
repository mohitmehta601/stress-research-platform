import express from "express";
import stressResearchRoutes from "./compat/stressResearchRoutes.js";

const router = express.Router();

router.use(stressResearchRoutes);

export default router;
