import { router } from "./routes";

// Setup logging.
import Morgan from "morgan";
router.use(Morgan("tiny"));

// Start the server.
const port = process.env.PORT || 3000;
router.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
