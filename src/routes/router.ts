import express from "express";

export const router = express();

// Setup logging.
import Morgan from "morgan";
router.use(Morgan("tiny"));
