import { router } from "./routes";
const port = process.env.PORT || 3000;
router.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
