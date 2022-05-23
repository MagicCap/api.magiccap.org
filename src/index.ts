import { router } from "./routes";

// Start the server.
const port = process.env.PORT || 3000;
router.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
