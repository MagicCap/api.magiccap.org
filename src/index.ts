import { router } from "./routes";
const port = process.env.PORT || 3000;
router.listen(`0.0.0.0:${port}`, () => {
    console.log(`Listening on port ${port}`);
});
